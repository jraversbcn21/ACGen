### Task 2: `linkMode: 'url'` y `readOnly` en `TrackerGrid`

**Files:**
- Modify: `src/components/TrackerGrid.tsx`
- Modify: `src/components/TrackerGrid.test.tsx`
- Modify: `src/i18n/es.json`, `src/i18n/en.json` (clave `regression.openLink`)

**Interfaces:**
- Consumes: `TrackerGrid`/`TrackerGridProps` de la Task 1.
- Produces: prop nueva `readOnly?: boolean` en `TrackerGridProps` (la usa la Task 4 para snapshots). En `linkMode: 'url'`, una celda de la columna A cuyo valor completo sea `Nombre - URL` o solo `URL` (patrón `/^(?:.+?\s*-\s*)?(https?:\/\/\S+)$/`) se pinta como enlace y Ctrl+clic abre la URL exacta.

- [ ] **Step 1: Añadir los tests (fallan)**

Añadir al final de `src/components/TrackerGrid.test.tsx`:

```tsx
describe('TrackerGrid — url mode', () => {
  function renderUrlGrid(cell0: string, overrides: Partial<TrackerGridProps<Tab>> = {}) {
    const grid = makeGrid();
    grid[0][0] = cell0;
    return renderGrid({ linkMode: 'url', tabGrid: { one: grid, two: makeGrid() }, ...overrides });
  }

  it('ctrl+click on "Nombre - URL" opens the exact URL', () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    renderUrlGrid('Smoke Login - https://zephyr.example.com/plan/9');
    fireEvent.click(screen.getByDisplayValue('Smoke Login - https://zephyr.example.com/plan/9'), { ctrlKey: true });
    expect(open).toHaveBeenCalledWith('https://zephyr.example.com/plan/9', '_blank');
  });

  it('a bare URL is also a link', () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    renderUrlGrid('https://zephyr.example.com/plan/9');
    fireEvent.click(screen.getByDisplayValue('https://zephyr.example.com/plan/9'), { ctrlKey: true });
    expect(open).toHaveBeenCalledWith('https://zephyr.example.com/plan/9', '_blank');
  });

  it('plain text is not a link', () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    renderUrlGrid('Smoke Login sin enlace');
    fireEvent.click(screen.getByDisplayValue('Smoke Login sin enlace'), { ctrlKey: true });
    expect(open).not.toHaveBeenCalled();
  });

  it('link cells get the accent styling', () => {
    renderUrlGrid('Smoke Login - https://zephyr.example.com/plan/9');
    const input = screen.getByDisplayValue('Smoke Login - https://zephyr.example.com/plan/9') as HTMLInputElement;
    expect(input.style.color).toBe('var(--accent)');
  });
});

describe('TrackerGrid — readOnly', () => {
  it('inputs are readOnly, no "+ Fila", no drag handles', () => {
    renderGrid({ readOnly: true });
    const input = document.querySelector('tbody input') as HTMLInputElement;
    expect(input).toHaveAttribute('readonly');
    expect(screen.queryByText('+ Fila')).not.toBeInTheDocument();
    const handle = document.querySelector('tbody td');
    expect(handle).toHaveAttribute('draggable', 'false');
  });
});
```

- [ ] **Step 2: Ejecutar para verificar que fallan**

Run: `npm test -- src/components/TrackerGrid.test.tsx`
Expected: FAIL — los 4 tests de url mode (window.open no llamado / estilo no accent) y el de readOnly (`readonly` ausente).

- [ ] **Step 3: Implementar en `TrackerGrid.tsx`**

3a. Añadir el patrón junto a `TICKET_KEY_PATTERN`:

```tsx
const URL_CELL_PATTERN = /^(?:.+?\s*-\s*)?(https?:\/\/\S+)$/;
```

3b. Añadir `readOnly` a la interfaz y a la desestructuración de props:

```tsx
  linkMode: 'jira' | 'url';
  dragDisabled?: boolean;
  readOnly?: boolean;
```

```tsx
  dragDisabled = false,
  readOnly = false,
```

3c. Calcular el bloqueo de edición una vez, después de la desestructuración (primera línea del cuerpo):

```tsx
  const noDrag = dragDisabled || readOnly;
```

y sustituir TODAS las apariciones de `dragDisabled` del JSX (`draggable={!dragDisabled}`, `onDragStart`, `cursor`, el span `⋮⋮`) por `noDrag`.

3d. Completar `getLinkUrl`:

```tsx
  const getLinkUrl = (value: string): string | null => {
    if (linkMode === 'jira') {
      const m = value.match(TICKET_KEY_PATTERN);
      return m ? `${baseUrl}/browse/${m[1]}` : null;
    }
    const m = value.match(URL_CELL_PATTERN);
    return m ? m[1] : null;
  };
```

3e. En el `<input>` de celda, añadir el atributo y el title del modo url:

```tsx
                        readOnly={readOnly}
```

y cambiar el `title` del `<td>`:

```tsx
                      title={ticketKey ? t('sprint.openTicket', { ticket: ticketKey }) : linkUrl ? t('regression.openLink') : undefined}
```

3f. Ocultar "+ Fila" en readOnly:

```tsx
      {!searchQuery.trim() && !readOnly && (
```

3g. Añadir la clave i18n en `src/i18n/es.json` (junto a las claves `sprint.*`):

```json
  "regression.openLink": "Abrir enlace",
```

y en `src/i18n/en.json`:

```json
  "regression.openLink": "Open link",
```

- [ ] **Step 4: Ejecutar los tests**

Run: `npm test -- src/components/TrackerGrid.test.tsx src/i18n/keyParity.test.ts`
Expected: PASS (11 tests de TrackerGrid + 2 de paridad).

- [ ] **Step 5: Suite completa y commit**

Run: `npm test`
Expected: `Tests 236 passed`.

```bash
git add src/components/TrackerGrid.tsx src/components/TrackerGrid.test.tsx src/i18n/es.json src/i18n/en.json
git commit -m "feat(tracker): url link mode and readOnly support in TrackerGrid

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

