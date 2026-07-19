// src/services/backup.ts
//
// Pure logic core for backing up and restoring ACGen's localStorage state.
// No React, no component imports — consumed later by a UI menu and an
// auto-backup hook.

import { STORAGE_KEYS } from '../config/constants';

export const BACKUP_SCHEMA_VERSION = 1;
export const STORAGE_PREFIX = 'acgen_';

const LAST_BACKUP_KEY = STORAGE_KEYS.LAST_BACKUP;
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

export type RestoreResult = { ok: true } | { ok: false; error: 'quota' };

/** Every current acgen_* entry, keyed by name, values verbatim. */
function snapshotCurrentState(): Record<string, string> {
  const snapshot: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(STORAGE_PREFIX)) {
      const value = localStorage.getItem(key);
      if (value !== null) snapshot[key] = value;
    }
  }
  return snapshot;
}

/** Wipes every current acgen_* entry and rewrites exactly the given snapshot. */
function applySnapshot(snapshot: Record<string, string>): void {
  const currentKeys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(STORAGE_PREFIX)) currentKeys.push(key);
  }
  for (const key of currentKeys) localStorage.removeItem(key);
  for (const [key, value] of Object.entries(snapshot)) {
    localStorage.setItem(key, value);
  }
}

/**
 * Replaces the app's entire acgen_* localStorage state with the contents of
 * a backup. acgen_last_backup is always preserved (restoring isn't the same
 * as having just made a backup). If the backup itself carries no sensitive
 * keys, local API keys are preserved too — restoring on a freshly set-up
 * machine shouldn't wipe out a key the user just entered. Foreign
 * (non-acgen_) keys are never touched. On quota failure, the previous state
 * is fully restored and the app is left exactly as it was.
 */
export function restoreBackup(backup: BackupFile): RestoreResult {
  const snapshot = snapshotCurrentState();
  const backupHasKeys = Object.keys(backup.data).some(isSensitiveKey);

  for (const key of Object.keys(snapshot)) {
    if (key === LAST_BACKUP_KEY) continue;
    if (!backupHasKeys && isSensitiveKey(key)) continue;
    localStorage.removeItem(key);
  }

  try {
    for (const [key, value] of Object.entries(backup.data)) {
      if (!key.startsWith(STORAGE_PREFIX) || key === LAST_BACKUP_KEY) continue;
      localStorage.setItem(key, value);
    }
  } catch {
    applySnapshot(snapshot);
    return { ok: false, error: 'quota' };
  }

  return { ok: true };
}
