# i18n Leftovers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** English users see English in the last 5 places that still hardcode Spanish: apiService error messages, ExportBar, ErrorBoundary, HistoryModal, SearchableSelect.

**Architecture:** `apiService.ts` stays language-agnostic by throwing i18n **keys** with interpolation params attached to the Error object (`I18nError`); translation happens in the tool catch blocks, which already have `t()` in scope. `t()` returns unknown keys verbatim, so dynamic upstream API messages pass through safely. Components get `useT()` directly (all render inside `I18nProvider`); the class-based ErrorBoundary consumes the context via `static contextType`. HistoryModal's `window.confirm` is replaced by the inline 2-step confirm pattern WorkspacePicker already uses.

**Tech Stack:** React 18 + TypeScript + Vite, Vitest + @testing-library/react (jsdom), custom i18n (`src/i18n/I18nContext.tsx`, flat-key JSON dictionaries).

**Spec:** `docs/superpowers/specs/2026-07-16-i18n-leftovers-design.md`

## Global Constraints

- Both dictionaries (`src/i18n/es.json`, `src/i18n/en.json`) must keep **full key parity** (both currently have 203 keys).
- New Spanish values preserve today's user-visible literals exactly (accents included, e.g. "válido").
- TDD: every behavior change gets a failing test first. Run `npx vitest run <file>` to verify RED, then GREEN.
- Zero lint errors: `npx eslint src` must stay clean; `npx tsc --noEmit` must pass.
- Working directory: `C:\repositorio\ACGen\acgen` (branch `fix/i18n-leftovers`).
- Test language switching: `localStorage.setItem('acgen_lang', '"en"')` **before** render (value is JSON-encoded; `useLocalStorage` parses it).
- Commit messages end with:
  `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`
  `Claude-Session: https://claude.ai/code/session_01FEfGV8uF3m5h61hFbuiNJh`

---

### Task 1: apiService throws i18n keys with params

**Files:**
- Modify: `src/services/apiService.ts` (throws at lines 48, 51, 62, 65, 79, 87, 95, 155, 158, 162, 220, 224)
- Modify: `src/services/apiService.test.ts` (existing assertions at lines 81, 86, 91, 96, 113, 118, 122 match Spanish text — migrate to keys+params)
- Modify: `src/i18n/es.json`, `src/i18n/en.json` (6 new `error.*` keys)

**Interfaces:**
- Produces: `export type I18nError = Error & { params?: Record<string, string | number> }` from `src/services/apiService.ts`. Every validation/HTTP error thrown by this module has `message` = i18n key and optional `params`. Task 2 consumes this.

- [ ] **Step 1: Add the 6 new keys to both dictionaries**

In `src/i18n/es.json`, after the `"error.boundary"` entry:

```json
  "error.noTestCaseArray": "La respuesta no contiene un array de casos de prueba.",
  "error.testCaseInvalid": "El caso de prueba {n} no es un objeto válido.",
  "error.testCaseMissingFields": "El caso de prueba {n} ({key}) no tiene los campos requeridos: {fields}",
  "error.testCaseWrongTypes": "El caso de prueba {n} ({key}) tiene campos con tipo incorrecto: {fields}",
  "error.recordInvalid": "El registro {n} no es un objeto válido.",
  "error.recordNestedValue": "El registro {n} tiene un valor anidado no soportado en el campo \"{field}\".",
```

In `src/i18n/en.json`, same position:

```json
  "error.noTestCaseArray": "The response does not contain an array of test cases.",
  "error.testCaseInvalid": "Test case {n} is not a valid object.",
  "error.testCaseMissingFields": "Test case {n} ({key}) is missing required fields: {fields}",
  "error.testCaseWrongTypes": "Test case {n} ({key}) has fields with the wrong type: {fields}",
  "error.recordInvalid": "Record {n} is not a valid object.",
  "error.recordNestedValue": "Record {n} has an unsupported nested value in field \"{field}\".",
```

- [ ] **Step 2: Write the failing tests**

In `src/services/apiService.test.ts`, add a new describe block:

```ts
import type { I18nError } from './apiService';

describe('i18n error keys', () => {
  it('validateTestCases throws the missing-fields key with params', () => {
    const items = [{ key: 'TC-1', summary: 's', priority: 'p', type: 't', preconditions: 'pre', testSteps: ['a'], expectedResult: '' }];
    let caught: I18nError | null = null;
    try { validateTestCases(items); } catch (e) { caught = e as I18nError; }
    expect(caught?.message).toBe('error.testCaseMissingFields');
    expect(caught?.params).toEqual({ n: 1, key: 'TC-1', fields: 'expectedResult' });
  });

  it('validateTestCases throws the wrong-type key with params', () => {
    const items = [{ key: 'TC-1', summary: 's', priority: 42, type: 't', preconditions: 'pre', testSteps: ['a'], expectedResult: 'r' }];
    let caught: I18nError | null = null;
    try { validateTestCases(items); } catch (e) { caught = e as I18nError; }
    expect(caught?.message).toBe('error.testCaseWrongTypes');
    expect(caught?.params).toEqual({ n: 1, key: 'TC-1', fields: 'priority' });
  });

  it('validateTestCases throws the invalid-object key with the index', () => {
    let caught: I18nError | null = null;
    try { validateTestCases([{ key: 'TC-1', summary: 's', priority: 'p', type: 't', preconditions: 'pre', testSteps: ['a'], expectedResult: 'r' }, 'nope']); } catch (e) { caught = e as I18nError; }
    expect(caught?.message).toBe('error.testCaseInvalid');
    expect(caught?.params).toEqual({ n: 2 });
  });

  it('validateTestDataRows throws the nested-value key with params', () => {
    let caught: I18nError | null = null;
    try { validateTestDataRows([{ nombre: 'x', direccion: { calle: 'y' } }]); } catch (e) { caught = e as I18nError; }
    expect(caught?.message).toBe('error.recordNestedValue');
    expect(caught?.params).toEqual({ n: 1, field: 'direccion' });
  });

  it('validateTestDataRows throws the invalid-record key with the index', () => {
    let caught: I18nError | null = null;
    try { validateTestDataRows(['not-an-object']); } catch (e) { caught = e as I18nError; }
    expect(caught?.message).toBe('error.recordInvalid');
    expect(caught?.params).toEqual({ n: 1 });
  });

  it('extractJsonArray throws error.invalidJson on garbage', () => {
    expect(() => extractJsonArray('not json at all')).toThrow('error.invalidJson');
  });

  it('every thrown key exists in both dictionaries', async () => {
    const es = (await import('../i18n/es.json')).default as Record<string, string>;
    const en = (await import('../i18n/en.json')).default as Record<string, string>;
    for (const key of ['error.invalidJson', 'error.noTestCaseArray', 'error.invalidFormat', 'error.testCaseInvalid', 'error.testCaseMissingFields', 'error.testCaseWrongTypes', 'error.apiKey', 'error.rateLimit', 'error.modelDecommissioned', 'error.recordInvalid', 'error.recordNestedValue']) {
      expect(es[key], `missing in es: ${key}`).toBeTruthy();
      expect(en[key], `missing in en: ${key}`).toBeTruthy();
    }
  });
});
```

Note: `validateTestCases`, `validateTestDataRows`, `extractJsonArray` are already imported at the top of this test file.

- [ ] **Step 3: Run to verify RED**

Run: `npx vitest run src/services/apiService.test.ts`
Expected: the new tests FAIL (messages are still Spanish literals, no `params`). The dictionary-keys test PASSES (keys were added in Step 1) — that is fine, it guards Step 1's work.

- [ ] **Step 4: Implement in apiService.ts**

Add after the imports (line 6, next to `type ToolType`):

```ts
/** Errors whose message is an i18n key; params feed t()'s interpolation. */
export type I18nError = Error & { params?: Record<string, string | number> };

function i18nError(key: string, params?: Record<string, string | number>): I18nError {
  return params ? Object.assign(new Error(key), { params }) : new Error(key);
}
```

Replace each throw:

| Line (pre-edit) | New code |
|---|---|
| 48, 51 | `throw i18nError('error.invalidJson');` |
| 62 | `throw i18nError('error.noTestCaseArray');` |
| 65 | `throw i18nError('error.invalidFormat');` |
| 79 | `throw i18nError('error.testCaseInvalid', { n: i + 1 });` |
| 87 | `throw i18nError('error.testCaseMissingFields', { n: i + 1, key: String(tc.key \|\| `#${i + 1}`), fields: missing.join(', ') });` |
| 95 | `throw i18nError('error.testCaseWrongTypes', { n: i + 1, key: String(tc.key \|\| `#${i + 1}`), fields: wrongType.join(', ') });` |
| 155 | `throw Object.assign(i18nError('error.apiKey'), apiError);` |
| 158 | `throw Object.assign(i18nError('error.rateLimit'), apiError);` |
| 162 | `throw Object.assign(i18nError('error.modelDecommissioned'), apiError);` |
| 166 | unchanged (`apiError.message` is dynamic upstream text) |
| 220 | `throw i18nError('error.recordInvalid', { n: i + 1 });` |
| 224 | `throw i18nError('error.recordNestedValue', { n: i + 1, field });` |

- [ ] **Step 5: Migrate the existing Spanish-text assertions**

In `src/services/apiService.test.ts`:

- Line 81/86: `expect(() => validateTestCases(items)).toThrow(/testSteps/)` → catch and assert `caught?.message === 'error.testCaseWrongTypes'` (line 81 case) / `'error.testCaseMissingFields'` (line 86 case) and `expect(String(caught?.params?.fields)).toContain('testSteps')`. Read each test's fixture to pick the right key: missing/empty field → MissingFields, present-but-wrong-type → WrongTypes.
- Line 91 (`/priority/`): same pattern, assert the key and `params.fields` contains `'priority'`.
- Line 96 (`/caso de prueba 2/`): assert `caught?.message === 'error.testCaseInvalid'` (or the applicable key per fixture) and `caught?.params?.n === 2`.
- Line 113 (`/direccion/`): assert key `'error.recordNestedValue'` and `caught?.params?.field === 'direccion'`.
- Line 118 (`/tags/`): same, `field === 'tags'`.
- Line 122 (`/registro 1/`): assert key `'error.recordInvalid'` and `params.n === 1`.

- [ ] **Step 6: Run to verify GREEN**

Run: `npx vitest run src/services/apiService.test.ts`
Expected: ALL PASS.

- [ ] **Step 7: Commit**

```bash
git add src/services/apiService.ts src/services/apiService.test.ts src/i18n/es.json src/i18n/en.json
git commit -m "feat(i18n): apiService throws i18n keys with params instead of Spanish literals"
```

---

### Task 2: Tool catch blocks translate I18nError

**Files:**
- Modify (identical one-line change in each): `src/components/AcceptanceCriteriaTool.tsx:73`, `BugReportTool.tsx:122`, `EdgeCaseTool.tsx:54`, `ConverterTool.tsx:49`, `RefinerTool.tsx:50`, `TestCaseTool.tsx:75`, `TestDataTool.tsx:157`, `UserStoryTool.tsx:50`
- Create: `src/components/errorTranslation.test.tsx`

**Interfaces:**
- Consumes: `I18nError` from `src/services/apiService.ts` (Task 1).
- Produces: nothing downstream.

- [ ] **Step 1: Write the failing test**

`src/components/errorTranslation.test.tsx` — mock fetch to fail with 401 so `streamWithGroq` throws `error.apiKey`, render in **English**, assert the translated banner. Crib the render/mock scaffolding style from `src/components/tools.confidential.test.tsx` (provider wrapper, fetch mock):

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { I18nProvider } from '../i18n/I18nContext';
import { AcceptanceCriteriaTool } from './AcceptanceCriteriaTool';

describe('API errors render translated', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('acgen_lang', '"en"');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ error: { message: 'Invalid API Key' } }),
    }));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('shows the English error.apiKey text when the API returns 401', async () => {
    render(
      <I18nProvider>
        <AcceptanceCriteriaTool apiKey="bad-key" model="m" />
      </I18nProvider>
    );
    await userEvent.type(screen.getByRole('textbox'), 'some requirement');
    await userEvent.click(screen.getByRole('button', { name: /generate/i }));
    await waitFor(() => {
      expect(screen.getByText('Invalid API key. Verify your key and try again.')).toBeInTheDocument();
    });
  });
});
```

Adjust the concrete props/roles to what `AcceptanceCriteriaTool` actually requires — check `tools.confidential.test.tsx` for the exact prop set and generate-button query it already uses, and reuse them verbatim.

- [ ] **Step 2: Run to verify RED**

Run: `npx vitest run src/components/errorTranslation.test.tsx`
Expected: FAIL — the banner shows the raw key `error.apiKey` (Task 1 made messages keys; nothing translates them yet).

- [ ] **Step 3: Implement — the same one-line change in all 8 tools**

In each file listed above, the catch currently reads:

```ts
const message = err instanceof Error ? err.message : t('error.unexpected');
```

Change to:

```ts
const message = err instanceof Error ? t(err.message, (err as I18nError).params) : t('error.unexpected');
```

and add to each file's imports:

```ts
import type { I18nError } from '../services/apiService';
```

(`t()` returns unknown keys/messages verbatim, so upstream dynamic messages still display.)

- [ ] **Step 4: Run to verify GREEN + no regressions**

Run: `npx vitest run src/components`
Expected: ALL PASS (confidential suites exercise these same catch paths).

- [ ] **Step 5: Commit**

```bash
git add src/components/*.tsx
git commit -m "feat(i18n): tool catch blocks translate I18nError keys via t()"
```

---

### Task 3: ExportBar

**Files:**
- Modify: `src/components/ExportBar.tsx` (whole file is 33 lines; shown below)
- Create: `src/components/ExportBar.test.tsx`
- Modify: `src/i18n/es.json`, `src/i18n/en.json` (4 new `export.*` keys)

**Interfaces:** none consumed/produced beyond the keys.

- [ ] **Step 1: Add keys**

`es.json`:

```json
  "export.copy": "Copiar",
  "export.pdf": "Descargar PDF",
  "export.csv": "Descargar CSV",
  "export.tsv": "Copiar TSV",
```

`en.json`:

```json
  "export.copy": "Copy",
  "export.pdf": "Download PDF",
  "export.csv": "Download CSV",
  "export.tsv": "Copy TSV",
```

- [ ] **Step 2: Write the failing test**

`src/components/ExportBar.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { I18nProvider } from '../i18n/I18nContext';
import { ExportBar } from './ExportBar';

function renderEn(ui: React.ReactElement) {
  localStorage.setItem('acgen_lang', '"en"');
  return render(<I18nProvider>{ui}</I18nProvider>);
}

describe('ExportBar i18n', () => {
  afterEach(() => localStorage.clear());

  it('renders English labels', () => {
    renderEn(<ExportBar formats={['copy', 'pdf', 'csv', 'tsv']} onExport={() => {}} />);
    expect(screen.getByRole('button', { name: 'Copy' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download PDF' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download CSV' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy TSV' })).toBeInTheDocument();
  });

  it('keeps proper nouns literal', () => {
    renderEn(<ExportBar formats={['markdown', 'jirawiki']} onExport={() => {}} />);
    expect(screen.getByRole('button', { name: 'Markdown' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Jira Wiki' })).toBeInTheDocument();
  });

  it('shows the copied state translated', () => {
    renderEn(<ExportBar formats={['copy']} onExport={() => {}} copied />);
    expect(screen.getByRole('button', { name: 'Copied!' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run to verify RED**

Run: `npx vitest run src/components/ExportBar.test.tsx`
Expected: FAIL — labels render in Spanish.

- [ ] **Step 4: Implement**

Replace `src/components/ExportBar.tsx` with:

```tsx
import { useT } from '../i18n/I18nContext';

interface ExportBarProps {
  formats: string[];
  onExport: (format: string) => void;
  copied?: boolean;
}

// Values are i18n keys, except proper nouns, which t() passes through verbatim.
const FORMAT_LABELS: Record<string, string> = {
  copy: 'export.copy',
  markdown: 'Markdown',
  jirawiki: 'Jira Wiki',
  pdf: 'export.pdf',
  csv: 'export.csv',
  tsv: 'export.tsv',
};

export function ExportBar({ formats, onExport, copied }: ExportBarProps) {
  const t = useT();
  if (formats.length === 0) return null;

  return (
    <div className="export-bar" style={{ display: 'flex', gap: 8, marginTop: 12 }}>
      {formats.map((fmt) => (
        <button
          key={fmt}
          type="button"
          className={`btn-ghost ${fmt === 'copy' && copied ? 'btn-copied' : ''}`}
          onClick={() => onExport(fmt)}
        >
          {fmt === 'copy' && copied ? t('common.copied') : t(FORMAT_LABELS[fmt] || fmt)}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Run to verify GREEN, then check all ExportBar consumers still pass**

Run: `npx vitest run src/components`
Expected: ALL PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/ExportBar.tsx src/components/ExportBar.test.tsx src/i18n/es.json src/i18n/en.json
git commit -m "feat(i18n): translate ExportBar labels"
```

---

### Task 4: ErrorBoundary

**Files:**
- Modify: `src/i18n/I18nContext.tsx` (export the context object)
- Modify: `src/components/ErrorBoundary.tsx`
- Modify: `src/components/ErrorBoundary.test.tsx` (3 existing tests; add 1)

**Interfaces:**
- Produces: `export { I18nContext }` from `src/i18n/I18nContext.tsx` (type `React.Context<I18nContextValue | null>`).

- [ ] **Step 1: Write the failing test**

Add to `src/components/ErrorBoundary.test.tsx` (match the existing crash-component helper already in that file — it has one for the "catches crash" test; reuse it):

```tsx
it('renders the fallback in English when lang is en', () => {
  localStorage.setItem('acgen_lang', '"en"');
  render(
    <I18nProvider>
      <ErrorBoundary><Bomb /></ErrorBoundary>
    </I18nProvider>
  );
  expect(screen.getByText('Something went wrong. Please reload or try again.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  localStorage.clear();
});
```

(`Bomb` = whatever throwing component the existing tests define; import `I18nProvider` at the top.)

- [ ] **Step 2: Run to verify RED**

Run: `npx vitest run src/components/ErrorBoundary.test.tsx`
Expected: the new test FAILS (Spanish literals); the existing 3 still pass.

- [ ] **Step 3: Implement**

In `src/i18n/I18nContext.tsx`, change the context declaration (line 16) to export it:

```ts
export const I18nContext = createContext<I18nContextValue | null>(null);
```

(Also export the `I18nContextValue` interface.)

In `src/components/ErrorBoundary.tsx`:

```tsx
import { Component } from 'react';
import type { ErrorInfo, ReactNode, ContextType } from 'react';
import { I18nContext } from '../i18n/I18nContext';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  static contextType = I18nContext;
  declare context: ContextType<typeof I18nContext>;

  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReset = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    if (this.state.error) {
      // Defensive Spanish fallback: the boundary must never crash while rendering a crash.
      const t = this.context?.t ?? ((key: string) => key === 'error.boundary'
        ? 'Algo salio mal. Por favor, recarga la pagina o intenta de nuevo.'
        : 'Reintentar');
      return (
        <div className="error-boundary-fallback">
          <h2>{t('error.boundary')}</h2>
          <p>{this.state.error.message}</p>
          <button type="button" className="btn" onClick={this.handleReset}>
            {t('common.retry')}
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
```

Note the existing 3 tests render ErrorBoundary **without** a provider — the defensive fallback keeps them meaningful; do not wrap them.

- [ ] **Step 4: Run to verify GREEN**

Run: `npx vitest run src/components/ErrorBoundary.test.tsx`
Expected: 4 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/i18n/I18nContext.tsx src/components/ErrorBoundary.tsx src/components/ErrorBoundary.test.tsx
git commit -m "feat(i18n): ErrorBoundary fallback via I18nContext contextType"
```

---

### Task 5: HistoryModal — i18n + inline 2-step confirm

**Files:**
- Modify: `src/components/HistoryModal.tsx`
- Create: `src/components/HistoryModal.test.tsx`
- Modify: `src/i18n/es.json`, `src/i18n/en.json` (5 new `history.*` keys)

**Interfaces:** none.

- [ ] **Step 1: Add keys**

`es.json`:

```json
  "history.title": "Historial",
  "history.clearAll": "Borrar todo",
  "history.confirmClear": "¿Confirmar borrado?",
  "history.empty": "No hay entradas en el historial todavía.",
  "history.load": "Cargar",
```

`en.json`:

```json
  "history.title": "History",
  "history.clearAll": "Clear all",
  "history.confirmClear": "Confirm deletion?",
  "history.empty": "No history entries yet.",
  "history.load": "Load",
```

- [ ] **Step 2: Write the failing tests**

`src/components/HistoryModal.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { I18nProvider } from '../i18n/I18nContext';
import { HistoryModal } from './HistoryModal';
import type { HistoryEntry } from '../types';

const entries: HistoryEntry[] = [
  { id: '1', timestamp: 1700000000000, inputPreview: 'algo', output: 'salida' },
];

function renderModal(props: Partial<Parameters<typeof HistoryModal>[0]> = {}, lang: 'es' | 'en' = 'es') {
  localStorage.setItem('acgen_lang', JSON.stringify(lang));
  return render(
    <I18nProvider>
      <HistoryModal entries={entries} onLoad={() => {}} onClearAll={() => {}} onClose={() => {}} {...props} />
    </I18nProvider>
  );
}

describe('HistoryModal', () => {
  afterEach(() => localStorage.clear());

  it('clear-all requires a second confirming click', async () => {
    const onClearAll = vi.fn();
    renderModal({ onClearAll });
    await userEvent.click(screen.getByRole('button', { name: 'Borrar todo' }));
    expect(onClearAll).not.toHaveBeenCalled();
    const confirmBtn = screen.getByRole('button', { name: '¿Confirmar borrado?' });
    await userEvent.click(confirmBtn);
    expect(onClearAll).toHaveBeenCalledTimes(1);
  });

  it('renders in English', () => {
    renderModal({}, 'en');
    expect(screen.getByText('History')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear all' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Load' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });

  it('shows the translated empty state', () => {
    localStorage.setItem('acgen_lang', '"en"');
    render(
      <I18nProvider>
        <HistoryModal entries={[]} onLoad={() => {}} onClearAll={() => {}} onClose={() => {}} />
      </I18nProvider>
    );
    expect(screen.getByText('No history entries yet.')).toBeInTheDocument();
  });
});
```

(Check `src/types` for the exact `HistoryEntry` shape before finalizing the fixture — adjust fields if they differ.)

- [ ] **Step 3: Run to verify RED**

Run: `npx vitest run src/components/HistoryModal.test.tsx`
Expected: FAIL — `window.confirm` path (jsdom's confirm returns false → `onClearAll` never fires; there is no "¿Confirmar borrado?" button), and English strings absent.

- [ ] **Step 4: Implement**

Replace `src/components/HistoryModal.tsx`'s component body (keep `formatDate` as is):

```tsx
import { useState } from 'react';
import type { HistoryEntry } from '../types';
import { useT } from '../i18n/I18nContext';

// ... formatDate unchanged ...

export function HistoryModal({ entries, onLoad, onClearAll, onClose }: HistoryModalProps) {
  const t = useT();
  const [confirmingClear, setConfirmingClear] = useState(false);

  return (
    <div className="history-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="history-modal">
        <div className="history-modal-header">
          <span className="history-modal-title">{t('history.title')}</span>
          <div style={{ display: 'flex', gap: 8 }}>
            {entries.length > 0 && (
              <button
                type="button"
                className="btn-ghost"
                style={{ fontSize: 12, padding: '4px 10px' }}
                onClick={() => {
                  if (confirmingClear) {
                    onClearAll();
                    setConfirmingClear(false);
                  } else {
                    setConfirmingClear(true);
                  }
                }}
              >
                {confirmingClear ? t('history.confirmClear') : t('history.clearAll')}
              </button>
            )}
            <button type="button" className="history-close-btn" onClick={onClose} aria-label={t('common.close')}>✕</button>
          </div>
        </div>

        <div className="history-modal-body">
          {entries.length === 0 ? (
            <div className="history-empty">{t('history.empty')}</div>
          ) : (
            entries.map((entry) => (
              <div key={entry.id} className="history-entry">
                <div className="history-entry-meta">
                  <span className="history-entry-date">{formatDate(entry.timestamp)}</span>
                </div>
                <div className="history-entry-preview">{entry.inputPreview}{entry.inputPreview.length === 60 ? '…' : ''}</div>
                <button
                  type="button"
                  className="btn-ghost history-entry-load"
                  onClick={() => { onLoad(entry.output); onClose(); }}
                >
                  {t('history.load')}
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Run to verify GREEN**

Run: `npx vitest run src/components/HistoryModal.test.tsx`
Expected: 3 PASS. Then `npx vitest run src/components` — consumers of HistoryModal still pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/HistoryModal.tsx src/components/HistoryModal.test.tsx src/i18n/es.json src/i18n/en.json
git commit -m "feat(i18n): translate HistoryModal and replace window.confirm with inline 2-step confirm"
```

---

### Task 6: SearchableSelect + call sites

**Files:**
- Modify: `src/components/SearchableSelect.tsx`
- Create: `src/components/SearchableSelect.test.tsx`
- Modify: `src/components/BugReportTool.tsx:285`, `src/components/TestDataTool.tsx:284` (hardcoded `placeholder` props)
- Modify: `src/i18n/es.json`, `src/i18n/en.json` (2 new keys)

**Interfaces:**
- Produces: `SearchableSelectProps` gains optional `searchPlaceholder?: string` (search input placeholder, defaults to `t('common.search')`). Existing `placeholder` prop (trigger button) keeps its signature; its default becomes `t('common.select')`.

- [ ] **Step 1: Add keys**

`es.json`:

```json
  "common.select": "Seleccionar...",
  "common.searchMarket": "Buscar mercado...",
```

`en.json`:

```json
  "common.select": "Select...",
  "common.searchMarket": "Search market...",
```

- [ ] **Step 2: Write the failing tests**

`src/components/SearchableSelect.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nProvider } from '../i18n/I18nContext';
import { SearchableSelect } from './SearchableSelect';

const options = [{ value: 'es', label: 'España' }];

function renderEn(ui: React.ReactElement) {
  localStorage.setItem('acgen_lang', '"en"');
  return render(<I18nProvider>{ui}</I18nProvider>);
}

describe('SearchableSelect i18n', () => {
  afterEach(() => localStorage.clear());

  it('search input placeholder defaults to the translated common.search', async () => {
    renderEn(<SearchableSelect options={options} value="" onChange={() => {}} />);
    await userEvent.click(screen.getByRole('button'));
    expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument();
  });

  it('shows the translated empty state', async () => {
    renderEn(<SearchableSelect options={options} value="" onChange={() => {}} />);
    await userEvent.click(screen.getByRole('button'));
    await userEvent.type(screen.getByPlaceholderText('Search...'), 'zzz');
    expect(screen.getByText('No results')).toBeInTheDocument();
  });

  it('trigger placeholder defaults to the translated common.select', () => {
    renderEn(<SearchableSelect options={options} value="" onChange={() => {}} />);
    expect(screen.getByText('Select...')).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run to verify RED**

Run: `npx vitest run src/components/SearchableSelect.test.tsx`
Expected: FAIL on all 3 (Spanish literals).

- [ ] **Step 4: Implement**

In `src/components/SearchableSelect.tsx`:

```tsx
import { useT } from '../i18n/I18nContext';

interface SearchableSelectProps {
  options: readonly SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
}

export function SearchableSelect({ options, value, onChange, placeholder, searchPlaceholder }: SearchableSelectProps) {
  const t = useT();
  // ... existing state/hooks unchanged ...
```

Then three render changes:
- Trigger (line 104): `{selectedOption ? selectedOption.label : (placeholder || t('common.select'))}`
- Search input (line 119): `placeholder={searchPlaceholder || t('common.search')}`
- Empty item (line 130): `<li className="sselect-empty">{t('common.noResults')}</li>`

Call sites (both already have `t` in scope):
- `BugReportTool.tsx:285`: `placeholder="Buscar..."` → `placeholder={t('common.search')} searchPlaceholder={t('common.searchMarket')}`
- `TestDataTool.tsx:284`: `placeholder="Buscar mercado..."` → `placeholder={t('common.searchMarket')} searchPlaceholder={t('common.searchMarket')}`

- [ ] **Step 5: Run to verify GREEN**

Run: `npx vitest run src/components`
Expected: ALL PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/SearchableSelect.tsx src/components/SearchableSelect.test.tsx src/components/BugReportTool.tsx src/components/TestDataTool.tsx src/i18n/es.json src/i18n/en.json
git commit -m "feat(i18n): translate SearchableSelect and its call-site placeholders"
```

---

### Task 7: Key-parity guard, full verification, AGENTS.md sync

**Files:**
- Create: `src/i18n/keyParity.test.ts`
- Modify: `AGENTS.md` (Known issues item 1 removed + renumber; test table; evolution row)

**Interfaces:** none.

- [ ] **Step 1: Write the parity test**

`src/i18n/keyParity.test.ts`:

```ts
import es from './es.json';
import en from './en.json';

describe('i18n dictionaries', () => {
  it('es and en have exactly the same keys', () => {
    const esKeys = Object.keys(es).sort();
    const enKeys = Object.keys(en).sort();
    expect(esKeys).toEqual(enKeys);
  });

  it('every {param} placeholder in es exists in en and vice versa', () => {
    const params = (s: string) => (s.match(/\{[a-zA-Z]+\}/g) ?? []).sort();
    for (const key of Object.keys(es)) {
      expect(params((en as Record<string, string>)[key] ?? ''), `param mismatch in ${key}`).toEqual(params((es as Record<string, string>)[key]));
    }
  });
});
```

This is an invariant guard, not a behavior change — it is expected to PASS immediately (parity holds today). If it fails, a previous task drifted: fix the dictionaries, not the test.

- [ ] **Step 2: Full verification**

```bash
npx vitest run          # expect: all tests pass, count > 172
npx tsc --noEmit        # expect: silent
npx eslint src          # expect: 0 errors
npm run build           # expect: build OK
```

- [ ] **Step 3: Update AGENTS.md**

- "Known issues": delete item 1 (i18n leftovers), renumber 2→1, 3→2, 4→3. Update the intro sentence's PR list to include this branch's PR.
- Test table: add rows for the new test files (`errorTranslation`, `ExportBar`, `ErrorBoundary` delta, `HistoryModal`, `SearchableSelect`, `keyParity`, apiService delta) and update the total line with the real count from Step 2's output.
- Evolution history: add a row `| i18n completion | 2026-07-16 | apiService throws i18n keys + params (I18nError), translated at tool catch blocks; ExportBar, ErrorBoundary (contextType), HistoryModal (+ inline 2-step confirm replacing the last window.confirm), SearchableSelect. Key-parity guard test. |`
- Also remove the now-stale claim (if present) that 7 `error.*` keys sit unused.

- [ ] **Step 4: Commit**

```bash
git add src/i18n/keyParity.test.ts AGENTS.md
git commit -m "test(i18n): key-parity guard; docs: sync AGENTS.md after i18n completion"
```

---

## Self-Review Notes

- Spec coverage: apiService (Task 1), catch blocks (Task 2), ExportBar (Task 3), ErrorBoundary (Task 4), HistoryModal + confirm upgrade (Task 5), SearchableSelect + call sites (Task 6), parity test + docs (Task 7). All spec rows covered.
- The spec's "placeholder becomes a required prop" was refined during planning: SearchableSelect already had an optional trigger `placeholder`; the hardcoded string was the **search input**. Resolved as a new optional `searchPlaceholder` prop + translated defaults for everything (trigger, search, empty) — no breaking prop change needed.
- Deliberate minor UX change (Task 6): BugReportTool's market search input previously implied "Buscar mercado..." via the component's hardcoded string while its trigger said "Buscar..."; both now come from keys, trigger `common.search`, search `common.searchMarket`.
