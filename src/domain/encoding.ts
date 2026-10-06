/**
 * Character encoding safety for the PDF.
 *
 * The templates deliberately use the PDF *standard 14* fonts. They need no
 * embedding, and every extractor already knows their encoding — which is exactly
 * why they are the most reliably parsed option. The trade-off is that those fonts
 * are limited to WinAnsi (roughly Windows-1252).
 *
 * So: text is normalised (NFKC parses `ﬁ` back into `fi`, which is the documented
 * cause of ligature-broken keyword matching), common symbols are folded to safe
 * equivalents, and anything left that genuinely cannot be encoded is reported to
 * the user instead of being silently mangled by the PDF writer.
 */

import type { ResumeData } from './types';

/** Code points reachable in WinAnsi / Windows-1252. */
const WIN_ANSI = (() => {
  const set = new Set<string>();

  // ASCII printable range.
  for (let code = 0x20; code <= 0x7e; code += 1) set.add(String.fromCodePoint(code));

  // The 0x80–0x9F block, which Windows-1252 fills in with typographic characters.
  const highBlock = [
    0x20ac, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030, 0x0160, 0x2039, 0x0152,
    0x017d, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014, 0x02dc, 0x2122, 0x0161, 0x203a,
    0x0153, 0x017e, 0x0178,
  ];
  for (const code of highBlock) set.add(String.fromCodePoint(code));

  // Latin-1 supplement.
  for (let code = 0xa0; code <= 0xff; code += 1) set.add(String.fromCodePoint(code));

  return set;
})();

/**
 * Fallbacks for characters that NFKC leaves behind but WinAnsi cannot encode.
 * Anything not listed here and not encodable is reported and removed.
 */
const FALLBACKS: Record<string, string> = {
  '\u2044': '/', // fraction slash
  '\u2212': '-', // minus sign
  '\u2011': '-', // non-breaking hyphen
  '\u2012': '-', // figure dash
  '\u2015': '\u2014', // horizontal bar -> em dash
  '\u00ad': '', // soft hyphen: invisible, but splits words during extraction
  '\u200b': '', // zero-width space
  '\u200c': '',
  '\u200d': '',
  '\ufeff': '',
  '\u2192': '->',
  '\u2190': '<-',
  '\u2194': '<->',
  '\u21d2': '=>',
  '\u2264': '<=',
  '\u2265': '>=',
  '\u2260': '!=',
  '\u2248': '~',
  '\u00d7': 'x',
  '\u00f7': '/',
  '\u221e': 'infinity',
  '\u2713': '',
  '\u2714': '',
  '\u2717': '',
  '\u2605': '*',
  '\u2606': '*',
  '\u2032': "'",
  '\u2033': '"',
  '\u00aa': 'a',
  '\u00ba': 'o',
};

export interface EncodedText {
  /** Text that is safe to hand to a standard-14 font. */
  text: string;
  /** Characters that had to be dropped, because no safe equivalent exists. */
  dropped: string[];
}

/**
 * Makes a string printable with a standard-14 font, losslessly where possible.
 *
 * NFKC first (this is what repairs pasted ligatures), then the fallback table,
 * then drop what is left.
 */
export function encodeForStandardFont(input: string): EncodedText {
  const normalised = input.normalize('NFKC');
  const dropped: string[] = [];
  let out = '';

  for (const character of normalised) {
    if (character === '\n' || character === '\t') {
      out += character;
      continue;
    }
    if (WIN_ANSI.has(character)) {
      out += character;
      continue;
    }
    const fallback = FALLBACKS[character];
    if (fallback !== undefined) {
      out += fallback;
      continue;
    }
    const composed = character.normalize('NFD');
    // Accented Latin letters that WinAnsi lacks are rare, but decomposing them
    // keeps the base letter rather than losing the word entirely.
    if (composed.length > 1 && WIN_ANSI.has(composed[0])) {
      out += composed[0];
      continue;
    }
    if (!dropped.includes(character)) dropped.push(character);
  }

  return { text: out, dropped };
}

/** True when the character survives a round trip through the font encoding. */
export function isEncodable(character: string): boolean {
  if (character === '\n' || character === '\t') return true;
  return WIN_ANSI.has(character) || FALLBACKS[character] !== undefined;
}

export interface UnsupportedCharacter {
  character: string;
  /** Unicode code point, e.g. `U+4E2D`, for display. */
  codePoint: string;
  count: number;
}

/** Every distinct character in the resume that a standard-14 font cannot print. */
export function findUnsupportedCharacters(data: ResumeData): UnsupportedCharacter[] {
  const found = new Map<string, number>();

  const visit = (value: string) => {
    for (const character of value.normalize('NFKC')) {
      if (isEncodable(character)) continue;
      if (character.trim() === '') continue;
      found.set(character, (found.get(character) ?? 0) + 1);
    }
  };

  const visitLinks = () => {
    for (const link of data.basics.links) {
      visit(link.label);
      visit(link.url);
    }
  };

  visit(data.basics.fullName);
  visit(data.basics.headline);
  visit(data.basics.email);
  visit(data.basics.phone);
  visit(data.basics.location);
  visitLinks();

  for (const section of data.sections) {
    if (!section.visible) continue;
    visit(section.heading);
    if (section.kind === 'summary') {
      visit(section.text);
    } else if (section.kind === 'skills') {
      for (const group of section.groups) {
        visit(group.label);
        for (const item of group.items) visit(item);
      }
    } else if (section.kind === 'languages') {
      for (const item of section.items) {
        visit(item.name);
        visit(item.level);
      }
    } else if ('entries' in section) {
      for (const entry of section.entries) {
        visit(entry.title);
        visit(entry.subtitle);
        visit(entry.location);
        visit(entry.description);
        visit(entry.extra);
        visit(entry.url);
        for (const tag of entry.tags) visit(tag);
        for (const bullet of entry.bullets) visit(bullet.text);
      }
    }
  }

  return [...found.entries()]
    .map(([character, count]) => ({
      character,
      count,
      codePoint: `U+${(character.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, '0')}`,
    }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Detects characters that survive encoding but still break keyword matching —
 * precomposed ligatures pasted in from another PDF being the classic case.
 * Reported separately because the fix (normalisation) is already automatic.
 */
export function findLigatureCharacters(data: ResumeData): string[] {
  const LIGATURES = ['\ufb00', '\ufb01', '\ufb02', '\ufb03', '\ufb04', '\ufb05', '\ufb06'];
  const text = JSON.stringify(data);
  return LIGATURES.filter((ligature) => text.includes(ligature));
}

/** Applies encoding to every string in the document. Used before rendering. */
export function encodeResume(data: ResumeData): { data: ResumeData; dropped: string[] } {
  const dropped = new Set<string>();
  const enc = (value: string): string => {
    const result = encodeForStandardFont(value);
    for (const character of result.dropped) dropped.add(character);
    return result.text;
  };

  const next: ResumeData = {
    ...data,
    meta: {
      title: enc(data.meta.title),
      author: enc(data.meta.author),
      subject: enc(data.meta.subject),
      keywords: enc(data.meta.keywords),
      language: data.meta.language,
    },
    basics: {
      ...data.basics,
      fullName: enc(data.basics.fullName),
      headline: enc(data.basics.headline),
      email: enc(data.basics.email),
      phone: enc(data.basics.phone),
      location: enc(data.basics.location),
      links: data.basics.links.map((link) => ({ ...link, label: enc(link.label), url: enc(link.url) })),
    },
    sections: data.sections.map((section) => {
      if (section.kind === 'summary') return { ...section, heading: enc(section.heading), text: enc(section.text) };
      if (section.kind === 'skills') {
        return {
          ...section,
          heading: enc(section.heading),
          groups: section.groups.map((group) => ({
            ...group,
            label: enc(group.label),
            items: group.items.map(enc),
          })),
        };
      }
      if (section.kind === 'languages') {
        return {
          ...section,
          heading: enc(section.heading),
          items: section.items.map((item) => ({ ...item, name: enc(item.name), level: enc(item.level) })),
        };
      }
      return {
        ...section,
        heading: enc(section.heading),
        entries: section.entries.map((entry) => ({
          ...entry,
          title: enc(entry.title),
          subtitle: enc(entry.subtitle),
          location: enc(entry.location),
          description: enc(entry.description),
          extra: enc(entry.extra),
          url: enc(entry.url),
          tags: entry.tags.map(enc),
          bullets: entry.bullets.map((bullet) => ({ ...bullet, text: enc(bullet.text) })),
        })),
      };
    }),
  };

  return { data: next, dropped: [...dropped] };
}
