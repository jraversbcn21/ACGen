// @vitest-environment node

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
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
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test('accepts a valid https Jira URL whose host is in JIRA_ALLOWED_HOSTS', () => {
    vi.stubEnv('JIRA_ALLOWED_HOSTS', 'mycompany.atlassian.net');
    expect(validateBaseUrl('https://mycompany.atlassian.net')).toBe(
      'https://mycompany.atlassian.net',
    );
  });

  test('accepts a valid http URL whose host is in JIRA_ALLOWED_HOSTS', () => {
    vi.stubEnv('JIRA_ALLOWED_HOSTS', 'localhost');
    expect(validateBaseUrl('http://localhost:8080')).toBe('http://localhost:8080');
  });

  test('accepts a URL with a trailing slash and normalizes it', () => {
    vi.stubEnv('JIRA_ALLOWED_HOSTS', 'mycompany.atlassian.net');
    expect(validateBaseUrl('https://mycompany.atlassian.net/')).toBe(
      'https://mycompany.atlassian.net',
    );
  });

  test('matches allowed hosts case-insensitively and trims whitespace in the list', () => {
    vi.stubEnv('JIRA_ALLOWED_HOSTS', ' MyCompany.Atlassian.Net , other.example.com ');
    expect(validateBaseUrl('https://mycompany.atlassian.net')).toBe(
      'https://mycompany.atlassian.net',
    );
  });

  test('tolerates a JIRA_ALLOWED_HOSTS entry wrapped in stray quotes', () => {
    vi.stubEnv('JIRA_ALLOWED_HOSTS', '"mycompany.atlassian.net"');
    expect(validateBaseUrl('https://mycompany.atlassian.net')).toBe(
      'https://mycompany.atlassian.net',
    );
  });

  test('rejects an empty base URL', () => {
    vi.stubEnv('JIRA_ALLOWED_HOSTS', 'mycompany.atlassian.net');
    expect(() => validateBaseUrl('')).toThrow();
  });

  test('rejects a base URL with no host', () => {
    vi.stubEnv('JIRA_ALLOWED_HOSTS', 'mycompany.atlassian.net');
    expect(() => validateBaseUrl('not-a-url')).toThrow();
  });

  test('rejects a base URL with unsupported protocol (ftp)', () => {
    vi.stubEnv('JIRA_ALLOWED_HOSTS', 'evil.com');
    expect(() => validateBaseUrl('ftp://evil.com')).toThrow();
  });

  test('rejects a base URL with javascript: protocol (XSS)', () => {
    vi.stubEnv('JIRA_ALLOWED_HOSTS', 'evil.com');
    expect(() => validateBaseUrl('javascript:alert(1)')).toThrow();
  });

  test('rejects a host not present in JIRA_ALLOWED_HOSTS', () => {
    vi.stubEnv('JIRA_ALLOWED_HOSTS', 'mycompany.atlassian.net');
    expect(() => validateBaseUrl('https://attacker.example.com')).toThrow(
      'Host de Jira no permitido.',
    );
  });

  test('rejects every host when JIRA_ALLOWED_HOSTS is unset', () => {
    vi.stubEnv('JIRA_ALLOWED_HOSTS', undefined);
    expect(() => validateBaseUrl('https://mycompany.atlassian.net')).toThrow(
      'Host de Jira no permitido.',
    );
  });

  test('rejects every host when JIRA_ALLOWED_HOSTS is an empty string', () => {
    vi.stubEnv('JIRA_ALLOWED_HOSTS', '');
    expect(() => validateBaseUrl('https://mycompany.atlassian.net')).toThrow(
      'Host de Jira no permitido.',
    );
  });

  test('does not allow a subdomain-suffix bypass (e.g. evilmycompany.atlassian.net)', () => {
    vi.stubEnv('JIRA_ALLOWED_HOSTS', 'mycompany.atlassian.net');
    expect(() => validateBaseUrl('https://evilmycompany.atlassian.net')).toThrow(
      'Host de Jira no permitido.',
    );
  });
});
