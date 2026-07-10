import { useState, useCallback } from 'react';
import type { HistoryEntry } from '../types';

const MAX_ENTRIES = 10;

export function useHistory(storageKey: string) {
  const [history, setHistory] = useState<HistoryEntry[]>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const addEntry = useCallback((input: string, output: string) => {
    const entry: HistoryEntry = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      inputPreview: input.trim().slice(0, 60),
      output,
    };
    setHistory(prev => {
      const updated = [entry, ...prev].slice(0, MAX_ENTRIES);
      try {
        localStorage.setItem(storageKey, JSON.stringify(updated));
      } catch (err) {
        console.error(`No se pudo guardar el historial "${storageKey}" en localStorage:`, err);
      }
      return updated;
    });
  }, [storageKey]);

  const clearHistory = useCallback(() => {
    localStorage.removeItem(storageKey);
    setHistory([]);
  }, [storageKey]);

  return { history, addEntry, clearHistory };
}
