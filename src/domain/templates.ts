/**
 * Resume template metadata.
 *
 * Shared by the PDF renderer and the ATS analyser so that a claim like "body
 * text is 10 pt or larger" can be verified against the same number the renderer
 * actually uses.
 */

import type { TemplateId } from './types';

export interface TemplateMeta {
  id: TemplateId;
  name: string;
  /** One-line description shown in the template picker. */
  description: string;
  /** Body font size in points before `settings.fontScale` is applied. */
  baseFontSize: number;
  /** Multiplier applied to the section spacing for this template. */
  spacingFactor: number;
  /** Whether the accent colour is used for anything beyond the name and rules. */
  usesAccentHeadings: boolean;
  /** Who the template suits, shown as a hint. */
  bestFor: string;
}

export const TEMPLATES: TemplateMeta[] = [
  {
    id: 'classic',
    name: 'Classic',
    description: 'Centred header, ruled section headings, maximum parser familiarity.',
    baseFontSize: 10.5,
    spacingFactor: 1,
    usesAccentHeadings: true,
    bestFor: 'Most roles, especially finance, law, government and large enterprises.',
  },
  {
    id: 'modern',
    name: 'Modern',
    description: 'Left-aligned header with an accent name, tight metadata line.',
    baseFontSize: 10.5,
    spacingFactor: 1.05,
    usesAccentHeadings: true,
    bestFor: 'Technology, product and design roles at smaller companies.',
  },
  {
    id: 'compact',
    name: 'Compact',
    description: 'Denser leading and tighter margins to fit more history on one page.',
    baseFontSize: 10,
    spacingFactor: 0.85,
    usesAccentHeadings: false,
    bestFor: '10+ years of experience, or when a strict one-page limit applies.',
  },
  {
    id: 'elegant',
    name: 'Elegant',
    description: 'Serif typography with generous leading for senior and academic roles.',
    baseFontSize: 10.5,
    spacingFactor: 1.15,
    usesAccentHeadings: false,
    bestFor: 'Senior leadership, academia, publishing and consulting.',
  },
];

export const TEMPLATE_MAP: Record<TemplateId, TemplateMeta> = TEMPLATES.reduce(
  (accumulator, template) => {
    accumulator[template.id] = template;
    return accumulator;
  },
  {} as Record<TemplateId, TemplateMeta>,
);
