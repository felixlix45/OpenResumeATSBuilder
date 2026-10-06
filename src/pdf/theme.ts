/**
 * Design tokens for the rendered PDF.
 *
 * Every value is derived from the user's settings, so the analyser and the
 * renderer can never disagree about — for example — the printed body size.
 */

import { TEMPLATE_MAP } from '../domain/templates';
import type { ResumeSettings } from '../domain/types';

export interface PdfTheme {
  fontFamily: string;
  /** Points. */
  sizes: {
    name: number;
    headline: number;
    contact: number;
    heading: number;
    body: number;
    meta: number;
    small: number;
  };
  colors: {
    text: string;
    muted: string;
    accent: string;
    rule: string;
  };
  /** Points of vertical rhythm. */
  space: {
    section: number;
    entry: number;
    bullet: number;
    line: number;
  };
  page: {
    size: 'LETTER' | 'A4';
    /** Points of page padding, converted from inches. */
    padding: number;
  };
  /** Whether headings are printed in the accent colour. */
  accentHeadings: boolean;
  uppercaseHeadings: boolean;
  headingRule: boolean;
  bulletChar: string;
}

const POINTS_PER_INCH = 72;

export function buildTheme(settings: ResumeSettings): PdfTheme {
  const template = TEMPLATE_MAP[settings.templateId];
  const scale = settings.fontScale;
  const base = template.baseFontSize * scale;
  const serif = settings.fontFamily === 'Times-Roman';

  return {
    fontFamily: settings.fontFamily,
    sizes: {
      name: Math.round((serif ? 19 : 18.5) * scale * 10) / 10,
      headline: Math.round((base + 1.2) * 10) / 10,
      contact: Math.round((base - 0.8) * 10) / 10,
      heading: Math.round((base + 0.3) * 10) / 10,
      body: Math.round(base * 10) / 10,
      meta: Math.round(base * 10) / 10,
      small: Math.round(Math.max(8.5, base - 1.2) * 10) / 10,
    },
    colors: {
      text: '#14161A',
      muted: '#454B57',
      accent: settings.accentColor,
      rule: '#B9BFC9',
    },
    space: {
      section: Math.round(settings.sectionSpacing * template.spacingFactor * 10) / 10,
      entry: Math.round(6 * template.spacingFactor * 10) / 10,
      bullet: Math.round(2.4 * template.spacingFactor * 10) / 10,
      line: settings.lineHeight,
    },
    page: {
      size: settings.pageSize,
      padding: Math.round(settings.margin * POINTS_PER_INCH * 10) / 10,
    },
    accentHeadings: template.usesAccentHeadings,
    uppercaseHeadings: settings.uppercaseHeadings,
    headingRule: settings.headingRule,
    bulletChar: settings.bulletChar,
  };
}
