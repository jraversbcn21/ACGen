import { useState, useEffect, useRef, useCallback } from 'react';
import { localTodayISO } from '../utils/dates';

const STORAGE_KEY = 'acgen_regressions';

// 'ios' es el id histórico de la pestaña APPS: se conserva para que los datos
// existentes en localStorage sobrevivan al renombrado (mismo criterio que
// 'webDesktop' → "WEB").
export type PlatformId = 'ios' | 'webDesktop';

export const PLATFORM_IDS: readonly PlatformId[] = ['ios', 'webDesktop'];

export type TicketField = 'ticket' | 'fecha' | 'prioridad' | 'creador' | 'squad';

export interface RegressionTicket {
  id: string;
  ticket: string;
  fecha: string;
  prioridad: string;
  creador: string;
  squad: string;
}

export interface Regression {
  id: string;
  version: string;
  url: string;
  fecha: string;
  tickets: RegressionTicket[];
}

// Formato antiguo del historial (snapshot de tablero completo): se conserva
// para que las entradas pre-existentes sigan abriéndose con el grid readonly.
export interface ArchivedRegression {
  id: string;
  name: string;
  archivedAt: string;
  board: Record<PlatformId, string[][]>;
}

export interface ArchivedRegressionEntry {
  id: string;
  archivedAt: string;
  platform: PlatformId;
  regression: Regression;
}

export type ArchivedItem = ArchivedRegression | ArchivedRegressionEntry;

export function isLegacyArchived(item: ArchivedItem): item is ArchivedRegression {
  return typeof item === 'object' && item !== null && 'board' in item;
}

interface RegressionState {
  // LEGACY: el grid libre pre-versionado. Se hidrata y re-persiste intacto
  // (huérfano-pero-intacto) pero nunca se renderiza.
  board?: Record<PlatformId, string[][]>;
  regressions: Record<PlatformId, Regression[]>;
  archived: ArchivedItem[];
}

export const INITIAL_TICKET_ROWS = 3;

function emptyTicket(): RegressionTicket {
  return { id: crypto.randomUUID(), ticket: '', fecha: '', prioridad: '', creador: '', squad: '' };
}

function createEmptyGrid(rows: number = 20, cols: number = 6): string[][] {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => ''));
}

function emptyBoard(): Record<PlatformId, string[][]> {
  return { ios: createEmptyGrid(), webDesktop: createEmptyGrid() };
}

function emptyRegressions(): Record<PlatformId, Regression[]> {
  return { ios: [], webDesktop: [] };
}

export function ticketRowHasContent(t: RegressionTicket): boolean {
  return [t.ticket, t.fecha, t.prioridad, t.creador, t.squad].some((v) => v.trim() !== '');
}

export function filledTicketCount(r: Regression): number {
  return r.tickets.filter(ticketRowHasContent).length;
}

function persist(state: RegressionState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.error('No se pudo guardar el regression tracker en localStorage:', err);
  }
}

export function useRegressions() {
  const [state, setState] = useState<RegressionState>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { regressions: emptyRegressions(), archived: [] };
      const parsed = JSON.parse(raw);
      const archived: ArchivedItem[] = Array.isArray(parsed.archived)
        ? parsed.archived
            .filter((a: unknown) => typeof a === 'object' && a !== null)
            .map((a: ArchivedItem) =>
              isLegacyArchived(a) ? { ...a, board: { ...emptyBoard(), ...(a.board || {}) } } : a
            )
        : [];
      return {
        ...(parsed.board ? { board: parsed.board } : {}),
        regressions: { ...emptyRegressions(), ...(parsed.regressions || {}) },
        archived,
      };
    } catch {
      return { regressions: emptyRegressions(), archived: [] };
    }
  });

  // Persistir como efecto mantiene los updaters puros; la identidad del último
  // estado persistido evita reescribir lo recién hidratado en el mount.
  const lastPersisted = useRef(state);
  useEffect(() => {
    if (lastPersisted.current === state) return;
    lastPersisted.current = state;
    persist(state);
  }, [state]);

  const mapPlatform = (
    prev: RegressionState,
    platform: PlatformId,
    fn: (list: Regression[]) => Regression[]
  ): RegressionState => ({
    ...prev,
    regressions: { ...prev.regressions, [platform]: fn(prev.regressions[platform] || []) },
  });

  const addRegression = useCallback((platform: PlatformId, data: { version: string; url: string; fecha: string }) => {
    const version = data.version.trim();
    if (!version) return;
    const regression: Regression = {
      id: crypto.randomUUID(),
      version,
      url: data.url.trim(),
      fecha: data.fecha,
      tickets: Array.from({ length: INITIAL_TICKET_ROWS }, () => emptyTicket()),
    };
    setState((prev) => mapPlatform(prev, platform, (list) => [regression, ...list]));
  }, []);

  const updateRegression = useCallback(
    (platform: PlatformId, id: string, patch: Partial<Pick<Regression, 'version' | 'url' | 'fecha'>>) => {
      setState((prev) =>
        mapPlatform(prev, platform, (list) =>
          list.map((r) => {
            if (r.id !== id) return r;
            const next = { ...r, ...patch };
            // Una versión en blanco al editar no borra la existente
            if (patch.version !== undefined && !patch.version.trim()) next.version = r.version;
            else next.version = next.version.trim();
            if (patch.url !== undefined) next.url = patch.url.trim();
            return next;
          })
        )
      );
    },
    []
  );

  const deleteRegression = useCallback((platform: PlatformId, id: string) => {
    setState((prev) => mapPlatform(prev, platform, (list) => list.filter((r) => r.id !== id)));
  }, []);

  const addTicket = useCallback((platform: PlatformId, regressionId: string) => {
    setState((prev) =>
      mapPlatform(prev, platform, (list) =>
        list.map((r) => (r.id === regressionId ? { ...r, tickets: [...r.tickets, emptyTicket()] } : r))
      )
    );
  }, []);

  const updateTicket = useCallback(
    (platform: PlatformId, regressionId: string, ticketId: string, field: TicketField, value: string) => {
      setState((prev) =>
        mapPlatform(prev, platform, (list) =>
          list.map((r) =>
            r.id === regressionId
              ? { ...r, tickets: r.tickets.map((t) => (t.id === ticketId ? { ...t, [field]: value } : t)) }
              : r
          )
        )
      );
    },
    []
  );

  const deleteTicket = useCallback((platform: PlatformId, regressionId: string, ticketId: string) => {
    setState((prev) =>
      mapPlatform(prev, platform, (list) =>
        list.map((r) =>
          r.id === regressionId ? { ...r, tickets: r.tickets.filter((t) => t.id !== ticketId) } : r
        )
      )
    );
  }, []);

  const archiveRegression = useCallback((platform: PlatformId, id: string) => {
    const archivedAt = localTodayISO();
    setState((prev) => {
      const regression = (prev.regressions[platform] || []).find((r) => r.id === id);
      if (!regression) return prev;
      const entry: ArchivedRegressionEntry = { id: crypto.randomUUID(), archivedAt, platform, regression };
      return {
        ...prev,
        regressions: {
          ...prev.regressions,
          [platform]: prev.regressions[platform].filter((r) => r.id !== id),
        },
        archived: [entry, ...prev.archived],
      };
    });
  }, []);

  const deleteArchived = useCallback((id: string) => {
    setState((prev) => ({ ...prev, archived: prev.archived.filter((a) => a.id !== id) }));
  }, []);

  return {
    regressions: state.regressions,
    archived: state.archived,
    addRegression,
    updateRegression,
    deleteRegression,
    addTicket,
    updateTicket,
    deleteTicket,
    archiveRegression,
    deleteArchived,
  };
}
