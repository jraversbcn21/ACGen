// src/services/backup.ts
//
// Pure logic core for backing up and restoring ACGen's localStorage state.
// No React, no component imports — consumed later by a UI menu and an
// auto-backup hook.

export const BACKUP_SCHEMA_VERSION = 1;
export const STORAGE_PREFIX = 'acgen_';

const LAST_BACKUP_KEY = 'acgen_last_backup';
const SENSITIVE_KEY_PATTERN = /^acgen_key_/;
const LEGACY_API_KEY = 'acgen_api_key';

/** True for the API key family (`acgen_key_*`) and the legacy `acgen_api_key`. */
export function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERN.test(key) || key === LEGACY_API_KEY;
}

export interface BackupFile {
  schemaVersion: number;
  exportedAt: string; // ISO 8601
  data: Record<string, string>; // raw localStorage values, verbatim
}

export interface BackupOptions {
  includeApiKeys?: boolean; // default false
}

/**
 * Snapshots every acgen_* localStorage entry verbatim (no JSON.parse — values
 * are heterogeneous: JSON, raw prompt strings, and bare 'true' literals).
 * acgen_last_backup is always excluded (it's a local metadata marker, not
 * app state). Sensitive keys (API keys in the clear) are excluded unless the
 * caller opts in.
 */
export function collectBackupData(opts?: BackupOptions): Record<string, string> {
  const includeApiKeys = opts?.includeApiKeys ?? false;
  const data: Record<string, string> = {};

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith(STORAGE_PREFIX)) continue;
    if (key === LAST_BACKUP_KEY) continue;
    if (isSensitiveKey(key) && !includeApiKeys) continue;

    const value = localStorage.getItem(key);
    if (value !== null) {
      data[key] = value;
    }
  }

  return data;
}

/** Serializes the current app state into a pretty-printed backup JSON string. */
export function createBackup(opts?: BackupOptions): string {
  const backup: BackupFile = {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    data: collectBackupData(opts),
  };
  return JSON.stringify(backup, null, 2);
}
