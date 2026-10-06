import { describe, expect, it } from 'vitest';
import { createEmptyResume, createSampleResume } from './defaults';
import { normalizeResume } from './normalize';
import { SCHEMA_VERSION } from './types';

describe('normalizeResume', () => {
  it('never throws on hostile input and always returns a usable document', () => {
    for (const input of [null, undefined, 42, 'nope', [], { sections: 'no' }, { basics: 7 }]) {
      const { data } = normalizeResume(input);
      expect(data.schemaVersion).toBe(SCHEMA_VERSION);
      expect(Array.isArray(data.sections)).toBe(true);
      expect(data.settings.templateId).toBeTruthy();
    }
  });

  it('round-trips its own output unchanged', () => {
    const original = createSampleResume();
    const { data, warnings } = normalizeResume(JSON.parse(JSON.stringify(original)));
    expect(warnings).toEqual([]);
    expect(data.basics).toEqual(original.basics);
    expect(data.sections.map((section) => section.kind)).toEqual(original.sections.map((section) => section.kind));
    expect(data.settings).toEqual(original.settings);
  });

  it('imports a JSON Resume-shaped document', () => {
    const { data } = normalizeResume({
      basics: {
        name: 'Dana Whitfield',
        label: 'Data Analyst',
        email: 'dana@example.com',
        phone: '206-555-0100',
        location: { city: 'Reno', region: 'NV' },
        profiles: [{ network: 'GitHub', url: 'https://github.com/dana' }],
      },
      work: [],
      skills: [{ name: 'Analysis', keywords: ['SQL', 'R'] }],
      education: [],
    });
    expect(data.basics.fullName).toBe('Dana Whitfield');
    expect(data.basics.headline).toBe('Data Analyst');
    expect(data.basics.links[0]).toMatchObject({ label: 'GitHub', url: 'https://github.com/dana' });
    void data;
  });

  it('warns instead of silently accepting a broken email', () => {
    const { warnings } = normalizeResume({ basics: { fullName: 'A B', email: 'not-an-email' } });
    expect(warnings.some((warning) => warning.includes('email'))).toBe(true);
  });

  it('clamps settings that would break the printed page', () => {
    const { data } = normalizeResume({
      settings: {
        margin: 99,
        fontScale: -3,
        lineHeight: 0,
        templateId: 'hologram',
        pageSize: 'A0',
        accentColor: 'red',
        bulletChar: 'X',
      },
    });
    expect(data.settings.margin).toBeLessThanOrEqual(1.1);
    expect(data.settings.margin).toBeGreaterThanOrEqual(0.35);
    expect(data.settings.fontScale).toBeGreaterThanOrEqual(0.85);
    expect(data.settings.lineHeight).toBeGreaterThanOrEqual(1.05);
    expect(data.settings.templateId).toBe('classic');
    expect(data.settings.pageSize).toBe('LETTER');
    expect(data.settings.accentColor).toBe('#0F4C81');
    expect(data.settings.bulletChar).toBe('\u2022');
  });

  it('repairs the shapes people send in by hand', () => {
    const { data } = normalizeResume({
      basics: { fullName: 'Sam Reed' },
      sections: [
        { kind: 'experience', heading: 'Work Experience', items: [{ position: 'Dev', company: 'Acme', bullets: ['Did things', { text: 'Did more' }, '', null] }] },
        { kind: 'skills', heading: 'Skills', items: ['Go', 'Rust'] },
        { kind: 'nonsense', heading: 'Whatever', entries: [] },
      ],
    });
    const experience = data.sections[0];
    expect(experience.kind).toBe('experience');
    if (experience.kind === 'experience') {
      expect(experience.entries[0].title).toBe('Dev');
      expect(experience.entries[0].subtitle).toBe('Acme');
      expect(experience.entries[0].bullets.map((bullet) => bullet.text)).toEqual(['Did things', 'Did more']);
    }
    const skills = data.sections[1];
    expect(skills.kind).toBe('skills');
    if (skills.kind === 'skills') {
      expect(skills.groups[0].items).toEqual(['Go', 'Rust']);
    }
    expect(data.sections[2].kind).toBe('custom');
  });

  it('flags duplicate single-instance sections and newer schema versions', () => {
    const { warnings } = normalizeResume({
      schemaVersion: 99,
      sections: [
        { kind: 'education', heading: 'Education', entries: [] },
        { kind: 'education', heading: 'Education', entries: [] },
      ],
    });
    expect(warnings.some((warning) => warning.includes('newer version'))).toBe(true);
    expect(warnings.some((warning) => warning.includes('More than one'))).toBe(true);
  });

  it('gives every node a unique id', () => {
    const { data } = normalizeResume({ sections: [{ kind: 'experience', heading: 'Experience', entries: [{ title: 'a' }, { title: 'b' }] }] });
    const ids = data.sections.flatMap((section) =>
      section.kind === 'experience' ? section.entries.map((entry) => entry.id) : [section.id],
    );
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('round-trips the blank resume, so a fresh document is always importable', () => {
    const { data, warnings } = normalizeResume(createEmptyResume());
    expect(warnings).toEqual([]);
    expect(data.sections).toHaveLength(4);
  });
});
