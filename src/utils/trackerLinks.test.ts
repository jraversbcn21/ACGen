import { describe, it, expect } from 'vitest';
import { parseUrlCell } from './trackerLinks';

describe('parseUrlCell', () => {
  it('parses a bare URL with null name', () => {
    expect(parseUrlCell('https://zephyr.example.com/plan/9')).toEqual({
      name: null,
      url: 'https://zephyr.example.com/plan/9',
    });
  });

  it('parses "Nombre - URL" into name and url', () => {
    expect(parseUrlCell('Smoke Login - https://zephyr.example.com/plan/9')).toEqual({
      name: 'Smoke Login',
      url: 'https://zephyr.example.com/plan/9',
    });
  });

  it('keeps hyphens inside the name (lazy match up to the last " - url")', () => {
    expect(parseUrlCell('Checkout - fase 2 - https://z.example/p/1')).toEqual({
      name: 'Checkout - fase 2',
      url: 'https://z.example/p/1',
    });
  });

  it('returns null for plain text, non-http schemes and trailing garbage', () => {
    expect(parseUrlCell('sin enlace')).toBeNull();
    expect(parseUrlCell('ftp://ejemplo.com/x')).toBeNull();
    expect(parseUrlCell('https://z.example/p/1 y más texto')).toBeNull();
    expect(parseUrlCell('')).toBeNull();
  });
});
