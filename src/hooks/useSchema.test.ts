import { StrictMode } from 'react';
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { useSchema } from './useSchema';
import { DEFAULT_SCHEMA, resolveLabel } from '../types/schema';
import { STORAGE_KEYS } from '../config/constants';

beforeEach(() => {
  localStorage.clear();
});

describe('useSchema', () => {
  it('devuelve DEFAULT_SCHEMA cuando no hay nada guardado', () => {
    const { result } = renderHook(() => useSchema(), { wrapper: StrictMode });
    expect(result.current[0]).toEqual(DEFAULT_SCHEMA);
  });

  it('DEFAULT_SCHEMA usa los ids que los datos ya tienen hoy', () => {
    expect(DEFAULT_SCHEMA.regression.ticketFields.map((f) => f.id)).toEqual([
      'ticket', 'fecha', 'prioridad', 'creador', 'squad', 'status',
    ]);
    expect(DEFAULT_SCHEMA.regression.platforms.map((p) => p.id)).toEqual(['ios', 'webDesktop']);
  });

  it('persiste en acgen_schema al escribir', () => {
    const { result } = renderHook(() => useSchema(), { wrapper: StrictMode });
    act(() => {
      result.current[1]({
        ...DEFAULT_SCHEMA,
        regression: {
          ...DEFAULT_SCHEMA.regression,
          ticketFields: DEFAULT_SCHEMA.regression.ticketFields.map((f) =>
            f.id === 'squad' ? { ...f, label: 'Equipo' } : f
          ),
        },
      });
    });
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEYS.SCHEMA)!);
    expect(raw.regression.ticketFields.find((f: { id: string }) => f.id === 'squad').label).toBe('Equipo');
    expect(result.current[0].regression.ticketFields.find((f) => f.id === 'squad')!.label).toBe('Equipo');
  });

  it('cae al default de la seccion cuando la seccion falta en lo guardado', () => {
    localStorage.setItem(STORAGE_KEYS.SCHEMA, JSON.stringify({ version: 1 }));
    const { result } = renderHook(() => useSchema(), { wrapper: StrictMode });
    expect(result.current[0].regression).toEqual(DEFAULT_SCHEMA.regression);
  });

  it('cae a los defaults con JSON corrupto', () => {
    localStorage.setItem(STORAGE_KEYS.SCHEMA, '{no es json');
    const { result } = renderHook(() => useSchema(), { wrapper: StrictMode });
    expect(result.current[0]).toEqual(DEFAULT_SCHEMA);
  });
});

describe('resolveLabel', () => {
  const t = (key: string) => `T:${key}`;

  it('usa label literal cuando existe', () => {
    expect(resolveLabel({ id: 'ios', label: 'APPS' }, t)).toBe('APPS');
  });

  it('traduce labelKey cuando no hay label', () => {
    expect(resolveLabel({ id: 'squad', labelKey: 'regression.colSquad' }, t)).toBe('T:regression.colSquad');
  });

  it('label gana sobre labelKey (renombrar fija el texto en ambos idiomas)', () => {
    expect(resolveLabel({ id: 'squad', labelKey: 'regression.colSquad', label: 'Equipo' }, t)).toBe('Equipo');
  });

  it('devuelve cadena vacia para una entrada ausente', () => {
    expect(resolveLabel(undefined, t)).toBe('');
  });
});
