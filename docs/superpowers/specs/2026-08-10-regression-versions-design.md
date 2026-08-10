# Regression Tracker: regresiones versionadas con tickets desplegables

**Fecha:** 2026-08-10
**Estado:** Aprobado por Jorge (diseño validado sección a sección)

## Contexto

Cada semana llega una hoja de Excel con los casos de regresión, alternando
plataforma (una semana WEB, la siguiente APPS). Durante cada revisión se
encuentran bugs y se crean tickets de incidencia (típicamente 6-10, a veces 0).
El tracker actual —un spreadsheet libre de 20×6 por pestaña— no relaciona los
tickets con la regresión concreta a la que pertenecen.

Objetivo: que cada pestaña (APPS/WEB) sea una **lista de regresiones
versionadas** (1.0.0, 2.0.0, …), cada una con la URL de su Excel y, desplegable
debajo, **sus** tickets de incidencia — control de qué versión se está
revisando y qué tickets pertenecen solo a ella.

## Decisiones de producto (validadas con Jorge)

1. La nueva estructura **sustituye** al grid libre 20×6 de APPS/WEB.
2. Columna Ticket = **celda-enlace como hoy**: pegar URL o `Nombre - URL`
   (SnapLink), nombre en azul, Ctrl+click / ↗ abren. Sin base URL configurable.
3. Fecha, Prioridad, Creador y Squad: **texto libre** (sin selects ni pickers).
4. Archivado **por regresión** (no de tablero completo).
5. Datos actuales: **historial antiguo conservado y visible**; el contenido de
   los grids activos queda huérfano-pero-intacto en localStorage; las pestañas
   arrancan vacías con el nuevo formato.
6. Cabecera de regresión: **Versión + URL + Fecha editable** (fecha precargada
   con hoy).
7. Filas de tickets: **3 vacías al crear** la regresión, botón "+ Añadir
   ticket" (de una en una), × por fila para borrar.

## Modelo de datos (`useRegressions.ts`)

```ts
interface RegressionTicket {
  id: string;          // crypto.randomUUID()
  ticket: string;      // celda-enlace: "PROJ-123 - https://..." o URL sola
  fecha: string;       // texto libre
  prioridad: string;   // texto libre
  creador: string;     // texto libre
  squad: string;       // texto libre
}

interface Regression {
  id: string;
  version: string;     // "1.0.0" — obligatorio (trim no vacío)
  url: string;         // URL del Excel; puede estar vacía y añadirse después
  fecha: string;       // editable; por defecto localTodayISO()
  tickets: RegressionTicket[];
}

// Historial: unión discriminada por presencia de campo
interface ArchivedRegression {            // formato ANTIGUO, se conserva tal cual
  id: string; name: string; archivedAt: string;
  board: Record<PlatformId, string[][]>;
}
interface ArchivedRegressionEntry {       // formato NUEVO
  id: string; archivedAt: string;
  platform: PlatformId;
  regression: Regression;
}
type ArchivedItem = ArchivedRegression | ArchivedRegressionEntry;

interface RegressionState {
  board?: Record<PlatformId, string[][]>; // LEGACY: se hidrata y re-persiste
                                          // intacto, nunca se renderiza
  regressions: Record<PlatformId, Regression[]>;
  archived: ArchivedItem[];
}
```

- **Misma clave `acgen_regressions`.** Al hidratar se conserva `board` (y
  cualquier snapshot antiguo de `archived`) y se re-persiste intacto — criterio
  huérfano-pero-intacto ya usado con los datos de Android. `backup.ts` no
  cambia: la clave ya está cubierta.
- Plataformas sin cambios: `PlatformId = 'ios' | 'webDesktop'` → APPS / WEB.
- Persistencia con el patrón actual: efecto con guarda de identidad
  (`lastPersisted`), `try/catch` en `persist`.
- API del hook (sustituye a la de grid): `addRegression(platform, {version,
  url, fecha})` (crea con 3 tickets vacíos, inserta al principio),
  `updateRegression(platform, id, patch)`, `deleteRegression(platform, id)`,
  `updateTicket(platform, regId, ticketId, field, value)`,
  `addTicket(platform, regId)`, `deleteTicket(platform, regId, ticketId)`,
  `archiveRegression(platform, id)`, `deleteArchived(id)`.

## UI y componentes

**Vista principal** (`RegressionTracker.tsx`, reescrito):

- Pestañas APPS / WEB arriba (estilo `.sprint-tabs`) + enlace **+ SnapLink**
  conservado. El buscador del grid desaparece con él (YAGNI con 2-4
  regresiones activas por pestaña).
- Botón **"+ Nueva regresión"** → formulario inline: Versión, URL, Fecha
  (precargada con hoy). Crear deshabilitado si la versión está vacía tras
  `trim`. La nueva regresión aparece **arriba** de la lista.
- Lista de tarjetas `RegressionCard.tsx` (componente nuevo):
  - **Cabecera** (siempre visible): chevron ▸/▾ para desplegar, versión en
    negrita, enlace del Excel (celda-enlace), fecha, badge con nº de tickets
    no vacíos (filas con algún campo con contenido tras `trim`), botones **Editar** (inline: versión/URL/fecha, patrón del
    rename de sprints), **Archivar** y **Eliminar** (ambos con `confirm`).
  - **Desplegada**: tabla de 5 columnas — Ticket, Fecha, Prioridad, Creador,
    Squad — más columna estrecha con **×** por fila (confirm solo si la fila
    tiene contenido). Debajo, **"+ Añadir ticket"**. Columna Ticket con
    comportamiento celda-enlace.
- Estado desplegado/colapsado: solo UI, no se persiste.

**Celda-enlace compartida:** `URL_CELL_PATTERN` y los helpers de modo url
(`getLinkUrl`/`getLinkName`) se extraen de `TrackerGrid.tsx` a
`src/utils/trackerLinks.ts`. `TrackerGrid` los importa de ahí (cero cambio de
comportamiento — Sprint Tracker intacto) y la tabla de tickets los reutiliza.
La clase CSS `.cell-open-link` (botón ↗) ya es global y sirve tal cual.

## Archivado e historial

- **Archivar** (por tarjeta, con confirm): mueve `{platform, regression,
  archivedAt}` al principio de `archived` y la quita de la lista activa.
  **Permitido con 0 tickets rellenos** — una regresión limpia es un resultado
  real (difiere a propósito del bloqueo actual de tablero vacío;
  `boardHasContent` desaparece con el grid).
- **Historial** (misma pantalla actual): lista mixta. Entradas antiguas
  (`board`) se abren con el `TrackerGrid` readonly como hoy. Entradas nuevas
  se etiquetan "APPS · 1.0.0" / "WEB · 2.0.0" y se abren como `RegressionCard`
  desplegada de solo lectura (inputs `readOnly`, sin añadir/borrar, enlaces
  funcionando). Borrado por entrada con confirm, ambos formatos.

## Casos borde

- Versión obligatoria al crear; URL y fecha corregibles después vía Editar.
- Borrar la última fila de tickets deja la tabla vacía (el botón añadir
  siempre está). Las 3 filas iniciales solo se crean con la regresión.
- Hidratación defensiva: JSON corrupto → estado vacío (patrón actual);
  entradas de `archived` se discriminan por presencia de `board` vs
  `regression`.
- i18n: claves nuevas en ES/EN con paridad (test de paridad existente cubre).

## Testing (TDD, convención del proyecto)

- `useRegressions.test.ts`: crear/editar/borrar/archivar por regresión,
  tickets (añadir/editar/borrar), hidratación que conserva `board` legacy y
  archivados mixtos, versión-obligatoria, orden más-reciente-primero.
- `trackerLinks.test.ts` (nuevo): patrones movidos; los tests existentes de
  `TrackerGrid`/Sprint Tracker deben seguir en verde sin cambios.
- `RegressionCard.test.tsx` (nuevo): desplegar/colapsar, añadir/borrar filas,
  celda-enlace en Ticket y URL de cabecera, modo readonly, editar cabecera.
- `RegressionTracker.test.tsx`: pestañas, formulario de creación, lista,
  historial mixto (entrada legacy abre grid, entrada nueva abre tarjeta).
- Verificación final en Chrome real contra build de producción
  (`vite preview`), como en los últimos ciclos.
