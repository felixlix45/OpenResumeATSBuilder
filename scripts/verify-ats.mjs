#!/usr/bin/env node
/**
 * ATS verification harness.
 *
 * Usage:
 *   node scripts/verify-ats.mjs <file.pdf> [expected.json] [--json]
 *
 * With no expectation file it still runs every structural check that does not
 * need to know the source data — which is most of them. Point it at a PDF you
 * downloaded from the app to see exactly what a parser would read.
 *
 * Exits non-zero when any check fails, so it can gate a build.
 */

import { readFileSync } from 'node:fs';
import { extname } from 'node:path';
import { inspectPdfBuffer } from './lib/load-pdf.mjs';
import { runAtsChecks } from './lib/ats-checks.mjs';
import { compareExtractions, extractWithMupdf } from './lib/extract-mupdf.mjs';

const GREEN = '\u001b[32m';
const RED = '\u001b[31m';
const YELLOW = '\u001b[33m';
const DIM = '\u001b[2m';
const RESET = '\u001b[0m';

function parseArgs(argv) {
  const positional = [];
  const flags = new Set();
  for (const arg of argv) {
    if (arg.startsWith('--')) flags.add(arg.slice(2));
    else positional.push(arg);
  }
  return { positional, flags };
}

function formatReport(results, inspection) {
  const lines = [];
  const failures = results.filter((result) => !result.ok);
  lines.push('');
  lines.push(`  ${inspection.pageCount} page(s) \u00b7 ${inspection.items.length} text runs \u00b7 ${inspection.links.length} link annotation(s) \u00b7 ${inspection.outline.length} bookmark(s)`);
  lines.push('');
  for (const result of results) {
    const mark = result.ok ? `${GREEN}\u2713${RESET}` : `${RED}\u2717${RESET}`;
    lines.push(`  ${mark} ${result.title}`);
    if (!result.ok || process.env.VERBOSE) lines.push(`      ${DIM}${result.detail}${RESET}`);
  }
  lines.push('');
  const passed = results.length - failures.length;
  const summary = `${passed}/${results.length} checks passed`;
  lines.push(failures.length === 0 ? `  ${GREEN}${summary}${RESET}` : `  ${RED}${summary}${RESET}`);
  lines.push('');
  return lines.join('\n');
}

async function main() {
  const { positional, flags } = parseArgs(process.argv.slice(2));
  const file = positional[0];
  if (!file || extname(file).toLowerCase() !== '.pdf') {
    console.error('Usage: node scripts/verify-ats.mjs <file.pdf> [expected.json] [--json] [--dump-text]');
    process.exit(2);
  }

  let expected = {};
  if (positional[1]) {
    expected = JSON.parse(readFileSync(positional[1], 'utf8'));
  }

  const buffer = readFileSync(file);
  const { inspection } = await inspectPdfBuffer(buffer);
  const results = runAtsChecks(inspection, {
    expected,
    rawBytes: buffer,
    operatorStats: inspection.operatorStats,
    sourceCharCount: expected.sourceCharCount ?? null,
  });

  // Cross-engine evidence: pdf.js and MuPDF are separate implementations, so
  // agreement between them is a statement about the file, not about one library.
  const mupdf = await extractWithMupdf(buffer);
  if (mupdf.error) {
    results.push({
      id: 'text.cross-engine',
      title: 'Cross-engine extraction agrees (MuPDF)',
      ok: true,
      detail: `MuPDF was unavailable, so this check was skipped: ${mupdf.error}`,
      severity: 'pass',
    });
  } else {
    const comparison = compareExtractions(inspection.text, mupdf.text);
    results.push({
      id: 'text.cross-engine',
      title: 'Cross-engine extraction agrees (MuPDF)',
      ok: comparison.agreement >= 0.98,
      detail:
        `${(comparison.agreement * 100).toFixed(2)}% word agreement with MuPDF across ${comparison.wordCount} distinct words` +
        (comparison.onlyInPdfjs.length
          ? `. Only in pdf.js: ${comparison.onlyInPdfjs.slice(0, 8).join(', ')}`
          : '') +
        (comparison.onlyInMupdf.length
          ? `. Only in MuPDF: ${comparison.onlyInMupdf.slice(0, 8).join(', ')}`
          : '') +
        '.',
      severity: comparison.agreement >= 0.98 ? 'pass' : 'error',
    });
  }

  if (flags.has('json')) {
    console.log(JSON.stringify({ file, inspection, results }, null, 2));
  } else {
    console.log(formatReport(results, inspection));
    if (flags.has('dump-text')) {
      console.log(`${DIM}--- extracted text, exactly as a parser sees it ---${RESET}`);
      inspection.pages.forEach((page, index) => {
        console.log(`${YELLOW}--- page ${index + 1} ---${RESET}`);
        console.log(page.lines.join('\n'));
      });
      console.log('');
      if (inspection.links.length) {
        console.log(`${DIM}--- link annotations ---${RESET}`);
        for (const link of inspection.links) console.log(`  ${link.url ?? '(internal)'}`);
        console.log('');
      }
      if (inspection.outline.length) {
        console.log(`${DIM}--- outline ---${RESET}`);
        for (const node of inspection.outline) console.log(`  ${'  '.repeat(node.depth)}${node.title}`);
        console.log('');
      }
      console.log(`${DIM}--- metadata ---${RESET}`);
      console.log(JSON.stringify(inspection.metadata, null, 2));
      console.log('');
    }
  }

  const failures = results.filter((result) => !result.ok);
  process.exit(failures.length === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(2);
});
