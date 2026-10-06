/** Types for the plain-JS PDF inspection core, shared by tests and the CLI. */

export interface TextRun {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontName: string | null;
  page: number;
}

export interface PdfPage {
  pageNumber: number;
  width: number;
  height: number;
  lines: string[];
  items: TextRun[];
}

export interface PdfLink {
  url: string | null;
  kind: 'uri' | 'internal';
  rect: number[] | null;
  page: number;
}

export interface OutlineNode {
  title: string;
  depth: number;
}

export interface OperatorStats {
  textOps: number;
  imageOps: number;
  pathOps: number;
  ruleOps: number;
  otherOps: number;
}

export interface Inspection {
  pageCount: number;
  pages: PdfPage[];
  items: TextRun[];
  pageText: string[];
  text: string;
  links: PdfLink[];
  outline: OutlineNode[];
  metadata: Record<string, unknown> & { Title?: string; Author?: string; Creator?: string };
  encrypted: boolean;
  fingerprints: unknown;
  operatorStats: OperatorStats | null;
}

export function groupIntoLines(
  items: TextRun[],
  tolerance?: number,
): Array<{ y: number; text: string; items: TextRun[] }>;

export function verticalExtent(items: TextRun[]): { top: number; bottom: number };

export function inspectPdfDocument(
  doc: unknown,
  options?: { ops?: Record<string, number> },
): Promise<Inspection>;

export function attributeSections(
  inspection: Inspection,
  isHeading: (line: string) => boolean,
): Array<{ heading: string | null; lines: string[] }>;

export function repeatedLines(inspection: Inspection): string[];
