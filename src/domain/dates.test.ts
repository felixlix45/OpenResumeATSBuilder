import { describe, expect, it } from 'vitest';
import {
  formatDateRange,
  formatDateValue,
  isFutureDate,
  parseDateValue,
  rangeIsInverted,
  recencyKey,
} from './dates';

describe('parseDateValue', () => {
  it('parses the shapes a resume actually contains', () => {
    expect(parseDateValue('2021-03')).toEqual({ year: 2021, month: 3, day: undefined });
    expect(parseDateValue('2021')).toEqual({ year: 2021, month: undefined, day: undefined });
    expect(parseDateValue('2021-03-14')).toEqual({ year: 2021, month: 3, day: 14 });
    expect(parseDateValue('03/2021')).toEqual({ year: 2021, month: 3 });
    expect(parseDateValue('Mar 2021')).toEqual({ year: 2021, month: 3 });
    expect(parseDateValue('March 2021')).toEqual({ year: 2021, month: 3 });
    expect(parseDateValue('Sept 2021')).toEqual({ year: 2021, month: 9 });
    expect(parseDateValue('Mar-2021')).toEqual({ year: 2021, month: 3 });
    expect(parseDateValue('2021 Mar')).toEqual({ year: 2021, month: 3 });
  });

  it('returns null for free text rather than guessing', () => {
    expect(parseDateValue('Summer 2019')).toBeNull();
    expect(parseDateValue('ongoing')).toBeNull();
    expect(parseDateValue('')).toBeNull();
    expect(parseDateValue('2021-13')).toBeNull();
    expect(parseDateValue('1799')).toBeNull();
  });
});

describe('formatDateValue', () => {
  it('honours the requested precision', () => {
    expect(formatDateValue('2021-03', 'MMM YYYY')).toBe('Mar 2021');
    expect(formatDateValue('2021-03', 'MMMM YYYY')).toBe('March 2021');
    expect(formatDateValue('2021-03', 'MM/YYYY')).toBe('03/2021');
    expect(formatDateValue('2021-03', 'YYYY')).toBe('2021');
    expect(formatDateValue('2021', 'MMM YYYY')).toBe('2021');
  });

  it('passes unparseable text straight through', () => {
    expect(formatDateValue('Summer 2019', 'MMM YYYY')).toBe('Summer 2019');
  });
});

describe('formatDateRange', () => {
  it('joins a normal range with an em dash', () => {
    expect(formatDateRange({ start: '2018-06', end: '2021-02', current: false }, 'MMM YYYY')).toBe(
      'Jun 2018 \u2014 Feb 2021',
    );
  });

  it('prints Present for a current role even when an end date exists', () => {
    expect(formatDateRange({ start: '2021-03', end: '2099-01', current: true }, 'MMM YYYY')).toBe(
      'Mar 2021 \u2014 Present',
    );
  });

  it('degrades gracefully when only one side is known', () => {
    expect(formatDateRange({ start: '2021-03', end: '', current: false }, 'MMM YYYY')).toBe('Mar 2021');
    expect(formatDateRange({ start: '', end: '2021-03', current: false }, 'MMM YYYY')).toBe('Mar 2021');
    expect(formatDateRange({ start: '', end: '', current: false }, 'MMM YYYY')).toBe('');
  });
});

describe('validation helpers', () => {
  it('detects inverted ranges but not unresolvable ones', () => {
    expect(rangeIsInverted('2021-03', '2020-01')).toBe(true);
    expect(rangeIsInverted('2018-06', '2021-02')).toBe(false);
    expect(rangeIsInverted('Summer 2019', '2021-02')).toBe(false);
  });

  it('detects future dates relative to a fixed clock', () => {
    const now = new Date('2026-01-15T00:00:00Z');
    expect(isFutureDate('2027-01', now)).toBe(true);
    expect(isFutureDate('2025-01', now)).toBe(false);
    expect(isFutureDate('not a date', now)).toBe(false);
  });

  it('sorts current roles above everything and undated entries last', () => {
    const current = recencyKey({ start: '2021-03', end: '', current: true });
    const dated = recencyKey({ start: '2018-06', end: '2021-02', current: false });
    const undated = recencyKey({ start: '', end: '', current: false });
    expect(current).toBeGreaterThan(dated);
    expect(dated).toBeGreaterThan(undated);
  });
});
