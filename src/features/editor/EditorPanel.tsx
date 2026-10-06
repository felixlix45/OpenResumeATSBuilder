/**
 * The editing pane.
 *
 * Order of work mirrors how people actually write a resume: contact details,
 * then the sections in the order they will be read. Everything here edits the
 * document directly — there is no separate "save" step, and undo covers every
 * change.
 */

import { useEffect, useRef, useState } from 'react';
import { ADDABLE_SECTION_KINDS, SECTION_REGISTRY, isSectionKindExhausted } from '../../domain/sections';
import { useStore } from '../../state/store';
import { useListReorder } from '../../ui/useListReorder';
import { Button, Field, IconButton, TextInput } from '../../ui/primitives';
import { PlusIcon, TrashIcon } from '../../ui/icons';
import { SectionCard } from './SectionCard';

export function EditorPanel() {
  const resume = useStore((state) => state.resume);
  const moveSectionTo = useStore((state) => state.moveSectionTo);
  const loadWarnings = useStore((state) => state.loadWarnings);
  const notify = useStore((state) => state.notify);
  const focusTarget = useStore((state) => state.ui.focusTarget);
  const isSample = useStore((state) => state.isSample);
  const resetToBlank = useStore((state) => state.resetToBlank);

  const [showAdd, setShowAdd] = useState(false);
  const basicsRef = useRef<HTMLDivElement>(null);

  const { itemProps } = useListReorder(resume.sections.length, (from, to) => {
    const section = resume.sections[from];
    if (section) moveSectionTo(section.id, to);
  });

  useEffect(() => {
    if (focusTarget?.field?.startsWith('basics.')) {
      basicsRef.current
        ?.querySelector<HTMLElement>(`[data-field="${focusTarget.field}"] input`)
        ?.focus();
    }
  }, [focusTarget]);

  useEffect(() => {
    if (loadWarnings.length > 0) notify('warning', loadWarnings[0]);
    // Only announce once per load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="pane__scroll">
      <div className="editor">
          {isSample ? (
            <div className="card" role="status" style={{ borderColor: 'var(--color-accent)' }}>
              <div className="card__body row row--between">
                <div style={{ flex: 1, minWidth: 220 }}>
                  <strong>This is a worked sample, not your resume.</strong>
                  <p className="field__hint">
                    Replace the details with your own, or start from a blank document. The sample is here so you can see
                    what a finished file looks like — including how the checks behave.
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    if (window.confirm('Clear everything and start from a blank resume?')) resetToBlank();
                  }}
                >
                  Start blank
                </Button>
              </div>
            </div>
          ) : null}

          {loadWarnings.length > 0 ? (
            <div className="error-box" role="status">
              <strong>Some saved details needed repairing.</strong>
              <ul className="hint-list" style={{ marginTop: 'var(--space-2)' }}>
                {loadWarnings.map((warning, index) => (
                  <li key={index}>{warning}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div ref={basicsRef}>
            <BasicsForm />
          </div>

          {resume.sections.map((section, index) => (
            <SectionCard
              key={section.id}
              section={section}
              index={index}
              count={resume.sections.length}
              dragProps={itemProps(index)}
            />
          ))}

          <div className="section-add">
            <div className="row row--between">
              <strong>Add a section</strong>
              <Button
                size="sm"
                variant={showAdd ? 'default' : 'primary'}
                icon={<PlusIcon />}
                aria-expanded={showAdd}
                onClick={() => setShowAdd((value) => !value)}
              >
                {showAdd ? 'Close' : 'Choose a section'}
              </Button>
            </div>
            {showAdd ? (
              <div className="section-add__grid">
                {ADDABLE_SECTION_KINDS.map((kind) => {
                  const descriptor = SECTION_REGISTRY[kind];
                  const exhausted = isSectionKindExhausted(kind, resume.sections);
                  return (
                    <button
                      key={kind}
                      type="button"
                      className="section-add__item"
                      disabled={exhausted}
                      title={exhausted ? 'This section already exists' : descriptor.blurb}
                      onClick={() => {
                        useStore.getState().addSection(kind);
                        setShowAdd(false);
                      }}
                    >
                      <strong>{descriptor.defaultHeading}</strong>
                      <span>{exhausted ? 'Already added' : descriptor.blurb}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="field__hint">
                Most resumes need only Summary, Experience, Education and Skills. Extra sections dilute the ones that
                matter.
              </p>
            )}
          </div>
        </div>
      </div>
  );
}

function BasicsForm() {
  const basics = useStore((state) => state.resume.basics);
  const updateBasics = useStore((state) => state.updateBasics);
  const edit = useStore((state) => state.edit);

  return (
    <section className="card" aria-labelledby="basics-title">
      <header className="card__header">
        <h2 className="card__title" id="basics-title">
          Contact details
        </h2>
        <span className="field__hint">Printed at the top of page one</span>
      </header>
      <div className="card__body stack">
        <div className="grid-2">
          <div data-field="basics.fullName">
            <Field label="Full name" hint="Exactly as it should appear on an offer.">
              {({ id }) => (
                <TextInput
                  id={id}
                  value={basics.fullName}
                  autoComplete="name"
                  placeholder="Alex Morgan"
                  onChange={(event) => updateBasics({ fullName: event.target.value })}
                />
              )}
            </Field>
          </div>
          <div data-field="basics.headline">
            <Field label="Target job title" hint="Mirror the title in the posting where it is accurate.">
              {({ id }) => (
                <TextInput
                  id={id}
                  value={basics.headline}
                  placeholder="Senior Backend Engineer"
                  onChange={(event) => updateBasics({ headline: event.target.value })}
                />
              )}
            </Field>
          </div>
        </div>

        <div className="grid-3">
          <div data-field="basics.email">
            <Field label="Email">
              {({ id }) => (
                <TextInput
                  id={id}
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={basics.email}
                  placeholder="alex.morgan@example.com"
                  onChange={(event) => updateBasics({ email: event.target.value })}
                />
              )}
            </Field>
          </div>
          <div data-field="basics.phone">
            <Field label="Phone">
              {({ id }) => (
                <TextInput
                  id={id}
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={basics.phone}
                  placeholder="+1 (206) 555-0142"
                  onChange={(event) => updateBasics({ phone: event.target.value })}
                />
              )}
            </Field>
          </div>
          <div data-field="basics.location">
            <Field label="Location" hint="City and region only — no street address.">
              {({ id }) => (
                <TextInput
                  id={id}
                  value={basics.location}
                  placeholder="Seattle, WA"
                  onChange={(event) => updateBasics({ location: event.target.value })}
                />
              )}
            </Field>
          </div>
        </div>

        <div className="stack stack--tight">
          <span className="field__label">Links</span>
          {basics.links.map((link) => (
            <div className="grid-2" key={link.id} style={{ alignItems: 'end' }}>
              <Field label="Label">
                {({ id }) => (
                  <TextInput
                    id={id}
                    value={link.label}
                    placeholder="LinkedIn"
                    onChange={(event) =>
                      edit((draft) => {
                        const target = draft.basics.links.find((candidate) => candidate.id === link.id);
                        if (target) target.label = event.target.value;
                      })
                    }
                  />
                )}
              </Field>
              <div className="row" style={{ alignItems: 'flex-end' }}>
                <div style={{ flex: 1, minWidth: 160 }}>
                  <Field label="URL" hint="Becomes a clickable link — and its text is searchable.">
                    {({ id }) => (
                      <TextInput
                        id={id}
                        value={link.url}
                        inputMode="url"
                        placeholder="https://linkedin.com/in/you"
                        onChange={(event) =>
                          edit((draft) => {
                            const target = draft.basics.links.find((candidate) => candidate.id === link.id);
                            if (target) target.url = event.target.value;
                          })
                        }
                      />
                    )}
                  </Field>
                </div>
                <IconButton
                  label={`Remove ${link.label || 'link'}`}
                  tone="danger"
                  onClick={() =>
                    edit((draft) => {
                      draft.basics.links = draft.basics.links.filter((candidate) => candidate.id !== link.id);
                    })
                  }
                >
                  <TrashIcon />
                </IconButton>
              </div>
            </div>
          ))}
          <div className="row">
            <Button
              size="sm"
              icon={<PlusIcon />}
              onClick={() =>
                edit((draft) => {
                  draft.basics.links.push({ id: crypto.randomUUID(), label: '', url: '' });
                })
              }
            >
              Add link
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
