/**
 * Browser-side PDF pipeline.
 *
 * Two heavy dependencies — the PDF renderer (~600 KB) and pdf.js — are loaded
 * lazily, so the editor shell paints immediately and the preview appears a moment
 * later. Everything stays on the device: the blob is created in this tab and
 * never uploaded.
 */

import type { GeneratedPdf } from './generate';
import type { ResumeData } from '../domain/types';
import type { Inspection } from '../../scripts/lib/pdf-core.mjs';

let generatorModule: Promise<typeof import('./generate')> | null = null;
let coreModule: Promise<typeof import('../../scripts/lib/pdf-core.mjs')> | null = null;
let pdfjsModule: Promise<typeof import('pdfjs-dist')> | null = null;

export function loadGenerator(): Promise<typeof import('./generate')> {
  generatorModule ??= import('./generate');
  return generatorModule;
}

function loadCore() {
  coreModule ??= import('../../scripts/lib/pdf-core.mjs');
  return coreModule;
}

/**
 * pdf.js needs a worker and the standard-14 font metrics. The worker is bundled
 * by Vite; the font data is copied into `public/pdfjs/` by
 * `scripts/sync-pdfjs-assets.mjs` so it resolves under any base path.
 */
export async function loadPdfjs() {
  pdfjsModule ??= (async () => {
    const pdfjs = await import('pdfjs-dist');
    const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
    return pdfjs;
  })();
  return pdfjsModule;
}

export function standardFontDataUrl(): string {
  const base = import.meta.env.BASE_URL || '/';
  return `${base.endsWith('/') ? base : `${base}/`}pdfjs/standard_fonts/`;
}

/** Renders the resume to a PDF blob. */
export async function generatePdf(data: ResumeData): Promise<GeneratedPdf> {
  const { generateResumePdf } = await loadGenerator();
  return generateResumePdf(data);
}

/**
 * Opens a blob with pdf.js and produces both the rendering document and the
 * parser-eye inspection from the same bytes.
 */
export async function openPdf(blob: Blob) {
  const pdfjs = await loadPdfjs();
  const data = new Uint8Array(await blob.arrayBuffer());
  const task = pdfjs.getDocument({
    data,
    standardFontDataUrl: standardFontDataUrl(),
  });
  const doc = await task.promise;
  const { inspectPdfDocument } = await loadCore();
  return {
    doc,
    task,
    pageCount: doc.numPages,
    async inspect(): Promise<Inspection> {
      return inspectPdfDocument(doc, { ops: pdfjs.OPS as unknown as Record<string, number> });
    },
    destroy() {
      // pdf.js v5 exposes destroy() on the document proxy; v6 removed it in
      // favour of the loading task, so try both.
      const anyDoc = doc as unknown as { destroy?: () => Promise<void> };
      if (typeof anyDoc.destroy === 'function') return anyDoc.destroy();
      return task.destroy();
    },
  };
}

export type OpenedPdf = Awaited<ReturnType<typeof openPdf>>;

export { inspectPdfDocument } from '../../scripts/lib/pdf-core.mjs';
export type { Inspection };
