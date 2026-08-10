# Regresiones versionadas con tickets desplegables — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sustituir el spreadsheet libre 20×6 de las pestañas APPS/WEB del Regression Tracker por una lista de regresiones versionadas (Versión + URL + Fecha), cada una desplegable con sus tickets de incidencia (Ticket, Fecha, Prioridad, Creador, Squad), con archivado por regresión e historial mixto (snapshots antiguos conservados).

**Architecture:** Hook `useRegressions` reescrito con el nuevo modelo (`Regression` + `RegressionTicket[]`, historial como unión discriminada legacy/nuevo, `board` legacy conservado opaco). Componente nuevo `RegressionCard` (cabecera + acordeón de tickets). La lógica de celda-enlace en modo url se extrae de `TrackerGrid` a `src/utils/trackerLinks.ts` y la comparten ambos. `RegressionTracker` se reescribe: pestañas + formulario de alta + lista de tarjetas + historial mixto.

**Tech Stack:** React 18 + TypeScript, Vitest + @testing-library/react (jsdom), i18n propio ES/EN (JSON planos), localStorage.

**Spec:** `docs/superpowers/specs/2026-08-10-regression-versions-design.md`

## Global Constraints

- TDD estricto: test en rojo verificado antes de cada implementación.
- Working dir: `C:\repositorio\ACGen\acgen` (el `.git` vive aquí). Tests: `npx vitest run <ruta>`; suite entera `npx vitest run`.
- i18n: toda clave nueva va en `src/i18n/es.json` **y** `src/i18n/en.json` (el test de paridad falla si no). `t()` cae silenciosamente a la clave: verificar textos renderizados, no solo ausencia de error.
- Clave localStorage `acgen_regressions` sin renombrar. El campo legacy `board` y los snapshots antiguos de `archived` se conservan intactos (huérfano-pero-intacto). `backup.ts` no se toca.
- `PlatformId = 'ios' | 'webDesktop'` no cambia (ids históricos de APPS/WEB).
- Sprint Tracker no debe cambiar de comportamiento (sus tests existentes en verde).
- Estilo de commits del repo: conventional commits en inglés (`feat(regression): ...`).
- Los tests fijan idioma con `localStorage.setItem('acgen_lang', JSON.stringify('es'))` (jsdom arranca en en-US).

---

### Task 1: Extraer la celda-enlace url a `trackerLinks.ts`

**Files:**
- Create: `src/utils/trackerLinks.ts`
- Create: `src/utils/trackerLinks.test.ts`
- Modify: `src/components/TrackerGrid.tsx` (líneas 7 y 198–211: patrón y helpers de modo url)

**Interfaces:**
- Consumes: nada.
- Produces: `parseUrlCell(value: string): { name: string | null; url: string } | null` y `URL_CELL_PATTERN: RegExp`, exportados desde `src/utils/trackerLinks.ts`. Tasks 4 y 5 los importan.

- [ ] **Step 1: Write the failing test**

`src/utils/trackerLinks.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parseUrlCell } from './trackerLinks';

describe('parseUrlCell', () => {
  it('parses a bare URL with null name', () => {
    expect(parseUrlCell('https://zephyr.example.com/plan/9')).toEqual({
      name: null,
      url: 'https://zephyr.example.com/plan/9',
    });
  });

  it('parses "Nombre - URL" into name and url', () => {
    expect(parseUrlCell('Smoke Login - https://zephyr.example.com/plan/9')).toEqual({
      name: 'Smoke Login',
      url: 'https://zephyr.example.com/plan/9',
    });
  });

  it('keeps hyphens inside the name (lazy match up to the last " - url")', () => {
    expect(parseUrlCell('Checkout - fase 2 - https://z.example/p/1')).toEqual({
      name: 'Checkout - fase 2',
      url: 'https://z.example/p/1',
    });
  });

  it('returns null for plain text, non-http schemes and trailing garbage', () => {
    expect(parseUrlCell('sin enlace')).toBeNull();
    expect(parseUrlCell('ftp://ejemplo.com/x')).toBeNull();
    expect(parseUrlCell('https://z.example/p/1 y más texto')).toBeNull();
    expect(parseUrlCell('')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/utils/trackerLinks.test.ts`
Expected: FAIL — `Cannot find module './trackerLinks'` (o similar).

- [ ] **Step 3: Write minimal implementation**

`src/utils/trackerLinks.ts`:

```ts
// Celda-enlace en modo url: "https://..." o "Nombre - https://...".
// Compartido por TrackerGrid (Sprint/Regression) y la tabla de tickets.
export const URL_CELL_PATTERN = /^(?:(.+?)\s*-\s*)?(https?:\/\/\S+)$/;

export interface UrlCellParts {
  name: string | null;
  url: string;
}

export function parseUrlCell(value: string): UrlCellParts | null {
  const m = value.match(URL_CELL_PATTERN);
  if (!m) return null;
  return { name: m[1] ?? null, url: m[2] };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/utils/trackerLinks.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Refactor `TrackerGrid.tsx` to consume the util**

En `src/components/TrackerGrid.tsx`:
1. Borrar la línea `const URL_CELL_PATTERN = /^(?:(.+?)\s*-\s*)?(https?:\/\/\S+)$/;` (línea 7).
2. Añadir import: `import { parseUrlCell } from '../utils/trackerLinks';`
3. Sustituir los cuerpos de los helpers de modo url (líneas ~198–211) por:

```ts
const getLinkUrl = (value: string): string | null => {
  if (linkMode === 'jira') {
    if (!ABSOLUTE_HTTP_URL.test(baseUrl)) return null;
    const m = value.match(TICKET_KEY_PATTERN);
    return m ? `${baseUrl}/browse/${m[1]}` : null;
  }
  return parseUrlCell(value)?.url ?? null;
};

const getLinkName = (value: string): string | null => {
  if (linkMode !== 'url') return null;
  return parseUrlCell(value)?.name ?? null;
};
```

(Sin otros cambios: el modo jira y `TICKET_KEY_PATTERN` se quedan donde están.)

- [ ] **Step 6: Run the full suite to verify no behavior change**

Run: `npx vitest run`
Expected: PASS — 421 tests existentes + 4 nuevos, 0 fallos (Sprint Tracker y RegressionTracker intactos).

- [ ] **Step 7: Commit**

```bash
git add src/utils/trackerLinks.ts src/utils/trackerLinks.test.ts src/components/TrackerGrid.tsx
git commit -m "refactor(tracker): extract url link-cell parsing to trackerLinks util"
```

---

### Task 2: Reescribir `useRegressions` con el modelo versionado

**Files:**
- Modify: `src/hooks/useRegressions.ts` (reescritura completa)
- Modify: `src/hooks/useRegressions.test.ts` (reescritura completa)

**Interfaces:**
- Consumes: `localTodayISO()` de `src/utils/dates.ts`.
- Produces (todo exportado desde `src/hooks/useRegressions.ts`; Tasks 4–5 dependen de los nombres EXACTOS):

```ts
export type PlatformId = 'ios' | 'webDesktop';
export const PLATFORM_IDS: readonly PlatformId[];
export type TicketField = 'ticket' | 'fecha' | 'prioridad' | 'creador' | 'squad';
export interface RegressionTicket { id: string; ticket: string; fecha: string; prioridad: string; creador: string; squad: string; }
export interface Regression { id: string; version: string; url: string; fecha: string; tickets: RegressionTicket[]; }
export interface ArchivedRegression { id: string; name: string; archivedAt: string; board: Record<PlatformId, string[][]>; }  // legacy
export interface ArchivedRegressionEntry { id: string; archivedAt: string; platform: PlatformId; regression: Regression; }
export type ArchivedItem = ArchivedRegression | ArchivedRegressionEntry;
export function isLegacyArchived(item: ArchivedItem): item is ArchivedRegression;
export const INITIAL_TICKET_ROWS = 3;
export function ticketRowHasContent(t: RegressionTicket): boolean;
export function filledTicketCount(r: Regression): number;
export function useRegressions(): {
  regressions: Record<PlatformId, Regression[]>;
  archived: ArchivedItem[];
  addRegression(platform: PlatformId, data: { version: string; url: string; fecha: string }): void;
  updateRegression(platform: PlatformId, id: string, patch: Partial<Pick<Regression, 'version' | 'url' | 'fecha'>>): void;
  deleteRegression(platform: PlatformId, id: string): void;
  addTicket(platform: PlatformId, regressionId: string): void;
  updateTicket(platform: PlatformId, regressionId: string, ticketId: string, field: TicketField, value: string): void;
  deleteTicket(platform: PlatformId, regressionId: string, ticketId: string): void;
  archiveRegression(platform: PlatformId, id: string): void;
  deleteArchived(id: string): void;
};
```

Desaparecen: `boardHasContent`, `updateGridCell`, `setTabGrid`, `moveRow`, `archiveBoard`, `board` en el retorno (su único consumidor, `RegressionTracker`, se reescribe en Task 5; hasta entonces la suite de ese componente fallará en compilación — se reescribe su test AQUÍ NO, en Task 5; ver Step 6).

- [ ] **Step 1: Write the failing tests (reescritura completa del archivo)**

`src/hooks/useRegressions.test.ts`:

```ts
import { StrictMode } from 'react';
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  useRegressions, PLATFORM_IDS, INITIAL_TICKET_ROWS,
  ticketRowHasContent, filledTicketCount, isLegacyArchived,
} from './useRegressions';
import type { Regression, ArchivedRegressionEntry } from './useRegressions';

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
    expect(PLATFORM_IDS).toEqual(['ios', 'webDesktop']);
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

  it('recovers from corrupt JSON with an empty state', () => {
    localStorage.setItem('acgen_regressions', '{no es json');
    const { result } = renderHook(() => useRegressions());
    expect(result.current.regressions.ios).toEqual([]);
    expect(result.current.archived).toEqual([]);
  });

  it('ticketRowHasContent and filledTicketCount count rows with any trimmed content', () => {
    const { result } = renderHook(() => useRegressions());
    const reg = addOne(result);
    expect(filledTicketCount(result.current.regressions.ios[0])).toBe(0);
    const t0 = reg.tickets[0];
    act(() => {
      result.current.updateTicket('ios', reg.id, t0.id, 'squad', '  Checkout  ');
    });
    const after: Regression = result.current.regressions.ios[0];
    expect(ticketRowHasContent(after.tickets[0])).toBe(true);
    expect(ticketRowHasContent(after.tickets[1])).toBe(false);
    expect(filledTicketCount(after)).toBe(1);
  });

  it('does not double-persist under StrictMode on mount', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem');
    renderHook(() => useRegressions(), { wrapper: StrictMode });
    expect(spy).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/hooks/useRegressions.test.ts`
Expected: FAIL — los exports nuevos (`addRegression`, `INITIAL_TICKET_ROWS`, etc.) no existen.

- [ ] **Step 3: Rewrite the hook**

`src/hooks/useRegressions.ts` (contenido completo):

```ts
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
  return 'board' in item;
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
        ? parsed.archived.map((a: ArchivedItem) =>
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
```

- [ ] **Step 4: Run the hook tests to verify they pass**

Run: `npx vitest run src/hooks/useRegressions.test.ts`
Expected: PASS (13 tests).

- [ ] **Step 5: Neutralizar temporalmente el consumidor roto**

`RegressionTracker.tsx` ya no compila (usa `board`, `updateGridCell`, `boardHasContent`…). Su reescritura real es Task 5; para dejar la suite y el typecheck en verde AHORA, sustituir **todo** el contenido de `src/components/RegressionTracker.tsx` por un stub mínimo y **vaciar** `src/components/RegressionTracker.test.tsx` a un test de humo:

`src/components/RegressionTracker.tsx` (stub temporal, Task 5 lo reescribe):

```tsx
import { useT } from '../i18n/I18nContext';

// STUB TEMPORAL (Task 2 → Task 5 del plan regression-versions):
// la vista versionada se implementa en RegressionCard + la reescritura de Task 5.
export function RegressionTracker() {
  const t = useT();
  return <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>{t('regression.title')}</h2>;
}
```

`src/components/RegressionTracker.test.tsx` (temporal):

```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { I18nProvider } from '../i18n/I18nContext';
import { RegressionTracker } from './RegressionTracker';

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('acgen_lang', JSON.stringify('es'));
});

describe('RegressionTracker (stub temporal)', () => {
  it('renders the title', () => {
    render(
      <I18nProvider>
        <RegressionTracker />
      </I18nProvider>
    );
    expect(screen.getByText('Regression Tracker')).toBeInTheDocument();
  });
});
```

- [ ] **Step 6: Run the full suite + typecheck**

Run: `npx vitest run && npm run build`
Expected: suite en verde (los tests del grid viejo ya no existen; el resto intacto) y build sin errores de TypeScript.

- [ ] **Step 7: Commit**

```bash
git add src/hooks/useRegressions.ts src/hooks/useRegressions.test.ts src/components/RegressionTracker.tsx src/components/RegressionTracker.test.tsx
git commit -m "feat(regression): versioned regressions data model in useRegressions"
```

---

### Task 3: Claves i18n nuevas (ES/EN)

**Files:**
- Modify: `src/i18n/es.json`
- Modify: `src/i18n/en.json`

**Interfaces:**
- Consumes: nada.
- Produces: claves usadas por Tasks 4–5 vía `t('...')`. El test de paridad existente (`i18n`) valida ES↔EN automáticamente.

- [ ] **Step 1: Add the keys to both files**

En `src/i18n/es.json`, junto al bloque `regression.*` existente (línea ~185), añadir:

```json
"regression.newRegression": "Nueva regresión",
"regression.create": "Crear",
"regression.versionLabel": "Versión",
"regression.urlLabel": "URL",
"regression.dateLabel": "Fecha",
"regression.addTicket": "Añadir ticket",
"regression.toggleTickets": "Mostrar u ocultar tickets",
"regression.ticketsBadge": "tickets",
"regression.colTicket": "Ticket",
"regression.colFecha": "Fecha",
"regression.colPrioridad": "Prioridad",
"regression.colCreador": "Creador",
"regression.colSquad": "Squad",
"regression.deleteRowConfirm": "¿Eliminar esta fila de ticket?",
"regression.archiveOneConfirm": "¿Archivar esta regresión? Pasará al historial de solo lectura.",
"regression.deleteOneConfirm": "¿Eliminar esta regresión y sus tickets?",
"regression.noRegressions": "No hay regresiones. Crea la primera con + Nueva regresión."
```

En `src/i18n/en.json`, en la posición equivalente:

```json
"regression.newRegression": "New regression",
"regression.create": "Create",
"regression.versionLabel": "Version",
"regression.urlLabel": "URL",
"regression.dateLabel": "Date",
"regression.addTicket": "Add ticket",
"regression.toggleTickets": "Show or hide tickets",
"regression.ticketsBadge": "tickets",
"regression.colTicket": "Ticket",
"regression.colFecha": "Date",
"regression.colPrioridad": "Priority",
"regression.colCreador": "Creator",
"regression.colSquad": "Squad",
"regression.deleteRowConfirm": "Delete this ticket row?",
"regression.archiveOneConfirm": "Archive this regression? It will move to the read-only history.",
"regression.deleteOneConfirm": "Delete this regression and its tickets?",
"regression.noRegressions": "No regressions yet. Create the first one with + New regression."
```

NO borrar todavía `regression.archive` / `regression.archiveConfirm` (siguen referenciadas hasta Task 5). `regression.searchPlaceholder`, `regression.archivedBadge`, `regression.deleteConfirm`, `regression.openLink`, `regression.openLinkDirect` se conservan (las usan el snapshot legacy y las celdas-enlace).

- [ ] **Step 2: Run the i18n parity test**

Run: `npx vitest run src/i18n`
Expected: PASS (paridad 242 claves por idioma: 225 + 17).

- [ ] **Step 3: Commit**

```bash
git add src/i18n/es.json src/i18n/en.json
git commit -m "feat(i18n): keys for versioned regressions"
```

---

### Task 4: Componente `RegressionCard`

**Files:**
- Create: `src/components/RegressionCard.tsx`
- Create: `src/components/RegressionCard.test.tsx`

**Interfaces:**
- Consumes: de Task 2 — tipos `Regression`, `TicketField` y helpers `filledTicketCount`, `ticketRowHasContent` (`../hooks/useRegressions`); de Task 1 — `parseUrlCell` (`../utils/trackerLinks`); `formatDate` (`../utils/dates`); claves i18n de Task 3; clase CSS global `.cell-open-link`.
- Produces: `RegressionCard` con estas props (Task 5 lo consume):

```ts
interface RegressionCardProps {
  regression: Regression;
  readOnly?: boolean;         // historial: inputs readOnly, sin botones de mutación
  defaultExpanded?: boolean;  // el snapshot archivado abre desplegado
  onUpdateRegression?: (patch: { version?: string; url?: string; fecha?: string }) => void;
  onUpdateTicket?: (ticketId: string, field: TicketField, value: string) => void;
  onAddTicket?: () => void;
  onDeleteTicket?: (ticketId: string) => void;
  onArchive?: () => void;     // el confirm() lo hace el padre
  onDelete?: () => void;      // el confirm() lo hace el padre
}
```

- [ ] **Step 1: Write the failing tests**

`src/components/RegressionCard.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { I18nProvider } from '../i18n/I18nContext';
import { RegressionCard } from './RegressionCard';
import type { Regression } from '../hooks/useRegressions';

function makeRegression(overrides: Partial<Regression> = {}): Regression {
  return {
    id: 'reg-1',
    version: '1.0.0',
    url: 'Excel Regresión - https://sheets.example.com/reg/1',
    fecha: '2026-08-10',
    tickets: [
      { id: 't1', ticket: '', fecha: '', prioridad: '', creador: '', squad: '' },
      { id: 't2', ticket: '', fecha: '', prioridad: '', creador: '', squad: '' },
      { id: 't3', ticket: '', fecha: '', prioridad: '', creador: '', squad: '' },
    ],
    ...overrides,
  };
}

function renderCard(props: Partial<React.ComponentProps<typeof RegressionCard>> = {}) {
  return render(
    <I18nProvider>
      <RegressionCard regression={makeRegression()} {...props} />
    </I18nProvider>
  );
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('acgen_lang', JSON.stringify('es'));
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('RegressionCard', () => {
  it('shows version, formatted date, excel link name and filled-ticket badge', () => {
    renderCard({
      regression: makeRegression({
        tickets: [
          { id: 't1', ticket: 'PROJ-1 - https://j.example/browse/PROJ-1', fecha: '', prioridad: '', creador: '', squad: '' },
          { id: 't2', ticket: '', fecha: '', prioridad: '', creador: '', squad: '' },
        ],
      }),
    });
    expect(screen.getByText('1.0.0')).toBeInTheDocument();
    expect(screen.getByText('10/08/2026')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'Excel Regresión' });
    expect(link).toHaveAttribute('href', 'https://sheets.example.com/reg/1');
    expect(screen.getByText('1 tickets')).toBeInTheDocument();
  });

  it('starts collapsed and expands to show the ticket table with its headers and 3 rows', () => {
    renderCard();
    expect(screen.queryByText('Prioridad')).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Mostrar u ocultar tickets'));
    for (const h of ['Ticket', 'Prioridad', 'Creador', 'Squad']) {
      expect(screen.getByText(h)).toBeInTheDocument();
    }
    expect(document.querySelectorAll('tbody tr')).toHaveLength(3);
  });

  it('add ticket button calls onAddTicket; per-row × calls onDeleteTicket (confirm only when the row has content)', () => {
    const onAddTicket = vi.fn();
    const onDeleteTicket = vi.fn();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderCard({
      onAddTicket,
      onDeleteTicket,
      regression: makeRegression({
        tickets: [
          { id: 't1', ticket: '', fecha: '', prioridad: 'Alta', creador: '', squad: '' },
          { id: 't2', ticket: '', fecha: '', prioridad: '', creador: '', squad: '' },
        ],
      }),
    });
    fireEvent.click(screen.getByLabelText('Mostrar u ocultar tickets'));
    fireEvent.click(screen.getByText('+ Añadir ticket'));
    expect(onAddTicket).toHaveBeenCalledOnce();
    const deleteButtons = screen.getAllByLabelText('Eliminar');
    fireEvent.click(deleteButtons[1]); // fila vacía: sin confirm
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(onDeleteTicket).toHaveBeenCalledWith('t2');
    fireEvent.click(deleteButtons[0]); // fila con contenido: confirm
    expect(confirmSpy).toHaveBeenCalledOnce();
    expect(onDeleteTicket).toHaveBeenCalledWith('t1');
  });

  it('editing a ticket cell calls onUpdateTicket with field and value', () => {
    const onUpdateTicket = vi.fn();
    renderCard({ onUpdateTicket });
    fireEvent.click(screen.getByLabelText('Mostrar u ocultar tickets'));
    const firstRowInputs = document.querySelectorAll('tbody tr:first-child input');
    fireEvent.change(firstRowInputs[2], { target: { value: 'Alta' } });
    expect(onUpdateTicket).toHaveBeenCalledWith('t1', 'prioridad', 'Alta');
  });

  it('a "Nombre - URL" ticket cell shows the name overlay and ctrl+click opens the url', () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    renderCard({
      regression: makeRegression({
        tickets: [{ id: 't1', ticket: 'PROJ-9 - https://j.example/browse/PROJ-9', fecha: '', prioridad: '', creador: '', squad: '' }],
      }),
    });
    fireEvent.click(screen.getByLabelText('Mostrar u ocultar tickets'));
    expect(screen.getByText('PROJ-9')).toBeInTheDocument();
    fireEvent.click(screen.getByDisplayValue('PROJ-9 - https://j.example/browse/PROJ-9'), { ctrlKey: true });
    expect(open).toHaveBeenCalledWith('https://j.example/browse/PROJ-9', '_blank', 'noopener,noreferrer');
  });

  it('Editar swaps the header for inputs and Guardar sends the patch', () => {
    const onUpdateRegression = vi.fn();
    renderCard({ onUpdateRegression });
    fireEvent.click(screen.getByText('Editar'));
    fireEvent.change(screen.getByDisplayValue('1.0.0'), { target: { value: '1.0.1' } });
    fireEvent.click(screen.getByText('Guardar'));
    expect(onUpdateRegression).toHaveBeenCalledWith(
      expect.objectContaining({ version: '1.0.1', fecha: '2026-08-10' })
    );
  });

  it('Archivar and Eliminar delegate to their callbacks', () => {
    const onArchive = vi.fn();
    const onDelete = vi.fn();
    renderCard({ onArchive, onDelete });
    fireEvent.click(screen.getByText('Archivar'));
    expect(onArchive).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByText('Eliminar'));
    expect(onDelete).toHaveBeenCalledOnce();
  });

  it('readOnly + defaultExpanded: opens expanded, inputs readOnly, no mutation buttons', () => {
    renderCard({ readOnly: true, defaultExpanded: true });
    expect(screen.getByText('Prioridad')).toBeInTheDocument();
    expect(screen.queryByText('Editar')).not.toBeInTheDocument();
    expect(screen.queryByText('Archivar')).not.toBeInTheDocument();
    expect(screen.queryByText('Eliminar')).not.toBeInTheDocument();
    expect(screen.queryByText('+ Añadir ticket')).not.toBeInTheDocument();
    const input = document.querySelector('tbody input') as HTMLInputElement;
    expect(input.readOnly).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/RegressionCard.test.tsx`
Expected: FAIL — `Cannot find module './RegressionCard'`.

- [ ] **Step 3: Implement the component**

`src/components/RegressionCard.tsx` (contenido completo):

```tsx
import { useState } from 'react';
import type { Regression, TicketField } from '../hooks/useRegressions';
import { filledTicketCount, ticketRowHasContent } from '../hooks/useRegressions';
import { parseUrlCell } from '../utils/trackerLinks';
import { formatDate } from '../utils/dates';
import { useT, useLang } from '../i18n/I18nContext';

const TICKET_COLUMNS: { field: TicketField; labelKey: string }[] = [
  { field: 'ticket', labelKey: 'regression.colTicket' },
  { field: 'fecha', labelKey: 'regression.colFecha' },
  { field: 'prioridad', labelKey: 'regression.colPrioridad' },
  { field: 'creador', labelKey: 'regression.colCreador' },
  { field: 'squad', labelKey: 'regression.colSquad' },
];

interface RegressionCardProps {
  regression: Regression;
  readOnly?: boolean;
  defaultExpanded?: boolean;
  onUpdateRegression?: (patch: { version?: string; url?: string; fecha?: string }) => void;
  onUpdateTicket?: (ticketId: string, field: TicketField, value: string) => void;
  onAddTicket?: () => void;
  onDeleteTicket?: (ticketId: string) => void;
  onArchive?: () => void;
  onDelete?: () => void;
}

export function RegressionCard({
  regression,
  readOnly = false,
  defaultExpanded = false,
  onUpdateRegression,
  onUpdateTicket,
  onAddTicket,
  onDeleteTicket,
  onArchive,
  onDelete,
}: RegressionCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ version: '', url: '', fecha: '' });
  const [focusedCell, setFocusedCell] = useState<string | null>(null); // `${ticketId}` (solo columna ticket)
  const t = useT();
  const { lang } = useLang();

  const urlParts = regression.url ? parseUrlCell(regression.url) : null;
  const ticketCount = filledTicketCount(regression);

  const startEdit = () => {
    setDraft({ version: regression.version, url: regression.url, fecha: regression.fecha });
    setEditing(true);
  };
  const saveEdit = () => {
    onUpdateRegression?.(draft);
    setEditing(false);
  };

  const headerInputStyle: React.CSSProperties = {
    height: 28, padding: '0 8px', fontSize: 12, fontFamily: 'var(--font-ui)',
    background: 'var(--surface)', color: 'var(--text)',
    border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', outline: 'none',
  };

  return (
    <div
      className="sprint-card"
      style={{
        border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
        background: 'var(--surface-2)', marginBottom: 8,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', flexWrap: 'wrap' }}>
        <button
          type="button"
          className="btn-ghost"
          aria-label={t('regression.toggleTickets')}
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
          style={{ padding: '2px 8px', fontSize: 12 }}
        >
          {expanded ? '▾' : '▸'}
        </button>
        {editing ? (
          <>
            <input
              type="text"
              autoFocus
              aria-label={t('regression.versionLabel')}
              value={draft.version}
              onChange={(e) => setDraft((d) => ({ ...d, version: e.target.value }))}
              onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditing(false); }}
              style={{ ...headerInputStyle, width: 90 }}
            />
            <input
              type="text"
              aria-label={t('regression.urlLabel')}
              value={draft.url}
              onChange={(e) => setDraft((d) => ({ ...d, url: e.target.value }))}
              onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditing(false); }}
              style={{ ...headerInputStyle, flex: 1, minWidth: 180 }}
            />
            <input
              type="date"
              aria-label={t('regression.dateLabel')}
              value={draft.fecha}
              onChange={(e) => setDraft((d) => ({ ...d, fecha: e.target.value }))}
              style={{ ...headerInputStyle, width: 140 }}
            />
            <button type="button" className="btn-ghost" onClick={saveEdit} style={{ padding: '4px 10px', fontSize: 12 }}>
              {t('common.save')}
            </button>
            <button type="button" className="btn-ghost" onClick={() => setEditing(false)} style={{ padding: '4px 10px', fontSize: 12 }}>
              {t('common.cancel')}
            </button>
          </>
        ) : (
          <>
            <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>{regression.version}</span>
            {urlParts && (
              <a
                href={urlParts.url}
                target="_blank"
                rel="noopener noreferrer"
                title={t('regression.openLinkDirect')}
                style={{
                  color: 'var(--accent)', fontWeight: 600, fontSize: 12, fontFamily: 'var(--font-mono)',
                  maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}
              >
                {urlParts.name ?? urlParts.url} ↗
              </a>
            )}
            <span style={{ fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
              {formatDate(regression.fecha, lang)}
            </span>
            <span className="badge badge-info" style={{ fontSize: 11 }}>
              {ticketCount} {t('regression.ticketsBadge')}
            </span>
            {!readOnly && (
              <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                <button type="button" className="btn-ghost" onClick={startEdit} style={{ padding: '4px 10px', fontSize: 12 }}>
                  {t('common.edit')}
                </button>
                <button type="button" className="btn-ghost" onClick={onArchive} style={{ padding: '4px 10px', fontSize: 12 }}>
                  {t('common.archive')}
                </button>
                <button type="button" className="btn-ghost" onClick={onDelete} style={{ padding: '4px 10px', fontSize: 12 }}>
                  {t('common.delete')}
                </button>
              </span>
            )}
          </>
        )}
      </div>

      {expanded && (
        <div style={{ padding: '0 16px 14px' }}>
          <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
            <table style={{ borderCollapse: 'collapse', fontSize: 12, fontFamily: 'var(--font-mono)', width: '100%', tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: '30%' }} />
                <col style={{ width: '15%' }} />
                <col style={{ width: '15%' }} />
                <col style={{ width: '18%' }} />
                <col style={{ width: '17%' }} />
                {!readOnly && <col style={{ width: 36 }} />}
              </colgroup>
              <thead>
                <tr>
                  {TICKET_COLUMNS.map(({ labelKey }) => (
                    <th key={labelKey} style={{
                      height: 26, background: 'var(--surface)', border: '1px solid var(--border)',
                      fontSize: 11, fontWeight: 700, color: 'var(--text-2)', textAlign: 'left', padding: '0 6px',
                    }}>{t(labelKey)}</th>
                  ))}
                  {!readOnly && <th style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}></th>}
                </tr>
              </thead>
              <tbody>
                {regression.tickets.map((ticket) => (
                  <tr key={ticket.id}>
                    {TICKET_COLUMNS.map(({ field }) => {
                      const value = ticket[field];
                      const parts = field === 'ticket' ? parseUrlCell(value) : null;
                      const isFocused = focusedCell === ticket.id;
                      const showNameOverlay = Boolean(parts?.name) && !isFocused;
                      return (
                        <td
                          key={field}
                          onClick={(e) => {
                            if (parts && e.ctrlKey) window.open(parts.url, '_blank', 'noopener,noreferrer');
                          }}
                          title={parts ? t('regression.openLink') : undefined}
                          style={{
                            border: '1px solid var(--border)', padding: 0, position: 'relative', overflow: 'hidden',
                            cursor: parts ? 'pointer' : undefined,
                          }}
                        >
                          <input
                            type="text"
                            value={value}
                            readOnly={readOnly}
                            onChange={(e) => onUpdateTicket?.(ticket.id, field, e.target.value)}
                            onFocus={field === 'ticket' ? () => setFocusedCell(ticket.id) : undefined}
                            onBlur={field === 'ticket' ? () => setFocusedCell((prev) => (prev === ticket.id ? null : prev)) : undefined}
                            style={{
                              width: '100%', height: 28, border: 'none', outline: 'none',
                              padding: '0 6px', fontSize: 12, fontFamily: 'var(--font-mono)', background: 'transparent',
                              color: showNameOverlay ? 'transparent' : parts ? 'var(--accent)' : 'var(--text)',
                              fontWeight: parts ? 600 : 400,
                              cursor: parts ? 'pointer' : undefined,
                            }}
                          />
                          {showNameOverlay && (
                            <span style={{
                              position: 'absolute', left: 0, right: 0, top: 0, height: 28, lineHeight: '28px',
                              padding: '0 6px', fontSize: 12, fontFamily: 'var(--font-mono)',
                              color: 'var(--accent)', fontWeight: 600,
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                              pointerEvents: 'none',
                            }}>{parts!.name}</span>
                          )}
                          {parts && (
                            <button
                              type="button"
                              className="cell-open-link"
                              tabIndex={-1}
                              title={t('regression.openLinkDirect')}
                              aria-label={t('regression.openLinkDirect')}
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={(e) => {
                                e.stopPropagation();
                                window.open(parts.url, '_blank', 'noopener,noreferrer');
                              }}
                            >
                              ↗
                            </button>
                          )}
                        </td>
                      );
                    })}
                    {!readOnly && (
                      <td style={{ border: '1px solid var(--border)', textAlign: 'center', padding: 0 }}>
                        <button
                          type="button"
                          className="btn-ghost"
                          aria-label={t('common.delete')}
                          title={t('common.delete')}
                          onClick={() => {
                            if (ticketRowHasContent(ticket) && !confirm(t('regression.deleteRowConfirm'))) return;
                            onDeleteTicket?.(ticket.id);
                          }}
                          style={{ padding: '2px 8px', fontSize: 12 }}
                        >
                          ×
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!readOnly && (
            <button type="button" className="btn-ghost" onClick={onAddTicket} style={{ marginTop: 8, padding: '6px 14px', fontSize: 13 }}>
              + {t('regression.addTicket')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
```

Nota para el test "shows the name overlay": el texto del botón "+ Añadir ticket" se asercionará con `screen.getByText('+ Añadir ticket')` — el `+` va concatenado en el JSX (`+ {t('regression.addTicket')}`); si getByText falla por el nodo partido, usar `screen.getByRole('button', { name: /Añadir ticket/ })` en el test.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/RegressionCard.test.tsx`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/RegressionCard.tsx src/components/RegressionCard.test.tsx
git commit -m "feat(regression): RegressionCard with collapsible ticket table"
```

---

### Task 5: Reescribir `RegressionTracker` (lista, alta, historial mixto)

**Files:**
- Modify: `src/components/RegressionTracker.tsx` (sustituye el stub de Task 2)
- Modify: `src/components/RegressionTracker.test.tsx` (sustituye el test de humo)
- Modify: `src/i18n/es.json` y `src/i18n/en.json` (borrar 2 claves huérfanas)

**Interfaces:**
- Consumes: hook completo de Task 2 (`useRegressions`, `PLATFORM_IDS`, `isLegacyArchived`, tipos), `RegressionCard` de Task 4, `TrackerGrid` (sin cambios, para snapshots legacy), `localTodayISO`/`formatDate` de `../utils/dates`, `STORAGE_KEYS.REGRESSION_COL_WIDTHS` de `../config/constants`, claves i18n de Task 3.
- Produces: `RegressionTracker` (mismo export; `App.tsx` no cambia).

- [ ] **Step 1: Write the failing tests (reescritura completa del archivo)**

`src/components/RegressionTracker.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { I18nProvider } from '../i18n/I18nContext';
import { RegressionTracker } from './RegressionTracker';

function renderTracker() {
  return render(
    <I18nProvider>
      <RegressionTracker />
    </I18nProvider>
  );
}

function createRegression(version = '1.0.0', url = 'Excel - https://sheets.example.com/r/1') {
  fireEvent.click(screen.getByText('+ Nueva regresión'));
  fireEvent.change(screen.getByLabelText('Versión'), { target: { value: version } });
  fireEvent.change(screen.getByLabelText('URL'), { target: { value: url } });
  fireEvent.click(screen.getByText('Crear'));
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('acgen_lang', JSON.stringify('es'));
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('RegressionTracker (versioned)', () => {
  it('renders the 2 platform tabs and the empty state', () => {
    renderTracker();
    expect(screen.getByText('APPS')).toBeInTheDocument();
    expect(screen.getByText('WEB')).toBeInTheDocument();
    expect(screen.getByText(/No hay regresiones/)).toBeInTheDocument();
  });

  it('creates a regression from the inline form (Crear disabled without version)', () => {
    renderTracker();
    fireEvent.click(screen.getByText('+ Nueva regresión'));
    const createBtn = screen.getByText('Crear') as HTMLButtonElement;
    expect(createBtn.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Versión'), { target: { value: '1.0.0' } });
    expect(createBtn.disabled).toBe(false);
    fireEvent.click(createBtn);
    expect(screen.getByText('1.0.0')).toBeInTheDocument();
    expect(screen.getByText('0 tickets')).toBeInTheDocument();
    // El formulario se cierra tras crear
    expect(screen.queryByLabelText('Versión')).not.toBeInTheDocument();
  });

  it('each platform keeps its own regression list', () => {
    renderTracker();
    createRegression('1.0.0');
    fireEvent.click(screen.getByText('WEB'));
    expect(screen.queryByText('1.0.0')).not.toBeInTheDocument();
    expect(screen.getByText(/No hay regresiones/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('APPS'));
    expect(screen.getByText('1.0.0')).toBeInTheDocument();
  });

  it('archiving a card (with confirm) moves it to the mixed history labeled PLATFORM · version', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderTracker();
    createRegression('1.0.0');
    fireEvent.click(screen.getByText('Archivar'));
    expect(screen.queryByText('1.0.0')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText(/Archivadas \(1\)/));
    expect(screen.getByText('APPS · 1.0.0')).toBeInTheDocument();
  });

  it('cancelling the archive confirm keeps the card', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderTracker();
    createRegression('1.0.0');
    fireEvent.click(screen.getByText('Archivar'));
    expect(screen.getByText('1.0.0')).toBeInTheDocument();
    expect(screen.queryByText(/Archivadas/)).not.toBeInTheDocument();
  });

  it('deleting a card (with confirm) removes it', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderTracker();
    createRegression('1.0.0');
    fireEvent.click(screen.getByText('Eliminar'));
    expect(screen.queryByText('1.0.0')).not.toBeInTheDocument();
  });

  it('a new-format archived entry opens as a read-only expanded card', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderTracker();
    createRegression('1.0.0');
    fireEvent.click(screen.getByText('Archivar'));
    fireEvent.click(screen.getByText(/Archivadas \(1\)/));
    fireEvent.click(screen.getByText('APPS · 1.0.0'));
    expect(screen.getByText('Prioridad')).toBeInTheDocument(); // tabla desplegada
    expect(screen.queryByText('Archivar')).not.toBeInTheDocument(); // readOnly
    expect(screen.getByText('Archivada')).toBeInTheDocument(); // badge
  });

  it('a legacy archived snapshot still opens with the read-only grid', () => {
    localStorage.setItem('acgen_regressions', JSON.stringify({
      archived: [{
        id: 'old-1', name: 'Regresión 2026-07-18', archivedAt: '2026-07-18',
        board: { ios: [['Smoke - https://z.example/p/1', 'v9', '', '', '', '']], webDesktop: [] },
      }],
    }));
    renderTracker();
    fireEvent.click(screen.getByText(/Archivadas \(1\)/));
    fireEvent.click(screen.getByText('Regresión 2026-07-18'));
    // El grid legacy readonly renderiza sus cabeceras hardcodeadas
    expect(screen.getByText('Notas')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Smoke - https://z.example/p/1')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/RegressionTracker.test.tsx`
Expected: FAIL — el stub solo renderiza el título.

- [ ] **Step 3: Rewrite the component**

`src/components/RegressionTracker.tsx` (contenido completo):

```tsx
import { useState, useCallback } from 'react';
import { TrackerGrid } from './TrackerGrid';
import { RegressionCard } from './RegressionCard';
import { useRegressions, PLATFORM_IDS, isLegacyArchived } from '../hooks/useRegressions';
import type { PlatformId, ArchivedItem } from '../hooks/useRegressions';
import { STORAGE_KEYS } from '../config/constants';
import { useT, useLang } from '../i18n/I18nContext';
import { formatDate, localTodayISO } from '../utils/dates';

const PLATFORM_LABELS: Record<PlatformId, string> = {
  ios: 'APPS',
  webDesktop: 'WEB',
};

// Cabeceras del grid ANTIGUO: solo para renderizar snapshots legacy del historial.
const LEGACY_HEADERS = ['Regresión', 'Versión', 'Fecha', 'Notas', 'Status'];
const LEGACY_PLATFORM_HEADERS: Record<PlatformId, string[]> = {
  ios: LEGACY_HEADERS,
  webDesktop: LEGACY_HEADERS,
};

type Screen = { kind: 'board' } | { kind: 'archivedList' } | { kind: 'snapshot'; id: string };

function archivedLabel(item: ArchivedItem): string {
  return isLegacyArchived(item) ? item.name : `${PLATFORM_LABELS[item.platform]} · ${item.regression.version}`;
}

export function RegressionTracker() {
  const {
    regressions, archived,
    addRegression, updateRegression, deleteRegression,
    addTicket, updateTicket, deleteTicket,
    archiveRegression, deleteArchived,
  } = useRegressions();
  const [screen, setScreen] = useState<Screen>({ kind: 'board' });
  const [activeTab, setActiveTab] = useState<PlatformId>(PLATFORM_IDS[0]);
  const [showNewForm, setShowNewForm] = useState(false);
  const [draft, setDraft] = useState({ version: '', url: '', fecha: localTodayISO() });
  const t = useT();
  const { lang } = useLang();

  const noop = useCallback(() => {}, []);

  const handleCreate = () => {
    if (!draft.version.trim()) return;
    addRegression(activeTab, draft);
    setDraft({ version: '', url: '', fecha: localTodayISO() });
    setShowNewForm(false);
  };

  const formInputStyle: React.CSSProperties = {
    height: 30, padding: '0 10px', fontSize: 12, fontFamily: 'var(--font-ui)',
    background: 'var(--surface-2)', color: 'var(--text)',
    border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', outline: 'none',
  };

  const snapshot: ArchivedItem | null =
    screen.kind === 'snapshot' ? archived.find((a) => a.id === screen.id) ?? null : null;

  if (snapshot) {
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <button type="button" className="btn-ghost" onClick={() => setScreen({ kind: 'archivedList' })} style={{ padding: '6px 14px' }}>
            ← {t('common.back')}
          </button>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>{archivedLabel(snapshot)}</h2>
          <span className="badge badge-info" style={{ fontSize: 11 }}>{t('regression.archivedBadge')}</span>
        </div>
        {isLegacyArchived(snapshot) ? (
          <TrackerGrid
            tabs={PLATFORM_IDS}
            tabLabels={PLATFORM_LABELS}
            tabHeaders={LEGACY_PLATFORM_HEADERS}
            tabGrid={snapshot.board}
            linkMode="url"
            readOnly
            colWidthsStorageKey={STORAGE_KEYS.REGRESSION_COL_WIDTHS}
            searchPlaceholder={t('regression.searchPlaceholder')}
            onUpdateGridCell={noop}
            onSetTabGrid={noop}
            onMoveRow={noop}
          />
        ) : (
          <RegressionCard regression={snapshot.regression} readOnly defaultExpanded />
        )}
      </div>
    );
  }

  if (screen.kind !== 'board') {
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <button type="button" className="btn-ghost" onClick={() => setScreen({ kind: 'board' })} style={{ padding: '6px 14px' }}>
            ← {t('common.back')}
          </button>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>{t('regression.archivedList')}</h2>
        </div>
        {archived.length === 0 && (
          <p style={{ marginTop: 32, textAlign: 'center', color: 'var(--text-3)', fontSize: 14 }}>
            {t('regression.noArchived')}
          </p>
        )}
        {archived.map((a) => (
          <div
            key={a.id}
            className="sprint-card"
            style={{
              padding: '14px 18px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
              background: 'var(--surface-2)', marginBottom: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              transition: 'box-shadow .18s var(--ease)', cursor: 'pointer',
            }}
            onClick={() => setScreen({ kind: 'snapshot', id: a.id })}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-sm)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
          >
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>{archivedLabel(a)}</div>
              <div style={{ fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                {formatDate(a.archivedAt, lang)}
              </div>
            </div>
            <button
              type="button"
              className="btn-ghost"
              onClick={(e) => { e.stopPropagation(); if (confirm(t('regression.deleteConfirm'))) deleteArchived(a.id); }}
              style={{ padding: '4px 10px', fontSize: 12 }}
            >
              {t('common.delete')}
            </button>
          </div>
        ))}
      </div>
    );
  }

  const list = regressions[activeTab] || [];

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>{t('regression.title')}</h2>
        {archived.length > 0 && (
          <button
            type="button"
            className="btn-ghost"
            style={{ marginLeft: 'auto', padding: '6px 14px' }}
            onClick={() => setScreen({ kind: 'archivedList' })}
          >
            {t('regression.archivedList')} ({archived.length})
          </button>
        )}
      </div>

      <div className="sprint-tabs">
        {PLATFORM_IDS.map((tab) => (
          <button
            key={tab}
            type="button"
            className={`btn-ghost ${activeTab === tab ? 'sprint-tab-active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {PLATFORM_LABELS[tab]}
          </button>
        ))}
        <a
          href="https://chromewebstore.google.com/detail/SnapLink/nooilpnmljdmpdknbkckjiieafoaikfc?utm_source=ext_app_menu"
          target="_blank"
          rel="noopener noreferrer"
          className="btn-ghost"
          style={{ marginLeft: 'auto', padding: '6px 14px', fontSize: 12, textDecoration: 'none' }}
          title="Descargar extensión SnapLink para Chrome"
        >
          + SnapLink
        </a>
      </div>

      <div style={{ marginTop: 14 }}>
        {!showNewForm ? (
          <button type="button" className="btn-ghost" onClick={() => { setDraft({ version: '', url: '', fecha: localTodayISO() }); setShowNewForm(true); }} style={{ padding: '6px 14px', fontSize: 13 }}>
            + {t('regression.newRegression')}
          </button>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <input
              type="text"
              autoFocus
              aria-label={t('regression.versionLabel')}
              placeholder="1.0.0"
              value={draft.version}
              onChange={(e) => setDraft((d) => ({ ...d, version: e.target.value }))}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setShowNewForm(false); }}
              style={{ ...formInputStyle, width: 100 }}
            />
            <input
              type="text"
              aria-label={t('regression.urlLabel')}
              placeholder="https://..."
              value={draft.url}
              onChange={(e) => setDraft((d) => ({ ...d, url: e.target.value }))}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setShowNewForm(false); }}
              style={{ ...formInputStyle, flex: 1, minWidth: 200 }}
            />
            <input
              type="date"
              aria-label={t('regression.dateLabel')}
              value={draft.fecha}
              onChange={(e) => setDraft((d) => ({ ...d, fecha: e.target.value }))}
              style={{ ...formInputStyle, width: 150 }}
            />
            <button type="button" className="btn-ghost" disabled={!draft.version.trim()} onClick={handleCreate} style={{ padding: '6px 14px', fontSize: 13 }}>
              {t('regression.create')}
            </button>
            <button type="button" className="btn-ghost" onClick={() => setShowNewForm(false)} style={{ padding: '6px 14px', fontSize: 13 }}>
              {t('common.cancel')}
            </button>
          </div>
        )}
      </div>

      <div style={{ marginTop: 14 }}>
        {list.length === 0 && (
          <p style={{ marginTop: 24, textAlign: 'center', color: 'var(--text-3)', fontSize: 14 }}>
            {t('regression.noRegressions')}
          </p>
        )}
        {list.map((regression) => (
          <RegressionCard
            key={regression.id}
            regression={regression}
            onUpdateRegression={(patch) => updateRegression(activeTab, regression.id, patch)}
            onUpdateTicket={(ticketId, field, value) => updateTicket(activeTab, regression.id, ticketId, field, value)}
            onAddTicket={() => addTicket(activeTab, regression.id)}
            onDeleteTicket={(ticketId) => deleteTicket(activeTab, regression.id, ticketId)}
            onArchive={() => { if (confirm(t('regression.archiveOneConfirm'))) archiveRegression(activeTab, regression.id); }}
            onDelete={() => { if (confirm(t('regression.deleteOneConfirm'))) deleteRegression(activeTab, regression.id); }}
          />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/RegressionTracker.test.tsx`
Expected: PASS (8 tests).

- [ ] **Step 5: Delete the 2 orphaned i18n keys**

Con la reescritura, `regression.archive` ("Archivar Regresión") y `regression.archiveConfirm` ya no tienen referencias. Verificar con grep antes de borrar (política del proyecto — `t()` cae a la clave en silencio):

```bash
grep -rn "regression.archive\"" src/ --include="*.ts" --include="*.tsx"
grep -rn "regression.archiveConfirm" src/ --include="*.ts" --include="*.tsx"
```

Expected: 0 resultados en código (solo los JSON). Borrar ambas claves de `es.json` **y** `en.json`.

- [ ] **Step 6: Run the full suite**

Run: `npx vitest run`
Expected: PASS — todo en verde, incluida la paridad i18n (240 claves por idioma: 242 − 2).

- [ ] **Step 7: Commit**

```bash
git add src/components/RegressionTracker.tsx src/components/RegressionTracker.test.tsx src/i18n/es.json src/i18n/en.json
git commit -m "feat(regression): versioned regression list with per-regression archive and mixed history"
```

---

### Task 6: Docs, verificación completa y comprobación en Chrome real

**Files:**
- Modify: `AGENTS.md` (tabla "Evolution history" + sección "Notable" si procede)
- Modify: `README.md` (descripción del Regression Tracker)

**Interfaces:**
- Consumes: todo lo anterior terminado y en verde.
- Produces: docs sincronizados y feature verificada end-to-end.

- [ ] **Step 1: Full verification**

```bash
npx vitest run
npm run lint
npm run build
```

Expected: suite entera en verde (~445+ tests: 421 − ~14 del grid viejo + ~35 nuevos), 0 errores de lint, build limpio.

- [ ] **Step 2: Verify in real Chrome against the production build**

Usando el patrón de ciclos anteriores (`vite preview` + Playwright o manual):

```bash
npm run build && npx vite preview --port 4173
```

Comprobar en `http://localhost:4173`:
1. **Migración**: sembrar antes en localStorage un estado con formato viejo (board con contenido + 1 archivada legacy) → la pestaña APPS sale vacía, "Archivadas (1)" abre el snapshot con el grid readonly, y `acgen_regressions` conserva `board` tras crear una regresión nueva.
2. Crear regresión `1.0.0` con URL `Excel - https://...` en APPS → tarjeta arriba, enlace azul abre en pestaña nueva.
3. Desplegar → 3 filas; rellenar un ticket con `PROJ-1 - https://.../browse/PROJ-1` → overlay con nombre, Ctrl+click y ↗ abren.
4. "+ Añadir ticket" hasta 5 filas; borrar una con contenido (confirm) y una vacía (sin confirm).
5. Editar cabecera (versión/URL/fecha) y guardar.
6. WEB independiente de APPS.
7. Archivar `1.0.0` (confirm) → historial "APPS · 1.0.0" → abre tarjeta readonly desplegada.
8. Recargar la página → todo persiste. Cero errores de consola.

- [ ] **Step 3: Update the docs**

En `AGENTS.md`:
- Añadir fila a "Evolution history" (fecha 2026-08-10, con el conteo real de tests final).
- En "Notable", actualizar la línea del Sprint Tracker/Regression si menciona el grid de 20×6 del Regression Tracker.
- Actualizar el conteo de tests del encabezado si AGENTS.md lo menciona.

En `README.md`: actualizar la descripción del Regression Tracker (regresiones versionadas con tickets, ya no "spreadsheet 20×6").

- [ ] **Step 4: Commit**

```bash
git add AGENTS.md README.md
git commit -m "docs: sync versioned regressions into AGENTS.md and README"
```

- [ ] **Step 5: Final gate**

`npx vitest run` una última vez. Con todo en verde, la rama queda lista para el flujo de cierre (superpowers:finishing-a-development-branch): merge/PR a `main` → deploy automático a acgen.vercel.app.
