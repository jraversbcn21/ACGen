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
// Known limitation (accepted): only 'acgen-local-storage' (same-tab, fired
// by useLocalStorage) and the native 'storage' (cross-tab) events are
// observed. useSprints/useRegressions/useHistory write directly via
// localStorage.setItem without dispatching either event, so a change made
// only through those hooks won't trigger an immediate snapshot — it will be
// captured by the next change that does dispatch, or once the page
// reconnects. Patching those domain hooks is out of scope for this task.

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

  const enable = useCallback(async () => {
    const handle = await chooseBackupFile();
    if (!handle) return;
    handleRef.current = handle;
    await saveHandle(handle);
    await snapshotNow(handle);
  }, [snapshotNow]);

  const disable = useCallback(async () => {
    await clearHandle();
    handleRef.current = null;
    setStatus('off');
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

    const scheduleSnapshot = () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        void snapshotNow(handle);
      }, DEBOUNCE_MS);
    };

    for (const event of SYNC_EVENTS) window.addEventListener(event, scheduleSnapshot);

    return () => {
      for (const event of SYNC_EVENTS) window.removeEventListener(event, scheduleSnapshot);
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [status, snapshotNow]);

  return { status, enable, disable, reconnect };
}
