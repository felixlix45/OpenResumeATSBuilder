/**
 * Independent text extraction with MuPDF.
 *
 * This exists specifically to make the verification honest. `pdf-parse` and
 * `unpdf` both wrap pdf.js, so comparing them with pdf.js would report "three
 * engines agree" while testing one implementation three times. MuPDF is a
 * separate C++ engine compiled to WebAssembly: when both it and pdf.js produce
 * the same tokens, that is real evidence about the file rather than about one
 * library's quirks.
 */

let mupdfModule = null;

async function loadMupdf() {
  if (!mupdfModule) mupdfModule = await import('mupdf');
  return mupdfModule;
}

/** Normalises text for token comparison: whitespace collapsed, NFKC applied. */
export function normaliseForComparison(text) {
  return text.normalize('NFKC').replace(/\s+/g, ' ').trim();
}

/** Extracts text from a PDF buffer using MuPDF. Returns null when unavailable. */
export async function extractWithMupdf(buffer) {
  try {
    const mupdf = await loadMupdf();
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    const document = mupdf.Document.openDocument(bytes, 'application/pdf');
    const pageCount = document.countPages();
    const pages = [];
    for (let index = 0; index < pageCount; index += 1) {
      const page = document.loadPage(index);
      const text = page.toStructuredText('preserve-whitespace').asText();
      pages.push(text);
      page.destroy?.();
    }
    document.destroy?.();
    return { engine: 'mupdf', pageCount, pages, text: pages.join('\n\n') };
  } catch (error) {
    return { engine: 'mupdf', error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Compares two extractions by word multiset, ignoring order.
 *
 * Order is deliberately excluded: the two engines segment lines differently, and
 * the question this answers is "do they read the same words?", not "do they lay
 * out identically".
 */
export function compareExtractions(a, b) {
  const words = (text) =>
    new Set(
      normaliseForComparison(text)
        .toLowerCase()
        .match(/[a-z0-9][a-z0-9+#./@-]*/g) ?? [],
    );
  const first = words(a);
  const second = words(b);
  const onlyFirst = [...first].filter((word) => !second.has(word));
  const onlySecond = [...second].filter((word) => !first.has(word));
  const union = new Set([...first, ...second]);
  const agreement = union.size === 0 ? 1 : (union.size - onlyFirst.length - onlySecond.length) / union.size;
  return { agreement, onlyInPdfjs: onlyFirst, onlyInMupdf: onlySecond, wordCount: union.size };
}
