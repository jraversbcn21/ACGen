// src/hooks/useAutoBackup.ts
//
// React state machine wrapping src/services/autoBackup.ts: resolves the
// persisted file handle (if any) on mount, exposes user-gesture actions
// (enable/disable/reconnect), and — while 'active' — listens for local
// same-tab/cross-tab storage changes and writes a debounced snapshot to
// disk. Snapshots never include API keys (createBackup({includeApiKeys:
// false})); writeSnapshot itself never rejects, so failures surface as the
// 'error' status rather than a thrown exception.
//
// Every hook writes through writeStorage (services/persistence.ts), which
// fires 'acgen-local-storage' on each write, so sprint/regression/history
// edits schedule a snapshot too. A pending debounced snapshot is flushed on
// 'pagehide' so closing the tab right after an edit doesn't lose it.

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  isFileSystemAccessSupported,
  loadHandle,
  saveHandle,
  clearHandle,
  chooseBackupFile,
  ensurePermission,
  writeSnapshot,
} from '../services/autoBackup';
import { createBackup } from '../services/backup';
import { STORAGE_KEYS } from '../config/constants';

export type AutoBackupStatus = 'unsupported' | 'off' | 'active' | 'permissionNeeded' | 'error';

export interface AutoBackupState {
  status: AutoBackupStatus;
  enable: () => Promise<void>;
  disable: () => Promise<void>;
  reconnect: () => Promise<void>;
}

const DEBOUNCE_MS = 5000;
const SYNC_EVENTS = ['acgen-local-storage', 'storage'] as const;

export function useAutoBackup(onSnapshot?: () => void): AutoBackupState {
  const [status, setStatus] = useState<AutoBackupStatus>(() =>
    isFileSystemAccessSupported() ? 'off' : 'unsupported',
  );
  const handleRef = useRef<FileSystemFileHandle | null>(null);
  const timerRef = useRef<number | null>(null);

  // Mount: resolve any persisted handle without prompting for permission —
  // that requires a user gesture, which reconnect()/enable() provide.
  useEffect(() => {
    if (!isFileSystemAccessSupported()) return;
    let cancelled = false;

    (async () => {
      const handle = await loadHandle();
      if (cancelled) return;
      if (!handle) {
        setStatus('off');
        return;
      }
      handleRef.current = handle;
      try {
        const state = await handle.queryPermission?.({ mode: 'readwrite' });
        if (cancelled) return;
        setStatus(state === 'granted' ? 'active' : 'permissionNeeded');
      } catch {
        if (!cancelled) setStatus('permissionNeeded');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const snapshotNow = useCallback(
    async (handle: FileSystemFileHandle) => {
      const ok = await writeSnapshot(handle, createBackup({ includeApiKeys: false }));
      // The handle can change (or be cleared by disable()) while this write
      // was in flight — e.g. a debounced snapshot or enable()'s immediate
      // snapshot resolving after the user has already disabled auto-backup.
      // Applying a stale result would resurrect 'active' (and fire
      // onSnapshot/markDone) for a backup the user just turned off.
      if (handleRef.current !== handle) return;
      if (ok) {
        setStatus('active');
        onSnapshot?.();
      } else {
        setStatus('error');
      }
    },
    [onSnapshot],
  );

  // The menu calls these with `void`: a rejection here (picker error, IndexedDB
  // failure) would otherwise be an unhandled promise with zero UI feedback.
  const enable = useCallback(async () => {
    try {
      const handle = await chooseBackupFile();
      if (!handle) return;
      handleRef.current = handle;
      await saveHandle(handle);
      await snapshotNow(handle);
    } catch {
      handleRef.current = null;
      setStatus('error');
    }
  }, [snapshotNow]);

  const disable = useCallback(async () => {
    try {
      await clearHandle();
      handleRef.current = null;
      setStatus('off');
    } catch {
      setStatus('error');
    }
  }, []);

  const reconnect = useCallback(async () => {
    const handle = handleRef.current;
    if (!handle) return;
    const allowed = await ensurePermission(handle);
    if (allowed) {
      await snapshotNow(handle);
    } else {
      setStatus('permissionNeeded');
    }
  }, [snapshotNow]);

  // While active: listen for local/cross-tab changes and debounce a
  // snapshot write. Listeners and the pending timer are torn down whenever
  // status leaves 'active' (including on the transition to 'error').
  useEffect(() => {
    if (status !== 'active') return;
    const handle = handleRef.current;
    if (!handle) return;

    // Identify which key changed, when the event carries that info:
    // CustomEvent('acgen-local-storage') from useLocalStorage sets
    // detail.key; the native cross-tab 'storage' event sets e.key. A change
    // to acgen_last_backup can never affect snapshot content (collectBackupData
    // excludes it) — scheduling on it would let onSnapshot's own markDone()
    // call (which writes that key) reschedule another snapshot forever. If
    // the event carries no key info at all (an older-style dispatch), fail
    // open and schedule anyway — a redundant snapshot beats a missed one.
    const changedKey = (e: Event): string | undefined =>
      e instanceof StorageEvent ? (e.key ?? undefined) : (e as CustomEvent<{ key?: string }>).detail?.key;

    const scheduleSnapshot = (e: Event) => {
      if (changedKey(e) === STORAGE_KEYS.LAST_BACKUP) return;
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        void snapshotNow(handle);
      }, DEBOUNCE_MS);
    };

    // Closing/hiding the tab inside the debounce window would drop the last
    // edits from the on-disk file until the next session's first change.
    const flush = () => {
      if (timerRef.current === null) return;
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
      void snapshotNow(handle);
    };

    for (const event of SYNC_EVENTS) window.addEventListener(event, scheduleSnapshot);
    window.addEventListener('pagehide', flush);

    return () => {
      for (const event of SYNC_EVENTS) window.removeEventListener(event, scheduleSnapshot);
      window.removeEventListener('pagehide', flush);
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [status, snapshotNow]);

  return { status, enable, disable, reconnect };
}
