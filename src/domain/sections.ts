/**
 * Section registry.
 *
 * One place that describes every section kind: its default heading, the wording
 * of its entry fields, and how it renders. Because every section kind shares the
 * same data shape, the editor and the PDF templates can be written once and
 * driven from this table instead of branching per kind.
 */

import type { Entry, EntrySectionKind, Section, SectionKind } from './types';

export interface EntryFieldLabels {
  /** Label for the primary line, e.g. "Job title". */
  title: string;
  /** Placeholder for the primary line, e.g. "Senior Backend Engineer". */
  titlePlaceholder: string;
  /** Label for the secondary line, e.g. "Company". */
  subtitle: string;
  subtitlePlaceholder: string;
  /** When true the section shows the location field. */
  showLocation: boolean;
  /** When true the section shows the URL field. */
  showUrl: boolean;
  urlLabel: string;
  urlPlaceholder: string;
  /** Label for the free-text paragraph field. */
  description: string;
  descriptionPlaceholder: string;
  /** Label for the bullet list. */
  bullets: string;
  bulletPlaceholder: string;
  /** Label for the comma-separated tag list. `null` hides the field. */
  tags: string | null;
  tagsPlaceholder: string;
  /** Label for the free-form extra line. `null` hides the field. */
  extra: string | null;
  extraPlaceholder: string;
  /** Whether start/end dates are shown for this kind. */
  showDates: boolean;
  /** Whether "I currently work here" is offered. */
  showCurrent: boolean;
}

export interface SectionDescriptor {
  kind: SectionKind;
  /** Default heading text. Also used for the "add section" menu. */
  defaultHeading: string;
  /** Short blurb shown in the add-section menu. */
  blurb: string;
  /** Whether the user may add more than one section of this kind. */
  allowMultiple: boolean;
  /** True when the section is a free-text paragraph rather than a list. */
  textLike?: boolean;
  /** True when the section holds label/keyword groups. */
  skillLike?: boolean;
  /** True when the section holds language name/level pairs. */
  languageLike?: boolean;
  /** Field labels — only meaningful for entry sections. */
  fields?: EntryFieldLabels;
}

const dateFields = { showDates: true, showCurrent: true } as const;

export const SECTION_REGISTRY: Record<SectionKind, SectionDescriptor> = {
  summary: {
    kind: 'summary',
    defaultHeading: 'Professional Summary',
    blurb: 'A 2–4 line pitch at the top of the resume.',
    allowMultiple: false,
    textLike: true,
  },
  experience: {
    kind: 'experience',
    defaultHeading: 'Professional Experience',
    blurb: 'Paid or unpaid work where you held a role.',
    allowMultiple: false,
    fields: {
      title: 'Job title',
      titlePlaceholder: 'Senior Backend Engineer',
      subtitle: 'Company',
      subtitlePlaceholder: 'Northwind Analytics',
      showLocation: true,
      showUrl: true,
      urlLabel: 'Company website (optional)',
      urlPlaceholder: 'https://example.com',
      description: 'Role overview (optional)',
      descriptionPlaceholder: 'One line of context, e.g. "Series B fintech, 40M requests/day".',
      bullets: 'Achievements',
      bulletPlaceholder: 'Cut p95 latency 42% by replacing N+1 queries with batched loaders',
      tags: 'Tools used (optional)',
      tagsPlaceholder: 'TypeScript, PostgreSQL, AWS',
      extra: null,
      extraPlaceholder: '',
      ...dateFields,
    },
  },
  education: {
    kind: 'education',
    defaultHeading: 'Education',
    blurb: 'Degrees, diplomas and formal programmes.',
    allowMultiple: false,
    fields: {
      title: 'Degree',
      titlePlaceholder: 'BSc Computer Science',
      subtitle: 'School',
      subtitlePlaceholder: 'University of Washington',
      showLocation: true,
      showUrl: false,
      urlLabel: 'School website (optional)',
      urlPlaceholder: 'https://example.edu',
      description: 'Notes (optional)',
      descriptionPlaceholder: 'Relevant coursework, thesis, or focus area.',
      bullets: 'Highlights',
      bulletPlaceholder: 'Graduated with honours; Dean’s List 2019–2021',
      tags: null,
      tagsPlaceholder: '',
      extra: 'Grade / GPA (optional)',
      extraPlaceholder: '3.9 / 4.0',
      ...dateFields,
      showCurrent: false,
    },
  },
  projects: {
    kind: 'projects',
    defaultHeading: 'Projects',
    blurb: 'Side projects, open source and portfolio work.',
    allowMultiple: false,
    fields: {
      title: 'Project name',
      titlePlaceholder: 'Resume Forge',
      subtitle: 'Context (optional)',
      subtitlePlaceholder: 'Open source · 1.2k GitHub stars',
      showLocation: false,
      showUrl: true,
      urlLabel: 'Link',
      urlPlaceholder: 'https://github.com/you/project',
      description: 'Summary (optional)',
      descriptionPlaceholder: 'What it does and who it is for.',
      bullets: 'Details',
      bulletPlaceholder: 'Built a streaming PDF renderer that stays under 200 ms per page',
      tags: 'Technologies (optional)',
      tagsPlaceholder: 'React, Rust, WebAssembly',
      extra: null,
      extraPlaceholder: '',
      ...dateFields,
      showCurrent: false,
    },
  },
  skills: {
    kind: 'skills',
    defaultHeading: 'Skills',
    blurb: 'Keyword groups — the section parsers weight most heavily.',
    allowMultiple: true,
    skillLike: true,
  },
  certifications: {
    kind: 'certifications',
    defaultHeading: 'Certifications',
    blurb: 'Licences and professional certifications.',
    allowMultiple: true,
    fields: {
      title: 'Certification',
      titlePlaceholder: 'AWS Certified Solutions Architect',
      subtitle: 'Issuer',
      subtitlePlaceholder: 'Amazon Web Services',
      showLocation: false,
      showUrl: true,
      urlLabel: 'Credential URL (optional)',
      urlPlaceholder: 'https://credly.com/badges/…',
      description: 'Notes (optional)',
      descriptionPlaceholder: '',
      bullets: 'Details',
      bulletPlaceholder: '',
      tags: null,
      tagsPlaceholder: '',
      extra: 'Credential ID (optional)',
      extraPlaceholder: 'ABC-123456',
      ...dateFields,
      showCurrent: false,
    },
  },
  awards: {
    kind: 'awards',
    defaultHeading: 'Awards',
    blurb: 'Recognitions, prizes and honours.',
    allowMultiple: true,
    fields: {
      title: 'Award',
      titlePlaceholder: 'Engineer of the Year',
      subtitle: 'Awarded by',
      subtitlePlaceholder: 'Northwind Analytics',
      showLocation: false,
      showUrl: false,
      urlLabel: 'Link (optional)',
      urlPlaceholder: '',
      description: 'Notes (optional)',
      descriptionPlaceholder: 'Why you received it, in one line.',
      bullets: 'Details',
      bulletPlaceholder: '',
      tags: null,
      tagsPlaceholder: '',
      extra: null,
      extraPlaceholder: '',
      ...dateFields,
      showCurrent: false,
    },
  },
  publications: {
    kind: 'publications',
    defaultHeading: 'Publications',
    blurb: 'Papers, articles and talks.',
    allowMultiple: true,
    fields: {
      title: 'Title',
      titlePlaceholder: 'Scaling incremental parsing in the browser',
      subtitle: 'Publisher / venue',
      subtitlePlaceholder: 'ACM Queue',
      showLocation: false,
      showUrl: true,
      urlLabel: 'DOI or URL',
      urlPlaceholder: 'https://doi.org/10.1145/…',
      description: 'Abstract (optional)',
      descriptionPlaceholder: '',
      bullets: 'Details',
      bulletPlaceholder: '',
      tags: null,
      tagsPlaceholder: '',
      extra: 'Co-authors (optional)',
      extraPlaceholder: 'with A. Rivera, M. Chen',
      ...dateFields,
      showCurrent: false,
    },
  },
  volunteer: {
    kind: 'volunteer',
    defaultHeading: 'Volunteer Experience',
    blurb: 'Community, nonprofit and pro-bono work.',
    allowMultiple: true,
    fields: {
      title: 'Role',
      titlePlaceholder: 'Weekend Mentor',
      subtitle: 'Organisation',
      subtitlePlaceholder: 'Code the Dream',
      showLocation: true,
      showUrl: true,
      urlLabel: 'Organisation website (optional)',
      urlPlaceholder: '',
      description: 'Overview (optional)',
      descriptionPlaceholder: '',
      bullets: 'Achievements',
      bulletPlaceholder: 'Mentored 14 students through their first production deploy',
      tags: null,
      tagsPlaceholder: '',
      extra: null,
      extraPlaceholder: '',
      ...dateFields,
    },
  },
  languages: {
    kind: 'languages',
    defaultHeading: 'Languages',
    blurb: 'Spoken languages and proficiency levels.',
    allowMultiple: true,
    languageLike: true,
  },
  custom: {
    kind: 'custom',
    defaultHeading: 'Additional Experience',
    blurb: 'Anything else — the fields are all free text.',
    allowMultiple: true,
    fields: {
      title: 'Title',
      titlePlaceholder: '',
      subtitle: 'Subtitle (optional)',
      subtitlePlaceholder: '',
      showLocation: true,
      showUrl: true,
      urlLabel: 'Link (optional)',
      urlPlaceholder: '',
      description: 'Description (optional)',
      descriptionPlaceholder: '',
      bullets: 'Details',
      bulletPlaceholder: '',
      tags: 'Tags (optional)',
      tagsPlaceholder: '',
      extra: 'Extra line (optional)',
      extraPlaceholder: '',
      ...dateFields,
    },
  },
};

/** Field labels for an entry section, falling back to the generic `custom` set. */
export function entryFieldLabels(kind: EntrySectionKind): EntryFieldLabels {
  return SECTION_REGISTRY[kind].fields ?? SECTION_REGISTRY.custom.fields!;
}

/** Order used by the "add section" menu. */
export const ADDABLE_SECTION_KINDS: SectionKind[] = [
  'summary',
  'experience',
  'education',
  'skills',
  'projects',
  'certifications',
  'awards',
  'publications',
  'volunteer',
  'languages',
  'custom',
];

/** True when adding another section of this kind should be blocked. */
export function isSectionKindExhausted(kind: SectionKind, sections: Section[]): boolean {
  if (SECTION_REGISTRY[kind].allowMultiple) return false;
  return sections.some((section) => section.kind === kind);
}

export function emptyEntry(kind: EntrySectionKind, makeId: () => string): Entry {
  const labels = entryFieldLabels(kind);
  void labels;
  return {
    id: makeId(),
    title: '',
    subtitle: '',
    location: '',
    start: '',
    end: '',
    current: false,
    url: '',
    description: '',
    bullets: [],
    tags: [],
    extra: '',
  };
}
