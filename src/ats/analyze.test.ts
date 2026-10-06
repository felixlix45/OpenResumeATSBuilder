import { describe, expect, it } from 'vitest';
import { analyzeResume, contrastRatio, hexToRgb } from './analyze';
import { createEmptyResume, createSampleResume, entry, bullet } from '../domain/defaults';
import { analyzeKeywords, extractJdTerms, normalizeKey, resumeKeySet, suggestSkillAdditions } from './keywords';

const find = (checks: ReturnType<typeof analyzeResume>['checks'], id: string) =>
  checks.find((check) => check.id === id);

describe('analyzeResume on the sample resume', () => {
  const result = analyzeResume(createSampleResume());

  it('scores the worked sample as strong', () => {
    expect(result.score).toBeGreaterThanOrEqual(80);
    expect(['excellent', 'good']).toContain(result.grade);
  });

  it('reports the identity fields as passing', () => {
    expect(find(result.checks, 'identity.name')?.status).toBe('pass');
    expect(find(result.checks, 'identity.email')?.status).toBe('pass');
    expect(find(result.checks, 'identity.phone')?.status).toBe('pass');
    expect(find(result.checks, 'identity.links')?.status).toBe('pass');
  });

  it('confirms the structural guarantees the renderer makes', () => {
    expect(find(result.checks, 'structure.singleColumn')?.status).toBe('pass');
    expect(find(result.checks, 'structure.headings')?.status).toBe('pass');
    expect(find(result.checks, 'structure.duplicates')?.status).toBe('pass');
    expect(find(result.checks, 'format.fonts')?.status).toBe('pass');
  });

  it('counts words a parser would see', () => {
    expect(result.wordCount).toBeGreaterThan(250);
  });

  it('returns null keywords when no posting is supplied', () => {
    expect(result.keywords).toBeNull();
  });
});

describe('analyzeResume on an empty resume', () => {
  const result = analyzeResume(createEmptyResume());

  it('fails the essentials rather than pretending everything is fine', () => {
    expect(find(result.checks, 'identity.name')?.status).toBe('fail');
    expect(find(result.checks, 'identity.email')?.status).toBe('fail');
    expect(find(result.checks, 'structure.experience')?.status).toBe('fail');
    expect(result.score).toBeLessThan(55);
    expect(result.grade).toBe('needs-work');
  });

  it('gives every failing check a concrete fix', () => {
    for (const check of result.checks) {
      if (check.status === 'fail') expect(check.fix, `${check.id} has no fix`).toBeTruthy();
    }
  });
});

describe('content checks catch real problems', () => {
  it('flags weak openers, missing metrics and first person', () => {
    const data = createEmptyResume();
    data.basics = {
      fullName: 'Casey Nguyen',
      headline: 'Analyst',
      email: 'casey@example.com',
      phone: '+1 206 555 0100',
      location: 'Reno, NV',
      links: [],
    };
    const experience = data.sections.find((section) => section.kind === 'experience');
    if (!experience || experience.kind !== 'experience') throw new Error('missing experience section');
    experience.entries = [
      entry({
        title: 'Analyst',
        subtitle: 'Acme',
        start: '2020-01',
        end: '2021-01',
        bullets: [
          bullet('Responsible for the weekly report.'),
          bullet('I helped with the migration.'),
          bullet('Worked on dashboards.'),
          bullet('Attended meetings.'),
        ],
      }),
    ];
    const result = analyzeResume(data);
    expect(find(result.checks, 'content.openers')?.status).toBe('warn');
    expect(find(result.checks, 'content.quantified')?.status).toBe('fail');
    expect(find(result.checks, 'content.pronouns')?.status).toBe('warn');
  });

  it('flags placeholder text as a hard failure', () => {
    const data = createSampleResume();
    const summary = data.sections.find((section) => section.kind === 'summary');
    if (summary && summary.kind === 'summary') summary.text = 'Lorem ipsum dolor sit amet, TBD.';
    const result = analyzeResume(data);
    expect(find(result.checks, 'content.placeholder')?.status).toBe('fail');
  });

  it('detects a repeated bullet', () => {
    const data = createSampleResume();
    const experience = data.sections.find((section) => section.kind === 'experience');
    if (experience && experience.kind === 'experience') {
      experience.entries[1].bullets.push({ id: 'dup', text: experience.entries[0].bullets[0].text });
    }
    const result = analyzeResume(data);
    expect(find(result.checks, 'content.duplicates')?.status).toBe('warn');
  });

  it('detects reversed date ranges and unusable links', () => {
    const data = createSampleResume();
    const experience = data.sections.find((section) => section.kind === 'experience');
    if (experience && experience.kind === 'experience') {
      experience.entries[0].current = false;
      experience.entries[0].end = '2019-01';
      experience.entries[0].start = '2021-01';
    }
    data.basics.links = [{ id: 'bad', label: 'Portfolio', url: 'javascript:alert(1)' }];
    const result = analyzeResume(data);
    expect(find(result.checks, 'content.dateOrder')?.status).toBe('warn');
    expect(find(result.checks, 'identity.links')?.status).toBe('fail');
  });

  it('warns about an unrecognised heading', () => {
    const data = createSampleResume();
    const custom = data.sections.find((section) => section.kind === 'projects');
    if (custom) custom.heading = 'Stuff I Did On The Side';
    const result = analyzeResume(data);
    expect(find(result.checks, 'structure.headings')?.status).toBe('warn');
  });

  it('uses the rendered page count when it is known', () => {
    const three = analyzeResume(createSampleResume(), { pageCount: 3 });
    expect(find(three.checks, 'format.pages')?.status).toBe('warn');
    const one = analyzeResume(createSampleResume(), { pageCount: 1 });
    expect(find(one.checks, 'format.pages')?.status).toBe('pass');
  });
});

describe('formatting checks', () => {
  it('fails a low-contrast accent colour', () => {
    const data = createSampleResume();
    data.settings.accentColor = '#FFEE88';
    const result = analyzeResume(data);
    expect(find(result.checks, 'format.contrast')?.status).toBe('fail');
  });

  it('warns when the body text drops below 10 pt', () => {
    const data = createSampleResume();
    data.settings.templateId = 'compact';
    data.settings.fontScale = 0.9;
    const result = analyzeResume(data);
    expect(find(result.checks, 'format.fontSize')?.status).toBe('warn');
  });
});

describe('contrast maths', () => {
  it('parses hex colours', () => {
    expect(hexToRgb('#FFFFFF')).toEqual({ r: 255, g: 255, b: 255 });
    expect(hexToRgb('nope')).toBeNull();
  });

  it('computes known WCAG ratios', () => {
    expect(contrastRatio('#FFFFFF', '#000000')).toBeCloseTo(21, 1);
    expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5);
    expect(contrastRatio('#767676', '#FFFFFF')).toBeCloseTo(4.54, 1);
  });
});

describe('keyword extraction', () => {
  const posting = `
    Senior Backend Engineer

    We are looking for a Senior Backend Engineer to join our payments team.

    Requirements:
    - 5+ years of experience with Go or TypeScript
    - Deep knowledge of PostgreSQL and query optimisation
    - Experience with Kubernetes and Terraform in production
    - Familiarity with Kafka and event-driven architecture
    - Experience with machine learning pipelines is a plus
  `;

  it('keeps multi-word skills as phrases', () => {
    const terms = extractJdTerms(posting).map((term) => term.term);
    expect(terms).toContain('backend engineer');
    expect(terms).toContain('machine learning');
  });

  it('ranks repeated, emphasised and capitalised terms first', () => {
    const terms = extractJdTerms(posting);
    const top = terms.slice(0, 15).map((term) => normalizeKey(term.term));
    // Named technologies must survive the crowd of repeated role words.
    const skills = ['postgresql', 'kubernetes', 'terraform', 'kafka', 'machinelearning'];
    expect(skills.filter((skill) => top.includes(skill)).length).toBeGreaterThanOrEqual(3);
    // And no phrase may be glued together across a word that was removed.
    expect(top.some((term) => term.includes('knowledgepostgresql'))).toBe(false);
    expect(top.some((term) => term.includes('postgresqlquery'))).toBe(false);
  });

  it('normalises formatting differences so front-end matches frontend', () => {
    expect(normalizeKey('Front-End')).toBe('frontend');
    expect(normalizeKey('front end')).toBe('frontend');
    expect(normalizeKey('Node.js')).toBe('node.js');
  });

  it('reports coverage honestly for the sample resume', () => {
    const report = analyzeKeywords(createSampleResume(), posting);
    expect(report).not.toBeNull();
    if (!report) return;
    expect(report.jdTermCount).toBeGreaterThan(10);
    // Honest, not flattering: the sample legitimately lacks several requirements.
    expect(report.coverage).toBeGreaterThan(0.4);
    expect(report.coverage).toBeLessThan(0.9);
    expect(report.matched.some((item) => item.term === 'postgresql')).toBe(true);
    expect(report.detectedTitle?.toLowerCase()).toContain('backend engineer');
  });

  it('lists the terms that are genuinely absent, for one-click additions', () => {
    const data = createEmptyResume();
    data.basics.fullName = 'Robin Ellis';
    data.basics.headline = 'Backend Engineer';
    const report = analyzeKeywords(data, posting);
    expect(report).not.toBeNull();
    if (!report) return;
    expect(report.coverage).toBeLessThan(0.3);
    const suggestions = suggestSkillAdditions(report, 8);
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions.length).toBeLessThanOrEqual(8);
    expect(new Set(suggestions).size).toBe(suggestions.length);
  });

  it('returns null rather than a fake zero for an empty posting', () => {
    expect(analyzeKeywords(createSampleResume(), '   ')).toBeNull();
    expect(extractJdTerms('')).toEqual([]);
  });

  it('never matches a posting term the resume does not contain', () => {
    const keys = resumeKeySet(createSampleResume());
    expect(keys.has('postgresql')).toBe(true);
    expect(keys.has('cobol')).toBe(false);
  });
});
