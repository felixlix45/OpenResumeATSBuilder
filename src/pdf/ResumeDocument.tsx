/**
 * The PDF document.
 *
 * This component is the *only* thing that decides what the resume looks like.
 * The on-screen preview renders the PDF this produces, so there is no second
 * layout implementation to drift out of sync.
 *
 * ATS-critical decisions, and why they are what they are:
 *
 * - **One column, top to bottom.** Text is written to the content stream in this
 *   order, and Apache Tika's own documentation warns that position-sorting
 *   interleaves multi-column layouts. There are no columns here to interleave.
 * - **No tables, text boxes, images or icons.** Nothing that has to be
 *   reconstructed from geometry, and no raster text that cannot be extracted.
 * - **Standard 14 fonts only.** Helvetica / Times / Courier need no embedding:
 *   every extractor already knows their WinAnsi encoding, so there is no subset
 *   or ToUnicode map to get wrong. Characters those fonts cannot print are
 *   normalised or reported before they ever reach the writer.
 * - **Hyphenation is disabled.** A word split across lines with a hyphen is a
 *   word a keyword search will not find.
 * - **Contact details live in the page-1 body flow,** never in a repeating
 *   header or footer — repeating regions get duplicated or dropped by parsers.
 * - **Links are real annotations,** so the downloaded file is interactive while
 *   the visible text stays extractable.
 */

import { Document, Font, Link, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import { useMemo } from 'react';
import { encodeResume } from '../domain/encoding';
import { formatDateRange } from '../domain/dates';
import { isEntrySection, isLanguagesSection, isSkillsSection, isSummarySection } from '../domain/types';
import type { ContactLink, Entry, ResumeData, Section } from '../domain/types';
import { mailtoHref, safeUrl, telHref } from '../domain/urls';
import { buildTheme } from './theme';
import type { PdfTheme } from './theme';

/**
 * Words are never split. react-pdf only hyphenates when a callback is
 * registered, and registering this one makes that guarantee explicit rather than
 * dependent on a library default.
 */
Font.registerHyphenationCallback((word) => [word]);

/**
 * `bookmark` is supported on every layout component at runtime, but only typed
 * on `Page`. This keeps the call sites type-safe without an inline `any`.
 */
function bookmarkProps(title: string): { bookmark: { title: string; expanded: boolean } } {
  return { bookmark: { title, expanded: false } };
}

function createStyles(theme: PdfTheme) {
  const { sizes, colors, space, page } = theme;
  const headingColor = theme.accentHeadings ? colors.accent : colors.text;

  return StyleSheet.create({
    page: {
      paddingTop: page.padding,
      paddingBottom: page.padding,
      paddingLeft: page.padding,
      paddingRight: page.padding,
      fontFamily: theme.fontFamily,
      fontSize: sizes.body,
      lineHeight: space.line,
      color: colors.text,
      // Any accidental letter-spacing would break word reconstruction.
      letterSpacing: 0,
    },
    header: {
      marginBottom: space.section * 0.9,
    },
    name: {
      fontSize: sizes.name,
      fontFamily: theme.fontFamily,
      fontWeight: 'bold',
      color: theme.accentHeadings ? colors.accent : colors.text,
      lineHeight: 1.15,
      marginBottom: 2,
    },
    headline: {
      fontSize: sizes.headline,
      color: colors.muted,
      lineHeight: 1.25,
      marginBottom: 4,
    },
    contact: {
      fontSize: sizes.contact,
      color: colors.muted,
      lineHeight: 1.35,
    },
    contactLink: {
      color: colors.muted,
      textDecoration: 'none',
    },
    section: {
      marginBottom: space.section,
    },
    heading: {
      fontSize: sizes.heading,
      fontWeight: 'bold',
      color: headingColor,
      lineHeight: 1.2,
      marginBottom: 3,
    },
    headingRule: {
      borderBottomWidth: 0.75,
      borderBottomColor: colors.rule,
      marginBottom: 5,
    },
    entry: {
      marginBottom: space.entry,
    },
    entryHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    },
    entryTitle: {
      fontSize: sizes.body,
      fontWeight: 'bold',
      flexGrow: 1,
      flexShrink: 1,
      lineHeight: 1.25,
      paddingRight: 8,
    },
    entryDates: {
      fontSize: sizes.meta,
      color: colors.muted,
      flexShrink: 0,
      lineHeight: 1.25,
      textAlign: 'right',
    },
    entryMeta: {
      fontSize: sizes.meta,
      color: colors.muted,
      lineHeight: 1.3,
    },
    entryMetaStrong: {
      color: colors.text,
    },
    entryLink: {
      color: colors.muted,
      textDecoration: 'none',
    },
    description: {
      fontSize: sizes.body,
      lineHeight: space.line,
      marginTop: 1.5,
    },
    bullet: {
      fontSize: sizes.body,
      lineHeight: space.line,
      marginTop: space.bullet,
      paddingLeft: 10,
      textIndent: -10,
    },
    tags: {
      fontSize: sizes.small,
      color: colors.muted,
      lineHeight: 1.3,
      marginTop: space.bullet,
    },
    tagLabel: {
      color: colors.text,
      fontWeight: 'bold',
    },
    skillsRow: {
      fontSize: sizes.body,
      lineHeight: space.line,
      marginBottom: space.bullet,
    },
    skillLabel: {
      fontWeight: 'bold',
    },
    summary: {
      fontSize: sizes.body,
      lineHeight: space.line,
    },
    footer: {
      position: 'absolute',
      bottom: page.padding * 0.45,
      left: page.padding,
      right: page.padding,
      fontSize: sizes.small - 0.5,
      color: colors.muted,
      textAlign: 'center',
    },
  });
}

interface ResumeDocumentProps {
  data: ResumeData;
}

/** The resolved style map, derived from the factory so it always stays in sync. */
type ResumeStyles = ReturnType<typeof createStyles>;

export function ResumeDocument({ data: rawData }: ResumeDocumentProps) {
  // Encoding happens here rather than at the call site so it cannot be bypassed:
  // anything that renders this component gets text the fonts can actually print.
  const data = useMemo(() => encodeResume(rawData).data, [rawData]);
  const theme = buildTheme(data.settings);
  const styles = createStyles(theme);
  const visible = data.sections.filter((section) => section.visible);

  return (
    <Document
      title={data.meta.title || data.basics.fullName || 'Resume'}
      author={data.meta.author || data.basics.fullName || undefined}
      subject={data.meta.subject || undefined}
      keywords={data.meta.keywords || undefined}
      creator="Resume Forge"
      producer="Resume Forge (react-pdf)"
      language={data.meta.language || 'en-US'}
      pdfVersion="1.7"
    >
      <Page size={theme.page.size} style={styles.page} wrap>
        <Header data={data} styles={styles} />
        {visible.map((section) => (
          <SectionBlock key={section.id} section={section} data={data} styles={styles} />
        ))}
        {data.settings.showPageNumbers ? (
          <Text
            fixed
            style={styles.footer}
            render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          />
        ) : null}
      </Page>
    </Document>
  );
}

function Header({ data, styles }: { data: ResumeData; styles: ResumeStyles }) {
  const { basics } = data;
  const emailHref = mailtoHref(basics.email);
  const phoneHref = telHref(basics.phone);

  const contacts: Array<{ key: string; node: React.ReactNode }> = [];
  if (basics.email.trim()) {
    contacts.push({
      key: 'email',
      node: emailHref ? (
        <Link key="email" src={emailHref} style={styles.contactLink}>
          {basics.email.trim()}
        </Link>
      ) : (
        <Text key="email">{basics.email.trim()}</Text>
      ),
    });
  }
  if (basics.phone.trim()) {
    contacts.push({
      key: 'phone',
      node: phoneHref ? (
        <Link key="phone" src={phoneHref} style={styles.contactLink}>
          {basics.phone.trim()}
        </Link>
      ) : (
        <Text key="phone">{basics.phone.trim()}</Text>
      ),
    });
  }
  if (basics.location.trim()) {
    contacts.push({ key: 'location', node: <Text key="location">{basics.location.trim()}</Text> });
  }
  for (const link of basics.links) {
    const node = renderContactLink(link, data, styles);
    if (node) contacts.push({ key: link.id, node });
  }

  return (
    <View style={styles.header} {...bookmarkProps(basics.fullName.trim() || 'Resume')}>
      {basics.fullName.trim() ? <Text style={styles.name}>{basics.fullName.trim()}</Text> : null}
      {basics.headline.trim() ? <Text style={styles.headline}>{basics.headline.trim()}</Text> : null}
      {contacts.length > 0 ? (
        <Text style={styles.contact}>
          {contacts.map((contact, index) => (
            <Text key={contact.key}>
              {index > 0 ? '  |  ' : ''}
              {contact.node}
            </Text>
          ))}
        </Text>
      ) : null}
    </View>
  );
}

function renderContactLink(link: ContactLink, data: ResumeData, styles: ResumeStyles): React.ReactNode {
  const label = link.label.trim();
  const raw = link.url.trim();
  const href = raw ? safeUrl(raw) : null;
  const text = data.settings.linkDisplay === 'url' && raw ? displayLinkText(raw) : label || displayLinkText(raw);
  if (!text) return null;
  if (!href) return <Text key={link.id}>{text}</Text>;
  return (
    <Link key={link.id} src={href} style={styles.contactLink}>
      {text}
    </Link>
  );
}

/**
 * Prints a link without its scheme, so the visible text stays short and the
 * domain — the part a keyword search cares about — is still extractable.
 */
function displayLinkText(raw: string): string {
  const safe = safeUrl(raw);
  if (!safe) return raw;
  try {
    const parsed = new URL(safe);
    if (parsed.protocol === 'mailto:' || parsed.protocol === 'tel:') return parsed.pathname;
    const host = parsed.hostname.replace(/^www\./i, '');
    const path = parsed.pathname === '/' ? '' : parsed.pathname.replace(/\/$/, '');
    return `${host}${path}${parsed.search}`;
  } catch {
    return raw;
  }
}

function SectionBlock({
  section,
  data,
  styles,
}: {
  section: Section;
  data: ResumeData;
  styles: ResumeStyles;
}) {
  const heading = section.heading.trim();
  const headingStyle = styles.headingRule ? [styles.heading, styles.headingRule] : styles.heading;
  const printable = data.settings.uppercaseHeadings && heading ? heading.toUpperCase() : heading;
  const headingNode = printable ? <Text style={headingStyle}>{printable}</Text> : null;

  const body = renderSectionBody(section, data, styles);

  // Short sections are kept whole: a heading whose content is split across a page
  // break is the most common way a parser loses section attribution, and it reads
  // badly to a human too.
  //
  // Note the conditional spread. react-pdf treats an explicitly-passed
  // `wrap={undefined}` as *false*, which silently stops a long section from
  // paginating and draws the overflow off the edge of the page — the prop must be
  // absent, not undefined.
  const keepWhole = isSummarySection(section) || isSkillsSection(section) || isLanguagesSection(section);
  if (keepWhole) {
    return (
      <View style={styles.section} wrap={false} {...bookmarkProps(heading || 'Section')}>
        {headingNode}
        {body}
      </View>
    );
  }

  // Entry sections must be able to paginate, so instead of disabling wrapping we
  // bind the heading to the first entry only. That guarantees the heading is
  // never the last line on a page, without capping the section's length.
  const [firstEntry, ...restEntries] = body;
  return (
    <View style={styles.section} {...bookmarkProps(heading || 'Section')}>
      {firstEntry ? (
        <View wrap={false}>
          {headingNode}
          {firstEntry}
        </View>
      ) : (
        headingNode
      )}
      {restEntries}
    </View>
  );
}

function renderSectionBody(section: Section, data: ResumeData, styles: ResumeStyles): React.ReactNode[] {
  if (isSummarySection(section)) {
    const text = section.text.trim();
    if (!text) return [];
    return text.split(/\n{2,}/).map((paragraph, index) => (
      <Text key={index} style={styles.summary}>
        {paragraph.trim()}
      </Text>
    ));
  }

  if (isSkillsSection(section)) {
    return section.groups.map((group) => {
      const items = group.items.map((item) => item.trim()).filter(Boolean);
      if (items.length === 0) return null;
      const label = group.label.trim();
      return (
        <Text key={group.id} style={styles.skillsRow}>
          {label ? <Text style={styles.skillLabel}>{label}: </Text> : null}
          {items.join(', ')}
        </Text>
      );
    });
  }

  if (isLanguagesSection(section)) {
    const items = section.items
      .map((item) => ({ name: item.name.trim(), level: item.level.trim() }))
      .filter((item) => item.name);
    if (items.length === 0) return [];
    // One line per language: a single line keeps the name and level adjacent in
    // the extracted text, which is how parsers pair them up.
    return items.map((item, index) => (
      <Text key={section.items[index].id} style={styles.skillsRow}>
        <Text style={styles.skillLabel}>{item.name}</Text>
        {item.level ? ` \u2014 ${item.level}` : ''}
      </Text>
    ));
  }

  if (!isEntrySection(section)) return [];

  const entries = section.entries.filter(entryHasContent);
  return entries.map((entry) => (
    <EntryBlock key={entry.id} entry={entry} kind={section.kind} data={data} styles={styles} />
  ));
}

function entryHasContent(entry: Entry): boolean {
  return (
    entry.title.trim().length > 0 ||
    entry.subtitle.trim().length > 0 ||
    entry.description.trim().length > 0 ||
    entry.bullets.some((bullet) => bullet.text.trim().length > 0)
  );
}

function tagLabelFor(kind: Section['kind']): string {
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

function EntryBlock({
  entry,
  kind,
  data,
  styles,
}: {
  entry: Entry;
  kind: Section['kind'];
  data: ResumeData;
  styles: ResumeStyles;
}) {
  const title = entry.title.trim();
  const subtitle = entry.subtitle.trim();
  const location = entry.location.trim();
  const dates = formatDateRange(entry, data.settings.dateFormat);
  const description = entry.description.trim();
  const extra = entry.extra.trim();
  const bullets = entry.bullets.map((bullet) => bullet.text.trim()).filter(Boolean);
  const tags = entry.tags.map((tag) => tag.trim()).filter(Boolean);
  const urlText = entry.url.trim() ? displayLinkText(entry.url.trim()) : '';
  const urlHref = entry.url.trim() ? safeUrl(entry.url.trim()) : null;

  const metaParts: React.ReactNode[] = [];
  if (subtitle) {
    metaParts.push(
      <Text key="subtitle" style={styles.entryMetaStrong}>
        {subtitle}
      </Text>,
    );
  }
  if (location) {
    metaParts.push(<Text key="location">{location}</Text>);
  }
  if (urlText) {
    metaParts.push(
      urlHref ? (
        <Link key="url" src={urlHref} style={styles.entryLink}>
          {urlText}
        </Link>
      ) : (
        <Text key="url">{urlText}</Text>
      ),
    );
  }

  return (
    <View style={styles.entry} minPresenceAhead={36}>
      {(title || dates) ? (
        <View style={styles.entryHeader}>
          {title ? <Text style={styles.entryTitle}>{title}</Text> : <Text style={styles.entryTitle} />}
          {dates ? <Text style={styles.entryDates}>{dates}</Text> : null}
        </View>
      ) : null}

      {metaParts.length > 0 ? (
        <Text style={styles.entryMeta}>
          {metaParts.map((part, index) => (
            <Text key={index}>
              {index > 0 ? '  |  ' : ''}
              {part}
            </Text>
          ))}
        </Text>
      ) : null}

      {description ? <Text style={styles.description}>{description}</Text> : null}

      {bullets.map((text, index) => (
        <Text key={entry.bullets[index]?.id ?? index} style={styles.bullet}>
          {`${data.settings.bulletChar}  ${text}`}
        </Text>
      ))}

      {tags.length > 0 ? (
        <Text style={styles.tags}>
          <Text style={styles.tagLabel}>{tagLabelFor(kind)}: </Text>
          {tags.join(', ')}
        </Text>
      ) : null}

      {extra ? <Text style={styles.tags}>{extra}</Text> : null}
    </View>
  );
}
