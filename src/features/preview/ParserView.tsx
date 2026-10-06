/**
 * "What a parser reads".
 *
 * Shows the text pdf.js extracts from the generated PDF, in reading order and
 * laid out as lines. This is the single most useful thing a resume builder can
 * show, because every classic parsing failure — a heading that is not recognised,
 * a two-column layout that interleaves, contact details stuck in a header, a
 * bullet that breaks a keyword — is invisible on the rendered page and obvious
 * here.
 */

import type { Inspection } from '../../pdf/client';
import { isHeadingLine } from '../../../scripts/lib/ats-checks.mjs';

const LINE_KIND_CLASS: Record<string, string> = {
  heading: 'parser-line--heading',
  bullet: 'parser-line--bullet',
  name: 'parser-line--name',
};

function classify(line: string, index: number): string {
  if (index === 0) return 'name';
  if (isHeadingLine(line)) return 'heading';
  if (/^[\u2022\u2013\-\u25aa\u00b7]\s/.test(line)) return 'bullet';
  return 'plain';
}

export function ParserView({ inspection, loading }: { inspection?: Inspection; loading: boolean }) {
  if (!inspection) {
    return (
      <div className="preview-placeholder">
        <span className="spinner" aria-hidden="true" />
        <p>{loading ? 'Extracting text…' : 'Nothing to show yet.'}</p>
      </div>
    );
  }

  const characterCount = inspection.text.replace(/\s+/g, '').length;

  return (
    <div className="parser-view">
      <div className="parser-legend">
        <span>
          <strong>{characterCount.toLocaleString()}</strong> characters extracted
        </span>
        <span>
          <strong>{inspection.links.length}</strong> link annotations
        </span>
        <span>
          <strong>{inspection.outline.length}</strong> bookmarks
        </span>
        <span>
          <strong>{inspection.pageCount}</strong> pages
        </span>
      </div>
      <p className="field__hint" style={{ marginBottom: 'var(--space-3)' }}>
        A parser never sees the page. It sees this — the text in content-stream order, one line per visual line.
        Highlighted lines are recognised as section headings.
      </p>

      {inspection.pages.map((page) => (
        <section key={page.pageNumber} className="parser-page" aria-label={`Extracted page ${page.pageNumber}`}>
          <h3 className="parser-page__label">Page {page.pageNumber}</h3>
          <div>
            {page.lines.map((line, index) => {
              const kind = classify(line, page.pageNumber === 1 ? index : -1);
              return (
                <div key={`${page.pageNumber}-${index}`} className={['parser-line', LINE_KIND_CLASS[kind]].filter(Boolean).join(' ')}>
                  {line || '\u00a0'}
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {inspection.links.length > 0 ? (
        <section className="parser-page" aria-label="Link annotations">
          <h3 className="parser-page__label">Clickable annotations</h3>
          <ul className="hint-list">
            {inspection.links.map((link, index) => (
              <li key={index}>
                {link.url ? (
                  <a href={link.url} target="_blank" rel="noreferrer noopener">
                    {link.url}
                  </a>
                ) : (
                  <span>internal link on page {link.page}</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {inspection.outline.length > 0 ? (
        <section className="parser-page" aria-label="Document outline">
          <h3 className="parser-page__label">Bookmarks (PDF outline)</h3>
          <ul className="hint-list">
            {inspection.outline.map((node, index) => (
              <li key={index} style={{ marginLeft: node.depth * 16 }}>
                {node.title}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {Object.keys(inspection.metadata).length > 0 ? (
        <section className="parser-page" aria-label="Document metadata">
          <h3 className="parser-page__label">Document metadata</h3>
          <dl className="shortcuts">
            {Object.entries(inspection.metadata)
              .filter(([, value]) => value !== null && value !== undefined && String(value).trim() !== '')
              .map(([key, value]) => (
                <div key={key} style={{ display: 'contents' }}>
                  <dt className="kbd">{key}</dt>
                  <dd>{String(value)}</dd>
                </div>
              ))}
          </dl>
        </section>
      ) : null}
    </div>
  );
}
