# ACGen — Agent guide

## Commands (run from cgen/)

| Command | Action |
|---|---|
| 
pm run dev | Start Vite dev server (port 5173) |
| 
pm run server | Start Express proxy (port 3002) |
| 
pm run dev:all | Start both Vite + proxy concurrently |
| 
pm run build | Type-check (	sc -b) + Vite build |
| 
pm run lint | ESLint |
| 
pm run preview | Vite preview |
| 
pm test | Run unit tests (Vitest) |
| 
pm run test:watch | Run tests in watch mode |
| 
pm run test:ui | Run tests with Vitest UI |

## Testing

Unit tests with Vitest + React Testing Library. Only hooks with non-trivial logic are tested.

- src/hooks/useHistory.test.ts — 10 tests
- src/hooks/useLocalStorage.test.ts — 9 tests
- src/hooks/useSprints.test.ts — 13 tests (init, add, archive, update, grid cells, persistence, hydration, migration, invalid JSON)

Run 
pm test before committing when modifying hooks.

## Architecture

- **React 18 SPA**, Vite 5, TypeScript. Express proxy (server/) for Jira API calls (CORS bypass).
- **State-based view routing** ('landing' | 'acceptance' | 'testcase' | 'bugreport' | 'testdata' | 'sprinttracker').
- **Settings persistence**: API key / model / Jira token+URL / theme / history per tool / sprints — all in localStorage.
- **GROQ API** via etch. Temperature 0.2.
- **Theme**: light/dark via [data-theme] on <html>. Persisted as cgen_theme.
- **SVG Icons**: Icon object in Icons.tsx (12 named components). 24×24, stroke-based, currentColor.
- **Shared CSS primitives** in App.css: form fields, buttons, tables, badges, reasoning + TTS, Jira config, action bar, model badge, searchable select, sprint spreadsheet.

### Acceptance Criteria

- System prompt HARDCODED_PROMPT in constants.ts. Markers {panel}, {quote}, *Dado*, *Cuando*, *Entonces*.
- generateCriteria() → generateWithGroq() with REQUIRED_MARKERS. Returns GroqResponse. History: cgen_criteria_history.

### Test Cases

- TESTCASE_PROMPT — JSON array: key, summary, priority, type, preconditions, testSteps, expectedResult.
- generateTestCases() → extractJsonArray() + alidateTestCases(). Returns TestCaseResponse.
- Table with priority/type badges, Jira copy, PDF download.

### Bug Report Generator

- BUG_REPORT_PROMPT — 6 {panel} blocks in Jira wiki format.
- generateBugReport() injects date (DD-MM-YYYY). Platform-aware language (tap/click). History: cgen_bug_history.

### Test Data Generator

- TEST_DATA_PROMPT — 5 data types (shipping, billing, registration, cards, promo codes).
- generateTestData() → extractJsonArray(). Table with row copy, TSV copy, CSV download.

### Sprint Tracker

- 5th tool, no Groq dependency. Queries Jira via proxy only.
- Sprints stored in localStorage (cgen_sprints). Each sprint: name, dates, archived, JQL per tab, spreadsheet grid.
- **4 tabs**: Resueltos, Creados, ReOpen, Prioridad Alta. Inline JQL textarea per tab.
- **Spreadsheet grid** (20×6 default): column letters A-F, category-specific headers, resizable via drag, editable cells. Column A values matching ^[A-Z]+-\d+$ render as Jira links.
- **"Refrescar"** → jiraSearch() populates column A (ticket key) and B (date).
- "Archivar Sprint" sets archived flag. Archived sprints remain viewable (data refreshes from Jira).

### Model-aware reasoning params

| Model | 	ool='testcase' | 	ool='criteria' |
|---|---|---|
| qwen/qwen3-32b | easoning_format: "hidden" | easoning_format: "parsed" |
| openai/gpt-oss-* | none | none |
| llama-* | none | none |

### Decommissioned-model error handling

Detects model_decommissioned / model_not_found etc. in HTTP 400 body. Also 401 (invalid key) and 429 (rate limit) — Spanish messages.

### Proxy Server

- server/index.js: Express on port 3002, CORS http://localhost:5173.
- server/jiraRoutes.js:
  - GET /api/jira/issue/:issueKey — single ticket.
  - GET /api/jira/search?jql= — search with maxResults=100. Returns { issues }.
- Headers: X-Jira-Token, X-Jira-Base-Url. Errors in Spanish.

### Jira integration

jiraService.ts exports: extractIssueKey(), etchJiraTicket(), ormatTicketAsText(), jiraSearch().
Config shared via useLocalStorage(STORAGE_KEYS.JIRA_TOKEN) / JIRA_BASE_URL.

## Layout

- **App shell**: .page > .topbar + .container (max-width 1260px).
- **Landing**: hero, config strip, 5-tool list, count badge **05**.
- **Sprint Tracker**: SprintList (active + archived cards, new sprint form) → SprintDashboard (tabs + inline JQL + spreadsheet grid + resizable columns).

## Models

AVAILABLE_MODELS: openai/gpt-oss-120b, openai/gpt-oss-20b, llama-3.3-70b-versatile, llama-3.1-8b-instant, qwen/qwen3-32b. DEFAULT_MODEL: openai/gpt-oss-120b.

## Key files

| File | Purpose |
|---|---|
| server/jiraRoutes.js | GET /issue/:issueKey and GET /search?jql= |
| src/services/apiService.ts | Groq API calls (all 4 tool generations) |
| src/services/jiraService.ts | Jira proxy client (issue + search) |
| src/App.tsx | View routing, theme, Jira token/URL state |
| src/components/SprintTracker.tsx | Sprint Tracker router (list→detail) |
| src/components/SprintList.tsx | Sprint cards, new sprint form |
| src/components/SprintDashboard.tsx | Tabbed spreadsheet with inline JQL, resizable columns |
| src/components/SearchableSelect.tsx | Reusable searchable dropdown for market selects |
| src/hooks/useSprints.ts | Sprint CRUD with localStorage (exports Sprint, TabId, SprintJql) |
| src/hooks/useSprints.test.ts | 13 unit tests |

## Changing output format

- **Acceptance Criteria**: edit HARDCODED_PROMPT + REQUIRED_MARKERS
- **Test Cases**: edit TESTCASE_PROMPT, update extractJsonArray/alidateTestCases, update rendering
- **Bug Report**: edit BUG_REPORT_PROMPT, date format in generateBugReport()
- **Test Data**: edit TEST_DATA_PROMPT, add DATA_TYPES + LABEL_MAP

## Notable

- Entrypoint: src/main.tsx → App.tsx.
- jspdf + jspdf-autotable are production deps; express + cors + concurrently are devDeps.
- Sprint Tracker does NOT use Groq — only Jira proxy.
- Test files co-located in src/hooks/.
