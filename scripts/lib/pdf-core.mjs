/**
 * PDF inspection core.
 *
 * Pure JavaScript with no dependency on how the document was opened, so the same
 * code runs in three places:
 *   - the Node CLI verifier (`scripts/verify-ats.mjs`)
 *   - the unit tests that render every template
 *   - the browser, powering the in-app "what a parser reads" panel
 *
 * The job here is to answer one question the way an ATS would: *given only the
 * bytes of this file, what text comes out, in what order, and what is clickable?*
 */

/** A single positioned run of text as the extractor reports it. */
function normaliseText(value) {
  return String(value ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Groups positioned text runs into visual lines.
 *
 * Grouping is by y position, with a tolerance of roughly a third of the text
 * height, then ordered left-to-right — this is what a layout-aware extractor
 * does, and it is what makes the difference between "one readable line" and
 * "every word on its own line".
 */
export function groupIntoLines(items, tolerance = 2.2) {
  const usable = items.filter((item) => item.str.length > 0);
  if (usable.length === 0) return [];

  const sorted = [...usable].sort((a, b) => {
    if (Math.abs(a.y - b.y) > tolerance) return b.y - a.y;
    return a.x - b.x;
  });

  const lines = [];
  let current = null;
  for (const item of sorted) {
    if (current && Math.abs(current.y - item.y) <= tolerance) {
      current.items.push(item);
      current.y = (current.y * (current.items.length - 1) + item.y) / current.items.length;
    } else {
      current = { y: item.y, items: [item] };
      lines.push(current);
    }
  }

  return lines.map((line) => {
    const ordered = [...line.items].sort((a, b) => a.x - b.x);
    let text = '';
    let previousEnd = null;
    for (const item of ordered) {
      const value = normaliseText(item.str);
      if (!value) continue;
      if (text === '') {
        text = value;
      } else {
        const gap = previousEnd === null ? 0 : item.x - previousEnd;
        // A wide gap is a real separator (a column break); a small one is a space.
        text += gap > (item.height || 10) * 0.9 ? `  |  ${value}` : ` ${value}`;
      }
      previousEnd = item.x + (item.width || 0);
    }
    return { y: line.y, text, items: ordered };
  });
}

/** Highest and lowest y coordinates carrying text, for the "top of page" checks. */
export function verticalExtent(items) {
  const ys = items.filter((item) => item.str.trim()).map((item) => item.y);
  if (ys.length === 0) return { top: 0, bottom: 0 };
  return { top: Math.max(...ys), bottom: Math.min(...ys) };
}

function annotationLink(annotation) {
  const url = typeof annotation.url === 'string' ? annotation.url : null;
  const unsafe = typeof annotation.unsafeUrl === 'string' ? annotation.unsafeUrl : null;
  const isLink = annotation.subtype === 'Link' || Boolean(url) || Boolean(unsafe);
  if (!isLink) return null;
  return {
    url: url ?? unsafe,
    kind: url || unsafe ? 'uri' : 'internal',
    rect: Array.isArray(annotation.rect) ? annotation.rect : null,
    page: annotation.page,
  };
}

/**
 * Builds the full inspection from an opened pdf.js document proxy.
 *
 * `doc` only needs `numPages`, `getPage`, and optionally `getMetadata` and
 * `getOutline`, which every pdf.js build provides.
 */
export async function inspectPdfDocument(doc, options = {}) {
  const pages = [];
  const links = [];
  const allItems = [];
  const ops = options.ops ?? null;
  const stats = ops ? { textOps: 0, imageOps: 0, pathOps: 0, ruleOps: 0, otherOps: 0 } : null;
  const imageOps = ops
    ? new Set(
        [
          'paintImageXObject',
          'paintInlineImageXObject',
          'paintImageMaskXObject',
          'paintImageXObjectRepeat',
          'paintImageMaskXObjectRepeat',
          'paintSolidColorImageMask',
        ]
          .map((name) => ops[name])
          .filter((value) => typeof value === 'number'),
      )
    : new Set();
  const textOps = ops
    ? new Set(
        ['showText', 'showSpacedText', 'nextLineShowText', 'nextLineSetSpacingShowText', 'setTextMatrix']
          .map((name) => ops[name])
          .filter((value) => typeof value === 'number'),
      )
    : new Set();
  const pathOps = ops
    ? new Set(
        [
          'constructPath',
          'fill',
          'eoFill',
          'stroke',
          'closeStroke',
          'fillStroke',
          'eoFillStroke',
          'closeFillStroke',
          'closeEOFillStroke',
          'rectangle',
        ]
          .map((name) => ops[name])
          .filter((value) => typeof value === 'number'),
      )
    : new Set();
  const rectOp = ops && typeof ops.rectangle === 'number' ? ops.rectangle : null;

  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
    const page = await doc.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const items = content.items
      .filter((item) => typeof item.str === 'string')
      .map((item) => {
        const transform = item.transform ?? [1, 0, 0, 1, 0, 0];
        const height = Math.abs(transform[3] ?? item.height ?? 10);
        return {
          str: item.str,
          x: transform[4],
          y: transform[5],
          width: item.width ?? 0,
          height,
          fontName: item.fontName ?? null,
          page: pageNumber,
        };
      });

    allItems.push(...items);

    if (ops) {
      try {
        const operatorList = await page.getOperatorList();
        for (const fn of operatorList.fnArray) {
          if (textOps.has(fn)) stats.textOps += 1;
          else if (imageOps.has(fn)) stats.imageOps += 1;
          else if (rectOp !== null && fn === rectOp) stats.ruleOps += 1;
          else if (pathOps.has(fn)) stats.pathOps += 1;
          else stats.otherOps += 1;
        }
      } catch {
        // Operator lists are a bonus signal; text extraction is the primary one.
      }
    }

    let annotations = [];
    try {
      annotations = await page.getAnnotations({ intent: 'display' });
    } catch {
      annotations = [];
    }
    for (const annotation of annotations) {
      const link = annotationLink({ ...annotation, page: pageNumber });
      if (link) links.push(link);
    }

    const lines = groupIntoLines(items);
    pages.push({
      pageNumber,
      width: viewport.width,
      height: viewport.height,
      lines: lines.map((line) => line.text),
      items,
    });
  }

  let metadata = {};
  try {
    const raw = await doc.getMetadata();
    metadata = raw?.info ?? {};
    metadata.pdfFormatVersion = raw?.info?.PDFFormatVersion ?? null;
  } catch {
    metadata = {};
  }

  let outline = [];
  try {
    outline = (await doc.getOutline()) ?? [];
  } catch {
    outline = [];
  }

  const pageText = pages.map((page) => page.lines.join('\n'));
  return {
    pageCount: doc.numPages,
    pages,
    items: allItems,
    pageText,
    text: pageText.join('\n\n'),
    links,
    outline: flattenOutline(outline),
    metadata,
    encrypted: Boolean(doc.isEncrypted),
    fingerprints: doc.fingerprints ?? null,
    operatorStats: stats,
  };
}

function flattenOutline(nodes, depth = 0, out = []) {
  for (const node of nodes ?? []) {
    out.push({ title: normaliseText(node.title), depth });
    if (Array.isArray(node.items) && node.items.length > 0) {
      flattenOutline(node.items, depth + 1, out);
    }
  }
  return out;
}

/** Section headings, paired with the lines that follow them. */
export function attributeSections(inspection, isHeading) {
  const sections = [];
  let current = { heading: null, lines: [] };
  for (const page of inspection.pages) {
    for (const line of page.lines) {
      if (isHeading(line)) {
        if (current.heading !== null || current.lines.length > 0) sections.push(current);
        current = { heading: line, lines: [] };
      } else {
        current.lines.push(line);
      }
    }
  }
  if (current.heading !== null || current.lines.length > 0) sections.push(current);
  return sections;
}

/** Lines that appear on more than one page — repeated headers and footers. */
export function repeatedLines(inspection) {
  if (inspection.pages.length < 2) return [];
  const counts = new Map();
  for (const page of inspection.pages) {
    for (const line of new Set(page.lines)) {
      if (!line.trim()) continue;
      counts.set(line, (counts.get(line) ?? 0) + 1);
    }
  }
  const pageCount = inspection.pages.length;
  return [...counts.entries()]
    .filter(([, count]) => count === pageCount)
    .map(([line]) => line);
}
