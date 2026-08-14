import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { localTodayISO } from '../utils/dates';
import { useSchema } from './useSchema';

const STORAGE_KEY = 'acgen_regressions';

// Los ids de plataforma y de campo son claves de almacenamiento definidas por
// el esquema (`acgen_schema`), ya no uniones cerradas. 'ios' sigue siendo el id
// historico de la pestana APPS y 'webDesktop' el de WEB: por eso los datos
// existentes sobreviven a cualquier renombrado.
export type PlatformId = string;

export type RegressionTicket = { id: string } & Record<string, string>;

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

function emptyTicket(fieldIds: string[]): RegressionTicket {
  const ticket: RegressionTicket = { id: crypto.randomUUID() };
  for (const f of fieldIds) ticket[f] = '';
  return ticket;
}

// Anade las claves del esquema que falten SIN podar ninguna existente: los
// campos retirados del esquema quedan huerfanos pero intactos.
function normalizeTicket(t: Partial<RegressionTicket>, fieldIds: string[]): RegressionTicket {
  const ticket: RegressionTicket = { ...(t as RegressionTicket), id: t.id ?? crypto.randomUUID() };
  for (const f of fieldIds) if (typeof ticket[f] !== 'string') ticket[f] = '';
  return ticket;
}

// Tolerante a entradas malformadas: nunca lanza (una excepción aquí caería en
// el catch de hidratación y vaciaría TODO el estado — ver el guard de archived).
function normalizeRegression(r: Partial<Regression> | null | undefined, fieldIds: string[]): Regression {
  return {
    id: r?.id ?? crypto.randomUUID(),
    version: r?.version ?? '',
    url: r?.url ?? '',
    fecha: r?.fecha ?? '',
    tickets: Array.isArray(r?.tickets) ? r.tickets.map((t) => normalizeTicket(t, fieldIds)) : [],
  };
}

function createEmptyGrid(rows: number = 20, cols: number = 6): string[][] {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => ''));
}

function emptyBoard(platformIds: string[]): Record<PlatformId, string[][]> {
  return Object.fromEntries(platformIds.map((p) => [p, createEmptyGrid()]));
}

function emptyRegressions(platformIds: string[]): Record<PlatformId, Regression[]> {
  return Object.fromEntries(platformIds.map((p) => [p, []]));
}

export function ticketRowHasContent(t: RegressionTicket, fieldIds: string[]): boolean {
  return fieldIds.some((f) => (t[f] ?? '').trim() !== '');
}

export function filledTicketCount(r: Regression, fieldIds: string[]): number {
  return r.tickets.filter((t) => ticketRowHasContent(t, fieldIds)).length;
}

function persist(state: RegressionState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.error('No se pudo guardar el regression tracker en localStorage:', err);
  }
}

export function useRegressions() {
  const [schema] = useSchema();
  // schema viene memoizado por useSchema, asi que estas listas son estables
  // entre renders y sirven como dependencia de los useCallback.
  const fieldIds = useMemo(
    () => schema.regression.ticketFields.map((f) => f.id),
    [schema]
  );
  const platformIds = useMemo(
    () => schema.regression.platforms.map((p) => p.id),
    [schema]
  );

  const [state, setState] = useState<RegressionState>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { regressions: emptyRegressions(platformIds), archived: [] };
      const parsed = JSON.parse(raw);
      const archived: ArchivedItem[] = Array.isArray(parsed.archived)
        ? parsed.archived
            .filter((a: unknown) => typeof a === 'object' && a !== null)
            .map((a: ArchivedItem) =>
              isLegacyArchived(a)
                ? { ...a, board: { ...emptyBoard(platformIds), ...(a.board || {}) } }
                : { ...a, regression: normalizeRegression(a.regression, fieldIds) }
            )
        : [];
      const regressions = { ...emptyRegressions(platformIds), ...(parsed.regressions || {}) };
      // Object.keys y no platformIds: normaliza tambien las plataformas
      // huerfanas (retiradas del esquema) en vez de dejarlas sin normalizar.
      for (const p of Object.keys(regressions)) {
        regressions[p] = (regressions[p] || []).map((r: Partial<Regression>) => normalizeRegression(r, fieldIds));
      }
      return {
        ...(parsed.board ? { board: parsed.board } : {}),
        regressions,
        archived,
      };
    } catch {
      return { regressions: emptyRegressions(platformIds), archived: [] };
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
      tickets: Array.from({ length: INITIAL_TICKET_ROWS }, () => emptyTicket(fieldIds)),
    };
    setState((prev) => mapPlatform(prev, platform, (list) => [regression, ...list]));
  }, [fieldIds]);

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

  const moveRegression = useCallback((platform: PlatformId, id: string, toIndex: number) => {
    setState((prev) =>
      mapPlatform(prev, platform, (list) => {
        const from = list.findIndex((r) => r.id === id);
        if (from === -1) return list;
        const to = Math.max(0, Math.min(toIndex, list.length - 1));
        if (to === from) return list;
        const next = [...list];
        const [moved] = next.splice(from, 1);
        next.splice(to, 0, moved);
        return next;
      })
    );
  }, []);

  const addTicket = useCallback((platform: PlatformId, regressionId: string) => {
    setState((prev) =>
      mapPlatform(prev, platform, (list) =>
        list.map((r) => (r.id === regressionId ? { ...r, tickets: [...r.tickets, emptyTicket(fieldIds)] } : r))
      )
    );
  }, [fieldIds]);

  const updateTicket = useCallback(
    (platform: PlatformId, regressionId: string, ticketId: string, field: string, value: string) => {
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
    moveRegression,
    addTicket,
    updateTicket,
    deleteTicket,
    archiveRegression,
    deleteArchived,
  };
}
