// src/services/autoBackup.ts
//
// File System Access API service: lets the user pick a single local file
// (Chromium-family browsers only) that ACGen writes JSON backup snapshots
// into, and persists the resulting FileSystemFileHandle in IndexedDB — the
// only storage that can hold a file handle across page reloads.
//
// Pure service, no React. If the user clears site data the handle is lost
// (IndexedDB is wiped along with everything else) and they'll be prompted
// to choose the file again — but the file already written to disk survives,
// which is what actually matters.

const DB_NAME = 'acgen-backup';
const DB_VERSION = 1;
const STORE_NAME = 'handles';
const HANDLE_KEY = 'autoBackupFile';

/** True in Chromium-family browsers that expose the File System Access API. */
export function isFileSystemAccessSupported(): boolean {
  return typeof window !== 'undefined' && 'showSaveFilePicker' in window;
}

function promisifyRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Opens (creating if needed) the single-store handle database. */
function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Persists the chosen file handle under a fixed key. */
export async function saveHandle(handle: FileSystemFileHandle): Promise<void> {
  const db = await openDb();
  const store = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME);
  await promisifyRequest(store.put(handle, HANDLE_KEY));
}

/** The persisted handle, or null if none was saved or IndexedDB itself failed. */
export async function loadHandle(): Promise<FileSystemFileHandle | null> {
  try {
    const db = await openDb();
    const store = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME);
    const request = store.get(HANDLE_KEY) as IDBRequest<FileSystemFileHandle | undefined>;
    const result = await promisifyRequest(request);
    return result ?? null;
  } catch {
    return null;
  }
}

/** Removes the persisted handle. Deleting an absent key is a native IDB no-op. */
export async function clearHandle(): Promise<void> {
  const db = await openDb();
  const store = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME);
  await promisifyRequest(store.delete(HANDLE_KEY));
}

/**
 * Prompts the user to pick (or create) the local file ACGen will write
 * snapshots to. Resolves null if the user cancels the picker; any other
 * failure (e.g. calling this when the API isn't supported) propagates.
 */
export async function chooseBackupFile(): Promise<FileSystemFileHandle | null> {
  try {
    return await window.showSaveFilePicker({
      suggestedName: 'acgen-auto-backup.json',
      types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }],
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return null;
    throw err;
  }
}

/**
 * Resolves readwrite permission for a previously-saved handle, prompting the
 * user if needed. If the handle doesn't expose queryPermission at all (a
 * rare/older implementation) we fall back to requestPermission directly, and
 * if that's missing too we optimistically report true — writeSnapshot will
 * simply fail (and report false) if the write itself turns out to be denied.
 */
export async function ensurePermission(handle: FileSystemFileHandle): Promise<boolean> {
  const descriptor: FileSystemHandlePermissionDescriptor = { mode: 'readwrite' };

  if (typeof handle.queryPermission === 'function') {
    const state = await handle.queryPermission(descriptor);
    if (state === 'granted') return true;
    if (state === 'denied') return false;
    if (typeof handle.requestPermission !== 'function') return true;
    return (await handle.requestPermission(descriptor)) === 'granted';
  }

  if (typeof handle.requestPermission === 'function') {
    return (await handle.requestPermission(descriptor)) === 'granted';
  }

  return true;
}

/**
 * Writes a snapshot to the given handle. Never throws: permission denial
 * short-circuits to false without attempting a write, and any I/O failure
 * during the write also resolves to false so callers can surface a soft
 * warning instead of crashing.
 */
export async function writeSnapshot(handle: FileSystemFileHandle, contents: string): Promise<boolean> {
  const allowed = await ensurePermission(handle);
  if (!allowed) return false;

  try {
    const writable = await handle.createWritable();
    await writable.write(contents);
    await writable.close();
    return true;
  } catch {
    return false;
  }
}
