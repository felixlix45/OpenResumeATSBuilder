/** Result types for the ATS analyser. */

export type CheckStatus = 'pass' | 'warn' | 'fail' | 'info';

export type CheckCategory = 'identity' | 'structure' | 'content' | 'formatting' | 'keywords';

/** Where a check wants the editor to navigate when the user clicks "Show me". */
export interface CheckTarget {
  sectionId?: string;
  entryId?: string;
  field?: string;
}

export interface Check {
  id: string;
  category: CheckCategory;
  /** Short imperative title, e.g. "Every job needs dates". */
  title: string;
  status: CheckStatus;
  /** Why this matters for a parser or a recruiter. Never blame the user. */
  detail: string;
  /** The concrete next action, when there is one. */
  fix?: string;
  target?: CheckTarget;
  /** Relative importance in the score, 1–3. */
  weight: number;
}

export interface CheckCounts {
  pass: number;
  warn: number;
  fail: number;
  info: number;
}

export type Grade = 'excellent' | 'good' | 'fair' | 'needs-work';

export interface AnalysisInput {
  jobDescription?: string;
  /** Page count of the rendered PDF, when it has been rendered. */
  pageCount?: number | null;
}

export interface AnalysisResult {
  checks: Check[];
  counts: CheckCounts;
  /** 0–100. Only pass/warn/fail checks contribute; `info` never scores. */
  score: number;
  grade: Grade;
  /** Number of words a parser will see. */
  wordCount: number;
  keywords: import('./keywords').KeywordReport | null;
}

export const CATEGORY_LABELS: Record<CheckCategory, string> = {
  identity: 'Contact & identity',
  structure: 'Structure',
  content: 'Content',
  formatting: 'Formatting',
  keywords: 'Job description match',
};

export const CATEGORY_ORDER: CheckCategory[] = [
  'identity',
  'structure',
  'content',
  'formatting',
  'keywords',
];
