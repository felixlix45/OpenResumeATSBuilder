#!/usr/bin/env node
/**
 * Copies pdf.js's standard-14 font data into `public/`.
 *
 * pdf.js needs these metrics to lay out text that uses the PDF standard fonts —
 * which is every resume this app produces. Without them the preview renders with
 * substituted fonts and stops being a faithful preview of the download.
 *
 * Runs automatically before `dev` and `build`.
 */

import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';

const require = createRequire(import.meta.url);
const projectRoot = resolve(dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');

const source = join(dirname(require.resolve('pdfjs-dist/package.json')), 'standard_fonts');
const target = join(projectRoot, 'public', 'pdfjs', 'standard_fonts');

if (!existsSync(source)) {
  console.error(`[sync-pdfjs-assets] standard_fonts not found at ${source}`);
  process.exit(1);
}

mkdirSync(dirname(target), { recursive: true });
rmSync(target, { recursive: true, force: true });
cpSync(source, target, { recursive: true });

console.log(`[sync-pdfjs-assets] copied standard fonts to public/pdfjs/standard_fonts`);
