// src/services/backup.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import {
  BACKUP_SCHEMA_VERSION,
  isSensitiveKey,
  collectBackupData,
  createBackup,
  parseImportFile,
} from './backup';

beforeEach(() => {
  localStorage.clear();
});

describe('isSensitiveKey', () => {
  it('is true for acgen_key_* and the legacy acgen_api_key, false otherwise', () => {
    expect(isSensitiveKey('acgen_key_groq')).toBe(true);
    expect(isSensitiveKey('acgen_key_openrouter')).toBe(true);
    expect(isSensitiveKey('acgen_key_custom')).toBe(true);
    expect(isSensitiveKey('acgen_api_key')).toBe(true);
    expect(isSensitiveKey('acgen_model')).toBe(false);
    expect(isSensitiveKey('acgen_keyboard_shortcut')).toBe(false);
  });
});

describe('collectBackupData', () => {
  it('includes a normal key verbatim, including a raw non-JSON prompt string', () => {
    localStorage.setItem('acgen_prompt_acceptance', 'Eres un asistente QA. No JSON aqui.');
    localStorage.setItem('acgen_theme', '"dark"');

    const data = collectBackupData();

    expect(data['acgen_prompt_acceptance']).toBe('Eres un asistente QA. No JSON aqui.');
    expect(data['acgen_theme']).toBe('"dark"');
  });

  it('ignores a foreign key without the acgen_ prefix', () => {
    localStorage.setItem('otra_app_x', 'valor ajeno');
    localStorage.setItem('acgen_theme', '"dark"');

    const data = collectBackupData();

    expect(data['otra_app_x']).toBeUndefined();
    expect(Object.keys(data)).toEqual(['acgen_theme']);
  });

  it('excludes acgen_key_groq and the legacy acgen_api_key by default', () => {
    localStorage.setItem('acgen_key_groq', 'gsk_secret');
    localStorage.setItem('acgen_api_key', 'legacy_secret');
    localStorage.setItem('acgen_theme', '"dark"');

    const data = collectBackupData();

    expect(data['acgen_key_groq']).toBeUndefined();
    expect(data['acgen_api_key']).toBeUndefined();
    expect(data['acgen_theme']).toBe('"dark"');
  });

  it('includes sensitive keys when includeApiKeys is true', () => {
    localStorage.setItem('acgen_key_groq', 'gsk_secret');
    localStorage.setItem('acgen_api_key', 'legacy_secret');

    const data = collectBackupData({ includeApiKeys: true });

    expect(data['acgen_key_groq']).toBe('gsk_secret');
    expect(data['acgen_api_key']).toBe('legacy_secret');
  });

  it('always excludes acgen_last_backup, even with includeApiKeys: true', () => {
    localStorage.setItem('acgen_last_backup', '2026-07-19T10:00:00.000Z');
    localStorage.setItem('acgen_theme', '"dark"');

    const data = collectBackupData({ includeApiKeys: true });

    expect(data['acgen_last_backup']).toBeUndefined();
    expect(data['acgen_theme']).toBe('"dark"');
  });
});

describe('createBackup', () => {
  it('produces parseable JSON with schemaVersion 1, a valid ISO exportedAt, and the right data', () => {
    localStorage.setItem('acgen_theme', '"dark"');
    localStorage.setItem('acgen_key_groq', 'gsk_secret');

    const json = createBackup();
    const parsed = JSON.parse(json);

    expect(parsed.schemaVersion).toBe(BACKUP_SCHEMA_VERSION);
    expect(new Date(parsed.exportedAt).toISOString()).toBe(parsed.exportedAt);
    expect(parsed.data).toEqual({ acgen_theme: '"dark"' });
  });

  it('pretty-prints the JSON with 2-space indentation', () => {
    localStorage.setItem('acgen_theme', '"dark"');

    const json = createBackup();

    expect(json).toBe(JSON.stringify(JSON.parse(json), null, 2));
    expect(json).toContain('\n  "schemaVersion"');
  });
});

describe('parseImportFile', () => {
  it('recognizes a valid v1 backup', () => {
    const backup = {
      schemaVersion: 1,
      exportedAt: '2026-01-01T00:00:00.000Z',
      data: { acgen_theme: '"dark"' },
    };
    const json = JSON.stringify(backup);

    expect(parseImportFile(json)).toEqual({ kind: 'backup', backup });
  });

  it('flags corrupted JSON as invalid/json', () => {
    expect(parseImportFile('{not valid json')).toEqual({ kind: 'invalid', reason: 'json' });
  });

  it('flags objects with no recognizable structure, and non-object payloads, as invalid/structure', () => {
    expect(parseImportFile(JSON.stringify({ foo: 'bar' }))).toEqual({ kind: 'invalid', reason: 'structure' });
    expect(parseImportFile(JSON.stringify(null))).toEqual({ kind: 'invalid', reason: 'structure' });
    expect(parseImportFile(JSON.stringify([1, 2, 3]))).toEqual({ kind: 'invalid', reason: 'structure' });
    expect(parseImportFile(JSON.stringify(42))).toEqual({ kind: 'invalid', reason: 'structure' });
  });

  it('flags a backup whose data has a non-string value as invalid/structure', () => {
    const withNumericValue = JSON.stringify({
      schemaVersion: 1,
      exportedAt: '2026-01-01T00:00:00.000Z',
      data: { acgen_theme: 123 },
    });
    const withNonPlainData = JSON.stringify({
      schemaVersion: 1,
      exportedAt: '2026-01-01T00:00:00.000Z',
      data: ['not', 'an', 'object'],
    });

    expect(parseImportFile(withNumericValue)).toEqual({ kind: 'invalid', reason: 'structure' });
    expect(parseImportFile(withNonPlainData)).toEqual({ kind: 'invalid', reason: 'structure' });
  });

  it('recognizes a schemaVersion ahead of what this app supports as futureVersion', () => {
    const json = JSON.stringify({ schemaVersion: 2, exportedAt: '2026-01-01T00:00:00.000Z', data: {} });

    expect(parseImportFile(json)).toEqual({ kind: 'futureVersion', schemaVersion: 2 });
  });

  it('recognizes a legacy single-workspace export and returns the original json', () => {
    const json = JSON.stringify({ id: 'ws-1', name: 'Mi workspace', artifacts: [] });

    expect(parseImportFile(json)).toEqual({ kind: 'legacyWorkspace', json });
  });
});
