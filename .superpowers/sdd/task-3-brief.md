### Task 3: Botón ⚙ + input inline de configuración

**Files:**
- Modify: `src/components/TrackerGrid.tsx` (estado nuevo, botón en la barra de pestañas línea ~205, input bajo la barra)
- Modify: `src/components/TrackerGrid.test.tsx` (4 tests nuevos)
- Modify: `src/i18n/es.json`, `src/i18n/en.json` (claves `sprint.trackerUrlSettings`, `sprint.trackerUrlPlaceholder`)

**Interfaces:**
- Consumes: `storedBaseUrl` / `setStoredBaseUrl` (Task 2), `baseUrl` normalizado, `t()`.
- Produces: botón `⚙` con `title={t('sprint.trackerUrlSettings')}` visible solo en modo jira; input con `placeholder={t('sprint.trackerUrlPlaceholder')}`; guardar normaliza barras finales.

- [ ] **Step 1: Escribir los 4 tests (fallarán)**

Nuevo describe al final de `TrackerGrid.test.tsx`:

```tsx
describe('TrackerGrid — configuración de URL base (⚙)', () => {
  it('el botón ⚙ no aparece en modo url', () => {
    renderGrid({ linkMode: 'url' });
    expect(screen.queryByTitle('Configurar URL del tracker')).not.toBeInTheDocument();
  });

  it('⚙ abre el input y Enter guarda normalizando la barra final', () => {
    renderGrid();
    fireEvent.click(screen.getByTitle('Configurar URL del tracker'));
    const input = screen.getByPlaceholderText('https://jira.example.com');
    fireEvent.change(input, { target: { value: 'https://jira.miempresa.com/' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(JSON.parse(localStorage.getItem('acgen_tracker_base_url')!)).toBe('https://jira.miempresa.com');
    expect(screen.queryByPlaceholderText('https://jira.example.com')).not.toBeInTheDocument();
  });

  it('guardar la URL activa los enlaces de ticket al momento', () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    const grid = makeGrid();
    grid[0][0] = 'ABC-123 Login roto';
    renderGrid({ tabGrid: { one: grid, two: makeGrid() } });
    fireEvent.click(screen.getByTitle('Configurar URL del tracker'));
    const input = screen.getByPlaceholderText('https://jira.example.com');
    fireEvent.change(input, { target: { value: 'https://jira.miempresa.com' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.click(screen.getByDisplayValue('ABC-123 Login roto'), { ctrlKey: true });
    expect(open).toHaveBeenCalledWith('https://jira.miempresa.com/browse/ABC-123', '_blank', 'noopener,noreferrer');
  });

  it('Escape cierra sin guardar', () => {
    renderGrid();
    fireEvent.click(screen.getByTitle('Configurar URL del tracker'));
    const input = screen.getByPlaceholderText('https://jira.example.com');
    fireEvent.change(input, { target: { value: 'https://no-guardar.com' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    fireEvent.blur(input);
    expect(localStorage.getItem('acgen_tracker_base_url')).toBeNull();
  });
});
```

- [ ] **Step 2: Verificar que fallan**

Run: `npx vitest run src/components/TrackerGrid.test.tsx`
Expected: FAIL — 3 de los 4 (el de modo url pasa de serie; protege el alcance).

- [ ] **Step 3: Implementar botón, input y guardado**

Estado nuevo en el cuerpo del componente (junto al resto de `useState`, línea ~61):

```tsx
  const [showUrlConfig, setShowUrlConfig] = useState(false);
  const [draftBaseUrl, setDraftBaseUrl] = useState('');
  const urlConfigCancelled = useRef(false);
```

Handlers (tras el efecto de migración de Task 2):

```tsx
  const saveBaseUrl = () => {
    setStoredBaseUrl(draftBaseUrl.trim().replace(/\/+$/, ''));
    setShowUrlConfig(false);
  };
```

Botón ⚙ en la barra de pestañas, inmediatamente después del `<a>` de SnapLink (línea ~214, dentro del div `.sprint-tabs`). Ámbar (`--warning`) cuando falta configuración, gris (`--text-3`) cuando ya está:

```tsx
        {linkMode === 'jira' && (
          <button
            type="button"
            className="btn-ghost"
            onClick={() => {
              urlConfigCancelled.current = false;
              setDraftBaseUrl(storedBaseUrl);
              setShowUrlConfig((v) => !v);
            }}
            title={t('sprint.trackerUrlSettings')}
            aria-label={t('sprint.trackerUrlSettings')}
            style={{ padding: '6px 10px', fontSize: 14, color: baseUrl ? 'var(--text-3)' : 'var(--warning)' }}
          >
            ⚙
          </button>
        )}
```

Input inline, inmediatamente después del cierre del div `.sprint-tabs` (antes del div de búsqueda, línea ~217):

```tsx
      {linkMode === 'jira' && showUrlConfig && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
          <input
            type="text"
            autoFocus
            placeholder={t('sprint.trackerUrlPlaceholder')}
            value={draftBaseUrl}
            onChange={(e) => setDraftBaseUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveBaseUrl();
              if (e.key === 'Escape') {
                urlConfigCancelled.current = true;
                setShowUrlConfig(false);
              }
            }}
            onBlur={() => {
              if (urlConfigCancelled.current) {
                urlConfigCancelled.current = false;
                return;
              }
              saveBaseUrl();
            }}
            style={{
              width: 320, height: 30, padding: '0 10px', fontSize: 12,
              fontFamily: 'var(--font-ui)', background: 'var(--surface-2)',
              color: 'var(--text)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)', outline: 'none',
            }}
          />
        </div>
      )}
```

- [ ] **Step 4: Añadir las claves i18n en ambos diccionarios**

`src/i18n/es.json`, tras `"sprint.trackerUrlMissing"`:

```json
  "sprint.trackerUrlSettings": "Configurar URL del tracker",
  "sprint.trackerUrlPlaceholder": "https://jira.example.com",
```

`src/i18n/en.json`, misma posición:

```json
  "sprint.trackerUrlSettings": "Configure tracker URL",
  "sprint.trackerUrlPlaceholder": "https://jira.example.com",
```

- [ ] **Step 5: Verificar que pasan**

Run: `npx vitest run src/components/TrackerGrid.test.tsx src/i18n/keyParity.test.ts`
Expected: PASS (todos).

- [ ] **Step 6: Commit**

```bash
git add src/components/TrackerGrid.tsx src/components/TrackerGrid.test.tsx src/i18n/es.json src/i18n/en.json
git commit -m "feat(tracker): gear button + inline input to configure the Jira base URL"
```

---

