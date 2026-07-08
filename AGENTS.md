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

Unit tests with Vitest + React Testing Library. Only hooks with non-trivial logic are tested — no component tests.

- `src/hooks/useHistory.test.ts` — 10 tests
- `src/hooks/useLocalStorage.test.ts` — 9 tests
- `src/hooks/useSprints.test.ts` — 13 tests covering: init, addSprint, archiveSprint, updateSprint, updateTabJql, updateGridCell, setTabGrid, deleteSprint, persistence, hydration, invalid JSON recovery, old-sprint migration

Run `npm test` before committing when modifying hooks.

## Architecture

- **React 18 SPA**, Vite 5, TypeScript. All core logic in-browser. Express proxy (`server/`) for Jira API calls (CORS bypass).
- **State-based view routing** (`'landing' | 'acceptance' | 'testcase' | 'bugreport' | 'testdata' | 'sprinttracker'`) in `App.tsx` — no router library.
- **Settings persistence**: API key and model stored in `localStorage` (`acgen_api_key`, `acgen_model`). Jira URL base and PAT stored separately (`acgen_jira_token`, `acgen_jira_base_url`). Theme stored as `acgen_theme`. History for criteria and bug reports stored as `acgen_criteria_history` / `acgen_bug_history`. Sprint data stored as `acgen_sprints`. Model validated against `AVAILABLE_MODELS` on read; stale values discarded to `DEFAULT_MODEL`.
- **GROQ API** (`api.groq.com/openai/v1/chat/completions`) called via `fetch`. Temperature fixed at `0.2`.
- **Design tokens** live in `:root` (invariants) and `[data-theme="light"]` / `[data-theme="dark"]` in `App.css`. Key tokens: `--accent` (purple), `--bg`, `--surface`, `--border`, `--text`, `--text-2`, `--text-3`, `--radius` (16px), `--radius-sm` (11px), `--shadow-sm/md/lg`, `--danger/--success/--warning` with `-bg` variants. Fonts: Manrope (`--font-ui`), Newsreader italic (`--font-serif`), JetBrains Mono (`--font-mono`).
- **Theme**: light/dark via `[data-theme]` attribute on `<html>`. Toggle button in Header topbar. State managed in `App.tsx` via `useLocalStorage<'light'|'dark'>(STORAGE_KEYS.THEME, 'light')` + `useEffect` that syncs attribute. Initialized from stored value, falls back to `prefers-color-scheme`.
- **SVG Icons**: `src/components/Icons.tsx` exports an `Icon` object with named components (criterios, testcase, bug, datos, sprint, eye, eyeOff, sun, moon, spark, arrow, chevron, back). All 24×24, stroke-based, `currentColor`, `strokeWidth` 1.6. No emojis used as icons.
- **Shared CSS primitives** in `App.css`: form fields, buttons, tables, badges, reasoning + TTS sections, Jira config, action bar, model badge, searchable select, sprint spreadsheet.

### Acceptance Criteria

- System prompt (`HARDCODED_PROMPT` in `constants.ts`) — instructions + Confluence wiki format template with `{panel}`, `{quote}`, `*Dado*`, `*Cuando*`, `*Entonces*` markers.
- `generateCriteria()` calls `generateWithGroq()` with `REQUIRED_MARKERS`. Missing markers → error with list of missing elements.
- Returns `GroqResponse` (`{ content, model, reasoning? }`). Reasoning captured from API and passed to component.
- **History**: saves last 10 successful generations to localStorage (`acgen_criteria_history`) via `useHistory()` hook.

### Test Cases

- System prompt (`TESTCASE_PROMPT` in `constants.ts`) — JSON array (`key`, `summary`, `priority`, `type`, `preconditions`, `testSteps`, `expectedResult`).
- `generateTestCases()` calls `generateWithGroq()` (empty markers), then `extractJsonArray()` + `validateTestCases()`.
- Returns `TestCaseResponse` (`{ testCases: TestCaseData[], model }`).
- Rendered as HTML table with priority badges (`.badge-high/medium/low`) and type badges (`.badge-positive/negative`), numbered step lists.
- Actions: "Copiar como tabla Jira" (Confluence wiki table) and "Descargar PDF" (jsPDF + jspdf-autotable).

### Bug Report Generator

- System prompt (`BUG_REPORT_PROMPT` in `constants.ts`) — generates Jira wiki formatted bug reports with 6 `{panel}` blocks.
- `generateBugReport()` in `apiService.ts` — builds user message from `BugReportFormData`, injects current date in `DD-MM-YYYY` format, calls `generateWithGroq()` with empty markers and `tool='criteria'`.
- Four platform types: Web Desktop, Web Mobile, App Android, App iOS. Dynamic form fields per platform.
- Optional Jira context via ticket URL.
- Output: Jira wiki format bug report, copyable to clipboard. Reasoning captured and displayed when available.
- **History**: saves last 10 successful bug reports to localStorage (`acgen_bug_history`) via `useHistory()`.

### Test Data Generator

- System prompt (`TEST_DATA_PROMPT` in `constants.ts`) — generates realistic test data per market for Bershka ecommerce. 5 data types: shipping address, billing data, user registration, payment cards, promo codes.
- `generateTestData()` calls `generateWithGroq()` (empty markers, `tool='testcase'`), parses via `extractJsonArray()`.
- Output rendered as HTML table with Spanish column headers. Row copy, TSV copy, CSV download (with BOM for Excel).

### Sprint Tracker

- **New 5th tool** — `src/components/SprintTracker.tsx` (router), `SprintList.tsx`, `SprintDashboard.tsx`.
- No Groq dependency — only queries Jira via the proxy.
- **Data model**: sprints stored in localStorage (`acgen_sprints`). Each sprint has JQL per tab (`jql`), a spreadsheet grid (`tabGrid: Record<TabId, string[][]>`), and metadata (name, dates, archived flag).
- **4 tabs** per sprint: Resueltos, Creados, ReOpen, Prioridad Alta. Each tab has inline JQL textarea and a spreadsheet grid.
- **Grid**: editable 2D array (20 rows × 6 columns default). Column headers show letter (A-F) and category-specific name. Columns resizable via drag handle. "Ticket" column values matching `^[A-Z]+-\d+$` render as clickable Jira links. "+ Fila" / "+ Columna" buttons to expand. All cells editable.
- **JQL refresh**: clicks "Refrescar" → `jiraSearch()` hits `GET /api/jira/search?jql=...` on proxy → populates column A with ticket key and column B with date.
- **Archiving**: "Archivar Sprint" sets `archived: true` + `endDate`. Archived sprints can still be viewed (data refreshes from Jira).
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

Structured form (`.br-form-grid`) with dynamic web/app fields. Output: read-only textarea + copy + reasoning with TTS. History modal. Jira config indicator.

### Test Data Tool

Structured form (dataType/market/quantity). Output: HTML table with row copy + TSV copy + CSV download.

### Sprint Tracker

- **SprintList**: active sprint card (accent border) + archived list. "Nuevo Sprint" form (name + start date). Delete with confirm.
- **SprintDashboard**: tabbed interface (4 category tabs). Each tab has:
  - **JQL textarea** — type or paste JQL query for that category
  - **Spreadsheet grid** (`.sprint-spreadsheet-wrap`) — columns A-F with letter headers + category-specific names (Ticket, Fecha, Prioridad, Autor / Motivo, Squad). Resizable columns via drag handle on header border. Editable cells. Column A values matching `^[A-Z]+-\d+$` get Jira link ↗. "+ Fila" and "+ Columna" expand the grid
  - **"Refrescar" button** — fetches from Jira via JQL, fills column A + B
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
| `src/services/apiService.ts` | `generateWithGroq()` (POST + marker validation + reasoning + error handling), `generateCriteria()`, `generateTestCases()`, `generateBugReport()`, `generateTestData()` |
| `src/services/jiraService.ts` | `extractIssueKey()`, `fetchJiraTicket()`, `formatTicketAsText()`, `jiraSearch()` |
| `src/App.tsx` | View state routing (5 tools + landing). Theme state. Jira token/URL state. |
| `src/components/Icons.tsx` | SVG icons — `Icon` object with 12 named components |
| `src/components/LandingScreen.tsx` | Editorial landing with hero, config strip, 5-tool list |
| `src/components/SearchableSelect.tsx` | Reusable searchable dropdown (used in BugReport/TestData market selects) |
| `src/components/SprintTracker.tsx` | Sprint Tracker router: list → detail navigation |
| `src/components/SprintList.tsx` | Sprint cards (active + archived), new sprint form, delete |
| `src/components/SprintDashboard.tsx` | Tabbed spreadsheet grid with inline JQL, resizable columns, Jira fetch |
| `src/hooks/useSprints.ts` | Sprint CRUD hook with localStorage persistence (exports Sprint, TabId, SprintJql types) |
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
- Sprint Tracker does NOT use Groq API — only Jira proxy.
- Test files co-located with source in `src/hooks/`.
- Design tokens in `:root` + `[data-theme="light"]` / `[data-theme="dark"]`.
