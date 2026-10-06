/**
 * Live preview.
 *
 * The preview renders the *actual PDF bytes* through pdf.js, not an HTML
 * approximation of them. That is the whole point: what you see is what the file
 * contains, down to where a line wraps. The same bytes are handed to the
 * download button, so preview and export can never disagree.
 *
 * The second mode — "What a parser reads" — shows the text pdf.js extracts from
 * those same bytes, in reading order. It is the only honest way to show someone
 * what an ATS sees, and it is the feature that turns an invisible failure into a
 * visible one.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../../state/store';
import { generatePdf, openPdf, type OpenedPdf } from '../../pdf/client';
import type { Inspection } from '../../pdf/client';
import { useDebouncedValue } from '../../ui/useDebouncedValue';
import { Button, IconButton, Segmented } from '../../ui/primitives';
import {
  DownloadIcon,
  ExternalLinkIcon,
  PrinterIcon,
  RefreshIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from '../../ui/icons';
import { ParserView } from './ParserView';

const MIN_SCALE = 0.4;
const MAX_SCALE = 2.4;

interface PreviewState {
  status: 'loading' | 'ready' | 'error';
  opened?: OpenedPdf;
  blob?: Blob;
  bytes?: number;
  inspection?: Inspection;
  error?: string;
  /** True when this is a refresh of an already-visible document. */
  refreshing: boolean;
}

export function PreviewPanel() {
  const resume = useStore((state) => state.resume);
  const ui = useStore((state) => state.ui);
  const setUi = useStore((state) => state.setUi);
  const notify = useStore((state) => state.notify);

  const debouncedResume = useDebouncedValue(resume, 320);
  const [state, setState] = useState<PreviewState>({ status: 'loading', refreshing: false });
  const [linksVisible, setLinksVisible] = useState(true);
  const [regenNonce, setRegenNonce] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(760);

  // Regenerate whenever the debounced document changes.
  useEffect(() => {
    let cancelled = false;
    let opened: OpenedPdf | undefined;

    (async () => {
      setState((previous) => ({ ...previous, status: 'loading', refreshing: previous.status === 'ready' }));
      try {
        const generated = await generatePdf(debouncedResume);
        if (cancelled) return;
        opened = await openPdf(generated.blob);
        if (cancelled) {
          void opened.destroy();
          return;
        }
        const inspection = await opened.inspect();
        if (cancelled) {
          void opened.destroy();
          return;
        }
        setState((previous) => {
          if (previous.opened && previous.opened !== opened) void previous.opened.destroy();
          return {
            status: 'ready',
            opened,
            blob: generated.blob,
            bytes: generated.bytes,
            inspection,
            refreshing: false,
          };
        });
      } catch (error) {
        if (cancelled) return;
        setState({
          status: 'error',
          refreshing: false,
          error: error instanceof Error ? `${error.message}` : String(error),
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [debouncedResume, regenNonce]);

  // Track the pane width so "fit to width" can compute a scale.
  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 760;
      setContainerWidth(Math.max(240, width - 48));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const pageWidth = useMemo(() => {
    const width = state.inspection?.pages[0]?.width;
    return width && width > 0 ? width : 612;
  }, [state.inspection]);

  const scale = ui.fitToWidth ? Math.min(MAX_SCALE, Math.max(MIN_SCALE, containerWidth / pageWidth)) : ui.zoom;

  const setScale = useCallback(
    (next: number) => {
      setUi({ zoom: Math.min(MAX_SCALE, Math.max(MIN_SCALE, next)), fitToWidth: false });
    },
    [setUi],
  );

  const onDownload = useCallback(async () => {
    if (!state.blob) return;
    const { downloadBlob, resumeFileName } = await import('../../pdf/generate');
    downloadBlob(state.blob, resumeFileName(resume));
    notify('success', 'Downloaded. The file has clickable links and selectable text.');
  }, [state.blob, resume, notify]);

  const onOpenInTab = useCallback(() => {
    if (!state.blob) return;
    const url = URL.createObjectURL(state.blob);
    window.open(url, '_blank', 'noopener');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }, [state.blob]);

  const pages = state.inspection?.pages ?? [];
  const pageCount = state.opened?.pageCount ?? 0;

  return (
    <div className="pane pane--preview">
      <div className="preview-toolbar">
        <div className="preview-toolbar__group">
          <Segmented
            label="Preview mode"
            value={ui.previewMode}
            onChange={(mode) => setUi({ previewMode: mode })}
            options={[
              { value: 'pdf', label: 'Page' },
              { value: 'parser', label: 'Parser view' },
            ]}
          />
        </div>

        {ui.previewMode === 'pdf' ? (
          <div className="preview-toolbar__group">
            <IconButton label="Zoom out" onClick={() => setScale(scale - 0.1)} disabled={scale <= MIN_SCALE}>
              <ZoomOutIcon />
            </IconButton>
            <span className="preview-toolbar__zoom">{Math.round(scale * 100)}%</span>
            <IconButton label="Zoom in" onClick={() => setScale(scale + 0.1)} disabled={scale >= MAX_SCALE}>
              <ZoomInIcon />
            </IconButton>
            <Button
              size="sm"
              variant={ui.fitToWidth ? 'primary' : 'default'}
              onClick={() => setUi({ fitToWidth: true })}
              aria-pressed={ui.fitToWidth}
            >
              Fit
            </Button>
            <Button
              size="sm"
              variant={linksVisible ? 'primary' : 'default'}
              onClick={() => setLinksVisible((value) => !value)}
              aria-pressed={linksVisible}
              title="Show clickable link areas on the page"
            >
              Links
            </Button>
          </div>
        ) : null}

        <div className="preview-toolbar__spacer" />

        <span className="preview-toolbar__status" aria-live="polite">
          {state.status === 'loading' ? (
            <>
              <span className="spinner" aria-hidden="true" />
              {state.refreshing ? 'Updating…' : 'Rendering…'}
            </>
          ) : state.status === 'ready' ? (
            <>
              {pageCount} page{pageCount === 1 ? '' : 's'}
              {state.bytes ? ` · ${(state.bytes / 1024).toFixed(0)} KB` : ''}
              {state.inspection ? ` · ${state.inspection.links.length} links` : ''}
            </>
          ) : (
            'Render failed'
          )}
        </span>

        <div className="preview-toolbar__group">
          <IconButton
            label="Regenerate preview"
            onClick={() => setRegenNonce((value) => value + 1)}
            title="Regenerate preview from the current document"
          >
            <RefreshIcon />
          </IconButton>
          <IconButton label="Open PDF in a new tab" onClick={onOpenInTab} disabled={!state.blob}>
            <ExternalLinkIcon />
          </IconButton>
          <IconButton
            label="Print"
            onClick={() => {
              onOpenInTab();
              notify('info', 'Use your browser’s print dialog in the new tab to print or save.');
            }}
            disabled={!state.blob}
          >
            <PrinterIcon />
          </IconButton>
          <Button
            variant="primary"
            icon={<DownloadIcon />}
            onClick={onDownload}
            disabled={!state.blob}
            title="Download the PDF"
            data-action="download"
          >
            Download PDF
          </Button>
        </div>
      </div>

      <div className="pane__scroll" ref={scrollRef}>
        {state.status === 'error' ? (
          <div className="error-box" role="alert">
            <strong>The PDF could not be rendered.</strong>
            <p>Your work is safe — it is still in the editor. This usually means the preview engine failed to load.</p>
            <pre>{state.error}</pre>
            <p style={{ marginTop: 'var(--space-3)' }}>
              <Button onClick={() => window.location.reload()}>Reload the page</Button>
            </p>
          </div>
        ) : null}

        {state.status !== 'error' && ui.previewMode === 'parser' ? (
          <ParserView inspection={state.inspection} loading={state.status === 'loading'} />
        ) : null}

        {state.status !== 'error' && ui.previewMode === 'pdf' ? (
          <div className="preview-scroll">
            {pages.length === 0 ? (
              <div className="preview-placeholder">
                <span className="spinner" aria-hidden="true" />
                <p>Rendering your resume…</p>
              </div>
            ) : (
              pages.map((page) => (
                <PdfPageCanvas
                  key={page.pageNumber}
                  opened={state.opened!}
                  pageNumber={page.pageNumber}
                  scale={scale}
                  width={pageWidth}
                  height={page.height}
                  showLinks={linksVisible}
                  annotations={state.inspection?.links.filter((link) => link.page === page.pageNumber) ?? []}
                />
              ))
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

interface PdfPageCanvasProps {
  opened: OpenedPdf;
  pageNumber: number;
  scale: number;
  width: number;
  height: number;
  showLinks: boolean;
  annotations: Inspection['links'];
}

function PdfPageCanvas({
  opened,
  pageNumber,
  scale,
  width,
  height,
  showLinks,
  annotations,
}: PdfPageCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let task: { cancel: () => void } | undefined;

    (async () => {
      try {
        const page = await opened.doc.getPage(pageNumber);
        if (cancelled) return;
        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        if (!canvas) return;
        const context = canvas.getContext('2d');
        if (!context) return;

        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;

        const renderTask = page.render({
          canvas,
          canvasContext: context,
          viewport,
          // Only pass `transform` when it is needed: pdf.js treats an
          // explicitly-undefined transform as a value, not as "absent".
          ...(dpr === 1 ? {} : { transform: [dpr, 0, 0, dpr, 0, 0] }),
        });
        task = renderTask as unknown as { cancel: () => void };
        await renderTask.promise;
      } catch (renderError) {
        if (cancelled) return;
        const message = renderError instanceof Error ? renderError.message : String(renderError);
        if (!message.includes('Rendering cancelled')) setError(message);
      }
    })();

    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [opened, pageNumber, scale]);

  const displayWidth = width * scale;
  const displayHeight = height * scale;

  return (
    <figure
      className="pdf-page"
      style={{ width: `${displayWidth}px`, height: `${displayHeight}px` }}
      aria-label={`Page ${pageNumber} of ${opened.pageCount}`}
    >
      <span className="pdf-page__label">{pageNumber}</span>
      <canvas ref={canvasRef} role="img" aria-label={`Rendered page ${pageNumber}`} />
      {/*
        The link overlay is positioned from the annotation rectangles rather than
        from the canvas, so it never depends on when the canvas paint finishes.
      */}
      {showLinks && annotations.length > 0 ? (
        <div className="pdf-links">
          {annotations.map((annotation, index) => {
            const rect = annotation.rect;
            if (!rect || rect.length < 4) return null;
            const [x1, y1, x2, y2] = rect;
            const left = Math.min(x1, x2) * scale;
            const top = (height - Math.max(y1, y2)) * scale;
            const linkWidth = Math.abs(x2 - x1) * scale;
            const linkHeight = Math.abs(y2 - y1) * scale;
            const external = annotation.kind === 'uri' && annotation.url;
            return (
              <a
                key={`${annotation.page}-${index}`}
                className="pdf-link"
                href={external ? annotation.url! : `#page-${annotation.page}`}
                target={external ? '_blank' : undefined}
                rel={external ? 'noreferrer noopener' : undefined}
                style={{
                  left: `${left}px`,
                  top: `${top}px`,
                  width: `${linkWidth}px`,
                  height: `${linkHeight}px`,
                }}
                aria-label={external ? `Link to ${annotation.url}` : 'Internal link'}
                title={annotation.url ?? undefined}
              />
            );
          })}
        </div>
      ) : null}
      {error ? (
        <div className="error-box" role="alert">
          Page {pageNumber} failed to render: {error}
        </div>
      ) : null}
    </figure>
  );
}
