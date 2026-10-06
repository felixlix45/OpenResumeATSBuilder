/**
 * One section in the editor.
 *
 * Section behaviour is driven by the registry in `domain/sections.ts`, so the
 * three special shapes (free text, keyword groups, language pairs) are handled
 * here once and every entry-based kind shares a single implementation.
 */

import { useEffect, useRef, useState } from 'react';
import { isEntrySection, isLanguagesSection, isSkillsSection, isSummarySection } from '../../domain/types';
import type { Section } from '../../domain/types';
import { SECTION_REGISTRY } from '../../domain/sections';
import { useStore } from '../../state/store';
import { Button, Field, IconButton, TextArea, TextInput } from '../../ui/primitives';
import {
  ArrowDownIcon,
  ArrowUpIcon,
  EyeIcon,
  EyeOffIcon,
  GripIcon,
  PlusIcon,
  TrashIcon,
} from '../../ui/icons';
import { EntryEditor } from './EntryEditor';
import { useListReorder } from '../../ui/useListReorder';

export function SectionCard({
  section,
  index,
  count,
  dragProps,
}: {
  section: Section;
  index: number;
  count: number;
  dragProps: ReturnType<ReturnType<typeof useListReorder>['itemProps']>;
}) {
  const updateSection = useStore((state) => state.updateSection);
  const removeSection = useStore((state) => state.removeSection);
  const moveSection = useStore((state) => state.moveSection);
  const addEntry = useStore((state) => state.addEntry);
  const focusTarget = useStore((state) => state.ui.focusTarget);

  const [collapsed, setCollapsed] = useState(false);
  const headingRef = useRef<HTMLInputElement>(null);
  const descriptor = SECTION_REGISTRY[section.kind];

  useEffect(() => {
    if (focusTarget?.sectionId === section.id && !focusTarget.entryId) {
      setCollapsed(false);
      window.setTimeout(() => headingRef.current?.focus(), 60);
    }
  }, [focusTarget, section.id]);

  const bodyId = `section-body-${section.id}`;
  const entryCount = isEntrySection(section) ? section.entries.length : 0;

  return (
    <section
      className="card section-card"
      data-hidden={!section.visible}
      data-dimmed={!section.visible}
      aria-labelledby={`section-title-${section.id}`}
    >
      <header className="section-card__heading">
        <span className="entry__drag" {...dragProps} aria-hidden="true" title="Drag to reorder sections">
          <GripIcon />
        </span>
        <div className="section-card__name">
          <label className="sr-only" htmlFor={`section-title-${section.id}`}>
            Section heading
          </label>
          <TextInput
            id={`section-title-${section.id}`}
            ref={headingRef}
            value={section.heading}
            placeholder={descriptor.defaultHeading}
            onChange={(event) => updateSection(section.id, { heading: event.target.value })}
          />
        </div>
        <Button
          size="sm"
          variant="ghost"
          aria-expanded={!collapsed}
          aria-controls={bodyId}
          onClick={() => setCollapsed((value) => !value)}
        >
          {collapsed ? 'Expand' : 'Collapse'}
        </Button>
        <div className="section-card__tools">
          <IconButton
            label={section.visible ? `Hide ${section.heading}` : `Show ${section.heading}`}
            onClick={() => updateSection(section.id, { visible: !section.visible })}
          >
            {section.visible ? <EyeIcon /> : <EyeOffIcon />}
          </IconButton>
          <IconButton
            label={`Move ${section.heading} up`}
            onClick={() => moveSection(section.id, -1)}
            disabled={index === 0}
          >
            <ArrowUpIcon />
          </IconButton>
          <IconButton
            label={`Move ${section.heading} down`}
            onClick={() => moveSection(section.id, 1)}
            disabled={index >= count - 1}
          >
            <ArrowDownIcon />
          </IconButton>
          <IconButton
            label={`Delete ${section.heading}`}
            tone="danger"
            onClick={() => {
              if (window.confirm(`Delete the "${section.heading}" section and everything in it?`)) {
                removeSection(section.id);
              }
            }}
          >
            <TrashIcon />
          </IconButton>
        </div>
      </header>

      <div className="card__body stack" id={bodyId} hidden={collapsed}>
        <SectionBody section={section} />

        {isEntrySection(section) ? (
          <>
            <div className="row">
              <Button size="sm" icon={<PlusIcon />} onClick={() => addEntry(section.id)}>
                Add {entryNoun(section.kind)}
              </Button>
            </div>
            {entryCount === 0 ? (
              <p className="empty-state">
                No {entryNoun(section.kind)} yet. Most recent first reads best — and parsers expect it.
              </p>
            ) : null}
          </>
        ) : null}
      </div>
    </section>
  );
}

function entryNoun(kind: Section['kind']): string {
  switch (kind) {
    case 'experience':
      return 'role';
    case 'education':
      return 'qualification';
    case 'projects':
      return 'project';
    case 'certifications':
      return 'certification';
    case 'awards':
      return 'award';
    case 'publications':
      return 'publication';
    case 'volunteer':
      return 'role';
    default:
      return 'entry';
  }
}

function SectionBody({ section }: { section: Section }) {
  const updateSection = useStore((state) => state.updateSection);
  const moveEntryTo = useStore((state) => state.moveEntryTo);

  const { itemProps } = useListReorder(
    isEntrySection(section) ? section.entries.length : 0,
    (from, to) => {
      if (!isEntrySection(section)) return;
      const entry = section.entries[from];
      if (entry) moveEntryTo(section.id, entry.id, to);
    },
  );

  if (isSummarySection(section)) {
    return (
      <Field
        label="Summary"
        hint="Two to four lines. Lead with your scale and your strongest measured result."
      >
        {({ id }) => (
          <TextArea
            id={id}
            value={section.text}
            rows={4}
            placeholder="Senior backend engineer with 8 years building high-throughput payments platforms…"
            onChange={(event) => updateSection(section.id, { text: event.target.value })}
          />
        )}
      </Field>
    );
  }

  if (isSkillsSection(section)) return <SkillsBody section={section} />;
  if (isLanguagesSection(section)) return <LanguagesBody section={section} />;

  return (
    <>
      {section.entries.map((entry, entryIndex) => (
        <EntryEditor
          key={entry.id}
          section={section}
          entry={entry}
          index={entryIndex}
          count={section.entries.length}
          dragProps={itemProps(entryIndex)}
        />
      ))}
    </>
  );
}

function SkillsBody({ section }: { section: Extract<Section, { kind: 'skills' }> }) {
  const updateSection = useStore((state) => state.updateSection);
  const moveSection = useStore((state) => state.moveSection);
  void moveSection;

  const updateGroup = (groupId: string, patch: Partial<{ label: string; items: string[] }>) => {
    updateSection(section.id, {
      groups: section.groups.map((group) => (group.id === groupId ? { ...group, ...patch } : group)),
    });
  };

  return (
    <div className="stack stack--tight">
      <p className="field__hint">
        Keyword screens read this section first. Use concrete, named skills — “PostgreSQL”, not “databases”.
      </p>
      {section.groups.map((group, index) => (
        <div className="field-row" key={group.id}>
          <Field label={`Group ${index + 1} label`} optional>
            {({ id }) => (
              <TextInput
                id={id}
                value={group.label}
                placeholder="Languages"
                onChange={(event) => updateGroup(group.id, { label: event.target.value })}
              />
            )}
          </Field>
          <Field label="Skills (comma separated)">
            {({ id }) => (
              <TextInput
                id={id}
                value={group.items.join(', ')}
                placeholder="TypeScript, Go, PostgreSQL"
                onChange={(event) =>
                  updateGroup(group.id, {
                    items: event.target.value
                      .split(',')
                      .map((item) => item.trim())
                      .filter(Boolean),
                  })
                }
              />
            )}
          </Field>
          <IconButton
            label={`Remove group ${index + 1}`}
            tone="danger"
            onClick={() =>
              updateSection(section.id, { groups: section.groups.filter((candidate) => candidate.id !== group.id) })
            }
            disabled={section.groups.length <= 1}
          >
            <TrashIcon />
          </IconButton>
        </div>
      ))}
      <div className="row">
        <Button
          size="sm"
          icon={<PlusIcon />}
          onClick={() =>
            updateSection(section.id, {
              groups: [...section.groups, { id: crypto.randomUUID(), label: '', items: [] }],
            })
          }
        >
          Add group
        </Button>
      </div>
    </div>
  );
}

function LanguagesBody({ section }: { section: Extract<Section, { kind: 'languages' }> }) {
  const updateSection = useStore((state) => state.updateSection);

  const updateItem = (itemId: string, patch: Partial<{ name: string; level: string }>) => {
    updateSection(section.id, {
      items: section.items.map((item) => (item.id === itemId ? { ...item, ...patch } : item)),
    });
  };

  return (
    <div className="stack stack--tight">
      {section.items.map((item, index) => (
        <div className="field-row" key={item.id}>
          <Field label={`Language ${index + 1}`}>
            {({ id }) => (
              <TextInput
                id={id}
                value={item.name}
                placeholder="Spanish"
                onChange={(event) => updateItem(item.id, { name: event.target.value })}
              />
            )}
          </Field>
          <Field label="Level" optional>
            {({ id }) => (
              <TextInput
                id={id}
                value={item.level}
                placeholder="Professional working proficiency"
                onChange={(event) => updateItem(item.id, { level: event.target.value })}
              />
            )}
          </Field>
          <IconButton
            label={`Remove language ${index + 1}`}
            tone="danger"
            disabled={section.items.length <= 1}
            onClick={() => updateSection(section.id, { items: section.items.filter((c) => c.id !== item.id) })}
          >
            <TrashIcon />
          </IconButton>
        </div>
      ))}
      <div className="row">
        <Button
          size="sm"
          icon={<PlusIcon />}
          onClick={() =>
            updateSection(section.id, { items: [...section.items, { id: crypto.randomUUID(), name: '', level: '' }] })
          }
        >
          Add language
        </Button>
      </div>
    </div>
  );
}
