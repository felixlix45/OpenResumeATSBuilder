/**
 * Plain-text projection of the resume.
 *
 * This mirrors the order in which the PDF renderer emits content, which is the
 * order a parser sees. Everything downstream — ATS checks, keyword matching,
 * copy-to-clipboard, the "plain text" export — reads from here rather than
 * re-walking the data model, so there is exactly one definition of "what the
 * document says".
 */

import { formatDateRange } from './dates';
import { isEntrySection, isLanguagesSection, isSkillsSection, isSummarySection } from './types';
import type { ResumeData, Section } from './types';

export type LineKind =
  | 'name'
  | 'headline'
  | 'contact'
  | 'heading'
  | 'title'
  | 'meta'
  | 'body'
  | 'bullet'
  | 'skills'
  | 'language';

export interface Line {
  text: string;
  kind: LineKind;
  /** Section heading this line belongs to, when applicable. */
  section?: string;
}

function joinMeta(parts: Array<string | undefined | null>): string {
  return parts
    .map((part) => (part ?? '').trim())
    .filter(Boolean)
    .join(' | ');
}

/** Flattens the document into ordered lines, exactly as printed. */
export function resumeToLines(data: ResumeData): Line[] {
  const lines: Line[] = [];
  const { basics } = data;

  if (basics.fullName.trim()) lines.push({ text: basics.fullName.trim(), kind: 'name' });
  if (basics.headline.trim()) lines.push({ text: basics.headline.trim(), kind: 'headline' });

  const contact = joinMeta([
    basics.email,
    basics.phone,
    basics.location,
    ...basics.links.map((link) => link.label || link.url),
  ]);
  if (contact) lines.push({ text: contact, kind: 'contact' });

  for (const section of data.sections) {
    if (!section.visible) continue;
    pushSection(lines, section, data);
  }

  return lines;
}

function pushSection(lines: Line[], section: Section, data: ResumeData): void {
  const heading = section.heading.trim();
  const prefix: Line[] = heading ? [{ text: heading, kind: 'heading' }] : [];

  if (isSummarySection(section)) {
    const text = section.text.trim();
    if (!text) return;
    lines.push(...prefix);
    for (const paragraph of text.split(/\n{2,}/)) {
      const clean = paragraph.trim();
      if (clean) lines.push({ text: clean, kind: 'body', section: heading });
    }
    return;
  }

  if (isSkillsSection(section)) {
    const groups = section.groups
      .map((group) => ({ label: group.label.trim(), items: group.items.map((i) => i.trim()).filter(Boolean) }))
      .filter((group) => group.items.length > 0);
    if (groups.length === 0) return;
    lines.push(...prefix);
    for (const group of groups) {
      const text = group.label ? `${group.label}: ${group.items.join(', ')}` : group.items.join(', ');
      lines.push({ text, kind: 'skills', section: heading });
    }
    return;
  }

  if (isLanguagesSection(section)) {
    const items = section.items
      .map((item) => ({ name: item.name.trim(), level: item.level.trim() }))
      .filter((item) => item.name);
    if (items.length === 0) return;
    lines.push(...prefix);
    for (const item of items) {
      const text = item.level ? `${item.name} \u2014 ${item.level}` : item.name;
      lines.push({ text, kind: 'language', section: heading });
    }
    return;
  }

  if (!isEntrySection(section)) return;

  const printed: Line[] = [];
  for (const item of section.entries) {
    const title = item.title.trim();
    const subtitle = item.subtitle.trim();
    const location = item.location.trim();
    const dates = formatDateRange(item, data.settings.dateFormat);

    if (title) printed.push({ text: title, kind: 'title', section: heading });
    const meta = joinMeta([subtitle, location, dates]);
    if (meta) printed.push({ text: meta, kind: 'meta', section: heading });

    const description = item.description.trim();
    if (description) printed.push({ text: description, kind: 'body', section: heading });

    for (const itemBullet of item.bullets) {
      const text = itemBullet.text.trim();
      if (text) printed.push({ text, kind: 'bullet', section: heading });
    }

    const tags = item.tags.map((tag) => tag.trim()).filter(Boolean);
    if (tags.length) {
      printed.push({ text: `${tagLabel(section.kind)}: ${tags.join(', ')}`, kind: 'body', section: heading });
    }

    const extra = item.extra.trim();
    if (extra) printed.push({ text: extra, kind: 'body', section: heading });

    const url = item.url.trim();
    if (url) printed.push({ text: url, kind: 'body', section: heading });
  }

  if (printed.length === 0) return;
  lines.push(...prefix, ...printed);
}

function tagLabel(kind: Section['kind']): string {
  switch (kind) {
    case 'projects':
      return 'Technologies';
    case 'experience':
    case 'volunteer':
      return 'Tools';
    default:
      return 'Tags';
  }
}

/** The whole document as one string, blank-line separated between sections. */
export function resumeToPlainText(data: ResumeData): string {
  const lines = resumeToLines(data);
  const out: string[] = [];
  for (const line of lines) {
    if (line.kind === 'heading' && out.length > 0) out.push('');
    out.push(line.text);
  }
  return out.join('\n');
}

/** Every discrete term in the document, for keyword inventory and matching. */
export function collectDocumentTerms(data: ResumeData): string[] {
  const terms = new Set<string>();
  const add = (value: string) => {
    const cleaned = value.trim();
    if (cleaned) terms.add(cleaned.toLowerCase());
  };

  add(data.basics.fullName);
  add(data.basics.headline);
  for (const link of data.basics.links) add(link.label);

  for (const section of data.sections) {
    if (!section.visible) continue;
    add(section.heading);
    if (isSkillsSection(section)) {
      for (const group of section.groups) {
        add(group.label);
        for (const item of group.items) add(item);
      }
    } else if (isLanguagesSection(section)) {
      for (const item of section.items) {
        add(item.name);
        add(item.level);
      }
    } else if (isSummarySection(section)) {
      for (const word of tokenize(section.text)) terms.add(word);
    } else if (isEntrySection(section)) {
      for (const item of section.entries) {
        add(item.title);
        add(item.subtitle);
        for (const tag of item.tags) add(tag);
        for (const word of tokenize(item.description)) terms.add(word);
        for (const itemBullet of item.bullets) {
          for (const word of tokenize(itemBullet.text)) terms.add(word);
        }
      }
    }
  }

  return [...terms];
}

const STOP_WORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'also', 'am', 'an', 'and', 'any', 'are', 'as', 'at',
  'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by', 'can', 'did', 'do', 'does',
  'doing', 'down', 'during', 'each', 'few', 'for', 'from', 'further', 'had', 'has', 'have', 'having', 'he', 'her',
  'here', 'hers', 'him', 'his', 'how', 'i', 'if', 'in', 'into', 'is', 'it', 'its', 'just', 'me', 'more', 'most',
  'my', 'no', 'nor', 'not', 'now', 'of', 'off', 'on', 'once', 'only', 'or', 'other', 'our', 'out', 'over', 'own',
  'same', 'she', 'should', 'so', 'some', 'such', 'than', 'that', 'the', 'their', 'them', 'then', 'there', 'these',
  'they', 'this', 'those', 'through', 'to', 'too', 'under', 'until', 'up', 'very', 'was', 'we', 'were', 'what',
  'when', 'where', 'which', 'while', 'who', 'whom', 'why', 'will', 'with', 'would', 'you', 'your', 'yours',
  'across', 'within', 'using', 'used', 'use', 'new', 'including', 'include', 'includes', 'etc', 'via', 'per',
]);

/** Splits text into meaningful lower-case terms (words, acronyms, `c++`, `ci/cd`). */
export function tokenize(text: string): string[] {
  const matches = text.toLowerCase().match(/[a-z0-9][a-z0-9+#./-]*[a-z0-9+#]|[a-z0-9]/g);
  if (!matches) return [];
  const out: string[] = [];
  for (const match of matches) {
    const term = match.replace(/[.,-]+$/, '').replace(/^[.-]+/, '');
    if (term.length < 2 && !/^[0-9]$/.test(term)) continue;
    if (STOP_WORDS.has(term)) continue;
    out.push(term);
  }
  return out;
}

export { STOP_WORDS };
