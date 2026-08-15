# Fase 5 — Esquema configurable del Sprint Tracker — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que las pestañas y las columnas del Sprint Tracker se puedan renombrar, ocultar y añadir desde la UI, igual que la Fase 4 hizo con los campos y plataformas del Regression Tracker.

**Architecture:** Se añade una sección `sprint` a `TrackerSchema` (que la Fase 4 ya dejó reservada y protegida en el write path de `useSchema()`). `useSprints()` deriva sus pestañas del esquema en vez de una unión cerrada. `TrackerGrid` deja de recibir `tabHeaders: Record<T, string[]>` y pasa a recibir `tabColumns: Record<T, {label, dataIndex}[]>`: el llamante resuelve etiquetas, filtra ocultas y calcula índices, y **`TrackerGrid` no sabe nada del esquema**. La invariante que hace segura toda la fase es que el grid es posicional (`string[][]`), así que el índice del array de datos es la identidad de la columna en todo — anchos, refs, `data-col`, letra de columna — y solo la navegación con flechas se mueve por posición visual.

**Tech Stack:** React 18 + TypeScript, Vite, Vitest + @testing-library/react, i18n propio (`src/i18n/{es,en}.json`), persistencia en `localStorage` vía `useLocalStorage`.

## Global Constraints

- **Cero migración de datos.** Sin clave `acgen_schema` guardada, el render debe ser byte-idéntico al de hoy. Es el criterio de merge, fijado por un test guardián por fase.
- **Ocultar nunca borra.** Los datos de una pestaña o columna oculta siguen en `localStorage` y reaparecen al mostrarla. Convención "huérfano pero intacto", ya usada por el `board` legacy y por la Fase 4.
- **Ni borrar ni reordenar columnas del Sprint.** Fuera de alcance por decisión del spec: ambas exigirían migrar el grid posicional a filas keyed. Ocultar cubre el caso práctico.
- **El índice de datos es la identidad.** Anchos (`${tab}-${dataIndex}`), `cellRefs`, `data-col`, `onUpdateGridCell` y `colToLetter` van SIEMPRE por índice de datos, nunca por posición visual. Solo ←/→ usa posición visual.
- **`colCount` manda sobre `headers`.** `Math.max(headers.length, grid[0]?.length ?? 0, 1)`. Si la lista de columnas se derivara solo de `headers`, la pestaña JSD pasaría de 6 columnas a 3 y los datos escritos en D/E/F desaparecerían de la pantalla.
- **Renombrar a cadena vacía se ignora** y conserva la etiqueta anterior (`SchemaEntryRow` ya lo hace con su borrador local).
- **Guard de al menos uno visible** por lista: al menos una pestaña visible, y al menos una columna visible dentro de cada pestaña.
- **Ids nuevos con `crypto.randomUUID()`**; los ids por defecto son los históricos y NUNCA cambian.
- **Paridad i18n ES/EN exacta**, fijada por `src/i18n/keyParity.test.ts`. Línea base: 301 claves.
- **Idioma en tests:** `detectLang()` lee `navigator.language` y jsdom devuelve `en-US`, así que la app renderiza en **inglés** en los tests salvo que se fuerce lo contrario.
- **`@testing-library/user-event` NO está instalado** y no se instala: el proyecto usa `fireEvent` + `waitFor` de `@testing-library/react`. Los fragmentos de test de este plan que escriben `userEvent.setup()` / `user.type()` / `user.click()` son un error de redacción — tradúcelos a `fireEvent.change()` / `fireEvent.click()` / `fireEvent.blur()`, mismas aserciones. Descubierto en la Task 2.
- **Línea base verificada** el 2026-08-15 con `npx vitest run`: 603 tests en 58 ficheros, todos verdes.

---

### Task 1: Sección `sprint` en el esquema

**Files:**
- Modify: `src/types/schema.ts`
- Modify: `src/hooks/useSchema.ts:22-47`
- Modify: `src/i18n/es.json`, `src/i18n/en.json`
- Test: `src/hooks/useSchema.test.ts`

**Interfaces:**
- Consumes: nada (primera tarea).
- Produces:
  - `TrackerSchema['sprint']: { tabs: SprintTabSchema[] }`
  - `interface SprintTabSchema extends SchemaEntry { columns: SchemaEntry[] }`
  - `DEFAULT_SCHEMA.sprint` con las 5 pestañas históricas y sus columnas.
  - `useSchema()` devuelve `schema.sprint` siempre poblado (fallback por lista).
  - `visibleEntries<T extends SchemaEntry>(entries?: T[]): T[]` — genérica, conserva el subtipo.

- [ ] **Step 1: Escribe el test que falla**

En `src/hooks/useSchema.test.ts`, añade:

```ts
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
```

- [ ] **Step 2: Ejecuta el test y comprueba que falla**

Run: `npx vitest run src/hooks/useSchema.test.ts`
Expected: FAIL — `Cannot read properties of undefined (reading 'tabs')`.

- [ ] **Step 3: Añade el tipo y el default**

En `src/types/schema.ts`, tras `SchemaEntry`:

```ts
/** Una pestana del Sprint Tracker: una entrada configurable que ademas lleva
 *  su propia lista de columnas. El grid es posicional, asi que el indice de
 *  `columns` es la columna de datos y por eso no se puede reordenar ni borrar. */
export interface SprintTabSchema extends SchemaEntry {
  columns: SchemaEntry[];
}
```

Extiende `TrackerSchema`:

```ts
export interface TrackerSchema {
  version: 1;
  regression: {
    ticketFields: SchemaEntry[];
    platforms: SchemaEntry[];
  };
  sprint: {
    tabs: SprintTabSchema[];
  };
}
```

Y añade a `DEFAULT_SCHEMA`, tras `regression` (Ticket, Squad, ReOpen y JSD se escriben igual en ES y EN: `label` literal, sin gastar par de traduccion):

```ts
  sprint: {
    tabs: [
      {
        id: 'resolved', labelKey: 'sprint.tabResolved',
        columns: [
          { id: 'ticket', label: 'Ticket' },
          { id: 'fecha', labelKey: 'sprint.colFecha' },
          { id: 'prioridad', labelKey: 'sprint.colPrioridad' },
          { id: 'autor', labelKey: 'sprint.colAutor' },
          { id: 'squad', label: 'Squad' },
        ],
      },
      {
        id: 'created', labelKey: 'sprint.tabCreated',
        columns: [
          { id: 'ticket', label: 'Ticket' },
          { id: 'fecha', labelKey: 'sprint.colFecha' },
          { id: 'prioridad', labelKey: 'sprint.colPrioridad' },
          { id: 'autor', labelKey: 'sprint.colAutor' },
          { id: 'squad', label: 'Squad' },
        ],
      },
      {
        id: 'reopened', label: 'ReOpen',
        columns: [
          { id: 'ticket', label: 'Ticket' },
          { id: 'fecha', labelKey: 'sprint.colFecha' },
          { id: 'motivo', labelKey: 'sprint.colMotivo' },
          { id: 'squad', label: 'Squad' },
        ],
      },
      {
        id: 'highPriority', labelKey: 'sprint.tabHighPriority',
        columns: [
          { id: 'ticket', label: 'Ticket' },
          { id: 'fecha', labelKey: 'sprint.colFecha' },
          { id: 'motivo', labelKey: 'sprint.colMotivo' },
          { id: 'squad', label: 'Squad' },
        ],
      },
      {
        id: 'jsd', label: 'JSD',
        columns: [
          { id: 'jsd', label: 'JSD' },
          { id: 'fecha', labelKey: 'sprint.colFecha' },
          { id: 'motivo', labelKey: 'sprint.colMotivo' },
        ],
      },
    ],
  },
```

- [ ] **Step 4: Extiende el fallback de `useSchema()`**

En `src/hooks/useSchema.ts`, añade `const sprint = stored?.sprint;` junto a `regression`, y dentro del `useMemo` añade la sección, con la misma tolerancia a no-array que ya tiene `regression`:

```ts
    sprint: {
      tabs: Array.isArray(sprint?.tabs) ? sprint.tabs : DEFAULT_SCHEMA.sprint.tabs,
    },
```

Añade `sprint` a las dependencias del `useMemo`: `}), [regression, sprint]);`

Actualiza el comentario de cabecera del fichero: donde dice *"la Fase 5 anadira una seccion `sprint`"*, pon *"la seccion `sprint` la anadio la Fase 5; el fallback por seccion es lo que dejo que los esquemas escritos por la Fase 4 (sin `sprint`) siguieran funcionando"*.

- [ ] **Step 5: Haz genérica `visibleEntries`**

Hoy devuelve `SchemaEntry[]`, así que filtrar `SprintTabSchema[]` con ella **perdería la propiedad `columns`** y la Task 4 no compilaría. En `src/types/schema.ts`, misma implementación, firma genérica:

```ts
export function visibleEntries<T extends SchemaEntry>(entries?: T[]): T[] {
  return (entries ?? []).filter((e) => !e.hidden);
}
```

Compatible hacia atrás: los llamantes de la Fase 4 pasan `SchemaEntry[]` y siguen recibiendo `SchemaEntry[]`.

- [ ] **Step 6: Añade las 7 claves i18n de los rótulos por defecto**

En `src/i18n/es.json`, junto al bloque `sprint.*`:

```json
  "sprint.tabResolved": "Resueltos",
  "sprint.tabCreated": "Creados",
  "sprint.tabHighPriority": "Prioridad Alta",
  "sprint.colFecha": "Fecha",
  "sprint.colPrioridad": "Prioridad",
  "sprint.colAutor": "Autor",
  "sprint.colMotivo": "Motivo",
```

En `src/i18n/en.json`, en la misma posición relativa:

```json
  "sprint.tabResolved": "Resolved",
  "sprint.tabCreated": "Created",
  "sprint.tabHighPriority": "High Priority",
  "sprint.colFecha": "Date",
  "sprint.colPrioridad": "Priority",
  "sprint.colAutor": "Author",
  "sprint.colMotivo": "Reason",
```

- [ ] **Step 7: Ejecuta los tests y comprueba que pasan**

Run: `npx vitest run src/hooks/useSchema.test.ts src/i18n/keyParity.test.ts`
Expected: PASS. Paridad 308 = 308.

- [ ] **Step 8: Typecheck y commit**

```bash
npx tsc --noEmit
git add src/types/schema.ts src/hooks/useSchema.ts src/i18n/es.json src/i18n/en.json src/hooks/useSchema.test.ts
git commit -m "feat(schema): seccion sprint con las cinco pestanas por defecto"
```

---

### Task 2: `TrackerGrid` pasa de `tabHeaders` a `tabColumns`

Refactor puro: los dos llamantes pasan todas las columnas visibles, así que **el comportamiento no cambia** — salvo el arreglo de `colCount`, que es la corrección de un bug existente (la pestaña JSD pinta hoy 3 cabeceras sobre 6 columnas de datos).

**Files:**
- Modify: `src/components/TrackerGrid.tsx:35-48` (props), `:65` (safeTab), `:118,137,341` (anchos), `:144-161` (colCount + displayColIndices), `:340,352,376,418` (los cuatro `Array.from({length: colCount})`), `:383` (etiqueta), `:472-475` (flechas)
- Modify: `src/components/SprintDashboard.tsx:37-49` (llamada)
- Modify: `src/components/RegressionTracker.tsx:88` (llamada legacy)
- Test: `src/components/TrackerGrid.test.tsx`

**Interfaces:**
- Consumes: nada de la Task 1 — este refactor es independiente del esquema.
- Produces:
  - `interface TrackerColumn { label: string; dataIndex: number }`
  - Prop `tabColumns: Record<T, TrackerColumn[]>` en lugar de `tabHeaders: Record<T, string[]>`.
  - Contrato: el llamante YA ha filtrado las ocultas; lo que llega en `tabColumns` se pinta entero, en ese orden. `dataIndex` es el índice en el array de datos de la fila.

- [ ] **Step 1: Escribe los tests que fallan**

En `src/components/TrackerGrid.test.tsx`, adapta el helper `renderGrid` (línea 17) y añade los casos nuevos:

```ts
// Sustituye la linea `tabHeaders: {...}` del helper por:
tabColumns: {
  one: [{ label: 'Ticket', dataIndex: 0 }, { label: 'Fecha', dataIndex: 1 }],
  two: [{ label: 'Ticket', dataIndex: 0 }, { label: 'Motivo', dataIndex: 1 }],
},
```

```ts
it('ocultar una columna intermedia mantiene el ancho ligado a su columna de datos', () => {
  // El llamante omite dataIndex 1: quedan las columnas de datos 0 y 2.
  localStorage.setItem('test-widths', JSON.stringify({ 'one-2': 300 }));
  renderGrid({
    tabColumns: { one: [{ label: 'A', dataIndex: 0 }, { label: 'C', dataIndex: 2 }], two: [] },
    tabGrid: { one: [['a', 'b', 'c']], two: [] },
  });
  const cols = document.querySelectorAll('colgroup col');
  // col[0] es la columna del numero de fila (44px fija).
  expect((cols[2] as HTMLElement).style.width).toBe('300px');
});

it('las letras de columna van por indice de datos, no por posicion visual', () => {
  renderGrid({
    tabColumns: { one: [{ label: 'A', dataIndex: 0 }, { label: 'C', dataIndex: 2 }], two: [] },
    tabGrid: { one: [['a', 'b', 'c']], two: [] },
  });
  const letters = Array.from(document.querySelectorAll('thead tr:first-child th'))
    .slice(1).map((th) => th.textContent);
  expect(letters).toEqual(['A', 'C']);
});

it('la flecha derecha salta la columna oculta', async () => {
  const user = userEvent.setup();
  renderGrid({
    tabColumns: { one: [{ label: 'A', dataIndex: 0 }, { label: 'C', dataIndex: 2 }], two: [] },
    tabGrid: { one: [['a', 'b', 'c']], two: [] },
  });
  const first = document.querySelector('input[data-row="0"][data-col="0"]') as HTMLInputElement;
  first.focus();
  first.setSelectionRange(first.value.length, first.value.length);
  await user.keyboard('{ArrowRight}');
  expect(document.activeElement).toBe(document.querySelector('input[data-row="0"][data-col="2"]'));
});

it('las columnas de datos sin cabecera se siguen pintando', () => {
  // La trampa de la fase: 3 cabeceras sobre 6 columnas de datos (el caso JSD).
  renderGrid({
    tabColumns: { one: [{ label: 'A', dataIndex: 0 }, { label: 'B', dataIndex: 1 }, { label: 'C', dataIndex: 2 }], two: [] },
    tabGrid: { one: [['a', 'b', 'c', 'd', 'e', 'f']], two: [] },
  });
  expect(document.querySelectorAll('tbody input').length).toBe(6);
  expect((document.querySelector('input[data-col="5"]') as HTMLInputElement).value).toBe('f');
});

it('la busqueda sigue encontrando por columnas ocultas', async () => {
  // Decision de producto de Jorge (2026-08-15): ocultar es una preferencia de
  // vista, no un borrado, asi que la busqueda sigue mirando la fila entera.
  // A proposito DISTINTO del Regression Tracker, donde la Fase 4 dejo de
  // buscar por campos ocultos. Este test existe para que nadie lo "arregle".
  const user = userEvent.setup();
  renderGrid({
    tabColumns: { one: [{ label: 'A', dataIndex: 0 }], two: [] },
    tabGrid: { one: [['visible', 'oculto'], ['otra', 'fila']], two: [] },
  });
  await user.type(screen.getByPlaceholderText('buscar'), 'oculto');
  await waitFor(() => expect(document.querySelectorAll('tbody tr').length).toBe(1));
  // La fila sale, aunque la celda que casa no este a la vista.
  expect(screen.getByDisplayValue('visible')).toBeInTheDocument();
});
```

- [ ] **Step 2: Ejecuta y comprueba que falla**

Run: `npx vitest run src/components/TrackerGrid.test.tsx`
Expected: FAIL — la prop `tabColumns` no existe; los tests nuevos fallan y los viejos que pasaban `tabHeaders` también.

- [ ] **Step 3: Cambia las props y calcula las columnas visibles**

En `src/components/TrackerGrid.tsx`, exporta el tipo y sustituye la prop:

```ts
/** Una columna ya resuelta por el llamante: etiqueta a pintar e indice en el
 *  array de datos de la fila. El llamante YA filtro las ocultas — TrackerGrid
 *  pinta lo que recibe, en ese orden, y no sabe nada del esquema. */
export interface TrackerColumn {
  label: string;
  dataIndex: number;
}
```

En `TrackerGridProps`, `tabHeaders: Record<T, string[]>` → `tabColumns: Record<T, TrackerColumn[]>`. Renombra el parámetro desestructurado igual.

Tras `const [activeTab, setActiveTab] = useState<T>(tabs[0]);` (línea 65) añade el guard:

```ts
  // activeTab puede quedar apuntando a una pestana recien oculta o retirada del
  // esquema; sin esto, `tabColumns[activeTab]` seria undefined y el render caeria.
  const safeTab = tabs.includes(activeTab) ? activeTab : tabs[0];
```

Sustituye **todas** las lecturas de `activeTab` por `safeTab` salvo la comparación de la propia pestaña activa en la barra de pestañas (`activeTab === tab`, línea 246) y el `setActiveTab` del onClick. Son: `:118`, `:132` (dep del efecto), `:137`, `:144`, `:165`, `:228`, `:341`, `:455`, `:487`, `:493`.

Sustituye `colCount` (línea 145) y añade la lista de índices visibles:

```ts
  const columns = useMemo(() => tabColumns[safeTab] ?? [], [tabColumns, safeTab]);
  // colCount manda: las columnas de datos sin cabecera (la pestana JSD nace con
  // 6 columnas y solo 3 rotulos) se siguen pintando. Derivarlo solo de las
  // cabeceras haria desaparecer de la pantalla lo escrito en D, E y F.
  const colCount = Math.max(columns.length, grid[0]?.length ?? 0, 1);
  const displayColIndices = useMemo(() => {
    const named = columns.map((c) => c.dataIndex);
    // Los indices de datos mas alla de la ultima cabecera no tienen entrada en
    // el esquema y no se pueden ocultar: se anaden siempre al final.
    const maxNamed = named.length ? Math.max(...named) : -1;
    for (let i = maxNamed + 1; i < colCount; i++) named.push(i);
    return named;
  }, [columns, colCount]);
  const labelByIndex = useMemo(
    () => new Map(columns.map((c) => [c.dataIndex, c.label])),
    [columns],
  );
```

- [ ] **Step 4: Itera sobre `displayColIndices` en los cuatro sitios**

Sustituye los cuatro `Array.from({ length: colCount }, (_, ci) => ...)` por `displayColIndices.map((ci, posC) => ...)`:

- `<colgroup>` (línea 340): `{displayColIndices.map((ci) => { const w = colWidths[`${safeTab}-${ci}`]; return <col key={ci} style={w ? { width: w } : undefined} />; })}`
- fila de letras (línea 352): `{displayColIndices.map((ci) => (` — el contenido `{colToLetter(ci)}` y `startResize(e, ci)` no cambian, siguen yendo por índice de datos.
- fila de rótulos (línea 376): `{displayColIndices.map((ci) => (` y el contenido pasa a `{labelByIndex.get(ci) ?? ''}`.
- celdas del cuerpo (línea 418): `{displayColIndices.map((ci, posC) => {` — todo el interior (`getCellValue(ri, ci)`, `ci === 0`, `data-col={ci}`, `cellRefs` con `${ri}-${ci}`, `onUpdateGridCell(safeTab, ri, ci, ...)`) sigue igual, por índice de datos.

`handleAddRow` (línea 164) sigue usando `colCount`, correcto: la fila nueva nace con tantas celdas como columnas de datos.

- [ ] **Step 5: Navegación por posición visual (la búsqueda no cambia)**

En el `onKeyDown` (líneas 456-476), las flechas ←/→ pasan a moverse por posición visual — calcado de lo que ArrowUp/ArrowDown ya hacen con `displayRowIndices`:

```ts
                        onKeyDown={(e) => {
                          const key = e.key;
                          let nextPos = pos;
                          let nextPosC = posC;
                          if (key === 'ArrowUp') nextPos--;
                          else if (key === 'ArrowDown') nextPos++;
                          else if (key === 'ArrowLeft') {
                            const input = e.currentTarget as HTMLInputElement;
                            if (input.selectionStart !== 0 || input.selectionEnd !== 0) return;
                            nextPosC--;
                          } else if (key === 'ArrowRight') {
                            const input = e.currentTarget as HTMLInputElement;
                            const len = input.value.length;
                            if (input.selectionStart !== len || input.selectionEnd !== len) return;
                            nextPosC++;
                          } else return;
                          if (nextPos < 0 || nextPos >= displayRowIndices.length) return;
                          if (nextPosC < 0 || nextPosC >= displayColIndices.length) return;
                          e.preventDefault();
                          const tr = key === 'ArrowUp' || key === 'ArrowDown' ? displayRowIndices[nextPos] : ri;
                          const tc = displayColIndices[nextPosC];
                          cellRefs.current.get(`${tr}-${tc}`)?.focus();
                        }}
```

**`filteredRowIndices` (líneas 147-158) NO se toca.** La búsqueda sigue recorriendo la fila entera con `row.some(...)`, incluidas las columnas ocultas — decisión de producto de Jorge del 2026-08-15: ocultar es una preferencia de vista, no un borrado, y seguir encontrando lo que has ocultado es lo que se espera.

Esto es **deliberadamente distinto** del Regression Tracker, donde la Fase 4 sí dejó de buscar por campos ocultos. La divergencia está fijada por un test en el Step 1 y documentada en la Task 6; no la unifiques.

- [ ] **Step 6: Actualiza los dos llamantes sin cambiar su comportamiento**

En `src/components/SprintDashboard.tsx`, sustituye `tabHeaders={TAB_HEADERS}` por una derivación local (esto es temporal: la Task 4 lo reemplaza por el esquema):

```tsx
const TAB_COLUMNS: Record<TabId, TrackerColumn[]> = Object.fromEntries(
  (Object.entries(TAB_HEADERS) as [TabId, string[]][]).map(([tab, headers]) => [
    tab, headers.map((label, i) => ({ label, dataIndex: i })),
  ]),
) as Record<TabId, TrackerColumn[]>;
```

y pasa `tabColumns={TAB_COLUMNS}`.

En `src/components/RegressionTracker.tsx:88`, la llamada legacy (snapshots archivados del grid antiguo):

```tsx
            tabColumns={Object.fromEntries(platformIds.map((p) => [
              p, LEGACY_HEADERS.map((label, i) => ({ label, dataIndex: i })),
            ]))}
```

- [ ] **Step 7: Ejecuta la suite completa**

Run: `npx vitest run`
Expected: PASS.

**Churn esperado**, y solo este: cualquier test que construya la prop `tabHeaders`. El spec lo acotó a `TrackerGrid.test.tsx` (el helper `renderGrid`, línea 17, ya adaptado en el Step 1) y a los que rendericen `SprintDashboard` o `RegressionTracker`. Localízalos con:

```bash
grep -rln "tabHeaders" src/
```

Adáptalos al nuevo shape **sin tocar lo que afirman** — si un assert cambia de valor esperado, no es churn: es una regresión, párate y averigua por qué.

- [ ] **Step 8: Typecheck y commit**

```bash
npx tsc --noEmit
git add src/components/TrackerGrid.tsx src/components/TrackerGrid.test.tsx src/components/SprintDashboard.tsx src/components/RegressionTracker.tsx
git commit -m "refactor(grid): TrackerGrid recibe columnas resueltas, no cabeceras"
```

---

### Task 3: `useSprints` guiado por el esquema

**Files:**
- Modify: `src/hooks/useSprints.ts:7-47,57-70,81-92`
- Test: `src/hooks/useSprints.test.ts`

**Interfaces:**
- Consumes: `useSchema()` y `DEFAULT_SCHEMA.sprint` de la Task 1.
- Produces: `TabId = string`, `SprintJql = Record<TabId, string>`, `Sprint.tabGrid: Record<TabId, string[][]>`. La API pública del hook (nombres y aridad de `addSprint`, `updateTabJql`, `updateGridCell`, `setTabGrid`, `moveRow`, `deleteSprint`) **no cambia**.

- [ ] **Step 1: Escribe el test guardián que falla**

Este es **el test que decide si esto se mergea**. En `src/hooks/useSprints.test.ts`:

```ts
it('GUARDIAN: un payload pre-esquema hidrata identico sin clave acgen_schema', () => {
  localStorage.removeItem(STORAGE_KEYS.SCHEMA);
  localStorage.setItem('acgen_sprints', JSON.stringify([{
    id: 's1', name: 'Sprint 25', startDate: '2026-08-01', endDate: null, archived: false,
    jql: { resolved: 'q1', created: '', reopened: '', highPriority: '', jsd: '' },
    tabGrid: { resolved: [['ACG-1', '2026-08-01', 'Alta', 'jorge', 'QA']] },
  }]));
  const { result } = renderHook(() => useSprints());
  const s = result.current.sprints[0];
  expect(Object.keys(s.tabGrid).sort())
    .toEqual(['created', 'highPriority', 'jsd', 'reopened', 'resolved']);
  expect(s.tabGrid.resolved[0]).toEqual(['ACG-1', '2026-08-01', 'Alta', 'jorge', 'QA']);
  expect(s.tabGrid.created.length).toBe(20);
  expect(s.jql.resolved).toBe('q1');
});

it('una pestana retirada del esquema conserva su grid en el objeto guardado', () => {
  localStorage.setItem(STORAGE_KEYS.SCHEMA, JSON.stringify({
    version: 1,
    sprint: { tabs: [{ id: 'resolved', label: 'R', columns: [{ id: 'ticket', label: 'T' }] }] },
  }));
  localStorage.setItem('acgen_sprints', JSON.stringify([{
    id: 's1', name: 'S', startDate: '2026-08-01', endDate: null, archived: false,
    jql: {}, tabGrid: { resolved: [['a']], jsd: [['dato-huerfano']] },
  }]));
  const { result } = renderHook(() => useSprints());
  expect(result.current.sprints[0].tabGrid.jsd).toEqual([['dato-huerfano']]);
});

it('un sprint nuevo nace con una pestana anadida en el esquema', () => {
  localStorage.setItem(STORAGE_KEYS.SCHEMA, JSON.stringify({
    version: 1,
    sprint: { tabs: [
      { id: 'resolved', label: 'R', columns: [{ id: 'ticket', label: 'T' }] },
      { id: 'nueva', label: 'Nueva', columns: [{ id: 'ticket', label: 'T' }] },
    ] },
  }));
  const { result } = renderHook(() => useSprints());
  act(() => { result.current.addSprint('S1', '2026-08-01'); });
  expect(result.current.sprints[0].tabGrid.nueva.length).toBe(20);
  expect(result.current.sprints[0].jql.nueva).toBe('');
});
```

- [ ] **Step 2: Ejecuta y comprueba que falla**

Run: `npx vitest run src/hooks/useSprints.test.ts`
Expected: FAIL — el tercer test falla (`tabGrid.nueva` es `undefined`): hoy `emptyTabGrid()` devuelve las cinco literales.

- [ ] **Step 3: Abre los tipos y deriva del esquema**

En `src/hooks/useSprints.ts`, sustituye las líneas 7-47:

```ts
/** Abierto desde la Fase 5: las pestanas salen del esquema, no de una union
 *  cerrada. Las pestanas retiradas del esquema conservan su grid en el objeto
 *  guardado — convencion "huerfano pero intacto". */
export type TabId = string;
export type SprintJql = Record<TabId, string>;

export interface Sprint {
  id: string;
  name: string;
  startDate: string;
  endDate: string | null;
  archived: boolean;
  jql: SprintJql;
  tabGrid: Record<TabId, string[][]>;
}

function createEmptyGrid(rows: number = 20, cols: number = 6): string[][] {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => ''));
}

function emptyTabGrid(tabIds: string[]): Record<TabId, string[][]> {
  return Object.fromEntries(tabIds.map((id) => [id, createEmptyGrid()]));
}

function emptyJql(tabIds: string[]): SprintJql {
  return Object.fromEntries(tabIds.map((id) => [id, '']));
}
```

- [ ] **Step 4: Consume el esquema dentro del hook**

En `useSprints()`, añade la lectura del esquema al principio del cuerpo, igual que hace `useRegressions()`:

```ts
export function useSprints() {
  const [schema] = useSchema();
  const tabIds = useMemo(() => schema.sprint.tabs.map((t) => t.id), [schema]);
```

Importa `useSchema` y `useMemo`.

El backfill de la hidratación (línea 65) generaliza sin cambio de forma; solo pasa a leer del esquema. Como el estado inicial de `useState` solo corre en el mount, usa la lista de pestañas de ese momento — que es la correcta, porque el esquema se lee sincrónicamente de `localStorage`:

```ts
        tabGrid: { ...emptyTabGrid(tabIds), ...(s.tabGrid || {}) },
```

El spread pone `emptyTabGrid` primero y lo guardado después: las pestañas del esquema que el sprint no tenga nacen vacías, y las que el sprint tenga y el esquema no, **se conservan intactas**.

En `addSprint` (líneas 81-92), sustituye `jql: { ...EMPTY_JQL }` por `jql: emptyJql(tabIds)` y `tabGrid: emptyTabGrid()` por `tabGrid: emptyTabGrid(tabIds)`, y añade `tabIds` a las dependencias del `useCallback`.

Borra la constante `EMPTY_JQL`, que ya no tiene usos.

- [ ] **Step 5: Ejecuta los tests y comprueba que pasan**

Run: `npx vitest run src/hooks/useSprints.test.ts`
Expected: PASS, incluido el GUARDIAN.

- [ ] **Step 6: Typecheck, suite completa y commit**

```bash
npx tsc --noEmit && npx vitest run
git add src/hooks/useSprints.ts src/hooks/useSprints.test.ts
git commit -m "feat(sprint): pestanas del esquema en useSprints, huerfanas intactas"
```

---

### Task 4: `SprintDashboard` resuelve las columnas desde el esquema

**Files:**
- Modify: `src/components/SprintDashboard.tsx` (entero — desaparecen `TABS`, `TAB_LABELS`, `TAB_HEADERS`, `TAB_COLUMNS`)
- Test: `src/components/SprintDashboard.test.tsx` (crear si no existe)

**Interfaces:**
- Consumes: `useSchema()` + `SprintTabSchema` (Task 1), `TrackerColumn` (Task 2), `TabId = string` (Task 3).
- Produces: nada que consuman tareas posteriores salvo el hueco de la barra de herramientas, que la Task 5 rellena con el botón del editor.

- [ ] **Step 1: Escribe el test guardián que falla**

En `src/components/SprintDashboard.test.tsx`:

```tsx
it('GUARDIAN: sin clave acgen_schema pinta las pestanas y columnas de siempre', () => {
  localStorage.removeItem(STORAGE_KEYS.SCHEMA);
  render(<SprintDashboard sprint={makeSprint()} onUpdateGridCell={vi.fn()}
    onSetTabGrid={vi.fn()} onMoveRow={vi.fn()} onArchive={vi.fn()} />);
  // jsdom reporta en-US, asi que la app renderiza en ingles.
  ['Resolved', 'Created', 'ReOpen', 'High Priority', 'JSD']
    .forEach((label) => expect(screen.getByRole('button', { name: label })).toBeInTheDocument());
  ['Ticket', 'Date', 'Priority', 'Author', 'Squad']
    .forEach((h) => expect(screen.getByText(h)).toBeInTheDocument());
});

it('una columna oculta desaparece del render y su dato sigue guardado', async () => {
  localStorage.setItem(STORAGE_KEYS.SCHEMA, JSON.stringify({
    version: 1,
    sprint: { tabs: [{ id: 'resolved', label: 'R', columns: [
      { id: 'ticket', label: 'Ticket' },
      { id: 'fecha', label: 'Fecha', hidden: true },
      { id: 'squad', label: 'Squad' },
    ] }] },
  }));
  const sprint = makeSprint({ tabGrid: { resolved: [['ACG-1', '2026-08-01', 'QA']] } });
  render(<SprintDashboard sprint={sprint} onUpdateGridCell={vi.fn()}
    onSetTabGrid={vi.fn()} onMoveRow={vi.fn()} onArchive={vi.fn()} />);
  expect(screen.queryByText('Fecha')).not.toBeInTheDocument();
  expect(screen.queryByDisplayValue('2026-08-01')).not.toBeInTheDocument();
  // El dato sigue en el sprint, intacto.
  expect(sprint.tabGrid.resolved[0][1]).toBe('2026-08-01');
});

it('una septima columna anadida es editable y escribe en su indice de datos', async () => {
  const user = userEvent.setup();
  const onUpdateGridCell = vi.fn();
  localStorage.setItem(STORAGE_KEYS.SCHEMA, JSON.stringify({
    version: 1,
    sprint: { tabs: [{ id: 'resolved', label: 'R', columns: [
      { id: 'ticket', label: 'Ticket' }, { id: 'b', label: 'B' }, { id: 'c', label: 'C' },
      { id: 'd', label: 'D' }, { id: 'e', label: 'E' }, { id: 'f', label: 'F' },
      { id: 'entorno', label: 'Entorno' },
    ] }] },
  }));
  render(<SprintDashboard sprint={makeSprint({ tabGrid: { resolved: [['', '', '', '', '', '']] } })}
    onUpdateGridCell={onUpdateGridCell} onSetTabGrid={vi.fn()} onMoveRow={vi.fn()} onArchive={vi.fn()} />);
  expect(screen.getByText('Entorno')).toBeInTheDocument();
  // La fila guardada tiene 6 celdas; la septima se lee como '' y crece al escribir.
  await user.type(document.querySelector('input[data-row="0"][data-col="6"]')!, 'pre');
  expect(onUpdateGridCell).toHaveBeenCalledWith('resolved', 0, 6, 'p');
});

it('una pestana anadida es navegable', async () => {
  const user = userEvent.setup();
  localStorage.setItem(STORAGE_KEYS.SCHEMA, JSON.stringify({
    version: 1,
    sprint: { tabs: [
      { id: 'resolved', label: 'R', columns: [{ id: 'ticket', label: 'Ticket' }] },
      { id: 'nueva', label: 'Bloqueados', columns: [{ id: 'ticket', label: 'Clave' }] },
    ] },
  }));
  render(<SprintDashboard sprint={makeSprint({ tabGrid: { resolved: [['a']], nueva: [['']] } })}
    onUpdateGridCell={vi.fn()} onSetTabGrid={vi.fn()} onMoveRow={vi.fn()} onArchive={vi.fn()} />);
  await user.click(screen.getByRole('button', { name: 'Bloqueados' }));
  expect(screen.getByText('Clave')).toBeInTheDocument();
});

it('la pestana oculta no se pinta', () => {
  localStorage.setItem(STORAGE_KEYS.SCHEMA, JSON.stringify({
    version: 1,
    sprint: { tabs: [
      { id: 'resolved', label: 'R', columns: [{ id: 'ticket', label: 'T' }] },
      { id: 'jsd', label: 'JSD', hidden: true, columns: [{ id: 'jsd', label: 'J' }] },
    ] },
  }));
  render(<SprintDashboard sprint={makeSprint()} onUpdateGridCell={vi.fn()}
    onSetTabGrid={vi.fn()} onMoveRow={vi.fn()} onArchive={vi.fn()} />);
  expect(screen.queryByRole('button', { name: 'JSD' })).not.toBeInTheDocument();
});
```

Con el helper:

```tsx
function makeSprint(overrides: Partial<Sprint> = {}): Sprint {
  return {
    id: 's1', name: 'Sprint 25', startDate: '2026-08-01', endDate: null, archived: false,
    jql: {}, tabGrid: { resolved: [['', '', '', '', '']] }, ...overrides,
  };
}
```

- [ ] **Step 2: Ejecuta y comprueba que falla**

Run: `npx vitest run src/components/SprintDashboard.test.tsx`
Expected: FAIL — hoy los rótulos salen de `TAB_LABELS`/`TAB_HEADERS` en español y ocultar no hace nada.

- [ ] **Step 3: Deriva pestañas y columnas del esquema**

Reescribe la cabecera de `src/components/SprintDashboard.tsx` — las tres constantes desaparecen:

```tsx
import { useMemo } from 'react';
import type { Sprint, TabId } from '../hooks/useSprints';
import { STORAGE_KEYS } from '../config/constants';
import { useT } from '../i18n/I18nContext';
import { useSchema } from '../hooks/useSchema';
import { resolveLabel, visibleEntries } from '../types/schema';
import { TrackerGrid, type TrackerColumn } from './TrackerGrid';
```

Y dentro del componente, antes del `return`:

```tsx
  const [schema] = useSchema();

  const visibleTabs = useMemo(() => visibleEntries(schema.sprint.tabs), [schema]);
  const tabs = useMemo(() => visibleTabs.map((tab) => tab.id), [visibleTabs]);
  const tabLabels = useMemo(
    () => Object.fromEntries(visibleTabs.map((tab) => [tab.id, resolveLabel(tab, t)])),
    [visibleTabs, t],
  ) as Record<TabId, string>;
  // El indice en `columns` ES la columna de datos: se calcula ANTES de filtrar
  // las ocultas, porque filtrar primero desplazaria en silencio los datos.
  const tabColumns = useMemo(
    () => Object.fromEntries(visibleTabs.map((tab) => [
      tab.id,
      (tab.columns ?? [])
        .map((col, dataIndex) => ({ col, dataIndex }))
        .filter(({ col }) => !col.hidden)
        .map(({ col, dataIndex }) => ({ label: resolveLabel(col, t), dataIndex })),
    ])),
    [visibleTabs, t],
  ) as Record<TabId, TrackerColumn[]>;
```

Pasa `tabs={tabs}`, `tabLabels={tabLabels}`, `tabColumns={tabColumns}` a `TrackerGrid`.

> **Ojo:** el `.map(...).filter(...)` en ese orden es la invariante de la fase. Un `.filter(...).map(...)` compilaría igual y desplazaría los datos de todas las columnas posteriores a una oculta.

- [ ] **Step 4: Ejecuta los tests y comprueba que pasan**

Run: `npx vitest run src/components/SprintDashboard.test.tsx`
Expected: PASS, incluido el GUARDIAN.

- [ ] **Step 5: Suite completa, typecheck y commit**

```bash
npx tsc --noEmit && npx vitest run
git add src/components/SprintDashboard.tsx src/components/SprintDashboard.test.tsx
git commit -m "feat(sprint): SprintDashboard pinta pestanas y columnas del esquema"
```

---

### Task 5: El editor `SprintSchemaEditor`

**Files:**
- Create: `src/components/SprintSchemaEditor.tsx`
- Create: `src/components/SprintSchemaEditor.test.tsx`
- Modify: `src/components/SprintDashboard.tsx` (barra propia encima del `TrackerGrid`)
- Modify: `src/i18n/es.json`, `src/i18n/en.json`

**Interfaces:**
- Consumes: `useSchema()` + `SprintTabSchema` (Task 1), `SchemaEntryRow` (existente, Fase 4, se reutiliza tal cual).
- Produces: `<SprintSchemaEditor onClose={() => void} />`.

- [ ] **Step 1: Añade las 8 claves i18n del editor**

`src/i18n/es.json`, junto al bloque `schema.*`:

```json
  "schema.sprintOpen": "Pestañas y columnas",
  "schema.sprintTitle": "Pestañas y columnas del Sprint",
  "schema.tabs": "Pestañas",
  "schema.addTab": "Añadir pestaña",
  "schema.newTabPlaceholder": "Nombre de la pestaña nueva",
  "schema.addColumn": "Añadir columna",
  "schema.newColumnPlaceholder": "Nombre de la columna nueva",
  "schema.resetSprintConfirm": "¿Restaurar las pestañas y columnas por defecto del Sprint Tracker?",
```

`src/i18n/en.json`:

```json
  "schema.sprintOpen": "Tabs and columns",
  "schema.sprintTitle": "Sprint tabs and columns",
  "schema.tabs": "Tabs",
  "schema.addTab": "Add tab",
  "schema.newTabPlaceholder": "New tab name",
  "schema.addColumn": "Add column",
  "schema.newColumnPlaceholder": "New column name",
  "schema.resetSprintConfirm": "Restore the Sprint Tracker's default tabs and columns?",
```

Reutiliza `schema.hide`, `schema.nameOf`, `schema.hiddenHint`, `schema.renameHint`, `schema.reset` y `common.close`, que ya existen desde la Fase 4.

- [ ] **Step 2: Escribe los tests que fallan**

En `src/components/SprintSchemaEditor.test.tsx`:

```tsx
it('lista las cinco pestanas por defecto con sus columnas', () => {
  render(<SprintSchemaEditor onClose={vi.fn()} />);
  ['Resolved', 'Created', 'ReOpen', 'High Priority', 'JSD']
    .forEach((label) => expect(screen.getByDisplayValue(label)).toBeInTheDocument());
  // La pestana JSD tiene 3 columnas; 'Date' sale una vez por pestana (5).
  expect(screen.getAllByDisplayValue('Date').length).toBe(5);
});

it('renombrar una columna persiste la etiqueta al perder el foco', async () => {
  const user = userEvent.setup();
  render(<SprintSchemaEditor onClose={vi.fn()} />);
  const input = screen.getByDisplayValue('Squad');
  await user.clear(input);
  await user.type(input, 'Equipo');
  await user.tab();
  const stored = JSON.parse(localStorage.getItem(STORAGE_KEYS.SCHEMA)!);
  expect(stored.sprint.tabs[0].columns[4].label).toBe('Equipo');
  // El id NUNCA cambia: los datos cuelgan de el.
  expect(stored.sprint.tabs[0].columns[4].id).toBe('squad');
});

it('anadir una columna la anade al final de esa pestana', async () => {
  const user = userEvent.setup();
  render(<SprintSchemaEditor onClose={vi.fn()} />);
  await user.type(screen.getAllByPlaceholderText('New column name')[0], 'Entorno');
  await user.click(screen.getAllByRole('button', { name: 'Add column' })[0]);
  const stored = JSON.parse(localStorage.getItem(STORAGE_KEYS.SCHEMA)!);
  expect(stored.sprint.tabs[0].columns.at(-1).label).toBe('Entorno');
  expect(stored.sprint.tabs[0].columns.at(-1).id).toBeTruthy();
});

it('anadir una columna con nombre vacio no hace nada', async () => {
  const user = userEvent.setup();
  render(<SprintSchemaEditor onClose={vi.fn()} />);
  await user.click(screen.getAllByRole('button', { name: 'Add column' })[0]);
  expect(localStorage.getItem(STORAGE_KEYS.SCHEMA)).toBeNull();
});

it('una pestana nueva nace con las mismas columnas que Resueltos', async () => {
  const user = userEvent.setup();
  render(<SprintSchemaEditor onClose={vi.fn()} />);
  await user.type(screen.getByPlaceholderText('New tab name'), 'Bloqueados');
  await user.click(screen.getByRole('button', { name: 'Add tab' }));
  const stored = JSON.parse(localStorage.getItem(STORAGE_KEYS.SCHEMA)!);
  const nueva = stored.sprint.tabs.at(-1);
  expect(nueva.label).toBe('Bloqueados');
  expect(nueva.columns.map((c) => c.id)).toEqual(['ticket', 'fecha', 'prioridad', 'autor', 'squad']);
});

it('no deja ocultar la ultima pestana visible', () => {
  localStorage.setItem(STORAGE_KEYS.SCHEMA, JSON.stringify({
    version: 1,
    sprint: { tabs: [{ id: 'resolved', label: 'R', columns: [{ id: 'ticket', label: 'T' }] }] },
  }));
  render(<SprintSchemaEditor onClose={vi.fn()} />);
  // Una sola pestana y una sola columna: ambos checkboxes deshabilitados.
  screen.getAllByRole('checkbox').forEach((cb) => expect(cb).toBeDisabled());
});

it('Restaurar por defecto solo toca la seccion sprint', async () => {
  const user = userEvent.setup();
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  localStorage.setItem(STORAGE_KEYS.SCHEMA, JSON.stringify({
    version: 1,
    regression: { ticketFields: [{ id: 'custom', label: 'Mio' }], platforms: [{ id: 'ios', label: 'APPS' }] },
    sprint: { tabs: [{ id: 'x', label: 'X', columns: [{ id: 'c', label: 'C' }] }] },
  }));
  render(<SprintSchemaEditor onClose={vi.fn()} />);
  await user.click(screen.getByRole('button', { name: 'Restore defaults' }));
  const stored = JSON.parse(localStorage.getItem(STORAGE_KEYS.SCHEMA)!);
  expect(stored.regression.ticketFields).toEqual([{ id: 'custom', label: 'Mio' }]);
  expect(stored.sprint.tabs.map((t) => t.id))
    .toEqual(['resolved', 'created', 'reopened', 'highPriority', 'jsd']);
});
```

- [ ] **Step 3: Ejecuta y comprueba que falla**

Run: `npx vitest run src/components/SprintSchemaEditor.test.tsx`
Expected: FAIL — el módulo no existe.

- [ ] **Step 4: Escribe el editor**

`src/components/SprintSchemaEditor.tsx`:

```tsx
import { useState } from 'react';
import { useSchema } from '../hooks/useSchema';
import { DEFAULT_SCHEMA, resolveLabel, SchemaEntry, SprintTabSchema } from '../types/schema';
import { useT } from '../i18n/I18nContext';
import { SchemaEntryRow } from './SchemaEntryRow';

interface SprintSchemaEditorProps {
  onClose: () => void;
}

/**
 * Muestra TODAS las pestanas con sus columnas a la vez, no solo la activa:
 * `activeTab` es estado interno de TrackerGrid y sacarlo de ahi para que el
 * editor lo lea seria mucho mas invasivo que listar las cinco pestanas.
 *
 * Ni borrar ni reordenar: el grid es posicional y el indice de `columns` es la
 * columna de datos. Ocultar preserva y es reversible.
 */
export function SprintSchemaEditor({ onClose }: SprintSchemaEditorProps) {
  const t = useT();
  const [schema, setSchema] = useSchema();
  const [newTabName, setNewTabName] = useState('');
  // Un borrador de columna nueva por pestana, por id: dos pestanas pueden tener
  // un nombre a medio escribir a la vez sin pisarse.
  const [newColName, setNewColName] = useState<Record<string, string>>({});

  const tabs = schema.sprint.tabs;
  const writeTabs = (next: SprintTabSchema[]) =>
    setSchema({ ...schema, sprint: { ...schema.sprint, tabs: next } });

  const patchTab = (id: string, patch: Partial<SchemaEntry>) =>
    writeTabs(tabs.map((tab) => (tab.id === id ? { ...tab, ...patch } : tab)));

  const patchColumn = (tabId: string, colId: string, patch: Partial<SchemaEntry>) =>
    writeTabs(tabs.map((tab) => (tab.id !== tabId ? tab : {
      ...tab,
      columns: tab.columns.map((c) => (c.id === colId ? { ...c, ...patch } : c)),
    })));

  const addColumn = (tabId: string) => {
    const name = (newColName[tabId] ?? '').trim();
    if (!name) return;
    writeTabs(tabs.map((tab) => (tab.id !== tabId ? tab : {
      ...tab,
      columns: [...tab.columns, { id: crypto.randomUUID(), label: name }],
    })));
    setNewColName((prev) => ({ ...prev, [tabId]: '' }));
  };

  const addTab = () => {
    const name = newTabName.trim();
    if (!name) return;
    // Arranca con las columnas de la primera pestana por defecto para que no
    // nazca vacia y sin columna que mostrar. Se CLONAN: meter la referencia de
    // DEFAULT_SCHEMA en el estado la dejaria compartida con la constante.
    const columns = DEFAULT_SCHEMA.sprint.tabs[0].columns.map((c) => ({ ...c }));
    writeTabs([...tabs, { id: crypto.randomUUID(), label: name, columns }]);
    setNewTabName('');
  };

  const reset = () => {
    if (!confirm(t('schema.resetSprintConfirm'))) return;
    setSchema({ ...schema, sprint: DEFAULT_SCHEMA.sprint });
  };

  const visibleTabCount = tabs.filter((tab) => !tab.hidden).length;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 620, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>{t('schema.sprintTitle')}</h2>
          <button type="button" className="btn-ghost" onClick={onClose}>{t('common.close')}</button>
        </div>

        <p style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 4 }}>{t('schema.hiddenHint')}</p>
        <p style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 16 }}>{t('schema.renameHint')}</p>

        <h3 style={{ fontSize: 13, fontWeight: 700, margin: '0 0 8px' }}>{t('schema.tabs')}</h3>

        {tabs.map((tab) => {
          const visibleColCount = tab.columns.filter((c) => !c.hidden).length;
          return (
            <div key={tab.id} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 12, marginBottom: 12 }}>
              <SchemaEntryRow
                inputId={`schema-sprint-tab-${tab.id}`}
                label={resolveLabel(tab, t)}
                hidden={Boolean(tab.hidden)}
                canHide={visibleTabCount > 1}
                onRename={(label) => patchTab(tab.id, { label })}
                onToggleHidden={(hidden) => patchTab(tab.id, { hidden })}
              />
              <div style={{ marginLeft: 16, marginTop: 8 }}>
                <h4 style={{ fontSize: 12, fontWeight: 700, margin: '0 0 6px', color: 'var(--text-2)' }}>{t('schema.columns')}</h4>
                {tab.columns.map((col) => (
                  <SchemaEntryRow
                    key={col.id}
                    inputId={`schema-sprint-col-${tab.id}-${col.id}`}
                    label={resolveLabel(col, t)}
                    hidden={Boolean(col.hidden)}
                    canHide={visibleColCount > 1}
                    onRename={(label) => patchColumn(tab.id, col.id, { label })}
                    onToggleHidden={(hidden) => patchColumn(tab.id, col.id, { hidden })}
                  />
                ))}
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <input
                    type="text"
                    placeholder={t('schema.newColumnPlaceholder')}
                    value={newColName[tab.id] ?? ''}
                    onChange={(e) => setNewColName((prev) => ({ ...prev, [tab.id]: e.target.value }))}
                    onKeyDown={(e) => { if (e.key === 'Enter') addColumn(tab.id); }}
                    className="field-input"
                    style={{ flex: 1, minWidth: 0 }}
                  />
                  <button type="button" className="btn-ghost" onClick={() => addColumn(tab.id)}>{t('schema.addColumn')}</button>
                </div>
              </div>
            </div>
          );
        })}

        <div style={{ display: 'flex', gap: 8, marginTop: 8, marginBottom: 20 }}>
          <input
            type="text"
            placeholder={t('schema.newTabPlaceholder')}
            value={newTabName}
            onChange={(e) => setNewTabName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addTab(); }}
            className="field-input"
            style={{ flex: 1, minWidth: 0 }}
          />
          <button type="button" className="btn-ghost" onClick={addTab}>{t('schema.addTab')}</button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" className="btn-ghost" onClick={reset}>{t('schema.reset')}</button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Ejecuta los tests y comprueba que pasan**

Run: `npx vitest run src/components/SprintSchemaEditor.test.tsx`
Expected: PASS.

- [ ] **Step 6: Monta el botón en `SprintDashboard`**

En `src/components/SprintDashboard.tsx`, añade `const [showSchema, setShowSchema] = useState(false);` y una barra **propia encima** del `TrackerGrid` (no se le añade ningún prop de toolbar a `TrackerGrid`). Solo cuando el sprint no está archivado — un sprint archivado es de solo lectura:

```tsx
      {!sprint.archived && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
          <button type="button" className="btn-ghost" onClick={() => setShowSchema(true)}
            style={{ padding: '6px 14px', fontSize: 13 }}>
            {t('schema.sprintOpen')}
          </button>
        </div>
      )}
      {showSchema && <SprintSchemaEditor onClose={() => setShowSchema(false)} />}
```

- [ ] **Step 7: Suite completa, typecheck y commit**

```bash
npx tsc --noEmit && npx vitest run
git add src/components/SprintSchemaEditor.tsx src/components/SprintSchemaEditor.test.tsx src/components/SprintDashboard.tsx src/i18n/es.json src/i18n/en.json
git commit -m "feat(sprint): editor de pestanas y columnas"
```

---

### Task 6: Documentación

**Files:**
- Modify: `AGENTS.md` (Settings persistence, la ficha de `TrackerGrid`/`SprintDashboard`, Known issues, Evolution history, la línea de "Fase 5 pendiente")
- Modify: `README.md` si menciona las pestañas del Sprint como fijas

- [ ] **Step 1: Actualiza `AGENTS.md`**

Cinco puntos, todos concretos:

1. **Settings persistence**: `acgen_schema` ya no tiene la sección `sprint` "reservada" — descríbela: `sprint: { tabs: SprintTabSchema[] }`, cada pestaña con su lista de `columns`.
2. **Quita** de "Pending items" la línea `Fase 5 of productization (Sprint Tracker configurable schema): ... not implemented yet.` y el párrafo que dice que la Fase 5 sigue pendiente.
3. **Ficha de `TrackerGrid`**: la prop es `tabColumns: Record<T, {label, dataIndex}[]>`, el llamante resuelve y filtra, el componente no sabe nada del esquema; `colCount = Math.max(headers, datos, 1)` y por qué; qué va por índice de datos (todo) y qué por posición visual (solo ←/→).
4. **La divergencia de búsqueda entre los dos trackers**, en la ficha de `TrackerGrid` y en Known issues: en el **Sprint** la búsqueda mira la fila entera, columnas ocultas incluidas; en **Regression** la Fase 4 la acotó a los campos visibles. Es deliberado y decisión de Jorge (2026-08-15) — ocultar es una preferencia de vista, no un borrado. Escríbelo donde se vea, porque leído de refilón parece una inconsistencia y alguien la "arreglará".
5. **Known issues**, dos limitaciones deliberadas nuevas: (a) no se pueden **borrar ni reordenar** columnas del Sprint — el grid es posicional y hacerlo exigiría migrarlo a filas keyed más migrar los anchos de índice a id; ocultar cubre el caso práctico. (b) Igual que en la Fase 4, **renombrar fija el texto en los dos idiomas** (el `label` gana sobre el `labelKey`).
6. **Evolution history**: fila nueva para la Fase 5 con fecha 2026-08-15, los commits, el recuento de tests y de claves i18n (301 → 316), y si hubo o no verificación manual en navegador. **No escribas que está verificada en producción si no lo está** — ese fue exactamente el error que hubo que corregir en la Fase 4.

- [ ] **Step 2: Comprueba si `README.md` lo menciona**

Run: `grep -n "Resueltos\|Creados\|Prioridad Alta\|pesta" README.md`
Si describe las cinco pestañas como fijas, añade que son configurables desde "Pestañas y columnas".

- [ ] **Step 3: Commit**

```bash
git add AGENTS.md README.md
git commit -m "docs: sincroniza AGENTS y README con el esquema del Sprint"
```

---

## Verificación final de la rama

- [ ] `npx tsc --noEmit` — sin errores
- [ ] `npx vitest run` — 603 + ~25 nuevos, todos verdes, 0 fallos
- [ ] `npm run build` — el build de producción pasa
- [ ] **Prueba manual en navegador** (`npm run dev`), el paso que la Fase 4 se saltó:
  - Con `acgen_schema` borrada del `localStorage`, el Sprint Tracker se ve exactamente igual que antes.
  - Renombrar "Squad" → "Equipo" cambia el rótulo y NO mueve ningún dato.
  - Ocultar "Prioridad" la quita de la vista; volver a mostrarla devuelve el valor que había.
  - Ajustar a mano el ancho de la última columna, ocultar una intermedia, y comprobar que el ancho sigue en su columna.
  - Añadir una pestaña, escribir en ella, recargar y comprobar que sigue ahí.
  - En la pestaña JSD, comprobar que se siguen viendo las 6 columnas de datos.
