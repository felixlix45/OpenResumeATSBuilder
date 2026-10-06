/**
 * Date parsing and formatting.
 *
 * A resume date is *whatever the user typed*. We never reject free text — we
 * only try to recognise the common machine formats so the document can be
 * printed consistently. Anything unrecognised is printed back verbatim, which is
 * the behaviour a user expects and keeps the PDF honest.
 */

import type { DateFormat } from './types';

export interface ParsedDate {
  year: number;
  /** 1–12, or undefined when only a year was given. */
  month?: number;
  day?: number;
}

const MONTHS_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

const MONTHS_LONG = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

const MONTH_LOOKUP = new Map<string, number>();
MONTHS_SHORT.forEach((name, index) => MONTH_LOOKUP.set(name.toLowerCase(), index + 1));
MONTHS_LONG.forEach((name, index) => MONTH_LOOKUP.set(name.toLowerCase(), index + 1));
MONTH_LOOKUP.set('sept', 9);

function validMonth(month: number): boolean {
  return Number.isInteger(month) && month >= 1 && month <= 12;
}

function validYear(year: number): boolean {
  return Number.isInteger(year) && year >= 1900 && year <= 2199;
}

/**
 * Recognises `2021`, `2021-03`, `2021-03-14`, `03/2021`, `3.2021`,
 * `Mar 2021`, `March 2021`, `Mar-2021`, `2021 Mar`.
 */
export function parseDateValue(raw: string): ParsedDate | null {
  const value = raw.trim();
  if (!value) return null;

  const iso = /^(\d{4})(?:-(\d{1,2})(?:-(\d{1,2}))?)?$/.exec(value);
  if (iso) {
    const year = Number(iso[1]);
    const month = iso[2] ? Number(iso[2]) : undefined;
    const day = iso[3] ? Number(iso[3]) : undefined;
    if (!validYear(year)) return null;
    if (month !== undefined && !validMonth(month)) return null;
    return { year, month, day };
  }

  const numeric = /^(\d{1,2})[/.](\d{4})$/.exec(value);
  if (numeric) {
    const month = Number(numeric[1]);
    const year = Number(numeric[2]);
    if (!validYear(year) || !validMonth(month)) return null;
    return { year, month };
  }

  const named = /^([A-Za-z]{3,9})[\s,.-]+(\d{4})$/.exec(value);
  if (named) {
    const month = MONTH_LOOKUP.get(named[1].toLowerCase());
    const year = Number(named[2]);
    if (month === undefined || !validYear(year)) return null;
    return { year, month };
  }

  const namedTrailing = /^(\d{4})[\s,.-]+([A-Za-z]{3,9})$/.exec(value);
  if (namedTrailing) {
    const year = Number(namedTrailing[1]);
    const month = MONTH_LOOKUP.get(namedTrailing[2].toLowerCase());
    if (month === undefined || !validYear(year)) return null;
    return { year, month };
  }

  return null;
}

function monthName(month: number, long: boolean): string {
  const table = long ? MONTHS_LONG : MONTHS_SHORT;
  return table[month - 1] ?? '';
}

/** Formats a single raw date. Unparseable values are returned unchanged. */
export function formatDateValue(raw: string, format: DateFormat): string {
  const parsed = parseDateValue(raw);
  if (!parsed) return raw.trim();
  switch (format) {
    case 'YYYY':
      return String(parsed.year);
    case 'MM/YYYY':
      return parsed.month ? `${String(parsed.month).padStart(2, '0')}/${parsed.year}` : String(parsed.year);
    case 'MMMM YYYY':
      return parsed.month ? `${monthName(parsed.month, true)} ${parsed.year}` : String(parsed.year);
    case 'MMM YYYY':
    default:
      return parsed.month ? `${monthName(parsed.month, false)} ${parsed.year}` : String(parsed.year);
  }
}

export interface DateRangeInput {
  start: string;
  end: string;
  current: boolean;
}

const PRESENT_WORD = 'Present';

/**
 * Builds the printed date range, e.g. `"Mar 2021 — Present"`.
 *
 * The separator is an em dash surrounded by spaces: it survives text extraction
 * as a single unambiguous token and reads correctly to a human.
 */
export function formatDateRange(input: DateRangeInput, format: DateFormat): string {
  const start = formatDateValue(input.start, format);
  const end = input.current ? PRESENT_WORD : formatDateValue(input.end, format);
  if (start && end) return `${start} \u2014 ${end}`;
  if (start) return input.current ? `${start} \u2014 ${PRESENT_WORD}` : start;
  if (end) return end;
  return '';
}

function sortKey(parsed: ParsedDate): number {
  return parsed.year * 100 + (parsed.month ?? 0);
}

/**
 * Sort key for "most recent first" ordering. Entries with a current role or an
 * unparseable date sort last rather than being dropped, so nothing disappears
 * from the document when a date is malformed.
 */
export function recencyKey(input: DateRangeInput): number {
  if (input.current) return Number.MAX_SAFE_INTEGER;
  const end = parseDateValue(input.end) ?? parseDateValue(input.start);
  if (!end) return -1;
  return sortKey(end);
}

/** True when the range is internally inconsistent (end before start). */
export function rangeIsInverted(start: string, end: string): boolean {
  const a = parseDateValue(start);
  const b = parseDateValue(end);
  if (!a || !b) return false;
  return sortKey(b) < sortKey(a);
}

/** True when the date is in the future relative to `now`. */
export function isFutureDate(raw: string, now = new Date()): boolean {
  const parsed = parseDateValue(raw);
  if (!parsed) return false;
  const nowKey = now.getFullYear() * 100 + (now.getMonth() + 1);
  return sortKey(parsed) > nowKey;
}
