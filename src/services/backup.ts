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

export type ImportParseResult =
  | { kind: 'backup'; backup: BackupFile }
  | { kind: 'legacyWorkspace'; json: string } // original string, verbatim
  | { kind: 'futureVersion'; schemaVersion: number }
  | { kind: 'invalid'; reason: 'json' | 'structure' };

/** A plain (non-array) object whose own values are all strings. */
function isStringRecord(value: unknown): value is Record<string, string> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  return Object.values(value).every((v) => typeof v === 'string');
}

/**
 * Classifies an imported JSON file: a current-schema backup, a file from a
 * future (unsupported) schema version, a legacy single-workspace export
 * (pre-dating the backup feature), or something unreadable/malformed.
 */
export function parseImportFile(json: string): ImportParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { kind: 'invalid', reason: 'json' };
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { kind: 'invalid', reason: 'structure' };
  }

  const obj = parsed as Record<string, unknown>;

  if (typeof obj.schemaVersion === 'number') {
    if (obj.schemaVersion > BACKUP_SCHEMA_VERSION) {
      return { kind: 'futureVersion', schemaVersion: obj.schemaVersion };
    }
    if (!isStringRecord(obj.data)) {
      return { kind: 'invalid', reason: 'structure' };
    }
    return {
      kind: 'backup',
      backup: {
        schemaVersion: obj.schemaVersion,
        exportedAt: typeof obj.exportedAt === 'string' ? obj.exportedAt : '',
        data: obj.data,
      },
    };
  }

  if (typeof obj.id === 'string' && typeof obj.name === 'string' && Array.isArray(obj.artifacts)) {
    return { kind: 'legacyWorkspace', json };
  }

  return { kind: 'invalid', reason: 'structure' };
}
