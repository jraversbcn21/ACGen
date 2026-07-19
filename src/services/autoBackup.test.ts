// src/services/autoBackup.test.ts
import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  isFileSystemAccessSupported,
  saveHandle,
  loadHandle,
  clearHandle,
  chooseBackupFile,
  ensurePermission,
  writeSnapshot,
} from './autoBackup';

// --- Minimal fake IndexedDB -------------------------------------------------
//
// jsdom implements neither indexedDB nor showSaveFilePicker. This fake models
// just enough of IDBFactory/IDBDatabase/IDBObjectStore for autoBackup.ts's
// promisified helper to drive against: open() returns a request-like object
// whose onupgradeneeded/onsuccess/onerror fire asynchronously (queueMicrotask,
// mirroring real IDB's async callback timing), backed by a single in-memory
// Map per fake instance.

interface FakeRequest<T> {
  onsuccess: (() => void) | null;
  onerror: (() => void) | null;
  result: T;
  error: unknown;
}

interface FakeOpenRequest<T> extends FakeRequest<T> {
  onupgradeneeded: (() => void) | null;
}

function makeFakeRequest<T>(): FakeRequest<T> {
  return { onsuccess: null, onerror: null, result: undefined as unknown as T, error: null };
}

function createFakeIndexedDB(options: { failOpen?: boolean } = {}) {
  const stores = new Map<string, Map<string, unknown>>();

  function makeStore(name: string) {
    const map = stores.get(name) as Map<string, unknown>;
    return {
      get(key: string) {
        const req = makeFakeRequest<unknown>();
        queueMicrotask(() => {
          req.result = map.get(key);
          req.onsuccess?.();
        });
        return req;
      },
      put(value: unknown, key: string) {
        const req = makeFakeRequest<unknown>();
        queueMicrotask(() => {
          map.set(key, value);
          req.result = key;
          req.onsuccess?.();
        });
        return req;
      },
      delete(key: string) {
        const req = makeFakeRequest<unknown>();
        queueMicrotask(() => {
          map.delete(key);
          req.onsuccess?.();
        });
        return req;
      },
    };
  }

  const db = {
    objectStoreNames: {
      contains: (name: string) => stores.has(name),
    },
    createObjectStore: (name: string) => {
      stores.set(name, new Map());
      return makeStore(name);
    },
    transaction: (storeName: string) => ({
      objectStore: (name: string) => makeStore(name ?? storeName),
    }),
  };

  return {
    open() {
      const req: FakeOpenRequest<typeof db> = {
        onsuccess: null,
        onerror: null,
        onupgradeneeded: null,
        result: db,
        error: null,
      };
      queueMicrotask(() => {
        if (options.failOpen) {
          req.error = new Error('fake open failure');
          req.onerror?.();
          return;
        }
        if (!stores.has('handles')) {
          req.onupgradeneeded?.();
        }
        req.onsuccess?.();
      });
      return req;
    },
    // exposed for assertions/setup convenience in tests that need it
    _stores: stores,
  };
}

function installFakeIndexedDB(options: { failOpen?: boolean } = {}) {
  const fake = createFakeIndexedDB(options);
  vi.stubGlobal('indexedDB', fake as unknown as IDBFactory);
  return fake;
}

function fakeHandle(overrides: Partial<FileSystemFileHandle> = {}): FileSystemFileHandle {
  return {
    kind: 'file',
    name: 'acgen-auto-backup.json',
    ...overrides,
  } as unknown as FileSystemFileHandle;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('isFileSystemAccessSupported', () => {
  it('is false in bare jsdom (no showSaveFilePicker)', () => {
    expect(isFileSystemAccessSupported()).toBe(false);
  });

  it('is true once window.showSaveFilePicker is stubbed', () => {
    vi.stubGlobal('showSaveFilePicker', vi.fn());
    expect(isFileSystemAccessSupported()).toBe(true);
  });
});

describe('saveHandle / loadHandle', () => {
  it('round-trips the same handle object', async () => {
    installFakeIndexedDB();
    const handle = fakeHandle();

    await saveHandle(handle);
    const loaded = await loadHandle();

    expect(loaded).toBe(handle);
  });
});

describe('loadHandle', () => {
  it('is null when nothing was saved', async () => {
    installFakeIndexedDB();
    expect(await loadHandle()).toBeNull();
  });

  it('is null (never throws) when indexedDB.open fails', async () => {
    installFakeIndexedDB({ failOpen: true });
    await expect(loadHandle()).resolves.toBeNull();
  });
});

describe('clearHandle', () => {
  it('removes a saved handle so loadHandle returns null afterwards', async () => {
    installFakeIndexedDB();
    await saveHandle(fakeHandle());

    await clearHandle();

    expect(await loadHandle()).toBeNull();
  });

  it('does not throw when the store is already empty', async () => {
    installFakeIndexedDB();
    await expect(clearHandle()).resolves.toBeUndefined();
  });
});

describe('chooseBackupFile', () => {
  it('returns the handle from the picker, called with the expected suggestedName/types', async () => {
    const handle = fakeHandle();
    const picker = vi.fn().mockResolvedValue(handle);
    vi.stubGlobal('showSaveFilePicker', picker);

    const result = await chooseBackupFile();

    expect(result).toBe(handle);
    expect(picker).toHaveBeenCalledWith(
      expect.objectContaining({
        suggestedName: 'acgen-auto-backup.json',
        types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }],
      }),
    );
  });

  it('returns null when the user cancels the picker (AbortError)', async () => {
    const picker = vi.fn().mockRejectedValue(new DOMException('cancelled', 'AbortError'));
    vi.stubGlobal('showSaveFilePicker', picker);

    expect(await chooseBackupFile()).toBeNull();
  });

  it('propagates other errors', async () => {
    const picker = vi.fn().mockRejectedValue(new Error('disk exploded'));
    vi.stubGlobal('showSaveFilePicker', picker);

    await expect(chooseBackupFile()).rejects.toThrow('disk exploded');
  });
});

describe('ensurePermission', () => {
  it('is true when queryPermission already grants, without calling requestPermission', async () => {
    const requestPermission = vi.fn();
    const handle = fakeHandle({
      queryPermission: vi.fn().mockResolvedValue('granted'),
      requestPermission,
    });

    expect(await ensurePermission(handle)).toBe(true);
    expect(requestPermission).not.toHaveBeenCalled();
  });

  it('is true when queryPermission prompts and requestPermission grants', async () => {
    const handle = fakeHandle({
      queryPermission: vi.fn().mockResolvedValue('prompt'),
      requestPermission: vi.fn().mockResolvedValue('granted'),
    });

    expect(await ensurePermission(handle)).toBe(true);
  });

  it('is false when queryPermission prompts and requestPermission denies', async () => {
    const handle = fakeHandle({
      queryPermission: vi.fn().mockResolvedValue('prompt'),
      requestPermission: vi.fn().mockResolvedValue('denied'),
    });

    expect(await ensurePermission(handle)).toBe(false);
  });

  it('is false when queryPermission denies outright', async () => {
    const requestPermission = vi.fn();
    const handle = fakeHandle({
      queryPermission: vi.fn().mockResolvedValue('denied'),
      requestPermission,
    });

    expect(await ensurePermission(handle)).toBe(false);
    expect(requestPermission).not.toHaveBeenCalled();
  });
});

describe('writeSnapshot', () => {
  it('writes and closes on the happy path', async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    const close = vi.fn().mockResolvedValue(undefined);
    const handle = fakeHandle({
      queryPermission: vi.fn().mockResolvedValue('granted'),
      createWritable: vi.fn().mockResolvedValue({ write, close }),
    });

    const result = await writeSnapshot(handle, '{"data":true}');

    expect(result).toBe(true);
    expect(write).toHaveBeenCalledWith('{"data":true}');
    expect(close).toHaveBeenCalled();
  });

  it('is false without attempting to write when permission is denied', async () => {
    const createWritable = vi.fn();
    const handle = fakeHandle({
      queryPermission: vi.fn().mockResolvedValue('denied'),
      createWritable,
    });

    const result = await writeSnapshot(handle, '{"data":true}');

    expect(result).toBe(false);
    expect(createWritable).not.toHaveBeenCalled();
  });

  it('is false (never throws) when write() itself fails', async () => {
    const write = vi.fn().mockRejectedValue(new Error('disk full'));
    const close = vi.fn().mockResolvedValue(undefined);
    const handle = fakeHandle({
      queryPermission: vi.fn().mockResolvedValue('granted'),
      createWritable: vi.fn().mockResolvedValue({ write, close }),
    });

    await expect(writeSnapshot(handle, '{"data":true}')).resolves.toBe(false);
  });

  it('is false (never throws) when ensurePermission itself rejects (e.g. SecurityError)', async () => {
    const createWritable = vi.fn();
    const handle = fakeHandle({
      queryPermission: vi.fn().mockRejectedValue(new DOMException('denied', 'SecurityError')),
      createWritable,
    });

    await expect(writeSnapshot(handle, '{"data":true}')).resolves.toBe(false);
    expect(createWritable).not.toHaveBeenCalled();
  });
});
