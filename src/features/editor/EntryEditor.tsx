/**
 * Editor for one entry (a job, degree, project, …).
 *
 * The field set is driven by the section registry, so adding a new section kind
 * never means writing a new form. Dates are free text with a live "reads as"
 * hint: users type `3/2021`, `2021-03` or `Mar 2021`, the parser normalises it,
 * and the hint shows exactly what will be printed.
 */

import { useEffect, useId, useRef, useState } from 'react';
import type { Entry, Section } from '../../domain/types';
import { formatDateValue, parseDateValue } from '../../domain/dates';
import { entryFieldLabels } from '../../domain/sections';
import { useStore } from '../../state/store';
import { useListReorder } from '../../ui/useListReorder';
import { Button, Field, IconButton, TextArea, TextInput } from '../../ui/primitives';
import { ArrowDownIcon, ArrowUpIcon, CopyIcon, GripIcon, PlusIcon, TrashIcon } from '../../ui/icons';

function useAutosize(value: string) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.style.height = 'auto';
    element.style.height = `${Math.min(element.scrollHeight + 2, 420)}px`;
  }, [value]);
  return ref;
}

function DateInput({
  value,
  onChange,
  label,
  describedBy,
}: {
  value: string;
  onChange: (next: string) => void;
  label: string;
  describedBy?: string;
}) {
  const parsed = parseDateValue(value);
  const interpretation = value.trim() && parsed ? formatDateValue(value, 'MMM YYYY') : null;
  return (
    <Field
      label={label}
      hint={value.trim() && !parsed ? 'Free text — printed exactly as typed.' : undefined}
      optional={!value.trim()}
    >
      {({ id }) => (
        <TextInput
          id={id}
          describedBy={describedBy}
          value={value}
          placeholder="Mar 2021"
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => onChange(event.target.value)}
          title={interpretation ? `Prints as ${interpretation}` : undefined}
        />
      )}
    </Field>
  );
}

export function EntryEditor({
  section,
  entry,
  index,
  count,
  dragProps,
}: {
  section: Section;
  entry: Entry;
  index: number;
  count: number;
  dragProps: ReturnType<ReturnType<typeof useListReorder>['itemProps']>;
}) {
  const updateEntry = useStore((state) => state.updateEntry);
  const removeEntry = useStore((state) => state.removeEntry);
  const duplicateEntry = useStore((state) => state.duplicateEntry);
  const moveEntry = useStore((state) => state.moveEntry);
  const focusTarget = useStore((state) => state.ui.focusTarget);

  const [open, setOpen] = useState(() => !entry.title.trim());
  const bodyId = useId();
  const titleRef = useRef<HTMLInputElement>(null);

  // "Show me" links in the analysis panel open the entry and focus its title.
  useEffect(() => {
    if (focusTarget?.entryId === entry.id) {
      setOpen(true);
      window.setTimeout(() => titleRef.current?.focus(), 60);
    }
  }, [focusTarget, entry.id]);

  const kind = section.kind;
  if (kind === 'summary' || kind === 'skills' || kind === 'languages') return null;
  const labels = entryFieldLabels(kind);

  const summary = [entry.title, entry.subtitle].filter(Boolean).join(' · ') || 'Untitled entry';
  const bulletCount = entry.bullets.filter((bullet) => bullet.text.trim()).length;

  return (
    <article className="entry">
      <header className="entry__header">
        <span className="entry__drag" {...dragProps} aria-hidden="true" title="Drag to reorder">
          <GripIcon />
        </span>
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => setOpen((value) => !value)}
          style={{ flex: 1, justifyContent: 'flex-start', minWidth: 0 }}
        >
          <span className="entry__summary">
            <strong>{summary}</strong>
            {bulletCount > 0 ? ` — ${bulletCount} achievement${bulletCount === 1 ? '' : 's'}` : ''}
          </span>
        </button>
        <div className="section-card__tools">
          <IconButton
            label={`Move ${summary} up`}
            onClick={() => moveEntry(section.id, entry.id, -1)}
            disabled={index === 0}
          >
            <ArrowUpIcon />
          </IconButton>
          <IconButton
            label={`Move ${summary} down`}
            onClick={() => moveEntry(section.id, entry.id, 1)}
            disabled={index >= count - 1}
          >
            <ArrowDownIcon />
          </IconButton>
          <IconButton label={`Duplicate ${summary}`} onClick={() => duplicateEntry(section.id, entry.id)}>
            <CopyIcon />
          </IconButton>
          <IconButton label={`Delete ${summary}`} tone="danger" onClick={() => removeEntry(section.id, entry.id)}>
            <TrashIcon />
          </IconButton>
        </div>
      </header>

      <div className="entry__body" id={bodyId} hidden={!open}>
        <div className="grid-2">
          <Field label={labels.title}>
            {({ id }) => (
              <TextInput
                id={id}
                ref={titleRef}
                value={entry.title}
                placeholder={labels.titlePlaceholder}
                onChange={(event) => updateEntry(section.id, entry.id, { title: event.target.value })}
              />
            )}
          </Field>
          <Field label={labels.subtitle}>
            {({ id }) => (
              <TextInput
                id={id}
                value={entry.subtitle}
                placeholder={labels.subtitlePlaceholder}
                onChange={(event) => updateEntry(section.id, entry.id, { subtitle: event.target.value })}
              />
            )}
          </Field>
        </div>

        {labels.showDates ? (
          <div className="grid-3">
            <DateInput
              label="Start"
              value={entry.start}
              onChange={(next) => updateEntry(section.id, entry.id, { start: next })}
            />
            <DateInput
              label="End"
              value={entry.end}
              onChange={(next) => updateEntry(section.id, entry.id, { end: next })}
            />
            {labels.showCurrent ? (
              <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={entry.current}
                    onChange={(event) =>
                      updateEntry(section.id, entry.id, {
                        current: event.target.checked,
                        end: event.target.checked ? '' : entry.end,
                      })
                    }
                  />
                  <span>Current role</span>
                </label>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="grid-2">
          {labels.showLocation ? (
            <Field label="Location" optional>
              {({ id }) => (
                <TextInput
                  id={id}
                  value={entry.location}
                  placeholder="Seattle, WA"
                  onChange={(event) => updateEntry(section.id, entry.id, { location: event.target.value })}
                />
              )}
            </Field>
          ) : null}
          {labels.showUrl ? (
            <Field label={labels.urlLabel} optional hint="Becomes a clickable link in the PDF.">
              {({ id }) => (
                <TextInput
                  id={id}
                  value={entry.url}
                  placeholder={labels.urlPlaceholder}
                  inputMode="url"
                  onChange={(event) => updateEntry(section.id, entry.id, { url: event.target.value })}
                />
              )}
            </Field>
          ) : null}
        </div>

        <Field label={labels.description} optional>
          {({ id }) => (
            <TextArea
              id={id}
              value={entry.description}
              placeholder={labels.descriptionPlaceholder}
              rows={2}
              onChange={(event) => updateEntry(section.id, entry.id, { description: event.target.value })}
            />
          )}
        </Field>

        <BulletList section={section} entry={entry} label={labels.bullets} placeholder={labels.bulletPlaceholder} />

        {labels.tags ? (
          <Field label={labels.tags} optional hint="Separate with commas.">
            {({ id }) => (
              <TextInput
                id={id}
                value={entry.tags.join(', ')}
                placeholder={labels.tagsPlaceholder}
                onChange={(event) =>
                  updateEntry(section.id, entry.id, {
                    tags: event.target.value
                      .split(',')
                      .map((tag) => tag.trim())
                      .filter(Boolean),
                  })
                }
              />
            )}
          </Field>
        ) : null}

        {labels.extra ? (
          <Field label={labels.extra} optional>
            {({ id }) => (
              <TextInput
                id={id}
                value={entry.extra}
                placeholder={labels.extraPlaceholder}
                onChange={(event) => updateEntry(section.id, entry.id, { extra: event.target.value })}
              />
            )}
          </Field>
        ) : null}
      </div>
    </article>
  );
}

function BulletList({
  section,
  entry,
  label,
  placeholder,
}: {
  section: Section;
  entry: Entry;
  label: string;
  placeholder: string;
}) {
  const addBullet = useStore((state) => state.addBullet);
  const updateBullet = useStore((state) => state.updateBullet);
  const removeBullet = useStore((state) => state.removeBullet);
  const moveBullet = useStore((state) => state.moveBullet);
  const moveBulletTo = useStore((state) => state.moveBulletTo);

  const { itemProps } = useListReorder(entry.bullets.length, (from, to) => {
    const bullet = entry.bullets[from];
    if (bullet) moveBulletTo(section.id, entry.id, bullet.id, to);
  });

  return (
    <div className="field">
      <span className="field__label" id={`${entry.id}-bullets-label`}>
        {label}
        <span className="field__optional">
          {entry.bullets.length > 0 ? `${entry.bullets.length}` : 'optional'}
        </span>
      </span>
      <div className="bullets" role="group" aria-labelledby={`${entry.id}-bullets-label`}>
        {entry.bullets.map((bullet, index) => (
          <BulletRow
            key={bullet.id}
            bulletId={bullet.id}
            text={bullet.text}
            index={index}
            count={entry.bullets.length}
            placeholder={placeholder}
            dragProps={itemProps(index)}
            onChange={(text) => updateBullet(section.id, entry.id, bullet.id, text)}
            onRemove={() => removeBullet(section.id, entry.id, bullet.id)}
            onMove={(direction) => moveBullet(section.id, entry.id, bullet.id, direction)}
          />
        ))}
      </div>
      <div className="row">
        <Button
          size="sm"
          icon={<PlusIcon />}
          onClick={() => addBullet(section.id, entry.id)}
          title="Add an achievement bullet"
        >
          Add achievement
        </Button>
      </div>
    </div>
  );
}

function BulletRow({
  bulletId,
  text,
  index,
  count,
  placeholder,
  dragProps,
  onChange,
  onRemove,
  onMove,
}: {
  bulletId: string;
  text: string;
  index: number;
  count: number;
  placeholder: string;
  dragProps: ReturnType<ReturnType<typeof useListReorder>['itemProps']>;
  onChange: (next: string) => void;
  onRemove: () => void;
  onMove: (direction: -1 | 1) => void;
}) {
  const ref = useAutosize(text);
  const tooLong = text.trim().length > 320;

  return (
    <div className="bullet" {...dragProps} data-bullet={bulletId}>
      <span className="bullet__grip" aria-hidden="true" title="Drag to reorder">
        <GripIcon size={14} />
      </span>
      <div className="bullet__field">
        <TextArea
          ref={ref}
          value={text}
          placeholder={placeholder}
          rows={1}
          aria-label={`Achievement ${index + 1}`}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            // Ctrl/Cmd+Shift+Arrow moves the bullet without a pointer.
            if ((event.ctrlKey || event.metaKey) && event.shiftKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
              event.preventDefault();
              onMove(event.key === 'ArrowUp' ? -1 : 1);
            }
            if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
              event.preventDefault();
              onRemove();
            }
          }}
        />
      </div>
      <span className={`bullet__count${tooLong ? ' bullet__count--long' : ''}`} title={`${text.trim().length} characters`}>
        {text.trim().length}
      </span>
      <span className="bullet__tools">
        <IconButton label={`Move achievement ${index + 1} up`} onClick={() => onMove(-1)} disabled={index === 0}>
          <ArrowUpIcon size={14} />
        </IconButton>
        <IconButton
          label={`Move achievement ${index + 1} down`}
          onClick={() => onMove(1)}
          disabled={index >= count - 1}
        >
          <ArrowDownIcon size={14} />
        </IconButton>
        <IconButton label={`Remove achievement ${index + 1}`} tone="danger" onClick={onRemove}>
          <TrashIcon size={14} />
        </IconButton>
      </span>
    </div>
  );
}
