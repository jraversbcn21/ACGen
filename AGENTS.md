# ACGen — Agent guide

## Commands (run from `acgen/`)

| Command | Action |
|---|---|
| `npm run dev` | Start Vite dev server (port 5173) |
| `npm run server` | Start Express proxy (port 3002) |
| `npm run dev:all` | Start both Vite + proxy concurrently |
| `npm run build` | Type-check (`tsc -b`) + Vite build |
| `npm run lint` | ESLint |
| `npm run preview` | Vite preview |
| `npm test` | Run unit tests (Vitest) |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:ui` | Run tests with Vitest UI |

## Testing

Unit tests with Vitest + React Testing Library. Hooks with non-trivial logic are tested, plus service-layer validation and the global `ErrorBoundary` (the only component test, justified by its class-lifecycle logic).

- `src/hooks/useHistory.test.ts` — 11 tests (adds: quota-exceeded resilience)
- `src/hooks/useLocalStorage.test.ts` — 14 tests (adds: same-tab cross-instance sync, cross-tab `storage` event sync, ignoring unrelated keys, reset on external clear, quota-exceeded resilience)
- `src/hooks/useSprints.test.ts` — 14 tests covering: init, addSprint, archiveSprint, updateSprint, updateTabJql, updateGridCell, setTabGrid, deleteSprint, persistence, hydration, invalid JSON recovery, old-sprint migration, quota-exceeded resilience
- `src/services/apiService.test.ts` — 10 tests covering `validateTestCases` (type checks, not just presence) and `validateTestDataRows` (rejects nested objects/arrays from the LLM)
- `src/components/ErrorBoundary.test.tsx` — 3 tests (renders children, catches render crash, recovers on reset)

Run `npm test` before committing when modifying hooks or services.

## Architecture

- **React 18 SPA**, Vite 5, TypeScript. All core logic in-browser. Express proxy (`server/`) for Jira API calls (CORS bypass).
- **State-based view routing** (`'landing' | 'acceptance' | 'testcase' | 'bugreport' | 'testdata' | 'sprinttracker'`) in `App.tsx` — no router library. The view router is wrapped in `<ErrorBoundary key={view}>` (`src/components/ErrorBoundary.tsx`): a class component with `getDerivedStateFromError`/`componentDidCatch` that renders a recoverable fallback (message + "Reintentar" button) instead of a blank screen when a tool crashes. Keyed by `view` so switching tools remounts it and clears any stuck error state.
- **Settings persistence**: API key and model stored in `localStorage` (`acgen_api_key`, `acgen_model`). Jira URL base and PAT stored separately (`acgen_jira_token`, `acgen_jira_base_url`). Theme stored as `acgen_theme`. History for criteria and bug reports stored as `acgen_criteria_history` / `acgen_bug_history`. Sprint data stored as `acgen_sprints`. Sprint column widths stored as `acgen_sprint_col_widths_{sprintId}`. Model validated against `AVAILABLE_MODELS` on read; stale values discarded to `DEFAULT_MODEL`.
- **`useLocalStorage` cross-instance/cross-tab sync**: on write, dispatches a custom `acgen-local-storage` window event (same-tab instances sharing a key stay in sync — e.g. Jira credentials configured in one tool are immediately visible in another without reloading) and listens for the native `storage` event (cross-tab sync; a `newValue: null` resets to `initialValue`). All `localStorage.setItem` calls across `useLocalStorage`, `useHistory`, and `useSprints` (via its `persistSprints` helper) are wrapped in try/catch so a `QuotaExceededError` degrades to a console error instead of crashing the render.
- **GROQ API** (`api.groq.com/openai/v1/chat/completions`) called via `fetch`. Temperature fixed at `0.2`.
- **Design tokens** live in `:root` (invariants) and `[data-theme="light"]` / `[data-theme="dark"]` in `App.css`. Key tokens: `--accent` (purple), `--bg`, `--surface`, `--border`, `--text`, `--text-2`, `--text-3`, `--radius` (16px), `--radius-sm` (11px), `--shadow-sm/md/lg`, `--danger/--success/--warning` with `-bg` variants. Fonts: Manrope (`--font-ui`), Newsreader italic (`--font-serif`), JetBrains Mono (`--font-mono`).
- **Theme**: light/dark via `[data-theme]` attribute on `<html>`. Toggle button in Header topbar. State managed in `App.tsx` via `useLocalStorage<'light'|'dark'>(STORAGE_KEYS.THEME, 'light')` + `useEffect` that syncs attribute. Initialized from stored value, falls back to `prefers-color-scheme`.
- **SVG Icons**: `src/components/Icons.tsx` exports an `Icon` object with named components (criterios, testcase, bug, datos, sprint, eye, eyeOff, sun, moon, spark, arrow, chevron, back). All 24×24, stroke-based, `currentColor`, `strokeWidth` 1.6. No emojis used as icons.
- **Shared CSS primitives** in `App.css`: form fields, buttons, tables, badges, reasoning + TTS sections, Jira config, action bar, model badge, searchable select, sprint spreadsheet, error boundary fallback.

### Acceptance Criteria

- System prompt (`HARDCODED_PROMPT` in `constants.ts`) — instructions + Confluence wiki format template with `{panel}`, `{quote}`, `*Dado*`, `*Cuando*`, `*Entonces*` markers.
- `generateCriteria()` calls `generateWithGroq()` with `REQUIRED_MARKERS`. Missing markers → error with list of missing elements.
- Returns `GroqResponse` (`{ content, model, reasoning? }`). Reasoning captured from API and passed to component.
- **History**: saves last 10 successful generations to localStorage (`acgen_criteria_history`) via `useHistory()` hook.

### Test Cases

- System prompt (`TESTCASE_PROMPT` in `constants.ts`) — JSON array (`key`, `summary`, `priority`, `type`, `preconditions`, `testSteps`, `expectedResult`).
- `generateTestCases()` calls `generateWithGroq()` (empty markers), then `extractJsonArray()` + `validateTestCases()`. `validateTestCases()` checks both presence **and type** of every field (`testSteps` must be a string array; the rest must be strings) — rejects malformed LLM output (e.g. `testSteps` returned as a single string) with a clear Spanish error instead of letting it crash the table render.
- Returns `TestCaseResponse` (`{ testCases: TestCaseData[], model }`).
- Rendered as HTML table with priority badges (`.badge-high/medium/low`) and type badges (`.badge-positive/negative`), numbered step lists.
- Actions: "Copiar como tabla Jira" (Confluence wiki table) and "Descargar PDF" (jsPDF + jspdf-autotable).

### Bug Report Generator

- System prompt (`BUG_REPORT_PROMPT` in `constants.ts`) — generates Jira wiki formatted bug reports with 6 `{panel}` blocks.
- `generateBugReport()` in `apiService.ts` — builds user message from `BugReportFormData`, injects current date in `DD-MM-YYYY` format, calls `generateWithGroq()` with empty markers and `tool='criteria'`.
- Four platform types: Web Desktop, Web Mobile, App Android, App iOS. Dynamic form fields per platform.
- **Form layout**: compact flex row (`.br-compact-row`) with all fields in a single horizontal strip. Selects/inputs at 130-170px (`.br-compact-field`), URL at 230px (`.br-compact-field-wide`), Jira ticket at 500px (`.br-compact-field-jira`). Description and output textareas remain full-width.
- Optional Jira context via ticket URL.
- Output: Jira wiki format bug report, copyable to clipboard. Reasoning captured and displayed when available.
- **History**: saves last 10 successful bug reports to localStorage (`acgen_bug_history`) via `useHistory()`.

### Test Data Generator

- System prompt (`TEST_DATA_PROMPT` in `constants.ts`) — generates realistic test data per market for Bershka ecommerce. 5 data types: shipping address, billing data, user registration, payment cards, promo codes.
- `generateTestData()` calls `generateWithGroq()` (empty markers, `tool='testcase'`), parses via `extractJsonArray()`, then validates row shape via `validateTestDataRows()` — rejects/coerces nested objects or arrays from the LLM (they would otherwise crash React's render with "Objects are not valid as a React child").
- Output rendered as HTML table with Spanish column headers. Row copy, TSV copy, CSV download (with BOM for Excel).

### Sprint Tracker

- **5th tool** — `src/components/SprintTracker.tsx` (router), `SprintList.tsx`, `SprintDashboard.tsx`.
- Fully offline spreadsheet — no Groq or Jira API dependency.
- **Data model**: sprints stored in localStorage (`acgen_sprints`). Each sprint has a spreadsheet grid (`tabGrid: Record<TabId, string[][]>`), JQL strings per tab (`jql`, not exposed in UI), and metadata (name, dates, archived flag). Column widths persisted separately per sprint in `acgen_sprint_col_widths_{sprintId}`.
- **4 tabs** per sprint: Resueltos, Creados, ReOpen, Prioridad Alta. Each tab has its own spreadsheet grid.
- **Column headers**: Resueltos/Creados → Ticket, Fecha, Prioridad, Autor, Squad. ReOpen/Prioridad Alta → Ticket, Fecha, Motivo, Squad.
- **Grid**: editable 2D array (20 rows × 6 columns fixed). Column headers show letter (A-F) and category-specific name. Columns resizable via drag handle, widths persist in localStorage. Only "+ Fila" button to expand rows. All cells editable.
- **Row drag-and-drop**: rows reorderable via drag handle (⋮⋮) on row number cells. Uses `moveRow()` in `useSprints.ts` — persists reordered grid to localStorage. Disabled on archived sprints.
- **Search bar**: top-right input (`Buscar por ticket, fecha, squad...`) filters rows in-place by matching any cell content. Shows "N de M filas" counter. Escape clears. Hidden when tab changes. "+ Fila" hidden during search.
- **Ticket column (A)**: values starting with a ticket key (`^([A-Z]+-\d+)\b`) display as clickable hyperlinks — clicking anywhere on the cell opens the Jira ticket in a new tab. SnapLink integration: pasting via `Ctrl+V` automatically parses `Title - URL` format and stores `KEY Title` as display text.
- **SnapLink button**: link to Chrome Web Store extension in the tab bar for easy setup.
- **Keyboard navigation**: arrow keys move focus between cells (respects filtered rows during search). Ticket cells show a subtle accent highlight when focused via keyboard. `Tab`/`Shift+Tab` navigate in DOM order.
- **Archiving**: "Archivar Sprint" sets `archived: true` + `endDate`. Archived sprints remain viewable.
- **Migration**: old sprints without `tabGrid` get initialized with empty grid on load.

### Model-aware reasoning params

In `apiService.ts`, `getReasoningParams(model, tool)` returns request-body params per model:

| Model | `tool='testcase'` | `tool='criteria'` |
|---|---|---|
| `qwen/qwen3-32b` | `reasoning_format: "hidden"` | `reasoning_format: "parsed"` |
| `openai/gpt-oss-*` | none | none |
| `llama-*` | none | none |

### Decommissioned-model error handling

`generateWithGroq()` detects HTTP 400 with `model_decommissioned` / `model_not_found` / `invalid model` / `model not found` and surfaces: *"El modelo seleccionado ya no está disponible. Por favor selecciona otro modelo."* Also handles HTTP 401 (invalid API key) and HTTP 429 (rate limit) with specific Spanish messages.

### Proxy Server

- **`server/index.js`** — Express app on port 3002, CORS origin `http://localhost:5173`, JSON middleware, mounts Jira routes at `/api/jira`.
- **`server/jiraRoutes.js`** routes:
  - `GET /api/jira/issue/:issueKey` — proxies to `{baseUrl}/rest/api/2/issue/{issueKey}`. Returns cleaned `JiraTicketData`.
  - `GET /api/jira/search?jql=` — proxies to `{baseUrl}/rest/api/2/search?jql={jql}&fields=key,summary,status,created,updated&maxResults=100`. Returns `{ issues: Array<{ key, summary, status, created, updated }> }`.
- Headers: `X-Jira-Token` (PAT), `X-Jira-Base-Url`. Errors in Spanish.

### Jira ticket integration

Tools that use Jira: AcceptanceCriteria, BugReport, TestData, SprintTracker.
- `jiraService.ts` exports: `extractIssueKey()`, `fetchJiraTicket()`, `formatTicketAsText()`, `jiraSearch()`.
- Config persisted via `useLocalStorage(STORAGE_KEYS.JIRA_TOKEN)` and `useLocalStorage(STORAGE_KEYS.JIRA_BASE_URL)`.

## Layout

### App shell

`<div className="page">` > `<header className="topbar">` + `<main className="container">`. `.page` is full viewport with `--bg-grad`. `.container` has `max-width: 1260px` with responsive padding.

### Landing screen

- Hero section with eyebrow "Sesión de QA · Jorgito" and mixed-weight title.
- Config strip: ApiKeyConfig and ModelSelector in 1.5fr 1fr grid.
- Section header "Generadores" with count badge **"05"**.
- 5 tools: Criterios de aceptación, Test Case Generator, Bug Report Generator, Datos de Prueba, Sprint Tracker.
- Tool list: grid rows with italic number, SVG icon, title/description, tag pill, hover arrow.
- Extensibility slot: "+ Más generadores próximamente".

### Acceptance Criteria Tool

Asymmetric two-column grid (`.criteria-grid`, 3fr 2fr). Left: input + editable output + copy button. Right: reasoning collapsible with TTS controls. Actions: GenerateButton, Historial, Limpiar.

### Test Case Generator

Single-column: input → generate/clear → HTML table with priority badges + Jira copy + PDF download.

### Bug Report Tool

Compact flex row (`.br-compact-row`) with all fields side by side: Platform, Market, Browser, URL/Version, Device, OS, Jira ticket. Selects/inputs sized via `.br-compact-field` (130-170px), `.br-compact-field-wide` (230px for URL), `.br-compact-field-jira` (500px for Jira ticket). Description and output textareas full-width. Same styling, just horizontally compacted to save vertical space. Actions: GenerateButton, Historial, Limpiar. Copy + reasoning with TTS. History modal. Jira config collapsible.

### Test Data Tool

Structured form (dataType/market/quantity). Output: HTML table with row copy + TSV copy + CSV download.

### Sprint Tracker

- **SprintList**: active sprint card (accent border) + archived list. "Nuevo Sprint" form (name + start date). Delete with confirm.
- **SprintDashboard**: tabbed interface (4 category tabs). Each tab has:
  - **Search bar** — top-right input that filters rows in-place by any cell content. Counter shows "N de M filas". Tab switch clears filter. "+ Fila" hidden during search.
  - **Spreadsheet grid** — columns A-F with letter headers + category-specific names: Resueltos/Creados (Ticket, Fecha, Prioridad, Autor, Squad), ReOpen/Prioridad Alta (Ticket, Fecha, Motivo, Squad). `tableLayout: fixed`. Resizable columns via drag handle; widths persist per sprint. Editable cells. Ticket column hyperlinks. SnapLink paste. "+ Fila" button.
  - **Row drag-and-drop** — drag handle (⋮⋮) on row number cells. Reorders grid rows via `moveRow()`. Disabled on archived sprints.
  - **"+ SnapLink" button** — links to Chrome Web Store extension.
  - **Keyboard navigation** — arrow keys move between cells (respects filtered rows). Focused ticket cells get accent highlight.
  - **"Archivar Sprint" button** — sends sprint to history

## Models

```
AVAILABLE_MODELS = [
  "openai/gpt-oss-120b",        ← DEFAULT_MODEL
  "openai/gpt-oss-20b",
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
  "qwen/qwen3-32b",
]
```

Models are plain strings. `deepseek-r1-distill-llama-70b` and `qwen-qwq-32b` were removed.

## Key files

| File | Purpose |
|---|---|
| `server/index.js` | Express proxy entry: CORS, JSON middleware, mounts Jira routes |
| `server/jiraRoutes.js` | `GET /issue/:issueKey` and `GET /search?jql=` — proxies to Jira REST API |
| `src/config/constants.ts` | API_URL, PROXY_URL, prompts, AVAILABLE_MODELS, DEFAULT_MODEL, STORAGE_KEYS, ViewType, BERSHKA_MARKETS, PLATFORMS, DATA_TYPES |
| `src/services/apiService.ts` | `generateWithGroq()` (POST + marker validation + reasoning + error handling), `generateCriteria()`, `generateTestCases()`, `generateBugReport()`, `generateTestData()`, `validateTestCases()`, `validateTestDataRows()` |
| `src/services/apiService.test.ts` | Unit tests for `validateTestCases()` / `validateTestDataRows()` type/shape checks |
| `src/services/jiraService.ts` | `extractIssueKey()`, `fetchJiraTicket()`, `formatTicketAsText()`, `jiraSearch()` |
| `src/App.tsx` | View state routing (5 tools + landing) wrapped in `ErrorBoundary`. Theme state. Jira token/URL state. |
| `src/components/ErrorBoundary.tsx` | Class component error boundary around the view router; recoverable fallback UI with a reset button |
| `src/components/Icons.tsx` | SVG icons — `Icon` object with 12 named components |
| `src/components/LandingScreen.tsx` | Editorial landing with hero, config strip, 5-tool list |
| `src/components/SearchableSelect.tsx` | Reusable searchable dropdown (used in BugReport/TestData market selects) |
| `src/components/SprintTracker.tsx` | Sprint Tracker router: list → detail navigation |
| `src/components/SprintList.tsx` | Sprint cards (active + archived), new sprint form, delete |
| `src/components/SprintDashboard.tsx` | Tabbed spreadsheet grid: drag-and-drop row reordering, search bar, SnapLink paste, clickable ticket cells, keyboard nav, resizable persisted columns |
| `src/hooks/useSprints.ts` | Sprint CRUD hook with localStorage persistence: `moveRow()` for drag-and-drop reorder, `updateGridCell()`, `setTabGrid()`, `addSprint()`, `archiveSprint()`, `deleteSprint()` |
| `src/hooks/useSprints.test.ts` | 13 unit tests for useSprints |

## Changing output format — Acceptance Criteria

Edit `HARDCODED_PROMPT` in `constants.ts`. Update `REQUIRED_MARKERS` if markers change.

## Changing output format — Test Cases

Edit `TESTCASE_PROMPT` in `constants.ts`. Update `extractJsonArray` / `validateTestCases` in `apiService.ts` if schema changes. Update rendering in `TestCaseTool.tsx`.

## Changing output format — Bug Report

Edit `BUG_REPORT_PROMPT` in `constants.ts`. Date format injected in `generateBugReport()` via `padStart`.

## Changing output format — Test Data

Edit `TEST_DATA_PROMPT` in `constants.ts`. Add entries to `DATA_TYPES` and `LABEL_MAP` for new data types.

## Notable

- Entrypoint: `src/main.tsx` → `App.tsx`.
- `jspdf` + `jspdf-autotable` are production dependencies (PDF generation).
- `express` + `cors` + `concurrently` are devDependencies (proxy server).
- ViewType: `'landing' | 'acceptance' | 'testcase' | 'bugreport' | 'testdata' | 'sprinttracker'`.
- Sprint Tracker operates fully offline — no Groq or Jira API calls. JQL fields are stored in the data model but not exposed in the UI.
- Test files co-located with source (`src/hooks/`, `src/services/`, `src/components/ErrorBoundary.test.tsx`).
- Design tokens in `:root` + `[data-theme="light"]` / `[data-theme="dark"]`.
- `tsconfig.app.json` excludes both `*.test.ts` and `*.test.tsx` from the production typecheck/build (the `.tsx` exclusion was missing until the first component test was added — `npm run build` would otherwise fail on jest-dom matcher types).

## Known issues (bug hunt 2026-07-10)

A parallel multi-agent review found ~40 real bugs across services, hooks, components, and the proxy server. **Phase 1 (crashes + data loss) is fixed** — see the Testing/Architecture notes above. Still open:

- ~~**Phase 2 — proxy security**: `issueKey` not `encodeURIComponent`-encoded in `server/jiraRoutes.js` (PAT can be redirected to arbitrary Jira endpoints); `X-Jira-Base-Url` accepted from the client with no validation (SSRF/token-exfiltration risk); no fetch timeouts (a dead Jira host hangs the UI forever).~~ **FIXED** — Added `server/jiraUtils.js` with `validateAndEncodeIssueKey` (regex `^[A-Z][A-Z0-9]*-\d+$` + `encodeURIComponent`) and `validateBaseUrl` (http/https only, via `new URL()`). Both routes now validate inputs and use `AbortSignal.timeout(30s)`, returning proper 400/504 errors. 16 unit tests.
- **Phase 3 — Sprint Tracker UX**: `moveRow()` off-by-one when dragging a row downward (lands one row past the drop indicator); drag state (`dragTargetRow`) not cleared on non-row drags; `ArrowLeft`/`ArrowRight` always jump cells instead of moving the caret; ticket cells can't be edited with the mouse (`onClick` always opens Jira); search filter re-evaluates on every keystroke and can unmount the row being edited.
- **Phase 4 — generation & exports**: decommissioned-model detection in `generateWithGroq()` never actually matches Groq's real error shape/status; Jira wiki table export doesn't escape `|` or newlines; CSV export doesn't neutralize leading `=+-@` (formula injection risk in Excel); TSV export doesn't escape newlines; Acceptance Criteria replaces the user's typed requirements entirely if a Jira URL appears anywhere in the text; Bug Report resets the URL field when switching between web platforms.
- **Phase 5 — polish**: ~15 low-severity items (`extractIssueKey` rejects `http://` silently, orphaned `acgen_sprint_col_widths_*` keys on sprint delete, `endDate`/sprint dates computed in UTC causing off-by-one days, dark-theme flash on reload, `SearchableSelect` filter requiring 3+ chars vs 2-char market codes, etc.).
