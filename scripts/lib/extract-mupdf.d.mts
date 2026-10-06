/** Types for the MuPDF-based independent extractor. */

export interface MupdfExtraction {
  engine: 'mupdf';
  pageCount?: number;
  pages?: string[];
  text?: string;
  error?: string;
}

export interface ExtractionComparison {
  /** Share of distinct words both engines agree on, 0–1. */
  agreement: number;
  onlyInPdfjs: string[];
  onlyInMupdf: string[];
  wordCount: number;
}

export function normaliseForComparison(text: string): string;

export function extractWithMupdf(buffer: Uint8Array): Promise<MupdfExtraction>;

export function compareExtractions(a: string, b: string): ExtractionComparison;
