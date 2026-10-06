/**
 * Store behaviour: undo/redo, coalescing, and the editing actions the UI drives.
 *
 * These are the guarantees the interface depends on — that a burst of typing is
 * one undo step, that reordering never loses an item, and that an edit can never
 * leave the document in a state the renderer cannot handle.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { useStore } from './store';
import { createSampleResume } from '../domain/defaults';

function reset() {
  useStore.setState({
    resume: createSampleResume(),
    past: [],
    future: [],
    isSample: false,
    loadWarnings: [],
  });
}

const experienceSection = () => {
  const section = useStore.getState().resume.sections.find((candidate) => candidate.kind === 'experience');
  if (!section || section.kind !== 'experience') throw new Error('sample has no experience section');
  return section;
};

describe('undo and redo', () => {
  beforeEach(reset);

  it('undoes a single edit and redoes it', () => {
    const before = useStore.getState().resume.basics.fullName;
    useStore.getState().updateBasics({ fullName: 'Dana Whitfield' });
    expect(useStore.getState().resume.basics.fullName).toBe('Dana Whitfield');
    expect(useStore.getState().canUndo()).toBe(true);

    useStore.getState().undo();
    expect(useStore.getState().resume.basics.fullName).toBe(before);
    expect(useStore.getState().canRedo()).toBe(true);

    useStore.getState().redo();
    expect(useStore.getState().resume.basics.fullName).toBe('Dana Whitfield');
  });

  it('collapses a burst of typing in one field into a single undo step', () => {
    const section = experienceSection();
    const entryId = section.entries[0].id;
    const bulletId = section.entries[0].bullets[0].id;

    for (const text of ['Cut', 'Cut latency', 'Cut latency 38%']) {
      useStore.getState().updateBullet(section.id, entryId, bulletId, text);
    }
    expect(useStore.getState().past.length).toBe(1);

    useStore.getState().undo();
    const after = useStore
      .getState()
      .resume.sections.find((candidate) => candidate.kind === 'experience');
    if (!after || after.kind !== 'experience') throw new Error('missing section');
    expect(after.entries[0].bullets[0].text).not.toBe('Cut latency 38%');
  });

  it('starts a new undo step for a different field', () => {
    const section = experienceSection();
    useStore.getState().updateEntry(section.id, section.entries[0].id, { title: 'Staff Engineer' });
    useStore.getState().updateEntry(section.id, section.entries[0].id, { subtitle: 'Globex' });
    expect(useStore.getState().past.length).toBe(2);
  });

  it('clears the sample flag on the first edit', () => {
    useStore.setState({ isSample: true });
    useStore.getState().updateBasics({ fullName: 'Someone Real' });
    expect(useStore.getState().isSample).toBe(false);
  });

  it('caps the history so a long session cannot grow without bound', () => {
    for (let index = 0; index < 200; index += 1) {
      useStore.getState().updateBasics({ headline: `Title ${index}` });
    }
    expect(useStore.getState().past.length).toBeLessThanOrEqual(60);
  });
});

describe('editing actions', () => {
  beforeEach(reset);

  it('adds, duplicates and removes entries without losing neighbours', () => {
    const section = experienceSection();
    const original = section.entries.length;

    useStore.getState().addEntry(section.id);
    expect(experienceSection().entries).toHaveLength(original + 1);

    const firstId = experienceSection().entries[0].id;
    useStore.getState().duplicateEntry(section.id, firstId);
    const afterDuplicate = experienceSection().entries;
    expect(afterDuplicate).toHaveLength(original + 2);
    expect(afterDuplicate[1].id).not.toBe(firstId);
    expect(afterDuplicate[1].title).toBe(afterDuplicate[0].title);
    // Duplicated bullets must get fresh ids or React keys collide.
    expect(afterDuplicate[1].bullets[0].id).not.toBe(afterDuplicate[0].bullets[0].id);

    useStore.getState().removeEntry(section.id, firstId);
    expect(experienceSection().entries.some((entry) => entry.id === firstId)).toBe(false);
  });

  it('moves entries by one and to an arbitrary index', () => {
    const section = experienceSection();
    const [first, second] = experienceSection().entries;
    useStore.getState().moveEntry(section.id, first.id, 1);
    expect(experienceSection().entries[1].id).toBe(first.id);
    useStore.getState().moveEntryTo(section.id, first.id, 0);
    expect(experienceSection().entries[0].id).toBe(first.id);
    expect(experienceSection().entries[1].id).toBe(second.id);
  });

  it('never moves an entry past the ends of the list', () => {
    const section = experienceSection();
    const originalOrder = experienceSection().entries.map((entry) => entry.id);
    useStore.getState().moveEntry(section.id, originalOrder[0], -1);
    useStore.getState().moveEntry(section.id, originalOrder[originalOrder.length - 1], 1);
    expect(experienceSection().entries.map((entry) => entry.id)).toEqual(originalOrder);
  });

  it('sorts entries most-recent-first, keeping current roles on top', () => {
    const section = experienceSection();
    const malformed = section.entries.find((entry) => entry.subtitle === 'Cascade Financial');
    if (!malformed) throw new Error('expected Cascade Financial in the sample');
    useStore.getState().moveEntryTo(section.id, malformed.id, 0);
    expect(experienceSection().entries[0].id).toBe(malformed.id);

    useStore.getState().sortEntriesByDate(section.id);
    const sorted = experienceSection().entries;
    expect(sorted[0].current).toBe(true);
    expect(sorted[1].subtitle).toBe('Cascade Financial');
  });

  it('adds a keyword to the existing skills section without duplicating it', () => {
    useStore.getState().addSkillKeyword('Rust');
    useStore.getState().addSkillKeyword('rust');
    const skills = useStore.getState().resume.sections.find((section) => section.kind === 'skills');
    if (!skills || skills.kind !== 'skills') throw new Error('missing skills section');
    const items = skills.groups.flatMap((group) => group.items);
    expect(items.filter((item) => item.toLowerCase() === 'rust')).toHaveLength(1);
  });

  it('creates a skills section when the document has none', () => {
    useStore.setState({
      resume: { ...useStore.getState().resume, sections: [] },
    });
    useStore.getState().addSkillKeyword('Terraform');
    const skills = useStore.getState().resume.sections.find((section) => section.kind === 'skills');
    expect(skills).toBeDefined();
  });

  it('refuses a second section of a kind that must be unique', () => {
    const before = useStore.getState().resume.sections.length;
    useStore.getState().addSection('experience');
    expect(useStore.getState().resume.sections).toHaveLength(before);
    useStore.getState().addSection('awards');
    expect(useStore.getState().resume.sections).toHaveLength(before + 1);
  });

  it('inserts a new section in a sensible reading order', () => {
    useStore.getState().addSection('awards');
    const kinds = useStore.getState().resume.sections.map((section) => section.kind);
    const skillsIndex = kinds.indexOf('skills');
    const awardsIndex = kinds.indexOf('awards');
    expect(awardsIndex).toBeGreaterThan(skillsIndex);
  });

  it('removes a section and everything in it', () => {
    const section = experienceSection();
    useStore.getState().removeSection(section.id);
    expect(useStore.getState().resume.sections.some((candidate) => candidate.id === section.id)).toBe(false);
  });

  it('reorders sections', () => {
    const ids = useStore.getState().resume.sections.map((section) => section.id);
    useStore.getState().moveSection(ids[0], 1);
    const after = useStore.getState().resume.sections.map((section) => section.id);
    expect(after[0]).toBe(ids[1]);
    expect(after[1]).toBe(ids[0]);
    useStore.getState().moveSectionTo(ids[0], 0);
    expect(useStore.getState().resume.sections[0].id).toBe(ids[0]);
  });

  it('keeps bullet ordering stable through moves', () => {
    const section = experienceSection();
    const entry = section.entries[0];
    const order = entry.bullets.map((bullet) => bullet.id);
    useStore.getState().moveBullet(section.id, entry.id, order[2], -1);
    const moved = experienceSection().entries[0].bullets.map((bullet) => bullet.id);
    expect(moved[1]).toBe(order[2]);
    useStore.getState().moveBulletTo(section.id, entry.id, order[2], 3);
    const restored = experienceSection().entries[0].bullets.map((bullet) => bullet.id);
    expect(restored[3]).toBe(order[2]);
  });
});
