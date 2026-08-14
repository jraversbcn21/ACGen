# Fase 4 — Esquema configurable del Regression Tracker

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que cualquier QA pueda renombrar, añadir y ocultar los campos del ticket y las plataformas del Regression Tracker sin tocar código y sin perder datos, y editar la lista de dispositivos del Bug Report desde el perfil.

**Architecture:** Una clave nueva de `localStorage`, `acgen_schema`, leída por un hook `useSchema()` calcado de `useProfile()` — sin contexto de React, porque `useLocalStorage` ya sincroniza entre instancias del mismo tab. `DEFAULT_SCHEMA` codifica byte a byte la configuración de hoy, así que sin esquema guardado la app se comporta igual y los datos existentes no se reescriben nunca. `RegressionTicket` pasa de interfaz cerrada de 6 campos a `{ id: string } & Record<string, string>`, y las seis duplicaciones de esa lista de campos colapsan en iterar sobre el esquema.

**Tech Stack:** React 18 + TypeScript + Vite. Vitest + @testing-library/react (jsdom). i18n propio con JSON planos (`src/i18n/es.json`, `en.json`).

**Spec:** `docs/superpowers/specs/2026-08-14-esquemas-trackers-design.md`

## Global Constraints

- **Los `id` del esquema son claves de almacenamiento.** `DEFAULT_SCHEMA` usa los ids que los datos ya tienen: `ticket`, `fecha`, `prioridad`, `creador`, `squad`, `status`, `ios`, `webDesktop`. Nunca inventar ids nuevos para entradas por defecto. Las entradas que crea el usuario reciben `crypto.randomUUID()`.
- **Ningún dato se poda jamás.** Campos guardados que no estén en el esquema, y plataformas guardadas que no estén en el esquema, se hidratan y se re-persisten intactos. Es la convención "huérfano pero intacto" que el repo ya aplica al `board` legacy (`useRegressions.ts:56-58`).
- **Ocultar (`hidden: true`) filtra el render, nunca borra el dato.**
- **La etiqueta se resuelve `entry.label ?? t(entry.labelKey)`.** Renombrar escribe `label`, que gana sobre `labelKey`, y por tanto fija ese rótulo igual en los dos idiomas. Es intencionado y el editor lo advierte.
- **Esta fase define SOLO la sección `regression` del esquema.** La sección `sprint` la añade la Fase 5. `useSchema()` hace fallback **por sección** desde el primer día precisamente para que añadirla después no rompa a quien ya guardó un esquema.
- **Paridad i18n ES/EN obligatoria.** `src/i18n/keyParity.test.ts` la verifica. Toda clave nueva va en los dos ficheros.
- **En los tests la app renderiza en INGLÉS.** `detectLang()` (`I18nContext.tsx:26`) lee `navigator.language` y jsdom devuelve `en-US`. Al afirmar sobre texto visible, usar los valores de `en.json` (`Date`, `Priority`, `Creator`, `Squad`, `Status`), no los de `es.json`.
- **Línea base verificada** con `npx vitest run` el 2026-08-14: **556 tests en 56 ficheros**, todos en verde; **285 claves i18n** con paridad exacta.
- Comandos: `npx vitest run <ruta>` para un fichero, `npm test` para la suite, `npm run typecheck`, `npm run build`.

---

## Estructura de ficheros

**Nuevos:**

| Fichero | Responsabilidad |
|---|---|
| `src/types/schema.ts` | Tipos `SchemaEntry` / `TrackerSchema`, la constante `DEFAULT_SCHEMA` y el helper puro `resolveLabel`. Sin React. |
| `src/hooks/useSchema.ts` | Lectura/escritura de `acgen_schema` con fallback por sección. |
| `src/hooks/useSchema.test.ts` | Tests del hook. |
| `src/components/SchemaEntryRow.tsx` | Una fila del editor: input de etiqueta (commit en blur) + checkbox de ocultar. La Fase 5 la reutiliza tal cual. |
| `src/components/RegressionSchemaEditor.tsx` | Modal del editor de campos y plataformas. |
| `src/components/RegressionSchemaEditor.test.tsx` | Tests del editor. |

**Modificados:** `src/config/constants.ts`, `src/hooks/useRegressions.ts` (+ su test), `src/components/RegressionCard.tsx` (+ su test), `src/components/RegressionTracker.tsx` (+ su test), `src/types/context.ts`, `src/components/ProfileEditor.tsx` (+ su test), `src/components/BugReportTool.tsx`, `src/i18n/es.json`, `src/i18n/en.json`, `AGENTS.md`, `README.md`.

---

## Task 1: Tipos del esquema y hook `useSchema`

**Files:**
- Create: `src/types/schema.ts`
- Create: `src/hooks/useSchema.ts`
- Test: `src/hooks/useSchema.test.ts`
- Modify: `src/config/constants.ts:62-74` (añadir `SCHEMA` a `STORAGE_KEYS`)

**Interfaces:**
- Consumes: `useLocalStorage` de `src/hooks/useLocalStorage.ts`, firma `useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((prev: T) => T)) => void]`.
- Produces, y todas las tareas siguientes dependen de estas firmas exactas:
  - `interface SchemaEntry { id: string; labelKey?: string; label?: string; hidden?: boolean }`
  - `interface TrackerSchema { version: 1; regression: { ticketFields: SchemaEntry[]; platforms: SchemaEntry[] } }`
  - `const DEFAULT_SCHEMA: TrackerSchema`
  - `function resolveLabel(entry: SchemaEntry | undefined, t: (key: string) => string): string`
  - `function useSchema(): [TrackerSchema, (value: TrackerSchema) => void]`
  - `STORAGE_KEYS.SCHEMA === 'acgen_schema'`

- [ ] **Step 1: Escribir el test que falla**

Crear `src/hooks/useSchema.test.ts`:

```tsx
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
```

- [ ] **Step 2: Ejecutar el test y verificar que falla**

Run: `npx vitest run src/hooks/useSchema.test.ts`
Expected: FAIL — no se puede resolver `./useSchema` ni `../types/schema`.

- [ ] **Step 3: Crear `src/types/schema.ts`**

```ts
/** Una entrada configurable del esquema: un campo, una plataforma, una columna. */
export interface SchemaEntry {
  /** Clave de almacenamiento. NUNCA cambia una vez creada: los datos guardados
   *  cuelgan de ella. Las entradas por defecto usan los ids historicos; las que
   *  crea el usuario, crypto.randomUUID(). */
  id: string;
  /** Clave i18n de la etiqueta por defecto. */
  labelKey?: string;
  /** Etiqueta literal. La escribe el usuario al renombrar (y entonces gana sobre
   *  labelKey, fijando el texto igual en los dos idiomas), o viene por defecto
   *  cuando ES y EN dicen lo mismo (APPS, WEB). */
  label?: string;
  /** Oculta la entrada del render. NUNCA borra sus datos. */
  hidden?: boolean;
}

export interface TrackerSchema {
  version: 1;
  regression: {
    ticketFields: SchemaEntry[];
    platforms: SchemaEntry[];
  };
}

/** Codificacion exacta de la configuracion cableada de hoy. Sin esquema
 *  guardado, la app se comporta identica y los datos no se reescriben. */
export const DEFAULT_SCHEMA: TrackerSchema = {
  version: 1,
  regression: {
    ticketFields: [
      { id: 'ticket', labelKey: 'regression.colTicket' },
      { id: 'fecha', labelKey: 'regression.colFecha' },
      { id: 'prioridad', labelKey: 'regression.colPrioridad' },
      { id: 'creador', labelKey: 'regression.colCreador' },
      { id: 'squad', labelKey: 'regression.colSquad' },
      { id: 'status', labelKey: 'regression.colStatus' },
    ],
    // APPS y WEB se escriben igual en ES y EN: darles clave i18n crearia dos
    // pares de traduccion byte a byte identicos sin ganancia.
    platforms: [
      { id: 'ios', label: 'APPS' },
      { id: 'webDesktop', label: 'WEB' },
    ],
  },
};

export function resolveLabel(entry: SchemaEntry | undefined, t: (key: string) => string): string {
  if (!entry) return '';
  if (entry.label !== undefined) return entry.label;
  return entry.labelKey ? t(entry.labelKey) : '';
}

/** Ids de las entradas visibles, en orden. */
export function visibleEntries(entries: SchemaEntry[]): SchemaEntry[] {
  return entries.filter((e) => !e.hidden);
}
```

- [ ] **Step 4: Añadir `SCHEMA` a `STORAGE_KEYS`**

En `src/config/constants.ts`, dentro del objeto `STORAGE_KEYS` (`:62-74`), añadir tras `LAST_BACKUP`:

```ts
  SCHEMA: 'acgen_schema',
```

- [ ] **Step 5: Crear `src/hooks/useSchema.ts`**

```ts
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
```

- [ ] **Step 6: Ejecutar el test y verificar que pasa**

Run: `npx vitest run src/hooks/useSchema.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 7: Verificar que nada se ha roto**

Run: `npm run typecheck && npx vitest run`
Expected: typecheck limpio; 556 + 9 = **565 tests en 57 ficheros**.

- [ ] **Step 8: Commit**

```bash
git add src/types/schema.ts src/hooks/useSchema.ts src/hooks/useSchema.test.ts src/config/constants.ts
git commit -m "feat(schema): tipos, DEFAULT_SCHEMA y hook useSchema"
```

---

## Task 2: `useRegressions` guiado por el esquema

**Files:**
- Modify: `src/hooks/useRegressions.ts` (completo)
- Test: `src/hooks/useRegressions.test.ts`

**Interfaces:**
- Consumes: `useSchema()`, `DEFAULT_SCHEMA`, `SchemaEntry`, `visibleEntries` de la Task 1.
- Produces:
  - `type PlatformId = string`
  - `type RegressionTicket = { id: string } & Record<string, string>`
  - `ticketRowHasContent(t: RegressionTicket, fieldIds: string[]): boolean`
  - `filledTicketCount(r: Regression, fieldIds: string[]): number`
  - `updateTicket(platform: PlatformId, regressionId: string, ticketId: string, field: string, value: string)`
  - `PLATFORM_IDS` **desaparece**: los consumidores leen las plataformas del esquema.

- [ ] **Step 1: Escribir los tests que fallan**

En `src/hooks/useRegressions.test.ts`, añadir al final del fichero un bloque nuevo. **Este es el test que decide si la fase se mergea:**

```tsx
import { STORAGE_KEYS } from '../config/constants';
import { DEFAULT_SCHEMA } from '../types/schema';

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
```

Además, en el mismo fichero, **arreglar el churn de los tests existentes**: sustituir cada uso de `PLATFORM_IDS` (que deja de exportarse) por el literal `['ios', 'webDesktop']`, y actualizar las llamadas a `ticketRowHasContent(t)` / `filledTicketCount(r)` para que reciban el segundo argumento `['ticket', 'fecha', 'prioridad', 'creador', 'squad', 'status']`. Ajustar el import de la cabecera del fichero para quitar `PLATFORM_IDS` y añadir `RegressionTicket` al import de tipos.

- [ ] **Step 2: Ejecutar los tests y verificar que fallan**

Run: `npx vitest run src/hooks/useRegressions.test.ts`
Expected: FAIL — `ticketRowHasContent` recibe 2 argumentos pero acepta 1; `PLATFORM_IDS` no existe.

- [ ] **Step 3: Reescribir la cabecera de `useRegressions.ts`**

Sustituir las líneas 1-31 (imports, `PlatformId`, `PLATFORM_IDS`, `TicketField`, `RegressionTicket`) por:

```ts
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
```

Eliminar por completo `export type TicketField` y `export const PLATFORM_IDS`.

- [ ] **Step 4: Parametrizar las funciones de ticket por lista de ids**

Sustituir `emptyTicket` (`:65-67`), `normalizeTicket` (`:71-81`) y `ticketRowHasContent` (`:107-113`) por:

```ts
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

export function ticketRowHasContent(t: RegressionTicket, fieldIds: string[]): boolean {
  return fieldIds.some((f) => (t[f] ?? '').trim() !== '');
}

export function filledTicketCount(r: Regression, fieldIds: string[]): number {
  return r.tickets.filter((t) => ticketRowHasContent(t, fieldIds)).length;
}
```

Y `normalizeRegression` pasa a recibir los ids:

```ts
function normalizeRegression(r: Partial<Regression> | null | undefined, fieldIds: string[]): Regression {
  return {
    id: r?.id ?? crypto.randomUUID(),
    version: r?.version ?? '',
    url: r?.url ?? '',
    fecha: r?.fecha ?? '',
    tickets: Array.isArray(r?.tickets) ? r.tickets.map((t) => normalizeTicket(t, fieldIds)) : [],
  };
}
```

`emptyBoard()` y `emptyRegressions()` pasan a derivarse de los ids de plataforma:

```ts
function emptyBoard(platformIds: string[]): Record<PlatformId, string[][]> {
  return Object.fromEntries(platformIds.map((p) => [p, createEmptyGrid()]));
}

function emptyRegressions(platformIds: string[]): Record<PlatformId, Regression[]> {
  return Object.fromEntries(platformIds.map((p) => [p, []]));
}
```

- [ ] **Step 5: Cablear el esquema dentro del hook**

Al principio de `export function useRegressions()`, antes del `useState`:

```ts
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
```

En el inicializador del `useState`, sustituir el cuerpo por:

```ts
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
```

- [ ] **Step 6: Actualizar los callbacks que crean tickets y la firma de `updateTicket`**

En `addRegression` (`:170-181`): `tickets: Array.from({ length: INITIAL_TICKET_ROWS }, () => emptyTicket(fieldIds))`, y añadir `fieldIds` al array de dependencias del `useCallback`.

En `addTicket` (`:221-227`): `[...r.tickets, emptyTicket(fieldIds)]`, dependencias `[fieldIds]`.

En `updateTicket` (`:229-242`): cambiar el tipo del parámetro `field` de `TicketField` a `string`. Dependencias sin cambio (`[]`).

Los demás callbacks no cambian.

- [ ] **Step 7: Ejecutar los tests y verificar que pasan**

Run: `npx vitest run src/hooks/useRegressions.test.ts`
Expected: PASS. El fichero pasa de 21 a **27 tests**.

- [ ] **Step 8: Commit**

```bash
git add src/hooks/useRegressions.ts src/hooks/useRegressions.test.ts
git commit -m "feat(regression): useRegressions guiado por el esquema, ticket keyed"
```

Nota: `npm run typecheck` y la suite completa fallarán todavía — `RegressionCard` y `RegressionTracker` siguen importando `TicketField` y `PLATFORM_IDS`. Los arreglan las Tasks 3 y 4. Es el único punto del plan donde el árbol queda temporalmente roto, y es deliberado: partir el cambio de tipo en dos commits deja un diff mucho más legible que un commit único de tres ficheros.

---

## Task 3: `RegressionCard` pinta las columnas del esquema

**Files:**
- Modify: `src/components/RegressionCard.tsx`
- Test: `src/components/RegressionCard.test.tsx`

**Interfaces:**
- Consumes: `useSchema()`, `resolveLabel`, `visibleEntries` (Task 1); `ticketRowHasContent(t, fieldIds)`, `filledTicketCount(r, fieldIds)`, `RegressionTicket` (Task 2).
- Produces: `RegressionCardProps.onUpdateTicket` cambia a `(ticketId: string, field: string, value: string) => void`.

**Decisión de diseño que el implementador NO debe cambiar:** hoy la celda-enlace es la del campo con id `ticket` (`RegressionCard.tsx:273`). Pasa a ser **la primera columna visible**, sea cual sea su id. Con el esquema por defecto es exactamente la misma celda, así que no hay cambio de comportamiento; pero sobrevive a que el usuario renombre, oculte o reordene por delante, y es coherente con el `ci === 0` de `TrackerGrid`.

- [ ] **Step 1: Escribir los tests que fallan**

En `src/components/RegressionCard.test.tsx`, actualizar el helper `makeRegression` para que los tickets sigan siendo objetos con los 6 campos (no cambia nada: ya lo son) y añadir un bloque nuevo al final:

```tsx
import { STORAGE_KEYS } from '../config/constants';
import { DEFAULT_SCHEMA } from '../types/schema';

describe('RegressionCard con esquema', () => {
  it('GUARDIAN: sin esquema guardado pinta las 6 cabeceras de hoy en orden', () => {
    renderCard({ defaultExpanded: true });
    const headers = screen.getAllByRole('columnheader').map((th) => th.textContent);
    // jsdom => navigator.language 'en-US' => la app renderiza en INGLES.
    expect(headers.slice(0, 6)).toEqual(['Ticket', 'Date', 'Priority', 'Creator', 'Squad', 'Status']);
  });

  it('renombrar un campo cambia el rotulo sin tocar el dato', () => {
    localStorage.setItem(STORAGE_KEYS.SCHEMA, JSON.stringify({
      version: 1,
      regression: {
        ...DEFAULT_SCHEMA.regression,
        ticketFields: DEFAULT_SCHEMA.regression.ticketFields.map((f) =>
          f.id === 'squad' ? { ...f, label: 'Equipo' } : f
        ),
      },
    }));
    renderCard({
      defaultExpanded: true,
      regression: makeRegression({
        tickets: [{ id: 't1', ticket: '', fecha: '', prioridad: '', creador: '', squad: 'Checkout', status: '' }],
      }),
    });
    const headers = screen.getAllByRole('columnheader').map((th) => th.textContent);
    expect(headers.slice(0, 6)).toEqual(['Ticket', 'Date', 'Priority', 'Creator', 'Equipo', 'Status']);
    expect(screen.getByDisplayValue('Checkout')).toBeTruthy();
  });

  it('un campo oculto desaparece de la tabla pero su valor sigue en el ticket', () => {
    localStorage.setItem(STORAGE_KEYS.SCHEMA, JSON.stringify({
      version: 1,
      regression: {
        ...DEFAULT_SCHEMA.regression,
        ticketFields: DEFAULT_SCHEMA.regression.ticketFields.map((f) =>
          f.id === 'squad' ? { ...f, hidden: true } : f
        ),
      },
    }));
    renderCard({
      defaultExpanded: true,
      regression: makeRegression({
        tickets: [{ id: 't1', ticket: '', fecha: '', prioridad: '', creador: '', squad: 'Checkout', status: '' }],
      }),
    });
    const headers = screen.getAllByRole('columnheader').map((th) => th.textContent);
    expect(headers.slice(0, 5)).toEqual(['Ticket', 'Date', 'Priority', 'Creator', 'Status']);
    expect(screen.queryByDisplayValue('Checkout')).toBeNull();
  });

  it('un campo anadido por el usuario se pinta y es editable', () => {
    const onUpdateTicket = vi.fn();
    localStorage.setItem(STORAGE_KEYS.SCHEMA, JSON.stringify({
      version: 1,
      regression: {
        ...DEFAULT_SCHEMA.regression,
        ticketFields: [...DEFAULT_SCHEMA.regression.ticketFields, { id: 'entorno', label: 'Entorno' }],
      },
    }));
    renderCard({
      defaultExpanded: true,
      onUpdateTicket,
      regression: makeRegression({
        tickets: [{ id: 't1', ticket: '', fecha: '', prioridad: '', creador: '', squad: '', status: '', entorno: 'Pro' }],
      }),
    });
    const headers = screen.getAllByRole('columnheader').map((th) => th.textContent);
    expect(headers.slice(0, 7)).toEqual(['Ticket', 'Date', 'Priority', 'Creator', 'Squad', 'Status', 'Entorno']);
    fireEvent.change(screen.getByDisplayValue('Pro'), { target: { value: 'UAT' } });
    expect(onUpdateTicket).toHaveBeenCalledWith('t1', 'entorno', 'UAT');
  });

  it('el contador de tickets no cuenta contenido de campos ocultos', () => {
    localStorage.setItem(STORAGE_KEYS.SCHEMA, JSON.stringify({
      version: 1,
      regression: {
        ...DEFAULT_SCHEMA.regression,
        ticketFields: DEFAULT_SCHEMA.regression.ticketFields.map((f) =>
          f.id === 'squad' ? { ...f, hidden: true } : f
        ),
      },
    }));
    renderCard({
      regression: makeRegression({
        tickets: [{ id: 't1', ticket: '', fecha: '', prioridad: '', creador: '', squad: 'Checkout', status: '' }],
      }),
    });
    expect(screen.getByText(/^0 /)).toBeTruthy();
  });
});
```

Añadir `localStorage.clear()` al `beforeEach` del fichero si no lo tiene ya.

- [ ] **Step 2: Ejecutar los tests y verificar que fallan**

Run: `npx vitest run src/components/RegressionCard.test.tsx`
Expected: FAIL — el fichero no compila (`TicketField` ya no se exporta desde `useRegressions`).

- [ ] **Step 3: Cambiar imports, columnas y anchos**

En `src/components/RegressionCard.tsx`, sustituir las líneas 1-25 (imports, `TICKET_COLUMNS`, `DEFAULT_COL_WIDTHS`) por:

```tsx
import { useState, useEffect, useRef } from 'react';
import type { Regression } from '../hooks/useRegressions';
import { filledTicketCount, ticketRowHasContent } from '../hooks/useRegressions';
import { useSchema } from '../hooks/useSchema';
import { resolveLabel, visibleEntries } from '../types/schema';
import { parseUrlCell } from '../utils/trackerLinks';
import { formatDate } from '../utils/dates';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { STORAGE_KEYS } from '../config/constants';
import { useT, useLang } from '../i18n/I18nContext';
import { highlightMatches, containsMatch, MARK_STYLE } from '../utils/highlight';

// Anchos iniciales en px de los campos por defecto (Ticket ancho, el resto
// compacto); el usuario los ajusta arrastrando el borde de cada cabecera.
// Un campo anadido por el usuario arranca en FALLBACK_COL_WIDTH.
const DEFAULT_COL_WIDTHS: Record<string, number> = {
  ticket: 300, fecha: 110, prioridad: 110, creador: 130, squad: 120, status: 110,
};
const FALLBACK_COL_WIDTH = 120;
const MIN_COL_WIDTH = 50;
```

Cambiar el tipo del prop `onUpdateTicket` en `RegressionCardProps` a:

```tsx
  onUpdateTicket?: (ticketId: string, field: string, value: string) => void;
```

- [ ] **Step 4: Cablear el esquema en el cuerpo del componente**

Justo después de `const { lang } = useLang();` (`:64`):

```tsx
  const [schema] = useSchema();
  const columns = visibleEntries(schema.regression.ticketFields);
  const fieldIds = columns.map((c) => c.id);
  // La celda-enlace es la PRIMERA COLUMNA VISIBLE, no el id 'ticket': asi
  // sobrevive a renombrados y a que se oculte algo por delante. Con el esquema
  // por defecto es exactamente la misma celda que antes.
  const linkFieldId = fieldIds[0];
```

Cambiar los dos `useLocalStorage`/`useState` de anchos (`:68-73`) para que el tipo sea `Record<string, number>` en vez de `Partial<Record<TicketField, number>>`, y `resizeRef` (`:77`) para que `field` sea `string`.

Sustituir el `startResize` (`:101-108`) para que use el fallback:

```tsx
  const startResize = (e: React.MouseEvent, field: string) => {
    e.preventDefault();
    e.stopPropagation();
    resizeRef.current = {
      field, startX: e.clientX,
      startWidth: colWidths[field] ?? DEFAULT_COL_WIDTHS[field] ?? FALLBACK_COL_WIDTH,
    };
    setIsResizing(true);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };
```

Y `const ticketCount = filledTicketCount(regression);` (`:116`) pasa a `filledTicketCount(regression, fieldIds)`.

- [ ] **Step 5: Sustituir `TICKET_COLUMNS` por `columns` en el render**

Tres sitios:

`<colgroup>` (`:240-245`):
```tsx
              <colgroup>
                {columns.map(({ id }) => (
                  <col key={id} style={{ width: colWidths[id] ?? DEFAULT_COL_WIDTHS[id] ?? FALLBACK_COL_WIDTH }} />
                ))}
                {!readOnly && <col style={{ width: 36 }} />}
              </colgroup>
```

`<thead>` (`:248-264`) — cambiar `TICKET_COLUMNS.map(({ field, labelKey }) =>` por `columns.map((column) =>`, `key={labelKey}` por `key={column.id}`, `{t(labelKey)}` por `{resolveLabel(column, t)}`, `data-col-resize={field}` por `data-col-resize={column.id}` y `startResize(e, field)` por `startResize(e, column.id)`.

Cuerpo de la fila (`:271-348`) — cambiar `TICKET_COLUMNS.map(({ field }) => {` por `columns.map(({ id: field }) => {`, y las dos líneas que dependen del id:

```tsx
                      const value = ticket[field] ?? '';
                      const parts = field === linkFieldId ? parseUrlCell(value) : null;
```

El resto del cuerpo de la celda no cambia.

Y el botón de borrar fila (`:357`): `ticketRowHasContent(ticket)` pasa a `ticketRowHasContent(ticket, fieldIds)`.

- [ ] **Step 6: Ejecutar los tests y verificar que pasan**

Run: `npx vitest run src/components/RegressionCard.test.tsx`
Expected: PASS. El fichero gana 5 tests.

- [ ] **Step 7: Commit**

```bash
git add src/components/RegressionCard.tsx src/components/RegressionCard.test.tsx
git commit -m "feat(regression): RegressionCard pinta las columnas del esquema"
```

---

## Task 4: `RegressionTracker` toma las plataformas del esquema

**Files:**
- Modify: `src/components/RegressionTracker.tsx`
- Test: `src/components/RegressionTracker.test.tsx`

**Interfaces:**
- Consumes: `useSchema()`, `resolveLabel`, `visibleEntries` (Task 1); `useRegressions()` sin `PLATFORM_IDS` (Task 2); `RegressionCard` con `onUpdateTicket: (ticketId, field: string, value) => void` (Task 3).
- Produces: nada que consuman tareas posteriores salvo el punto de montaje del editor, que añade la Task 5.

- [ ] **Step 1: Escribir los tests que fallan**

Añadir al final de `src/components/RegressionTracker.test.tsx`:

```tsx
import { STORAGE_KEYS } from '../config/constants';
import { DEFAULT_SCHEMA } from '../types/schema';

describe('RegressionTracker con esquema', () => {
  it('GUARDIAN: sin esquema guardado pinta las dos pestanas de hoy', () => {
    renderTracker();
    expect(screen.getByRole('button', { name: 'APPS' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'WEB' })).toBeTruthy();
  });

  it('renombrar una plataforma cambia la pestana sin mover los datos', () => {
    localStorage.setItem('acgen_regressions', JSON.stringify({
      regressions: { ios: [{ id: 'r1', version: '1.2.3', url: '', fecha: '2026-08-10', tickets: [] }], webDesktop: [] },
      archived: [],
    }));
    localStorage.setItem(STORAGE_KEYS.SCHEMA, JSON.stringify({
      version: 1,
      regression: {
        ...DEFAULT_SCHEMA.regression,
        platforms: [{ id: 'ios', label: 'Moviles' }, { id: 'webDesktop', label: 'WEB' }],
      },
    }));
    renderTracker();
    expect(screen.getByRole('button', { name: 'Moviles' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'APPS' })).toBeNull();
    expect(screen.getByText('1.2.3')).toBeTruthy();
  });

  it('ocultar la plataforma activa reencamina a la primera visible', () => {
    localStorage.setItem(STORAGE_KEYS.SCHEMA, JSON.stringify({
      version: 1,
      regression: {
        ...DEFAULT_SCHEMA.regression,
        platforms: [{ id: 'ios', label: 'APPS', hidden: true }, { id: 'webDesktop', label: 'WEB' }],
      },
    }));
    renderTracker();
    expect(screen.queryByRole('button', { name: 'APPS' })).toBeNull();
    expect(screen.getByRole('button', { name: 'WEB' })).toBeTruthy();
  });

  it('la busqueda no encuentra por campos ocultos', () => {
    localStorage.setItem('acgen_regressions', JSON.stringify({
      regressions: {
        ios: [{ id: 'r1', version: '1.0.0', url: '', fecha: '2026-08-10', tickets: [
          { id: 't1', ticket: '', fecha: '', prioridad: '', creador: '', squad: 'Checkout', status: '' },
        ] }],
        webDesktop: [],
      },
      archived: [],
    }));
    localStorage.setItem(STORAGE_KEYS.SCHEMA, JSON.stringify({
      version: 1,
      regression: {
        ...DEFAULT_SCHEMA.regression,
        ticketFields: DEFAULT_SCHEMA.regression.ticketFields.map((f) =>
          f.id === 'squad' ? { ...f, hidden: true } : f
        ),
      },
    }));
    renderTracker();
    const search = screen.getByLabelText(/search/i);
    fireEvent.change(search, { target: { value: 'Checkout' } });
    expect(screen.getByText(/no matches/i)).toBeTruthy();
  });
});
```

**Antes de escribir estos tests, leer el fichero de test existente** y reutilizar su helper de render (que envuelve en `I18nProvider`); si no existe uno reutilizable, crear `renderTracker()` siguiendo el patrón de `RegressionCard.test.tsx`. Los textos de "no matches" y el `aria-label` del buscador salen de `en.json` — comprobar los valores exactos de `regression.noMatches` y `regression.searchPlaceholder` en ese fichero y usarlos.

- [ ] **Step 2: Ejecutar los tests y verificar que fallan**

Run: `npx vitest run src/components/RegressionTracker.test.tsx`
Expected: FAIL — el fichero no compila (`PLATFORM_IDS` ya no se exporta).

- [ ] **Step 3: Cambiar imports y derivar plataformas del esquema**

Sustituir las líneas 1-26 de `src/components/RegressionTracker.tsx` por:

```tsx
import { useState, useCallback } from 'react';
import { TrackerGrid } from './TrackerGrid';
import { RegressionCard } from './RegressionCard';
import { useRegressions, isLegacyArchived } from '../hooks/useRegressions';
import type { PlatformId, ArchivedItem } from '../hooks/useRegressions';
import { useSchema } from '../hooks/useSchema';
import { DEFAULT_SCHEMA, resolveLabel, visibleEntries } from '../types/schema';
import { STORAGE_KEYS } from '../config/constants';
import { useT, useLang } from '../i18n/I18nContext';
import { formatDate, localTodayISO } from '../utils/dates';

// Cabeceras del grid ANTIGUO: solo para renderizar snapshots legacy del historial.
const LEGACY_HEADERS = ['Regresión', 'Versión', 'Fecha', 'Notas', 'Status'];

type Screen = { kind: 'board' } | { kind: 'archivedList' } | { kind: 'snapshot'; id: string };
```

(`archivedLabel` sale de aquí: pasa a ser una función local dentro del componente, porque necesita el esquema y `t`.)

- [ ] **Step 4: Derivar plataformas, pestaña segura y etiquetas dentro del componente**

Justo después de `const { lang } = useLang();` (`:45`):

```tsx
  const [schema] = useSchema();
  const platforms = visibleEntries(schema.regression.platforms);
  const platformIds = platforms.map((p) => p.id);
  const visibleFieldIds = visibleEntries(schema.regression.ticketFields).map((f) => f.id);

  // activeTab puede quedar apuntando a una plataforma que el usuario acaba de
  // ocultar; en ese caso se reencamina a la primera visible.
  const safeTab: PlatformId = platformIds.includes(activeTab) ? activeTab : platformIds[0];

  const platformLabel = (id: PlatformId): string =>
    resolveLabel(schema.regression.platforms.find((p) => p.id === id), t) || id;

  const archivedLabel = (item: ArchivedItem): string =>
    isLegacyArchived(item) ? item.name : `${platformLabel(item.platform)} · ${item.regression.version}`;
```

Y cambiar la inicialización del estado (`:36`) de `useState<PlatformId>(PLATFORM_IDS[0])` a `useState<PlatformId>(DEFAULT_SCHEMA.regression.platforms[0].id)` — importando `DEFAULT_SCHEMA` — para que el valor inicial no dependa del orden de los hooks.

**Sustituir todos los usos posteriores de `activeTab` por `safeTab`** en el cuerpo del componente: `handleCreate` (`:51`), `const list = regressions[activeTab] || []` (`:144`), el `className` de las pestañas, y las seis llamadas a `updateRegression` / `updateTicket` / `addTicket` / `deleteTicket` / `archiveRegression` / `deleteRegression` / `moveRegression` (`:299,334-339`). El `onClick` de cada pestaña sigue llamando a `setActiveTab(tab)`.

- [ ] **Step 5: Pintar las pestañas y el snapshot legacy desde el esquema**

En el bloque del snapshot legacy (`:76-88`), sustituir los tres props del `TrackerGrid`:

```tsx
            tabs={platformIds}
            tabLabels={Object.fromEntries(platforms.map((p) => [p.id, resolveLabel(p, t)]))}
            tabHeaders={Object.fromEntries(platformIds.map((p) => [p, LEGACY_HEADERS]))}
```

En la barra de pestañas del tablero (`:177-186`), sustituir `PLATFORM_IDS.map((tab) => (` por `platforms.map((platform) => (`, con `key={platform.id}`, `onClick={() => setActiveTab(platform.id)}`, `className={...safeTab === platform.id ? 'sprint-tab-active' : ''}` y el contenido `{resolveLabel(platform, t)}`.

- [ ] **Step 6: Restringir la búsqueda a los campos visibles**

En el filtro (`:150`), sustituir la lista literal de seis campos por:

```tsx
      const ticketIds = regression.tickets
        .filter((tk) => visibleFieldIds.some((f) => hasText(tk[f] ?? '')))
        .map((tk) => tk.id);
```

- [ ] **Step 7: Ejecutar los tests y verificar que pasan**

Run: `npx vitest run src/components/RegressionTracker.test.tsx && npm run typecheck`
Expected: PASS y typecheck limpio — este es el commit que vuelve a dejar el árbol compilando.

- [ ] **Step 8: Ejecutar la suite completa**

Run: `npx vitest run`
Expected: todo en verde. Si algún test de otro fichero falla por importar `PLATFORM_IDS` o `TicketField`, arreglarlo aquí sustituyéndolo por los ids literales.

- [ ] **Step 9: Commit**

```bash
git add src/components/RegressionTracker.tsx src/components/RegressionTracker.test.tsx
git commit -m "feat(regression): plataformas y busqueda desde el esquema"
```

---

## Task 5: El editor de esquema

**Files:**
- Create: `src/components/SchemaEntryRow.tsx`
- Create: `src/components/RegressionSchemaEditor.tsx`
- Test: `src/components/RegressionSchemaEditor.test.tsx`
- Modify: `src/components/RegressionTracker.tsx` (botón + montaje del modal)
- Modify: `src/i18n/es.json`, `src/i18n/en.json`

**Interfaces:**
- Consumes: `useSchema()`, `DEFAULT_SCHEMA`, `SchemaEntry`, `resolveLabel` (Task 1).
- Produces:
  - `SchemaEntryRow` con props `{ label: string; hidden: boolean; canHide: boolean; inputId: string; onRename: (label: string) => void; onToggleHidden: (hidden: boolean) => void }`
  - `RegressionSchemaEditor` con props `{ onClose: () => void }`

**Decisiones que el implementador NO debe cambiar:**
- **Escritura directa, sin borrador ni botón Guardar.** Cada cambio llama a `setSchema` en el acto. Es lo que hace ya `TrackerGrid` con los anchos de columna. La vía de vuelta es "Restaurar por defecto".
- **La excepción es el input de renombrar**, que sí tiene borrador local dentro de `SchemaEntryRow` y **confirma en `blur`**: así el usuario puede vaciar el campo para escribir otro nombre sin que un valor intermedio vacío borre la etiqueta. Un borrador vacío al salir del input descarta y restaura la etiqueta anterior — mismo criterio que la versión de una regresión (`useRegressions.ts:191`).
- **"Restaurar por defecto" solo restaura `regression`**, no el esquema entero: `setSchema({ ...schema, regression: DEFAULT_SCHEMA.regression })`. Un reset global borraría en silencio la configuración de Sprint que añade la Fase 5.
- **Se usa el patrón de modal existente** (`className="modal-overlay"` / `"modal-content"`, cierre por click en el overlay con `stopPropagation` en el contenido), igual que `ProfileEditor.tsx:43-48`. Cero CSS nuevo.

- [ ] **Step 1: Añadir las 12 claves i18n**

En `src/i18n/es.json`, añadir (manteniendo el orden alfabético por prefijo que ya tiene el fichero, junto al resto de bloques):

```json
  "schema.open": "Columnas",
  "schema.title": "Columnas y plataformas",
  "schema.fields": "Campos del ticket",
  "schema.platforms": "Plataformas",
  "schema.addField": "Añadir campo",
  "schema.newFieldPlaceholder": "Nombre del campo nuevo",
  "schema.hide": "Ocultar",
  "schema.nameOf": "Nombre de {name}",
  "schema.hiddenHint": "Ocultar no borra nada: los datos siguen guardados y vuelven al mostrar la entrada otra vez.",
  "schema.renameHint": "Un nombre propio sustituye a la traducción: se verá igual en español y en inglés.",
  "schema.reset": "Restaurar por defecto",
  "schema.resetConfirm": "¿Restaurar los campos y plataformas por defecto del Regression Tracker?",
```

En `src/i18n/en.json`, las mismas claves:

```json
  "schema.open": "Columns",
  "schema.title": "Columns and platforms",
  "schema.fields": "Ticket fields",
  "schema.platforms": "Platforms",
  "schema.addField": "Add field",
  "schema.newFieldPlaceholder": "New field name",
  "schema.hide": "Hide",
  "schema.nameOf": "Name of {name}",
  "schema.hiddenHint": "Hiding deletes nothing: the data stays stored and comes back when you show the entry again.",
  "schema.renameHint": "A custom name replaces the translation: it will read the same in Spanish and English.",
  "schema.reset": "Reset to defaults",
  "schema.resetConfirm": "Reset the Regression Tracker fields and platforms to their defaults?",
```

- [ ] **Step 2: Escribir el test que falla**

Crear `src/components/RegressionSchemaEditor.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { I18nProvider } from '../i18n/I18nContext';
import { RegressionSchemaEditor } from './RegressionSchemaEditor';
import { STORAGE_KEYS } from '../config/constants';
import { DEFAULT_SCHEMA } from '../types/schema';

function renderEditor(onClose = () => {}) {
  return render(
    <I18nProvider>
      <RegressionSchemaEditor onClose={onClose} />
    </I18nProvider>
  );
}

function storedSchema() {
  return JSON.parse(localStorage.getItem(STORAGE_KEYS.SCHEMA)!);
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('RegressionSchemaEditor', () => {
  it('lista los 6 campos y las 2 plataformas por defecto', () => {
    renderEditor();
    expect(screen.getByDisplayValue('Squad')).toBeTruthy();
    expect(screen.getByDisplayValue('Creator')).toBeTruthy();
    expect(screen.getByDisplayValue('APPS')).toBeTruthy();
    expect(screen.getByDisplayValue('WEB')).toBeTruthy();
  });

  it('renombrar un campo persiste el label al salir del input', () => {
    renderEditor();
    const input = screen.getByDisplayValue('Squad');
    fireEvent.change(input, { target: { value: 'Equipo' } });
    fireEvent.blur(input);
    expect(storedSchema().regression.ticketFields.find((f: { id: string }) => f.id === 'squad').label).toBe('Equipo');
  });

  it('un nombre vacio se descarta y restaura la etiqueta anterior', () => {
    renderEditor();
    const input = screen.getByDisplayValue('Squad');
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.blur(input);
    expect(localStorage.getItem(STORAGE_KEYS.SCHEMA)).toBeNull();
    expect(screen.getByDisplayValue('Squad')).toBeTruthy();
  });

  it('ocultar un campo escribe hidden sin tocar nada mas', () => {
    renderEditor();
    const row = screen.getByDisplayValue('Squad').closest('div')!;
    fireEvent.click(row.querySelector('input[type="checkbox"]')!);
    const fields = storedSchema().regression.ticketFields;
    expect(fields.find((f: { id: string }) => f.id === 'squad').hidden).toBe(true);
    expect(fields).toHaveLength(6);
    expect(fields.map((f: { id: string }) => f.id)).toEqual(
      DEFAULT_SCHEMA.regression.ticketFields.map((f) => f.id)
    );
  });

  it('anadir un campo lo agrega al final con un id UUID', () => {
    renderEditor();
    fireEvent.change(screen.getByPlaceholderText('New field name'), { target: { value: 'Entorno' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add field' }));
    const fields = storedSchema().regression.ticketFields;
    expect(fields).toHaveLength(7);
    expect(fields[6].label).toBe('Entorno');
    expect(fields[6].id).not.toBe('Entorno');
    expect(fields[6].id.length).toBeGreaterThan(10);
  });

  it('anadir con el nombre vacio no hace nada', () => {
    renderEditor();
    fireEvent.click(screen.getByRole('button', { name: 'Add field' }));
    expect(localStorage.getItem(STORAGE_KEYS.SCHEMA)).toBeNull();
  });

  it('no deja ocultar la ultima entrada visible de una lista', () => {
    localStorage.setItem(STORAGE_KEYS.SCHEMA, JSON.stringify({
      version: 1,
      regression: {
        ticketFields: DEFAULT_SCHEMA.regression.ticketFields,
        platforms: [{ id: 'ios', label: 'APPS' }, { id: 'webDesktop', label: 'WEB', hidden: true }],
      },
    }));
    renderEditor();
    const row = screen.getByDisplayValue('APPS').closest('div')!;
    expect((row.querySelector('input[type="checkbox"]') as HTMLInputElement).disabled).toBe(true);
  });

  it('restaurar por defecto solo toca la seccion regression', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    localStorage.setItem(STORAGE_KEYS.SCHEMA, JSON.stringify({
      version: 1,
      regression: {
        ...DEFAULT_SCHEMA.regression,
        ticketFields: DEFAULT_SCHEMA.regression.ticketFields.map((f) =>
          f.id === 'squad' ? { ...f, label: 'Equipo' } : f
        ),
      },
      sprint: { tabs: [{ id: 'resolved', label: 'Mio', headers: [] }] },
    }));
    renderEditor();
    fireEvent.click(screen.getByRole('button', { name: 'Reset to defaults' }));
    const next = storedSchema();
    expect(next.regression).toEqual(DEFAULT_SCHEMA.regression);
    expect(next.sprint).toBeUndefined();
  });

  it('cierra con el boton de cerrar', () => {
    const onClose = vi.fn();
    renderEditor(onClose);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalled();
  });
});
```

Nota sobre el último assert de "restaurar por defecto": `useSchema` devuelve un objeto con solo `version` y `regression`, así que al escribir `{ ...schema, regression: DEFAULT }` la sección `sprint` guardada **no** se propaga. Es correcto en esta fase: la Fase 5 añadirá `sprint` al valor que devuelve `useSchema` y entonces sí se conservará. El test lo fija explícitamente para que quede claro que es intencionado y no un descuido.

- [ ] **Step 3: Ejecutar el test y verificar que falla**

Run: `npx vitest run src/components/RegressionSchemaEditor.test.tsx`
Expected: FAIL — no se puede resolver `./RegressionSchemaEditor`.

- [ ] **Step 4: Crear `src/components/SchemaEntryRow.tsx`**

```tsx
import { useState, useEffect } from 'react';
import { useT } from '../i18n/I18nContext';

interface SchemaEntryRowProps {
  label: string;
  hidden: boolean;
  /** false cuando esta es la ultima entrada visible de su lista. */
  canHide: boolean;
  inputId: string;
  onRename: (label: string) => void;
  onToggleHidden: (hidden: boolean) => void;
}

/**
 * Una fila del editor de esquema. El input de nombre lleva borrador local y
 * confirma en blur: asi se puede vaciar para escribir otro nombre sin que un
 * valor intermedio en blanco borre la etiqueta. Un borrador vacio al salir se
 * descarta y restaura la etiqueta anterior.
 */
export function SchemaEntryRow({ label, hidden, canHide, inputId, onRename, onToggleHidden }: SchemaEntryRowProps) {
  const t = useT();
  const [draft, setDraft] = useState(label);

  // Resincroniza cuando la etiqueta cambia por fuera (p.ej. "Restaurar por defecto").
  useEffect(() => { setDraft(label); }, [label]);

  const commit = () => {
    const next = draft.trim();
    if (!next) { setDraft(label); return; }
    if (next !== label) onRename(next);
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
      <input
        id={inputId}
        type="text"
        aria-label={t('schema.nameOf', { name: label })}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur();
          if (e.key === 'Escape') setDraft(label);
        }}
        className="field-input"
        style={{ flex: 1, minWidth: 0 }}
      />
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-2)', whiteSpace: 'nowrap' }}>
        <input
          type="checkbox"
          checked={hidden}
          disabled={!hidden && !canHide}
          onChange={(e) => onToggleHidden(e.target.checked)}
        />
        {t('schema.hide')}
      </label>
    </div>
  );
}
```

- [ ] **Step 5: Crear `src/components/RegressionSchemaEditor.tsx`**

```tsx
import { useState } from 'react';
import { useSchema } from '../hooks/useSchema';
import { DEFAULT_SCHEMA, resolveLabel, SchemaEntry } from '../types/schema';
import { useT } from '../i18n/I18nContext';
import { SchemaEntryRow } from './SchemaEntryRow';

type ListName = 'ticketFields' | 'platforms';

interface RegressionSchemaEditorProps {
  onClose: () => void;
}

export function RegressionSchemaEditor({ onClose }: RegressionSchemaEditorProps) {
  const t = useT();
  const [schema, setSchema] = useSchema();
  const [newFieldName, setNewFieldName] = useState('');

  // Escritura directa, sin borrador global: cada cambio persiste en el acto y
  // "Restaurar por defecto" es la via de vuelta.
  const writeList = (list: ListName, entries: SchemaEntry[]) =>
    setSchema({ ...schema, regression: { ...schema.regression, [list]: entries } });

  const patchEntry = (list: ListName, id: string, patch: Partial<SchemaEntry>) =>
    writeList(list, schema.regression[list].map((e) => (e.id === id ? { ...e, ...patch } : e)));

  const addField = () => {
    const name = newFieldName.trim();
    if (!name) return;
    writeList('ticketFields', [...schema.regression.ticketFields, { id: crypto.randomUUID(), label: name }]);
    setNewFieldName('');
  };

  const reset = () => {
    if (!confirm(t('schema.resetConfirm'))) return;
    setSchema({ ...schema, regression: DEFAULT_SCHEMA.regression });
  };

  const renderList = (list: ListName) => {
    const entries = schema.regression[list];
    const visibleCount = entries.filter((e) => !e.hidden).length;
    return entries.map((entry) => (
      <SchemaEntryRow
        key={entry.id}
        inputId={`schema-${list}-${entry.id}`}
        label={resolveLabel(entry, t)}
        hidden={Boolean(entry.hidden)}
        canHide={visibleCount > 1}
        onRename={(label) => patchEntry(list, entry.id, { label })}
        onToggleHidden={(hidden) => patchEntry(list, entry.id, { hidden })}
      />
    ));
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>{t('schema.title')}</h2>
          <button type="button" className="btn-ghost" onClick={onClose}>{t('common.close')}</button>
        </div>

        <p style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 4 }}>{t('schema.hiddenHint')}</p>
        <p style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 16 }}>{t('schema.renameHint')}</p>

        <h3 style={{ fontSize: 13, fontWeight: 700, margin: '0 0 8px' }}>{t('schema.fields')}</h3>
        {renderList('ticketFields')}
        <div style={{ display: 'flex', gap: 8, marginTop: 8, marginBottom: 20 }}>
          <input
            type="text"
            placeholder={t('schema.newFieldPlaceholder')}
            value={newFieldName}
            onChange={(e) => setNewFieldName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addField(); }}
            className="field-input"
            style={{ flex: 1, minWidth: 0 }}
          />
          <button type="button" className="btn-ghost" onClick={addField}>{t('schema.addField')}</button>
        </div>

        <h3 style={{ fontSize: 13, fontWeight: 700, margin: '0 0 8px' }}>{t('schema.platforms')}</h3>
        {renderList('platforms')}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
          <button type="button" className="btn-ghost" onClick={reset}>{t('schema.reset')}</button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Ejecutar el test y verificar que pasa**

Run: `npx vitest run src/components/RegressionSchemaEditor.test.tsx`
Expected: PASS, 9 tests.

- [ ] **Step 7: Montar el editor en el tracker**

En `src/components/RegressionTracker.tsx`:

Importar el editor: `import { RegressionSchemaEditor } from './RegressionSchemaEditor';`

Añadir estado junto al resto (`:35-43`): `const [showSchemaEditor, setShowSchemaEditor] = useState(false);`

En la barra de pestañas del tablero, tras el enlace de SnapLink (`:187-196`), añadir el botón. **Rotulado, no un icono**: `TrackerGrid` ya usa ⚙ para la URL base y dos engranajes serían indistinguibles.

```tsx
        <button
          type="button"
          className="btn-ghost"
          onClick={() => setShowSchemaEditor(true)}
          style={{ padding: '6px 14px', fontSize: 12 }}
        >
          {t('schema.open')}
        </button>
```

(Quitar el `marginLeft: 'auto'` del enlace de SnapLink y ponerlo en el `<a>` que ahora queda primero de los dos, para que el par quede pegado a la derecha: el `<a>` conserva `marginLeft: 'auto'` y el botón nuevo va detrás sin margen.)

Montar el modal justo antes del cierre del `<div>` raíz del tablero, junto al resto del render (`:343`):

```tsx
      {showSchemaEditor && <RegressionSchemaEditor onClose={() => setShowSchemaEditor(false)} />}
```

- [ ] **Step 8: Test del cableado**

Añadir a `src/components/RegressionTracker.test.tsx`:

```tsx
  it('el boton Columnas abre y cierra el editor de esquema', () => {
    renderTracker();
    expect(screen.queryByRole('heading', { name: 'Columns and platforms' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Columns' }));
    expect(screen.getByRole('heading', { name: 'Columns and platforms' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('heading', { name: 'Columns and platforms' })).toBeNull();
  });
```

- [ ] **Step 9: Ejecutar la suite y verificar la paridad i18n**

Run: `npx vitest run && npm run typecheck`
Expected: todo en verde, incluida `src/i18n/keyParity.test.ts`. Claves i18n: 285 → **297**.

- [ ] **Step 10: Commit**

```bash
git add src/components/SchemaEntryRow.tsx src/components/RegressionSchemaEditor.tsx src/components/RegressionSchemaEditor.test.tsx src/components/RegressionTracker.tsx src/components/RegressionTracker.test.tsx src/i18n/es.json src/i18n/en.json
git commit -m "feat(regression): editor de campos y plataformas"
```

---

## Task 6: Dispositivos configurables desde el perfil

**Files:**
- Modify: `src/types/context.ts`
- Modify: `src/components/ProfileEditor.tsx:6-17`
- Modify: `src/components/BugReportTool.tsx:9,243-244,345-351`
- Modify: `src/i18n/es.json`, `src/i18n/en.json`
- Test: `src/components/ProfileEditor.test.tsx`

**Interfaces:**
- Consumes: `ProjectProfile` / `DEFAULT_PROFILE` de `src/types/context.ts`; `IOS_DEVICES` / `ANDROID_DEVICES` de `src/config/constants.ts` (se conservan como fuente de los defaults).
- Produces: `ProjectProfile.iosDevices: string` y `ProjectProfile.androidDevices: string`, listas separadas por comas; `parseDeviceList(value: string, fallback: readonly { label: string }[]): string[]` exportada desde `src/types/context.ts`.

- [ ] **Step 1: Escribir el test que falla**

Añadir a `src/components/ProfileEditor.test.tsx`:

```tsx
import { parseDeviceList } from '../types/context';
import { IOS_DEVICES } from '../config/constants';

describe('dispositivos en el perfil', () => {
  it('el editor muestra los dos campos de dispositivos con sus defaults', () => {
    renderEditor();
    expect((screen.getByLabelText(/iOS devices/i) as HTMLInputElement).value).toBe('iPhone XR, iPhone 11');
    expect((screen.getByLabelText(/Android devices/i) as HTMLInputElement).value).toBe('Redmi Note 11 Pro, Moto g35 5G');
  });

  it('parseDeviceList trocea, recorta y descarta vacios', () => {
    expect(parseDeviceList('  Pixel 8 ,, Galaxy S24  ', IOS_DEVICES)).toEqual(['Pixel 8', 'Galaxy S24']);
  });

  it('parseDeviceList cae al fallback con el campo vacio', () => {
    expect(parseDeviceList('   ', IOS_DEVICES)).toEqual(['iPhone XR', 'iPhone 11']);
  });
});
```

**Antes de escribirlo, leer `src/components/ProfileEditor.test.tsx`** y reutilizar su helper de render; si no existe, crearlo envolviendo `<ProfileEditor onClose={() => {}} />` en `<I18nProvider>`, con `localStorage.clear()` en `beforeEach`.

- [ ] **Step 2: Ejecutar el test y verificar que falla**

Run: `npx vitest run src/components/ProfileEditor.test.tsx`
Expected: FAIL — `parseDeviceList` no existe y los campos no están en el editor.

- [ ] **Step 3: Añadir los campos al perfil**

En `src/types/context.ts`, dentro de `ProjectProfile` tras `testDataConventions`:

```ts
  /** Dispositivos iOS disponibles para probar, separados por comas. */
  iosDevices: string;
  /** Dispositivos Android disponibles para probar, separados por comas. */
  androidDevices: string;
```

Y en `DEFAULT_PROFILE`, tras `testDataConventions`:

```ts
  iosDevices: 'iPhone XR, iPhone 11',
  androidDevices: 'Redmi Note 11 Pro, Moto g35 5G',
```

Al final del mismo fichero:

```ts
/**
 * Trocea una lista de dispositivos separada por comas. Un campo vacio cae al
 * listado por defecto en vez de dejar el desplegable sin opciones — mismo
 * criterio que el resto del perfil, donde un campo vaciado no rompe nada.
 */
export function parseDeviceList(value: string, fallback: readonly { label: string }[]): string[] {
  const parsed = value.split(',').map((s) => s.trim()).filter(Boolean);
  return parsed.length > 0 ? parsed : fallback.map((d) => d.label);
}
```

- [ ] **Step 4: Añadir las 2 claves i18n**

`src/i18n/es.json`:
```json
  "profile.iosDevices": "Dispositivos iOS",
  "profile.androidDevices": "Dispositivos Android",
```

`src/i18n/en.json`:
```json
  "profile.iosDevices": "iOS devices",
  "profile.androidDevices": "Android devices",
```

- [ ] **Step 5: Añadir los campos al `ProfileEditor`**

En `src/components/ProfileEditor.tsx`, añadir al final del array `FIELDS` (`:6-17`):

```ts
  { key: 'iosDevices', labelKey: 'profile.iosDevices' },
  { key: 'androidDevices', labelKey: 'profile.androidDevices' },
```

No hace falta nada más: el editor ya itera sobre `FIELDS` y ambos son campos de una línea.

- [ ] **Step 6: Consumirlos en el Bug Report**

En `src/components/BugReportTool.tsx`:

Cambiar el import (`:9`) para seguir trayendo `IOS_DEVICES` y `ANDROID_DEVICES` (son la fuente del fallback) y añadir `import { parseDeviceList } from '../types/context';`.

Dentro del componente, tras la desestructuración de props (`:69`):

```tsx
  const iosDevices = parseDeviceList(profile?.iosDevices ?? '', IOS_DEVICES);
  const androidDevices = parseDeviceList(profile?.androidDevices ?? '', ANDROID_DEVICES);
```

En el cambio de plataforma (`:243-244`):

```tsx
      if (p === 'app-ios') device = iosDevices[0];
      else if (p === 'app-android') device = androidDevices[0];
```

Ese bloque vive dentro de un callback: añadir `iosDevices` y `androidDevices` a su array de dependencias si lo tiene.

En el desplegable (`:344-352`):

```tsx
                  {(formData.platform === 'app-ios' ? iosDevices : androidDevices).map((label) => (
                    <option key={label} value={label}>{label}</option>
                  ))}
```

- [ ] **Step 7: Ejecutar los tests y verificar que pasan**

Run: `npx vitest run src/components/ProfileEditor.test.tsx && npx vitest run && npm run typecheck`
Expected: todo en verde. Claves i18n: 297 → **299**.

- [ ] **Step 8: Commit**

```bash
git add src/types/context.ts src/components/ProfileEditor.tsx src/components/ProfileEditor.test.tsx src/components/BugReportTool.tsx src/i18n/es.json src/i18n/en.json
git commit -m "feat(profile): dispositivos iOS y Android configurables"
```

---

## Task 7: Sincronizar la documentación

**Files:**
- Modify: `AGENTS.md`
- Modify: `README.md`

**Interfaces:** ninguna — es la tarea de cierre.

**Todas las superficies de documentación que hay que tocar están enumeradas aquí. No hay más, y no hay menos.** Un plan anterior de este repo se dejó fuera la tabla de tests y las secciones de referencia, y el README acabó contradiciendo a AGENTS.md.

- [ ] **Step 1: Medir los números reales antes de escribirlos**

Run:
```bash
npx vitest run 2>&1 | tail -5
node -e "console.log(Object.keys(require('./src/i18n/es.json')).length)"
```

Apuntar el número exacto de tests, de ficheros y de claves i18n. **Usar esos números en los pasos siguientes, no los estimados de este plan.** Los estimados del plan son 556 → ~590 tests, 56 → 59 ficheros, 285 → 299 claves; si no cuadran, mandan los medidos.

- [ ] **Step 2: Actualizar el inventario de tests de `AGENTS.md`**

- Añadir dos filas nuevas a la tabla (la que contiene la fila de `src/hooks/useRegressions.test.ts` en `:54`): una para `src/hooks/useSchema.test.ts` y otra para `src/components/RegressionSchemaEditor.test.tsx`, describiendo lo que cubren con el mismo nivel de detalle que las vecinas.
- Actualizar la fila de `src/hooks/useRegressions.test.ts` (`:54`) con el recuento nuevo y los casos nuevos (guardián pre-esquema, campo huérfano, plataforma huérfana, ticket nuevo con campo de usuario, plataformas del esquema).
- Actualizar las filas de `RegressionCard.test.tsx`, `RegressionTracker.test.tsx` y `ProfileEditor.test.tsx` con sus recuentos y casos nuevos.
- Actualizar **`AGENTS.md:78`**: `**Total: N tests across M files.**` con los valores medidos en el Step 1.

- [ ] **Step 3: Actualizar las secciones de referencia de `AGENTS.md`**

- **`:90` (Settings persistence):** añadir que el esquema configurable de los trackers vive en `acgen_schema` (`STORAGE_KEYS.SCHEMA`), y que sin esa clave la app usa `DEFAULT_SCHEMA`, que codifica la configuración cableada de siempre.
- **`:137` (tabla de herramientas):** añadir `useSchema.ts` y `RegressionSchemaEditor.tsx` a los key files de la fila del Regression Tracker.
- **`:248-257` (sección Regression Tracker):** reescribir los pasajes que describen los campos del ticket y las plataformas como fijos. Deben decir que salen del esquema, que los ids son claves de almacenamiento, que ocultar no borra y que los campos y plataformas retirados del esquema quedan huérfanos pero intactos. Añadir que la celda-enlace es la primera columna visible.
- **`:386` (el aviso de fases congeladas):** ya no es cierto tal cual. Sustituirlo por: la Fase 4 está hecha, la Fase 5 (esquema del Sprint Tracker) sigue pendiente y su diseño está en `docs/superpowers/specs/2026-08-14-esquemas-trackers-design.md`.
- **`:388` (Pending items):** añadir la Fase 5 como pendiente. No retirar ninguno de los existentes: esta rama no cierra ninguno de ellos.

- [ ] **Step 4: Añadir la fila de historial de evolución en `AGENTS.md`**

Añadir una fila al final de la tabla de "Evolution history" (tras la de `:440`), con fecha 2026-08-14, describiendo: la clave `acgen_schema` y el hook `useSchema` sin contexto de React (y por qué: `useLocalStorage` ya sincroniza en el mismo tab); `RegressionTicket` keyed y las seis duplicaciones colapsadas; renombrar/añadir/ocultar; que ocultar conserva los datos; el guardián pre-esquema; los dispositivos movidos al perfil; el recuento de claves i18n y de tests medidos en el Step 1.

**No escribir en esa fila ninguna afirmación de verificación que no se haya hecho.** Si no se ha abierto un navegador contra el build de producción, la fila no puede decir que se haya hecho. Describir solo lo que la suite y el typecheck respaldan; la verificación manual, si ocurre, se añade después y por separado.

- [ ] **Step 5: Actualizar `README.md`**

- **`:25`** (descripción del Regression Tracker): la lista de columnas `(Ticket, Fecha, Prioridad, Creador, Squad, Status)` pasa a describirse como configurable — esos son los valores por defecto, y se pueden renombrar, añadir y ocultar desde el botón "Columnas".
- **`:69`** (sección Regression Tracker): mismo tratamiento, con una frase sobre que ocultar conserva los datos.
- **`:92`**: `| Tests | Vitest + React Testing Library (N tests / M files) |` con los valores medidos.
- **`:162`**: añadir `useSchema` a la lista de hooks.
- Buscar además cualquier mención a los dispositivos del Bug Report y anotar que ahora salen del perfil.

- [ ] **Step 6: Verificar que no queda ninguna cifra contradictoria**

Run:
```bash
grep -rn "556\|285 claves\|56 files\|56 ficheros" AGENTS.md README.md
```
Expected: **cero coincidencias** que se refieran al estado actual (las filas históricas de la tabla de evolución sí pueden y deben conservar sus cifras de entonces).

- [ ] **Step 7: Verificación final completa**

Run: `npm run typecheck && npx vitest run && npm run lint && npm run build`
Expected: los cuatro en verde.

- [ ] **Step 8: Commit**

```bash
git add AGENTS.md README.md
git commit -m "docs: sincroniza AGENTS y README con el esquema de Regression"
```

---

## Auto-revisión del plan

**Cobertura del spec.** Cada requisito de la sección "Fase 4" del spec tiene tarea: modelo y `DEFAULT_SCHEMA` (Task 1), almacenamiento y fallback por sección (Task 1), ticket keyed y las seis duplicaciones (Task 2), preservación de huérfanos (Task 2), búsqueda y recuento solo visibles (Tasks 3 y 4), anchos con fallback (Task 3), guard de pestaña activa (Task 4), editor con renombrar/añadir/ocultar, reset acotado y guard de "al menos uno visible" (Task 5), dispositivos en el perfil (Task 6), documentación (Task 7). Los tests que el spec exige nominalmente están todos escritos, incluidos los dos guardianes.

**Sin marcadores de posición.** Cada paso de código lleva el código real. Los dos únicos puntos donde el plan dice "leer el fichero existente primero" son los helpers de render de dos ficheros de test que ya existen y cuya forma exacta no está en este plan; en ambos casos se da la alternativa completa por si no hay helper reutilizable.

**Consistencia de tipos.** `SchemaEntry`, `TrackerSchema`, `DEFAULT_SCHEMA`, `resolveLabel` y `visibleEntries` se definen en la Task 1 y se usan con esas firmas exactas en las Tasks 2-5. `ticketRowHasContent(t, fieldIds)` y `filledTicketCount(r, fieldIds)` se redefinen en la Task 2 y se llaman así en la Task 3. `onUpdateTicket` cambia a `field: string` en la Task 3 y la Task 4 le pasa `field` sin tipar de más. `parseDeviceList` se define y se consume dentro de la Task 6.

**Riesgo asumido y deliberado:** al final de la Task 2 el árbol no compila, porque el cambio de tipo de `RegressionTicket` alcanza a tres ficheros y se reparte en tres commits. Las Tasks 3 y 4 lo cierran, y el Step 7 de la Task 4 exige typecheck limpio antes de seguir.
