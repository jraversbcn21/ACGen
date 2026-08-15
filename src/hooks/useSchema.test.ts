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

  it('preserva una seccion desconocida del esquema guardado en cualquier escritura, no solo en un reset', () => {
    // `sprint` ya NO es la seccion desconocida (la anadio la Fase 5, y
    // useSchema la normaliza), asi que el papel de "seccion que este codigo ni
    // conoce ni declara en su tipo" lo hace `epics`. `schema` (lo que devuelve
    // el hook) nunca la incluye, asi que cualquier `{ ...schema, regression: X }`
    // que un llamante escriba llega aqui SIN esa seccion.
    localStorage.setItem(STORAGE_KEYS.SCHEMA, JSON.stringify({
      version: 1,
      regression: DEFAULT_SCHEMA.regression,
      sprint: { tabs: [{ id: 'resolved', label: 'Mio', columns: [] }] },
      epics: { lanes: ['a'] },
    }));
    const { result } = renderHook(() => useSchema(), { wrapper: StrictMode });

    // Un renombrado normal (NO un reset) escrito a traves del hook, con la
    // forma exacta que usa RegressionSchemaEditor: spread de `schema` (que no
    // trae `sprint`) mas la seccion `regression` modificada.
    act(() => {
      result.current[1]({
        ...result.current[0],
        regression: {
          ...result.current[0].regression,
          ticketFields: result.current[0].regression.ticketFields.map((f) =>
            f.id === 'squad' ? { ...f, label: 'Equipo' } : f
          ),
        },
      });
    });

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEYS.SCHEMA)!);
    expect(stored.epics).toEqual({ lanes: ['a'] });
    expect(stored.sprint).toEqual({ tabs: [{ id: 'resolved', label: 'Mio', columns: [] }] });
    expect(stored.regression.ticketFields.find((f: { id: string }) => f.id === 'squad').label).toBe('Equipo');
  });

  it('cae al default de la seccion cuando la seccion falta en lo guardado', () => {
    localStorage.setItem(STORAGE_KEYS.SCHEMA, JSON.stringify({ version: 1 }));
    const { result } = renderHook(() => useSchema(), { wrapper: StrictMode });
    expect(result.current[0].regression).toEqual(DEFAULT_SCHEMA.regression);
  });

  it('cae al default de platforms cuando falta esa lista pero ticketFields si esta', () => {
    const customTicketFields = DEFAULT_SCHEMA.regression.ticketFields.filter((f) => f.id !== 'status');
    localStorage.setItem(STORAGE_KEYS.SCHEMA, JSON.stringify({
      version: 1,
      regression: { ticketFields: customTicketFields },
    }));
    const { result } = renderHook(() => useSchema(), { wrapper: StrictMode });
    expect(result.current[0].regression.platforms).toEqual(DEFAULT_SCHEMA.regression.platforms);
    expect(result.current[0].regression.ticketFields).toEqual(customTicketFields);
  });

  it('cae al default de ticketFields cuando ese valor guardado no es un array', () => {
    localStorage.setItem(STORAGE_KEYS.SCHEMA, JSON.stringify({
      version: 1,
      regression: { ticketFields: null, platforms: DEFAULT_SCHEMA.regression.platforms },
    }));
    const { result } = renderHook(() => useSchema(), { wrapper: StrictMode });
    expect(result.current[0].regression.ticketFields).toEqual(DEFAULT_SCHEMA.regression.ticketFields);
    expect(result.current[0].regression.platforms).toEqual(DEFAULT_SCHEMA.regression.platforms);

    localStorage.setItem(STORAGE_KEYS.SCHEMA, JSON.stringify({
      version: 1,
      regression: { ticketFields: 'no soy un array', platforms: DEFAULT_SCHEMA.regression.platforms },
    }));
    const { result: result2 } = renderHook(() => useSchema(), { wrapper: StrictMode });
    expect(result2.current[0].regression.ticketFields).toEqual(DEFAULT_SCHEMA.regression.ticketFields);
  });

  it('cae a los defaults con JSON corrupto', () => {
    localStorage.setItem(STORAGE_KEYS.SCHEMA, '{no es json');
    const { result } = renderHook(() => useSchema(), { wrapper: StrictMode });
    expect(result.current[0]).toEqual(DEFAULT_SCHEMA);
  });

  it('rellena la seccion sprint cuando el esquema guardado solo tiene regression', () => {
    localStorage.setItem(STORAGE_KEYS.SCHEMA, JSON.stringify({
      version: 1,
      regression: { ticketFields: [{ id: 'ticket', label: 'T' }], platforms: [{ id: 'ios', label: 'APPS' }] },
    }));
    const { result } = renderHook(() => useSchema());
    expect(result.current[0].sprint.tabs.map((t) => t.id))
      .toEqual(['resolved', 'created', 'reopened', 'highPriority', 'jsd']);
    expect(result.current[0].sprint.tabs[0].columns.map((c) => c.id))
      .toEqual(['ticket', 'fecha', 'prioridad', 'autor', 'squad']);
  });

  it('cae al default cuando sprint.tabs no es un array', () => {
    localStorage.setItem(STORAGE_KEYS.SCHEMA, JSON.stringify({ version: 1, sprint: { tabs: 'roto' } }));
    const { result } = renderHook(() => useSchema());
    expect(result.current[0].sprint.tabs).toEqual(DEFAULT_SCHEMA.sprint.tabs);
  });

  it('normaliza una pestana sin columns (o con columns que no es un array) a []', () => {
    localStorage.setItem(STORAGE_KEYS.SCHEMA, JSON.stringify({
      version: 1,
      sprint: { tabs: [{ id: 'resolved', label: 'R' }, { id: 'x', label: 'X', columns: 'roto' }] },
    }));
    const { result } = renderHook(() => useSchema());
    // Sin esto, `tab.columns.filter` revienta el editor y con el la vista entera.
    expect(result.current[0].sprint.tabs.map((t) => t.columns)).toEqual([[], []]);
    expect(result.current[0].sprint.tabs.map((t) => t.id)).toEqual(['resolved', 'x']);
  });

  it('una escritura en sprint no pisa la seccion regression guardada', () => {
    localStorage.setItem(STORAGE_KEYS.SCHEMA, JSON.stringify({
      version: 1,
      regression: { ticketFields: [{ id: 'custom', label: 'Mio' }], platforms: [{ id: 'ios', label: 'APPS' }] },
    }));
    const { result } = renderHook(() => useSchema());
    act(() => {
      result.current[1]({ ...result.current[0], sprint: { tabs: [] } });
    });
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEYS.SCHEMA)!);
    expect(stored.regression.ticketFields).toEqual([{ id: 'custom', label: 'Mio' }]);
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
