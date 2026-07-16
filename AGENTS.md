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

Unit tests with Vitest + React Testing Library. Hooks with non-trivial logic are tested, plus service-layer validation and the global `ErrorBoundary`.

| Test file | Tests |
|---|---|
| `src/services/apiService.test.ts` | 22 — `validateTestCases`, `validateTestDataRows`, `isModelDecommissioned` (400/404 detection), `streamWithGroq` deanonymization incl. placeholders split across SSE chunks |
| `src/services/anonymizer.test.ts` | 24 — all 7 regex patterns, edge cases, round-trip identity, `applyPlaceholderEdits`, `splitPendingPlaceholder` |
| `src/hooks/useSprints.test.ts` | 20 — init, add, archive, update, delete, moveRow, persistence, hydration, recovery |
| `src/hooks/useLocalStorage.test.ts` | 14 — in-memory, cross-tab sync, ignore unrelated keys, quota resilience |
| `src/hooks/useHistory.test.ts` | 11 — add, max entries, load, clear, quota resilience |
| `src/hooks/useWorkspace.test.ts` | 12 — CRUD, artifact cap at 50, export/import, validation |
| `src/config/providers.test.ts` | 12 — provider definitions, unknown-id fallback, `sanitizeModel` per-provider validation |
| `src/components/ErrorBoundary.test.tsx` | 3 — renders children, catches crash, recovers on reset |
| `src/components/TestCaseTool.confidential.test.tsx` | 5 — confidential mode end-to-end: anonymized text sent (not raw input), edited placeholders honored, raw text when disabled, modal skipped/cancelled |
| `src/components/BugReportTool.confidential.test.tsx` | 2 — same, for the composite-message form (whole assembled message anonymized, not just one field) |
| `src/components/TestDataTool.confidential.test.tsx` | 2 — same, composite message including free-text context |
| `src/components/tools.confidential.test.tsx` | 15 — same 3 assertions, parametrized across AcceptanceCriteria/UserStory/Refiner/EdgeCase/Converter |
| `src/components/ConfidentialToggle.test.tsx` | 6 — substitution count reflects the real text, recounts on change, badge hidden when off/nothing sensitive |
| `src/components/staleTranslation.test.tsx` | 3 — a handler's toast reflects the language active at click time, not memoization time |
| `src/components/WorkspacePicker.test.tsx` | 5 — delete requires a second confirming click, cancel abandons it, only one row confirms at a time |
| `src/components/speechSynthesis.test.tsx` | 3 — AcceptanceCriteriaTool/BugReportTool mount, unmount and clear without crashing when the Speech Synthesis API is absent |
| `src/utils/download.test.ts` | 7 — `downloadJson` (Blob download, object-URL revoked, no anchor left behind), `toFilename` (slugify, path-separator stripping, fallback) |
| `src/test/pwaIcons.test.ts` | 2 — reads the PNG IHDR of both PWA icons and asserts they are really 192×192 / 512×512, not placeholders |

**Total: 168 tests across 18 files.**

Run `npm test` before committing when modifying hooks or services.

## Architecture

- **React 18 SPA**, Vite 5, TypeScript. 100% static deploy. All core logic in-browser.
- **Hash-based routing** (`#/landing`, `#/acceptance`, `#/testcase`, etc.) via `getViewFromHash()` + `hashchange` listener. `navigate(view, { prefill? })` callback. Browser back/forward and F5 work.
- **ViewType**: `'landing' | 'acceptance' | 'testcase' | 'bugreport' | 'testdata' | 'sprinttracker' | 'userstory' | 'refiner' | 'edgecase' | 'converter'`
- **App shell**: `<I18nProvider>` > `<div className="page">` > `<Header>` + `<div className="app-layout">` > `<Sidebar>` + `<main className="container">`. Sidebar hidden on landing.
- **Sidebar**: collapsible icon-nav grouped by category (Generar/Refinar/Convertir/Seguimiento) + active workspace name + prompt editor link. Active highlight via hash.
- **View router** wrapped in `<ErrorBoundary key={view}>`: class component with `getDerivedStateFromError`/`componentDidCatch`, renders recoverable fallback. Keyed by `view` so switching tools remounts it.
- **Settings persistence**: API keys stored per provider (`acgen_key_groq`, `acgen_key_openrouter`, `acgen_key_custom`). Model stored as `acgen_model`. Provider stored as `acgen_provider`. Theme as `acgen_theme`. Language as `acgen_lang`. Workspaces as `acgen_workspaces`. Project profile as `acgen_project_profile`. History, sprints, and sprint configs in their own keys.
- **`useLocalStorage` cross-instance/cross-tab sync**: dispatches custom `acgen-local-storage` window event + listens for native `storage` event. All writes wrapped in try/catch for `QuotaExceededError`.
- **LLM API**: provider-agnostic via `baseUrl` parameter. Supports Groq (default), OpenRouter, and Custom (any OpenAI-compatible endpoint). Called via `fetch` with SSE streaming. Temperature fixed at `0.2`.
- **Streaming**: `streamWithGroq()` async generator yields tokens progressively. `useStreamingResponse()` hook manages state. Supports optional `anonymizeMap` for confidential mode and `baseUrl` for multi-provider.
- **Design tokens**: `:root` invariants + `[data-theme="light"]` / `[data-theme="dark"]` in `App.css`. Key tokens: `--accent` (purple), `--bg`, `--surface`, `--border`, `--text`, `--text-2`, `--text-3`, `--radius` (16px), `--radius-sm` (11px), `--shadow-sm/md/lg`. Fonts: Manrope, Newsreader italic, JetBrains Mono.
- **Theme**: light/dark via `[data-theme]` on `<html>`. Applied synchronously from localStorage before paint. Toggle in Header.
- **i18n**: `I18nContext` + `useT()` hook. `es.json` and `en.json` (203 keys, exact parity). Language toggle in Header (ES|EN). Detects browser language on first visit. Missing keys fall back to Spanish. Parameter interpolation supported.
- **SVG Icons**: `src/components/Icons.tsx` exports `Icon` object with named components. All 24x24, stroke-based, `currentColor`, `strokeWidth` 1.6.
- **Shared CSS**: form fields, buttons, tables, badges, modal overlay, action bar, model badge, searchable select, sprint spreadsheet, error boundary fallback, toast, export bar in `App.css`.
- **PWA**: `vite-plugin-pwa` with `autoUpdate` register type, manifest, icons (192+512), workbox static precache of JS/CSS/HTML/fonts.

## Tools (9 total)

### Generar (Generate)

| Tool | View | Key files | LLM? |
|---|---|---|---|
| Criterios de Aceptacion | `acceptance` | `AcceptanceCriteriaTool.tsx` | Yes — `criteria` |
| Casos de Prueba | `testcase` | `TestCaseTool.tsx` | Yes — `testcase` |
| Bug Report | `bugreport` | `BugReportTool.tsx` | Yes — `criteria` |
| Datos de Prueba | `testdata` | `TestDataTool.tsx` | Yes — `testcase` |
| Historias de Usuario | `userstory` | `UserStoryTool.tsx` | Yes — `criteria` |

### Refinar (Refine)

| Tool | View | Key files | LLM? |
|---|---|---|---|
| Refinador de Requisitos | `refiner` | `RefinerTool.tsx` | Yes — `criteria` |
| Casos Limite | `edgecase` | `EdgeCaseTool.tsx` | Yes — `testcase` |

### Convertir (Convert)

| Tool | View | Key files | LLM? |
|---|---|---|---|
| Conversor de Formatos | `converter` | `ConverterTool.tsx` | Yes — `criteria` |

### Seguimiento (Track)

| Tool | View | Key files | LLM? |
|---|---|---|---|
| Sprint Tracker | `sprinttracker` | `SprintTracker.tsx`, `SprintList.tsx`, `SprintDashboard.tsx` | No (offline) |

## Cross-cutting features

### Confidential mode (Modo confidencial)

- `src/services/anonymizer.ts`:
  - `anonymize(text)` / `deanonymize(text, map)` — 7 regex patterns in order: EMAIL, URL, IP, TICKET, PHONE, DOMAIN, NAME
  - `applyPlaceholderEdits(text, map, edits)` — rewrites text and restore map together when the user renames a placeholder in the review modal
  - `splitPendingPlaceholder(text)` — splits streamed text into an emit-safe part and a tail that may still grow into a placeholder (used by `streamWithGroq` so a placeholder split across two SSE chunks still resolves)
- `<ConfidentialToggle view text onReview>` — per-tool checkbox, persisted as `acgen_confidential_{view}` in localStorage. Takes the exact text the tool would send and counts substitutions itself (memoized, only while enabled); the badge and "N sustituciones — Revisar" link render only once that count is above zero.
- `<AnonymizerReview map onConfirm onCancel>` — modal showing substitution table (Original | placeholder) before the API call. Editable per row; `onConfirm` receives only the renamed placeholders (`edits`), not the full map — callers run them through `applyPlaceholderEdits` before sending.
- `streamWithGroq()` accepts `anonymizeMap` parameter — deanonymizes streamed text (buffered via `splitPendingPlaceholder`, not per raw token) in real time
- Opt-in (off by default). Review modal shown before every API call when enabled and something matched
- Each of the 8 LLM tools keeps a single `conf: { text, map } | null` state: `text` is the *anonymized* string that actually gets sent to `doGenerate`, never the raw input

### Workspaces

- `src/types/workspace.ts` — `Workspace { id, name, createdAt, artifacts[] }`, `Artifact { id, tool, input, output, timestamp }`
- `useWorkspace()` hook — CRUD, `exportWorkspace(id)` returns the JSON string (does not download it), `importWorkspace(json)` validates and throws on malformed input
- `src/utils/download.ts` — `downloadJson(filename, content)` (Blob → anchor click → revoke) and `toFilename(name, ext)` (slugifies; strips path separators so a workspace named `../../etc/passwd` can't escape the downloads folder). `App.tsx`'s `exportWorkspaceToFile` wires the two together — `useWorkspace().exportWorkspace` alone does not trigger a download.
- `<WorkspacePicker>` in Header — dropdown with create/rename/select/export/import, fully i18n'd. Delete is a 2-step inline confirm (`¿Eliminar "<name>"?` / confirm / cancel) naming the workspace, not a single click and not `window.confirm`.
- Auto-save: each successful generation saves artifact to active workspace via `onSaveArtifact`. Auto-creates default "Sin nombre" workspace on first use. **Known gap:** if `activeId` points at a workspace that no longer exists (corrupted/cleared storage), `addArtifact` no-ops silently and the artifact is lost — see "Known issues" below.
- Sidebar shows active workspace name

### Project profile

- `src/types/context.ts` — `ProjectProfile { domain, productType, markets, terminology, tone }`
- `DEFAULT_PROFILE` with ecommerce defaults
- `useProfile()` hook — persisted in localStorage
- `interpolateProfile(prompt, profile)` — replaces `{dominio}`, `{tipoProducto}`, `{mercados}`, `{terminologia}`, `{tono}` placeholders
- All prompts in `constants.ts` use these placeholders

### Customizable prompts

- `getPrompt(tool)` — reads override from `acgen_prompt_{tool}` in localStorage (raw string, not JSON-encoded), falls back to `DEFAULT_PROMPTS[tool]`
- `<PromptEditor>` — modal with per-tool selection, textarea, save/reset. Accessible from the Sidebar's spark-icon footer button
- All 8 LLM tools call `getPrompt()` inside their generate callback (fresh read every call, not cached at mount) instead of importing prompt constants directly

### Demo mode

- `src/config/demoData.ts` — `DEMO_DATA` object with pre-generated input/output for each tool
- "Ver ejemplo" button fills input + shows output without requiring API key

### Artifact chaining

- `<ChainMenu>` — dropdown on each tool's output showing valid destination tools
- `CHAIN_RULES` maps source view to available destinations
- `navigate()` supports `{ prefill: text }` to pre-fill destination tool input
- Tools: AcceptanceCriteria, UserStory, Refiner accept `prefill` prop

### Multi-provider LLM

- `src/config/providers.ts` — `PROVIDERS` registry with Groq (5 models), OpenRouter (8 models), Custom (free-text). `sanitizeModel(providerId, model)` validates a stored model against its provider's list (open-list providers like Custom accept anything); falls back to the provider's `defaultModel` otherwise. `App.tsx` derives `model` through it on every render (`useMemo(() => sanitizeModel(provider, storedModel), [provider, storedModel])`) so switching provider — or reloading with a non-Groq model already stored — never sends a model foreign to the active provider.
- `<ProviderConfig>` — unified provider + model + API key selector. Provider dropdown dynamically changes model list. Custom provider shows base URL input.
- Per-provider API keys: `acgen_key_groq`, `acgen_key_openrouter`, `acgen_key_custom`
- Auto-migration: old `acgen_api_key` → `acgen_key_groq` on first load
- `streamWithGroq()` accepts `baseUrl` parameter

### UX

- **Ctrl+Enter** shortcut on all LLM tools triggers generate
- `<Toast>` with `useToast()` — 4s auto-dismiss, undo support for clear actions. Replaces `window.confirm`
- `<GenerateButton>` — loading-aware button with spinning state

## Per-tool details

### Acceptance Criteria

- System prompt (`HARDCODED_PROMPT`) — Confluence wiki format with `{panel}`, `{quote}`, `*Dado*`, `*Cuando*`, `*Entonces*`
- `REQUIRED_MARKERS` validate response format. Missing markers → error listing missing elements.
- Streaming output in editable textarea. ChainMenu for sending to Refiner, TestCase, BugReport.

### Test Cases

- System prompt (`TESTCASE_PROMPT`) — JSON array with `key`, `summary`, `priority`, `type`, `preconditions`, `testSteps`, `expectedResult`
- `extractJsonArray()` handles fence-marked JSON and bare arrays. `validateTestCases()` checks presence AND type of every field.
- HTML table with priority badges (`.badge-high/medium/low`) and type badges (`.badge-positive/negative`).
- Actions: "Copiar como tabla Jira" (Confluence wiki table), "Descargar PDF" (jsPDF).

### Bug Report

- System prompt (`BUG_REPORT_PROMPT`) — 6 `{panel}` blocks in Jira wiki format
- Four platform types (Web Desktop/Mobile, App Android/iOS). Dynamic form fields per platform.
- Additional context textarea for ticket descriptions/notes.

### Test Data

- System prompt (`TEST_DATA_PROMPT`) — 5 data types: shipping address, billing, user registration, payment cards, promo codes
- `validateTestDataRows()` rejects nested objects/arrays from LLM
- CSV export with BOM for Excel + formula injection guard. TSV export with tab/newline sanitization.

### Sprint Tracker

- Fully offline — no LLM dependencies
- 5 tabs: Resueltos, Creados, ReOpen, Prioridad Alta, JSD
- Editable spreadsheet grid (20x6), resizable columns, drag-and-drop rows
- Search bar (debounced 250ms), SnapLink support, Ctrl+click ticket links, keyboard navigation

### User Stories

- System prompt (`USER_STORY_PROMPT`) — Como/Quiero/Para format + INVEST checklist evaluation
- Optionally chains output to Refiner or Acceptance Criteria

### Requirement Refiner

- System prompt (`REFINER_PROMPT`) — detects ambiguities, contradictions, missing info, dependencies, suggests refinement questions
- Accepts `prefill` from chaining

### Edge Cases

- System prompt (`EDGE_CASE_PROMPT`) — JSON array grouped by category (boundary, empty states, concurrency, i18n, permissions, network)
- Reuses `extractJsonArray()` + table rendering pattern from TestCaseTool

### Format Converter

- System prompt (`CONVERTER_PROMPT`) — converts between Gherkin, Markdown, Jira wiki, Azure DevOps, plain text
- Side-by-side layout: source format select + input | output + target format select

## Models & Providers

**Groq** (default):
```
"openai/gpt-oss-120b"        <- DEFAULT_MODEL
"openai/gpt-oss-20b"
"llama-3.3-70b-versatile"
"llama-3.1-8b-instant"
"qwen/qwen3-32b"
```

**OpenRouter**: `openai/gpt-4o` (default), `anthropic/claude-sonnet-4`, `google/gemini-2.5-flash`, `meta-llama/llama-4-maverick`, `deepseek/deepseek-chat-v3`, `qwen/qwen3-235b`, `mistralai/mistral-large`, `cohere/command-r-plus`

**Custom**: free-text model + base URL (OpenAI-compatible)

### Model-aware reasoning params

| Model | `tool='testcase'` | `tool='criteria'` |
|---|---|---|
| `qwen/qwen3-32b` | `reasoning_format: "hidden"` | `reasoning_format: "parsed"` |
| `openai/gpt-oss-*` | none | none |
| `llama-*` | none | none |

### Decommissioned-model error handling

`isModelDecommissioned(message, status)` checks HTTP 400/404 for `model_decommissioned`, `model_not_found`, `invalid model`. Also handles 401 (invalid API key) and 429 (rate limit).

## Key files

| File | Purpose |
|---|---|
| `src/config/constants.ts` | API_URL, all 8 prompts, `DEFAULT_PROMPTS` map, AVAILABLE_MODELS, DEFAULT_MODEL, STORAGE_KEYS, ViewType, SUPPORTED_MARKETS, PLATFORMS, DATA_TYPES |
| `src/config/providers.ts` | `PROVIDERS` registry, `ProviderDef` interface, `getProvider()` |
| `src/config/demoData.ts` | `DEMO_DATA` pre-generated samples per tool |
| `src/services/apiService.ts` | `streamWithGroq()` (streaming — the only generation path all tools use), `getPrompt()`, `interpolateProfile()`, `extractJsonArray()`, `isModelDecommissioned()`, `validateTestCases()`, `validateTestDataRows()` |
| `src/services/anonymizer.ts` | `anonymize()`, `deanonymize()`, `applyPlaceholderEdits()`, `splitPendingPlaceholder()` — 7 regex patterns |
| `src/utils/download.ts` | `downloadJson()`, `toFilename()` — client-side file download used by workspace export |
| `src/App.tsx` | Hash routing, provider state, workspace state, theme state, prefill/chaining state, I18nProvider wrapper, sidebar layout |
| `src/i18n/I18nContext.tsx` | `I18nProvider`, `useT()` hook, `useLang()` hook, language detection |
| `src/i18n/es.json` | 203 Spanish UI strings |
| `src/i18n/en.json` | 203 English UI strings — key set kept in exact parity with `es.json` |
| `src/components/Header.tsx` | Brand, WorkspacePicker, ProviderConfig, Model badge, theme toggle, language toggle |
| `src/components/Sidebar.tsx` | Collapsible tool nav grouped by category, workspace name, prompt editor link |
| `src/components/LandingScreen.tsx` | Hero, config strip (ProviderConfig), 9-tool grid |
| `src/components/ErrorBoundary.tsx` | Class component with recoverable fallback |
| `src/components/Icons.tsx` | SVG icon components |
| `src/hooks/useLocalStorage.ts` | Generic localStorage hook with cross-instance/-tab sync |
| `src/hooks/useStreamingResponse.ts` | `useStreamingResponse()` hook — `{ text, isStreaming, stream, reset }` |
| `src/hooks/useWorkspace.ts` | Workspace CRUD, export/import, artifact management |
| `src/hooks/useSprints.ts` | Sprint CRUD, moveRow, archive, delete |
| `src/hooks/useHistory.ts` | Last-N history ring |
| `src/components/Toast.tsx` | `useToast()` hook + `<Toast>` component with undo |
| `src/components/GenerateButton.tsx` | Loading-aware generate button (uses useT() for labels) |
| `src/components/ChainMenu.tsx` | "Send to..." dropdown for artifact chaining |
| `src/components/ContextProfile.tsx` | `useProfile()` hook, profile editor |
| `src/components/ConfidentialToggle.tsx` | Per-tool confidential mode toggle |
| `src/components/AnonymizerReview.tsx` | Substitution review modal |
| `src/components/PromptEditor.tsx` | Per-tool prompt override editor |
| `src/components/ProviderConfig.tsx` | Provider + model + API key selector |
| `src/components/WorkspacePicker.tsx` | Workspace dropdown with CRUD (delete requires confirm) + export/import |
| `src/components/ExportBar.tsx` | Format export buttons (copy, markdown, Jira, CSV, TSV) |
| `src/types/context.ts` | `ProjectProfile` interface, `DEFAULT_PROFILE` |
| `src/types/workspace.ts` | `Workspace`, `Artifact` interfaces |

## Changing output format

| Tool | Edit file | Additional steps |
|---|---|---|
| Acceptance Criteria | `HARDCODED_PROMPT` in `constants.ts` | Update `REQUIRED_MARKERS` if markers change. Or override via PromptEditor. |
| Test Cases | `TESTCASE_PROMPT` in `constants.ts` | Update `extractJsonArray` / `validateTestCases` in `apiService.ts` if schema changes. |
| Bug Report | `BUG_REPORT_PROMPT` in `constants.ts` | Date injected in `buildBugReportMessage()` (`BugReportTool.tsx`) via `padStart`. |
| Test Data | `TEST_DATA_PROMPT` in `constants.ts` | Add entries to `DATA_TYPES` and update schema. |
| User Story | `USER_STORY_PROMPT` in `constants.ts` | Update INVEST checklist format in rendering. |
| Refiner | `REFINER_PROMPT` in `constants.ts` | Update category parsing in component. |
| Edge Case | `EDGE_CASE_PROMPT` in `constants.ts` | JSON schema matches TestCaseTool validation. |
| Converter | `CONVERTER_PROMPT` in `constants.ts` | Update FORMATS list in component if adding formats. |

## Notable

- Entrypoint: `src/main.tsx` → `App.tsx`
- `jspdf` + `jspdf-autotable` are production dependencies (PDF generation for Test Cases)
- No Jira integration (removed in v2). 100% static — no `api/` directory, no `vercel.json`
- Sprint Tracker operates fully offline — no LLM API calls
- Test files co-located with source (`src/hooks/`, `src/services/`, `src/config/`, `src/components/`)
- `tsconfig.app.json` excludes `*.test.ts` and `*.test.tsx` from production typecheck/build
- All prompts are in Spanish. UI strings are i18n ES/EN. Prompts interpolate project profile via `{dominio}`, `{tipoProducto}`, `{mercados}`, `{terminologia}`, `{tono}`

## Known issues (as of 2026-07-16 audit)

A 6-agent parallel audit of Fase 3 against its design/plan/ledger found the ledger's "review clean" claims did not hold — the reviews checked each task in isolation, not the data flow end to end. Two PRs fixed 9 of the findings (`fix/fase3-audit-bugs` → `fix/fase3-audit-cleanup`, stacked; see their descriptions on GitHub for full detail per fix). What's left, in priority order:

1. **Mid-stream errors are silently swallowed — no user-facing error at all.** `useStreamingResponse.stream()` (`src/hooks/useStreamingResponse.ts`) catches a mid-generation exception, stores a message in its *own* internal `state.error`, and does **not** rethrow. No tool destructures `error` from the hook (confirmed by grep — all read only `{ text, isStreaming, stream }` or similar), so that message is computed and discarded. Worse: each tool's own `try/catch` around `await stream(...)` — which sets the tool's local `error` state that `<ErrorBanner>` actually renders — never fires either, because `stream()` doesn't throw. Net effect: an API error partway through a response (rate limit, connection drop, malformed chunk) stops the stream with zero feedback — no banner, no toast, just a truncated result. Fix shape: either have `stream()` rethrow after setting its state, or have each tool consume the hook's `error` directly instead of maintaining a redundant local one.
2. **i18n leftovers** — hardcoded Spanish outside the audited components: `ExportBar.tsx` (Copiar/Descargar PDF/CSV/TSV), ~12 error-message strings in `apiService.ts` (feeds `<ErrorBanner>` via `err.message` — English users see Spanish errors; 7 `error.*` keys in `es.json`/`en.json` exist for exactly this and sit unused), `ErrorBoundary.tsx` fallback text, `HistoryModal.tsx`, `SearchableSelect.tsx` placeholders. `apiService.ts` is the one non-trivial case: it's a plain module with no React context, so wiring `t()` into it needs a real decision (pass `t` as a parameter? read `lang` from localStorage directly? keep errors as i18n keys and translate at the render boundary?) — don't do it as a mechanical find-replace.
3. **`saveArtifact` loses the artifact silently on a stale `activeId`.** `App.tsx`'s `saveArtifact` only guards `if (!targetId)`; if `acgen_active_workspace` holds an id absent from `acgen_workspaces` (storage corruption, manual clear, a quota-exceeded write that desynced the two keys), `useWorkspace.addArtifact` no-ops with no error and no toast. Low-probability, silent-data-loss failure mode. Fix: check `workspaces.some(w => w.id === targetId)` and fall through to auto-create if not.
4. **Custom provider base URL isn't validated.** `App.tsx`: `currentBaseUrl = provider === 'custom' ? (customBaseUrl || undefined) : ...`. An empty custom URL becomes `undefined`, and `apiService.ts` falls back `baseUrl || API_URL` — so an empty Custom URL silently sends the custom API key to **Groq's** endpoint, producing a misleading 401 instead of a "set your base URL" message.
5. **PHONE regex is over-broad.** `src/services/anonymizer.ts`: `/\+?[\d\s()-]{7,}/g` has no digit-count floor, so it also matches indented Markdown/Gherkin list runs (`"\n    - "`) and any bare number ≥7 digits, producing false `[PHONE_N]` rows in the confidential-mode review table. Round-trip still restores correctly; it's a UX/trust issue, not a correctness bug.

## Evolution history

| Phase | Date | Scope |
|---|---|---|
| Bug fixes (pre-v2) | 2026-07-10 | Crash fixes, data loss prevention, Sprint UX, security, exports |
| Fase 1 (v2) | 2026-07-16 | Remove Jira, hash routing, demo mode, project profile, Ctrl+Enter, Toast |
| Fase 2 (v2) | 2026-07-16 | Streaming, 4 new tools (UserStory/Refiner/EdgeCase/Converter), artifact chaining, sidebar, ResultPanel† + ExportBar |
| Fase 3 (v2) | 2026-07-16 | Confidential mode, workspaces, i18n ES/EN, customizable prompts, PWA, multi-provider LLM |
| Fase 3 audit + fixes | 2026-07-16 | 6-agent parallel audit vs. spec/plan/ledger. Fixed: confidential mode never anonymized the outgoing request (critical), non-Groq model wiped on reload, workspace export didn't download, PWA icons were 1×1 placeholders, substitution-count badge always hidden, 8 stale-language toast handlers, workspace delete had no confirm, TTS crashed without the Speech Synthesis API, 5 lint errors, dead code (`ApiKeyConfig`, `ModelSelector`, `ResultPanel`†, the pre-streaming `generateWithGroq`/`generateCriteria`/`generateTestCases`/`generateBugReport`/`generateTestData`, unused `GroqResponse`/`TestCaseResponse` types, unused `STORAGE_KEYS.API_KEY`). 96 → 168 tests. See "Known issues" above for what's still open. |

† `ResultPanel.tsx` (added Fase 2) was removed in the audit cleanup — every tool had already grown its own output rendering and nothing imported it.
