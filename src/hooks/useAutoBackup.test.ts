// src/hooks/useAutoBackup.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAutoBackup } from './useAutoBackup';
import * as autoBackupService from '../services/autoBackup';
import { STORAGE_KEYS } from '../config/constants';

vi.mock('../services/autoBackup', () => ({
  isFileSystemAccessSupported: vi.fn(),
  loadHandle: vi.fn(),
  saveHandle: vi.fn(),
  clearHandle: vi.fn(),
  chooseBackupFile: vi.fn(),
  ensurePermission: vi.fn(),
  writeSnapshot: vi.fn(),
}));

const mocked = vi.mocked(autoBackupService);

function fakeHandle(overrides: Partial<FileSystemFileHandle> = {}): FileSystemFileHandle {
  return {
    kind: 'file',
    name: 'acgen-auto-backup.json',
    ...overrides,
  } as unknown as FileSystemFileHandle;
}

/** A promise plus its resolver, for controlling exactly when an in-flight write settles. */
function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

async function mountActive(onSnapshot?: () => void) {
  const handle = fakeHandle({ queryPermission: vi.fn().mockResolvedValue('granted') });
  mocked.isFileSystemAccessSupported.mockReturnValue(true);
  mocked.loadHandle.mockResolvedValue(handle);
  const { result } = renderHook(() => useAutoBackup(onSnapshot));
  await act(async () => {});
  expect(result.current.status).toBe('active');
  return { result, handle };
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  mocked.isFileSystemAccessSupported.mockReturnValue(true);
  mocked.loadHandle.mockResolvedValue(null);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useAutoBackup', () => {
  it('is "unsupported" when the File System Access API is not available', async () => {
    mocked.isFileSystemAccessSupported.mockReturnValue(false);

    const { result } = renderHook(() => useAutoBackup());
    await act(async () => {});

    expect(result.current.status).toBe('unsupported');
    expect(mocked.loadHandle).not.toHaveBeenCalled();
  });

  it('is "off" when supported but no handle was persisted', async () => {
    mocked.loadHandle.mockResolvedValue(null);

    const { result } = renderHook(() => useAutoBackup());
    await act(async () => {});

    expect(result.current.status).toBe('off');
  });

  it('is "active" when the persisted handle already grants readwrite permission', async () => {
    const handle = fakeHandle({ queryPermission: vi.fn().mockResolvedValue('granted') });
    mocked.loadHandle.mockResolvedValue(handle);

    const { result } = renderHook(() => useAutoBackup());
    await act(async () => {});

    expect(result.current.status).toBe('active');
  });

  it('is "permissionNeeded" when the persisted handle needs a prompt', async () => {
    const handle = fakeHandle({ queryPermission: vi.fn().mockResolvedValue('prompt') });
    mocked.loadHandle.mockResolvedValue(handle);

    const { result } = renderHook(() => useAutoBackup());
    await act(async () => {});

    expect(result.current.status).toBe('permissionNeeded');
  });

  it('enable(): picks a file, saves the handle, writes an immediate snapshot without API keys, and goes active', async () => {
    localStorage.setItem('acgen_key_openai', 'sk-secret');
    const handle = fakeHandle();
    mocked.chooseBackupFile.mockResolvedValue(handle);
    mocked.saveHandle.mockResolvedValue(undefined);
    mocked.writeSnapshot.mockResolvedValue(true);
    const onSnapshot = vi.fn();

    const { result } = renderHook(() => useAutoBackup(onSnapshot));
    await act(async () => {});

    await act(async () => {
      await result.current.enable();
    });

    expect(mocked.saveHandle).toHaveBeenCalledWith(handle);
    expect(mocked.writeSnapshot).toHaveBeenCalledTimes(1);
    const [writtenHandle, content] = mocked.writeSnapshot.mock.calls[0];
    expect(writtenHandle).toBe(handle);
    expect(content).not.toContain('sk-secret');
    expect(result.current.status).toBe('active');
    expect(onSnapshot).toHaveBeenCalledTimes(1);
  });

  it('enable(): cancelling the picker leaves status "off" and saves nothing', async () => {
    mocked.chooseBackupFile.mockResolvedValue(null);

    const { result } = renderHook(() => useAutoBackup());
    await act(async () => {});

    await act(async () => {
      await result.current.enable();
    });

    expect(result.current.status).toBe('off');
    expect(mocked.saveHandle).not.toHaveBeenCalled();
    expect(mocked.writeSnapshot).not.toHaveBeenCalled();
  });

  it('debounces snapshots across sync events while active, one write per quiet 5s window', async () => {
    const { result } = await mountActive();
    mocked.writeSnapshot.mockResolvedValue(true);
    vi.useFakeTimers();

    act(() => {
      window.dispatchEvent(new CustomEvent('acgen-local-storage'));
    });
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    act(() => {
      window.dispatchEvent(new Event('storage'));
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(mocked.writeSnapshot).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe('active');

    act(() => {
      window.dispatchEvent(new CustomEvent('acgen-local-storage'));
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(mocked.writeSnapshot).toHaveBeenCalledTimes(2);
  });

  it('does not self-sustain: onSnapshot writing acgen_last_backup must not reschedule another snapshot', async () => {
    mocked.writeSnapshot.mockResolvedValue(true);
    // Simulate exactly what markDone (via useLocalStorage's setValue) does
    // after a successful snapshot: write acgen_last_backup and dispatch the
    // same sync event useAutoBackup listens to for scheduling.
    const onSnapshot = vi.fn(() => {
      localStorage.setItem(STORAGE_KEYS.LAST_BACKUP, JSON.stringify(Date.now()));
      window.dispatchEvent(
        new CustomEvent('acgen-local-storage', { detail: { key: STORAGE_KEYS.LAST_BACKUP, value: Date.now() } }),
      );
    });
    const { result } = await mountActive(onSnapshot);
    vi.useFakeTimers();

    // A genuine data change schedules and produces exactly one snapshot.
    act(() => {
      window.dispatchEvent(
        new CustomEvent('acgen-local-storage', { detail: { key: 'acgen_theme', value: '"dark"' } }),
      );
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(mocked.writeSnapshot).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe('active');

    // Advance through several more debounce windows. If the LAST_BACKUP
    // dispatch from onSnapshot rescheduled itself, this grows unboundedly.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000 * 5);
    });
    expect(mocked.writeSnapshot).toHaveBeenCalledTimes(1);

    // A subsequent genuine data change still schedules normally — the fix
    // must not over-filter real changes.
    act(() => {
      window.dispatchEvent(
        new CustomEvent('acgen-local-storage', { detail: { key: 'acgen_theme', value: '"light"' } }),
      );
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(mocked.writeSnapshot).toHaveBeenCalledTimes(2);
  });

  it('a failed debounced snapshot moves to "error" and stops writing on further events', async () => {
    const { result } = await mountActive();
    mocked.writeSnapshot.mockResolvedValue(false);
    vi.useFakeTimers();

    act(() => {
      window.dispatchEvent(new CustomEvent('acgen-local-storage'));
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(result.current.status).toBe('error');
    expect(mocked.writeSnapshot).toHaveBeenCalledTimes(1);

    act(() => {
      window.dispatchEvent(new CustomEvent('acgen-local-storage'));
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(mocked.writeSnapshot).toHaveBeenCalledTimes(1);
  });

  it('disable(): clears the handle, goes "off", and stops writing on further sync events', async () => {
    const { result } = await mountActive();
    mocked.clearHandle.mockResolvedValue(undefined);
    vi.useFakeTimers();

    await act(async () => {
      await result.current.disable();
    });

    expect(mocked.clearHandle).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe('off');

    act(() => {
      window.dispatchEvent(new CustomEvent('acgen-local-storage'));
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(mocked.writeSnapshot).not.toHaveBeenCalled();
  });

  it('a debounced write still in flight when disable() runs does not resurrect "active" once it resolves', async () => {
    const onSnapshot = vi.fn();
    const { result } = await mountActive(onSnapshot);
    const write = deferred<boolean>();
    mocked.writeSnapshot.mockReturnValue(write.promise);
    mocked.clearHandle.mockResolvedValue(undefined);
    vi.useFakeTimers();

    act(() => {
      window.dispatchEvent(new CustomEvent('acgen-local-storage'));
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    // The debounce fired and the write started, but it's still pending.
    expect(mocked.writeSnapshot).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe('active');

    await act(async () => {
      await result.current.disable();
    });
    expect(result.current.status).toBe('off');

    // Now the stale write resolves successfully — it must not flip status
    // back to 'active' or fire onSnapshot for a backup the user disabled.
    await act(async () => {
      write.resolve(true);
      await write.promise;
    });

    expect(result.current.status).toBe('off');
    expect(onSnapshot).not.toHaveBeenCalled();
  });

  it('enable()\'s immediate snapshot settling after a quick disable() does not resurrect "active"', async () => {
    mocked.loadHandle.mockResolvedValue(null);
    const handle = fakeHandle();
    mocked.chooseBackupFile.mockResolvedValue(handle);
    mocked.saveHandle.mockResolvedValue(undefined);
    mocked.clearHandle.mockResolvedValue(undefined);
    const write = deferred<boolean>();
    mocked.writeSnapshot.mockReturnValue(write.promise);
    const onSnapshot = vi.fn();

    const { result } = renderHook(() => useAutoBackup(onSnapshot));
    await act(async () => {});
    expect(result.current.status).toBe('off');

    let enablePromise!: Promise<void>;
    act(() => {
      enablePromise = result.current.enable();
    });

    // Let enable() run up through chooseBackupFile/saveHandle and reach the
    // (still-pending) writeSnapshot call, without waiting on the write itself.
    await waitFor(() => expect(mocked.writeSnapshot).toHaveBeenCalledTimes(1));

    await act(async () => {
      await result.current.disable();
    });
    expect(result.current.status).toBe('off');

    await act(async () => {
      write.resolve(true);
      await write.promise;
      await enablePromise;
    });

    expect(result.current.status).toBe('off');
    expect(onSnapshot).not.toHaveBeenCalled();
  });
});

describe('useAutoBackup — fallos y cierre de pestana', () => {
  it('un fallo al elegir o guardar el fichero deja status "error", no una promesa rechazada suelta', async () => {
    mocked.chooseBackupFile.mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useAutoBackup());
    await act(async () => {});
    await act(async () => { await result.current.enable(); });
    expect(result.current.status).toBe('error');
  });

  it('vacia el snapshot pendiente al ocultar la pagina (pagehide) en vez de perderlo', async () => {
    const { handle } = await mountActive();
    mocked.writeSnapshot.mockResolvedValue(true);
    vi.useFakeTimers();
    act(() => {
      window.dispatchEvent(new CustomEvent('acgen-local-storage', { detail: { key: 'acgen_sprints', value: [] } }));
    });
    expect(mocked.writeSnapshot).not.toHaveBeenCalled();
    act(() => { window.dispatchEvent(new Event('pagehide')); });
    expect(mocked.writeSnapshot).toHaveBeenCalledWith(handle, expect.anything());
  });
});
