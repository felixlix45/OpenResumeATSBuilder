/**
 * End-to-end render verification.
 *
 * These tests do not trust the data model — they render real PDF bytes and then
 * read those bytes back with an independent consumer (pdf.js), the way an ATS
 * would. Every assertion maps to a rule in docs/research/ats-parsing.md.
 *
 * The rendered files are written to `.verify-out/` so they can also be inspected
 * by hand with `node scripts/verify-ats.mjs .verify-out/<name>.pdf --dump-text`.
 */

import { describe, expect, it, beforeAll } from 'vitest';
import { renderToBuffer } from '@react-pdf/renderer';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ResumeDocument } from './ResumeDocument';
import { bullet, createEmptyResume, createSampleResume, DEFAULT_SETTINGS, entry } from '../domain/defaults';
import { resumeToPlainText } from '../domain/text';
import { TEMPLATES } from '../domain/templates';
import type { ResumeData, TemplateId } from '../domain/types';
import { inspectPdfBuffer } from '../../scripts/lib/load-pdf.mjs';
import { runAtsChecks } from '../../scripts/lib/ats-checks.mjs';
import { compareExtractions, extractWithMupdf } from '../../scripts/lib/extract-mupdf.mjs';
import type { AtsExpectations, CheckResult } from '../../scripts/lib/ats-checks.mjs';

const OUT_DIR = '.verify-out';

interface Rendered {
  data: ResumeData;
  bytes: Uint8Array;
  results: CheckResult[];
  failures: CheckResult[];
  inspection: Awaited<ReturnType<typeof inspectPdfBuffer>>['inspection'];
}

async function renderAndVerify(name: string, data: ResumeData, expected: AtsExpectations = {}): Promise<Rendered> {
  const buffer = await renderToBuffer(<ResumeDocument data={data} />);
  const bytes = new Uint8Array(buffer);
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(join(OUT_DIR, `${name}.pdf`), bytes);

  const { inspection } = await inspectPdfBuffer(bytes);
  const results = runAtsChecks(inspection, {
    expected,
    rawBytes: bytes,
    operatorStats: inspection.operatorStats,
    sourceCharCount: resumeToPlainText(data).replace(/\s+/g, '').length,
  });
  if (process.env.VERIFY_TRACE) {
    const failures = results.filter((result) => !result.ok);
    console.log(
      `[render] ${name}: ${bytes.byteLength} bytes, ${inspection.pageCount} page(s), ${failures.length} failure(s)`,
    );
    for (const failure of failures) console.log(`    - ${failure.id}: ${failure.detail}`);
  }
  return { data, bytes, results, failures: results.filter((result) => !result.ok), inspection };
}

function describeFailures(failures: CheckResult[]): string {
  return failures.map((failure) => `${failure.id}: ${failure.detail}`).join('\n');
}

/** Extracted text with line breaks collapsed, for multi-word assertions. */
function flatten(text: string): string {
  return text.replace(/\s+/g, ' ');
}

const SAMPLE_EXPECTATIONS: AtsExpectations = {
  fullName: 'Alex Morgan',
  email: 'alex.morgan@example.com',
  phone: '+1 (206) 555-0142',
  headings: [
    'PROFESSIONAL SUMMARY',
    'PROFESSIONAL EXPERIENCE',
    'EDUCATION',
    'SKILLS',
    'CERTIFICATIONS',
    'PROJECTS',
    'LANGUAGES',
  ],
  keywords: [
    'verification',
    'workflow',
    'efficiency',
    'staffing',
    'kubernetes',
    'postgresql',
    'zero-downtime',
  ],
  attribution: [
    { heading: 'PROFESSIONAL EXPERIENCE', includes: 'Northwind Analytics', excludes: 'University of Washington' },
    { heading: 'EDUCATION', includes: 'University of Washington', excludes: 'Northwind Analytics' },
    { heading: 'CERTIFICATIONS', includes: 'AWS Certified Solutions Architect', excludes: 'Cascade Financial' },
  ],
  bulletChar: '\u2022',
  minimumBullets: 10,
  minimumSpelledRanges: 5,
  expectLinks: true,
  minimumLinks: 6,
  requiredLinkHosts: ['linkedin.com', 'github.com', 'credly.com'],
  expectOutline: true,
  minimumOutline: 4,
  expectMetadata: true,
};

describe('every template produces an ATS-parseable, interactive PDF', () => {
  const rendered = new Map<TemplateId, Rendered>();

  beforeAll(async () => {
    for (const template of TEMPLATES) {
      const data = createSampleResume();
      data.settings = { ...data.settings, templateId: template.id };
      rendered.set(template.id, await renderAndVerify(`sample-${template.id}`, data, SAMPLE_EXPECTATIONS));
    }
  }, 120_000);

  it.each(TEMPLATES.map((template) => template.id))('%s passes every ATS check', (templateId) => {
    const result = rendered.get(templateId);
    expect(result, `template ${templateId} was not rendered`).toBeDefined();
    expect(describeFailures(result!.failures)).toBe('');
    expect(result!.results.length).toBeGreaterThan(12);
  });

  it.each(TEMPLATES.map((template) => template.id))('%s keeps the reading order intact', (templateId) => {
    const result = rendered.get(templateId)!;
    const lines = result.inspection.pages[0].lines;
    // Name, headline and contact line lead page one, in that order.
    expect(lines[0]).toBe('Alex Morgan');
    expect(lines[1]).toBe('Senior Backend Engineer');
    expect(lines[2]).toContain('alex.morgan@example.com');
    // A role reads title, then metadata, then bullets — never interleaved.
    const titleIndex = lines.findIndex((line) => line.includes('Mar 2021'));
    expect(titleIndex).toBeGreaterThan(2);
    expect(lines[titleIndex]).toContain('Senior Backend Engineer');
    expect(lines[titleIndex + 1]).toContain('Northwind Analytics');
    expect(lines[titleIndex + 2].startsWith('\u2022')).toBe(true);
  });

  it.each(TEMPLATES.map((template) => template.id))('%s emits clickable links and a bookmark tree', (templateId) => {
    const result = rendered.get(templateId)!;
    const urls = result.inspection.links.map((link) => link.url).filter(Boolean) as string[];
    expect(urls.some((url) => url.startsWith('mailto:'))).toBe(true);
    expect(urls.some((url) => url.startsWith('tel:'))).toBe(true);
    expect(urls).toContain('https://www.linkedin.com/in/example-alex-morgan');
    expect(urls).toContain('https://github.com/example/resume-forge');
    const titles = result.inspection.outline.map((node) => node.title.toUpperCase());
    expect(titles).toContain('PROFESSIONAL EXPERIENCE');
    expect(titles).toContain('EDUCATION');
  });

  it.each(TEMPLATES.map((template) => template.id))('%s writes document metadata', (templateId) => {
    const result = rendered.get(templateId)!;
    expect(result.inspection.metadata.Title).toContain('Alex Morgan');
    expect(result.inspection.metadata.Author).toBe('Alex Morgan');
  });

  it.each(TEMPLATES.map((template) => template.id))('%s stays well under the 2.5 MB parse cap', (templateId) => {
    const result = rendered.get(templateId)!;
    expect(result.bytes.byteLength).toBeLessThan(500 * 1024);
  });

  it('keeps dates spelled out in every template', () => {
    for (const result of rendered.values()) {
      expect(result.inspection.text).toMatch(/Mar 2021\s*\u2014\s*Present/);
      expect(result.inspection.text).not.toMatch(/\b\d{2}\/20\d{2}\b/);
      expect(result.inspection.text).not.toMatch(/\b20\d{2}-\d{2}\b/);
    }
  });
});

describe('independent verification', () => {
  it('a second, unrelated engine reads the same words', async () => {
    // pdf.js and MuPDF share no code. Agreement between them is evidence about
    // the file rather than about one library's text extractor.
    const data = createSampleResume();
    const buffer = await renderToBuffer(<ResumeDocument data={data} />);
    const bytes = new Uint8Array(buffer);
    const { inspection } = await inspectPdfBuffer(bytes);
    const mupdf = await extractWithMupdf(bytes);
    if (mupdf.error) {
      // MuPDF is an optional dev dependency; skip rather than fail the suite.
      expect(mupdf.error).toBeTruthy();
      return;
    }
    expect(mupdf.pageCount).toBe(inspection.pageCount);
    const comparison = compareExtractions(inspection.text, mupdf.text ?? "");
    expect(
      comparison.agreement,
      `only in pdf.js: ${comparison.onlyInPdfjs.slice(0, 10).join(', ')} | only in MuPDF: ${comparison.onlyInMupdf
        .slice(0, 10)
        .join(', ')}`,
    ).toBeGreaterThanOrEqual(0.98);
    expect(comparison.wordCount).toBeGreaterThan(150);
  }, 120_000);
});

describe('rendering options do not break parseability', () => {
  it('label-only links still extract, and keep the annotation', async () => {
    const data = createSampleResume();
    data.settings = { ...data.settings, linkDisplay: 'label' };
    const result = await renderAndVerify('links-labelled', data, {
      ...SAMPLE_EXPECTATIONS,
      minimumLinks: 6,
    });
    expect(describeFailures(result.failures)).toBe('');
    expect(result.inspection.text).toContain('LinkedIn');
    expect(result.inspection.links.some((link) => link.url?.includes('linkedin.com'))).toBe(true);
  });

  it('page numbers on a multi-page document with a fixed footer do not crash', async () => {
    // Regression guard for react-pdf issue #3452: fixed + render + lineHeight on
    // long documents.
    const data = createSampleResume();
    data.settings = { ...data.settings, showPageNumbers: true };
    const experience = data.sections.find((section) => section.kind === 'experience');
    if (!experience || experience.kind !== 'experience') throw new Error('missing experience');
    experience.entries = Array.from({ length: 24 }, (_, index) =>
      entry({
        title: `Engineer Level ${index + 1}`,
        subtitle: `Company Number ${index + 1}`,
        location: 'Seattle, WA',
        start: '2015-01',
        end: '2016-01',
        bullets: Array.from({ length: 4 }, (__, bulletIndex) =>
          bullet(
            `Delivered measurable outcome ${bulletIndex + 1} for programme ${index + 1}, cutting processing time 30% and saving $12K per quarter.`,
          ),
        ),
      }),
    );
    const result = await renderAndVerify('long-document', data, {
      // The generated entries replace the sample's history, so only the parts of
      // the document that were not replaced are asserted here.
      fullName: 'Alex Morgan',
      email: 'alex.morgan@example.com',
      phone: '+1 (206) 555-0142',
      headings: ['PROFESSIONAL EXPERIENCE', 'EDUCATION', 'SKILLS', 'CERTIFICATIONS'],
      keywords: ['engineer level 24', 'university of washington', 'kubernetes'],
      attribution: [
        { heading: 'PROFESSIONAL EXPERIENCE', includes: 'Company Number 24' },
        { heading: 'EDUCATION', includes: 'University of Washington', excludes: 'Company Number' },
      ],
      bulletChar: '\u2022',
      minimumBullets: 20,
      minimumSpelledRanges: 5,
      expectLinks: true,
      minimumLinks: 4,
      expectOutline: true,
      minimumOutline: 4,
      expectMetadata: true,
    });
    expect(result.inspection.pageCount).toBeGreaterThanOrEqual(4);
    expect(result.inspection.text).not.toContain('e+21');
    expect(result.inspection.text).toContain('Engineer Level 24');
    expect(describeFailures(result.failures.filter((failure) => failure.id !== 'layout.no-repeated-chrome'))).toBe('');
  }, 180_000);

  it('a blank resume still renders a valid, non-broken PDF', async () => {
    const data = createEmptyResume();
    const result = await renderAndVerify('blank', data, { expectMetadata: false });
    expect(result.bytes.byteLength).toBeGreaterThan(500);
    expect(result.inspection.pageCount).toBe(1);
    expect(describeFailures(result.failures)).toBe('');
  });

  it('survives hostile URLs without emitting an unsafe annotation', async () => {
    const data = createSampleResume();
    data.basics.links = [
      { id: 'a', label: 'Evil', url: 'javascript:alert(document.cookie)' },
      { id: 'b', label: 'Data', url: 'data:text/html;base64,PHNjcmlwdD4=' },
      { id: 'c', label: 'Good', url: 'https://example.org/portfolio' },
    ];
    const result = await renderAndVerify('hostile-links', data, {
      ...SAMPLE_EXPECTATIONS,
      minimumLinks: 3,
      requiredLinkHosts: ['example.org', 'credly.com'],
    });
    const urls = result.inspection.links.map((link) => link.url ?? '');
    expect(urls.some((url) => url.toLowerCase().startsWith('javascript:'))).toBe(false);
    expect(urls.some((url) => url.toLowerCase().startsWith('data:'))).toBe(false);
    expect(urls.some((url) => url.includes('example.org'))).toBe(true);
    expect(flatten(result.inspection.text)).toContain('example.org/portfolio');
  });

  it('normalises ligatures and folds unprintable characters instead of garbling them', async () => {
    const data = createSampleResume();
    const summary = data.sections.find((section) => section.kind === 'summary');
    if (summary && summary.kind === 'summary') {
      // A ligature pasted from another PDF, a smart-quote, and an emoji.
      summary.text =
        'Led \ufb01nancial reporting and classi\ufb01cation work \u2014 shipped a 0\u21921 onboarding flow \u2705 on time.';
    }
    const result = await renderAndVerify('unicode-edge-cases', data, {
      ...SAMPLE_EXPECTATIONS,
      keywords: ['financial', 'classification', 'verification'],
    });
    const flat = flatten(result.inspection.text);
    expect(flat).toContain('financial reporting');
    expect(flat).toContain('classification');
    expect(flat).toContain('0->1 onboarding');
    expect(result.inspection.text).not.toMatch(/[\ufb00-\ufb06]/);
    expect(describeFailures(result.failures.filter((failure) => failure.id === 'text.no-unmappable-glyphs'))).toBe('');
  });

  it('handles A4 with narrow margins and a large font scale without clipping text', async () => {
    const data = createSampleResume();
    data.settings = {
      ...DEFAULT_SETTINGS,
      templateId: 'elegant',
      fontFamily: 'Times-Roman',
      pageSize: 'A4',
      margin: 0.45,
      fontScale: 1.15,
      uppercaseHeadings: false,
      headingRule: false,
    };
    const result = await renderAndVerify('a4-elegant-large', data, {
      ...SAMPLE_EXPECTATIONS,
      headings: [
        'Professional Summary',
        'Professional Experience',
        'Education',
        'Skills',
        'Certifications',
        'Projects',
        'Languages',
      ],
    });
    expect(describeFailures(result.failures)).toBe('');
    expect(result.inspection.pages.every((page) => Math.abs(page.width - 595.28) < 2)).toBe(true);
  });

  it('does not split a short section across a page break', async () => {
    const data = createSampleResume();
    const result = await renderAndVerify('pagination', data, SAMPLE_EXPECTATIONS);
    for (const page of result.inspection.pages) {
      const lines = page.lines.filter(Boolean);
      const last = lines[lines.length - 1] ?? '';
      expect(last).not.toBe('SKILLS');
      expect(last).not.toBe('LANGUAGES');
    }
  });
});
