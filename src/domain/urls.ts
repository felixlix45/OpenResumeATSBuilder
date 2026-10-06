/**
 * URL handling.
 *
 * Every URL that reaches the PDF renderer passes through here first. Resumes get
 * pasted from anywhere, so a `javascript:` or `data:` link must never become a
 * live annotation in a document the user emails to a recruiter.
 */

/** Schemes we are willing to emit as clickable links. */
const SAFE_SCHEMES = new Set(['http:', 'https:', 'mailto:', 'tel:']);

/**
 * Returns an absolute, safe URL, or `null` when the value cannot be made safe.
 *
 * A bare `example.com` is upgraded to `https://example.com` — users type that
 * constantly and it is not worth an error message.
 */
export function safeUrl(raw: string): string | null {
  const value = (raw ?? '').trim();
  if (!value) return null;

  // Strip control characters that could be used to smuggle a scheme past a check.
  const cleaned = value.replace(/[\u0000-\u001F\u007F]/g, '');
  if (!cleaned) return null;

  const hasScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(cleaned);
  const candidate = hasScheme ? cleaned : `https://${cleaned}`;

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return null;
  }

  if (!SAFE_SCHEMES.has(parsed.protocol)) return null;
  // A http(s) URL with no host is not usable.
  if ((parsed.protocol === 'http:' || parsed.protocol === 'https:') && !parsed.hostname.includes('.')) {
    return null;
  }
  if (parsed.protocol === 'mailto:' && !parsed.pathname.includes('@')) return null;
  if (parsed.protocol === 'tel:' && parsed.pathname.replace(/\D/g, '').length < 5) return null;

  return parsed.toString();
}

/** True when the raw value looks like a URL that would be clickable. */
export function isUsableUrl(raw: string): boolean {
  return safeUrl(raw) !== null;
}

/** Human-friendly form of a URL: no scheme, no `www.`, no trailing slash. */
export function displayUrl(raw: string): string {
  const safe = safeUrl(raw);
  if (!safe) return raw.trim();
  try {
    const parsed = new URL(safe);
    if (parsed.protocol === 'mailto:') return parsed.pathname;
    if (parsed.protocol === 'tel:') return parsed.pathname;
    const host = parsed.hostname.replace(/^www\./i, '');
    const path = parsed.pathname === '/' ? '' : parsed.pathname.replace(/\/$/, '');
    return `${host}${path}${parsed.search}`;
  } catch {
    return raw.trim();
  }
}

/** Builds a `mailto:` href for an email address, or `null` when malformed. */
export function mailtoHref(email: string): string | null {
  const value = (email ?? '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) return null;
  return `mailto:${value}`;
}

/** Builds a `tel:` href for a phone number, or `null` when too short. */
export function telHref(phone: string): string | null {
  const value = (phone ?? '').trim();
  const digits = value.replace(/[^\d+]/g, '');
  if (digits.replace(/\D/g, '').length < 7) return null;
  return `tel:${digits}`;
}
