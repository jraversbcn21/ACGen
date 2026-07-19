// src/services/persistence.ts

/**
 * Requests persistent storage permission from the browser.
 * - If navigator.storage.persist doesn't exist (jsdom, old browsers), resolves false.
 * - If it exists, calls it and logs the result via console.info.
 * - If persist() rejects, catches and resolves false.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  // Check if navigator.storage.persist exists
  if (!navigator.storage?.persist) {
    return false;
  }

  try {
    const granted = await navigator.storage.persist();
    console.info('ACGen: persistent storage', granted ? 'granted' : 'denied');
    return granted;
  } catch {
    // persist() rejected — fail gracefully
    return false;
  }
}
