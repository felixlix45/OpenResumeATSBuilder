/**
 * PDF generation entry point.
 *
 * Everything is client-side: no server, no upload, no account. The same module
 * powers the live preview, the download button and the automated ATS checks, so
 * what the user checks is byte-for-byte what they download.
 */

import { pdf } from '@react-pdf/renderer';
import { encodeResume } from '../domain/encoding';
import type { ResumeData } from '../domain/types';
import { ResumeDocument } from './ResumeDocument';

export interface GeneratedPdf {
  blob: Blob;
  bytes: number;
  /** Characters the standard-14 fonts could not print, reported to the user. */
  droppedCharacters: string[];
  /** True when the file is larger than the strictest documented parse cap. */
  exceedsSizeLimit: boolean;
}

/**
 * Greenhouse accepts uploads up to 100 MB but documents that it cannot parse a
 * resume larger than 2.5 MB — the strictest published ceiling found in research.
 */
export const MAX_PARSEABLE_BYTES = 2.5 * 1024 * 1024;

/** A stable, human-readable file name such as `Alex-Morgan-Resume.pdf`. */
export function resumeFileName(data: ResumeData): string {
  const slug = (value: string) =>
    value
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Za-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60);
  const name = slug(data.basics.fullName) || 'Resume';
  const headline = slug(data.basics.headline);
  return `${[name, headline].filter(Boolean).join('-')}-Resume.pdf`;
}

/** Renders the resume to a PDF blob in the browser. */
export async function generateResumePdf(data: ResumeData): Promise<GeneratedPdf> {
  const { data: encoded, dropped } = encodeResume(data);
  const blob = await pdf(<ResumeDocument data={encoded} />).toBlob();
  return {
    blob,
    bytes: blob.size,
    droppedCharacters: dropped,
    exceedsSizeLimit: blob.size > MAX_PARSEABLE_BYTES,
  };
}

/** Triggers a browser download for an already-generated blob. */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Give the browser a moment to start the download before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Opens the generated PDF in a new tab, for printing or sharing. */
export function openBlobInNewTab(blob: Blob): void {
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank', 'noopener');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
