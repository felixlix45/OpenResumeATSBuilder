/**
 * The ATS analyser.
 *
 * Every check answers one question: *will a parser, or a six-second human scan,
 * get this right?* Checks are explainable by construction — each one states why
 * it matters and what to do — and each contributes a weighted amount to the
 * score, so the number can always be traced back to specific, fixable issues.
 *
 * The analyser is a pure function of the resume data, so it is unit-tested
 * directly and can run on every keystroke.
 */

import { isFutureDate, parseDateValue, rangeIsInverted } from '../domain/dates';
import { TEMPLATE_MAP } from '../domain/templates';
import { resumeToPlainText, tokenize } from '../domain/text';
import { isEntrySection, isSkillsSection, isSummarySection } from '../domain/types';
import type { EntrySection, ResumeData, Section } from '../domain/types';
import { safeUrl } from '../domain/urls';
import { analyzeKeywords } from './keywords';
import type { AnalysisInput, AnalysisResult, Check, CheckCounts, CheckStatus, CheckTarget, Grade } from './types';
import {
  EMAIL_PATTERN,
  FIRST_PERSON_PRONOUNS,
  PHONE_PATTERN,
  PLACEHOLDER_PATTERNS,
  QUANTIFIER_PATTERN,
  recognisedHeadingGroup,
  STRONG_BULLET_VERBS,
  WEAK_BULLET_OPENERS,
} from './vocabulary';

/** Parses `#rrggbb` into 0–255 channels, or `null` when malformed. */
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  const value = Number.parseInt(match[1], 16);
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
}

function channelLuminance(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** WCAG 2.x relative luminance. */
export function relativeLuminance(hex: string): number | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  return (
    0.2126 * channelLuminance(rgb.r) + 0.7152 * channelLuminance(rgb.g) + 0.0722 * channelLuminance(rgb.b)
  );
}

/** WCAG contrast ratio between two hex colours. */
export function contrastRatio(a: string, b: string): number | null {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  if (la === null || lb === null) return null;
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

interface CheckDraft {
  id: string;
  category: Check['category'];
  title: string;
  status: CheckStatus;
  detail: string;
  fix?: string;
  target?: CheckTarget;
  weight?: number;
}

function quote(text: string, limit = 60): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > limit ? `"${clean.slice(0, limit - 1)}\u2026"` : `"${clean}"`;
}

function listSamples(items: string[], limit = 2): string {
  return items.slice(0, limit).join(', ');
}

function visibleSections(data: ResumeData): Section[] {
  return data.sections.filter((section) => section.visible);
}

function sectionIsEmpty(section: Section): boolean {
  if (isSummarySection(section)) return section.text.trim().length === 0;
  if (isSkillsSection(section)) {
    return section.groups.every((group) => group.items.filter((item) => item.trim()).length === 0);
  }
  if (section.kind === 'languages') {
    return section.items.every((item) => item.name.trim().length === 0);
  }
  if (isEntrySection(section)) {
    return section.entries.every((item) => entryIsEmpty(item));
  }
  return true;
}

function entryIsEmpty(entry: EntrySection['entries'][number]): boolean {
  return (
    !entry.title.trim() &&
    !entry.subtitle.trim() &&
    !entry.description.trim() &&
    entry.bullets.every((bullet) => !bullet.text.trim())
  );
}

function entryHasContent(entry: EntrySection['entries'][number]): boolean {
  return !entryIsEmpty(entry);
}

/** Every bullet in the document, with the section and entry it came from. */
function allBullets(data: ResumeData) {
  const out: Array<{ text: string; sectionId: string; entryId: string; index: number; sectionKind: string }> = [];
  for (const section of visibleSections(data)) {
    if (!isEntrySection(section)) continue;
    for (const entry of section.entries) {
      entry.bullets.forEach((bullet, index) => {
        const text = bullet.text.trim();
        if (text) {
          out.push({ text, sectionId: section.id, entryId: entry.id, index, sectionKind: section.kind });
        }
      });
    }
  }
  return out;
}

function experienceEntries(data: ResumeData) {
  const out: Array<{ section: EntrySection; entry: EntrySection['entries'][number] }> = [];
  for (const section of visibleSections(data)) {
    if (!isEntrySection(section)) continue;
    if (section.kind !== 'experience' && section.kind !== 'volunteer') continue;
    for (const entry of section.entries) {
      if (entryHasContent(entry)) out.push({ section, entry });
    }
  }
  return out;
}

function scoreToGrade(score: number): Grade {
  if (score >= 90) return 'excellent';
  if (score >= 75) return 'good';
  if (score >= 55) return 'fair';
  return 'needs-work';
}

/** The analyser entry point. Pure: same input, same output, no I/O. */
export function analyzeResume(data: ResumeData, input: AnalysisInput = {}): AnalysisResult {
  const checks: Check[] = [];
  const wordCount = tokenize(resumeToPlainText(data)).length;
  const hasSubstance = wordCount >= 20;
  const add = (draft: CheckDraft) => {
    // Nothing meaningful in the document means a "pass" proves nothing, so it is
    // reported as information instead of counting towards the score.
    const status = !hasSubstance && draft.status === 'pass' ? 'info' : draft.status;
    checks.push({
      id: draft.id,
      category: draft.category,
      title: draft.title,
      status,
      detail: draft.detail,
      fix: draft.fix,
      target: draft.target,
      weight: draft.weight ?? 2,
    });
  };

  const sections = visibleSections(data);
  const experience = experienceEntries(data);
  const bullets = allBullets(data);
  const plainText = resumeToPlainText(data);

  checkIdentity(data, add);
  checkStructure(sections, add);
  checkContent(data, sections, experience, bullets, plainText, add);
  checkFormatting(data, input, add);

  const keywords = input.jobDescription?.trim() ? analyzeKeywords(data, input.jobDescription) : null;
  if (keywords) checkKeywords(keywords, add);

  const counts: CheckCounts = { pass: 0, warn: 0, fail: 0, info: 0 };
  let weighted = 0;
  let totalWeight = 0;
  for (const check of checks) {
    counts[check.status] += 1;
    if (check.status === 'info') continue;
    const value = check.status === 'pass' ? 1 : check.status === 'warn' ? 0.45 : 0;
    weighted += value * check.weight;
    totalWeight += check.weight;
  }
  const score = totalWeight === 0 ? 0 : Math.round((weighted / totalWeight) * 100);

  return { checks, counts, score, grade: scoreToGrade(score), wordCount, keywords };
}

type AddCheck = (draft: CheckDraft) => void;

function checkIdentity(data: ResumeData, add: AddCheck): void {
  const { basics } = data;

  const nameWords = basics.fullName.trim().split(/\s+/).filter(Boolean);
  if (nameWords.length === 0) {
    add({
      id: 'identity.name',
      category: 'identity',
      title: 'Add your full name',
      status: 'fail',
      detail: 'Every parser keys the document on the candidate name. Without it the resume has no owner.',
      fix: 'Enter your name exactly as you want it to appear on offers and background checks.',
      target: { field: 'basics.fullName' },
      weight: 3,
    });
  } else if (nameWords.length === 1) {
    add({
      id: 'identity.name',
      category: 'identity',
      title: 'Use your full name',
      status: 'warn',
      detail: `"${basics.fullName.trim()}" is a single word, which parsers often cannot split into first and last name.`,
      fix: 'Add your family name so the parser can populate both name fields.',
      target: { field: 'basics.fullName' },
      weight: 3,
    });
  } else {
    add({
      id: 'identity.name',
      category: 'identity',
      title: 'Full name present',
      status: 'pass',
      detail: 'The name sits on its own line at the top of page one, where parsers look for it.',
      weight: 3,
    });
  }

  const email = basics.email.trim();
  if (!email) {
    add({
      id: 'identity.email',
      category: 'identity',
      title: 'Add an email address',
      status: 'fail',
      detail: 'Contact parsing fails without an email; many systems cannot create a candidate record at all.',
      fix: 'Use an address you check daily, ideally firstname.lastname@…',
      target: { field: 'basics.email' },
      weight: 3,
    });
  } else if (!EMAIL_PATTERN.test(email)) {
    add({
      id: 'identity.email',
      category: 'identity',
      title: 'Check the email address',
      status: 'fail',
      detail: `"${email}" does not match a valid address shape, so the parser will drop it.`,
      fix: 'Remove spaces or stray characters — for example name@example.com.',
      target: { field: 'basics.email' },
      weight: 3,
    });
  } else {
    add({
      id: 'identity.email',
      category: 'identity',
      title: 'Email is valid and clickable',
      status: 'pass',
      detail: 'The address is printed as text and also carries a mailto: link annotation.',
      weight: 3,
    });
  }

  const phone = basics.phone.trim();
  if (!phone) {
    add({
      id: 'identity.phone',
      category: 'identity',
      title: 'Add a phone number',
      status: 'warn',
      detail: 'Most recruiters shortlist by phone; a missing number slows the first contact.',
      fix: 'Include a country code if you are applying outside your own country.',
      target: { field: 'basics.phone' },
    });
  } else if (!PHONE_PATTERN.test(phone)) {
    add({
      id: 'identity.phone',
      category: 'identity',
      title: 'Phone number looks incomplete',
      status: 'warn',
      detail: `"${phone}" does not contain enough digits to be dialled, so it may be dropped.`,
      fix: 'Use a full number with area or country code, e.g. +1 (206) 555-0142.',
      target: { field: 'basics.phone' },
    });
  } else {
    add({
      id: 'identity.phone',
      category: 'identity',
      title: 'Phone number parses cleanly',
      status: 'pass',
      detail: 'Digits are grouped conventionally, which keeps the number intact during extraction.',
      weight: 1,
    });
  }

  if (!basics.location.trim()) {
    add({
      id: 'identity.location',
      category: 'identity',
      title: 'Add your city and region',
      status: 'warn',
      detail: 'Location is used for work-authorisation and relocation filters, and it takes part in keyword matching.',
      fix: 'Write it as "City, ST" or "City, Country" — no street address.',
      target: { field: 'basics.location' },
      weight: 1,
    });
  } else if (/\d/.test(basics.location) && /street|st\.|ave|road|rd\.|apt|suite/i.test(basics.location)) {
    add({
      id: 'identity.location',
      category: 'identity',
      title: 'Trim the street address',
      status: 'warn',
      detail: 'Full postal addresses add noise and are a privacy risk; parsers only need city and region.',
      fix: 'Reduce it to "City, ST".',
      target: { field: 'basics.location' },
      weight: 1,
    });
  } else {
    add({
      id: 'identity.location',
      category: 'identity',
      title: 'Location present',
      status: 'pass',
      detail: 'City-level location is enough for matching and avoids privacy exposure.',
      weight: 1,
    });
  }

  if (!basics.headline.trim()) {
    add({
      id: 'identity.headline',
      category: 'identity',
      title: 'Add a target job title',
      status: 'warn',
      detail: 'A headline directly under your name is the first thing both parsers and recruiters match on.',
      fix: 'Use the title from the posting, e.g. "Senior Backend Engineer".',
      target: { field: 'basics.headline' },
    });
  } else {
    add({
      id: 'identity.headline',
      category: 'identity',
      title: 'Target job title present',
      status: 'pass',
      detail: `"${basics.headline.trim()}" gives the parser an explicit role to match.`,
      weight: 1,
    });
  }

  const unusable = basics.links.filter((link) => link.url.trim() && !safeUrl(link.url));
  const labelOnly = basics.links.filter((link) => !link.url.trim() && link.label.trim());
  if (unusable.length > 0) {
    add({
      id: 'identity.links',
      category: 'identity',
      title: 'Fix unusable contact links',
      status: 'fail',
      detail: `${listSamples(unusable.map((link) => link.label || link.url))} ${
        unusable.length === 1 ? 'is' : 'are'
      } not a valid http(s) URL, so no clickable link can be created.`,
      fix: 'Paste the full address including https://',
      target: { field: 'basics.links' },
    });
  } else if (labelOnly.length > 0) {
    add({
      id: 'identity.links',
      category: 'identity',
      title: 'Add URLs for labelled links',
      status: 'warn',
      detail: `${listSamples(labelOnly.map((link) => link.label))} ${
        labelOnly.length === 1 ? 'has' : 'have'
      } a label but no address, so only the words are printed.`,
      fix: 'Paste the profile URL so it becomes a clickable link.',
      target: { field: 'basics.links' },
    });
  } else if (basics.links.length === 0) {
    add({
      id: 'identity.links',
      category: 'identity',
      title: 'Consider adding a LinkedIn or portfolio link',
      status: 'info',
      detail: 'A profile URL gives reviewers one click of proof and adds searchable keywords.',
      fix: 'Add your LinkedIn profile, and GitHub or a portfolio for technical roles.',
      target: { field: 'basics.links' },
      weight: 1,
    });
  } else {
    add({
      id: 'identity.links',
      category: 'identity',
      title: 'Contact links are clickable',
      status: 'pass',
      detail: `${basics.links.length} link${basics.links.length === 1 ? '' : 's'} will be emitted as real PDF link annotations.`,
      weight: 1,
    });
  }
}

function checkStructure(sections: Section[], add: AddCheck): void {
  const unrecognised = sections.filter(
    (section) => !recognisedHeadingGroup(section.heading) && section.heading.trim().length > 0,
  );
  if (unrecognised.length > 0) {
    add({
      id: 'structure.headings',
      category: 'structure',
      title: 'Use conventional section headings',
      status: unrecognised.length > 1 ? 'fail' : 'warn',
      detail: `${listSamples(unrecognised.map((section) => quote(section.heading, 40)))} ${
        unrecognised.length === 1 ? 'is not a heading' : 'are not headings'
      } parsers reliably recognise, so that content may be filed under "other".`,
      fix: 'Rename to a standard heading such as "Professional Experience", "Education" or "Skills".',
      target: { sectionId: unrecognised[0]?.id },
    });
  } else if (sections.length > 0) {
    add({
      id: 'structure.headings',
      category: 'structure',
      title: 'Section headings are standard',
      status: 'pass',
      detail: 'Every heading matches wording that resume parsers are trained to segment on.',
      weight: 3,
    });
  }

  const seen = new Map<Section['kind'], Section[]>();
  for (const section of sections) {
    const group = seen.get(section.kind) ?? [];
    group.push(section);
    seen.set(section.kind, group);
  }
  const duplicates = [...seen.entries()].filter(([kind, group]) => group.length > 1 && !isRepeatableKind(kind));
  if (duplicates.length > 0) {
    add({
      id: 'structure.duplicates',
      category: 'structure',
      title: 'Merge duplicate sections',
      status: 'warn',
      detail: `${duplicates
        .map(([, group]) => quote(group[0].heading, 30))
        .join(', ')} appear more than once. Parsers keep the first and discard later ones, so content disappears.`,
      fix: 'Move every entry into a single section of that type.',
      target: { sectionId: duplicates[0][1][1]?.id },
    });
  } else {
    add({
      id: 'structure.duplicates',
      category: 'structure',
      title: 'No duplicate section types',
      status: 'pass',
      detail: 'Each standard section appears once, so nothing is overwritten during parsing.',
      weight: 2,
    });
  }

  const empty = sections.filter((section) => sectionIsEmpty(section));
  if (empty.length > 0) {
    add({
      id: 'structure.empty',
      category: 'structure',
      title: 'Remove or fill empty sections',
      status: 'warn',
      detail: `${listSamples(empty.map((section) => quote(section.heading, 30)))} ${
        empty.length === 1 ? 'is' : 'are'
      } visible but empty, which prints a heading with nothing under it.`,
      fix: 'Add content or hide the section.',
      target: { sectionId: empty[0].id },
    });
  } else {
    add({
      id: 'structure.empty',
      category: 'structure',
      title: 'No empty sections',
      status: 'pass',
      detail: 'Every visible heading has content beneath it.',
      weight: 1,
    });
  }

  const longHeadings = sections.filter((section) => section.heading.trim().length > 45);
  if (longHeadings.length > 0) {
    add({
      id: 'structure.headingLength',
      category: 'structure',
      title: 'Shorten long headings',
      status: 'warn',
      detail: 'Headings over about 45 characters wrap onto a second line and stop reading as headings to a parser.',
      fix: 'Keep headings to two or three words.',
      target: { sectionId: longHeadings[0].id },
      weight: 1,
    });
  }

  const hasExperience = sections.some((section) => isEntrySection(section) && section.kind === 'experience' && section.entries.some(entryHasContent));
  if (!hasExperience) {
    add({
      id: 'structure.experience',
      category: 'structure',
      title: 'Add a Professional Experience section',
      status: 'fail',
      detail: 'Experience is the section recruiters and parsers weight most heavily; without it the resume reads as untargeted.',
      fix: 'Add your roles, most recent first. Internships, contract and volunteer work all count.',
      weight: 3,
    });
  } else {
    add({
      id: 'structure.experience',
      category: 'structure',
      title: 'Experience section present',
      status: 'pass',
      detail: 'The parser will find a dated work history under a recognised heading.',
      weight: 3,
    });
  }

  const hasEducation = sections.some((section) => isEntrySection(section) && section.kind === 'education' && section.entries.some(entryHasContent));
  add({
    id: 'structure.education',
    category: 'structure',
    title: hasEducation ? 'Education section present' : 'Add an Education section',
    status: hasEducation ? 'pass' : 'warn',
    detail: hasEducation
      ? 'Degrees are printed with institution and dates, the fields parsers expect.'
      : 'Many postings require a degree or equivalent; a missing section is read as "no qualification".',
    fix: hasEducation ? undefined : 'Add your highest qualification, or a relevant certification.',
    weight: hasEducation ? 1 : 2,
  });

  const hasSkills = sections.some(
    (section) => isSkillsSection(section) && section.groups.some((group) => group.items.some((item) => item.trim())),
  );
  add({
    id: 'structure.skills',
    category: 'structure',
    title: hasSkills ? 'Skills section present' : 'Add a Skills section',
    status: hasSkills ? 'pass' : 'warn',
    detail: hasSkills
      ? 'Keyword screens read the Skills section first, so every term here is searchable.'
      : 'Keyword screens read the Skills section first; without it, matching relies on prose alone.',
    fix: hasSkills ? undefined : 'Group 10–20 concrete skills by category.',
    weight: hasSkills ? 1 : 2,
  });

  const experienceIndex = sections.findIndex((section) => isEntrySection(section) && section.kind === 'experience');
  const educationIndex = sections.findIndex((section) => isEntrySection(section) && section.kind === 'education');
  if (experienceIndex >= 0 && educationIndex >= 0 && educationIndex < experienceIndex) {
    add({
      id: 'structure.order',
      category: 'structure',
      title: 'Lead with experience',
      status: 'info',
      detail: 'Education currently comes before experience. Both parse fine; recruiters usually want the work history first.',
      fix: 'Drag Education below Experience — unless you are a recent graduate applying to a graduate scheme.',
      weight: 1,
    });
  }

  add({
    id: 'structure.singleColumn',
    category: 'structure',
    title: 'Single-column, table-free layout',
    status: 'pass',
    detail:
      'The renderer never emits tables, text boxes, columns or images, so extracted text follows reading order on every template.',
    weight: 3,
  });
}

function isRepeatableKind(kind: Section['kind']): boolean {
  return kind === 'certifications' || kind === 'awards' || kind === 'publications' || kind === 'volunteer' || kind === 'languages' || kind === 'custom' || kind === 'skills';
}

function checkContent(
  data: ResumeData,
  sections: Section[],
  experience: ReturnType<typeof experienceEntries>,
  bullets: ReturnType<typeof allBullets>,
  plainText: string,
  add: AddCheck,
): void {
  const summary = sections.find(isSummarySection);
  if (!summary) {
    add({
      id: 'content.summary',
      category: 'content',
      title: 'Add a professional summary',
      status: 'info',
      detail: 'A short summary is the only place you control the first 30 words a recruiter reads.',
      fix: 'Two to four lines: who you are, your scale, your strongest measurable result.',
      weight: 1,
    });
  } else {
    const words = tokenize(summary.text).length;
    if (words === 0) {
      add({
        id: 'content.summary',
        category: 'content',
        title: 'Write the professional summary',
        status: 'warn',
        detail: 'The section is visible but empty.',
        fix: 'Two to four lines, ending on a measurable result.',
        target: { sectionId: summary.id, field: 'text' },
        weight: 1,
      });
    } else if (words < 25) {
      add({
        id: 'content.summary',
        category: 'content',
        title: 'Expand the summary slightly',
        status: 'warn',
        detail: `At ${words} words it is too short to carry a positioning statement and a proof point.`,
        fix: 'Aim for 40–90 words.',
        target: { sectionId: summary.id, field: 'text' },
        weight: 1,
      });
    } else if (words > 120) {
      add({
        id: 'content.summary',
        category: 'content',
        title: 'Trim the summary',
        status: 'warn',
        detail: `At ${words} words the summary reads as a cover letter and pushes experience down the page.`,
        fix: 'Cut to 40–90 words and move detail into bullets.',
        target: { sectionId: summary.id, field: 'text' },
        weight: 1,
      });
    } else {
      add({
        id: 'content.summary',
        category: 'content',
        title: 'Summary length is right',
        status: 'pass',
        detail: `${words} words — long enough to position you, short enough to be read.`,
        weight: 1,
      });
    }
  }

  const experienceBullets = bullets.filter(
    (bullet) => bullet.sectionKind === 'experience' || bullet.sectionKind === 'volunteer',
  );

  if (experience.length > 0) {
    const withoutBullets = experience.filter(
      ({ entry }) => entry.bullets.every((bullet) => !bullet.text.trim()) && !entry.description.trim(),
    );
    add({
      id: 'content.bullets',
      category: 'content',
      title: withoutBullets.length === 0 ? 'Every role has achievements' : 'Add achievements to every role',
      status: withoutBullets.length === 0 ? 'pass' : 'warn',
      detail:
        withoutBullets.length === 0
          ? 'Each role carries at least one bullet, so there is something to read and something to match.'
          : `${withoutBullets.length} role${withoutBullets.length === 1 ? '' : 's'} — ${listSamples(
              withoutBullets.map(({ entry }) => quote(entry.title || 'Untitled role', 30)),
            )} — has no bullets. A title alone tells a parser almost nothing.`,
      fix: withoutBullets.length === 0 ? undefined : 'Add 3–5 achievement bullets, each starting with a verb.',
      target: withoutBullets[0] ? { sectionId: withoutBullets[0].section.id, entryId: withoutBullets[0].entry.id } : undefined,
      weight: 3,
    });
  }

  const tooLong = experienceBullets.filter((bullet) => bullet.text.length > 320);
  const tooShort = experienceBullets.filter((bullet) => bullet.text.trim().length > 0 && bullet.text.trim().length < 25);
  if (tooLong.length > 0) {
    add({
      id: 'content.bulletLength',
      category: 'content',
      title: 'Shorten long bullets',
      status: 'warn',
      detail: `${tooLong.length} bullet${tooLong.length === 1 ? '' : 's'} run past three printed lines (${listSamples(
        tooLong.map((bullet) => quote(bullet.text, 45)),
      )}), which is where recruiters stop reading.`,
      fix: 'Keep each bullet to one or two lines — lead with the result, then the how.',
      target: tooLong[0] ? { sectionId: tooLong[0].sectionId, entryId: tooLong[0].entryId } : undefined,
      weight: 1,
    });
  } else if (tooShort.length > 0 && tooLong.length === 0) {
    add({
      id: 'content.bulletLength',
      category: 'content',
      title: 'Flesh out very short bullets',
      status: 'info',
      detail: `${tooShort.length} bullet${tooShort.length === 1 ? ' is' : 's are'} under 25 characters and carry little information.`,
      fix: 'Name the action, the scale and the outcome.',
      target: tooShort[0] ? { sectionId: tooShort[0].sectionId, entryId: tooShort[0].entryId } : undefined,
      weight: 1,
    });
  } else {
    add({
      id: 'content.bulletLength',
      category: 'content',
      title: 'Bullet lengths are scannable',
      status: 'pass',
      detail: 'No bullet runs past three lines, so the page stays scannable in six seconds.',
      weight: 1,
    });
  }

  const weak = experienceBullets.filter((bullet) => {
    const lower = bullet.text.trim().toLowerCase();
    return WEAK_BULLET_OPENERS.some((opener) => lower.startsWith(opener));
  });
  const strong = experienceBullets.filter((bullet) => {
    const first = bullet.text.trim().toLowerCase().split(/\s+/)[0]?.replace(/[^a-z]/g, '') ?? '';
    return STRONG_BULLET_VERBS.includes(first);
  });
  if (weak.length > 0) {
    add({
      id: 'content.openers',
      category: 'content',
      title: 'Replace passive bullet openers',
      status: 'warn',
      detail: `${weak.length} bullet${weak.length === 1 ? '' : 's'} open with a phrase like ${quote(
        WEAK_BULLET_OPENERS.find((opener) => weak[0].text.trim().toLowerCase().startsWith(opener)) ?? 'responsible for',
        30,
      )}, which buries the outcome.`,
      fix: 'Start with the verb: "Cut checkout latency 38% by …" rather than "Responsible for checkout latency".',
      target: { sectionId: weak[0].sectionId, entryId: weak[0].entryId },
      weight: 2,
    });
  } else if (experienceBullets.length > 0 && strong.length / experienceBullets.length >= 0.6) {
    add({
      id: 'content.openers',
      category: 'content',
      title: 'Bullets open with strong verbs',
      status: 'pass',
      detail: `${Math.round((strong.length / experienceBullets.length) * 100)}% of bullets start with an action verb.`,
      weight: 2,
    });
  } else if (experienceBullets.length > 0) {
    add({
      id: 'content.openers',
      category: 'content',
      title: 'Start more bullets with a verb',
      status: 'info',
      detail: 'Opening with the action reads faster and scans better than opening with context.',
      fix: 'Try "Led", "Cut", "Built", "Migrated", "Automated".',
      weight: 1,
    });
  }

  const quantified = experienceBullets.filter((bullet) => QUANTIFIER_PATTERN.test(bullet.text));
  if (experienceBullets.length >= 3) {
    const ratio = quantified.length / experienceBullets.length;
    if (ratio >= 0.5) {
      add({
        id: 'content.quantified',
        category: 'content',
        title: 'Achievements are quantified',
        status: 'pass',
        detail: `${quantified.length} of ${experienceBullets.length} bullets carry a number, percentage or scale.`,
        weight: 3,
      });
    } else {
      add({
        id: 'content.quantified',
        category: 'content',
        title: 'Quantify more achievements',
        status: ratio >= 0.3 ? 'warn' : 'fail',
        detail: `Only ${quantified.length} of ${experienceBullets.length} bullets contain a measurable result. Numbers are what separate a claim from evidence.`,
        fix: 'Add scale or outcome: %, $, time saved, users, volume, headcount.',
        target: { sectionId: 'any', field: 'bullets' },
        weight: 3,
      });
    }
  }

  const pronounHits: string[] = [];
  for (const bullet of bullets) {
    const firstWord = bullet.text.trim().toLowerCase().split(/\s+/)[0]?.replace(/[^a-z']/g, '') ?? '';
    if (FIRST_PERSON_PRONOUNS.includes(firstWord)) pronounHits.push(bullet.text);
  }
  if (summary) {
    for (const word of tokenize(summary.text)) {
      if (FIRST_PERSON_PRONOUNS.includes(word)) {
        pronounHits.push(summary.text);
        break;
      }
    }
  }
  add({
    id: 'content.pronouns',
    category: 'content',
    title: pronounHits.length === 0 ? 'No first-person pronouns' : 'Drop first-person pronouns',
    status: pronounHits.length > 0 ? 'warn' : bullets.length > 0 || summary ? 'pass' : 'info',
    detail:
      pronounHits.length === 0
        ? 'Resume prose omits "I" and "my", which is the convention recruiters expect.'
        : `${pronounHits.length} passage${pronounHits.length === 1 ? '' : 's'} use first-person pronouns, e.g. ${quote(
            pronounHits[0],
            50,
          )}.`,
    fix: pronounHits.length === 0 ? undefined : 'Write in implied first person: "Led the migration" rather than "I led the migration".',
    weight: 1,
  });

  const placeholders = PLACEHOLDER_PATTERNS.filter((pattern) => pattern.test(plainText));
  add({
    id: 'content.placeholder',
    category: 'content',
    title: placeholders.length === 0 ? 'No placeholder text' : 'Remove placeholder text',
    status: placeholders.length === 0 ? 'pass' : 'fail',
    detail:
      placeholders.length === 0
        ? 'Nothing that reads as an unfilled template reached the document.'
        : 'The document still contains text that reads as an unfilled template.',
    fix: placeholders.length === 0 ? undefined : 'Search for "TBD", "lorem", "Company Name" and replace it.',
    weight: 3,
  });

  const seenBullets = new Map<string, number>();
  for (const bullet of bullets) {
    const key = bullet.text.trim().toLowerCase().replace(/\s+/g, ' ');
    seenBullets.set(key, (seenBullets.get(key) ?? 0) + 1);
  }
  const duplicates = [...seenBullets.entries()].filter(([, count]) => count > 1);
  add({
    id: 'content.duplicates',
    category: 'content',
    title: duplicates.length === 0 ? 'No repeated bullets' : 'Remove repeated bullets',
    status: duplicates.length > 0 ? 'warn' : bullets.length > 2 ? 'pass' : 'info',
    detail:
      duplicates.length === 0
        ? 'No bullet is printed twice.'
        : `${duplicates.length} bullet${duplicates.length === 1 ? ' appears' : 's appear'} more than once, e.g. ${quote(
            duplicates[0][0],
            45,
          )}.`,
    fix: duplicates.length === 0 ? undefined : 'Cut the duplicate or rewrite it with different evidence.',
    weight: 1,
  });

  const hygiene: string[] = [];
  for (const bullet of bullets) {
    if (/\s{2,}/.test(bullet.text)) hygiene.push(`double space in ${quote(bullet.text, 40)}`);
    if (/\s+[.,;]/.test(bullet.text)) hygiene.push(`space before punctuation in ${quote(bullet.text, 40)}`);
    if (/[a-z],[a-z]/.test(bullet.text)) hygiene.push(`missing space after comma in ${quote(bullet.text, 40)}`);
  }
  add({
    id: 'content.hygiene',
    category: 'content',
    title: hygiene.length === 0 ? 'Text formatting is clean' : 'Clean up spacing',
    status: hygiene.length > 0 ? 'info' : bullets.length > 2 ? 'pass' : 'info',
    detail:
      hygiene.length === 0
        ? 'No stray double spaces or missing spaces after punctuation.'
        : `${hygiene.length} small spacing issue${hygiene.length === 1 ? '' : 's'}, e.g. ${hygiene[0]}.`,
    fix: hygiene.length === 0 ? undefined : 'These usually come from pasting formatted text.',
    weight: 1,
  });

  const datedEntries = experience.filter(({ entry }) => entry.start.trim() || entry.end.trim());
  if (experience.length > 0 && datedEntries.length < experience.length) {
    const missing = experience.filter(({ entry }) => !entry.start.trim() && !entry.end.trim());
    add({
      id: 'content.dates',
      category: 'content',
      title: 'Date every role',
      status: 'warn',
      detail: `${missing.length} role${missing.length === 1 ? '' : 's'} — ${listSamples(
        missing.map(({ entry }) => quote(entry.title || 'Untitled role', 30)),
      )} — has no dates, so the parser cannot place it on a timeline.`,
      fix: 'Use MM/YYYY or Mon YYYY for both start and end.',
      target: missing[0] ? { sectionId: missing[0].section.id, entryId: missing[0].entry.id } : undefined,
    });
  } else if (experience.length > 0) {
    add({
      id: 'content.dates',
      category: 'content',
      title: 'Every role is dated',
      status: 'pass',
      weight: 2,
      detail: 'Parsers reconstruct the timeline from these dates, and gaps are explained automatically.',
    });
  }

  const inverted: string[] = [];
  const future: string[] = [];
  const formats = new Set<string>();
  for (const section of sections) {
    if (!isEntrySection(section)) continue;
    for (const entry of section.entries) {
      if (entry.start.trim() && entry.end.trim() && !entry.current && rangeIsInverted(entry.start, entry.end)) {
        inverted.push(entry.title || entry.subtitle || 'Untitled entry');
      }
      if (entry.start.trim()) {
        if (isFutureDate(entry.start)) future.push(entry.start.trim());
        const parsed = parseDateValue(entry.start);
        if (parsed) formats.add(parsed.month === undefined ? 'year' : 'month');
      }
    }
  }
  if (inverted.length > 0) {
    add({
      id: 'content.dateOrder',
      category: 'content',
      title: 'Fix reversed date ranges',
      status: 'warn',
      detail: `${listSamples(inverted.map((title) => quote(title, 30)))} ${
        inverted.length === 1 ? 'ends before it starts' : 'end before they start'
      }.`,
      fix: 'Swap the start and end dates, or tick "I currently work here".',
      weight: 2,
    });
  } else {
    add({
      id: 'content.dateOrder',
      category: 'content',
      title: 'Date ranges are in order',
      status: datedEntries.length > 0 ? 'pass' : 'info',
      detail: 'No role ends before it begins.',
      weight: 2,
    });
  }

  if (future.length > 0) {
    add({
      id: 'content.futureDates',
      category: 'content',
      title: 'Check future dates',
      status: 'warn',
      detail: `${listSamples(future.map((value) => quote(value, 20)))} ${
        future.length === 1 ? 'is' : 'are'
      } in the future.`,
      fix: 'Correct the year, or use the end date of the contract.',
      weight: 1,
    });
  }

  if (formats.size > 1) {
    add({
      id: 'content.dateConsistency',
      category: 'content',
      title: 'Keep date precision consistent',
      status: 'info',
      detail: 'Some dates include a month and others only a year, so the printed column looks uneven.',
      fix: 'Add months where you know them, or use the "YYYY" display format for the whole document.',
      weight: 1,
    });
  }

  const skillsSection = sections.find(isSkillsSection);
  const skillCount = skillsSection
    ? skillsSection.groups.reduce((total, group) => total + group.items.filter((item) => item.trim()).length, 0)
    : 0;
  if (skillsSection && skillCount > 0) {
    add({
      id: 'content.skillCount',
      category: 'content',
      title: skillCount >= 8 ? 'Skills list is substantial' : 'Add more skills',
      status: skillCount >= 8 ? 'pass' : 'warn',
      detail:
        skillCount >= 8
          ? `${skillCount} searchable keywords are listed across ${skillsSection.groups.length} group${
              skillsSection.groups.length === 1 ? '' : 's'
            }.`
          : `Only ${skillCount} skills are listed. Keyword screens look for a substantial, specific list.`,
      fix: skillCount >= 8 ? undefined : 'Aim for 10–20 concrete, named skills rather than soft skills.',
      target: { sectionId: skillsSection.id },
      weight: 2,
    });
  }

  const bulletChars = data.settings.bulletChar;
  add({
    id: 'content.bulletChar',
    category: 'content',
    title: 'Standard bullet character',
    status: ['\u2022', '\u2013', '-', '\u25AA', '\u00B7'].includes(bulletChars) ? 'pass' : 'warn',
    detail: `Bullets use ${quote(bulletChars, 4)}, a character every extractor maps back to a bullet.`,
    weight: 1,
  });

  const totalWords = tokenize(plainText).length;
  add({
    id: 'content.length',
    category: 'content',
    title:
      totalWords >= 350 && totalWords <= 1100
        ? 'Document length is in range'
        : totalWords < 350
          ? 'Add more detail'
          : 'Consider trimming',
    status: totalWords >= 350 && totalWords <= 1100 ? 'pass' : 'info',
    detail: `${totalWords} words. Two pages of dense, relevant content is the usual ceiling; under 350 words rarely fills a page.`,
    weight: 1,
  });
}

function checkFormatting(data: ResumeData, input: AnalysisInput, add: AddCheck): void {
  const { settings } = data;
  const template = TEMPLATE_MAP[settings.templateId];
  const bodySize = template.baseFontSize * settings.fontScale;
  add({
    id: 'format.fontSize',
    category: 'formatting',
    title: bodySize >= 10 ? 'Body text is at least 10 pt' : 'Increase the font size',
    status: bodySize >= 10 ? 'pass' : 'warn',
    detail: `Body text renders at ${bodySize.toFixed(1)} pt on the ${template.name} template. Below 10 pt text becomes hard to read and some extractors mis-segment glyphs.`,
    fix: bodySize >= 10 ? undefined : 'Raise the font scale, or trim content instead.',
    weight: 2,
  });

  add({
    id: 'format.fonts',
    category: 'formatting',
    title: 'Standard PDF fonts, no embedding risk',
    status: 'pass',
    detail:
      settings.fontFamily === 'Helvetica'
        ? 'Helvetica is one of the PDF standard 14 fonts, so every extractor already knows its encoding.'
        : `${settings.fontFamily} is one of the PDF standard 14 fonts: no subsetting, no broken Unicode mapping.`,
    weight: 2,
  });

  const marginOk = settings.margin >= 0.4 && settings.margin <= 1.0;
  add({
    id: 'format.margin',
    category: 'formatting',
    title: marginOk ? 'Margins are print-safe' : 'Adjust the margins',
    status: marginOk ? 'pass' : 'warn',
    detail: `Margins are ${settings.margin.toFixed(2)} in. Under 0.4 in most printers clip the edge; over 1 in wastes space a recruiter could be reading.`,
    fix: marginOk ? undefined : 'Set margins between 0.4 in and 1 in.',
    weight: 1,
  });

  const contrast = contrastRatio(settings.accentColor, '#FFFFFF');
  add({
    id: 'format.contrast',
    category: 'formatting',
    title:
      contrast === null || contrast >= 4.5
        ? 'Accent colour has enough contrast'
        : contrast >= 3
          ? 'Accent colour is low contrast'
          : 'Accent colour is too light',
    status: contrast === null ? 'warn' : contrast >= 4.5 ? 'pass' : contrast >= 3 ? 'warn' : 'fail',
    detail:
      contrast === null
        ? 'The accent colour could not be parsed.'
        : `The accent colour reaches ${contrast.toFixed(2)}:1 against white. Headings are printed in it, so they need at least 4.5:1 to survive greyscale printing and low-vision readers.`,
    fix: contrast === null || contrast >= 4.5 ? undefined : 'Pick a darker shade of the same hue.',
    weight: 2,
  });

  const headingOnlyColour = settings.accentColor.toUpperCase() === '#FFFFFF';
  if (headingOnlyColour) {
    add({
      id: 'format.colourOnly',
      category: 'formatting',
      title: 'Headings are distinguished by more than colour',
      status: 'warn',
      detail: 'Headings use weight and size as well as colour, so the hierarchy survives greyscale printing.',
      weight: 1,
    });
  }

  if (settings.showPageNumbers) {
    add({
      id: 'format.pageNumbers',
      category: 'formatting',
      title: 'Page numbers are on',
      status: 'info',
      detail:
        'A repeated footer is legitimate, but some extractors append it to the last bullet on the page. Turn it off for a single-page resume.',
      fix: 'Turn page numbers off if the resume fits on one page.',
      weight: 1,
    });
  } else {
    add({
      id: 'format.pageNumbers',
      category: 'formatting',
      title: 'No repeating header or footer',
      status: 'pass',
      detail: 'Nothing repeats on every page, so extracted text contains only resume content.',
      weight: 1,
    });
  }

  if (typeof input.pageCount === 'number' && input.pageCount > 0) {
    add({
      id: 'format.pages',
      category: 'formatting',
      title:
        input.pageCount <= 2
          ? `Fits ${input.pageCount} page${input.pageCount === 1 ? '' : 's'}`
          : `Runs to ${input.pageCount} pages`,
      status: input.pageCount <= 2 ? 'pass' : 'warn',
      detail:
        input.pageCount <= 2
          ? 'Two pages is the accepted ceiling for almost every posting.'
          : 'Beyond two pages recruiters skim and parsers truncate; trim to the last 10–15 years.',
      weight: input.pageCount <= 2 ? 1 : 2,
    });
  }
}

function checkKeywords(keywords: NonNullable<AnalysisResult['keywords']>, add: AddCheck): void {
  const coverage = keywords.coverage;
  add({
    id: 'keywords.coverage',
    category: 'keywords',
    title:
      coverage >= 0.7
        ? 'Strong overlap with the posting'
        : coverage >= 0.45
          ? 'Partial overlap with the posting'
          : 'Low overlap with the posting',
    status: coverage >= 0.7 ? 'pass' : coverage >= 0.45 ? 'warn' : 'fail',
    detail: `${Math.round(coverage * 100)}% of the weighted terms in the posting appear in the resume (${keywords.matched.length} of ${keywords.jdTermCount}).`,
    fix:
      coverage >= 0.7
        ? undefined
        : 'Add the terms you can honestly claim to your Skills section and to the bullets where you used them.',
    weight: 3,
  });

  if (keywords.titleTerms.length > 0) {
    const missing = keywords.missingTitleTerms;
    add({
      id: 'keywords.title',
      category: 'keywords',
      title:
        missing.length === 0
          ? 'Job title matches the posting'
          : `Job title is missing ${missing.length} key word${missing.length === 1 ? '' : 's'}`,
      status: missing.length === 0 ? 'pass' : 'warn',
      detail: keywords.detectedTitle
        ? `The posting is for "${keywords.detectedTitle}". ${
            missing.length === 0
              ? 'Your headline and history cover every significant word in it.'
              : `Your resume never mentions: ${listSamples(missing, 3)}.`
          }`
        : 'The posting title could not be detected.',
      fix:
        missing.length === 0
          ? undefined
          : `Mirror the posting's wording in your headline where it is accurate, e.g. include "${missing[0]}".`,
      target: { field: 'basics.headline' },
      weight: 2,
    });
  }
}
