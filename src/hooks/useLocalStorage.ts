import { useState, useCallback } from 'react';
import { AVAILABLE_MODELS, DEFAULT_MODEL } from '../config/constants';

export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((prev: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = localStorage.getItem(key);
      if (item) {
        const parsed = JSON.parse(item) as T;
        if (key === 'acgen_model' && typeof parsed === 'string' && !AVAILABLE_MODELS.includes(parsed)) {
          localStorage.removeItem(key);
          return DEFAULT_MODEL as T;
        }
        return parsed;
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
        localStorage.setItem(key, JSON.stringify(nextValue));
        return nextValue;
      });
    },
    [key],
  );

  return [storedValue, setValue];
}
