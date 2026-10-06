/**
 * Core domain model for a resume document.
 *
 * Design notes
 * ------------
 * Everything in this file is plain, JSON-serialisable data. That keeps the model
 * trivially storable (localStorage), shareable (import/export), testable (pure
 * functions in `normalize.ts`), and renderable by more than one backend (the
 * on-screen PDF viewer and the ATS analyser both consume exactly this shape).
 *
 * Dates are stored as the user typed them (`"2021-03"` from a month input, or
 * free text like `"Summer 2019"`). They are only *formatted* at render time, so
 * nothing is silently lost when a value is not a real date.
 */

export const SCHEMA_VERSION = 1;

export type SectionKind =
  | 'summary'
  | 'experience'
  | 'education'
  | 'projects'
  | 'skills'
  | 'certifications'
  | 'awards'
  | 'publications'
  | 'volunteer'
  | 'languages'
  | 'custom';

export type TemplateId = 'classic' | 'modern' | 'compact' | 'elegant';

export type PageSize = 'LETTER' | 'A4';

/** Font families available without embedding (PDF "standard 14" faces). */
export type FontFamily = 'Helvetica' | 'Times-Roman' | 'Courier';

export type DateFormat = 'MMM YYYY' | 'MMMM YYYY' | 'MM/YYYY' | 'YYYY';

export type LinkDisplay = 'url' | 'label';

export interface Bullet {
  id: string;
  text: string;
}

/**
 * A single repeatable entry (a job, a degree, a project, an award, ...).
 *
 * The same shape backs every "entry" section kind; the field *labels* differ and
 * live in the section registry (`sections.ts`). Never store a label here.
 */
export interface Entry {
  id: string;
  /** Primary line: job title, degree, project name, award, publication title. */
  title: string;
  /** Secondary line: company, school, issuer, publisher, client. */
  subtitle: string;
  location: string;
  /** Raw start date, e.g. `"2021-03"`, `"2021"`, or `"Mar 2021"`. */
  start: string;
  /** Raw end date. Ignored when `current` is true. */
  end: string;
  /** "Present" / "Current" — renders as the end date and sorts first. */
  current: boolean;
  /** Absolute URL, rendered as a clickable PDF link annotation. */
  url: string;
  /** Optional one-paragraph lead-in shown above the bullets. */
  description: string;
  bullets: Bullet[];
  /** Comma-free list rendered as a "Technologies: a, b, c" style line. */
  tags: string[];
  /** Free-form extra line (GPA, honours, credential id, ...). */
  extra: string;
}

/** A labelled group of keywords, e.g. "Languages: TypeScript, Go". */
export interface SkillGroup {
  id: string;
  label: string;
  /** Ordering is meaningful and preserved. Empty strings are dropped on render. */
  items: string[];
}

export interface LanguageItem {
  id: string;
  name: string;
  /** e.g. "Native", "C1 — Advanced", "Professional working proficiency". */
  level: string;
}

export interface EntrySection {
  id: string;
  kind: Exclude<SectionKind, 'summary' | 'skills' | 'languages'>;
  /** User-editable heading text. Defaults come from the section registry. */
  heading: string;
  visible: boolean;
  entries: Entry[];
}

export interface SummarySection {
  id: string;
  kind: 'summary';
  heading: string;
  visible: boolean;
  text: string;
}

export interface SkillsSection {
  id: string;
  kind: 'skills';
  heading: string;
  visible: boolean;
  groups: SkillGroup[];
}

export interface LanguagesSection {
  id: string;
  kind: 'languages';
  heading: string;
  visible: boolean;
  items: LanguageItem[];
}

export type Section = EntrySection | SummarySection | SkillsSection | LanguagesSection;

export interface ContactLink {
  id: string;
  /** e.g. "LinkedIn", "GitHub", "Portfolio". */
  label: string;
  url: string;
}

export interface Basics {
  fullName: string;
  headline: string;
  email: string;
  phone: string;
  /** City, ST — deliberately a single free-text field; no address parsing needed. */
  location: string;
  links: ContactLink[];
}

export interface ResumeSettings {
  templateId: TemplateId;
  /** Hex colour used for the name, headings and rules. */
  accentColor: string;
  fontFamily: FontFamily;
  /** Multiplier applied to every font size in the template. 0.9–1.15. */
  fontScale: number;
  /** Multiplier applied to every line height. 1.0–1.6. */
  lineHeight: number;
  pageSize: PageSize;
  /** Page margin in inches. 0.4–1.0. */
  margin: number;
  /** Vertical gap between sections, in points. */
  sectionSpacing: number;
  uppercaseHeadings: boolean;
  /** Thin accent rule under each section heading. */
  headingRule: boolean;
  /** Whether the contact line prints labels ("LinkedIn") or raw URLs. */
  linkDisplay: LinkDisplay;
  dateFormat: DateFormat;
  /** En-dash between start and end dates is the safest parser-friendly choice. */
  bulletChar: string;
  showPageNumbers: boolean;
}

export interface ResumeMeta {
  /** PDF /Title */
  title: string;
  /** PDF /Author */
  author: string;
  /** PDF /Subject */
  subject: string;
  /** PDF /Keywords — comma separated. */
  keywords: string;
  /** BCP-47 language tag, written as /Lang for screen readers. */
  language: string;
}

export interface ResumeData {
  schemaVersion: number;
  meta: ResumeMeta;
  basics: Basics;
  sections: Section[];
  settings: ResumeSettings;
}

/** Kinds whose sections hold `entries`. Used for narrowing without casts. */
export const ENTRY_SECTION_KINDS = [
  'experience',
  'education',
  'projects',
  'certifications',
  'awards',
  'publications',
  'volunteer',
  'custom',
] as const satisfies readonly SectionKind[];

export type EntrySectionKind = (typeof ENTRY_SECTION_KINDS)[number];

export function isEntrySection(section: Section): section is EntrySection {
  return (ENTRY_SECTION_KINDS as readonly string[]).includes(section.kind);
}

export function isSummarySection(section: Section): section is SummarySection {
  return section.kind === 'summary';
}

export function isSkillsSection(section: Section): section is SkillsSection {
  return section.kind === 'skills';
}

export function isLanguagesSection(section: Section): section is LanguagesSection {
  return section.kind === 'languages';
}
