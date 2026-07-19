// src/hooks/useAutoBackup.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAutoBackup } from './useAutoBackup';
import * as autoBackupService from '../services/autoBackup';

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

async function mountActive() {
  const handle = fakeHandle({ queryPermission: vi.fn().mockResolvedValue('granted') });
  mocked.isFileSystemAccessSupported.mockReturnValue(true);
  mocked.loadHandle.mockResolvedValue(handle);
  const { result } = renderHook(() => useAutoBackup());
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
});
