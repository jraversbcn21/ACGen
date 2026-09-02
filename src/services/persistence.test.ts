// src/services/persistence.test.ts
import { describe, it, expect, afterEach, vi } from 'vitest';
import { requestPersistentStorage, writeStorage, LOCAL_SYNC_EVENT, STORAGE_ERROR_EVENT } from './persistence';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('requestPersistentStorage', () => {
  it('returns false without throwing when navigator.storage does not exist (jsdom default)', async () => {
    // In bare jsdom, navigator.storage.persist doesn't exist
    // This test verifies the happy path for environments without storage support
    const result = await requestPersistentStorage();
    expect(result).toBe(false);
  });

  it('calls navigator.storage.persist and returns true when granted, logging via console.info', async () => {
    const persistFn = vi.fn().mockResolvedValue(true);
    vi.stubGlobal('navigator', {
      storage: {
        persist: persistFn,
      },
    } as unknown as Navigator);

    const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    const result = await requestPersistentStorage();

    expect(result).toBe(true);
    expect(persistFn).toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith('ACGen: persistent storage', 'granted');

    consoleSpy.mockRestore();
  });

  it('handles rejection from navigator.storage.persist gracefully, returning false without throwing', async () => {
    const persistFn = vi.fn().mockRejectedValue(new Error('persist failed'));
    vi.stubGlobal('navigator', {
      storage: {
        persist: persistFn,
      },
    } as unknown as Navigator);

    const result = await requestPersistentStorage();

    expect(result).toBe(false);
    expect(persistFn).toHaveBeenCalled();
  });
});

describe('writeStorage', () => {
  it('persiste y avisa al mismo tab con el evento de sincronizacion', () => {
    const seen: unknown[] = [];
    const onSync = (e: Event) => seen.push((e as CustomEvent).detail);
    window.addEventListener(LOCAL_SYNC_EVENT, onSync);
    expect(writeStorage('acgen_x', { a: 1 })).toBe(true);
    window.removeEventListener(LOCAL_SYNC_EVENT, onSync);
    expect(localStorage.getItem('acgen_x')).toBe('{"a":1}');
    expect(seen).toEqual([{ key: 'acgen_x', value: { a: 1 } }]);
  });

  it('si el navegador rechaza la escritura (cuota) lo anuncia en vez de tragarselo', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('quota', 'QuotaExceededError'); });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const onError = vi.fn();
    window.addEventListener(STORAGE_ERROR_EVENT, onError);
    expect(writeStorage('acgen_x', 1)).toBe(false);
    window.removeEventListener(STORAGE_ERROR_EVENT, onError);
    expect(onError).toHaveBeenCalledTimes(1);
    vi.restoreAllMocks();
  });
});
