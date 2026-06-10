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

- `src/hooks/useHistory.test.ts` — 10 tests covering: initialization, entry shape, inputPreview truncation/trim, newest-first order, 10-entry limit, localStorage persistence, hydration from storage, clearHistory, and invalid JSON recovery.
- `src/hooks/useLocalStorage.test.ts` — 9 tests covering: initialValue fallback, stored value retrieval, setValue, functional updater, invalid JSON recovery, stale `acgen_model` discarding, valid model preservation, key-scoped model validation, and object values.

Run with `npm test` before committing when modifying hooks.

## Architecture

- **React 18 SPA**, Vite 5, TypeScript. All core logic in-browser. Express proxy (`server/`) for Jira API calls (CORS bypass).
- **State-based view routing** (`'landing' | 'acceptance' | 'testcase' | 'bugreport' | 'testdata'`) in `App.tsx` — no router library.
- **Settings persistence**: API key and model stored in `localStorage` (`acgen_api_key`, `acgen_model`). Jira URL base and PAT stored separately (`acgen_jira_token`, `acgen_jira_base_url`). Theme stored as `acgen_theme` (via `STORAGE_KEYS.THEME`). History for criteria and bug reports stored as `acgen_criteria_history` / `acgen_bug_history` (via `useHistory` hook). Model validated against `AVAILABLE_MODELS` on read; stale values discarded to `DEFAULT_MODEL`.
- **GROQ API** (`api.groq.com/openai/v1/chat/completions`) called via `fetch`. Temperature fixed at `0.2`.
- **Shared config**: all four tools receive API key and model as props from `App.tsx`. Response parsing and validation are centralized in the **service layer** — components only render.
- **Design tokens** live in `:root` (invariants) and `[data-theme="light"]` / `[data-theme="dark"]` in `App.css`. Key tokens: `--accent` (purple), `--bg`, `--surface`, `--border`, `--text`, `--text-2`, `--text-3`, `--radius` (16px), `--radius-sm` (11px), `--shadow-sm/md/lg`, `--danger/--success/--warning` with `-bg` variants. Fonts: Manrope (`--font-ui`), Newsreader italic (`--font-serif`), JetBrains Mono (`--font-mono`).
- **Theme**: light/dark via `[data-theme]` attribute on `<html>`. Toggle button in Header topbar. State managed in `App.tsx` via `useLocalStorage<'light'|'dark'>(STORAGE_KEYS.THEME, 'light')` + `useEffect` that syncs attribute. Initialized from stored value, falls back to `prefers-color-scheme`.
- **SVG Icons**: `src/components/Icons.tsx` exports an `Icon` object with named components (criterios, testcase, bug, datos, eye, eyeOff, sun, moon, spark, arrow, chevron, back). All are 24×24, stroke-based, `currentColor`, `strokeWidth` 1.6. No emojis used as icons.
- **Shared CSS primitives**: form fields (`.field-input`, `.field-select`, `.field-textarea`, `.field-label`), buttons (`.btn-primary`, `.btn-ghost`, `.btn-icon-new`), tables (`.data-table-wrap`, `.data-table`), badges (`.badge` + `.badge-high/medium/low/positive/negative/info`), output panels (`.panel`, `.panel-header`, `.panel-body`), reasoning sections (`.reasoning` with `<details>/<summary>`), Jira config (`.jira-indicator`, `.jira-config`, `.jira-config-title`, `.jira-fields`), action bar (`.actions-bar`), model badge (`.model-badge-new`).

### Acceptance Criteria

- System prompt (`HARDCODED_PROMPT` in `constants.ts`) — instructions + Confluence wiki format template with `{panel}`, `{quote}`, `*Dado*`, `*Cuando*`, `*Entonces*` markers.
- `generateCriteria()` calls `generateWithGroq()` with `REQUIRED_MARKERS`. Post-response markers validated against `content` only. Missing markers → error with list of missing elements.
- Returns `GroqResponse` (`{ content, model, reasoning? }`). Reasoning text captured from API and passed to component for display — never marker-validated.
- **History**: `AcceptanceCriteriaTool` saves the last 10 successful generations to localStorage (`acgen_criteria_history`) via `useHistory()` hook. A "Historial" button in the actions bar opens a modal overlay (`HistoryModal`) listing saved entries. Clicking "Cargar" loads the output back into the textarea. History persists across browser sessions.

### Test Cases

- System prompt (`TESTCASE_PROMPT` in `constants.ts`) — instructions + JSON schema, entirely in Spanish. Requires the model to return a raw JSON array (`key`, `summary`, `priority`, `type`, `preconditions`, `testSteps`, `expectedResult`).
- `generateTestCases()` calls `generateWithGroq()` with **empty markers** (no marker validation), then runs `extractJsonArray()` (robust — strips markdown fences, finds first `[` / last `]`) + `validateTestCases()` (field-by-field check against `TestCaseData`). Throws descriptive error on missing fields.
- Returns `TestCaseResponse` (`{ testCases: TestCaseData[], model }`) — raw content never exposed to component.
- Rendered as styled HTML table with colored priority badges (`.badge-high`, `.badge-medium`, `.badge-low`) and type badges (`.badge-positive`, `.badge-negative`), numbered step lists.
- Action buttons: "Copiar como tabla Jira" (Confluence wiki table format) and "Descargar PDF" (landscape PDF via jsPDF + jspdf-autotable).
- Priority/type rendering handles both Spanish and English values for backward compat.

### Bug Report Generator

- System prompt (`BUG_REPORT_PROMPT` in `constants.ts`) — instructions for generating Jira wiki formatted bug reports for Bershka ecommerce. Output uses six `{panel}` blocks with titles: `DESCRIPCIÓN:`, `PRECONDICION:`, `PASOS DE REPRODUCCIÓN:`, `RESULTADO ACTUAL`, `RESULTADO ESPERADO`, `Criterios aceptación` (the last containing a `{quote}` with Dado/Cuando/Entonces markers).
- Output starts directly with the first `{panel}` — no standalone title line before it. The DESCRIPCIÓN panel contains ONLY two fields: `Entorno/País` and `Versión`. No Plataforma, Dispositivo, URL, or descriptive paragraph.
- The Criterios aceptación block uses: `ResultadoQA: (/)/(x)`, date in `DD-MM-YYYY` format, and `Validado por: Jorge-QA`.
- `generateBugReport()` in `apiService.ts` — builds user message from `BugReportFormData` (description, platform, market, browser/URL or app version/device/OS), injects current date in `DD-MM-YYYY` format via explicit `padStart` formatting, calls `generateWithGroq()` with empty markers and `tool='criteria'`. Returns `GroqResponse`.
- Four platform types: Web Desktop, Web Mobile, App Android, App iOS. Platform selection dynamically switches form fields. For app platforms, the **device** field is a `<select>` dropdown populated from `IOS_DEVICES` (iPhone XR, iPhone 11) or `ANDROID_DEVICES` (Redmi Note 11 Pro, Moto g35 5G). Switching platforms resets device to the first entry.
- Platform-aware language: mobile interaction terms (tap, swipe) for app platforms, web terms (click, hover, scroll) for web platforms.
- Optional Jira context: if a related ticket URL is provided and Jira credentials exist, fetches ticket data via the proxy and includes it as context in the prompt.
- Output: Jira wiki format bug report, copyable to clipboard. Reasoning is captured and displayed when available.
- **History**: Same history feature as the Criteria tool — last 10 successful bug reports saved to localStorage (`acgen_bug_history`) via `useHistory()`. "Historial" button in actions bar opens `HistoryModal` with saved entries.

### Test Data Generator

- System prompt (`TEST_DATA_PROMPT` in `constants.ts`) — instructions for generating realistic test data per market for Bershka ecommerce. Supports 5 data types: shipping address, billing data, user registration, payment cards, promo codes.
- `generateTestData()` in `apiService.ts` — builds user message from `TestDataFormData` (dataType, market, quantity), calls `generateWithGroq()` with empty markers and `tool='testcase'` (reasoning hidden), parses JSON response via `extractJsonArray()`. Returns `{ data: Record<string, string>[], model }`.
- Data type schemas: `shipping-address` (nombre, apellidos, direccion, codigoPostal, ciudad, provincia, pais, telefono), `billing-data` (adds documentoId, tipoDocumento, email), `user-registration` (adds password, fechaNacimiento, genero), `payment-cards` (tipo, numero, titular, expiracion, cvv — uses Adyen test card numbers), `promo-codes` (codigo, tipo, valor, condiciones, validoHasta).
- **User-registration specific rules** (rules 8-9 in the prompt):
  - Emails must use a short lowercase first name from the selected market's country (no surnames, no numbers, no dots/underscores) followed by a rotating QA domain: `@qa`, `@qa1`, `@qa2`, `@qa.1`, `@qa.2`, `@qa.3`, `@qa.4`, etc. Examples: `maria@qa`, `jean@qa1`, `luca@qa2`.
  - Password is ALWAYS `Test1234` for every record. No variations.
- Output rendered as HTML table with Spanish column headers via `LABEL_MAP`. Individual row copy as formatted text (`Label: value` lines), "Copiar todo como tabla" (TSV for spreadsheets/Jira), "Descargar CSV" (with BOM `\uFEFF` for Excel compatibility).
- Optional Jira context for scenario-relevant data generation.

### Model-aware reasoning params

In `apiService.ts`, `getReasoningParams(model, tool)` returns request-body params per model:

| Model | `tool='testcase'` | `tool='criteria'` |
|---|---|---|
| `qwen/qwen3-32b` | `reasoning_format: "hidden"` (suppressed) | `reasoning_format: "parsed"` (returned separately) |
| `openai/gpt-oss-*` | none (reasoning inherently separate from content) | none (reasoning in `reasoning` field by default) |
| `llama-*` | none | none |

Test case and test data output **never** includes reasoning regardless of model. Criteria and bug report outputs include reasoning when the API provides it.

### Decommissioned-model error handling

`generateWithGroq()` detects HTTP 400 with `model_decommissioned` / `model_not_found` / `invalid model` / `model not found` in the error body and surfaces: *"El modelo seleccionado ya no está disponible. Por favor selecciona otro modelo."* Also handles HTTP 401 (invalid API key) and HTTP 429 (rate limit) with specific Spanish messages.

### Proxy Server

- **`server/index.js`** — Express app on port 3002, CORS origin `http://localhost:5173`, JSON middleware, mounts Jira routes at `/api/jira`.
- **`server/jiraRoutes.js`** — `GET /api/jira/issue/:issueKey`. Reads `X-Jira-Token` and `X-Jira-Base-Url` from request headers, proxies to `{baseUrl}/rest/api/2/issue/{issueKey}`. Returns cleaned `JiraTicketData` (key, summary, description, issueType, priority, status, labels, components, acceptanceCriteria from `customfield_10401`). Handles 401 (invalid token), 404 (not found), and generic errors with Spanish messages.
- Run with `npm run server` or `npm run dev:all`. Not required for the non-Jira flow.

### Jira ticket integration

Three tools (AcceptanceCriteria, BugReport, TestData) use Jira integration via `jiraService.ts`:
- `extractIssueKey(input)` — matches `JIRA_URL_REGEX` (`https://.../browse/PROJECT-N`) and returns the issue key or `null`.
- `fetchJiraTicket(issueKey, token, baseUrl)` — calls the Express proxy at `{PROXY_URL}/jira/issue/{issueKey}` with `X-Jira-Token` and `X-Jira-Base-Url` headers.
- `formatTicketAsText(ticket)` — formats structured `JiraTicketData` into a text block (key, summary, type, priority, status, labels, components, description, acceptance criteria).
- Config persisted in localStorage via `useLocalStorage(STORAGE_KEYS.JIRA_TOKEN)` and `useLocalStorage(STORAGE_KEYS.JIRA_BASE_URL)`, shared across all tools.

The dual-input flow differs per tool:
- **AcceptanceCriteria**: input textarea is both the Jira URL (auto-detected) and the fallback raw text. No separate ticket URL field.
- **BugReport/TestData**: an explicit optional "Ticket relacionado" text field alongside other form fields.

## Layout

### App shell

App shell uses `<div className="page">` > `<header className="topbar">` + `<main className="container">`. The `.page` is full viewport with `--bg-grad`. The `.container` has `max-width: 1260px` with responsive padding. Landing page inner elements (`.hero`, `.config-strip`) have their own `max-width: 760px` so they don't stretch.

### Landing screen

- Editorial layout rendered by `LandingScreen.tsx`. Hero section with eyebrow "Sesión de QA · Jorgito" and mixed-weight title ("**AC**Gen *¿En qué quieres trabajar hoy?*") using Manrope bold + Newsreader italic.
- Config strip: ApiKeyConfig and ModelSelector in a 1.5fr 1fr grid (`.config-strip`), no longer stacked above all tools.
- Section header "Generadores" with count badge "04" (`.sec-head`).
- Numbered tool list (`.tool-list`): each tool as a grid row with italic number (`.row-num`), SVG icon in a purple rounded box (`.tool-ico`), title/description (`.row-body`), tag pill (`.row-tag`), and hover arrow (`.row-arrow`). Tools: Criterios de aceptación, Test Case Generator, Bug Report Generator, Datos de Prueba.
- Extensibility slot (`.add-slot`): dashed border "+ Más generadores próximamente".
- Responsive: below 680px, `.brand-sub`, `.model-chip`, `.row-tag`, `.row-arrow` hide; `.config-strip` stacks to single column; `.tool-row` collapses to 3 columns.

### Header / Topbar (`Header.tsx`)

- Sticky topbar (`.topbar`) with backdrop blur and border-bottom. Two modes:
  - **Landing mode**: brand mark "A" (purple gradient, `.brand-mark`), brand name "ACGen" (`.brand-name`), subtitle "Generador de artefactos QA" (`.brand-sub`), model chip (`.model-chip`, shows current model with spark icon), theme toggle (`.theme-toggle`, sun/moon SVG).
  - **Tool mode**: back button (`.topbar-back`, chevron-left SVG), tool name as text, model chip, theme toggle.
- Props: `onBack?`, `subtitle?`, `model`, `theme`, `onToggleTheme`.

### Acceptance Criteria Tool (`AcceptanceCriteriaTool.tsx`)

- **Jira config**: `.jira-config` (left border accent), `.jira-config-title` ("Jira (opcional)"), `.jira-fields` containing two `.field-input` fields (URL base + PAT token with `.field-label`).
- **Main content** — asymmetric two-column grid (`.criteria-grid`, `grid-template-columns: 3fr 2fr`, gap 24px):
  - **Left column** (`.criteria-left`) — stacked: input textarea (`.field-textarea.criteria-input-ta`), output textarea (`.field-textarea.criteria-output-ta`, editable), "Copiar al portapapeles" button (`.btn-ghost` with `.copy-row`, right-aligned, visible only when output exists).
  - **Right column** (`.criteria-right`) — reasoning collapsible (`.reasoning` with `<details>/<summary>` + `.reasoning-body`). Only rendered when reasoning exists. Expand triggers `scrollIntoView` via `requestAnimationFrame`.
- **Action buttons**: `.actions-bar` with GenerateButton (`.btn-primary`), loading status (`.loading-status`), "Historial" (`.btn-ghost` with `.history-count` badge showing entry count), "Limpiar" (`.btn-ghost`).
- **History modal**: `HistoryModal` overlay rendered at the bottom. Clicking "Cargar" on an entry sets `criteria` to that output and closes the modal. "Borrar todo" clears all entries with confirmation.
- **Error handling**: `ErrorBanner` at the bottom.
- **Responsive**: below 768px, `.criteria-grid` stacks to single column.

### Test Case Generator (`TestCaseTool.tsx`)

- Single-column layout: input textarea (`.field-textarea`, `min-height: 200px`, label `.field-label`) → Generate/Limpiar buttons (`.actions-bar`) → output area.
- "Generar casos de prueba" button (`.btn-primary`) + "Limpiar" (`.btn-ghost`).
- Output area (shown only when test cases exist): label + model badge (`.model-badge-new`), action bar (`.btn-ghost` for "Copiar como tabla Jira" + "Descargar PDF"), then styled HTML table (`.data-table-wrap` > `.data-table`) with 7 columns. Priority badges: `.badge-high`, `.badge-medium`, `.badge-low`. Type badges: `.badge-positive`, `.badge-negative`. Steps rendered as `<ol className="steps-list">`.
- PDF: landscape via jsPDF + jspdf-autotable, filename `casos-de-prueba-bershka.pdf`.

### Bug Report Tool (`BugReportTool.tsx`)

- **Jira config**: `.jira-indicator` (green "Jira configurado ✓" with "Editar" `.btn-ghost`) when configured, else `.jira-config` with `.field-input` fields.
- **Structured form** (`.br-form-grid`):
  - Row 1 (`.br-form-row`, two columns): Platform selector (`.field-select` with `.select-chev`) and Market selector (`.field-select`).
  - Row 2 (`.br-form-row`, dynamic): Web → Browser (`.field-select`) and URL (`.field-input`). App → App version (`.field-input`) and Device (`.field-select`).
  - Row 3 (`.br-form-row-single`, app only): OS version (`.field-input`).
  - Row 4 (`.br-form-row-single`): Optional Jira ticket URL (`.field-input`).
  - Row 5 (`.br-form-row-single`): Bug description (`.field-textarea`).
- **Output area** (`.br-output-section`): read-only textarea (`.field-textarea`, `min-height: 350px`), "Copiar al portapapeles" button (`.btn-ghost`), reasoning collapsible (`.reasoning`) below.
- **Action buttons** (`.actions-bar`): GenerateButton, loading status, "Historial" (`.btn-ghost` with `.history-count` badge), "Limpiar" (`.btn-ghost`).
- **History modal**: Same `HistoryModal` as Criteria tool. "Cargar" sets `output` to the saved entry. "Borrar todo" clears bug report history.
- **Error handling**: `ErrorBanner` at the bottom.

### Test Data Tool (`TestDataTool.tsx`)

- **Jira config** — same `.jira-indicator`/`.jira-config` pattern as BugReportTool.
- **Structured form** (`.td-form-grid`):
  - Row 1 (`.td-form-row`, three columns): Data type selector (`.field-select`), Market selector (`.field-select`), Quantity selector (`.field-select`). All wrapped in `.input-wrap` with `.select-chev`.
  - Row 2 (`.td-form-row-single`): Optional Jira ticket URL (`.field-input`).
- **Action buttons** (`.actions-bar`): GenerateButton, loading status, "Limpiar" (`.btn-ghost`).
- **Output area** (`.td-output-section`, shown when data exists):
  - Model badge (`.model-badge-new`) + "Datos generados" label.
  - Action bar: "Copiar todo como tabla" (`.btn-ghost`, TSV format) + "Descargar CSV" (`.btn-ghost`).
  - HTML table (`.data-table-wrap` > `.data-table`) with Spanish column headers via `LABEL_MAP`. Each row has a "Copiar" button (`.td-copy-row-btn`, `.td-copy-col`) that copies that record as formatted text.
- **Error handling**: `ErrorBanner` at the bottom.

## Models

Current active list in `src/config/constants.ts`:

```
AVAILABLE_MODELS = [
  "openai/gpt-oss-120b",        ← DEFAULT_MODEL
  "openai/gpt-oss-20b",
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
  "qwen/qwen3-32b",
]
```

Note: models are plain strings. `deepseek-r1-distill-llama-70b` and `qwen-qwq-32b` were removed (decommissioned/deprecated). `qwen/qwen3-32b` replaced the old `qwen-qwq-32b`.

## Key files

| File | Purpose |
|---|---|
| `server/index.js` | Express proxy entry: CORS (`http://localhost:5173`), JSON middleware, mounts Jira routes at `/api/jira` |
| `server/jiraRoutes.js` | `GET /api/jira/issue/:issueKey` — proxies to Jira REST API, returns cleaned `JiraTicketData` |
| `src/config/constants.ts` | `API_URL`, `PROXY_URL`, `HARDCODED_PROMPT`, `REQUIRED_MARKERS`, `TESTCASE_PROMPT`, `BUG_REPORT_PROMPT`, `TEST_DATA_PROMPT`, `AVAILABLE_MODELS`, `DEFAULT_MODEL`, `TEMPERATURE`, `STORAGE_KEYS` (API_KEY, MODEL, JIRA_TOKEN, JIRA_BASE_URL, THEME, CRITERIA_HISTORY, BUG_HISTORY), `ViewType`, `JIRA_URL_REGEX`, `BERSHKA_MARKETS` (22 markets), `PLATFORMS`, `IOS_DEVICES` (iPhone XR, iPhone 11), `ANDROID_DEVICES` (Redmi Note 11 Pro, Moto g35 5G), `DATA_TYPES` |
| `src/services/apiService.ts` | `generateWithGroq()` (POST + marker validation + reasoning extraction + decommissioned-model + 401/429 error handling), `getReasoningParams()` (model-aware), `generateCriteria()`, `generateTestCases()` (`extractJsonArray` + `validateTestCases`, returns `TestCaseResponse`), `generateBugReport()` (date injection, returns `GroqResponse`), `generateTestData()` (`extractJsonArray`, returns `{ data, model }`) |
| `src/services/jiraService.ts` | `extractIssueKey()`, `fetchJiraTicket()`, `formatTicketAsText()` |
| `src/App.tsx` | View state routing; renders LandingScreen / AcceptanceCriteriaTool / TestCaseTool / BugReportTool / TestDataTool. Theme state via `useLocalStorage` + `useEffect` for `data-theme` attribute. Shell: `.page` > `<main className="container">`. ApiKeyConfig and ModelSelector rendered inside LandingScreen only, not above tools. |
| `src/components/Icons.tsx` | SVG icon library — `Icon` object with named components (criterios, testcase, bug, datos, eye, eyeOff, sun, moon, spark, arrow, chevron, back). All 24×24, stroke-based, `currentColor`. |
| `src/components/Header.tsx` | Sticky topbar: brand mark (purple gradient "A"), brand name, subtitle, model chip, theme toggle. Two modes: landing (full brand) and tool (back arrow + tool name). |
| `src/components/LandingScreen.tsx` | Editorial landing: hero (eyebrow + mixed-font title), config strip (ApiKeyConfig + ModelSelector), numbered tool list with SVG icons, extensibility slot. |
| `src/components/AcceptanceCriteriaTool.tsx` | Criteria UI: `.jira-config` section, `.criteria-grid` asymmetric columns (input→output→copy left, reasoning right), generate/clear/copy, history modal ("Historial" button with `.history-count` badge), dual input flow (Jira URL → fetch → format → generate, or plain text) |
| `src/components/TestCaseTool.tsx` | Test case UI: single-column, input → generate/clear → `.data-table` with badges + Jira copy + PDF download |
| `src/components/BugReportTool.tsx` | Bug report UI: structured form (`.br-form-grid`, platform/market, dynamic web/app fields with `.field-select` device dropdowns), `.jira-indicator`/`.jira-config` for Jira, output textarea + copy + reasoning, history modal, generate/clear |
| `src/components/TestDataTool.tsx` | Test data UI: structured form (`.td-form-grid`, dataType/market/quantity), `.jira-indicator`/`.jira-config`, output `.data-table` with row copy + TSV copy + CSV download |
| `src/components/HistoryModal.tsx` | History modal overlay: lists saved entries with date, input preview, and "Cargar" button. Opens on outside click close. Empty state message. "Borrar todo" with confirm. |
| `src/components/GenerateButton.tsx` | Reusable button using `.btn-primary` + `.spinner-new`; accepts `label`/`loadingLabel` props |
| `src/components/ErrorBanner.tsx` | Dismissible error alert with SVG dismiss icon, uses `.error-banner`, `.error-icon`, `.error-text`, `.dismiss-btn` |
| `src/components/ApiKeyConfig.tsx` | API key input with show/hide toggle using `Icon.eye`/`Icon.eyeOff` SVGs; uses `.field-input` + `.adorn-btn` |
| `src/components/ModelSelector.tsx` | Model dropdown using `.field-select` + `.select-chev` with SVG chevron |
| `src/hooks/useLocalStorage.ts` | Generic localStorage hook; validates `acgen_model` against `AVAILABLE_MODELS` on read, discards stale values to `DEFAULT_MODEL` |
| `src/hooks/useHistory.ts` | History hook — `useHistory(storageKey)` returns `{ history, addEntry, clearHistory }`. Stores up to 10 `HistoryEntry` objects in localStorage. `addEntry(input, output)` creates an entry with `crypto.randomUUID()` id, `Date.now()` timestamp, and 60-char input preview. |
| `src/hooks/useHistory.test.ts` | Unit tests for `useHistory` hook — 10 tests: initialization, entry shape, inputPreview truncation (60 chars) and trim, newest-first order, 10-entry limit, localStorage persistence, hydration from storage, clearHistory, invalid JSON recovery. |
| `src/hooks/useLocalStorage.test.ts` | Unit tests for `useLocalStorage` hook — 9 tests: initialValue fallback, stored value retrieval, setValue, functional updater, invalid JSON recovery, stale `acgen_model` discarding, valid model preservation, key-scoped model validation, object values. |
| `src/types/index.ts` | `GroqResponse` (with `reasoning?`), `TestCaseResponse`, `GroqApiError`, `GenerationStatus`, `JiraTicketData`, `TestCaseData`, `PlatformId`, `BugReportFormData`, `DataTypeId`, `TestDataFormData`, `HistoryEntry` (id, timestamp, inputPreview, output) |
| `tsconfig.test.json` | TypeScript config for Vitest (extends `tsconfig.app.json`, adds `vitest/globals` types, disables `noUnusedLocals`/`noUnusedParameters`). Does NOT affect production build. |

## Changing model

Edit `AVAILABLE_MODELS` array and `DEFAULT_MODEL` in `src/config/constants.ts`. Models are plain strings. `useLocalStorage` automatically discards stale stored values on next load.

## Changing output format — Acceptance Criteria

Edit `HARDCODED_PROMPT` in `constants.ts`. Update `REQUIRED_MARKERS` if markers change. The prompt is the **system message**. Reasoning extraction is automatic for supported models.

## Changing output format — Test Cases

Edit `TESTCASE_PROMPT` in `constants.ts`. Keep JSON-only constraint and field schema. Update `extractJsonArray` / `validateTestCases` in `apiService.ts` if the JSON schema changes. Update rendering (table columns, PDF headers, Jira wiki format) in `TestCaseTool.tsx` to match.

## Changing output format — Bug Report

Edit `BUG_REPORT_PROMPT` in `constants.ts`. The prompt defines the exact Jira wiki panel structure. If the output format changes (new panels, different field names), update the FORMATO DE SALIDA block. The date is injected in `generateBugReport()` in `apiService.ts` — if the date format needs to change, update the `padStart` formatting call there.

## Changing output format — Test Data

Edit `TEST_DATA_PROMPT` in `constants.ts`. Keep JSON-only constraint and per-data-type schemas. If new data types are added, add an entry to `DATA_TYPES` in `constants.ts`, add the schema to the prompt, and add field mappings to `LABEL_MAP` in `TestDataTool.tsx`. The prompt uses `extractJsonArray()` so the JSON structure must be an array of objects. If user-registration email/password rules change, update rules 8 and 9.

## Notable

- Entrypoint: `src/main.tsx` → `App.tsx`.
- `jspdf` + `jspdf-autotable` are static imports in `TestCaseTool.tsx`.
- Models are plain strings. `ModelOption` interface was deleted.
- `Icons.tsx` exports an `Icon` object with named icon components and a base `Svg` helper.
- App shell uses `<div className="page">` > `<header className="topbar">` + `<main className="container">`.
- Theme persisted as `acgen_theme` in localStorage via `STORAGE_KEYS.THEME`.
- `tsconfig.app.json` has `"exclude": ["src/**/*.test.ts", "src/test"]` to keep test files out of the production build (`tsc -b`). `tsconfig.test.json` extends it with `"types": ["vitest/globals"]`, `"noUnusedLocals": false`, `"noUnusedParameters": false` for test-only TypeScript context. It does NOT affect `npm run build`.
- Test files are co-located with their source files in `src/hooks/`. Only hooks with non-trivial logic are tested — no component tests.
- `Icons.tsx` exports an `Icon` object with named icon components and a base `Svg` helper.
- App shell uses `<div className="page">` > `<header className="topbar">` + `<main className="container">`.
- Theme persisted as `acgen_theme` in localStorage via `STORAGE_KEYS.THEME`.
- Remaining per-tool layout classes in `App.css`: `.criteria-grid`, `.criteria-left`, `.criteria-right`, `.criteria-input-ta`, `.criteria-output-ta` (acceptance criteria asymmetric grid), `.br-form-grid`, `.br-form-row`, `.br-form-row-single`, `.br-form-field`, `.br-output-section` (bug report form layout), `.td-form-grid`, `.td-form-row`, `.td-form-row-single`, `.td-form-field`, `.td-output-section`, `.td-actions-bar`, `.td-copy-col`, `.td-copy-row-btn` (test data form/table layout), `.output-section`, `.output-header` (generic output area), `.copy-row` (copy button alignment), `.btn-copied` (copy success state), `.loading-status` (inline loading text), `.steps-list` (ordered step list).
- Shared primitives in `App.css`: `.field-input`, `.field-select`, `.field-textarea`, `.field-label`, `.input-wrap`, `.select-chev`, `.adorn-btn`, `.btn-primary`, `.btn-ghost`, `.btn-icon-new`, `.btn-loading`, `.spinner-new`, `.data-table-wrap`, `.data-table`, `.badge` + variants, `.panel`, `.panel-header`, `.panel-body`, `.reasoning`, `.jira-indicator`, `.jira-indicator-text`, `.jira-config`, `.jira-config-title`, `.jira-fields`, `.actions-bar`, `.model-badge-new`, `.error-banner`, `.error-icon`, `.error-text`, `.dismiss-btn`.
- History CSS classes in `App.css`: `.history-overlay` (fixed overlay with backdrop blur), `.history-modal` (600px max-width, 70vh max-height), `.history-modal-header`/`.history-modal-title`/`.history-close-btn`, `.history-modal-body`, `.history-empty`, `.history-entry` (2-column grid: date + preview left, "Cargar" button right), `.history-entry-meta`/`.history-entry-date`/`.history-entry-preview`, `.history-entry-load`, `.history-count` (accent badge on button).
- CSS custom properties in `App.css`: invariants in `:root`, light theme in `[data-theme="light"]` (also `:root`), dark theme in `[data-theme="dark"]`. All token names use `var(--*)` exclusively — no aliased old names (alias bridge removed in Phase 5).
- Dependencies: `express` + `cors` + `concurrently` are devDependencies (proxy server); `jspdf` + `jspdf-autotable` are production dependencies (PDF generation).

## Potential future tools

Tools identified as useful for the functional QA workflow at Bershka that could be added following the same SPA architecture:

- **Regression checklist** — takes as input the area affected by a change (checkout, PDP, login, cart, search…) and generates a risk-prioritized regression checklist in Jira wiki / Confluence format. Highest priority: covers the gap between development and QA that the current 4 tools do not address.
- **Test summary / Release notes** — takes the bug reports and test cases from a session and generates an executive summary for the team or PM in Confluence format.
- **Figma vs implementation comparator** — visual analysis of design vs actual behavior (requires image upload; technically more complex than the current tools).
