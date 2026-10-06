import { describe, expect, it } from 'vitest';
import { createSampleResume } from '../domain/defaults';
import { resumeToLines, resumeToPlainText, tokenize } from '../domain/text';

describe('resumeToLines', () => {
  const lines = resumeToLines(createSampleResume());

  it('leads with the name, headline and a single contact line', () => {
    expect(lines[0]).toEqual({ text: 'Alex Morgan', kind: 'name' });
    expect(lines[1]).toEqual({ text: 'Senior Backend Engineer', kind: 'headline' });
    expect(lines[2].kind).toBe('contact');
    expect(lines[2].text).toContain('alex.morgan@example.com');
    expect(lines[2].text).toContain('+1 (206) 555-0142');
  });

  it('emits each heading as its own line so parsers can segment on it', () => {
    const headings = lines.filter((line) => line.kind === 'heading').map((line) => line.text);
    expect(headings).toContain('Professional Experience');
    expect(headings).toContain('Education');
    expect(headings).toContain('Skills');
  });

  it('keeps a title, its metadata and its bullets contiguous', () => {
    const start = lines.findIndex((line) => line.text === 'Senior Backend Engineer' && line.kind === 'title');
    expect(start).toBeGreaterThan(-1);
    expect(lines[start + 1].kind).toBe('meta');
    expect(lines[start + 1].text).toContain('Northwind Analytics');
    expect(lines[start + 1].text).toContain('Mar 2021 \u2014 Present');
    expect(lines[start + 2].kind).toBe('bullet');
  });

  it('skips hidden sections entirely', () => {
    const data = createSampleResume();
    data.sections = data.sections.map((section) =>
      section.kind === 'education' ? { ...section, visible: false } : section,
    );
    const visible = resumeToLines(data);
    expect(visible.some((line) => line.text === 'Education')).toBe(false);
    expect(visible.some((line) => line.text.includes('University of Washington'))).toBe(false);
  });

  it('prints skills grouped as label: items', () => {
    const skills = lines.filter((line) => line.kind === 'skills').map((line) => line.text);
    expect(skills[0]).toBe('Languages: TypeScript, Go, Python, SQL');
    expect(skills).toHaveLength(3);
  });
});

describe('resumeToPlainText', () => {
  const text = resumeToPlainText(createSampleResume());

  it('contains everything a parser needs to reconstruct the document', () => {
    for (const fragment of [
      'Alex Morgan',
      'alex.morgan@example.com',
      'Northwind Analytics',
      'Cut cloud spend 38%',
      'University of Washington',
      'AWS Certified Solutions Architect',
    ]) {
      expect(text).toContain(fragment);
    }
  });

  it('preserves words that contain fi/fl ligature pairs', () => {
    // These are the words that break when a font maps ligature glyphs to a
    // single private-use codepoint. The extractor must see the letters.
    for (const word of ['verification', 'workflow', 'efficiency', 'staffing']) {
      expect(text.toLowerCase()).toContain(word);
    }
  });

  it('blank-line separates sections', () => {
    expect(text).toMatch(/Professional Summary\n[\s\S]+\n\nProfessional Experience/);
  });
});

describe('tokenize', () => {
  it('keeps technical terms intact and drops filler', () => {
    const tokens = tokenize('Built CI/CD pipelines with Node.js, C++ and Kubernetes for the team');
    expect(tokens).toContain('ci/cd');
    expect(tokens).toContain('node.js');
    expect(tokens).toContain('c++');
    expect(tokens).toContain('kubernetes');
    expect(tokens).not.toContain('the');
    expect(tokens).not.toContain('with');
  });
});
