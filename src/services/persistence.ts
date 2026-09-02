// src/services/persistence.ts

/** Mismo tab: lo dispara cada escritura para que otros hooks (y el auto-backup) se enteren. */
export const LOCAL_SYNC_EVENT = 'acgen-local-storage';
/** El navegador rechazo una escritura (cuota): la app avisa en vez de tragarselo. */
export const STORAGE_ERROR_EVENT = 'acgen-storage-error';

/**
 * Unica puerta de escritura a localStorage. Persiste, avisa al mismo tab y, si
 * el navegador rechaza la escritura, lo anuncia: antes cada hook lo tragaba en
 * consola y la UI seguia mostrando un estado que nunca se guardo. Devuelve si
 * se persistio; el evento de sincronizacion se emite igual para que el estado
 * en memoria siga coherente entre hooks.
 */
export function writeStorage(key: string, value: unknown): boolean {
  let ok = true;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    ok = false;
    console.error(`No se pudo guardar "${key}" en localStorage:`, err);
    window.dispatchEvent(new CustomEvent(STORAGE_ERROR_EVENT, { detail: { key } }));
  }
  window.dispatchEvent(new CustomEvent(LOCAL_SYNC_EVENT, { detail: { key, value } }));
  return ok;
}

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
