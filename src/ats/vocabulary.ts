/**
 * Vocabulary used by the ATS analyser.
 *
 * Every list here encodes a *parser* expectation, not a style opinion. The
 * heading lists, for example, are the strings that resume parsers are trained to
 * recognise as section boundaries; anything outside them is a real parsing risk.
 */

/** Heading synonyms parsers recognise, grouped by the section they identify. */
export const RECOGNISED_HEADINGS: Record<string, string[]> = {
  summary: [
    'summary',
    'professional summary',
    'executive summary',
    'career summary',
    'profile',
    'professional profile',
    'personal profile',
    'about',
    'about me',
    'objective',
    'career objective',
    'professional objective',
    'overview',
    'career overview',
    'personal statement',
  ],
  experience: [
    'experience',
    'work experience',
    'professional experience',
    'relevant experience',
    'employment',
    'employment history',
    'work history',
    'career history',
    'professional background',
    'professional experience & achievements',
  ],
  education: [
    'education',
    'education and training',
    'academic background',
    'academic qualifications',
    'qualifications',
    'educational background',
  ],
  skills: [
    'skills',
    'key skills',
    'core skills',
    'technical skills',
    'skills and expertise',
    'areas of expertise',
    'core competencies',
    'competencies',
    'technical proficiencies',
    'technologies',
    'tools and technologies',
    'skills and interests',
  ],
  certifications: [
    'certifications',
    'certificates',
    'certification',
    'licenses',
    'licences',
    'licenses and certifications',
    'professional certifications',
    'credentials',
    'training and certifications',
  ],
  projects: ['projects', 'personal projects', 'selected projects', 'side projects', 'portfolio', 'key projects'],
  awards: [
    'awards',
    'honors',
    'honours',
    'awards and honors',
    'awards and honours',
    'achievements',
    'recognition',
    'accomplishments',
  ],
  publications: ['publications', 'papers', 'articles', 'research', 'selected publications', 'talks'],
  volunteer: [
    'volunteer',
    'volunteer experience',
    'volunteering',
    'community involvement',
    'community service',
    'leadership',
  ],
  languages: ['languages', 'language skills', 'spoken languages'],
  custom: [],
};

const headingLookup = new Map<string, string>();
for (const [group, headings] of Object.entries(RECOGNISED_HEADINGS)) {
  for (const heading of headings) headingLookup.set(heading, group);
}

/** Returns the parser-recognised group for a heading, or `null`. */
export function recognisedHeadingGroup(heading: string): string | null {
  const normalised = heading
    .trim()
    .toLowerCase()
    .replace(/[^a-z& ]+/g, '')
    .replace(/\s+/g, ' ');
  return headingLookup.get(normalised) ?? null;
}

/**
 * Openers that weaken a bullet. These are not grammar errors — they are phrases
 * that bury the outcome and that recruiters consistently rate lower.
 */
export const WEAK_BULLET_OPENERS = [
  'responsible for',
  'was responsible for',
  'duties included',
  'duties include',
  'tasked with',
  'in charge of',
  'worked on',
  'worked with',
  'helped with',
  'helped to',
  'assisted with',
  'assisted in',
  'involved in',
  'participated in',
  'was part of',
  'part of a team that',
  'handled',
  'dealt with',
  'responsible to',
];

/** Strong, concrete openers. Presence is a positive signal, not a requirement. */
export const STRONG_BULLET_VERBS = [
  'accelerated', 'achieved', 'architected', 'automated', 'benchmarked', 'built', 'centralised', 'centralized',
  'championed', 'coached', 'consolidated', 'converted', 'coordinated', 'created', 'cut', 'decreased', 'delivered',
  'deployed', 'designed', 'developed', 'diagnosed', 'directed', 'doubled', 'drove', 'eliminated', 'engineered',
  'established', 'expanded', 'generated', 'grew', 'halved', 'implemented', 'improved', 'increased', 'influenced',
  'initiated', 'instrumented', 'introduced', 'launched', 'led', 'migrated', 'modernised', 'modernized', 'mentored',
  'negotiated', 'optimised', 'optimized', 'orchestrated', 'overhauled', 'owned', 'partnered', 'piloted', 'pioneered',
  'planned', 'prioritised', 'prioritized', 'produced', 'profile', 'rearchitected', 'rebuilt', 'reduced', 'refactored',
  'released', 'resolved', 'restructured', 'revamped', 'saved', 'scaled', 'secured', 'shipped', 'simplified',
  'spearheaded', 'standardised', 'standardized', 'streamlined', 'strengthened', 'supervised', 'supported',
  'sustained', 'transformed', 'tripled', 'unified', 'validated', 'won',
];

/** First-person pronouns that read as informal in a resume. */
export const FIRST_PERSON_PRONOUNS = ['i', 'me', 'my', 'mine', 'myself', 'we', 'our', 'ours', 'us'];

/** Placeholder strings that must never ship in a real resume. */
export const PLACEHOLDER_PATTERNS = [
  /\blorem ipsum\b/i,
  /\btbd\b/i,
  /\btodo\b/i,
  /\bxxx+\b/i,
  /\byour name\b/i,
  /\bcompany name\b/i,
  /\bjob title\b/i,
  /\binsert\b/i,
  /\bplaceholder\b/i,
];

/** Words that indicate a quantified outcome: percentages, money, scale, time. */
export const QUANTIFIER_PATTERN =
  /(\d+(?:[.,]\d+)?\s?%|\$\s?\d|\b\d{2,}\b|\b\d+(?:\.\d+)?\s?(?:x|k|m|bn|billion|million|thousand|hours?|days?|weeks?|months?|years?|users?|customers?|requests?|records?|tickets?)\b)/i;

/** Regexes used by several checks. */
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const PHONE_PATTERN = /(\+?\d[\d\s().-]{6,}\d)/;
export const URL_LIKE_PATTERN = /(https?:\/\/|www\.|linkedin\.com|github\.com|\.(?:com|io|dev|org|net|me|co)\b)/i;
