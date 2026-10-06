/**
 * Design and document settings.
 *
 * Every control here changes the PDF that gets downloaded — there is no separate
 * "export style". Options that measurably hurt parsing are labelled as such
 * rather than hidden, because the user is allowed to choose and deserves to know
 * what the choice costs.
 */

import { useMemo, useRef, useState } from 'react';
import { TEMPLATES } from '../../domain/templates';
import { createEmptyResume, createSampleResume } from '../../domain/defaults';
import { findUnsupportedCharacters } from '../../domain/encoding';
import { normalizeResume } from '../../domain/normalize';
import { resumeToPlainText } from '../../domain/text';
import type { DateFormat, FontFamily, LinkDisplay, PageSize, TemplateId } from '../../domain/types';
import { useStore } from '../../state/store';
import { Button, Field, Select, Switch, TextInput } from '../../ui/primitives';
import { DownloadIcon, KeyboardIcon, RefreshIcon, UploadIcon, WarningShieldIcon } from '../../ui/icons';
import { Modal } from '../../ui/primitives';

const ACCENTS = ['#0F4C81', '#2354D6', '#1F6F5C', '#7A2E4A', '#8A5300', '#3F3F46', '#4C1D95', '#0E7490'];

const FONT_OPTIONS: Array<{ value: FontFamily; label: string }> = [
  { value: 'Helvetica', label: 'Helvetica — sans serif (safest)' },
  { value: 'Times-Roman', label: 'Times — serif' },
  { value: 'Courier', label: 'Courier — monospace' },
];

export function DesignPanel() {
  const settings = useStore((state) => state.resume.settings);
  const meta = useStore((state) => state.resume.meta);
  const resume = useStore((state) => state.resume);
  const updateSettings = useStore((state) => state.updateSettings);
  const updateMeta = useStore((state) => state.updateMeta);
  const replaceResume = useStore((state) => state.replaceResume);
  const notify = useStore((state) => state.notify);

  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const unsupported = useMemo(() => findUnsupportedCharacters(resume), [resume]);

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(resume, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${(resume.basics.fullName || 'resume').replace(/\s+/g, '-').toLowerCase()}.resume.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    notify('success', 'Saved a JSON copy. Keep it to restore or move this resume later.');
  };

  const importJson = async (file: File) => {
    try {
      const text = await file.text();
      const { data, warnings } = normalizeResume(JSON.parse(text));
      replaceResume(data, { warnings });
      notify(
        warnings.length > 0 ? 'warning' : 'success',
        warnings.length > 0 ? `Loaded with ${warnings.length} repair note(s).` : 'Resume loaded.',
      );
    } catch {
      notify('danger', 'That file could not be read as a resume.');
    }
  };

  return (
    <>
      <div className="pane__scroll">
      <div className="analysis">
          <section className="card" aria-labelledby="template-title">
            <header className="card__header">
              <h2 className="card__title" id="template-title">
                Template
              </h2>
              <span className="field__hint">All four are single-column and parser-tested</span>
            </header>
            <div className="card__body">
              <div className="section-add__grid">
                {TEMPLATES.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    className="section-add__item"
                    aria-pressed={settings.templateId === template.id}
                    style={
                      settings.templateId === template.id
                        ? { borderColor: 'var(--color-accent)', boxShadow: '0 0 0 2px var(--color-accent-soft)' }
                        : undefined
                    }
                    onClick={() => updateSettings({ templateId: template.id as TemplateId })}
                  >
                    <strong>{template.name}</strong>
                    <span>{template.description}</span>
                    <span style={{ marginTop: 4 }}>{template.bestFor}</span>
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="card" aria-labelledby="typography-title">
            <header className="card__header">
              <h2 className="card__title" id="typography-title">
                Type and colour
              </h2>
            </header>
            <div className="card__body stack">
              <Field
                label="Font"
                hint="The standard PDF fonts need no embedding, so no extractor has to guess an encoding."
              >
                {({ id }) => (
                  <Select
                    id={id}
                    value={settings.fontFamily}
                    options={FONT_OPTIONS}
                    onChange={(event) => updateSettings({ fontFamily: event.target.value as FontFamily })}
                  />
                )}
              </Field>

              <div>
                <span className="field__label">Accent colour</span>
                <div className="color-swatches" style={{ marginTop: 'var(--space-2)' }}>
                  {ACCENTS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className="color-swatch"
                      style={{ background: color }}
                      aria-label={`Accent colour ${color}`}
                      aria-pressed={settings.accentColor.toUpperCase() === color.toUpperCase()}
                      onClick={() => updateSettings({ accentColor: color })}
                    />
                  ))}
                  <label className="color-swatch" style={{ background: settings.accentColor, cursor: 'pointer' }}>
                    <span className="sr-only">Custom accent colour</span>
                    <input
                      type="color"
                      value={settings.accentColor}
                      onChange={(event) => updateSettings({ accentColor: event.target.value.toUpperCase() })}
                      style={{ opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }}
                    />
                  </label>
                </div>
                <p className="field__hint" style={{ marginTop: 'var(--space-2)' }}>
                  Headings print in this colour, so the analysis checks it reaches 4.5:1 against white.
                </p>
              </div>

              <div className="grid-2">
                <Field label={`Text size — ${Math.round(settings.fontScale * 100)}%`}>
                  {({ id }) => (
                    <input
                      id={id}
                      type="range"
                      min={0.85}
                      max={1.25}
                      step={0.01}
                      value={settings.fontScale}
                      onChange={(event) => updateSettings({ fontScale: Number(event.target.value) })}
                      style={{ width: '100%', minHeight: 'var(--target-min)' }}
                    />
                  )}
                </Field>
                <Field label={`Line spacing — ${settings.lineHeight.toFixed(2)}`}>
                  {({ id }) => (
                    <input
                      id={id}
                      type="range"
                      min={1.05}
                      max={1.7}
                      step={0.01}
                      value={settings.lineHeight}
                      onChange={(event) => updateSettings({ lineHeight: Number(event.target.value) })}
                      style={{ width: '100%', minHeight: 'var(--target-min)' }}
                    />
                  )}
                </Field>
              </div>
            </div>
          </section>

          <section className="card" aria-labelledby="page-title">
            <header className="card__header">
              <h2 className="card__title" id="page-title">
                Page and layout
              </h2>
            </header>
            <div className="card__body stack">
              <div className="grid-3">
                <Field label="Paper size">
                  {({ id }) => (
                    <Select
                      id={id}
                      value={settings.pageSize}
                      options={[
                        { value: 'LETTER', label: 'US Letter (8.5 × 11 in)' },
                        { value: 'A4', label: 'A4 (210 × 297 mm)' },
                      ]}
                      onChange={(event) => updateSettings({ pageSize: event.target.value as PageSize })}
                    />
                  )}
                </Field>
                <Field label={`Margin — ${settings.margin.toFixed(2)} in`}>
                  {({ id }) => (
                    <input
                      id={id}
                      type="range"
                      min={0.35}
                      max={1.1}
                      step={0.05}
                      value={settings.margin}
                      onChange={(event) => updateSettings({ margin: Number(event.target.value) })}
                      style={{ width: '100%', minHeight: 'var(--target-min)' }}
                    />
                  )}
                </Field>
                <Field label={`Section spacing — ${settings.sectionSpacing} pt`}>
                  {({ id }) => (
                    <input
                      id={id}
                      type="range"
                      min={4}
                      max={28}
                      step={1}
                      value={settings.sectionSpacing}
                      onChange={(event) => updateSettings({ sectionSpacing: Number(event.target.value) })}
                      style={{ width: '100%', minHeight: 'var(--target-min)' }}
                    />
                  )}
                </Field>
              </div>

              <div className="grid-2">
                <Field
                  label="Date format"
                  hint={settings.dateFormat === 'MM/YYYY' || settings.dateFormat === 'YYYY'
                    ? 'Numeric and year-only dates can silently score zero months of experience in some parsers. Spelled months are safer.'
                    : 'Spelled months are the format parsers handle most reliably.'}
                >
                  {({ id }) => (
                    <Select
                      id={id}
                      value={settings.dateFormat}
                      options={[
                        { value: 'MMM YYYY', label: 'Mar 2021 (recommended)' },
                        { value: 'MMMM YYYY', label: 'March 2021' },
                        { value: 'MM/YYYY', label: '03/2021' },
                        { value: 'YYYY', label: '2021' },
                      ]}
                      onChange={(event) => updateSettings({ dateFormat: event.target.value as DateFormat })}
                    />
                  )}
                </Field>
                <Field label="Bullet character">
                  {({ id }) => (
                    <Select
                      id={id}
                      value={settings.bulletChar}
                      options={[
                        { value: '\u2022', label: '• round bullet (recommended)' },
                        { value: '\u2013', label: '– en dash' },
                        { value: '-', label: '- hyphen' },
                        { value: '\u00b7', label: '· middle dot' },
                      ]}
                      onChange={(event) => updateSettings({ bulletChar: event.target.value })}
                    />
                  )}
                </Field>
              </div>

              <div className="grid-2">
                <Field label="Contact links show">
                  {({ id }) => (
                    <Select
                      id={id}
                      value={settings.linkDisplay}
                      options={[
                        { value: 'url', label: 'The address (linkedin.com/in/you) — searchable' },
                        { value: 'label', label: 'The label (LinkedIn) — prettier' },
                      ]}
                      onChange={(event) => updateSettings({ linkDisplay: event.target.value as LinkDisplay })}
                    />
                  )}
                </Field>
                <div className="stack stack--tight" style={{ justifyContent: 'flex-end' }}>
                  <Switch
                    label="Uppercase section headings"
                    checked={settings.uppercaseHeadings}
                    onChange={(value) => updateSettings({ uppercaseHeadings: value })}
                  />
                  <Switch
                    label="Rule under each heading"
                    checked={settings.headingRule}
                    onChange={(value) => updateSettings({ headingRule: value })}
                  />
                  <Switch
                    label="Page numbers in the footer"
                    checked={settings.showPageNumbers}
                    onChange={(value) => updateSettings({ showPageNumbers: value })}
                  />
                </div>
              </div>
              {settings.showPageNumbers ? (
                <p className="field__hint">
                  A repeating footer is legitimate, but some extractors append it to the last bullet on the page. Leave
                  it off for a one-page resume.
                </p>
              ) : null}
            </div>
          </section>

          {unsupported.length > 0 ? (
            <section className="card" aria-labelledby="chars-title">
              <header className="card__header">
                <WarningShieldIcon />
                <h2 className="card__title" id="chars-title">
                  Characters the PDF fonts cannot print
                </h2>
              </header>
              <div className="card__body">
                <p className="field__hint">
                  The standard PDF fonts cover Latin text only. These characters would be dropped, so they are listed
                  here instead — replace them with plain equivalents where the meaning allows.
                </p>
                <div className="chips" style={{ marginTop: 'var(--space-2)' }}>
                  {unsupported.map((item) => (
                    <span key={item.character} className="chip chip--miss" title={`${item.codePoint}, ${item.count} occurrence(s)`}>
                      {item.character} · {item.codePoint} · ×{item.count}
                    </span>
                  ))}
                </div>
              </div>
            </section>
          ) : null}

          <section className="card" aria-labelledby="meta-title">
            <header className="card__header">
              <h2 className="card__title" id="meta-title">
                Document properties
              </h2>
            </header>
            <div className="card__body stack">
              <div className="grid-2">
                <Field label="PDF title">
                  {({ id }) => (
                    <TextInput id={id} value={meta.title} onChange={(event) => updateMeta({ title: event.target.value })} />
                  )}
                </Field>
                <Field label="PDF author">
                  {({ id }) => (
                    <TextInput id={id} value={meta.author} onChange={(event) => updateMeta({ author: event.target.value })} />
                  )}
                </Field>
              </div>
              <Field label="Keywords" hint="Stored in the file's metadata; some systems index them." optional>
                {({ id }) => (
                  <TextInput
                    id={id}
                    value={meta.keywords}
                    placeholder="backend engineer, Go, PostgreSQL"
                    onChange={(event) => updateMeta({ keywords: event.target.value })}
                  />
                )}
              </Field>
            </div>
          </section>

          <section className="card" aria-labelledby="data-title">
            <header className="card__header">
              <h2 className="card__title" id="data-title">
                Your data
              </h2>
            </header>
            <div className="card__body stack">
              <p className="field__hint">
                Everything lives in this browser tab and its local storage. Nothing is uploaded, and there is no
                account. Export a JSON copy if you want a backup or want to move to another machine.
              </p>
              <div className="row">
                <Button icon={<DownloadIcon />} onClick={exportJson}>
                  Export JSON
                </Button>
                <Button icon={<UploadIcon />} onClick={() => fileRef.current?.click()}>
                  Import JSON
                </Button>
                <Button
                  icon={<DownloadIcon />}
                  onClick={() => {
                    void navigator.clipboard
                      .writeText(resumeToPlainText(resume))
                      .then(() => notify('success', 'Plain text copied. Useful for pasting into web forms.'))
                      .catch(() => notify('danger', 'The clipboard is not available in this browser.'));
                  }}
                >
                  Copy as plain text
                </Button>
              </div>
              <div className="row">
                <Button
                  icon={<RefreshIcon />}
                  onClick={() => {
                    if (window.confirm('Replace the current resume with the worked sample?')) {
                      replaceResume(createSampleResume());
                      notify('info', 'Sample resume loaded. Undo still works.');
                    }
                  }}
                >
                  Load the sample resume
                </Button>
                <Button variant="danger" onClick={() => setShowImport(true)}>
                  Start over
                </Button>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void importJson(file);
                  event.target.value = '';
                }}
              />
            </div>
          </section>

          <section className="card" aria-labelledby="shortcuts-title">
            <header className="card__header">
              <h2 className="card__title" id="shortcuts-title">
                Keyboard
              </h2>
              <Button size="sm" icon={<KeyboardIcon />} onClick={() => setShowShortcuts(true)}>
                All shortcuts
              </Button>
            </header>
            <div className="card__body">
              <dl className="shortcuts">
                <dt>
                  <span className="kbd">Ctrl/⌘ Z</span>
                </dt>
                <dd>Undo</dd>
                <dt>
                  <span className="kbd">Ctrl/⌘ ⇧ Z</span>
                </dt>
                <dd>Redo</dd>
                <dt>
                  <span className="kbd">Ctrl/⌘ ⇧ ↑ ↓</span>
                </dt>
                <dd>Move the focused achievement or list item</dd>
                <dt>
                  <span className="kbd">Ctrl/⌘ S</span>
                </dt>
                <dd>Download the PDF</dd>
              </dl>
            </div>
          </section>
        </div>
      </div>

      {showShortcuts ? (
        <Modal title="Keyboard shortcuts" onClose={() => setShowShortcuts(false)}>
          <dl className="shortcuts">
            <dt>
              <span className="kbd">Ctrl/⌘ Z</span>
            </dt>
            <dd>Undo the last change</dd>
            <dt>
              <span className="kbd">Ctrl/⌘ ⇧ Z</span> or <span className="kbd">Ctrl/⌘ Y</span>
            </dt>
            <dd>Redo</dd>
            <dt>
              <span className="kbd">Ctrl/⌘ ⇧ ↑</span>
            </dt>
            <dd>Move the focused achievement up</dd>
            <dt>
              <span className="kbd">Ctrl/⌘ ⇧ ↓</span>
            </dt>
            <dd>Move the focused achievement down</dd>
            <dt>
              <span className="kbd">Ctrl/⌘ Enter</span>
            </dt>
            <dd>Remove the focused achievement</dd>
            <dt>
              <span className="kbd">Ctrl/⌘ S</span>
            </dt>
            <dd>Download the PDF</dd>
            <dt>
              <span className="kbd">1</span> <span className="kbd">2</span> <span className="kbd">3</span>
            </dt>
            <dd>Switch between Content, Design and Analysis (when not typing)</dd>
          </dl>
          <p className="field__hint" style={{ marginTop: 'var(--space-4)' }}>
            Every drag-and-drop action also has a visible button next to it, and every button has a keyboard shortcut,
            so nothing here requires a mouse.
          </p>
        </Modal>
      ) : null}

      {showImport ? (
        <Modal
          title="Start over"
          onClose={() => setShowImport(false)}
          footer={
            <>
              <Button onClick={() => setShowImport(false)}>Cancel</Button>
            </>
          }
        >
          <p>Choose what to replace the current resume with. Your current work is kept in the undo history.</p>
          <div className="row" style={{ marginTop: 'var(--space-4)' }}>
            <Button
              onClick={() => {
                replaceResume(createEmptyResume());
                setShowImport(false);
                notify('info', 'Blank resume ready.');
              }}
            >
              A blank resume
            </Button>
            <Button
              onClick={() => {
                replaceResume(createSampleResume());
                setShowImport(false);
                notify('info', 'Sample resume loaded.');
              }}
            >
              The worked sample
            </Button>
          </div>
        </Modal>
      ) : null}
    </>
  );
}

