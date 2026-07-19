// src/services/persistence.test.ts
import { describe, it, expect, afterEach, vi } from 'vitest';
import { requestPersistentStorage } from './persistence';

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
