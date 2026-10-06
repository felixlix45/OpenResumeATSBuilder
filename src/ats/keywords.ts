/**
 * Job-description keyword matching.
 *
 * The design goal is honesty: this reports which terms from a posting appear in
 * the resume and which do not. It does not invent a "match percentage" that an
 * ATS never computes. Coverage is a plain ratio over the terms the posting
 * actually repeats, and the UI always shows the term list behind the number.
 */

import { tokenize } from '../domain/text';
import { STOP_WORDS } from '../domain/text';
import type { ResumeData } from '../domain/types';
import { resumeToPlainText } from '../domain/text';

export interface JdTerm {
  /** Display form, as it appeared in the posting (lower-cased, joined). */
  term: string;
  /** How many times the term occurs in the posting. */
  count: number;
  /** True when the term appeared in a requirements-style line. */
  emphasised: boolean;
  /** True when the posting capitalised it (a strong hint it is a named skill). */
  capitalised: boolean;
  /** True for posting boilerplate ("experience", "team") rather than a skill. */
  generic: boolean;
  /** Ranking score used for ordering and coverage weighting. */
  score: number;
}

export interface KeywordMatch {
  term: string;
  count: number;
  emphasised: boolean;
  /** Posting boilerplate rather than a skill; never suggested as an addition. */
  generic: boolean;
}

export interface KeywordReport {
  /** Terms extracted from the posting after filtering. */
  jdTermCount: number;
  matched: KeywordMatch[];
  missing: KeywordMatch[];
  /** Weighted share of posting terms present in the resume, 0–1. */
  coverage: number;
  /** Significant words from the posting's job title. */
  titleTerms: string[];
  /** Title words the resume never mentions. */
  missingTitleTerms: string[];
  /** The posting's detected job title, when one could be found. */
  detectedTitle: string | null;
}

const EMPHASIS_LINE =
  /(requir|qualif|must have|proficien|experience (?:with|in)|knowledge of|familiar|skills?|responsib|you will|we are looking)/i;

const TITLE_LINE = /^(?:job\s*title|position|role|title|about the role|the role)\s*[:\u2013-]\s*(.+)$/i;

/**
 * Posting boilerplate that is not a skill.
 *
 * These terms are still counted for coverage — a posting that repeats
 * "experience" really does repeat it — but they rank low, so that a term like
 * "PostgreSQL" outranks them and never gets suggested as something to add to a
 * Skills section.
 */
const GENERIC_JD_TERMS = new Set([
  'experience', 'experiences', 'experienced', 'knowledge', 'ability', 'abilities', 'skill', 'skills',
  'requirement', 'requirements', 'responsibility', 'responsibilities', 'qualification', 'qualifications',
  'role', 'roles', 'position', 'job', 'opportunity', 'candidate', 'candidates', 'applicant', 'team', 'teams',
  'work', 'working', 'worker', 'looking', 'seeking', 'join', 'strong', 'excellent', 'good', 'great', 'solid',
  'deep', 'proven', 'demonstrated', 'track', 'record', 'understanding', 'familiarity', 'comfortable',
  'years', 'year', 'plus', 'preferred', 'required', 'must', 'will', 'including', 'related', 'field',
  'degree', 'bachelor', 'bachelors', 'masters', 'equivalent', 'relevant', 'similar', 'environment',
  'fast', 'paced', 'company', 'business', 'benefits', 'salary', 'apply', 'application', 'please',
  'you', 'your', 'our', 'we', 'us', 'they', 'their', 'help', 'support', 'ensure', 'provide', 'develop',
  'manage', 'managed', 'managing', 'build', 'building', 'create', 'creating', 'deliver', 'delivering',
  'expertise', 'proficiency', 'proficient', 'background', 'communication', 'collaboration', 'collaborate',
  'excellent', 'attention', 'detail', 'oriented', 'self', 'starter', 'motivated', 'driven',
]);

/** Collapses formatting differences so `front-end`, `front end` and `frontend` match. */
export function normalizeKey(term: string): string {
  return term
    .toLowerCase()
    .replace(/[\u2010-\u2015]/g, '-')
    .replace(/[^a-z0-9+#.]+/g, '');
}

function isUseful(term: string): boolean {
  if (term.length < 2) return false;
  if (STOP_WORDS.has(term)) return false;
  if (/^\d+$/.test(term)) return false;
  if (/^[^a-z0-9]+$/.test(term)) return false;
  // Reject "5+", "3-4" and similar: a real term carries letters.
  if (!/[a-z]/.test(term)) return false;
  return true;
}

/** True when every word in a term is posting boilerplate rather than a skill. */
function isGenericTerm(term: string): boolean {
  const words = term.split(/\s+/).filter(Boolean);
  if (words.length === 0) return false;
  return words.every((word) => GENERIC_JD_TERMS.has(word));
}

interface Candidate {
  term: string;
  count: number;
  emphasised: number;
  capitalised: number;
}

/**
 * Extracts ranked terms from a posting: single words plus two-word phrases
 * ("machine learning", "unit testing"), because those matter to keyword screens
 * and are routinely missed by naive single-word matching.
 */
export function extractJdTerms(jobDescription: string): JdTerm[] {
  const text = (jobDescription ?? '').replace(/\r\n?/g, '\n');
  if (!text.trim()) return [];

  const candidates = new Map<string, Candidate>();
  const lines = text.split('\n');

  const bump = (key: string, display: string, emphasised: boolean, capitalised: boolean) => {
    const existing = candidates.get(key);
    if (existing) {
      existing.count += 1;
      if (emphasised) existing.emphasised += 1;
      if (capitalised) existing.capitalised += 1;
      return;
    }
    candidates.set(key, {
      term: display,
      count: 1,
      emphasised: emphasised ? 1 : 0,
      capitalised: capitalised ? 1 : 0,
    });
  };

  /**
   * A two-word phrase only counts when the two words were genuinely adjacent in
   * the posting — same line, one space apart, nothing between them.
   *
   * Joining tokens that merely survived stop-word removal produces nonsense like
   * "knowledgepostgresql" from "knowledge of PostgreSQL", and those fake phrases
   * crowd the real skills out of the ranking.
   */
  const TOKEN_PATTERN = /[A-Za-z0-9][A-Za-z0-9+#./-]*/g;

  for (const rawLine of lines) {
    const line = rawLine.replace(/^\s*(?:[-*\u2022\u2013\u25aa\u00b7]|\d+[.)])\s+/, '');
    const emphasised = EMPHASIS_LINE.test(line);
    const matches = [...line.matchAll(TOKEN_PATTERN)];

    for (const match of matches) {
      const token = match[0].toLowerCase();
      if (!isUseful(token)) continue;
      const capitalised = /^[A-Z]/.test(match[0].replace(/^[^A-Za-z]+/, ''));
      bump(normalizeKey(token), token, emphasised, capitalised);
    }

    for (let index = 0; index < matches.length - 1; index += 1) {
      const first = matches[index];
      const second = matches[index + 1];
      const firstToken = first[0].toLowerCase();
      const secondToken = second[0].toLowerCase();
      if (!isUseful(firstToken) || !isUseful(secondToken)) continue;
      if (firstToken.length < 3 && secondToken.length < 3) continue;
      const between = line.slice(first.index + first[0].length, second.index);
      if (!/^\s+$/.test(between)) continue;
      bump(
        `${normalizeKey(firstToken)} ${normalizeKey(secondToken)}`,
        `${firstToken} ${secondToken}`,
        emphasised,
        false,
      );
    }
  }

  const terms: JdTerm[] = [];
  for (const [key, candidate] of candidates) {
    // A phrase has to recur, or be emphasised, to outrank a plain word.
    const isPhrase = key.includes(' ');
    if (isPhrase && candidate.count < 2 && candidate.emphasised === 0) continue;
    const base =
      candidate.count * (isPhrase ? 2.2 : 1) +
      candidate.emphasised * 1.6 +
      candidate.capitalised * 1.2;
    const generic = isGenericTerm(candidate.term);
    terms.push({
      term: candidate.term,
      count: candidate.count,
      emphasised: candidate.emphasised > 0,
      capitalised: candidate.capitalised > 0,
      generic,
      score: generic ? base * 0.3 : base,
    });
  }

  terms.sort((a, b) => b.score - a.score || a.term.localeCompare(b.term));
  return terms.slice(0, 60);
}

/** Every normalised key the resume contains, including two-word phrases. */
export function resumeKeySet(data: ResumeData): Set<string> {
  const keys = new Set<string>();
  const add = (value: string) => {
    const key = normalizeKey(value);
    if (key) keys.add(key);
  };

  const text = resumeToPlainText(data);
  for (const line of text.split('\n')) {
    const tokens = tokenize(line);
    for (const token of tokens) {
      add(token);
      // Multi-word skill names are often hyphenated or spaced in the resume.
      add(token.replace(/-/g, ''));
    }
    for (let index = 0; index < tokens.length - 1; index += 1) {
      add(`${tokens[index]} ${tokens[index + 1]}`);
    }
  }

  for (const section of data.sections) {
    if (section.kind === 'skills') {
      for (const group of section.groups) {
        add(group.label);
        for (const item of group.items) add(item);
      }
    }
  }

  return keys;
}

function detectJobTitle(jobDescription: string): string | null {
  const lines = jobDescription
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  for (const line of lines.slice(0, 25)) {
    const explicit = TITLE_LINE.exec(line);
    if (explicit && explicit[1].trim()) return explicit[1].trim();
  }
  // Fall back to the first short line that reads like a title rather than a sentence.
  for (const line of lines.slice(0, 8)) {
    const words = line.split(/\s+/);
    if (words.length >= 2 && words.length <= 9 && line.length <= 70 && !/[.!?]$/.test(line)) {
      return line;
    }
  }
  return null;
}

const TITLE_STOP_WORDS = new Set([
  ...STOP_WORDS,
  'senior', 'junior', 'staff', 'lead', 'principal', 'mid', 'level', 'remote', 'hybrid', 'onsite', 'contract',
  'full', 'part', 'time', 'seeking', 'wanted', 'hiring', 'opportunity', 'join', 'our', 'team', 'new',
]);

function titleTermsOf(title: string): string[] {
  return tokenize(title).filter((term) => !TITLE_STOP_WORDS.has(term) && term.length > 2);
}

/**
 * Compares a posting against a resume. Returns `null` when there is no posting
 * to compare against, so callers can render an empty state rather than a zero.
 */
export function analyzeKeywords(data: ResumeData, jobDescription: string): KeywordReport | null {
  const terms = extractJdTerms(jobDescription);
  if (terms.length === 0) return null;

  const keys = resumeKeySet(data);

  const matched: KeywordMatch[] = [];
  const missing: KeywordMatch[] = [];
  let totalWeight = 0;
  let matchedWeight = 0;

  for (const term of terms) {
    const weight = 1 + Math.log2(term.count);
    totalWeight += weight;
    const hit = keys.has(normalizeKey(term.term));
    if (hit) {
      matchedWeight += weight;
      matched.push({ term: term.term, count: term.count, emphasised: term.emphasised, generic: term.generic });
    } else {
      missing.push({ term: term.term, count: term.count, emphasised: term.emphasised, generic: term.generic });
    }
  }

  const detectedTitle = detectJobTitle(jobDescription);
  const titleTerms = detectedTitle ? titleTermsOf(detectedTitle) : [];
  const missingTitleTerms = titleTerms.filter((term) => !keys.has(normalizeKey(term)));

  return {
    jdTermCount: terms.length,
    matched,
    missing,
    coverage: totalWeight === 0 ? 0 : matchedWeight / totalWeight,
    titleTerms,
    missingTitleTerms,
    detectedTitle,
  };
}

/**
 * Ranked, de-duplicated skill suggestions for the posting — used to offer
 * one-click additions to the Skills section.
 */
export function suggestSkillAdditions(report: KeywordReport, limit = 12): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of report.missing) {
    if (item.generic) continue;
    const key = normalizeKey(item.term);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item.term);
    if (out.length >= limit) break;
  }
  return out;
}
