/**
 * Normalisation and migration of arbitrary resume JSON.
 *
 * This is the trust boundary of the app: `localStorage` may hold data written by
 * an older build, and imported `.json` files may be anything at all. Everything
 * that comes in is coerced into a valid `ResumeData`, and anything that had to be
 * changed is reported back as a human-readable warning so the UI can tell the
 * truth about what happened.
 */

import { DEFAULT_SETTINGS, newSection } from './defaults';
import { ensureId, makeId } from './ids';
import { SECTION_REGISTRY } from './sections';
import type {
  Basics,
  Bullet,
  ContactLink,
  DateFormat,
  Entry,
  EntrySection,
  FontFamily,
  LanguageItem,
  LinkDisplay,
  PageSize,
  ResumeData,
  ResumeMeta,
  ResumeSettings,
  Section,
  SectionKind,
  SkillGroup,
  TemplateId,
} from './types';
import { SCHEMA_VERSION } from './types';

export interface NormalizeResult {
  data: ResumeData;
  warnings: string[];
}

const MAX_TEXT = 20_000;
const MAX_SHORT = 500;
const MAX_BULLETS = 60;
const MAX_ENTRIES = 200;
const MAX_SECTIONS = 60;
const MAX_LINKS = 12;

const TEMPLATE_IDS: TemplateId[] = ['classic', 'modern', 'compact', 'elegant'];
const FONT_FAMILIES: FontFamily[] = ['Helvetica', 'Times-Roman', 'Courier'];
const PAGE_SIZES: PageSize[] = ['LETTER', 'A4'];
const DATE_FORMATS: DateFormat[] = ['MMM YYYY', 'MMMM YYYY', 'MM/YYYY', 'YYYY'];
const LINK_DISPLAYS: LinkDisplay[] = ['url', 'label'];
const SECTION_KINDS = Object.keys(SECTION_REGISTRY) as SectionKind[];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Coerces to string, collapsing whitespace runs and clamping length. */
function str(value: unknown, max = MAX_SHORT): string {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value !== 'string') return '';
  // Normalise CRLF and non-breaking spaces, but keep intentional newlines out of
  // short fields by collapsing them to single spaces.
  const cleaned = value.replace(/\r\n?/g, '\n').replace(/\u00A0/g, ' ').replace(/[\t ]+/g, ' ');
  return cleaned.length > max ? cleaned.slice(0, max) : cleaned;
}

function multiline(value: unknown, max = MAX_TEXT): string {
  if (typeof value !== 'string') return '';
  return value.replace(/\r\n?/g, '\n').replace(/\u00A0/g, ' ').slice(0, max);
}

function bool(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return fallback;
}

function num(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

function strArray(value: unknown, maxItems: number): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    if (typeof item === 'string' && item.trim()) out.push(str(item, 200));
    else if (typeof item === 'number' && Number.isFinite(item)) out.push(String(item));
    if (out.length >= maxItems) break;
  }
  return out;
}

function normalizeBullet(value: unknown): Bullet | null {
  if (typeof value === 'string') {
    const text = str(value, 1000);
    return text.trim() ? { id: makeId('bul'), text } : null;
  }
  if (!isRecord(value)) return null;
  const text = str(value.text, 1000);
  if (!text.trim()) return null;
  return { id: ensureId(value.id, 'bul'), text };
}

function normalizeEntry(value: unknown): Entry {
  const raw = isRecord(value) ? value : {};
  const bullets: Bullet[] = [];
  if (Array.isArray(raw.bullets)) {
    for (const item of raw.bullets) {
      const parsed = normalizeBullet(item);
      if (parsed) bullets.push(parsed);
      if (bullets.length >= MAX_BULLETS) break;
    }
  }
  // A single free-text block is a common import shape; keep it as one bullet.
  if (bullets.length === 0 && typeof raw.description === 'string' && Array.isArray(raw.highlights)) {
    for (const item of raw.highlights) {
      const parsed = normalizeBullet(item);
      if (parsed) bullets.push(parsed);
      if (bullets.length >= MAX_BULLETS) break;
    }
  }
  return {
    id: ensureId(raw.id, 'ent'),
    title: str(raw.title ?? raw.position ?? raw.role ?? raw.name ?? raw.degree ?? raw.studyType),
    subtitle: str(raw.subtitle ?? raw.company ?? raw.organization ?? raw.organisation ?? raw.school ?? raw.institution ?? raw.issuer ?? raw.publisher),
    location: str(raw.location ?? raw.city ?? raw.address),
    start: str(raw.start ?? raw.startDate ?? raw.from, 60),
    end: str(raw.end ?? raw.endDate ?? raw.to, 60),
    current: bool(raw.current ?? raw.isCurrent, false),
    url: str(raw.url ?? raw.link ?? raw.website, 1000),
    description: multiline(raw.description ?? raw.summary),
    bullets,
    tags: strArray(raw.tags ?? raw.keywords ?? raw.technologies ?? raw.tech, 60),
    extra: str(raw.extra ?? raw.gpa ?? raw.score ?? raw.credentialId ?? raw.note),
  };
}

function normalizeSection(value: unknown): Section | null {
  if (!isRecord(value)) return null;
  const kind = oneOf<SectionKind>(value.kind, SECTION_KINDS, 'custom');
  const heading = str(value.heading, 120) || SECTION_REGISTRY[kind].defaultHeading;
  const visible = bool(value.visible, true);
  const id = ensureId(value.id, 'sec');

  if (kind === 'summary') {
    return {
      id,
      kind: 'summary',
      heading,
      visible,
      text: multiline(value.text ?? value.summary ?? value.content),
    };
  }

  if (kind === 'skills') {
    const groups: SkillGroup[] = [];
    if (Array.isArray(value.groups)) {
      for (const item of value.groups) {
        if (!isRecord(item)) continue;
        groups.push({
          id: ensureId(item.id, 'grp'),
          label: str(item.label ?? item.name, 120),
          items: strArray(item.items ?? item.keywords ?? item.skills, 80),
        });
        if (groups.length >= 20) break;
      }
    } else if (Array.isArray(value.items)) {
      // Flat list import (JSON Resume "skills" shape).
      const flat = value.items;
      if (flat.every((item) => typeof item === 'string')) {
        groups.push({ id: makeId('grp'), label: '', items: strArray(flat, 80) });
      } else {
        for (const item of flat) {
          if (!isRecord(item)) continue;
          groups.push({
            id: ensureId(item.id, 'grp'),
            label: str(item.name ?? item.label, 120),
            items: strArray(item.keywords ?? item.items, 80),
          });
          if (groups.length >= 20) break;
        }
      }
    }
    if (groups.length === 0) groups.push({ id: makeId('grp'), label: '', items: [] });
    return { id, kind: 'skills', heading, visible, groups };
  }

  if (kind === 'languages') {
    const items: LanguageItem[] = [];
    const source = Array.isArray(value.items) ? value.items : [];
    for (const item of source) {
      if (typeof item === 'string') {
        items.push({ id: makeId('lng'), name: str(item, 120), level: '' });
      } else if (isRecord(item)) {
        items.push({
          id: ensureId(item.id, 'lng'),
          name: str(item.name ?? item.language, 120),
          level: str(item.level ?? item.fluency ?? item.proficiency, 120),
        });
      }
      if (items.length >= 40) break;
    }
    if (items.length === 0) items.push({ id: makeId('lng'), name: '', level: '' });
    return { id, kind: 'languages', heading, visible, items };
  }

  const entries: Entry[] = [];
  const source = Array.isArray(value.entries) ? value.entries : Array.isArray(value.items) ? value.items : [];
  for (const item of source) {
    entries.push(normalizeEntry(item));
    if (entries.length >= MAX_ENTRIES) break;
  }
  const section: EntrySection = { id, kind: kind as EntrySection['kind'], heading, visible, entries };
  return section;
}

function normalizeBasics(value: unknown, warnings: string[]): Basics {
  const raw = isRecord(value) ? value : {};
  const links: ContactLink[] = [];
  const source = Array.isArray(raw.links) ? raw.links : Array.isArray(raw.profiles) ? raw.profiles : [];
  for (const item of source) {
    if (!isRecord(item)) continue;
    const url = str(item.url ?? item.link ?? item.href, 1000);
    const label = str(item.label ?? item.network ?? item.name, 80);
    if (!url && !label) continue;
    links.push({ id: ensureId(item.id, 'lnk'), label, url });
    if (links.length >= MAX_LINKS) break;
  }
  if (source.length > MAX_LINKS) warnings.push(`Only the first ${MAX_LINKS} contact links were kept.`);

  const email = str(raw.email, 200);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    warnings.push(`The email address "${email}" does not look valid and may not be parsed correctly.`);
  }

  return {
    fullName: str(raw.fullName ?? raw.name, 200),
    headline: str(raw.headline ?? raw.label ?? raw.title, 200),
    email,
    phone: str(raw.phone ?? raw.telephone, 80),
    location: str(raw.location ?? [raw.city, raw.region].filter(Boolean).join(', '), 200),
    links,
  };
}

function normalizeMeta(value: unknown, basics: Basics): ResumeMeta {
  const raw = isRecord(value) ? value : {};
  const fallbackTitle = basics.fullName ? `${basics.fullName} \u2014 Resume` : 'Resume';
  return {
    title: str(raw.title, 200) || fallbackTitle,
    author: str(raw.author, 200) || basics.fullName,
    subject: str(raw.subject, 300) || (basics.headline ? `Resume of ${basics.fullName}, ${basics.headline}` : 'Resume'),
    keywords: str(raw.keywords, 500),
    language: str(raw.language, 35) || 'en-US',
  };
}

function normalizeSettings(value: unknown): ResumeSettings {
  const raw = isRecord(value) ? value : {};
  return {
    templateId: oneOf(raw.templateId, TEMPLATE_IDS, DEFAULT_SETTINGS.templateId),
    accentColor: /^#[0-9a-fA-F]{6}$/.test(String(raw.accentColor ?? ''))
      ? String(raw.accentColor).toUpperCase()
      : DEFAULT_SETTINGS.accentColor,
    fontFamily: oneOf(raw.fontFamily, FONT_FAMILIES, DEFAULT_SETTINGS.fontFamily),
    fontScale: num(raw.fontScale, DEFAULT_SETTINGS.fontScale, 0.85, 1.25),
    lineHeight: num(raw.lineHeight, DEFAULT_SETTINGS.lineHeight, 1.05, 1.7),
    pageSize: oneOf(raw.pageSize, PAGE_SIZES, DEFAULT_SETTINGS.pageSize),
    margin: num(raw.margin, DEFAULT_SETTINGS.margin, 0.35, 1.1),
    sectionSpacing: num(raw.sectionSpacing, DEFAULT_SETTINGS.sectionSpacing, 4, 28),
    uppercaseHeadings: bool(raw.uppercaseHeadings, DEFAULT_SETTINGS.uppercaseHeadings),
    headingRule: bool(raw.headingRule, DEFAULT_SETTINGS.headingRule),
    linkDisplay: oneOf(raw.linkDisplay, LINK_DISPLAYS, DEFAULT_SETTINGS.linkDisplay),
    dateFormat: oneOf(raw.dateFormat, DATE_FORMATS, DEFAULT_SETTINGS.dateFormat),
    bulletChar: ['\u2022', '\u2013', '-', '\u25AA', '\u00B7'].includes(String(raw.bulletChar))
      ? String(raw.bulletChar)
      : DEFAULT_SETTINGS.bulletChar,
    showPageNumbers: bool(raw.showPageNumbers, DEFAULT_SETTINGS.showPageNumbers),
  };
}

/**
 * Coerces any JSON value into a valid resume. Never throws.
 */
export function normalizeResume(input: unknown): NormalizeResult {
  const warnings: string[] = [];
  if (!isRecord(input)) {
    warnings.push('The file did not contain a resume object; a blank resume was loaded instead.');
    return {
      data: { ...emptyResumeShape(), basics: normalizeBasics(null, warnings) },
      warnings,
    };
  }

  if (typeof input.schemaVersion === 'number' && input.schemaVersion > SCHEMA_VERSION) {
    warnings.push(
      `The file was saved by a newer version of Resume Forge (schema ${input.schemaVersion}). Unknown fields were ignored.`,
    );
  }

  const basics = normalizeBasics(input.basics, warnings);
  const meta = normalizeMeta(input.meta, basics);
  const settings = normalizeSettings(input.settings);

  const sections: Section[] = [];
  if (Array.isArray(input.sections)) {
    for (const item of input.sections) {
      const parsed = normalizeSection(item);
      if (parsed) sections.push(parsed);
      if (sections.length >= MAX_SECTIONS) break;
    }
    if (input.sections.length > MAX_SECTIONS) {
      warnings.push(`Only the first ${MAX_SECTIONS} sections were kept.`);
    }
  } else {
    warnings.push('No sections were found in the file; the default sections were added.');
    sections.push(newSection('summary'), newSection('experience'), newSection('education'), newSection('skills'));
  }

  const seenKinds = new Set<SectionKind>();
  for (const section of sections) {
    if (!SECTION_REGISTRY[section.kind].allowMultiple && seenKinds.has(section.kind)) {
      warnings.push(`More than one "${section.heading}" section was found; parsers expect just one.`);
    }
    seenKinds.add(section.kind);
  }

  return { data: { schemaVersion: SCHEMA_VERSION, meta, basics, sections, settings }, warnings };
}

function emptyResumeShape(): ResumeData {
  return {
    schemaVersion: SCHEMA_VERSION,
    meta: { title: 'Resume', author: '', subject: 'Resume', keywords: '', language: 'en-US' },
    basics: {
      fullName: '',
      headline: '',
      email: '',
      phone: '',
      location: '',
      links: [],
    },
    sections: [newSection('summary'), newSection('experience'), newSection('education'), newSection('skills')],
    settings: { ...DEFAULT_SETTINGS },
  };
}
