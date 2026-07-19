// src/services/backup.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import {
  BACKUP_SCHEMA_VERSION,
  isSensitiveKey,
  collectBackupData,
  createBackup,
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
