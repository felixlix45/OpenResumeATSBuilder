/**
 * Application state.
 *
 * One store holds the resume, its undo history and the small amount of UI state
 * that must survive a reload (which tab you were on, the job description you
 * pasted). Edits go through `edit()`, which clones before mutating — so call
 * sites can write ordinary imperative code and still get immutable updates and
 * working undo.
 */

import { create } from 'zustand';
import { createEmptyResume, createSampleResume, newSection } from '../domain/defaults';
import { makeId } from '../domain/ids';
import { normalizeResume } from '../domain/normalize';
import { isSectionKindExhausted } from '../domain/sections';
import { recencyKey } from '../domain/dates';
import type {
  Basics,
  Bullet,
  Entry,
  ResumeData,
  ResumeSettings,
  Section,
  SectionKind,
} from '../domain/types';

const STORAGE_KEY = 'resume-forge:document';
const UI_KEY = 'resume-forge:ui';
const HISTORY_LIMIT = 60;

export type EditorTab = 'content' | 'design' | 'analysis';
export type PreviewMode = 'pdf' | 'parser';

export interface UiState {
  tab: EditorTab;
  previewMode: PreviewMode;
  zoom: number;
  fitToWidth: boolean;
  jobDescription: string;
  /** Check ids the user has explicitly accepted, so they stop being counted. */
  dismissedChecks: string[];
  /** Section/entry the editor should scroll to, set by "show me" links. */
  focusTarget: { sectionId?: string; entryId?: string; field?: string; nonce: number } | null;
  mobilePane: 'edit' | 'preview';
  notice: { tone: 'info' | 'success' | 'warning' | 'danger'; message: string; id: string } | null;
}

interface EditOptions {
  /** Set false for changes that should not be undoable (e.g. focusing a field). */
  history?: boolean;
  /**
   * Rapid edits sharing a key collapse into one undo step — typing a word is one
   * undo, not one per character.
   */
  coalesceKey?: string;
}

interface HistoryEntry {
  resume: ResumeData;
  coalesceKey?: string;
  at: number;
}

export interface Store {
  resume: ResumeData;
  past: HistoryEntry[];
  future: HistoryEntry[];
  ui: UiState;
  /** Warnings produced the last time a document was loaded from storage. */
  loadWarnings: string[];
  /**
   * True while the document is still the untouched worked sample. The editor
   * shows a banner so nobody emails Alex Morgan's resume by accident.
   */
  isSample: boolean;

  edit: (mutator: (draft: ResumeData) => void, options?: EditOptions) => void;
  undo: () => void;
  redo: () => void;
  replaceResume: (next: ResumeData, options?: { history?: boolean; warnings?: string[]; isSample?: boolean }) => void;
  resetToSample: () => void;
  resetToBlank: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  setUi: (patch: Partial<UiState>) => void;
  notify: (tone: 'info' | 'success' | 'warning' | 'danger', message: string) => void;
  dismissNotice: () => void;
  toggleCheckDismissed: (checkId: string) => void;
  focusField: (target: { sectionId?: string; entryId?: string; field?: string }) => void;

  // Document actions
  updateBasics: (patch: Partial<Basics>) => void;
  updateSettings: (patch: Partial<ResumeSettings>) => void;
  updateMeta: (patch: Partial<ResumeData['meta']>) => void;
  addSection: (kind: SectionKind) => void;
  removeSection: (sectionId: string) => void;
  moveSection: (sectionId: string, direction: -1 | 1) => void;
  updateSection: (sectionId: string, patch: Partial<Section>) => void;
  addEntry: (sectionId: string) => void;
  updateEntry: (sectionId: string, entryId: string, patch: Partial<Entry>) => void;
  removeEntry: (sectionId: string, entryId: string) => void;
  duplicateEntry: (sectionId: string, entryId: string) => void;
  moveEntry: (sectionId: string, entryId: string, direction: -1 | 1) => void;
  sortEntriesByDate: (sectionId: string) => void;
  addBullet: (sectionId: string, entryId: string) => void;
  updateBullet: (sectionId: string, entryId: string, bulletId: string, text: string) => void;
  removeBullet: (sectionId: string, entryId: string, bulletId: string) => void;
  moveBullet: (sectionId: string, entryId: string, bulletId: string, direction: -1 | 1) => void;
  /** Drag-and-drop reordering. */
  moveBulletTo: (sectionId: string, entryId: string, bulletId: string, toIndex: number) => void;
  moveEntryTo: (sectionId: string, entryId: string, toIndex: number) => void;
  moveSectionTo: (sectionId: string, toIndex: number) => void;
  /** Adds a keyword to the first skills group, creating one when necessary. */
  addSkillKeyword: (keyword: string) => void;
}

const DEFAULT_UI: UiState = {
  tab: 'content',
  previewMode: 'pdf',
  zoom: 1,
  fitToWidth: true,
  jobDescription: '',
  dismissedChecks: [],
  focusTarget: null,
  mobilePane: 'edit',
  notice: null,
};

function clone<T>(value: T): T {
  return structuredClone(value);
}

function loadStoredResume(): { resume: ResumeData; warnings: string[]; isSample: boolean } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { resume: createSampleResume(), warnings: [], isSample: true };
    const { data, warnings } = normalizeResume(JSON.parse(raw));
    return { resume: data, warnings, isSample: false };
  } catch {
    return {
      resume: createSampleResume(),
      warnings: ['Saved work could not be read, so the sample resume was loaded.'],
      isSample: true,
    };
  }
}

function loadStoredUi(): UiState {
  try {
    const raw = localStorage.getItem(UI_KEY);
    if (!raw) return DEFAULT_UI;
    const parsed = JSON.parse(raw) as Partial<UiState>;
    return {
      ...DEFAULT_UI,
      tab: parsed.tab === 'design' || parsed.tab === 'analysis' ? parsed.tab : 'content',
      previewMode: parsed.previewMode === 'parser' ? 'parser' : 'pdf',
      zoom: typeof parsed.zoom === 'number' && parsed.zoom >= 0.4 && parsed.zoom <= 3 ? parsed.zoom : 1,
      fitToWidth: parsed.fitToWidth !== false,
      jobDescription: typeof parsed.jobDescription === 'string' ? parsed.jobDescription.slice(0, 20_000) : '',
      dismissedChecks: Array.isArray(parsed.dismissedChecks)
        ? parsed.dismissedChecks.filter((id): id is string => typeof id === 'string').slice(0, 200)
        : [],
    };
  } catch {
    return DEFAULT_UI;
  }
}

/** Finds a section by id, narrowed to the entry-bearing kinds. */
function findEntrySection(resume: ResumeData, sectionId: string) {
  const section = resume.sections.find((candidate) => candidate.id === sectionId);
  if (!section) return null;
  if (section.kind === 'summary' || section.kind === 'skills' || section.kind === 'languages') return null;
  return section;
}

function reorder<T>(items: T[], from: number, to: number): void {
  if (to < 0 || to >= items.length) return;
  const [moved] = items.splice(from, 1);
  items.splice(to, 0, moved);
}

export const useStore = create<Store>((set, get) => {
  const initial = loadStoredResume();

  const commit = (mutator: (draft: ResumeData) => void, options: EditOptions = {}) => {
    const { history = true, coalesceKey } = options;
    const state = get();
    const draft = clone(state.resume);
    mutator(draft);

    const now = Date.now();
    let past = state.past;
    if (history) {
      const last = past[past.length - 1];
      const isContinuation =
        coalesceKey !== undefined && last?.coalesceKey === coalesceKey && now - last.at < 1200;
      if (!isContinuation) {
        past = [...past, { resume: state.resume, coalesceKey, at: now }];
        if (past.length > HISTORY_LIMIT) past = past.slice(past.length - HISTORY_LIMIT);
      } else {
        past = [...past.slice(0, -1), { ...last, at: now }];
      }
    }

    set({ resume: draft, past, future: history ? [] : state.future, isSample: false });
  };

  return {
    resume: initial.resume,
    past: [],
    future: [],
    ui: loadStoredUi(),
    loadWarnings: initial.warnings,
    isSample: initial.isSample,

    edit: commit,

    undo: () => {
      const { past, future, resume } = get();
      const previous = past[past.length - 1];
      if (!previous) return;
      set({
        resume: previous.resume,
        past: past.slice(0, -1),
        future: [{ resume, coalesceKey: undefined, at: Date.now() }, ...future].slice(0, HISTORY_LIMIT),
      });
    },

    redo: () => {
      const { past, future, resume } = get();
      const next = future[0];
      if (!next) return;
      set({
        resume: next.resume,
        past: [...past, { resume, coalesceKey: undefined, at: Date.now() }],
        future: future.slice(1),
      });
    },

    replaceResume: (next, options = {}) => {
      const state = get();
      const history = options.history !== false;
      set({
        resume: next,
        isSample: options.isSample ?? false,
        past: history ? [...state.past, { resume: state.resume, coalesceKey: undefined, at: Date.now() }] : [],
        future: [],
        loadWarnings: options.warnings ?? [],
      });
    },

    resetToSample: () => get().replaceResume(createSampleResume(), { isSample: true }),
    resetToBlank: () => get().replaceResume(createEmptyResume()),

    canUndo: () => get().past.length > 0,
    canRedo: () => get().future.length > 0,

    setUi: (patch) => set({ ui: { ...get().ui, ...patch } }),

    notify: (tone, message) => set({ ui: { ...get().ui, notice: { tone, message, id: makeId('notice') } } }),
    dismissNotice: () => set({ ui: { ...get().ui, notice: null } }),

    toggleCheckDismissed: (checkId) => {
      const { dismissedChecks } = get().ui;
      const next = dismissedChecks.includes(checkId)
        ? dismissedChecks.filter((id) => id !== checkId)
        : [...dismissedChecks, checkId];
      set({ ui: { ...get().ui, dismissedChecks: next } });
    },

    focusField: (target) =>
      set({
        ui: {
          ...get().ui,
          tab: 'content',
          mobilePane: 'edit',
          focusTarget: { ...target, nonce: Date.now() },
        },
      }),

    updateBasics: (patch) =>
      commit((draft) => {
        draft.basics = { ...draft.basics, ...patch };
      }, { coalesceKey: `basics:${Object.keys(patch).join(',')}` }),

    updateSettings: (patch) =>
      commit((draft) => {
        draft.settings = { ...draft.settings, ...patch };
      }, { coalesceKey: `settings:${Object.keys(patch).join(',')}` }),

    updateMeta: (patch) =>
      commit((draft) => {
        draft.meta = { ...draft.meta, ...patch };
      }, { coalesceKey: `meta:${Object.keys(patch).join(',')}` }),

    addSection: (kind) =>
      commit((draft) => {
        if (isSectionKindExhausted(kind, draft.sections)) return;
        const section = newSection(kind);
        // Insert after the section it belongs next to, keeping a familiar order.
        const order: SectionKind[] = [
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
        const rank = order.indexOf(kind);
        const index = draft.sections.findIndex((existing) => order.indexOf(existing.kind) > rank);
        if (index === -1) draft.sections.push(section);
        else draft.sections.splice(index, 0, section);
      }),

    removeSection: (sectionId) =>
      commit((draft) => {
        draft.sections = draft.sections.filter((section) => section.id !== sectionId);
      }),

    moveSection: (sectionId, direction) =>
      commit((draft) => {
        const index = draft.sections.findIndex((section) => section.id === sectionId);
        if (index === -1) return;
        reorder(draft.sections, index, index + direction);
      }),

    updateSection: (sectionId, patch) =>
      commit(
        (draft) => {
          const section = draft.sections.find((candidate) => candidate.id === sectionId);
          if (!section) return;
          Object.assign(section, patch);
        },
        { coalesceKey: `section:${sectionId}:${Object.keys(patch).join(',')}` },
      ),

    addEntry: (sectionId) =>
      commit((draft) => {
        const section = findEntrySection(draft, sectionId);
        if (!section) return;
        const entry: Entry = {
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
        };
        section.entries.push(entry);
      }),

    updateEntry: (sectionId, entryId, patch) =>
      commit(
        (draft) => {
          const section = findEntrySection(draft, sectionId);
          const entry = section?.entries.find((candidate) => candidate.id === entryId);
          if (!entry) return;
          Object.assign(entry, patch);
        },
        { coalesceKey: `entry:${entryId}:${Object.keys(patch).join(',')}` },
      ),

    removeEntry: (sectionId, entryId) =>
      commit((draft) => {
        const section = findEntrySection(draft, sectionId);
        if (!section) return;
        section.entries = section.entries.filter((entry) => entry.id !== entryId);
      }),

    duplicateEntry: (sectionId, entryId) =>
      commit((draft) => {
        const section = findEntrySection(draft, sectionId);
        const index = section?.entries.findIndex((entry) => entry.id === entryId) ?? -1;
        if (!section || index === -1) return;
        const source = section.entries[index];
        const copy: Entry = {
          ...clone(source),
          id: makeId('ent'),
          bullets: source.bullets.map((bullet) => ({ id: makeId('bul'), text: bullet.text })),
        };
        section.entries.splice(index + 1, 0, copy);
      }),

    moveEntry: (sectionId, entryId, direction) =>
      commit((draft) => {
        const section = findEntrySection(draft, sectionId);
        const index = section?.entries.findIndex((entry) => entry.id === entryId) ?? -1;
        if (!section || index === -1) return;
        reorder(section.entries, index, index + direction);
      }),

    sortEntriesByDate: (sectionId) =>
      commit((draft) => {
        const section = findEntrySection(draft, sectionId);
        if (!section) return;
        section.entries.sort((a, b) => recencyKey(b) - recencyKey(a));
      }),

    addBullet: (sectionId, entryId) =>
      commit((draft) => {
        const section = findEntrySection(draft, sectionId);
        const entry = section?.entries.find((candidate) => candidate.id === entryId);
        if (!entry) return;
        entry.bullets.push({ id: makeId('bul'), text: '' });
      }),

    /** Typing is coalesced, so a whole sentence is a single undo step. */
    updateBullet: (sectionId, entryId, bulletId, text) =>
      commit(
        (draft) => {
          const section = findEntrySection(draft, sectionId);
          const entry = section?.entries.find((candidate) => candidate.id === entryId);
          const bullet = entry?.bullets.find((candidate) => candidate.id === bulletId);
          if (!bullet) return;
          bullet.text = text;
        },
        { coalesceKey: `bullet:${bulletId}` },
      ),

    removeBullet: (sectionId, entryId, bulletId) =>
      commit((draft) => {
        const section = findEntrySection(draft, sectionId);
        const entry = section?.entries.find((candidate) => candidate.id === entryId);
        if (!entry) return;
        entry.bullets = entry.bullets.filter((bullet) => bullet.id !== bulletId);
      }),

    moveBullet: (sectionId, entryId, bulletId, direction) =>
      commit((draft) => {
        const section = findEntrySection(draft, sectionId);
        const entry = section?.entries.find((candidate) => candidate.id === entryId);
        const index = entry?.bullets.findIndex((bullet) => bullet.id === bulletId) ?? -1;
        if (!entry || index === -1) return;
        reorder<Bullet>(entry.bullets, index, index + direction);
      }),

    moveBulletTo: (sectionId, entryId, bulletId, toIndex) =>
      commit((draft) => {
        const section = findEntrySection(draft, sectionId);
        const entry = section?.entries.find((candidate) => candidate.id === entryId);
        const index = entry?.bullets.findIndex((bullet) => bullet.id === bulletId) ?? -1;
        if (!entry || index === -1) return;
        const [moved] = entry.bullets.splice(index, 1);
        const target = Math.max(0, Math.min(entry.bullets.length, toIndex));
        entry.bullets.splice(target, 0, moved);
      }),

    moveEntryTo: (sectionId, entryId, toIndex) =>
      commit((draft) => {
        const section = findEntrySection(draft, sectionId);
        const index = section?.entries.findIndex((entry) => entry.id === entryId) ?? -1;
        if (!section || index === -1) return;
        const [moved] = section.entries.splice(index, 1);
        const target = Math.max(0, Math.min(section.entries.length, toIndex));
        section.entries.splice(target, 0, moved);
      }),

    moveSectionTo: (sectionId, toIndex) =>
      commit((draft) => {
        const index = draft.sections.findIndex((section) => section.id === sectionId);
        if (index === -1) return;
        const [moved] = draft.sections.splice(index, 1);
        const target = Math.max(0, Math.min(draft.sections.length, toIndex));
        draft.sections.splice(target, 0, moved);
      }),

    addSkillKeyword: (keyword) =>
      commit((draft) => {
        const trimmed = keyword.trim();
        if (!trimmed) return;
        let skills = draft.sections.find(
          (section): section is Extract<Section, { kind: 'skills' }> => section.kind === 'skills',
        );
        if (!skills) {
          const created = newSection('skills');
          if (created.kind !== 'skills') return;
          draft.sections.push(created);
          skills = created;
        }
        if (skills.groups.length === 0) {
          skills.groups.push({ id: makeId('grp'), label: '', items: [] });
        }
        const existing = skills.groups.some((group) =>
          group.items.some((item) => item.toLowerCase() === trimmed.toLowerCase()),
        );
        if (existing) return;
        skills.groups[skills.groups.length - 1].items.push(trimmed);
      }),
  };
});

/** Persists the resume and UI state, debounced, with a quota-safe fallback. */
export function startPersistence(): () => void {
  let resumeTimer: number | undefined;
  let uiTimer: number | undefined;

  const unsubscribeResume = useStore.subscribe((state, previous) => {
    if (state.resume === previous.resume) return;
    window.clearTimeout(resumeTimer);
    resumeTimer = window.setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state.resume));
      } catch {
        useStore.getState().notify('warning', 'Autosave failed: browser storage is full or blocked.');
      }
    }, 400);
  });

  const unsubscribeUi = useStore.subscribe((state, previous) => {
    if (state.ui === previous.ui) return;
    window.clearTimeout(uiTimer);
    uiTimer = window.setTimeout(() => {
      try {
        const { tab, previewMode, zoom, fitToWidth, jobDescription, dismissedChecks } = state.ui;
        localStorage.setItem(
          UI_KEY,
          JSON.stringify({ tab, previewMode, zoom, fitToWidth, jobDescription, dismissedChecks }),
        );
      } catch {
        /* UI preferences are not worth interrupting the user over. */
      }
    }, 600);
  });

  return () => {
    unsubscribeResume();
    unsubscribeUi();
    window.clearTimeout(resumeTimer);
    window.clearTimeout(uiTimer);
  };
}
