import { useState, useCallback, useEffect } from 'react';
import type { HistoryEntry } from '../types';
import { writeStorage } from '../services/persistence';

const MAX_ENTRIES = 10;

function hydrate(raw: string | null): HistoryEntry[] {
  try {
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function useHistory(storageKey: string) {
  const [history, setHistory] = useState<HistoryEntry[]>(() => hydrate(localStorage.getItem(storageKey)));

  // Otra pestana escribio (o restauro una copia): rehidratar en vez de pisar
  // sus entradas con el `prev` de esta pestana en el siguiente addEntry.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === storageKey) setHistory(hydrate(e.newValue));
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [storageKey]);

  const addEntry = useCallback((input: string, output: string) => {
    const entry: HistoryEntry = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      inputPreview: input.trim().slice(0, 60),
      output,
    };
    setHistory(prev => {
      const updated = [entry, ...prev].slice(0, MAX_ENTRIES);
      writeStorage(storageKey, updated);
      return updated;
    });
  }, [storageKey]);

  const clearHistory = useCallback(() => {
    localStorage.removeItem(storageKey);
    setHistory([]);
  }, [storageKey]);

  return { history, addEntry, clearHistory };
}
