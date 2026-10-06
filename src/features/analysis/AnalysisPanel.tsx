/**
 * ATS analysis panel.
 *
 * Design decisions, taken from the UX research:
 *
 * - **A cardinal, not a score.** "19 of 22 checks pass" is verifiable; a single
 *   number out of 100 is not, and invites false confidence. The dial is
 *   secondary to the count.
 * - **Explainable checks.** Every row says why it matters and what to do, and
 *   links to the field it is about.
 * - **Dismissible.** The user can accept a warning they disagree with; doing so
 *   removes it from the count rather than nagging forever.
 * - **Honest.** A permanent note states that this does not predict shortlisting,
 *   because it cannot — no tool can.
 */

import { useMemo } from 'react';
import { analyzeResume } from '../../ats/analyze';
import { suggestSkillAdditions } from '../../ats/keywords';
import { CATEGORY_LABELS, CATEGORY_ORDER } from '../../ats/types';
import type { Check, CheckStatus } from '../../ats/types';
import type { CheckTarget } from '../../ats/types';
import { useStore } from '../../state/store';
import { Button, Field, IconButton, TextArea } from '../../ui/primitives';
import {
  AlertIcon,
  CheckCircleIcon,
  InfoIcon,
  PlusIcon,
  SparkleIcon,
  XCircleIcon,
} from '../../ui/icons';

const STATUS_ICON: Record<CheckStatus, typeof CheckCircleIcon> = {
  pass: CheckCircleIcon,
  warn: AlertIcon,
  fail: XCircleIcon,
  info: InfoIcon,
};

const GRADE_COPY: Record<string, { title: string; sub: string }> = {
  excellent: {
    title: 'This will parse cleanly',
    sub: 'Structure, contact details and dates are all in the shape parsers expect.',
  },
  good: {
    title: 'In good shape',
    sub: 'A few small things are worth tightening before you send it.',
  },
  fair: {
    title: 'Needs some work',
    sub: 'Nothing here is fatal, but several items will cost you keyword matches.',
  },
  'needs-work': {
    title: 'Not ready to send',
    sub: 'Fix the failing items first — they are the ones that change what a parser extracts.',
  },
};

export function AnalysisPanel({ pageCount }: { pageCount?: number }) {
  const resume = useStore((state) => state.resume);
  const ui = useStore((state) => state.ui);
  const setUi = useStore((state) => state.setUi);
  const toggleCheckDismissed = useStore((state) => state.toggleCheckDismissed);
  const focusField = useStore((state) => state.focusField);
  const addSkillKeyword = useStore((state) => state.addSkillKeyword);
  const notify = useStore((state) => state.notify);

  const analysis = useMemo(
    () => analyzeResume(resume, { jobDescription: ui.jobDescription, pageCount: pageCount ?? null }),
    [resume, ui.jobDescription, pageCount],
  );

  const scored = analysis.checks.filter((check) => check.status !== 'info');
  const dismissed = new Set(ui.dismissedChecks);
  const active = scored.filter((check) => !dismissed.has(check.id));
  const passing = active.filter((check) => check.status === 'pass').length;
  const failing = active.filter((check) => check.status === 'fail').length;
  const warnings = active.filter((check) => check.status === 'warn').length;
  const copy = GRADE_COPY[analysis.grade];

  const byCategory = CATEGORY_ORDER.map((category) => ({
    category,
    checks: analysis.checks.filter((check) => check.category === category),
  })).filter((group) => group.checks.length > 0);

  const suggestions = analysis.keywords ? suggestSkillAdditions(analysis.keywords, 14) : [];

  return (
    <div className="pane__scroll">
      <div className="analysis">
          <section className="verdict" aria-labelledby="verdict-title">
            <div className="verdict__dial" data-grade={analysis.grade} aria-hidden="true">
              {passing}/{active.length}
            </div>
            <div className="verdict__body">
              <h2 className="verdict__title" id="verdict-title">
                {copy.title}
              </h2>
              <p className="verdict__sub">
                {passing} of {active.length} checks pass
                {failing > 0 ? `, ${failing} failing` : ''}
                {warnings > 0 ? `, ${warnings} to review` : ''}.
                {analysis.wordCount > 0 ? ` ${analysis.wordCount} words.` : ''}
              </p>
              <p className="verdict__disclaimer">
                These checks test the exported file for things that demonstrably break parsing. They do not predict
                whether you will be shortlisted — nothing can.
              </p>
            </div>
          </section>

          <section className="card" aria-labelledby="jd-title">
            <header className="card__header">
              <h2 className="card__title" id="jd-title">
                Match against a job posting
              </h2>
            </header>
            <div className="card__body stack">
              <Field
                label="Paste the job description"
                hint="Optional. Nothing is uploaded — the comparison runs in this tab and is never stored anywhere else."
                optional
              >
                {({ id }) => (
                  <TextArea
                    id={id}
                    value={ui.jobDescription}
                    rows={6}
                    placeholder="Paste the posting here to see which of its terms your resume already contains."
                    onChange={(event) => setUi({ jobDescription: event.target.value })}
                  />
                )}
              </Field>

              {analysis.keywords ? (
                <>
                  <div>
                    <div className="row row--between">
                      <span className="field__label">
                        Coverage <span className="field__optional">weighted by how often the posting repeats a term</span>
                      </span>
                      <strong>{Math.round(analysis.keywords.coverage * 100)}%</strong>
                    </div>
                    <div className="meter" role="img" aria-label={`${Math.round(analysis.keywords.coverage * 100)}% coverage`}>
                      <div
                        className="meter__fill"
                        data-tone={
                          analysis.keywords.coverage >= 0.7
                            ? 'success'
                            : analysis.keywords.coverage >= 0.45
                              ? 'warning'
                              : 'danger'
                        }
                        style={{ width: `${Math.max(2, Math.round(analysis.keywords.coverage * 100))}%` }}
                      />
                    </div>
                    <p className="field__hint" style={{ marginTop: 'var(--space-2)' }}>
                      {analysis.keywords.matched.length} of {analysis.keywords.jdTermCount} posting terms appear in your
                      resume
                      {analysis.keywords.detectedTitle ? ` · detected role: “${analysis.keywords.detectedTitle}”` : ''}.
                    </p>
                  </div>

                  {suggestions.length > 0 ? (
                    <div>
                      <span className="field__label">
                        Terms from the posting you never mention
                        <span className="field__optional">add only what is true</span>
                      </span>
                      <div className="chips" style={{ marginTop: 'var(--space-2)' }}>
                        {suggestions.map((term) => (
                          <button
                            key={term}
                            type="button"
                            className="chip chip--miss chip--button"
                            onClick={() => {
                              addSkillKeyword(term);
                              notify('success', `Added “${term}” to your Skills section.`);
                            }}
                            title={`Add “${term}” to Skills`}
                          >
                            <PlusIcon size={12} />
                            {term}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {analysis.keywords.matched.length > 0 ? (
                    <div>
                      <span className="field__label">Already matched</span>
                      <div className="chips" style={{ marginTop: 'var(--space-2)' }}>
                        {analysis.keywords.matched.slice(0, 24).map((item) => (
                          <span key={item.term} className="chip chip--hit">
                            {item.term}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </>
              ) : (
                <p className="field__hint">
                  Paste a posting to check keyword overlap, and to see whether your headline matches the role title.
                </p>
              )}
            </div>
          </section>

          {byCategory.map((group) => (
            <section className="card" key={group.category} aria-labelledby={`cat-${group.category}`}>
              <header className="card__header">
                <h2 className="card__title" id={`cat-${group.category}`}>
                  {CATEGORY_LABELS[group.category]}
                </h2>
                <span className="field__hint">
                  {group.checks.filter((check) => check.status === 'pass').length}/{group.checks.length} passing
                </span>
              </header>
              <div className="card__body">
                <div className="checks">
                  {group.checks.map((check) => (
                    <CheckRow
                      key={check.id}
                      check={check}
                      dismissed={dismissed.has(check.id)}
                      onDismiss={() => toggleCheckDismissed(check.id)}
                      onFocus={focusField}
                      pageCount={pageCount}
                    />
                  ))}
                </div>
              </div>
            </section>
          ))}

          <section className="card" aria-labelledby="about-checks">
            <header className="card__header">
              <h2 className="card__title" id="about-checks">
                What these checks are based on
              </h2>
            </header>
            <div className="card__body">
              <ul className="hint-list">
                <li>
                  <strong>One column, no tables or text boxes.</strong> Apache Tika’s own documentation warns that
                  position-sorting interleaves multi-column text; the renderer never emits columns to interleave.
                </li>
                <li>
                  <strong>Spelled-out months.</strong> A widely-used parser reads dates with <code>%b %Y</code>, so a
                  numeric range can match its pattern and then silently contribute zero months of experience.
                </li>
                <li>
                  <strong>Recognised section headings.</strong> Section detection is a vocabulary match, not a semantic
                  judgement: “Professional Experience” is found, “Employment History” often is not.
                </li>
                <li>
                  <strong>Real text, standard fonts.</strong> The PDF uses the standard-14 fonts with explicit WinAnsi
                  encoding, so there is no font subset or Unicode map to garble extraction.
                </li>
                <li>
                  <strong>Under 2.5 MB.</strong> Greenhouse documents that it cannot parse resumes larger than 2.5 MB,
                  even though it accepts uploads up to 100 MB.
                </li>
              </ul>
              <p className="field__hint" style={{ marginTop: 'var(--space-3)' }}>
                Switch the preview to <strong>Parser view</strong> to read the exact text these checks run against.
              </p>
            </div>
          </section>
        </div>
      </div>
  );
}

function CheckRow({
  check,
  dismissed,
  onDismiss,
  onFocus,
  pageCount,
}: {
  check: Check;
  dismissed: boolean;
  onDismiss: () => void;
  onFocus: (target: CheckTarget) => void;
  pageCount?: number;
}) {
  const Icon = STATUS_ICON[check.status];
  const canLocate = Boolean(check.target && (check.target.sectionId || check.target.field));

  return (
    <article className="check" data-status={check.status} data-dismissed={dismissed}>
      <span className="check__icon" data-status={check.status}>
        <Icon size={18} />
      </span>
      <div className="check__body">
        <h3 className="check__title">{check.title}</h3>
        <p className="check__detail">{check.detail}</p>
        {check.fix ? (
          <p className="check__fix">
            <span className="check__fix-label">Do this:</span>
            <span>{check.fix}</span>
          </p>
        ) : null}
        {check.status === 'fail' || check.status === 'warn' || canLocate ? (
          <div className="check__actions">
            {canLocate ? (
              <Button size="sm" onClick={() => onFocus(check.target!)}>
                Show me
              </Button>
            ) : null}
            {check.status !== 'pass' ? (
              <Button size="sm" variant="ghost" onClick={onDismiss}>
                {dismissed ? 'Un-dismiss' : 'Dismiss'}
              </Button>
            ) : null}
            {check.id === 'format.pages' && pageCount ? (
              <span className="field__hint" style={{ alignSelf: 'center' }}>
                Measured from the rendered PDF.
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
      {check.status === 'pass' ? (
        <IconButton label={`Dismiss “${check.title}”`} onClick={onDismiss} className="sr-only">
          <SparkleIcon />
        </IconButton>
      ) : null}
    </article>
  );
}
