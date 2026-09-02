import { useState, useCallback, useEffect } from 'react';
import { writeStorage, LOCAL_SYNC_EVENT } from '../services/persistence';

interface LocalSyncDetail {
  key: string;
  value: unknown;
}

export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((prev: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = localStorage.getItem(key);
      if (item) {
        return JSON.parse(item) as T;
      }
      return initialValue;
    } catch {
      return initialValue;
    }
  });

  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      setStoredValue((prev) => {
        const nextValue = value instanceof Function ? value(prev) : value;
        writeStorage(key, nextValue);
        return nextValue;
      });
    },
    [key],
  );

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key !== key) return;
      if (e.newValue === null) {
        setStoredValue(initialValue);
        return;
      }
      try {
        setStoredValue(JSON.parse(e.newValue) as T);
      } catch {
        // ignore malformed value from another tab
      }
    };

    const handleLocalSync = (e: Event) => {
      const { detail } = e as CustomEvent<LocalSyncDetail>;
      if (detail?.key !== key) return;
      setStoredValue(detail.value as T);
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener(LOCAL_SYNC_EVENT, handleLocalSync);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener(LOCAL_SYNC_EVENT, handleLocalSync);
    };
  }, [key, initialValue]);

  return [storedValue, setValue];
}
