/** Types for the ATS assertion suite. */

import type { Inspection, OperatorStats } from './pdf-core.mjs';

export interface AttributionRule {
  heading: string;
  includes?: string;
  excludes?: string;
}

export interface AtsExpectations {
  fullName?: string;
  email?: string;
  phone?: string;
  headings?: string[];
  keywords?: string[];
  attribution?: AttributionRule[];
  bulletChar?: string;
  minimumBullets?: number;
  minimumSpelledRanges?: number;
  expectLinks?: boolean;
  minimumLinks?: number;
  requiredLinkHosts?: string[];
  expectOutline?: boolean;
  minimumOutline?: number;
  expectMetadata?: boolean;
  sourceCharCount?: number;
}

export interface CheckResult {
  id: string;
  title: string;
  ok: boolean;
  detail: string;
  severity: 'pass' | 'error' | 'warning';
}

export interface AtsCheckContext {
  expected?: AtsExpectations;
  rawBytes?: Uint8Array | Buffer | null;
  operatorStats?: OperatorStats | null;
  sourceCharCount?: number | null;
}

export function runAtsChecks(inspection: Inspection, context?: AtsCheckContext): CheckResult[];

export const HEADING_VOCABULARY: string[];
export const STANDARD_14: string[];
export function isRecognisedHeading(line: string): boolean;
export function isHeadingLine(line: string): boolean;
