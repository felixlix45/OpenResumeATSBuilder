/**
 * Loads a PDF for inspection with pdf.js.
 *
 * The legacy build is used because it runs in Node without a worker. Standard
 * font data is pointed at the packaged copies when they are present, so that
 * base-14 text metrics resolve exactly as they do in a browser.
 */

import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);

let cachedModule = null;

async function loadPdfjs() {
  if (cachedModule) return cachedModule;
  cachedModule = await import('pdfjs-dist/legacy/build/pdf.mjs');
  return cachedModule;
}

function standardFontDataUrl() {
  try {
    const entry = require.resolve('pdfjs-dist/package.json');
    const dir = join(dirname(entry), 'standard_fonts');
    if (existsSync(dir)) return dir.endsWith('/') ? dir : `${dir}/`;
  } catch {
    /* fall through */
  }
  return undefined;
}

/** Opens a PDF from a Buffer/Uint8Array and returns an inspection object. */
export async function inspectPdfBuffer(buffer, core) {
  const pdfjs = await loadPdfjs();
  const { inspectPdfDocument } = core ?? (await import('./pdf-core.mjs'));
  // pdf.js may transfer (and therefore detach) the ArrayBuffer it is given, so it
  // always gets a private copy. Callers keep their own bytes intact and can keep
  // asserting on them after inspection.
  const source = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const data = new Uint8Array(source.length);
  data.set(source);
  const doc = await pdfjs.getDocument({
    data,
    standardFontDataUrl: standardFontDataUrl(),
    useSystemFonts: false,
    isEvalSupported: false,
    disableFontFace: true,
    verbosity: 0,
  }).promise;
  try {
    const inspection = await inspectPdfDocument(doc, { ops: pdfjs.OPS });
    return { inspection, rawBytes: data };
  } finally {
    await doc.destroy();
  }
}

export { loadPdfjs };
