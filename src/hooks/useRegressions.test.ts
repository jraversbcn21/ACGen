import { StrictMode } from 'react';
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  useRegressions, INITIAL_TICKET_ROWS,
  ticketRowHasContent, filledTicketCount, isLegacyArchived,
} from './useRegressions';
import type { Regression, ArchivedRegression, ArchivedRegressionEntry, RegressionTicket } from './useRegressions';
import { STORAGE_KEYS } from '../config/constants';
import { DEFAULT_SCHEMA } from '../types/schema';

const TICKET_FIELD_IDS = ['ticket', 'fecha', 'prioridad', 'creador', 'squad', 'status'];

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

function addOne(result: { current: ReturnType<typeof useRegressions> }, version = '1.0.0') {
  act(() => {
    result.current.addRegression('ios', { version, url: 'https://excel.example/reg', fecha: '2026-08-10' });
  });
  return result.current.regressions.ios[0];
}

describe('useRegressions (versioned)', () => {
  it('initializes with empty lists per platform and no archived', () => {
    const { result } = renderHook(() => useRegressions());
    expect(result.current.regressions.ios).toEqual([]);
    expect(result.current.regressions.webDesktop).toEqual([]);
    expect(result.current.archived).toEqual([]);
  });

  it('addRegression prepends a regression with 3 empty tickets, trimming version and url', () => {
    const { result } = renderHook(() => useRegressions());
    act(() => {
      result.current.addRegression('ios', { version: ' 1.0.0 ', url: ' https://x.example ', fecha: '2026-08-10' });
      result.current.addRegression('ios', { version: '2.0.0', url: '', fecha: '2026-08-17' });
    });
    const list = result.current.regressions.ios;
    expect(list.map((r) => r.version)).toEqual(['2.0.0', '1.0.0']);
    expect(list[1].url).toBe('https://x.example');
    expect(list[0].tickets).toHaveLength(INITIAL_TICKET_ROWS);
    expect(list[0].tickets.every((t) => t.ticket === '' && t.squad === '')).toBe(true);
    expect(result.current.regressions.webDesktop).toEqual([]);
  });

  it('addRegression without a non-blank version is a no-op', () => {
    const { result } = renderHook(() => useRegressions());
    act(() => {
      result.current.addRegression('ios', { version: '   ', url: 'https://x.example', fecha: '2026-08-10' });
    });
    expect(result.current.regressions.ios).toEqual([]);
  });

  it('updateRegression patches version/url/fecha; a blank version keeps the old one', () => {
    const { result } = renderHook(() => useRegressions());
    const reg = addOne(result);
    act(() => {
      result.current.updateRegression('ios', reg.id, { url: 'https://nueva.example', fecha: '2026-08-11' });
    });
    expect(result.current.regressions.ios[0].url).toBe('https://nueva.example');
    expect(result.current.regressions.ios[0].fecha).toBe('2026-08-11');
    act(() => {
      result.current.updateRegression('ios', reg.id, { version: '  ' });
    });
    expect(result.current.regressions.ios[0].version).toBe('1.0.0');
  });

  it('deleteRegression removes only the given id in its platform', () => {
    const { result } = renderHook(() => useRegressions());
    const reg = addOne(result);
    act(() => {
      result.current.addRegression('webDesktop', { version: '9.9.9', url: '', fecha: '2026-08-10' });
    });
    act(() => {
      result.current.deleteRegression('ios', reg.id);
    });
    expect(result.current.regressions.ios).toEqual([]);
    expect(result.current.regressions.webDesktop).toHaveLength(1);
  });

  it('addTicket appends an empty row; updateTicket writes one field; deleteTicket can empty the table', () => {
    const { result } = renderHook(() => useRegressions());
    const reg = addOne(result);
    act(() => {
      result.current.addTicket('ios', reg.id);
    });
    expect(result.current.regressions.ios[0].tickets).toHaveLength(4);
    const ticket = result.current.regressions.ios[0].tickets[0];
    act(() => {
      result.current.updateTicket('ios', reg.id, ticket.id, 'prioridad', 'Alta');
      result.current.updateTicket('ios', reg.id, ticket.id, 'ticket', 'PROJ-1 - https://j.example/browse/PROJ-1');
    });
    expect(result.current.regressions.ios[0].tickets[0].prioridad).toBe('Alta');
    expect(result.current.regressions.ios[0].tickets[0].ticket).toContain('PROJ-1');
    act(() => {
      for (const tk of result.current.regressions.ios[0].tickets) {
        result.current.deleteTicket('ios', reg.id, tk.id);
      }
    });
    expect(result.current.regressions.ios[0].tickets).toEqual([]);
  });

  it('archiveRegression moves the regression to the front of archived with platform and today', () => {
    const { result } = renderHook(() => useRegressions());
    const reg = addOne(result);
    act(() => {
      result.current.archiveRegression('ios', reg.id);
    });
    expect(result.current.regressions.ios).toEqual([]);
    const entry = result.current.archived[0] as ArchivedRegressionEntry;
    expect(isLegacyArchived(entry)).toBe(false);
    expect(entry.platform).toBe('ios');
    expect(entry.regression.version).toBe('1.0.0');
    expect(entry.archivedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    act(() => {
      result.current.archiveRegression('ios', 'no-existe');
    });
    expect(result.current.archived).toHaveLength(1);
  });

  it('deleteArchived removes an entry', () => {
    const { result } = renderHook(() => useRegressions());
    const reg = addOne(result);
    act(() => {
      result.current.archiveRegression('ios', reg.id);
    });
    act(() => {
      result.current.deleteArchived(result.current.archived[0].id);
    });
    expect(result.current.archived).toEqual([]);
  });

  it('persists and hydrates on a fresh mount', () => {
    const first = renderHook(() => useRegressions());
    act(() => {
      first.result.current.addRegression('webDesktop', { version: '3.1.4', url: 'https://x.example', fecha: '2026-08-10' });
    });
    first.unmount();
    const second = renderHook(() => useRegressions());
    expect(second.result.current.regressions.webDesktop[0].version).toBe('3.1.4');
  });

  it('hydration keeps the legacy board opaque-but-intact and legacy archived snapshots visible', () => {
    const legacyBoard = { ios: [['celda vieja']], webDesktop: [] };
    localStorage.setItem('acgen_regressions', JSON.stringify({
      board: legacyBoard,
      archived: [{ id: 'old-1', name: 'Regresión 2026-07-18', archivedAt: '2026-07-18', board: { ios: [['x']] } }],
    }));
    const { result } = renderHook(() => useRegressions());
    expect(result.current.regressions.ios).toEqual([]);
    expect(result.current.archived).toHaveLength(1);
    expect(isLegacyArchived(result.current.archived[0])).toBe(true);
    // Un cambio re-persiste TODO, incluido el board legacy
    act(() => {
      result.current.addRegression('ios', { version: '1.0.0', url: '', fecha: '2026-08-10' });
    });
    const stored = JSON.parse(localStorage.getItem('acgen_regressions')!);
    expect(stored.board).toEqual(legacyBoard);
    expect(stored.archived[0].name).toBe('Regresión 2026-07-18');
    expect(stored.regressions.ios).toHaveLength(1);
  });

  it('hydration survives a malformed entry (null) in archived without wiping the legacy board or the other entries', () => {
    const legacyBoard = { ios: [['celda vieja']], webDesktop: [] };
    localStorage.setItem('acgen_regressions', JSON.stringify({
      board: legacyBoard,
      archived: [null, { id: 'old-1', name: 'Regresión 2026-07-18', archivedAt: '2026-07-18', board: { ios: [['x']] } }],
    }));
    const { result } = renderHook(() => useRegressions());
    // La entrada basura no debe tumbar la hidratación ni borrar el board legacy
    expect(result.current.archived).toHaveLength(1);
    expect(isLegacyArchived(result.current.archived[0])).toBe(true);
    expect((result.current.archived[0] as ArchivedRegression).name).toBe('Regresión 2026-07-18');
  });

  it('recovers from corrupt JSON with an empty state', () => {
    localStorage.setItem('acgen_regressions', '{no es json');
    const { result } = renderHook(() => useRegressions());
    expect(result.current.regressions.ios).toEqual([]);
    expect(result.current.archived).toEqual([]);
  });

  it('ticketRowHasContent and filledTicketCount count rows with any trimmed content', () => {
    const { result } = renderHook(() => useRegressions());
    const reg = addOne(result);
    expect(filledTicketCount(result.current.regressions.ios[0], TICKET_FIELD_IDS)).toBe(0);
    const t0 = reg.tickets[0];
    act(() => {
      result.current.updateTicket('ios', reg.id, t0.id, 'squad', '  Checkout  ');
    });
    const after: Regression = result.current.regressions.ios[0];
    expect(ticketRowHasContent(after.tickets[0], TICKET_FIELD_IDS)).toBe(true);
    expect(ticketRowHasContent(after.tickets[1], TICKET_FIELD_IDS)).toBe(false);
    expect(filledTicketCount(after, TICKET_FIELD_IDS)).toBe(1);
  });

  it('new tickets include an empty status field', () => {
    const { result } = renderHook(() => useRegressions());
    const reg = addOne(result);
    expect(reg.tickets[0].status).toBe('');
    act(() => {
      result.current.addTicket('ios', reg.id);
    });
    expect(result.current.regressions.ios[0].tickets[3].status).toBe('');
  });

  it('hydration backfills status on tickets stored before the column existed', () => {
    localStorage.setItem('acgen_regressions', JSON.stringify({
      regressions: {
        ios: [{
          id: 'r1', version: '1.0.0', url: '', fecha: '2026-08-10',
          tickets: [{ id: 't1', ticket: 'PROJ-1', fecha: '', prioridad: '', creador: '', squad: '' }],
        }],
        webDesktop: [],
      },
      archived: [{
        id: 'a1', archivedAt: '2026-08-09', platform: 'webDesktop',
        regression: {
          id: 'r0', version: '0.9.0', url: '', fecha: '2026-08-09',
          tickets: [{ id: 't9', ticket: '', fecha: '', prioridad: '', creador: '', squad: 'Checkout' }],
        },
      }],
    }));
    const { result } = renderHook(() => useRegressions());
    expect(result.current.regressions.ios[0].tickets[0].status).toBe('');
    const entry = result.current.archived[0] as ArchivedRegressionEntry;
    expect(entry.regression.tickets[0].status).toBe('');
  });

  it('ticketRowHasContent counts a row whose only content is status', () => {
    const { result } = renderHook(() => useRegressions());
    const reg = addOne(result);
    act(() => {
      result.current.updateTicket('ios', reg.id, reg.tickets[0].id, 'status', '  OK  ');
    });
    const after = result.current.regressions.ios[0];
    expect(ticketRowHasContent(after.tickets[0], TICKET_FIELD_IDS)).toBe(true);
    expect(filledTicketCount(after, TICKET_FIELD_IDS)).toBe(1);
  });

  it('does not double-persist under StrictMode on mount', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem');
    renderHook(() => useRegressions(), { wrapper: StrictMode });
    expect(spy).not.toHaveBeenCalled();
  });

  describe('moveRegression', () => {
    function addThree(result: { current: ReturnType<typeof useRegressions> }) {
      act(() => {
        result.current.addRegression('ios', { version: '1.0.0', url: '', fecha: '2026-08-01' });
        result.current.addRegression('ios', { version: '2.0.0', url: '', fecha: '2026-08-05' });
        result.current.addRegression('ios', { version: '3.0.0', url: '', fecha: '2026-08-10' });
      });
      // orden resultante (las nuevas entran arriba): ['3.0.0', '2.0.0', '1.0.0']
    }

    it('moves a regression to the top', () => {
      const { result } = renderHook(() => useRegressions());
      addThree(result);
      const last = result.current.regressions.ios[2];
      act(() => { result.current.moveRegression('ios', last.id, 0); });
      expect(result.current.regressions.ios.map((r) => r.version)).toEqual(['1.0.0', '3.0.0', '2.0.0']);
    });

    it('moves a regression to the bottom and to a middle position', () => {
      const { result } = renderHook(() => useRegressions());
      addThree(result);
      const first = result.current.regressions.ios[0];
      act(() => { result.current.moveRegression('ios', first.id, 2); });
      expect(result.current.regressions.ios.map((r) => r.version)).toEqual(['2.0.0', '1.0.0', '3.0.0']);
      act(() => { result.current.moveRegression('ios', first.id, 1); });
      expect(result.current.regressions.ios.map((r) => r.version)).toEqual(['2.0.0', '3.0.0', '1.0.0']);
    });

    it('clamps out-of-range indexes and ignores unknown ids', () => {
      const { result } = renderHook(() => useRegressions());
      addThree(result);
      const first = result.current.regressions.ios[0];
      act(() => { result.current.moveRegression('ios', first.id, 99); });
      expect(result.current.regressions.ios.map((r) => r.version)).toEqual(['2.0.0', '1.0.0', '3.0.0']);
      act(() => { result.current.moveRegression('ios', first.id, -5); });
      expect(result.current.regressions.ios.map((r) => r.version)).toEqual(['3.0.0', '2.0.0', '1.0.0']);
      const before = result.current.regressions.ios;
      act(() => { result.current.moveRegression('ios', 'no-existe', 0); });
      expect(result.current.regressions.ios).toEqual(before);
    });

    it('does not touch the other platform and persists the new order', () => {
      const { result } = renderHook(() => useRegressions());
      addThree(result);
      act(() => { result.current.addRegression('webDesktop', { version: '9.9.9', url: '', fecha: '2026-08-10' }); });
      const last = result.current.regressions.ios[2];
      act(() => { result.current.moveRegression('ios', last.id, 0); });
      expect(result.current.regressions.webDesktop.map((r) => r.version)).toEqual(['9.9.9']);
      const stored = JSON.parse(localStorage.getItem('acgen_regressions')!);
      expect(stored.regressions.ios.map((r: { version: string }) => r.version)).toEqual(['1.0.0', '3.0.0', '2.0.0']);
    });
  });
});

describe('useRegressions guiado por esquema', () => {
  // Payload real pre-esquema: exactamente lo que un usuario tiene guardado hoy.
  const PRE_SCHEMA_PAYLOAD = {
    regressions: {
      ios: [{
        id: 'reg-1', version: '1.2.0', url: 'https://excel.example/reg', fecha: '2026-08-10',
        tickets: [
          { id: 't1', ticket: 'BSKWEB-1475', fecha: '2026-08-11', prioridad: 'Alta',
            creador: 'Jorge-QA', squad: 'Checkout', status: 'Resuelto' },
        ],
      }],
      webDesktop: [],
    },
    archived: [],
  };

  it('GUARDIAN: hidrata datos pre-esquema sin esquema guardado y conserva los 6 campos', () => {
    localStorage.setItem('acgen_regressions', JSON.stringify(PRE_SCHEMA_PAYLOAD));
    expect(localStorage.getItem(STORAGE_KEYS.SCHEMA)).toBeNull();

    const { result } = renderHook(() => useRegressions(), { wrapper: StrictMode });
    const ticket = result.current.regressions.ios[0].tickets[0];

    expect(ticket.ticket).toBe('BSKWEB-1475');
    expect(ticket.fecha).toBe('2026-08-11');
    expect(ticket.prioridad).toBe('Alta');
    expect(ticket.creador).toBe('Jorge-QA');
    expect(ticket.squad).toBe('Checkout');
    expect(ticket.status).toBe('Resuelto');
    expect(result.current.regressions.webDesktop).toEqual([]);
  });

  it('un campo guardado que ya no esta en el esquema se conserva intacto', () => {
    localStorage.setItem('acgen_regressions', JSON.stringify({
      regressions: {
        ios: [{
          id: 'reg-1', version: '1.0.0', url: '', fecha: '2026-08-10',
          tickets: [{ id: 't1', ticket: 'ABC-1', fecha: '', prioridad: '', creador: '',
                      squad: '', status: '', campoRetirado: 'no me borres' }],
        }],
        webDesktop: [],
      },
      archived: [],
    }));
    // Esquema sin el campo retirado (el default no lo tiene).
    localStorage.setItem(STORAGE_KEYS.SCHEMA, JSON.stringify(DEFAULT_SCHEMA));

    const { result } = renderHook(() => useRegressions(), { wrapper: StrictMode });
    expect(result.current.regressions.ios[0].tickets[0].campoRetirado).toBe('no me borres');

    // Y sigue ahi tras una escritura que re-persiste todo el estado.
    act(() => { result.current.addTicket('ios', 'reg-1'); });
    const persisted = JSON.parse(localStorage.getItem('acgen_regressions')!);
    expect(persisted.regressions.ios[0].tickets[0].campoRetirado).toBe('no me borres');
  });

  it('una plataforma guardada que ya no esta en el esquema se conserva intacta', () => {
    localStorage.setItem('acgen_regressions', JSON.stringify({
      regressions: {
        ios: [], webDesktop: [],
        android: [{ id: 'r-a', version: '9.9.9', url: '', fecha: '2026-01-01', tickets: [] }],
      },
      archived: [],
    }));
    const { result } = renderHook(() => useRegressions(), { wrapper: StrictMode });
    expect(result.current.regressions.android[0].version).toBe('9.9.9');
  });

  it('un ticket nuevo trae los campos del esquema, incluido uno anadido por el usuario', () => {
    localStorage.setItem(STORAGE_KEYS.SCHEMA, JSON.stringify({
      version: 1,
      regression: {
        ...DEFAULT_SCHEMA.regression,
        ticketFields: [...DEFAULT_SCHEMA.regression.ticketFields, { id: 'campo-nuevo', label: 'Entorno' }],
      },
    }));
    const { result } = renderHook(() => useRegressions(), { wrapper: StrictMode });
    act(() => {
      result.current.addRegression('ios', { version: '1.0.0', url: '', fecha: '2026-08-10' });
    });
    expect(result.current.regressions.ios[0].tickets[0]['campo-nuevo']).toBe('');
  });

  it('las plataformas del esquema mandan sobre las cableadas', () => {
    localStorage.setItem(STORAGE_KEYS.SCHEMA, JSON.stringify({
      version: 1,
      regression: {
        ...DEFAULT_SCHEMA.regression,
        platforms: [...DEFAULT_SCHEMA.regression.platforms, { id: 'plat-nueva', label: 'TV' }],
      },
    }));
    const { result } = renderHook(() => useRegressions(), { wrapper: StrictMode });
    expect(result.current.regressions['plat-nueva']).toEqual([]);
  });

  it('GUARDIAN: un esquema guardado con regression.platforms ausente no revienta el hook (fallback por lista)', () => {
    // Payload realista: `regression` existe (pasa el fallback por seccion)
    // pero le falta `platforms` — p.ej. edicion manual o restauracion a medias.
    localStorage.setItem(STORAGE_KEYS.SCHEMA, JSON.stringify({
      version: 1,
      regression: { ticketFields: DEFAULT_SCHEMA.regression.ticketFields },
    }));
    localStorage.setItem('acgen_regressions', JSON.stringify(PRE_SCHEMA_PAYLOAD));

    expect(() => renderHook(() => useRegressions(), { wrapper: StrictMode })).not.toThrow();
    const { result } = renderHook(() => useRegressions(), { wrapper: StrictMode });
    expect(result.current.regressions.ios[0].tickets[0].ticket).toBe('BSKWEB-1475');
    expect(result.current.regressions.webDesktop).toEqual([]);
  });

  it('ticketRowHasContent y filledTicketCount solo miran los ids que se le pasan', () => {
    const ticket = { id: 't1', ticket: '', fecha: '', prioridad: '', creador: '',
                     squad: '', status: 'oculto' } as RegressionTicket;
    expect(ticketRowHasContent(ticket, ['ticket', 'fecha'])).toBe(false);
    expect(ticketRowHasContent(ticket, ['ticket', 'status'])).toBe(true);
    const regression = { id: 'r', version: '1', url: '', fecha: '', tickets: [ticket] };
    expect(filledTicketCount(regression, ['ticket'])).toBe(0);
    expect(filledTicketCount(regression, ['status'])).toBe(1);
  });
});
