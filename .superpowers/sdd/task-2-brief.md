### Task 2: Migración de la clave huérfana `acgen_jira_base_url`

**Files:**
- Modify: `src/components/TrackerGrid.tsx:149` (refactor a destructuring + efecto de migración)
- Modify: `src/components/TrackerGrid.test.tsx` (3 tests nuevos)

**Interfaces:**
- Consumes: `useLocalStorage(STORAGE_KEYS.TRACKER_BASE_URL, '')` (ya importado), `useRef`/`useEffect` (ya importados en línea 1).
- Produces: `storedBaseUrl: string` y `setStoredBaseUrl(value: string)` disponibles en el cuerpo del componente (Task 3 los usa). Al montar en modo jira con clave nueva vacía y clave antigua presente, la copia.

- [ ] **Step 1: Escribir los 3 tests (fallarán)**

Nuevo describe al final de `TrackerGrid.test.tsx`:

```tsx
describe('TrackerGrid — migración de la clave antigua acgen_jira_base_url', () => {
  it('migra la URL huérfana al montar en modo jira y los enlaces funcionan', () => {
    localStorage.setItem('acgen_jira_base_url', JSON.stringify('https://jira.legacy.com'));
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    const grid = makeGrid();
    grid[0][0] = 'ABC-123 Login roto';
    renderGrid({ tabGrid: { one: grid, two: makeGrid() } });
    expect(JSON.parse(localStorage.getItem('acgen_tracker_base_url')!)).toBe('https://jira.legacy.com');
    expect(localStorage.getItem('acgen_jira_base_url')).toBe(JSON.stringify('https://jira.legacy.com'));
    fireEvent.click(screen.getByDisplayValue('ABC-123 Login roto'), { ctrlKey: true });
    expect(open).toHaveBeenCalledWith('https://jira.legacy.com/browse/ABC-123', '_blank', 'noopener,noreferrer');
  });

  it('no sobrescribe una URL base ya configurada en la clave nueva', () => {
    localStorage.setItem('acgen_tracker_base_url', JSON.stringify('https://jira.nueva.com'));
    localStorage.setItem('acgen_jira_base_url', JSON.stringify('https://jira.legacy.com'));
    renderGrid();
    expect(JSON.parse(localStorage.getItem('acgen_tracker_base_url')!)).toBe('https://jira.nueva.com');
  });

  it('en modo url no migra nada', () => {
    localStorage.setItem('acgen_jira_base_url', JSON.stringify('https://jira.legacy.com'));
    renderGrid({ linkMode: 'url' });
    expect(localStorage.getItem('acgen_tracker_base_url')).toBeNull();
  });
});
```

- [ ] **Step 2: Verificar que fallan**

Run: `npx vitest run src/components/TrackerGrid.test.tsx`
Expected: FAIL — el 1º (la clave nueva queda vacía y `window.open` no se llama); el 2º y 3º pasan ya de serie (protegen contra regresiones de la implementación).

- [ ] **Step 3: Implementar la migración**

En `TrackerGrid.tsx`, junto a las constantes del módulo (tras línea 8):

```tsx
const LEGACY_JIRA_BASE_URL_KEY = 'acgen_jira_base_url';

// La clave antigua se escribió con useLocalStorage (JSON.stringify); se lee
// igual y se deja intacta — mismo criterio que los datos huérfanos de Android.
function readLegacyBaseUrl(): string {
  try {
    const raw = localStorage.getItem(LEGACY_JIRA_BASE_URL_KEY);
    if (!raw) return '';
    const parsed = JSON.parse(raw);
    return typeof parsed === 'string' ? parsed : '';
  } catch {
    return '';
  }
}
```

Sustituir la línea 149 por (misma posición en el cuerpo del componente):

```tsx
  const [storedBaseUrl, setStoredBaseUrl] = useLocalStorage(STORAGE_KEYS.TRACKER_BASE_URL, '');
  const baseUrl = (storedBaseUrl || '').replace(/\/+$/, '');

  const legacyMigrationTried = useRef(false);
  useEffect(() => {
    if (legacyMigrationTried.current || linkMode !== 'jira' || storedBaseUrl) return;
    legacyMigrationTried.current = true;
    const legacy = readLegacyBaseUrl();
    if (legacy) setStoredBaseUrl(legacy);
  }, [linkMode, storedBaseUrl, setStoredBaseUrl]);
```

- [ ] **Step 4: Verificar que pasan**

Run: `npx vitest run src/components/TrackerGrid.test.tsx`
Expected: PASS (todos).

- [ ] **Step 5: Commit**

```bash
git add src/components/TrackerGrid.tsx src/components/TrackerGrid.test.tsx
git commit -m "fix(tracker): migrate orphaned acgen_jira_base_url into acgen_tracker_base_url"
```

---

