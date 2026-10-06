import { describe, expect, it } from 'vitest';
import { displayUrl, isUsableUrl, mailtoHref, safeUrl, telHref } from './urls';

describe('safeUrl', () => {
  it('accepts http and https', () => {
    expect(safeUrl('https://example.com')).toBe('https://example.com/');
    expect(safeUrl('http://example.com/a?b=1')).toBe('http://example.com/a?b=1');
  });

  it('upgrades a bare domain, because people type it that way', () => {
    expect(safeUrl('linkedin.com/in/alex')).toBe('https://linkedin.com/in/alex');
    expect(safeUrl('www.example.dev')).toBe('https://www.example.dev/');
  });

  it('refuses active-content schemes that would become live annotations', () => {
    expect(safeUrl('javascript:alert(1)')).toBeNull();
    expect(safeUrl('JavaScript:alert(1)')).toBeNull();
    expect(safeUrl('data:text/html;base64,PHNjcmlwdD4=')).toBeNull();
    expect(safeUrl('file:///C:/Windows/System32/calc.exe')).toBeNull();
    expect(safeUrl('vbscript:msgbox(1)')).toBeNull();
  });

  it('rejects junk and hostless http URLs', () => {
    expect(safeUrl('')).toBeNull();
    expect(safeUrl('http://localhost')).toBeNull();
    expect(safeUrl('not a url at all')).toBeNull();
  });

  it('keeps mailto and tel when they are well formed', () => {
    expect(safeUrl('mailto:alex@example.com')).toBe('mailto:alex@example.com');
    expect(safeUrl('tel:+12065550142')).toBe('tel:+12065550142');
    expect(safeUrl('mailto:nope')).toBeNull();
    expect(safeUrl('tel:12')).toBeNull();
  });
});

describe('displayUrl', () => {
  it('strips the scheme, www and trailing slash for printing', () => {
    expect(displayUrl('https://www.linkedin.com/in/alex/')).toBe('linkedin.com/in/alex');
    expect(displayUrl('https://github.com/example')).toBe('github.com/example');
    expect(displayUrl('https://example.com/')).toBe('example.com');
  });

  it('leaves unsafe values untouched rather than inventing a URL', () => {
    expect(displayUrl('not a url')).toBe('not a url');
  });
});

describe('mailtoHref / telHref', () => {
  it('builds hrefs only for plausible values', () => {
    expect(mailtoHref('alex@example.com')).toBe('mailto:alex@example.com');
    expect(mailtoHref('alex@example')).toBeNull();
    expect(telHref('+1 (206) 555-0142')).toBe('tel:+12065550142');
    expect(telHref('555')).toBeNull();
  });
});

describe('isUsableUrl', () => {
  it('matches safeUrl', () => {
    expect(isUsableUrl('https://example.com')).toBe(true);
    expect(isUsableUrl('javascript:x')).toBe(false);
  });
});
