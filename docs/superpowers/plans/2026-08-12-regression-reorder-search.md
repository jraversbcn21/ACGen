# Regression Tracker: reorden drag & drop + buscador — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reordenar regresiones arrastrándolas (drag nativo HTML5 con handle ⠿) y filtrarlas con un buscador por versión, Excel o contenido de tickets, sin tocar el formato de datos guardado.

**Architecture:** Nueva operación `moveRegression` en `useRegressions` (reordena el array, persistencia automática vía el efecto existente). `RegressionCard` gana tres props opcionales (`dragHandle`, `forceExpanded`, `visibleTicketIds`) que sin usarse dejan el comportamiento idéntico al actual. Toda la lógica de DnD y de filtrado vive en `RegressionTracker` (estado local, nada persistido).

**Tech Stack:** React 18 + TypeScript, Vitest + Testing Library (jsdom), i18n JSON ES/EN. Sin librerías nuevas.

**Spec:** `docs/superpowers/specs/2026-08-12-regression-reorder-search-design.md`

## Global Constraints

- **Cero dependencias nuevas** (deps actuales: react, react-dom, jspdf, jspdf-autotable).
- **Cero cambios de formato** en la clave `acgen_regressions` de localStorage: los datos existentes deben sobrevivir intactos.
- **i18n con paridad ES/EN**: toda clave nueva se añade a `src/i18n/es.json` **y** `src/i18n/en.json` (el test de paridad existente falla si no).
- **TDD**: test que falla → implementación mínima → test en verde → commit.
- Los tests corren con `npx vitest run <ruta>` (archivo suelto) o `npm test` (suite completa, actualmente 440 tests / 45 archivos, todos en verde).
- Rama de trabajo: `feat/regression-reorder-search` desde `main`. El cwd del repo es `acgen/` (el `.git` vive ahí, no en la raíz `ACGen/`).
- Mensajes de commit estilo del repo: `feat(regression): ...`, `test(regression): ...` en minúsculas.

---

### Task 1: `moveRegression` en el hook `useRegressions`

**Files:**
- Modify: `src/hooks/useRegressions.ts` (añadir callback + export, junto a `deleteRegression`)
- Test: `src/hooks/useRegressions.test.ts` (añadir `describe('moveRegression')`)

**Interfaces:**
- Consumes: `mapPlatform`, `setState` y el patrón de callbacks ya existentes en el hook.
- Produces: `moveRegression(platform: PlatformId, id: string, toIndex: number): void` — quita la regresión `id` de su lista y la inserta en `toIndex` (clampeado a `[0, length-1]`); id inexistente = no-op; no toca la otra plataforma ni `archived`. Exportado en el objeto de retorno del hook. Task 4 lo consume.

- [ ] **Step 1: Crear la rama**

```bash
git checkout -b feat/regression-reorder-search
```

- [ ] **Step 2: Escribir los tests que fallan**

Añadir al final del `describe('useRegressions (versioned)')` en `src/hooks/useRegressions.test.ts`:

```ts
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
```

- [ ] **Step 3: Verificar que fallan**

Run: `npx vitest run src/hooks/useRegressions.test.ts`
Expected: FAIL — `result.current.moveRegression is not a function` (4 tests nuevos en rojo, el resto en verde).

- [ ] **Step 4: Implementación mínima**

En `src/hooks/useRegressions.ts`, después de `deleteRegression`:

```ts
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
```

Y añadir `moveRegression,` al objeto de retorno del hook (junto a `deleteRegression`).

- [ ] **Step 5: Verificar que pasan**

Run: `npx vitest run src/hooks/useRegressions.test.ts`
Expected: PASS (todos, incluidos los 4 nuevos).

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useRegressions.ts src/hooks/useRegressions.test.ts
git commit -m "feat(regression): moveRegression para reordenar la lista por plataforma"
```

---

### Task 2: props `dragHandle`, `forceExpanded` y `visibleTicketIds` en `RegressionCard`

**Files:**
- Modify: `src/components/RegressionCard.tsx`
- Test: `src/components/RegressionCard.test.tsx`

**Interfaces:**
- Consumes: nada nuevo de otras tasks.
- Produces (Task 3 y 4 las consumen):
  - `dragHandle?: React.ReactNode` — nodo que se renderiza como PRIMER hijo de la cabecera (antes del chevron). El card no sabe nada de DnD; el tracker inyecta el handle ya cableado.
  - `forceExpanded?: boolean` — la tabla se muestra desplegada ignorando el estado local; el chevron queda `disabled`.
  - `visibleTicketIds?: string[]` — si se pasa, solo se renderizan las filas cuyos ids estén en la lista y se oculta el botón "+ Añadir ticket". Sin la prop, todo como hoy.

- [ ] **Step 1: Escribir los tests que fallan**

Añadir al final del `describe('RegressionCard')` en `src/components/RegressionCard.test.tsx`:

```tsx
it('forceExpanded shows the table without interaction and disables the chevron', () => {
  renderCard({ forceExpanded: true });
  expect(screen.getByText('Prioridad')).toBeInTheDocument();
  const chevron = screen.getByLabelText('Mostrar u ocultar tickets') as HTMLButtonElement;
  expect(chevron.disabled).toBe(true);
});

it('visibleTicketIds renders only those rows and hides the add-ticket button', () => {
  renderCard({
    forceExpanded: true,
    visibleTicketIds: ['t2'],
    regression: makeRegression({
      tickets: [
        { id: 't1', ticket: 'PROJ-1', fecha: '', prioridad: '', creador: '', squad: '', status: '' },
        { id: 't2', ticket: 'PROJ-2', fecha: '', prioridad: '', creador: '', squad: '', status: '' },
      ],
    }),
  });
  expect(document.querySelectorAll('tbody tr')).toHaveLength(1);
  expect(screen.getByDisplayValue('PROJ-2')).toBeInTheDocument();
  expect(screen.queryByText('+ Añadir ticket')).not.toBeInTheDocument();
});

it('renders the dragHandle node in the header when provided', () => {
  renderCard({ dragHandle: <span data-testid="handle">⠿</span> });
  expect(screen.getByTestId('handle')).toBeInTheDocument();
});
```

- [ ] **Step 2: Verificar que fallan**

Run: `npx vitest run src/components/RegressionCard.test.tsx`
Expected: FAIL — los 3 tests nuevos en rojo (la tabla no aparece con `forceExpanded`, el handle no se renderiza); el resto en verde.

- [ ] **Step 3: Implementación mínima**

En `src/components/RegressionCard.tsx`:

1. Ampliar la interfaz y el destructuring:

```ts
interface RegressionCardProps {
  regression: Regression;
  readOnly?: boolean;
  defaultExpanded?: boolean;
  dragHandle?: React.ReactNode;
  forceExpanded?: boolean;
  visibleTicketIds?: string[];
  onUpdateRegression?: (patch: { version?: string; url?: string; fecha?: string }) => void;
  onUpdateTicket?: (ticketId: string, field: TicketField, value: string) => void;
  onAddTicket?: () => void;
  onDeleteTicket?: (ticketId: string) => void;
  onArchive?: () => void;
  onDelete?: () => void;
}
```

(y añadir `dragHandle, forceExpanded = false, visibleTicketIds` a los parámetros de la función).

2. Estado desplegado combinado y filas visibles, junto a los cálculos existentes (`urlParts`, `ticketCount`):

```ts
const isExpanded = forceExpanded || expanded;
const visibleTickets = visibleTicketIds
  ? regression.tickets.filter((tk) => visibleTicketIds.includes(tk.id))
  : regression.tickets;
```

3. En la cabecera, renderizar `{dragHandle}` como primer hijo (antes del botón chevron). El chevron pasa a:

```tsx
<button
  type="button"
  className="btn-ghost"
  aria-label={t('regression.toggleTickets')}
  aria-expanded={isExpanded}
  disabled={forceExpanded}
  onClick={() => setExpanded((v) => !v)}
  style={{ padding: '2px 8px', fontSize: 12 }}
>
  {isExpanded ? '▾' : '▸'}
</button>
```

4. La tabla se renderiza con `{isExpanded && (...)}` (antes `{expanded && ...}`), el `tbody` mapea `visibleTickets` en vez de `regression.tickets`, y el botón añadir queda `{!readOnly && !visibleTicketIds && (<button ...>+ {t('regression.addTicket')}</button>)}`.

- [ ] **Step 4: Verificar que pasan**

Run: `npx vitest run src/components/RegressionCard.test.tsx`
Expected: PASS (todos).

- [ ] **Step 5: Commit**

```bash
git add src/components/RegressionCard.tsx src/components/RegressionCard.test.tsx
git commit -m "feat(regression): props dragHandle, forceExpanded y visibleTicketIds en RegressionCard"
```

---

### Task 3: buscador en `RegressionTracker`

**Files:**
- Modify: `src/components/RegressionTracker.tsx`
- Modify: `src/i18n/es.json`, `src/i18n/en.json`
- Test: `src/components/RegressionTracker.test.tsx`

**Interfaces:**
- Consumes: `forceExpanded` y `visibleTicketIds` de `RegressionCard` (Task 2).
- Produces: estado local `query` y derivado `needle` (`query.trim().toLowerCase()`), y la lista derivada `visible` (con `index` original). Task 4 usa `needle` para ocultar los handles y `visible[i].index` para el DnD.

- [ ] **Step 1: Añadir claves i18n**

En `src/i18n/es.json` (la clave `regression.searchPlaceholder` YA existe — se actualiza su texto; las otras dos son nuevas, añadirlas junto al bloque `regression.*`):

```json
"regression.searchPlaceholder": "Buscar por versión, ticket, status...",
"regression.noMatches": "Sin coincidencias.",
"regression.searchClear": "Limpiar búsqueda",
```

En `src/i18n/en.json`:

```json
"regression.searchPlaceholder": "Search by version, ticket, status...",
"regression.noMatches": "No matches.",
"regression.searchClear": "Clear search",
```

- [ ] **Step 2: Escribir los tests que fallan**

Añadir al final del `describe('RegressionTracker (versioned)')` en `src/components/RegressionTracker.test.tsx`:

```tsx
describe('search', () => {
  it('filters by version leaving matching cards collapsed and shows the N / M counter', () => {
    renderTracker();
    createRegression('1.0.0');
    createRegression('2.0.0');
    fireEvent.change(screen.getByPlaceholderText(/Buscar por versión/), { target: { value: '2.0' } });
    expect(screen.getByText('2.0.0')).toBeInTheDocument();
    expect(screen.queryByText('1.0.0')).not.toBeInTheDocument();
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
    expect(screen.queryByText('Prioridad')).not.toBeInTheDocument(); // match por cabecera: colapsada
  });

  it('a ticket match auto-expands the card showing only matching rows (case-insensitive)', () => {
    renderTracker();
    createRegression('1.0.0');
    fireEvent.click(screen.getByLabelText('Mostrar u ocultar tickets'));
    const firstRowInputs = document.querySelectorAll('tbody tr:first-child input');
    fireEvent.change(firstRowInputs[0], { target: { value: 'PROJ-42' } });
    fireEvent.change(screen.getByPlaceholderText(/Buscar por versión/), { target: { value: 'proj-42' } });
    expect(screen.getByText('Prioridad')).toBeInTheDocument(); // auto-expandida
    expect(document.querySelectorAll('tbody tr')).toHaveLength(1); // solo la fila coincidente
    expect(screen.getByDisplayValue('PROJ-42')).toBeInTheDocument();
  });

  it('shows the no-matches message and clears the search with the × button', () => {
    renderTracker();
    createRegression('1.0.0');
    fireEvent.change(screen.getByPlaceholderText(/Buscar por versión/), { target: { value: 'zzz' } });
    expect(screen.getByText('Sin coincidencias.')).toBeInTheDocument();
    expect(screen.queryByText('1.0.0')).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Limpiar búsqueda'));
    expect(screen.getByText('1.0.0')).toBeInTheDocument();
  });

  it('keeps the query when switching tabs', () => {
    renderTracker();
    createRegression('1.0.0');
    fireEvent.change(screen.getByPlaceholderText(/Buscar por versión/), { target: { value: '1.0' } });
    fireEvent.click(screen.getByText('WEB'));
    expect((screen.getByPlaceholderText(/Buscar por versión/) as HTMLInputElement).value).toBe('1.0');
  });
});
```

- [ ] **Step 3: Verificar que fallan**

Run: `npx vitest run src/components/RegressionTracker.test.tsx`
Expected: FAIL — `getByPlaceholderText(/Buscar por versión/)` no encuentra el input (4 tests nuevos en rojo).

- [ ] **Step 4: Implementación mínima**

En `src/components/RegressionTracker.tsx`, todo dentro del componente:

1. Estado y derivados (junto a los `useState` existentes):

```ts
const [query, setQuery] = useState('');
const needle = query.trim().toLowerCase();
```

2. Sustituir `const list = regressions[activeTab] || [];` por la lista + derivado filtrado:

```ts
const list = regressions[activeTab] || [];
const hasText = (s: string) => s.toLowerCase().includes(needle);
const visible = list
  .map((regression, index) => {
    if (!needle) return { regression, index, forceExpanded: false, visibleTicketIds: undefined as string[] | undefined };
    const ticketIds = regression.tickets
      .filter((tk) => [tk.ticket, tk.fecha, tk.prioridad, tk.creador, tk.squad, tk.status].some(hasText))
      .map((tk) => tk.id);
    if (ticketIds.length > 0) return { regression, index, forceExpanded: true, visibleTicketIds: ticketIds };
    if (hasText(regression.version) || hasText(regression.url)) {
      return { regression, index, forceExpanded: false, visibleTicketIds: undefined as string[] | undefined };
    }
    return null;
  })
  .filter((v): v is NonNullable<typeof v> => v !== null);
```

(Prevalencia del match por tickets sobre el de cabecera: es intencional, spec §Casos borde.)

3. UI del buscador: convertir el `<div style={{ marginTop: 14 }}>` que contiene "+ Nueva regresión" en una fila flex y añadir el buscador a la derecha:

```tsx
<div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
  {/* ...aquí queda el bloque existente de showNewForm (botón o formulario inline), sin cambios... */}
  <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
    {needle !== '' && (
      <span style={{ fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
        {visible.length} / {list.length}
      </span>
    )}
    <input
      type="text"
      aria-label={t('regression.searchPlaceholder')}
      placeholder={t('regression.searchPlaceholder')}
      value={query}
      onChange={(e) => setQuery(e.target.value)}
      style={{ ...formInputStyle, width: 220 }}
    />
    {query !== '' && (
      <button
        type="button"
        className="btn-ghost"
        aria-label={t('regression.searchClear')}
        title={t('regression.searchClear')}
        onClick={() => setQuery('')}
        style={{ padding: '4px 8px', fontSize: 12 }}
      >
        ×
      </button>
    )}
  </span>
</div>
```

Nota: el formulario inline de nueva regresión tenía su propio contenedor flex; al fusionarlo en esta fila, envolver el bloque `showNewForm ? ... : ...` en un `<span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', flex: 1 }}>` para que el input de URL conserve su `flex: 1`.

4. Estados vacíos y render de tarjetas: el bloque de la lista pasa a:

```tsx
{list.length === 0 && (
  <p style={{ marginTop: 24, textAlign: 'center', color: 'var(--text-3)', fontSize: 14 }}>
    {t('regression.noRegressions')}
  </p>
)}
{list.length > 0 && needle !== '' && visible.length === 0 && (
  <p style={{ marginTop: 24, textAlign: 'center', color: 'var(--text-3)', fontSize: 14 }}>
    {t('regression.noMatches')}
  </p>
)}
{visible.map(({ regression, forceExpanded, visibleTicketIds }) => (
  <RegressionCard
    key={regression.id}
    regression={regression}
    forceExpanded={forceExpanded}
    visibleTicketIds={visibleTicketIds}
    onUpdateRegression={(patch) => updateRegression(activeTab, regression.id, patch)}
    onUpdateTicket={(ticketId, field, value) => updateTicket(activeTab, regression.id, ticketId, field, value)}
    onAddTicket={() => addTicket(activeTab, regression.id)}
    onDeleteTicket={(ticketId) => deleteTicket(activeTab, regression.id, ticketId)}
    onArchive={() => { if (confirm(t('regression.archiveOneConfirm'))) archiveRegression(activeTab, regression.id); }}
    onDelete={() => { if (confirm(t('regression.deleteOneConfirm'))) deleteRegression(activeTab, regression.id); }}
  />
))}
```

- [ ] **Step 5: Verificar que pasan (incluida la paridad i18n)**

Run: `npx vitest run src/components/RegressionTracker.test.tsx src/i18n`
Expected: PASS (los 4 nuevos, los existentes y el test de paridad ES/EN).

- [ ] **Step 6: Commit**

```bash
git add src/components/RegressionTracker.tsx src/components/RegressionTracker.test.tsx src/i18n/es.json src/i18n/en.json
git commit -m "feat(regression): buscador por versión, excel y tickets en la pestaña activa"
```

---

### Task 4: drag & drop en `RegressionTracker`

**Files:**
- Modify: `src/components/RegressionTracker.tsx`
- Modify: `src/i18n/es.json`, `src/i18n/en.json`
- Test: `src/components/RegressionTracker.test.tsx`

**Interfaces:**
- Consumes: `moveRegression` del hook (Task 1), prop `dragHandle` de `RegressionCard` (Task 2), `needle`/`visible` del buscador (Task 3).
- Produces: nada para tasks posteriores (última task de código).

- [ ] **Step 1: Añadir claves i18n**

`src/i18n/es.json`:

```json
"regression.dragHandle": "Arrastrar para reordenar",
```

`src/i18n/en.json`:

```json
"regression.dragHandle": "Drag to reorder",
```

- [ ] **Step 2: Escribir los tests que fallan**

Añadir al final del `describe('RegressionTracker (versioned)')`:

```tsx
describe('drag & drop reorder', () => {
  // jsdom devuelve rects de tamaño 0, así que clientY negativo = mitad
  // superior y positivo = mitad inferior respecto a rect.top + height/2 = 0.
  it('dragging a card by its handle onto the top half of the first card moves it to the top', () => {
    renderTracker();
    createRegression('1.0.0');
    createRegression('2.0.0');
    createRegression('3.0.0');
    // orden actual (las nuevas entran arriba): 3.0.0, 2.0.0, 1.0.0
    const handles = screen.getAllByLabelText('Arrastrar para reordenar');
    fireEvent.dragStart(handles[2]); // 1.0.0
    const first = document.querySelector('[data-drag-index="0"]')!;
    fireEvent.dragOver(first, { clientY: -5 });
    fireEvent.drop(first);
    const stored = JSON.parse(localStorage.getItem('acgen_regressions')!);
    expect(stored.regressions.ios.map((r: { version: string }) => r.version)).toEqual(['1.0.0', '3.0.0', '2.0.0']);
  });

  it('dropping on the bottom half of the last card moves it to the bottom', () => {
    renderTracker();
    createRegression('1.0.0');
    createRegression('2.0.0');
    createRegression('3.0.0');
    const handles = screen.getAllByLabelText('Arrastrar para reordenar');
    fireEvent.dragStart(handles[0]); // 3.0.0
    const last = document.querySelector('[data-drag-index="2"]')!;
    fireEvent.dragOver(last, { clientY: 5 });
    fireEvent.drop(last);
    const stored = JSON.parse(localStorage.getItem('acgen_regressions')!);
    expect(stored.regressions.ios.map((r: { version: string }) => r.version)).toEqual(['2.0.0', '1.0.0', '3.0.0']);
  });

  it('dropping a card on its own position leaves the stored order unchanged', () => {
    renderTracker();
    createRegression('1.0.0');
    createRegression('2.0.0');
    const before = localStorage.getItem('acgen_regressions');
    const handles = screen.getAllByLabelText('Arrastrar para reordenar');
    fireEvent.dragStart(handles[0]);
    const self = document.querySelector('[data-drag-index="0"]')!;
    fireEvent.dragOver(self, { clientY: -5 });
    fireEvent.drop(self);
    expect(localStorage.getItem('acgen_regressions')).toBe(before);
  });

  it('handles disappear while a search is active', () => {
    renderTracker();
    createRegression('1.0.0');
    expect(screen.getByLabelText('Arrastrar para reordenar')).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText(/Buscar por versión/), { target: { value: '1.0' } });
    expect(screen.queryByLabelText('Arrastrar para reordenar')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Verificar que fallan**

Run: `npx vitest run src/components/RegressionTracker.test.tsx`
Expected: FAIL — `getAllByLabelText('Arrastrar para reordenar')` no encuentra nada (4 tests nuevos en rojo).

- [ ] **Step 4: Implementación mínima**

En `src/components/RegressionTracker.tsx`:

1. Traer `moveRegression` del hook (añadirlo al destructuring de `useRegressions()`).

2. Estado de drag (junto a `query`):

```ts
const [dragIndex, setDragIndex] = useState<number | null>(null);
const [dropTarget, setDropTarget] = useState<{ index: number; half: 'top' | 'bottom' } | null>(null);
const searching = needle !== '';
```

3. Envolver cada `RegressionCard` de la lista en un wrapper droppable (la `key` pasa al wrapper) y pasar el handle. El `.map` completo queda:

```tsx
{visible.map(({ regression, index, forceExpanded, visibleTicketIds }) => (
  <div
    key={regression.id}
    data-drag-index={index}
    onDragOver={(e) => {
      if (dragIndex === null) return;
      e.preventDefault();
      const rect = e.currentTarget.getBoundingClientRect();
      const half = e.clientY < rect.top + rect.height / 2 ? 'top' : 'bottom';
      setDropTarget((prev) => (prev?.index === index && prev.half === half ? prev : { index, half }));
    }}
    onDrop={(e) => {
      e.preventDefault();
      if (dragIndex !== null && dropTarget) {
        let to = dropTarget.half === 'top' ? dropTarget.index : dropTarget.index + 1;
        if (to > dragIndex) to -= 1;
        if (to !== dragIndex) moveRegression(activeTab, list[dragIndex].id, to);
      }
      setDragIndex(null);
      setDropTarget(null);
    }}
    style={{
      opacity: dragIndex === index ? 0.5 : 1,
      boxShadow:
        dragIndex !== null && dropTarget?.index === index
          ? dropTarget.half === 'top' ? '0 -2px 0 0 var(--accent)' : '0 2px 0 0 var(--accent)'
          : undefined,
      borderRadius: 'var(--radius-sm)',
    }}
  >
    <RegressionCard
      regression={regression}
      forceExpanded={forceExpanded}
      visibleTicketIds={visibleTicketIds}
      dragHandle={searching ? undefined : (
        <span
          draggable
          role="button"
          aria-label={t('regression.dragHandle')}
          title={t('regression.dragHandle')}
          onDragStart={(e) => {
            if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
            setDragIndex(index);
          }}
          onDragEnd={() => { setDragIndex(null); setDropTarget(null); }}
          style={{ cursor: 'grab', color: 'var(--text-3)', fontSize: 14, userSelect: 'none', padding: '0 2px' }}
        >
          ⠿
        </span>
      )}
      onUpdateRegression={(patch) => updateRegression(activeTab, regression.id, patch)}
      onUpdateTicket={(ticketId, field, value) => updateTicket(activeTab, regression.id, ticketId, field, value)}
      onAddTicket={() => addTicket(activeTab, regression.id)}
      onDeleteTicket={(ticketId) => deleteTicket(activeTab, regression.id, ticketId)}
      onArchive={() => { if (confirm(t('regression.archiveOneConfirm'))) archiveRegression(activeTab, regression.id); }}
      onDelete={() => { if (confirm(t('regression.deleteOneConfirm'))) deleteRegression(activeTab, regression.id); }}
    />
  </div>
))}
```

Notas de diseño ya decididas en el spec: el guard `if (e.dataTransfer)` es necesario porque jsdom no implementa `DataTransfer`; `dragend` limpia siempre el estado visual (cancelar con Esc o soltar fuera); con `searching` no hay handle, así que no puede iniciarse un drag con filtro activo; las tarjetas del historial (readonly) no reciben `dragHandle` porque se renderizan en otra pantalla.

- [ ] **Step 5: Verificar que pasan**

Run: `npx vitest run src/components/RegressionTracker.test.tsx`
Expected: PASS (todos).

- [ ] **Step 6: Commit**

```bash
git add src/components/RegressionTracker.tsx src/components/RegressionTracker.test.tsx src/i18n/es.json src/i18n/en.json
git commit -m "feat(regression): reorden de regresiones con drag & drop nativo"
```

---

### Task 5: verificación integral y sincronización de docs

**Files:**
- Modify: `AGENTS.md`, `README.md` (solo las menciones al recuento de tests)

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: rama lista para PR.

- [ ] **Step 1: Suite completa, lint y build**

Run: `npm test`
Expected: PASS — 0 fallos; anotar el recuento total nuevo (antes: 440 tests / 45 archivos; deben ser ~455 tests, mismos 45 archivos).

Run: `npm run lint`
Expected: 0 errores.

Run: `npm run build`
Expected: build de producción sin errores de tsc ni de vite.

- [ ] **Step 2: Verificación manual en Chrome contra build de producción**

```bash
npm run preview
```

Abrir la URL que imprime (http://localhost:4173) en Chrome y comprobar en Regression:

1. Crear 3 regresiones → entran arriba; arrastrar la de abajo por el handle ⠿ hasta arriba → queda primera; recargar → el orden persiste.
2. Arrastrar la primera a la última posición (línea indicadora visible en la mitad inferior); soltar fuera de la lista o pulsar Esc → no pasa nada y el atenuado desaparece.
3. Escribir un ticket `PROJ-1 - https://example.com/PROJ-1` en una regresión; buscar `proj-1` → tarjeta auto-expandida con solo esa fila, contador "1 / 3", handles ocultos; limpiar con × → todo vuelve.
4. Buscar texto inexistente → "Sin coincidencias."; cambiar de pestaña → la query se mantiene.
5. Consola de Chrome sin errores ni warnings.

- [ ] **Step 3: Sincronizar recuento de tests en docs**

Buscar las menciones "440" (tests) en `AGENTS.md` y `README.md` y actualizarlas al recuento real del Step 1.

- [ ] **Step 4: Commit final**

```bash
git add AGENTS.md README.md
git commit -m "docs: sync recuento de tests tras reorden + buscador de regresiones"
```

Después, usar la skill superpowers:finishing-a-development-branch (PR a `main`, como los ciclos anteriores).
