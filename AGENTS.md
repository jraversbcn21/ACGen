# ACGen — Agent guide

## Commands (run from `acgen/`)

| Command | Action |
|---|---|
| `npm run dev` | Start Vite dev server (port 5173) |
| `npm run build` | Type-check (`tsc -b`) + Vite build |
| `npm run lint` | ESLint |
| `npm run preview` | Vite preview |
| `npm test` | Run unit tests (Vitest) |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:ui` | Run tests with Vitest UI |

## Testing

Unit tests with Vitest + React Testing Library. Hooks with non-trivial logic are tested, plus service-layer validation and the global `ErrorBoundary` (the only component test, justified by its class-lifecycle logic).

| Test file | Tests |
|---|---|
| `src/services/apiService.test.ts` | 17 — `validateTestCases`, `validateTestDataRows`, `isModelDecommissioned` (400/404 detection) |
| `src/hooks/useSprints.test.ts` | 20 — init, addSprint, archiveSprint, updateSprint, updateTabJql, updateGridCell, setTabGrid, deleteSprint (removes column-widths key), moveRow (down/up/no-op/oob), persistence, hydration, invalid JSON recovery, old-sprint migration (with and without JSD tab), quota-exceeded resilience |
| `src/hooks/useLocalStorage.test.ts` | 14 — in-memory, same-tab cross-instance sync, cross-tab `storage` event sync, ignoring unrelated keys, reset on external clear, quota-exceeded resilience |
| `src/hooks/useHistory.test.ts` | 11 — add, max entries, load from history, clear, quota-exceeded resilience |
| `src/components/ErrorBoundary.test.tsx` | 3 — renders children, catches render crash, recovers on reset |

**Total: 65 tests across 5 files.**

Run `npm test` before committing when modifying hooks or services.

## Architecture

- **React 18 SPA**, Vite 5, TypeScript. All core logic in-browser.
- **State-based view routing** (`'landing' | 'acceptance' | 'testcase' | 'bugreport' | 'testdata' | 'sprinttracker'`) in `App.tsx` — no router library. The view router is wrapped in `<ErrorBoundary key={view}>`: a class component with `getDerivedStateFromError`/`componentDidCatch` that renders a recoverable fallback (message + "Reintentar" button). Keyed by `view` so switching tools remounts it and clears any stuck error state.
- **Settings persistence**: API key and model stored in `localStorage` (`acgen_api_key`, `acgen_model`). Jira URL base and PAT stored separately (`acgen_jira_token`, `acgen_jira_base_url`). Theme stored as `acgen_theme`. History for criteria and bug reports stored as `acgen_criteria_history` / `acgen_bug_history`. Sprint data stored as `acgen_sprints`. Sprint column widths stored as `acgen_sprint_col_widths_{sprintId}`. Model validated against `AVAILABLE_MODELS` on read; stale values discarded to `DEFAULT_MODEL`.
- **`useLocalStorage` cross-instance/cross-tab sync**: on write, dispatches a custom `acgen-local-storage` window event (same-tab instances sharing a key stay in sync) and listens for the native `storage` event (cross-tab sync; `newValue: null` resets to `initialValue`). All `localStorage.setItem` calls are wrapped in try/catch so `QuotaExceededError` degrades to a console error instead of crashing the render.
- **GROQ API** (`api.groq.com/openai/v1/chat/completions`) called via `fetch`. Temperature fixed at `0.2`.
- **Design tokens** in `:root` (invariants) and `[data-theme="light"]` / `[data-theme="dark"]` in `App.css`. Key tokens: `--accent` (purple), `--bg`, `--surface`, `--border`, `--text`, `--text-2`, `--text-3`, `--radius` (16px), `--radius-sm` (11px), `--shadow-sm/md/lg`, `--danger/--success/--warning` with `-bg` variants. Fonts: Manrope (`--font-ui`), Newsreader italic (`--font-serif`), JetBrains Mono (`--font-mono`).
- **Theme**: light/dark via `[data-theme]` attribute on `<html>`. Applied synchronously from localStorage before first paint to avoid flash, then kept in sync via `useEffect`. Toggle button in Header topbar. Defaults to `'light'`.
- **SVG Icons**: `src/components/Icons.tsx` exports an `Icon` object with named components (criterios, testcase, bug, datos, sprint, eye, eyeOff, sun, moon, spark, arrow, chevron, back). All 24x24, stroke-based, `currentColor`, `strokeWidth` 1.6.
- **Shared CSS primitives** in `App.css`: form fields, buttons, tables, badges, reasoning + TTS sections, Jira config, action bar, model badge, searchable select, sprint spreadsheet, error boundary fallback.

### Acceptance Criteria

- System prompt (`HARDCODED_PROMPT` in `constants.ts`) — instructions + Confluence wiki format template with `{panel}`, `{quote}`, `*Dado*`, `*Cuando*`, `*Entonces*` markers.
- `generateCriteria()` calls `generateWithGroq()` with `REQUIRED_MARKERS`. Missing markers -> error with list of missing elements.
- Returns `GroqResponse` (`{ content, model, reasoning? }`). Reasoning captured from API and displayed with TTS controls.
- **History**: saves last 10 successful generations to localStorage (`acgen_criteria_history`) via `useHistory()`.
- **Jira integration**: If a Jira ticket URL or bare key appears in the requirements input, the ticket context is appended to the user's text (not replaced). If Jira is not configured, a warning is shown but generation proceeds with the typed text only.

### Test Cases

- System prompt (`TESTCASE_PROMPT` in `constants.ts`) — JSON array (`key`, `summary`, `priority`, `type`, `preconditions`, `testSteps`, `expectedResult`).
- `generateTestCases()` calls `generateWithGroq()` (empty markers), then `extractJsonArray()` + `validateTestCases()`. Rejects empty arrays. `validateTestCases()` checks both presence **and type** of every field.
- Returns `TestCaseResponse` (`{ testCases: TestCaseData[], model }`).
- Rendered as HTML table with priority badges (`.badge-high/medium/low`) and type badges (`.badge-positive/negative`), numbered step lists.
- Actions: "Copiar como tabla Jira" (Confluence wiki table — `|` escaped as `&#124;`), "Descargar PDF" (jsPDF + jspdf-autotable).

### Bug Report Generator

- System prompt (`BUG_REPORT_PROMPT` in `constants.ts`) — generates Jira wiki formatted bug reports with 6 `{panel}` blocks.
- `generateBugReport()` in `apiService.ts` — builds user message from `BugReportFormData`, injects current date in `DD-MM-YYYY` format, calls `generateWithGroq()` with empty markers and `tool='criteria'`.
- Four platform types: Web Desktop, Web Mobile, App Android, App iOS. Dynamic form fields per platform.
- **Form layout**: compact flex row (`.br-compact-row`). Selects/inputs at 130-170px (`.br-compact-field`), URL at 230px (`.br-compact-field-wide`), Jira ticket at 500px (`.br-compact-field-jira`).
- **Bug**: URL field preserved when switching between web-desktop and web-mobile; only reset on app->web transition or if previously empty/default.
- Output: Jira wiki format bug report, copyable to clipboard. Reasoning captured and displayed when available.
- **History**: saves last 10 successful bug reports (`acgen_bug_history`) via `useHistory()`.

### Test Data Generator

- System prompt (`TEST_DATA_PROMPT` in `constants.ts`) — generates realistic test data per market for a fashion ecommerce. 5 data types: shipping address, billing data, user registration, payment cards, promo codes.
- `generateTestData()` calls `generateWithGroq()` (empty markers, `tool='testcase'`), parses via `extractJsonArray()`, then validates row shape via `validateTestDataRows()` — rejects nested objects/arrays from the LLM.
- **CSV export**: BOM for Excel. Values starting with `=+-@` prefixed with `'` to neutralize formula injection.
- **TSV export**: tabs and newlines in cell values replaced with spaces.

### Sprint Tracker

- **5th tool** — `src/components/SprintTracker.tsx` (router), `SprintList.tsx`, `SprintDashboard.tsx`. Fully offline — no Groq or Jira API dependency.
- **Data model**: sprints stored in `acgen_sprints`. Each sprint has `tabGrid: Record<TabId, string[][]>`, JQL strings per tab, and metadata. Column widths stored in `acgen_sprint_col_widths_{sprintId}`. **`deleteSprint` removes orphaned width keys.**
- **5 tabs**: Resueltos, Creados, ReOpen, Prioridad Alta, JSD. Each tab has its own spreadsheet grid. JSD only has 3 named columns (JSD, Fecha, Motivo) — same pattern as ReOpen/Prioridad Alta having fewer named columns than the 6-column grid.
- **Grid**: editable 2D array (20 rows x 6 columns). Resizable columns via drag handle. "+ Fila" to expand rows.
- **Row drag-and-drop**: via drag handle on row number cells. `moveRow()` correctly handles downward moves (off-by-one fixed). Disabled on archived sprints. Drop target indicator only shown for internal row drags.
- **Search bar**: debounced at 250ms. Shows "N de M filas" counter. Escape clears. "+ Fila" hidden during search.
- **Ticket column (A)**: values matching `^[A-Z]+-\d+` display as clickable hyperlinks. **Ctrl+click** opens Jira; normal click edits the cell. SnapLink paste uppercases captured key. Paste handler recognizes SnapLink `Title - URL` format and bare Jira URLs.
- **Keyboard navigation**: arrow keys respect caret position — only jump cells when at text start/end. Focused ticket cells get accent highlight. `Tab`/`Shift+Tab` in DOM order.
- **Archiving**: "Archivar Sprint" sets `archived: true` + `endDate` (local date, not UTC). Archived sprints remain viewable.
- **Migration**: old sprints without `tabGrid` initialized with empty grid on load.

### Model-aware reasoning params

In `apiService.ts`, `getReasoningParams(model, tool)` returns request-body params per model:

| Model | `tool='testcase'` | `tool='criteria'` |
|---|---|---|
| `qwen/qwen3-32b` | `reasoning_format: "hidden"` | `reasoning_format: "parsed"` |
| `openai/gpt-oss-*` | none | none |
| `llama-*` | none | none |

### Decommissioned-model error handling

Exported `isModelDecommissioned(message, status)` checks both HTTP 400 and 404 for keywords `model_decommissioned`, `model_not_found`, `invalid model`, `model not found`. Used in `generateWithGroq()` to surface: *"El modelo seleccionado ya no esta disponible. Por favor selecciona otro modelo."* Also handles HTTP 401 (invalid API key) and HTTP 429 (rate limit) with specific Spanish messages.

### Jira ticket integration

- `src/types/` contiene los tipos para integracion con trackers externos.

## Layout

### App shell

`<div className="page">` > `<header className="topbar">` + `<main className="container">`. `.page` is full viewport with `--bg-grad`. `.container` has `max-width: 1260px` with responsive padding.

### Landing screen

Hero section with eyebrow "Sesion de QA . Quality Assurance", config strip (ApiKeyConfig + ModelSelector in 1.5fr 1fr grid), "Generadores" header with **"05"** badge, 5-tool list with SVG icons and descriptions, extensibility slot.

### Acceptance Criteria Tool

Asymmetric two-column grid (`.criteria-grid`, 3fr 2fr). Left: input + editable output + copy button. Right: reasoning collapsible with TTS controls. Actions: GenerateButton, Historial, Limpiar.

### Test Case Generator

Single-column: input -> generate/clear -> HTML table with priority badges + Jira copy + PDF download.

### Bug Report Tool

Compact flex row with all fields side by side. Description and output textareas full-width. Copy + reasoning with TTS. History modal. Jira config collapsible.

### Test Data Tool

Structured form (dataType/market/quantity). Jira config collapsible. Output: HTML table with row copy + TSV copy + CSV download. Limpiar button disabled when form is in default state with no output.

### Sprint Tracker

**SprintList**: active sprint card (accent border) + archived list. "Nuevo Sprint" form. Delete with confirm. **SprintDashboard**: tabbed interface with search bar (debounced 250ms), resizable spreadsheet grid, drag-and-drop rows, SnapLink support, keyboard navigation, archiving.

## Models

```
AVAILABLE_MODELS = [
  "openai/gpt-oss-120b",        <- DEFAULT_MODEL
  "openai/gpt-oss-20b",
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
  "qwen/qwen3-32b",
]
```

## Key files

| File | Purpose |
|---|---|
| `src/config/constants.ts` | API_URL, prompts, AVAILABLE_MODELS, DEFAULT_MODEL, STORAGE_KEYS, ViewType, SUPPORTED_MARKETS, PLATFORMS, DATA_TYPES |
| `src/services/apiService.ts` | `generateWithGroq()`, `generateCriteria()`, `generateTestCases()`, `generateBugReport()`, `generateTestData()`, `isModelDecommissioned()`, `validateTestCases()`, `validateTestDataRows()`, `extractJsonArray()` |
| `src/services/apiService.test.ts` | 17 unit tests — validation type checks, model decommission detection |
| `src/App.tsx` | View state routing (5 tools + landing) wrapped in `ErrorBoundary`. Theme state (applied before paint). Jira token/URL state |
| `src/components/ErrorBoundary.tsx` | Class component error boundary with recoverable fallback UI |
| `src/components/Icons.tsx` | SVG icons — `Icon` object with 12 named components |
| `src/components/LandingScreen.tsx` | Editorial landing with hero, config strip, 5-tool list |
| `src/components/SearchableSelect.tsx` | Reusable searchable dropdown (filters at 1+ chars) |
| `src/components/SprintTracker.tsx` | Sprint Tracker router: list -> detail navigation |
| `src/components/SprintList.tsx` | Sprint cards (active + archived), new sprint form, delete |
| `src/components/SprintDashboard.tsx` | Tabbed spreadsheet: drag-and-drop, search (debounced), SnapLink (uppercases), Ctrl+click tickets, keyboard nav (caret-aware), resizable columns |
| `src/hooks/useSprints.ts` | Sprint CRUD: `moveRow()` (off-by-one fixed), `deleteSprint()` (cleans width keys), `archiveSprint()` (local date) |
| `src/hooks/useSprints.test.ts` | 20 unit tests for useSprints |
| `src/hooks/useLocalStorage.ts` | Generic localStorage hook with cross-instance/-tab sync |
| `src/hooks/useHistory.ts` | Last-N history ring for criteria and bug reports |

## Changing output format

| Tool | Edit file | Additional steps |
|---|---|---|
| Acceptance Criteria | `HARDCODED_PROMPT` in `constants.ts` | Update `REQUIRED_MARKERS` if markers change |
| Test Cases | `TESTCASE_PROMPT` in `constants.ts` | Update `extractJsonArray` / `validateTestCases` in `apiService.ts` if schema changes; update rendering in `TestCaseTool.tsx` |
| Bug Report | `BUG_REPORT_PROMPT` in `constants.ts` | Date injected in `generateBugReport()` via `padStart` |
| Test Data | `TEST_DATA_PROMPT` in `constants.ts` | Add entries to `DATA_TYPES` and `LABEL_MAP` for new data types |

## Notable

- Entrypoint: `src/main.tsx` -> `App.tsx`.
- `jspdf` + `jspdf-autotable` are production dependencies (PDF generation).
- Jira proxying runs as Vercel serverless functions under `api/` (no Express/CORS). `vercel dev` serves frontend + functions together locally.
- ViewType: `'landing' | 'acceptance' | 'testcase' | 'bugreport' | 'testdata' | 'sprinttracker'`.
- Sprint Tracker operates fully offline — no Groq or Jira API calls.
- Test files co-located with source (`src/hooks/`, `src/services/`, `src/components/`, `api/_lib/`).
- `tsconfig.app.json` excludes `*.test.ts` and `*.test.tsx` from production typecheck/build.

## Bug-fix history (2026-07-10)

All ~40 bugs from the multi-agent review are now fixed across 5 phases:

| Phase | Commit | Scope |
|---|---|---|
| Fase 1 | `1631862` | Crashes + data loss: quota-exceeded resilience, invalid JSON recovery, testSteps type validation, ErrorBoundary |
| Fase 2 | `2adc2c2` | Proxy security: `validateAndEncodeIssueKey`, `validateBaseUrl`, 30s fetch timeouts, +16 tests |
| Fase 3 | `f163f7f` | Sprint Tracker UX: moveRow off-by-one, drag state persistence, caret-aware arrows, Ctrl+click tickets, search debounce, +4 tests |
| Fase 4 | `0e2dc11` | Generation & exports: `isModelDecommissioned` (400+404), Jira table escape, CSV injection, TSV newlines, Jira context append, URL preservation, +7 tests |
| Fase 5 | `764a920` | Polish: bare keys, orphaned widths, local dates, dark-theme flash, filter threshold, empty array guard, fence regex, SnapLink case, Limpiar disable |
