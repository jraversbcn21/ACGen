// src/services/backup.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  BACKUP_SCHEMA_VERSION,
  isSensitiveKey,
  collectBackupData,
  createBackup,
  parseImportFile,
  restoreBackup,
  type BackupFile,
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

describe('restoreBackup', () => {
  it('replaces the full acgen_* state — old keys disappear, new ones appear verbatim', () => {
    localStorage.setItem('acgen_old_key', 'stale');
    const backup: BackupFile = {
      schemaVersion: 1,
      exportedAt: '2026-01-01T00:00:00.000Z',
      data: { acgen_theme: '"dark"', acgen_prompt_acceptance: 'raw prompt text' },
    };

    const result = restoreBackup(backup);

    expect(result).toEqual({ ok: true });
    expect(localStorage.getItem('acgen_old_key')).toBeNull();
    expect(localStorage.getItem('acgen_theme')).toBe('"dark"');
    expect(localStorage.getItem('acgen_prompt_acceptance')).toBe('raw prompt text');
  });

  it('preserves the local acgen_key_groq when the backup carries no sensitive keys', () => {
    localStorage.setItem('acgen_key_groq', 'local_secret');
    const backup: BackupFile = {
      schemaVersion: 1,
      exportedAt: '2026-01-01T00:00:00.000Z',
      data: { acgen_theme: '"dark"' },
    };

    restoreBackup(backup);

    expect(localStorage.getItem('acgen_key_groq')).toBe('local_secret');
  });

  it('overwrites local sensitive keys when the backup carries its own', () => {
    localStorage.setItem('acgen_key_groq', 'local_secret');
    const backup: BackupFile = {
      schemaVersion: 1,
      exportedAt: '2026-01-01T00:00:00.000Z',
      data: { acgen_key_groq: 'backup_secret' },
    };

    restoreBackup(backup);

    expect(localStorage.getItem('acgen_key_groq')).toBe('backup_secret');
  });

  it('does not write a data entry whose key does not start with acgen_ (tampered file)', () => {
    const backup: BackupFile = {
      schemaVersion: 1,
      exportedAt: '2026-01-01T00:00:00.000Z',
      data: { acgen_theme: '"dark"', malicious_key: 'evil' },
    };

    restoreBackup(backup);

    expect(localStorage.getItem('malicious_key')).toBeNull();
    expect(localStorage.getItem('acgen_theme')).toBe('"dark"');
  });

  it('leaves a foreign key untouched', () => {
    localStorage.setItem('otra_app_x', 'valor ajeno');
    const backup: BackupFile = {
      schemaVersion: 1,
      exportedAt: '2026-01-01T00:00:00.000Z',
      data: { acgen_theme: '"dark"' },
    };

    restoreBackup(backup);

    expect(localStorage.getItem('otra_app_x')).toBe('valor ajeno');
  });

  it('rolls back to the exact previous state when a write hits quota', () => {
    localStorage.setItem('acgen_theme', '"light"');
    localStorage.setItem('acgen_key_groq', 'local_secret');

    const backup: BackupFile = {
      schemaVersion: 1,
      exportedAt: '2026-01-01T00:00:00.000Z',
      data: { acgen_theme: '"dark"', acgen_model: '"llama"' },
    };

    let calls = 0;
    const originalSetItem = Storage.prototype.setItem;
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(
      function (this: Storage, key: string, value: string) {
        calls++;
        if (calls === 2) {
          throw new DOMException('Quota exceeded', 'QuotaExceededError');
        }
        originalSetItem.call(this, key, value);
      },
    );

    const result = restoreBackup(backup);
    setItemSpy.mockRestore();

    expect(result).toEqual({ ok: false, error: 'quota' });
    expect(localStorage.getItem('acgen_theme')).toBe('"light"');
    expect(localStorage.getItem('acgen_key_groq')).toBe('local_secret');
    expect(localStorage.getItem('acgen_model')).toBeNull();
  });
});
