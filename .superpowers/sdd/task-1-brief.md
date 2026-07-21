### Task 1: Guardia — sin URL base no hay enlace (ni URL relativa)

**Files:**
- Modify: `src/components/TrackerGrid.tsx:151-158` (`getLinkUrl`) y `:322-336` (title de celda)
- Modify: `src/components/TrackerGrid.test.tsx` (2 tests nuevos + 1 existente ajustado)
- Modify: `src/i18n/es.json`, `src/i18n/en.json` (clave `sprint.trackerUrlMissing`)

**Interfaces:**
- Consumes: `baseUrl` (string ya normalizado sin barra final, línea 149), `TICKET_KEY_PATTERN`, `t()` de i18n.
- Produces: `getLinkUrl(value)` devuelve `null` en modo jira cuando `baseUrl === ''`. Las celdas de ticket sin configurar muestran `title` con la clave i18n `sprint.trackerUrlMissing`.

- [ ] **Step 1: Ajustar el test existente que asume enlace sin baseUrl**

En `TrackerGrid.test.tsx`, el test `'jira cells keep showing the full value (no name overlay)'` (línea ~89) aserta `color: var(--accent)` sin configurar baseUrl. Tras la guardia eso será `var(--text)`. Añadir la primera línea:

```tsx
  it('jira cells keep showing the full value (no name overlay)', () => {
    localStorage.setItem('acgen_tracker_base_url', JSON.stringify('https://jira.example.com'));
    const grid = makeGrid();
    grid[0][0] = 'ABC-123 Login roto';
    renderGrid({ tabGrid: { one: grid, two: makeGrid() } });
    const input = screen.getByDisplayValue('ABC-123 Login roto') as HTMLInputElement;
    expect(input.style.color).toBe('var(--accent)');
    expect(input.closest('td')!.querySelector('span')).toBeNull();
  });
```

- [ ] **Step 2: Escribir los 2 tests nuevos (fallarán)**

Añadir dentro del describe `'TrackerGrid — jira mode (extracted Sprint Tracker behavior)'`:

```tsx
  it('sin URL base, la celda de ticket no es enlace ni abre nada con ctrl+click', () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    const grid = makeGrid();
    grid[0][0] = 'ABC-123 Login roto';
    renderGrid({ tabGrid: { one: grid, two: makeGrid() } });
    const input = screen.getByDisplayValue('ABC-123 Login roto') as HTMLInputElement;
    fireEvent.click(input, { ctrlKey: true });
    expect(open).not.toHaveBeenCalled();
    expect(input.style.color).toBe('var(--text)');
  });

  it('sin URL base, la celda de ticket muestra el hint de configuración en el title', () => {
    const grid = makeGrid();
    grid[0][0] = 'ABC-123 Login roto';
    renderGrid({ tabGrid: { one: grid, two: makeGrid() } });
    const td = screen.getByDisplayValue('ABC-123 Login roto').closest('td')!;
    expect(td).toHaveAttribute('title', 'Configura la URL del tracker (⚙) para abrir tickets');
  });
```

- [ ] **Step 3: Verificar que fallan**

Run: `npx vitest run src/components/TrackerGrid.test.tsx`
Expected: FAIL — los 2 tests nuevos (el primero porque hoy `getLinkUrl` devuelve `/browse/ABC-123` y sí llama a `window.open`; el segundo porque el title es `undefined`).

- [ ] **Step 4: Implementar la guardia**

En `TrackerGrid.tsx`, `getLinkUrl` (línea 151):

```tsx
  const getLinkUrl = (value: string): string | null => {
    if (linkMode === 'jira') {
      if (!baseUrl) return null;
      const m = value.match(TICKET_KEY_PATTERN);
      return m ? `${baseUrl}/browse/${m[1]}` : null;
    }
    const m = value.match(URL_CELL_PATTERN);
    return m ? m[2] : null;
  };
```

En el render de celda (línea ~322), añadir la detección de ticket sin configurar y usarla en el `title`:

```tsx
                  const linkUrl = ci === 0 ? getLinkUrl(value) : null;
                  const ticketKey = linkMode === 'jira' && linkUrl ? value.match(TICKET_KEY_PATTERN)![1] : null;
                  const unconfiguredTicket = ci === 0 && linkMode === 'jira' && !baseUrl && TICKET_KEY_PATTERN.test(value);
```

y en el `<td>` (línea ~336):

```tsx
                      title={ticketKey ? t('sprint.openTicket', { ticket: ticketKey }) : linkUrl ? t('regression.openLink') : unconfiguredTicket ? t('sprint.trackerUrlMissing') : undefined}
```

- [ ] **Step 5: Añadir la clave i18n en ambos diccionarios**

`src/i18n/es.json`, tras `"sprint.openTicket"` (línea 169):

```json
  "sprint.trackerUrlMissing": "Configura la URL del tracker (⚙) para abrir tickets",
```

`src/i18n/en.json`, misma posición:

```json
  "sprint.trackerUrlMissing": "Set the tracker URL (⚙) to open tickets",
```

- [ ] **Step 6: Verificar que pasan**

Run: `npx vitest run src/components/TrackerGrid.test.tsx src/i18n/keyParity.test.ts`
Expected: PASS (todos, incluidos los 2 nuevos y la paridad i18n).

- [ ] **Step 7: Commit**

```bash
git add src/components/TrackerGrid.tsx src/components/TrackerGrid.test.tsx src/i18n/es.json src/i18n/en.json
git commit -m "fix(tracker): never build a relative /browse URL when base URL is unset"
```

---

