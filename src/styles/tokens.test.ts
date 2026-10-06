/**
 * Contrast verification for the design tokens.
 *
 * This test parses `tokens.css` and recomputes every pairing the UI actually
 * uses. It exists because contrast regressions are invisible in review: a hex
 * value that looks fine in a screenshot can fail WCAG 2.2 SC 1.4.3 for a real
 * user, and nobody notices until an audit.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { contrastRatio } from '../ats/analyze';

function parseTokens(css: string): Record<string, Record<string, string>> {
  const themes: Record<string, Record<string, string>> = { light: {}, dark: {} };
  const blocks = css.split('}');
  let scope: 'both' | 'dark' = 'both';
  for (const rawBlock of blocks) {
    const [selectorPart, body] = rawBlock.split('{');
    if (!body) continue;
    if (selectorPart.includes("[data-theme='dark']")) scope = 'dark';
    else if (selectorPart.includes(':root')) scope = 'both';
    for (const match of body.matchAll(/(--[a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{6})/g)) {
      if (scope === 'both') themes.light[match[1]] = match[2];
      themes.dark[match[1]] = match[2];
    }
  }

  // The dark block only redefines some tokens; fill the rest from light.
  for (const key of Object.keys(themes.light)) {
    if (!themes.dark[key]) themes.dark[key] = themes.light[key];
  }
  return themes;
}

const css = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8');
const themes = parseTokens(css);

/** Pairings that must hold. `min` is the WCAG 2.2 threshold that applies. */
const PAIRS: Array<{ fg: string; bg: string; min: number; why: string }> = [
  { fg: '--color-ink', bg: '--color-surface', min: 4.5, why: 'body text on panels' },
  { fg: '--color-ink', bg: '--color-canvas', min: 4.5, why: 'body text on the app background' },
  { fg: '--color-ink-secondary', bg: '--color-surface', min: 4.5, why: 'secondary text on panels' },
  { fg: '--color-ink-secondary', bg: '--color-canvas', min: 4.5, why: 'secondary text on the app background' },
  { fg: '--color-ink-muted', bg: '--color-surface', min: 4.5, why: 'hints and helper text on panels' },
  { fg: '--color-ink-muted', bg: '--color-canvas', min: 4.5, why: 'hints on the app background' },
  { fg: '--color-ink-muted', bg: '--color-surface-sunken', min: 4.5, why: 'hints inside sunken wells' },
  { fg: '--color-accent', bg: '--color-surface', min: 4.5, why: 'links and primary text actions' },
  { fg: '--color-accent', bg: '--color-canvas', min: 4.5, why: 'links on the app background' },
  { fg: '--color-accent-ink', bg: '--color-accent-soft', min: 4.5, why: 'accent text on the soft accent chip' },
  { fg: '--color-success', bg: '--color-success-soft', min: 4.5, why: 'passing check labels' },
  { fg: '--color-success', bg: '--color-surface', min: 4.5, why: 'passing check labels on panels' },
  { fg: '--color-warning', bg: '--color-warning-soft', min: 4.5, why: 'warning check labels' },
  { fg: '--color-warning', bg: '--color-surface', min: 4.5, why: 'warning check labels on panels' },
  { fg: '--color-danger', bg: '--color-danger-soft', min: 4.5, why: 'failing check labels' },
  { fg: '--color-danger', bg: '--color-surface', min: 4.5, why: 'failing check labels on panels' },
  { fg: '--color-info', bg: '--color-info-soft', min: 4.5, why: 'informational check labels' },
  { fg: '--color-border-input', bg: '--color-surface', min: 3, why: 'WCAG 1.4.11 non-text contrast for control borders' },
  { fg: '--color-border-strong', bg: '--color-canvas', min: 3, why: 'WCAG 1.4.11 non-text contrast on the canvas' },
  { fg: '--color-focus-ring', bg: '--color-surface', min: 3, why: 'focus indicator visibility' },
  { fg: '--color-focus-ring', bg: '--color-canvas', min: 3, why: 'focus indicator visibility on the canvas' },
];

describe('design token contrast', () => {
  for (const theme of ['light', 'dark'] as const) {
    const tokens = themes[theme];
    for (const pair of PAIRS) {
      it(`${theme}: ${pair.fg} on ${pair.bg} meets ${pair.min}:1 (${pair.why})`, () => {
        const fg = tokens[pair.fg];
        const bg = tokens[pair.bg];
        expect(fg, `${pair.fg} is not defined`).toBeTruthy();
        expect(bg, `${pair.bg} is not defined`).toBeTruthy();
        const ratio = contrastRatio(fg, bg);
        expect(ratio, `${pair.fg} ${fg} on ${pair.bg} ${bg} = ${ratio?.toFixed(2)}:1`).toBeGreaterThanOrEqual(
          pair.min,
        );
      });
    }
  }

  it('keeps the paper white in both themes', () => {
    expect(tokensOrNull(themes.light, '--paper')).toBe('#ffffff');
    expect(tokensOrNull(themes.dark, '--paper')).toBe('#ffffff');
  });
});

function tokensOrNull(tokens: Record<string, string>, key: string): string | null {
  return tokens[key] ?? null;
}
