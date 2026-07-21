# Tracker Base URL Config Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que ctrl+click en una celda de ticket del Sprint Tracker abra el ticket en Jira, mediante un botón ⚙ para configurar la URL base, migración de la clave huérfana pre-Vercel, y una guardia que impida URLs relativas.

**Architecture:** Todo vive en `TrackerGrid.tsx` (componente compartido por Sprint y Regression Tracker). La URL base se persiste en localStorage (`acgen_tracker_base_url`) vía el hook `useLocalStorage` existente. La migración lee la clave huérfana `acgen_jira_base_url` una sola vez al montar en modo jira. La guardia hace que `getLinkUrl` devuelva `null` sin URL base.

**Tech Stack:** React 18 + TypeScript, Vitest + React Testing Library, i18n JSON es/en con test de paridad de claves.

**Spec:** `docs/superpowers/specs/2026-07-21-tracker-base-url-design.md`

## Global Constraints

- Rama de trabajo: `fix/tracker-base-url` (ya creada, contiene el commit de la spec).
- Cero dependencias nuevas.
- Toda cadena visible nueva va a `src/i18n/es.json` **y** `src/i18n/en.json` (el test `keyParity.test.ts` falla si falta una).
- Los tests de `TrackerGrid.test.tsx` asertan textos en español (el `beforeEach` ya fija `acgen_lang` a `'es'`).
- `useLocalStorage` serializa con `JSON.stringify` — los valores en localStorage llevan comillas JSON (`'"https://..."'`). La clave antigua `acgen_jira_base_url` también se escribió así.
- La clave antigua NUNCA se borra ni modifica.
- Comandos: tests `npm test`, lint `npm run lint`, build `npm run build` (desde `acgen/`).
- Test dirigido: `npx vitest run src/components/TrackerGrid.test.tsx`.

---

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

### Task 4: Verificación completa + sync de docs

**Files:**
- Modify: `AGENTS.md:62` (recuento de tests) y tabla de historial (línea ~376, añadir fila)
- Modify: `README.md:86` (recuento de tests)

**Interfaces:**
- Consumes: suite completa en verde tras Tasks 1-3 (376 existentes + 9 nuevos = 385 en 40 archivos).
- Produces: docs sincronizados; rama lista para PR.

- [ ] **Step 1: Suite completa, lint y build**

Run: `npm test` → Expected: `Tests  385 passed (385)`, `Test Files  40 passed (40)`.
Run: `npm run lint` → Expected: sin errores.
Run: `npm run build` → Expected: build OK sin errores de tipos.

Si el recuento real difiere de 385, usar el número real en los pasos siguientes.

- [ ] **Step 2: Actualizar AGENTS.md**

Línea 62: `**Total: 376 tests across 40 files.**` → `**Total: 385 tests across 40 files.**`

Añadir fila al final de la tabla de historial (tras la fila "Regression Tracker: 2 platform tabs"):

```markdown
| Sprint Tracker: enlaces de ticket rotos | 2026-07-21 | Los tickets abrían la propia app: `acgen_tracker_base_url` no tenía escritores desde la eliminación de Jira (`4c258a3`) y el enlace salía relativo (`/browse/KEY` → rewrite SPA). Fix en `TrackerGrid`: guardia (`getLinkUrl` → `null` sin base URL, celdas sin estilo de enlace + title de aviso), migración one-shot de la clave huérfana `acgen_jira_base_url` (intacta, criterio datos-Android), y botón ⚙ (solo modo jira) con input inline que persiste normalizando barras finales. 376 → 385 tests. |
```

- [ ] **Step 3: Actualizar README.md**

Línea 86: `| Tests | Vitest + React Testing Library (376 tests) |` → `(385 tests)`.

- [ ] **Step 4: Commit**

```bash
git add AGENTS.md README.md
git commit -m "docs: sync test counts and the tracker base URL fix into AGENTS.md/README"
```
