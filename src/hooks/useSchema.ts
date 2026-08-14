import { useMemo } from 'react';
import { useLocalStorage } from './useLocalStorage';
import { STORAGE_KEYS } from '../config/constants';
import { DEFAULT_SCHEMA, TrackerSchema } from '../types/schema';

/**
 * Esquema configurable de los trackers. Mismo patron que useProfile():
 * un hook sobre useLocalStorage, sin contexto de React — useLocalStorage ya
 * sincroniza entre instancias del mismo tab (evento 'acgen-local-storage')
 * ademas de entre tabs (evento 'storage' nativo).
 *
 * El fallback es POR SECCION a proposito: la Fase 5 anadira una seccion
 * `sprint` que los esquemas guardados por esta fase no tendran.
 */
export function useSchema(): [TrackerSchema, (value: TrackerSchema) => void] {
  const [stored, setStored] = useLocalStorage<TrackerSchema>(STORAGE_KEYS.SCHEMA, DEFAULT_SCHEMA);
  const schema = useMemo<TrackerSchema>(() => ({
    version: 1,
    regression: stored?.regression ?? DEFAULT_SCHEMA.regression,
  }), [stored]);
  return [schema, setStored];
}
