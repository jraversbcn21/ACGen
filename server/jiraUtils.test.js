// @vitest-environment node

import { describe, test, expect } from 'vitest';
import { validateAndEncodeIssueKey, validateBaseUrl } from './jiraUtils.js';

describe('validateAndEncodeIssueKey', () => {
  test('encodes a valid issue key (PROJ-123)', () => {
    expect(validateAndEncodeIssueKey('PROJ-123')).toBe('PROJ-123');
  });

  test('encodes a valid issue key with a single letter project (A-1)', () => {
    expect(validateAndEncodeIssueKey('A-1')).toBe('A-1');
  });

  test('encodes a valid issue key with numbers in the project key (ABC2-456)', () => {
    expect(validateAndEncodeIssueKey('ABC2-456')).toBe('ABC2-456');
  });

  test('applies encodeURIComponent to valid keys (defense-in-depth)', () => {
    const encoded = validateAndEncodeIssueKey('PRJ-123');
    expect(encoded).not.toContain('/');
    expect(encoded).toBe(encodeURIComponent('PRJ-123'));
  });

  test('rejects an empty issue key', () => {
    expect(() => validateAndEncodeIssueKey('')).toThrow();
  });

  test('rejects issue keys without hyphens', () => {
    expect(() => validateAndEncodeIssueKey('PROJ123')).toThrow();
  });

  test('rejects issue keys with lowercase project prefix', () => {
    expect(() => validateAndEncodeIssueKey('proj-123')).toThrow();
  });

  test('rejects issue keys with path traversal after a valid key', () => {
    expect(() => validateAndEncodeIssueKey('ABC-1/../../admin/delete')).toThrow();
  });

  test('rejects issue keys with query string injection', () => {
    expect(() => validateAndEncodeIssueKey('ABC-1?fields=*')).toThrow();
  });
});

describe('validateBaseUrl', () => {
  test('accepts a valid https Jira URL', () => {
    expect(validateBaseUrl('https://mycompany.atlassian.net')).toBe(
      'https://mycompany.atlassian.net',
    );
  });

  test('accepts a valid http URL', () => {
    expect(validateBaseUrl('http://localhost:8080')).toBe('http://localhost:8080');
  });

  test('accepts a URL with a trailing slash and normalizes it', () => {
    expect(validateBaseUrl('https://mycompany.atlassian.net/')).toBe(
      'https://mycompany.atlassian.net',
    );
  });

  test('rejects an empty base URL', () => {
    expect(() => validateBaseUrl('')).toThrow();
  });

  test('rejects a base URL with no host', () => {
    expect(() => validateBaseUrl('not-a-url')).toThrow();
  });

  test('rejects a base URL with unsupported protocol (ftp)', () => {
    expect(() => validateBaseUrl('ftp://evil.com')).toThrow();
  });

  test('rejects a base URL with javascript: protocol (XSS)', () => {
    expect(() => validateBaseUrl('javascript:alert(1)')).toThrow();
  });
});
