/**
 * Automated ATS assertions over an inspected PDF.
 *
 * Each check corresponds to a numbered item in the rule checklist derived from
 * primary sources (see docs/research/ats-parsing.md). The point is not to
 * re-test our own data model — it is to test the *bytes*, the way a parser sees
 * them, so that a regression in the renderer cannot pass unnoticed.
 */

const STANDARD_14 = [
  'Helvetica',
  'Helvetica-Bold',
  'Helvetica-Oblique',
  'Helvetica-BoldOblique',
  'Times-Roman',
  'Times-Bold',
  'Times-Italic',
  'Times-BoldItalic',
  'Courier',
  'Courier-Bold',
  'Courier-Oblique',
  'Courier-BoldOblique',
  'Symbol',
  'ZapfDingbats',
];

const MONTH = '(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*';
const SPELLED_RANGE = new RegExp(`\\b${MONTH}\\s+\\d{4}\\s*[\\u2013\\u2014-]\\s*(?:${MONTH}\\s+\\d{4}|Present)\\b`, 'i');
const NUMERIC_DATE = /\b(?:\d{1,2}\/\d{4}|\d{4}-\d{2})\b/g;

const HEADING_VOCABULARY = [
  'summary',
  'professional summary',
  'executive summary',
  'career summary',
  'objective',
  'career objective',
  'profile',
  'experience',
  'professional experience',
  'work experience',
  'relevant experience',
  'education',
  'skills',
  'technical skills',
  'core competencies',
  'certifications',
  'projects',
  'publications',
  'awards',
  'volunteer experience',
  'languages',
  'accomplishments',
  'leadership',
  'interests',
];

/** Headings that look plausible but that a token-matching parser will not find. */
const UNRECOGNISED_HEADING_TRAPS = [
  'employment history',
  'work history',
  'career history',
  'professional background',
  'about me',
  'stuff i did',
];

function normalise(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function isRecognisedHeading(line) {
  const value = normalise(line).toLowerCase().replace(/[^a-z& ]+/g, '').replace(/\s+/g, ' ');
  if (!value) return false;
  const words = value.split(' ');
  return HEADING_VOCABULARY.some((heading) => {
    const parts = heading.split(' ');
    if (parts.length === 1) return words.includes(parts[0]);
    return value.includes(heading);
  });
}

/** Counts of drawing operations, used to prove text is text and not a picture. */
function operatorSummary(operatorStats) {
  if (!operatorStats) return null;
  return operatorStats;
}

/**
 * A section heading as it appears in the extracted text: a short label drawn
 * from the recognised vocabulary, with no sentence punctuation and no inline
 * separators. Case is deliberately ignored — both "SKILLS" and "Skills" are
 * headings, and a parser accepts either.
 */
export function isHeadingLine(value) {
  const text = normalise(value);
  if (!text || text.length > 60) return false;
  if (/[.:;,!?]$/.test(text)) return false;
  if (/[:|,]/.test(text)) return false;
  if (text.split(' ').length > 5) return false;
  return isRecognisedHeading(text);
}

export function runAtsChecks(inspection, context = {}) {
  const { expected = {}, rawBytes = null, operatorStats = null, sourceCharCount = null } = context;
  const results = [];
  const raw = rawBytes ? Buffer.from(rawBytes).toString('latin1') : '';
  const text = inspection.text;
  const lowerText = text.toLowerCase();

  const record = (id, title, ok, detail, severity = 'error') => {
    results.push({ id, title, ok: Boolean(ok), detail, severity: ok ? 'pass' : severity });
  };

  // 1 — text is extractable at all, and the identity fields survived.
  {
    const required = [expected.fullName, expected.email, expected.phone]
      .filter(Boolean)
      .map((value) => normalise(value).toLowerCase());
    const missing = required.filter((value) => !lowerText.includes(value));
    const ratio = sourceCharCount ? text.replace(/\s+/g, '').length / sourceCharCount : 1;
    record(
      'text.extractable',
      'Text is real and extractable',
      missing.length === 0 && ratio >= 0.6,
      `Extracted ${text.length} characters across ${inspection.pageCount} page(s).` +
        (missing.length ? ` Missing: ${missing.join(', ')}.` : '') +
        (sourceCharCount ? ` Coverage ${(ratio * 100).toFixed(0)}% of source characters.` : ''),
    );
  }

  // 2 — no unmappable glyphs, the signature of a broken font encoding.
  {
    const cid = /\(cid:\d+\)/.test(text);
    const replacement = text.includes('\uFFFD');
    const runOfQuestionMarks = /\?{2,}/.test(text) || /\b\w*\?\w+\b/.test(text);
    record(
      'text.no-unmappable-glyphs',
      'No unmappable glyphs',
      !cid && !replacement && !runOfQuestionMarks,
      cid
        ? 'Found "(cid:N)" — the font has no usable Unicode mapping.'
        : replacement
          ? 'Found U+FFFD replacement characters.'
          : runOfQuestionMarks
            ? 'Found "?" inside words, which indicates dropped glyphs.'
            : 'No (cid:N), no U+FFFD, no question marks inside words.',
    );
  }

  // 3 — only fonts every extractor already knows, or properly mapped embeddings.
  if (raw) {
    const baseFonts = [...raw.matchAll(/\/BaseFont\s*\/([A-Za-z0-9+\-_,]+)/g)].map((match) =>
      match[1].replace(/^[A-Z]{6}\+/, ''),
    );
    const unknown = [...new Set(baseFonts)].filter((name) => !STANDARD_14.includes(name));
    const hasToUnicode = /\/ToUnicode/.test(raw);
    const hasEmbedded = /\/FontFile[23]?\b/.test(raw);
    record(
      'text.font-encoding',
      'Fonts are standard or fully mapped',
      unknown.length === 0 || (hasToUnicode && hasEmbedded),
      unknown.length === 0
        ? `Standard fonts only: ${[...new Set(baseFonts)].join(', ')} — no subset, no ToUnicode map to get wrong.`
        : `Non-standard fonts ${unknown.join(', ')} ${hasToUnicode ? 'have' : 'do not have'} a ToUnicode map.`,
    );
  }

  // 4 — file size must clear the strictest documented parse cap (2.5 MB).
  if (rawBytes) {
    const bytes = rawBytes.byteLength ?? rawBytes.length;
    const megabytes = bytes / (1024 * 1024);
    record(
      'file.size',
      'File size is under the 2.5 MB parse cap',
      bytes <= 2.5 * 1024 * 1024,
      `${megabytes.toFixed(2)} MB.`,
    );
  }

  // 5 — content-stream order matches visual reading order.
  {
    const inversions = [];
    for (const page of inspection.pages) {
      const items = page.items.filter((item) => item.str.trim());
      if (items.length < 2) continue;
      const visual = [...items].sort((a, b) => (Math.abs(a.y - b.y) > 2.2 ? b.y - a.y : a.x - b.x));
      const visualIndex = new Map(visual.map((item, index) => [item, index]));
      for (let index = 1; index < items.length; index += 1) {
        const previous = visualIndex.get(items[index - 1]);
        const current = visualIndex.get(items[index]);
        if (previous > current) inversions.push({ page: page.pageNumber, previous, current });
      }
    }
    const total = inspection.items.filter((item) => item.str.trim()).length;
    const ratio = total > 1 ? 1 - inversions.length / (total - 1) : 1;
    record(
      'layout.reading-order',
      'Reading order matches visual order',
      ratio >= 0.95,
      `${(ratio * 100).toFixed(1)}% of consecutive text runs are already in visual order ` +
        `(${inversions.length} inversion(s)). Extractors that do not sort by position see the document correctly.`,
    );
  }

  // 6 — single column: no vertical gutter with text on both sides.
  {
    let worstGutter = 0;
    for (const page of inspection.pages) {
      const items = page.items.filter((item) => item.str.trim());
      if (items.length < 4) continue;
      const left = Math.min(...items.map((item) => item.x));
      const right = Math.max(...items.map((item) => item.x + (item.width || 0)));
      const width = page.width;
      const bands = 40;
      const occupied = new Array(bands).fill(0);
      for (const item of items) {
        const start = Math.floor(((item.x - left) / Math.max(1, right - left)) * bands);
        const end = Math.floor(((item.x + (item.width || 0) - left) / Math.max(1, right - left)) * bands);
        for (let band = Math.max(0, start); band <= Math.min(bands - 1, end); band += 1) occupied[band] += 1;
      }
      for (let band = 1; band < bands - 1; band += 1) {
        if (occupied[band] !== 0) continue;
        const leftOf = occupied.slice(0, band).some((count) => count > 0);
        const rightOf = occupied.slice(band + 1).some((count) => count > 0);
        if (leftOf && rightOf) {
          const gapWidth = ((right - left) / bands) * 1;
          worstGutter = Math.max(worstGutter, gapWidth / width);
        }
      }
    }
    record(
      'layout.single-column',
      'No column gutter',
      worstGutter < 0.15,
      worstGutter === 0
        ? 'No vertical band is empty while text exists on both sides.'
        : `Largest empty vertical band between text: ${(worstGutter * 100).toFixed(1)}% of page width.`,
    );
  }

  // 7 — no form fields or annotations carrying visible text.
  if (raw) {
    const hasAcroForm = /\/AcroForm/.test(raw);
    const widgets = (raw.match(/\/Subtype\s*\/Widget/g) ?? []).length;
    record(
      'layout.no-form-fields',
      'No form fields or text boxes',
      !hasAcroForm && widgets === 0,
      hasAcroForm || widgets
        ? 'Found AcroForm/Widget objects; parsers append their text at the end of the document.'
        : 'No AcroForm, no Widget annotations — all visible text comes from page content streams.',
    );
  }

  // 8 — contact block is in the page-1 body flow, near the top, and not repeated.
  if (expected.email) {
    const page1 = inspection.pages[0];
    const emailLower = normalise(expected.email).toLowerCase();
    const hitting = page1?.items.filter((item) => item.str.toLowerCase().includes(emailLower)) ?? [];
    const topBand = page1 ? page1.height * 0.75 : Infinity; // PDF y grows upward
    const inTopQuarter = hitting.some((item) => item.y >= topBand);
    const laterPages = inspection.pages.slice(1).some((page) =>
      page.lines.some((line) => line.toLowerCase().includes(emailLower)),
    );
    record(
      'layout.contact-position',
      'Contact details in the page-1 body flow',
      Boolean(page1) && inTopQuarter && !laterPages,
      !page1
        ? 'No pages found.'
        : inTopQuarter
          ? laterPages
            ? 'The email repeats on a later page — a header or footer is being extracted.'
            : 'Name, email and phone sit in the top quarter of page one and appear exactly once.'
          : 'The contact block is not in the top quarter of page one.',
    );
  }

  // 9 & 10 — headings are recognised vocabulary, and stand alone on their own line.
  if (Array.isArray(expected.headings) && expected.headings.length > 0) {
    const lines = inspection.pages.flatMap((page) => page.lines.map((line) => normalise(line).toLowerCase()));
    const expectedHeadings = expected.headings.map((heading) => normalise(heading));
    const missing = expectedHeadings.filter((heading) => !lines.includes(heading.toLowerCase()));
    const traps = lines.filter((line) => UNRECOGNISED_HEADING_TRAPS.includes(line));
    record(
      'structure.headings-standalone',
      'Every heading is its own extracted line',
      missing.length === 0,
      missing.length === 0
        ? `${expectedHeadings.length} headings each occupy a complete line.`
        : `Not found as standalone lines: ${missing.join(', ')}.`,
    );
    const unrecognised = expectedHeadings.filter((heading) => !isRecognisedHeading(heading));
    record(
      'structure.headings-recognised',
      'Headings use recognised vocabulary',
      unrecognised.length === 0 && traps.length === 0,
      unrecognised.length === 0
        ? 'All headings intersect the parser vocabulary list.'
        : `Outside the recognised vocabulary: ${unrecognised.join(', ')}.`,
    );
  }

  // 11 & 12 & 13 — dates are spelled, never numeric, and parse to a real duration.
  {
    const numeric = [...text.matchAll(NUMERIC_DATE)].map((match) => match[0]);
    const spelled = [...text.matchAll(new RegExp(SPELLED_RANGE, 'gi'))].map((match) => match[0]);
    record(
      'content.dates-spelled',
      'Dates use spelled months',
      numeric.length === 0,
      numeric.length === 0
        ? `${spelled.length} date range(s), all spelled, e.g. "${spelled[0] ?? 'n/a'}".`
        : `Numeric dates found: ${[...new Set(numeric)].join(', ')} — a "%b %Y" parser scores these as zero months.`,
    );
    if (expected.minimumSpelledRanges) {
      record(
        'content.dates-present',
        'Date ranges survive as ranges',
        spelled.length >= expected.minimumSpelledRanges,
        `${spelled.length} spelled range(s) found, expected at least ${expected.minimumSpelledRanges}.`,
      );
    }
  }

  // 14 — keywords are findable without any Unicode normalisation.
  if (Array.isArray(expected.keywords) && expected.keywords.length > 0) {
    const missing = expected.keywords.filter((keyword) => !lowerText.includes(keyword.toLowerCase()));
    record(
      'content.keywords-intact',
      'Keywords survive extraction unaltered',
      missing.length === 0,
      missing.length === 0
        ? `All ${expected.keywords.length} probe keywords are findable verbatim (no ligature folding needed).`
        : `Only findable after normalisation: ${missing.join(', ')}.`,
    );
  }

  // 15 & 17 & 27 — text is drawn as text: no images, no table grid, text operators present.
  {
    const stats = operatorSummary(operatorStats);
    if (stats) {
      record(
        'layout.no-images',
        'No raster images',
        stats.imageOps === 0,
        stats.imageOps === 0
          ? 'Zero image XObjects: nothing in the document is a picture of text.'
          : `${stats.imageOps} image operation(s) found.`,
      );
      record(
        'layout.text-operators',
        'Visible text uses text operators',
        stats.textOps > 0,
        `${stats.textOps} text-showing operation(s), ${stats.pathOps} vector path operation(s).`,
      );
      record(
        'layout.no-table-grid',
        'No table grid',
        stats.ruleOps <= 24,
        `${stats.ruleOps} filled rectangle(s); section rules only, no cell grid.`,
      );
    }
  }

  // 16 — bullets are a plain, allow-listed character drawn with the body font.
  if (expected.bulletChar) {
    const occurrences = text.split(expected.bulletChar).length - 1;
    record(
      'content.bullets',
      'Bullets are real text',
      occurrences >= (expected.minimumBullets ?? 1),
      `${occurrences} "${expected.bulletChar}" character(s) extracted as text.`,
    );
  }

  // 18 — every heading shares one style.
  {
    const headingItems = inspection.items.filter((item) => isHeadingLine(item.str));
    const styles = new Set(headingItems.map((item) => `${item.fontName}@${item.height.toFixed(1)}`));
    record(
      'layout.heading-consistency',
      'Headings share one style',
      styles.size <= 1,
      styles.size <= 1
        ? `${headingItems.length} heading run(s), all with identical font and size.`
        : `${styles.size} distinct heading styles: ${[...styles].join(', ')}.`,
    );
  }

  // 21 — nothing repeats on every page (the header/footer failure mode).
  {
    if (inspection.pages.length >= 2) {
      const counts = new Map();
      for (const page of inspection.pages) {
        for (const line of new Set(page.lines.map((line) => normalise(line)).filter(Boolean))) {
          counts.set(line, (counts.get(line) ?? 0) + 1);
        }
      }
      const repeated = [...counts.entries()].filter(([, count]) => count === inspection.pages.length);
      record(
        'layout.no-repeated-chrome',
        'No text repeats on every page',
        repeated.length === 0,
        repeated.length === 0
          ? 'Nothing is duplicated across pages; there is no header or footer content.'
          : `Repeated on all ${inspection.pages.length} pages: ${repeated.map(([line]) => `"${line}"`).join(', ')}.`,
      );
    }
  }

  // 22 — no faux bold: the same string must not be drawn twice at one position.
  {
    const seen = new Map();
    let duplicates = 0;
    for (const item of inspection.items) {
      const key = `${item.page}|${item.x.toFixed(1)}|${item.y.toFixed(1)}|${normalise(item.str)}`;
      if (seen.has(key)) duplicates += 1;
      seen.set(key, true);
    }
    record(
      'layout.no-faux-bold',
      'No text drawn twice at one position',
      duplicates === 0,
      duplicates === 0 ? 'Each visible string is drawn exactly once.' : `${duplicates} duplicated run(s).`,
    );
  }

  // 25 — section attribution: content lands under its own heading.
  if (Array.isArray(expected.attribution) && expected.attribution.length > 0) {
    const sections = new Map();
    let current = null;
    for (const page of inspection.pages) {
      for (const line of page.lines) {
        const value = normalise(line);
        if (isHeadingLine(value)) {
          current = value.toLowerCase();
          if (!sections.has(current)) sections.set(current, []);
        } else if (current) {
          sections.get(current).push(value);
        }
      }
    }
    const failures = [];
    for (const rule of expected.attribution) {
      const body = (sections.get(rule.heading.toLowerCase()) ?? []).join(' \n ').toLowerCase();
      const included = !rule.includes || body.includes(rule.includes.toLowerCase());
      const excluded = !rule.excludes || !body.includes(rule.excludes.toLowerCase());
      if (!included) failures.push(`"${rule.includes}" is not under ${rule.heading}`);
      if (!excluded) failures.push(`"${rule.excludes}" leaked into ${rule.heading}`);
    }
    record(
      'structure.attribution',
      'Content is attributed to the right section',
      failures.length === 0,
      failures.length === 0
        ? `${expected.attribution.length} attribution rule(s) hold.`
        : failures.join('; '),
    );
  }

  // 26 — multi-page integrity: no heading stranded at the bottom of a page.
  {
    const problems = [];
    for (const page of inspection.pages) {
      const lines = page.lines.map((line) => normalise(line)).filter(Boolean);
      if (lines.length === 0) continue;
      const last = lines[lines.length - 1];
      // Only the final page may end on a heading; anywhere else means the
      // section's content was pushed to the next page.
      const isLastPage = page.pageNumber === inspection.pages.length;
      if (!isLastPage && isHeadingLine(last)) {
        problems.push(`page ${page.pageNumber} ends with the heading "${last}"`);
      }
    }
    record(
      'layout.page-integrity',
      'No heading is stranded at a page bottom',
      problems.length === 0,
      problems.length === 0
        ? 'Every heading is followed by its content on the same page.'
        : problems.join('; '),
    );
  }

  // 28 — the file is not encrypted.
  record(
    'file.not-encrypted',
    'Not encrypted or password protected',
    !inspection.encrypted,
    inspection.encrypted ? 'The PDF is encrypted; text extraction may fail.' : 'No encryption dictionary.',
  );

  // Rich features: clickable links, outline, metadata.
  if (expected.expectLinks) {
    const uris = inspection.links.filter((link) => link.kind === 'uri' && link.url);
    const required = (expected.requiredLinkHosts ?? []).map((host) => host.toLowerCase());
    const missing = required.filter(
      (host) => !uris.some((link) => String(link.url).toLowerCase().includes(host)),
    );
    record(
      'interactive.link-annotations',
      'Hyperlinks are real link annotations',
      uris.length >= (expected.minimumLinks ?? 1) && missing.length === 0,
      `${uris.length} URI annotation(s)` + (missing.length ? `, missing hosts: ${missing.join(', ')}` : '') + '.',
    );
  }

  if (expected.expectOutline) {
    record(
      'interactive.outline',
      'Document outline (bookmarks) present',
      inspection.outline.length >= (expected.minimumOutline ?? 1),
      inspection.outline.length > 0
        ? `${inspection.outline.length} bookmark(s): ${inspection.outline
            .slice(0, 6)
            .map((node) => node.title)
            .join(' / ')}.`
        : 'No outline was written.',
    );
  }

  if (expected.expectMetadata) {
    const info = inspection.metadata ?? {};
    const hasTitle = Boolean(normalise(info.Title));
    const hasAuthor = Boolean(normalise(info.Author));
    record(
      'interactive.metadata',
      'Document metadata is set',
      hasTitle,
      `Title: "${normalise(info.Title) || '(none)'}", Author: "${normalise(info.Author) || '(none)'}", ` +
        `Creator: "${normalise(info.Creator) || '(none)'}".`,
    );
    void hasAuthor;
  }

  return results;
}

export { HEADING_VOCABULARY, STANDARD_14, isRecognisedHeading };
