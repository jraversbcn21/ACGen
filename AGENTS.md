# ACGen — Agent guide

## Commands (run from `acgen/`)

| Command | Action |
|---|---|
| `npm run dev` | Start Vite dev server (port 5173) |
| `npm run server` | Start Express proxy (port 3001) |
| `npm run dev:all` | Start both Vite + proxy concurrently |
| `npm run build` | Type-check (`tsc -b`) + Vite build |
| `npm run lint` | ESLint |
| `npm run preview` | Vite preview |

No tests configured.

## Architecture

- **React 18 SPA**, Vite 5, TypeScript. All core logic in-browser. Express proxy (`server/`) for Jira API calls (CORS bypass).
- **State-based view routing** (`'landing' | 'acceptance' | 'testcase' | 'bugreport' | 'testdata'`) in `App.tsx` — no router library.
- **Settings persistence**: API key and model stored in `localStorage` (`acgen_api_key`, `acgen_model`). Jira URL base and PAT stored separately (`acgen_jira_token`, `acgen_jira_base_url`). Model validated against `AVALIABLE_MODELS` on read; stale values discarded to `DEFAULT_MODEL`.
- **GROQ API** (`api.groq.com/openai/v1/chat/completions`) called via `fetch`. Temperature fixed at `0.2`.
- **Shared config**: all four tools receive API key and model as props from `App.tsx`. Response parsing and validation are centralized in the **service layer** — components only render.

### Acceptance Criteria

- System prompt (`HARDCODED_PROMPT` in `constants.ts`) — instructions + Confluence wiki format template with `{panel}`, `{quote}`, `*Dado*`, `*Cuando*`, `*Entonces*` markers.
- `generateCriteria()` calls `generateWithGroq()` with `REQUIRED_MARKERS`. Post-response markers validated against `content` only. Missing markers → error with list of missing elements.
- Returns `GroqResponse` (`{ content, model, reasoning? }`). Reasoning text captured from API and passed to component for display — never marker-validated.

### Test Cases

- System prompt (`TESTCASE_PROMPT` in `constants.ts`) — instructions + JSON schema, entirely in Spanish. Requires the model to return a raw JSON array (`key`, `summary`, `priority`, `type`, `preconditions`, `testSteps`, `expectedResult`).
- `generateTestCases()` calls `generateWithGroq()` with **empty markers** (no marker validation), then runs `extractJsonArray()` (robust — strips markdown fences, finds first `[` / last `]`) + `validateTestCases()` (field-by-field check against `TestCaseData`). Throws descriptive error on missing fields.
- Returns `TestCaseResponse` (`{ testCases: TestCaseData[], model }`) — raw content never exposed to component.
- Rendered as styled HTML table with colored priority badges (Alta=red, Media=amber, Baja=green) and type badges (Positivo=green, Negativo=red), numbered step lists.
- Action buttons: "Copiar como tabla Jira" (Confluence wiki table format) and "Descargar PDF" (landscape PDF via jsPDF + jspdf-autotable).
- Priority/type rendering handles both Spanish and English values for backward compat.

### Bug Report Generator

- System prompt (`BUG_REPORT_PROMPT` in `constants.ts`) — instructions for generating Jira wiki formatted bug reports for Bershka ecommerce. Output uses six separate `{panel}` blocks with specific titles: `*DESCRIPCIÓN:*`, `*PRECONDICION:*`, `*PASOS DE REPRODUCCIÓN:*`, `*RESULTADO ACTUAL*`, `*RESULTADO ESPERADO*`, `*Criterios aceptación*` (the last one containing a `{quote}` with Dado/Cuando/Entonces markers).
- Title format: `[CategoríaFuncional] - Descripción breve`. Categories are constrained to 18 predefined functional areas (Home, Catálogo, Búsqueda, PDP, Tallas, Carrito, Checkout, Pagos, Mi Cuenta, Wishlist, Newsletter, Store Finder, Login/Registro, Navegación, SEO, Push Notifications, Deep Links, General).
- `generateBugReport()` in `apiService.ts` — builds user message from `BugReportFormData` (description, platform, market, browser/URL or app version/device/OS), injects current date via `new Date().toISOString().split('T')[0]`, calls `generateWithGroq()` with empty markers and `tool='criteria'`. Returns `GroqResponse`.
- Four platform types: Web Desktop, Web Mobile, App Android, App iOS. Platform selection dynamically switches form fields (browser+URL vs app version+device+OS).
- Platform-aware language: mobile interaction terms (tap, swipe) for app platforms, web terms (click, hover, scroll) for web platforms.
- Optional Jira context: if a related ticket URL is provided and Jira credentials exist, fetches ticket data via the proxy and includes it as context in the prompt.
- Output: Jira wiki format bug report, copyable to clipboard. Reasoning is captured and displayed when available.

### Test Data Generator

- System prompt (`TEST_DATA_PROMPT` in `constants.ts`) — instructions for generating realistic test data per market for Bershka ecommerce. Supports 5 data types: shipping address, billing data, user registration, payment cards, promo codes.
- `generateTestData()` in `apiService.ts` — builds user message from `TestDataFormData` (dataType, market, quantity), calls `generateWithGroq()` with empty markers and `tool='testcase'` (reasoning hidden), parses JSON response via `extractJsonArray()`. Returns `{ data: Record<string, string>[], model }`.
- Data type schemas defined in the prompt: `shipping-address` (nombre, apellidos, direccion, codigoPostal, ciudad, provincia, pais, telefono), `billing-data` (adds documentoId, tipoDocumento, email), `user-registration` (adds password, fechaNacimiento, genero), `payment-cards` (tipo, numero, titular, expiracion, cvv — uses Adyen test card numbers: Visa `4111 1111 1111 1111`, Mastercard `5500 0000 0000 0004`, Amex `3700 0000 0000 002`), `promo-codes` (codigo, tipo, valor, condiciones, validoHasta).
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

- **`server/index.js`** — Express app on port 3001, CORS origin `http://localhost:5173`, JSON middleware, mounts Jira routes at `/api/jira`.
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

### Landing screen

- Four-button card layout in a 2×2 CSS grid rendered by `LandingScreen.tsx`. Buttons: "Criterios de aceptación" (📋), "Test Case Generator" (🧪), "Bug Report Generator" (🐛), and "Datos de Prueba" (📊). Each with a subtitle description. Container max-width 600px, cards fill grid cells. Responsive: stacks to single column below 768px.

### Acceptance Criteria Tool (`AcceptanceCriteriaTool.tsx`)

- **Config area** (rendered by `App.tsx`, above the tool):
  - Row 1: API Key input (monospace, password-masked) + Model selector dropdown.
  - Row 2: Jira config section within the tool — compact row with left border accent (`3px solid #cbd5e1`, `.ac-jira-section`). "Jira (opcional)" label in muted uppercase. Two side-by-side fields: URL base (text input, placeholder `https://jira.tuempresa.com/jira`) and PAT token (password input, placeholder `Tu Personal Access Token`). Both with 11px uppercase labels.
- **Main content** — asymmetric two-column grid (`.ac-main`, `grid-template-columns: 3fr 2fr`, gap 24px):
  - **Left column (~60%)** — stacked vertically with 16px gap: input textarea (`.ac-input-ta`, `min-height: 80px`), output textarea (`.ac-output-ta`, `min-height: 400px`, monospace), "Copiar al portapapeles" button (`.copy-row`, right-aligned, visible only when output exists). No visible labels.
  - **Right column (~40%)** — reasoning collapsible (`<details>/<summary>` "Razonamiento del modelo"), aligned with top of output via `margin-top: 96px`. Only rendered when reasoning exists. Expanded content: `max-height: 500px; overflow-y: auto`. Expand triggers `scrollIntoView({ block: 'center' })` via `requestAnimationFrame`, respects `prefers-reduced-motion`.
- **Action buttons** — centered (`.ac-bottom-actions`, `margin-top: 32px`): "Generar criterios de aceptación" (primary), loading status text, "Limpiar" (secondary, `window.confirm`).
- **Error handling**: `ErrorBanner` at the bottom.
- **Responsive**: stacks to single column below 768px; reasoning margin-top resets to 0.

### Test Case Generator (`TestCaseTool.tsx`)

- Single-column layout: full-width input textarea (`min-height: 200px`, label "Instrucciones para casos de prueba") → Generate/Limpiar buttons → output area.
- "Generar casos de prueba" button + "Limpiar" (same `window.confirm` pattern).
- Output area (shown only when test cases exist): model badge, action bar ("Copiar como tabla Jira" + "Descargar PDF"), then styled HTML table with 7 columns (Key, Summary, Priority, Type, Preconditions, Test Steps, Expected Result).
- PDF: landscape, column widths preset, blue header row, filename `casos-de-prueba-bershka.pdf`.

### Bug Report Tool (`BugReportTool.tsx`)

- **Jira config** — if Jira credentials exist in localStorage, shows a compact green indicator `.br-jira-indicator` "Jira configurado ✓" with "Editar" toggle. Otherwise shows the same Jira config section as acceptance tool (`.ac-jira-section`, left border accent, URL base + PAT token).
- **Structured form** (`.br-form-grid`, gap 16px):
  - Row 1 (two columns): Platform selector (`PLATFORMS` — 4 types) and Market selector (`BERSHKA_MARKETS`, 13 markets).
  - Row 2 (two columns, dynamic): Web → Browser (select: Chrome/Firefox/Safari/Edge + Samsung Internet for web-mobile) and URL (pre-filled `https://localhost:3443/`). App → app version and device fields.
  - Row 3 (single column, app only): OS version field (Android/iOS).
  - Row 4 (single column): Optional Jira ticket URL input.
  - Row 5 (single column): Bug description textarea (`min-height: 120px`).
- **Output area** (`.br-output-section`): read-only textarea (`.br-output-ta`, `min-height: 350px`, monospace), "Copiar al portapapeles" button, reasoning collapsible below.
- **Action buttons** (`.bottom-actions`): "Generar bug report" (primary, disabled when API key or description empty), loading status, "Limpiar".
- **Error handling**: `ErrorBanner` at the bottom.

### Test Data Tool (`TestDataTool.tsx`)

- **Jira config** — same indicator pattern as BugReportTool (green "Jira configurado ✓" with edit toggle when credentials exist, otherwise Jira URL base + PAT token fields).
- **Structured form** (`.td-form-grid`, gap 16px):
  - Row 1 (three columns): Data type selector (`DATA_TYPES` — 5 types), Market selector (`BERSHKA_MARKETS`), Quantity selector (1–10).
  - Row 2 (single column): Optional Jira ticket URL input.
- **Action buttons** (`.bottom-actions`): "Generar datos de prueba" (primary, disabled when API key empty), loading status, "Limpiar".
- **Output area** (`.td-output-section`, shown when data exists):
  - Model badge + "Datos generados" label.
  - Action bar: "Copiar todo como tabla" (TSV for spreadsheets/Jira) + "Descargar CSV" (BOM for Excel, filename `datos-prueba-{dataType}-{market}.csv`).
  - HTML table (`.td-table`) with Spanish column headers via `LABEL_MAP`. Each row has a "Copiar" button that copies that record as formatted text (`Label: value` lines).
- **Error handling**: `ErrorBanner` at the bottom.

## Models

Current active list in `src/config/constants.ts`:

```
AVALIABLE_MODELS = [
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
| `src/config/constants.ts` | `API_URL`, `PROXY_URL`, `HARDCODED_PROMPT`, `REQUIRED_MARKERS`, `TESTCASE_PROMPT`, `BUG_REPORT_PROMPT`, `TEST_DATA_PROMPT`, `AVALIABLE_MODELS`, `DEFAULT_MODEL`, `TEMPERATURE`, `STORAGE_KEYS` (API_KEY, MODEL, JIRA_TOKEN, JIRA_BASE_URL), `ViewType`, `JIRA_URL_REGEX`, `BERSHKA_MARKETS`, `PLATFORMS`, `DATA_TYPES` |
| `src/services/apiService.ts` | `generateWithGroq()` (POST + marker validation + reasoning extraction + decommissioned-model + 401/429 error handling), `getReasoningParams()` (model-aware), `generateCriteria()`, `generateTestCases()` (`extractJsonArray` + `validateTestCases`, returns `TestCaseResponse`), `generateBugReport()` (date injection, returns `GroqResponse`), `generateTestData()` (`extractJsonArray`, returns `{ data, model }`) |
| `src/services/jiraService.ts` | `extractIssueKey()`, `fetchJiraTicket()`, `formatTicketAsText()` |
| `src/App.tsx` | View state routing; renders LandingScreen / AcceptanceCriteriaTool / TestCaseTool / BugReportTool / TestDataTool + shared ApiKeyConfig + ModelSelector |
| `src/components/AcceptanceCriteriaTool.tsx` | Criteria UI: Jira config section, two-column grid (input→output→copy left, reasoning right), generate/clear/copy, dual input flow (Jira URL → fetch → format → generate, or plain text) |
| `src/components/TestCaseTool.tsx` | Test case UI: single-column, input → generate/clear → HTML table with badges + Jira copy + PDF download; no JSON parsing |
| `src/components/BugReportTool.tsx` | Bug report UI: structured form (platform, market, dynamic web/app fields, description), Jira config with toggle, output textarea + copy + reasoning, generate/clear |
| `src/components/TestDataTool.tsx` | Test data UI: structured form (dataType, market, quantity), Jira config with toggle, output HTML table with row copy + TSV copy + CSV download, generate/clear |
| `src/components/LandingScreen.tsx` | Four-button card entry screen in 2×2 grid |
| `src/components/GenerateButton.tsx` | Reusable button with spinner; accepts `label`/`loadingLabel` props |
| `src/components/ErrorBanner.tsx` | Dismissible error alert with icon |
| `src/components/Header.tsx` | Title + optional back button and subtitle |
| `src/components/RequirementInput.tsx` | Textarea wrapper with label prop (currently **unused** — textareas rendered directly in AcceptanceCriteriaTool) |
| `src/components/CriteriaOutput.tsx` | Output textarea + model badge wrapper (currently **unused** — rendered directly in AcceptanceCriteriaTool) |
| `src/hooks/useLocalStorage.ts` | Generic localStorage hook; validates `acgen_model` against `AVALIABLE_MODELS` on read, discards stale values to `DEFAULT_MODEL` |
| `src/types/index.ts` | `GroqRequest`, `GroqResponse` (with `reasoning?`), `TestCaseResponse`, `GroqApiError`, `GenerationStatus`, `JiraTicketData`, `TestCaseData`, `PlatformId`, `BugReportFormData`, `DataTypeId`, `TestDataFormData` |

## Changing model

Edit `AVALIABLE_MODELS` array and `DEFAULT_MODEL` in `src/config/constants.ts`. Models are plain strings. `useLocalStorage` automatically discards stale stored values on next load.

## Changing output format — Acceptance Criteria

Edit `HARDCODED_PROMPT` in `constants.ts`. Update `REQUIRED_MARKERS` if markers change. The prompt is the **system message**. Reasoning extraction is automatic for supported models.

## Changing output format — Test Cases

Edit `TESTCASE_PROMPT` in `constants.ts`. Keep JSON-only constraint and field schema. Update `extractJsonArray` / `validateTestCases` in `apiService.ts` if the JSON schema changes. Update rendering (table columns, PDF headers, Jira wiki format) in `TestCaseTool.tsx` to match.

## Changing output format — Bug Report

Edit `BUG_REPORT_PROMPT` in `constants.ts`. The prompt defines the exact Jira wiki panel structure and functional area categories. If the output format changes (new panels, different field names), update the FORMATO DE SALIDA block. If the title categories change, update rule 8. The date is injected in `generateBugReport()` via `new Date().toISOString()` — no prompt change needed for date format.

## Changing output format — Test Data

Edit `TEST_DATA_PROMPT` in `constants.ts`. Keep JSON-only constraint and per-data-type schemas. If new data types are added, add an entry to `DATA_TYPES` in `constants.ts`, add the schema to the prompt, and add field mappings to `LABEL_MAP` in `TestDataTool.tsx`. The prompt uses `extractJsonArray()` so the JSON structure must be an array of objects.

## Notable

- Entrypoint: `src/main.tsx` → `App.tsx`.
- `jspdf` + `jspdf-autotable` are static imports in `TestCaseTool.tsx`.
- `GroqRequest` is unused but kept as-is. `ModelOption` was deleted — models are plain strings.
- `RequirementInput.tsx` and `CriteriaOutput.tsx` still exist in the codebase but are no longer imported anywhere (dead code); textareas are rendered directly in `AcceptanceCriteriaTool.tsx`.
- Reasoning section CSS: `.reasoning-section`, `.reasoning-summary`, `.reasoning-content`, `.ac-main-right .reasoning-section`, `.ac-main-right .reasoning-content` in `App.css`.
- Acceptance tool CSS: `.ac-*` prefixed classes (`.ac-wrapper`, `.ac-jira-section`, `.ac-jira-label`, `.ac-jira-row`, `.ac-jira-field`, `.ac-config-label`, `.ac-config-input`, `.ac-main`, `.ac-main-left`, `.ac-main-right`, `.ac-input-ta`, `.ac-output-ta`, `.ac-bottom-actions`).
- Bug report tool CSS: `.br-*` prefixed classes (`.br-wrapper`, `.br-jira-indicator`, `.br-jira-check`, `.br-form-grid`, `.br-form-row`, `.br-form-row-single`, `.br-form-field`, `.br-form-label`, `.br-form-input`, `.br-form-select`, `.br-description-ta`, `.br-output-section`, `.br-output-ta`).
- Test data tool CSS: `.td-*` prefixed classes (`.td-wrapper`, `.td-form-grid`, `.td-form-row`, `.td-form-row-single`, `.td-form-field`, `.td-form-label`, `.td-form-input`, `.td-form-select`, `.td-output-section`, `.td-actions-bar`, `.td-table`, `.td-table-wrapper`, `.td-copy-col`, `.td-copy-row-btn`).
- Jira CSS (unused legacy): `.jira-config-section`, `.jira-config-label`, `.jira-config-fields` — from an earlier layout iteration, not referenced by current components.
- Dependencies: `express` + `cors` + `concurrently` are devDependencies (proxy server); `jspdf` + `jspdf-autotable` are production dependencies (PDF generation).
