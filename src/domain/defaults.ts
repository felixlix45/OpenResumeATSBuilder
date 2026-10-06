/**
 * Document factories: a blank resume and a fully worked sample.
 *
 * The sample doubles as the fixture used by the automated verification harness,
 * so it deliberately contains the things that break naive PDF pipelines:
 * ligature-prone words ("Verification", "Workflow", "Efficiency", "Staffing"),
 * typographic apostrophes, an en dash, long URLs, and two pages of content.
 */

import { makeId } from './ids';
import { SECTION_REGISTRY } from './sections';
import type { Basics, Bullet, Entry, ResumeData, ResumeSettings, Section, SectionKind } from './types';
import { SCHEMA_VERSION } from './types';

export const DEFAULT_SETTINGS: ResumeSettings = {
  templateId: 'classic',
  accentColor: '#0F4C81',
  fontFamily: 'Helvetica',
  fontScale: 1,
  lineHeight: 1.28,
  pageSize: 'LETTER',
  margin: 0.6,
  sectionSpacing: 12,
  uppercaseHeadings: true,
  headingRule: true,
  linkDisplay: 'url',
  dateFormat: 'MMM YYYY',
  bulletChar: '\u2022',
  showPageNumbers: false,
};

export const DEFAULT_BASICS: Basics = {
  fullName: '',
  headline: '',
  email: '',
  phone: '',
  location: '',
  links: [],
};

export function bullet(text: string): Bullet {
  return { id: makeId('bul'), text };
}

export function entry(partial: Partial<Entry>): Entry {
  return {
    id: makeId('ent'),
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
    ...partial,
  };
}

export function newSection(kind: SectionKind): Section {
  const descriptor = SECTION_REGISTRY[kind];
  switch (kind) {
    case 'summary':
      return { id: makeId('sec'), kind, heading: descriptor.defaultHeading, visible: true, text: '' };
    case 'skills':
      return {
        id: makeId('sec'),
        kind,
        heading: descriptor.defaultHeading,
        visible: true,
        groups: [{ id: makeId('grp'), label: '', items: [] }],
      };
    case 'languages':
      return {
        id: makeId('sec'),
        kind,
        heading: descriptor.defaultHeading,
        visible: true,
        items: [{ id: makeId('lng'), name: '', level: '' }],
      };
    default:
      return {
        id: makeId('sec'),
        kind,
        heading: descriptor.defaultHeading,
        visible: true,
        entries: [],
      };
  }
}

export function createEmptyResume(): ResumeData {
  return {
    schemaVersion: SCHEMA_VERSION,
    meta: {
      title: 'Resume',
      author: '',
      subject: 'Resume',
      keywords: '',
      language: 'en-US',
    },
    basics: { ...DEFAULT_BASICS },
    sections: [newSection('summary'), newSection('experience'), newSection('education'), newSection('skills')],
    settings: { ...DEFAULT_SETTINGS },
  };
}

export function createSampleResume(): ResumeData {
  const sections: Section[] = [
    {
      id: makeId('sec'),
      kind: 'summary',
      heading: 'Professional Summary',
      visible: true,
      text: 'Senior backend engineer with 8 years building high-throughput payments and data platforms. Cut cloud spend 38% while scaling a billing API from 4M to 40M daily requests. Deep experience in Go, TypeScript, PostgreSQL performance work, and mentoring engineers through production ownership.',
    },
    {
      id: makeId('sec'),
      kind: 'experience',
      heading: 'Professional Experience',
      visible: true,
      entries: [
        entry({
          title: 'Senior Backend Engineer',
          subtitle: 'Northwind Analytics',
          location: 'Seattle, WA',
          start: '2021-03',
          current: true,
          url: 'https://example.com',
          bullets: [
            bullet(
              'Scaled the billing API from 4M to 40M daily requests with no increase in p95 latency by adding a request-coalescing cache layer in Go.',
            ),
            bullet(
              'Cut cloud spend 38% ($41K per month) by right-sizing Kubernetes requests and moving cold reporting workloads to object storage.',
            ),
            bullet(
              'Led migration of 120+ PostgreSQL tables to zero-downtime versioned migrations, removing a recurring weekend deployment window.',
            ),
            bullet(
              'Mentored 5 engineers and introduced a design review checklist that reduced production incidents 27% year over year.',
            ),
          ],
          tags: ['Go', 'PostgreSQL', 'Kubernetes', 'Terraform', 'AWS'],
        }),
        entry({
          title: 'Backend Engineer',
          subtitle: 'Cascade Financial',
          location: 'Portland, OR',
          start: '2018-06',
          end: '2021-02',
          bullets: [
            bullet(
              'Built an idempotent ledger service moving $180M per year with 99.99% reconciliation accuracy across 1.4M monthly transfers.',
            ),
            bullet(
              'Reduced batch settlement runtime from 6 hours to 22 minutes by rewriting the scheduler with worker pools and streaming I/O.',
            ),
            bullet(
              'Automated audit exports with the compliance team, turning a 3-day manual workflow into a 15-minute scheduled job.',
            ),
          ],
          tags: ['Go', 'Kafka', 'PostgreSQL', 'gRPC'],
        }),
        entry({
          title: 'Software Engineer',
          subtitle: 'Brightpath Labs',
          location: 'Austin, TX',
          start: '2016-07',
          end: '2018-05',
          bullets: [
            bullet(
              'Shipped the first public API and client SDKs, growing third-party integrations from 0 to 60 within 12 months.',
            ),
            bullet(
              'Improved deployment efficiency by automating regression testing, cutting rollbacks 45% and staffing release nights with one engineer instead of four.',
            ),
          ],
          tags: ['Python', 'Django', 'Redis'],
        }),
      ],
    },
    {
      id: makeId('sec'),
      kind: 'education',
      heading: 'Education',
      visible: true,
      entries: [
        entry({
          title: 'BSc Computer Science',
          subtitle: 'University of Washington',
          location: 'Seattle, WA',
          start: '2012-09',
          end: '2016-06',
          extra: '3.8 / 4.0',
          bullets: [
            bullet('Coursework emphasis in distributed systems, databases and compiler design.'),
            bullet('Teaching assistant for CSE 143 (Data Structures), 2015\u20132016.'),
          ],
        }),
      ],
    },
    {
      id: makeId('sec'),
      kind: 'skills',
      heading: 'Skills',
      visible: true,
      groups: [
        { id: makeId('grp'), label: 'Languages', items: ['TypeScript', 'Go', 'Python', 'SQL'] },
        {
          id: makeId('grp'),
          label: 'Backend',
          items: ['PostgreSQL', 'Redis', 'Kafka', 'gRPC', 'REST', 'Event-driven design'],
        },
        {
          id: makeId('grp'),
          label: 'Cloud & tooling',
          items: ['AWS', 'Kubernetes', 'Terraform', 'Docker', 'GitHub Actions', 'Observability'],
        },
      ],
    },
    {
      id: makeId('sec'),
      kind: 'certifications',
      heading: 'Certifications',
      visible: true,
      entries: [
        entry({
          title: 'AWS Certified Solutions Architect \u2013 Professional',
          subtitle: 'Amazon Web Services',
          start: '2022-05',
          url: 'https://www.credly.com/badges/example-badge-id',
          extra: 'Credential ID AWS-PSA-88213',
        }),
      ],
    },
    {
      id: makeId('sec'),
      kind: 'projects',
      heading: 'Projects',
      visible: true,
      entries: [
        entry({
          title: 'Resume Forge',
          subtitle: 'Open source',
          start: '2023-01',
          current: true,
          url: 'https://github.com/example/resume-forge',
          description:
            'Browser-based resume builder that exports interactive, machine-readable PDFs with clickable links and document metadata.',
          bullets: [
            bullet(
              'Built a client-side PDF pipeline holding verification tests for text extraction, link annotations and reading order.',
            ),
          ],
          tags: ['TypeScript', 'React', 'PDF'],
        }),
      ],
    },
    {
      id: makeId('sec'),
      kind: 'languages',
      heading: 'Languages',
      visible: true,
      items: [
        { id: makeId('lng'), name: 'English', level: 'Native' },
        { id: makeId('lng'), name: 'Spanish', level: 'Professional working proficiency' },
      ],
    },
  ];

  return {
    schemaVersion: SCHEMA_VERSION,
    meta: {
      title: 'Alex Morgan \u2014 Senior Backend Engineer Resume',
      author: 'Alex Morgan',
      subject: 'Resume of Alex Morgan, Senior Backend Engineer',
      keywords:
        'backend engineer, Go, TypeScript, PostgreSQL, Kubernetes, AWS, distributed systems, payments',
      language: 'en-US',
    },
    basics: {
      fullName: 'Alex Morgan',
      headline: 'Senior Backend Engineer',
      email: 'alex.morgan@example.com',
      phone: '+1 (206) 555-0142',
      location: 'Seattle, WA',
      links: [
        { id: makeId('lnk'), label: 'LinkedIn', url: 'https://www.linkedin.com/in/example-alex-morgan' },
        { id: makeId('lnk'), label: 'GitHub', url: 'https://github.com/example' },
        { id: makeId('lnk'), label: 'Portfolio', url: 'https://alexmorgan.example.com' },
      ],
    },
    sections,
    settings: { ...DEFAULT_SETTINGS },
  };
}
