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
| `src/services/apiService.test.ts` | 35 — `validateTestCases`, `validateTestDataRows`, `isModelDecommissioned` (400/404 detection), `streamWithGroq` deanonymization incl. placeholders split across SSE chunks, `streamWithGroq` HTTP-error `I18nError` shape (message = i18n key, params, cause = upstream text), base URL validation (missing/invalid thrown before fetch; undefined keeps the default endpoint) |
| `src/services/anonymizer.test.ts` | 29 — all 7 regex patterns, edge cases, round-trip identity, `applyPlaceholderEdits`, `splitPendingPlaceholder`, PHONE digit floor (list runs / short numbers not flagged, no whitespace swallowed, bare long numbers still masked) |
| `src/hooks/useSprints.test.ts` | 22 — init, add, archive, update, delete, moveRow, persistence, hydration, recovery; persistence purity (no localStorage write on mount, exactly one write per update under StrictMode) |
| `src/hooks/useLocalStorage.test.ts` | 14 — in-memory, cross-tab sync, ignore unrelated keys, quota resilience |
| `src/hooks/useHistory.test.ts` | 11 — add, max entries, load, clear, quota resilience |
| `src/hooks/useWorkspace.test.ts` | 15 — CRUD, artifact cap at 50, export/import, validation, `saveArtifact` fallback (valid/null/stale `activeId`) |
| `src/hooks/useStreamingResponse.test.ts` | 4 — token accumulation + `onComplete`, mid-stream error rethrown to the caller, partial text kept, `onComplete` not called on failure |
| `src/config/providers.test.ts` | 17 — provider definitions, unknown-id fallback, `sanitizeModel` per-provider validation, `baseUrlStatus` (missing/invalid/valid) |
| `src/components/ProviderConfig.test.tsx` | 5 — base URL inline hint (missing/invalid/valid + `aria-invalid`), no field for fixed-URL providers, translated labels |
| `src/components/ErrorBoundary.test.tsx` | 4 — renders children, catches crash, recovers on reset, renders the fallback/retry text in English via `contextType` when `lang` is `en` |
| `src/components/TestCaseTool.confidential.test.tsx` | 5 — confidential mode end-to-end: anonymized text sent (not raw input), edited placeholders honored, raw text when disabled, modal skipped/cancelled |
| `src/components/BugReportTool.confidential.test.tsx` | 2 — same, for the composite-message form (whole assembled message anonymized, not just one field) |
| `src/components/TestDataTool.confidential.test.tsx` | 2 — same, composite message including free-text context |
| `src/components/tools.confidential.test.tsx` | 15 — same 3 assertions, parametrized across AcceptanceCriteria/UserStory/Refiner/EdgeCase/Converter |
| `src/components/ConfidentialToggle.test.tsx` | 6 — substitution count reflects the real text, recounts on change, badge hidden when off/nothing sensitive |
| `src/components/staleTranslation.test.tsx` | 3 — a handler's toast reflects the language active at click time, not memoization time |
| `src/components/WorkspacePicker.test.tsx` | 7 — delete requires a second confirming click, cancel abandons it, only one row confirms at a time; create-row layout (the Crear button neutralizes the global `.btn-primary` `min-width`, the name input keeps the row space at 32px) |
| `src/components/speechSynthesis.test.tsx` | 3 — AcceptanceCriteriaTool/BugReportTool mount, unmount and clear without crashing when the Speech Synthesis API is absent |
| `src/components/errorTranslation.test.tsx` | 1 — an API 401 renders the English `error.apiKey` text end-to-end (not the Spanish i18n key or raw upstream message) |
| `src/components/HistoryModal.test.tsx` | 3 — clear-all requires a second confirming click, renders in English, translated empty state |
| `src/components/SearchableSelect.test.tsx` | 3 — search input placeholder defaults to translated `common.search`, translated empty state, trigger placeholder defaults to translated `common.select` |
| `src/utils/download.test.ts` | 7 — `downloadJson` (Blob download, object-URL revoked, no anchor left behind), `toFilename` (slugify, path-separator stripping, fallback) |
| `src/test/pwaIcons.test.ts` | 2 — reads the PNG IHDR of both PWA icons and asserts they are really 192×192 / 512×512, not placeholders |
| `src/i18n/keyParity.test.ts` | 2 — `es.json`/`en.json` have exactly the same key set, and every `{param}` placeholder in one exists in the other |
| `src/components/TrackerGrid.test.tsx` | 40 — shared spreadsheet: tabs/headers render and switch, jira mode (ctrl+click opens baseUrl/browse/KEY, SnapLink paste → "KEY Nombre", no name overlay, no base URL ⇒ no link + configure hint), url mode (ctrl+click opens the exact pasted URL, bare URL, plain text is not a link, name-only overlay at rest with accent styling, focus reveals the full value for editing, bare URL gets no overlay), readOnly (inputs readonly, no "+ Fila", no drag), "+ Fila" appends, dragDisabled removes handles; drag-drop (handles draggable, drop calls `onMoveRow` with source/target, self-drop is a no-op); column resize (persists to localStorage in editable mode, readOnly resize stays in memory and never touches the shared widths key); legacy `acgen_jira_base_url` migration (adopts orphaned URL once, doesn't overwrite an existing new-key value, skipped in url mode, a schemeless legacy value never yields a link); ⚙ base URL config (hidden in url mode, Enter/blur save with trailing-slash and missing-scheme normalization to `https://`, activates links immediately, Escape-then-reopen still saves on the next blur, the real mousedown→blur→click sequence closes without re-saving, blank draft is a no-op); hover ↗ icon (aria-label per mode, plain click opens the exact link, absent with no base URL or empty cell, ctrl+click on the icon opens exactly one tab, td title now teaches the ctrl+click gesture) |
| `src/hooks/useRegressions.test.ts` | 17 — init 2×(20×6), updateGridCell, persistence+hydration, setTabGrid, moveRow (incl. out-of-range), archiveBoard (snapshot+clear+name "Regresión YYYY-MM-DD", persisted; no-op on empty or whitespace-only board; orphaned-platform-key content does not count), deleteArchived, corrupt JSON, missing-platform merge, quota resilience; persistence purity (no write on mount, exactly one write per update under StrictMode) |
| `src/components/RegressionTracker.test.tsx` | 8 — 2 platform tabs (APPS/WEB) + headers, "Nombre - URL" cell is an accent link that ctrl+click opens, per-platform grids, archive flow (confirm → cleared board → "Archivadas (1)" → snapshot listed), archive button disabled while the board is empty, snapshot read-only, archived date formatted per app language without UTC shift, delete archived → empty state |
| `src/components/LandingScreen.test.tsx` | 4 — exactly the 10 tool cards rendered with no placeholder slot, centered `.landing` wrapper present, `onSelect` fires |
| `src/config/promptTemplates.test.ts` | 5 — no prompt or demo output hardcodes a validator name; bug report pins `Entorno/Pais: Pro/ES` and leaves Versión/Evidencia empty |
| `src/services/backup.test.ts` | 36 — `isSensitiveKey`, `collectBackupData` (verbatim values, foreign-key exclusion, API-key exclusion/opt-in, `acgen_last_backup` always excluded), `createBackup` (schema/exportedAt/pretty-print), `parseImportFile` (backup/legacyWorkspace/futureVersion/invalid classification, tampered `data`), `restoreBackup` (total replace, local-API-key preservation vs. overwrite, tampered-key rejection, foreign-key untouched, quota rollback), `hasSignificantData` per source + corrupt-JSON tolerance, `getLastBackupAt`/`markBackupDone`, `isBackupDue` threshold |
| `src/hooks/useBackupReminder.test.ts` | 2 — `due` reflects `isBackupDue`, `markDone` writes `acgen_last_backup` and flips `due` off |
| `src/components/BackupMenu.test.tsx` | 17 — export (checkbox toggles included keys + warning, filename, marks done), import (backup → 2-step confirm → restore → `onRestored`; legacyWorkspace → `onImportLegacyWorkspace` + alert, and its throw path → `backup.importError` alert; futureVersion/invalid → alert), quota-failure restore path, auto-backup section hidden/shown per FSA support and per `useAutoBackup` status |
| `src/components/Header.test.tsx` | 2 — mounts `BackupMenu` wired to `onImportLegacyWorkspace`, renders next to `WorkspacePicker` |
| `src/services/autoBackup.test.ts` | 18 — `isFileSystemAccessSupported`, `saveHandle`/`loadHandle`/`clearHandle` round-trip via IndexedDB (incl. IDB-failure → null), `chooseBackupFile` (handle, `AbortError` → null, other errors propagate), `ensurePermission` (granted/denied/prompt via `requestPermission`, missing `queryPermission`/`requestPermission` fallbacks), `writeSnapshot` (success, permission denied, permission-check rejection, write I/O failure — never throws) |
| `src/hooks/useAutoBackup.test.ts` | 12 — state machine transitions (unsupported/off/active/permissionNeeded/error), mount resolves a persisted handle without prompting, `enable`/`disable`/`reconnect`, debounced snapshot on `acgen-local-storage`/`storage` events, `acgen_last_backup` events ignored (no snapshot→`markDone`→snapshot feedback loop), stale in-flight write after `disable()` ignored, snapshots exclude API keys and call `onSnapshot` |
| `src/services/persistence.test.ts` | 3 — `requestPersistentStorage` resolves `true`/`false` per `navigator.storage.persist()`, resolves `false` (not throw) when `persist()` rejects, resolves `false` when the API is absent |
| `src/components/Sidebar.test.tsx` | 4 — the `WS:` workspace label shows when expanded, disappears when collapsed, carries the full name as a `title` tooltip for truncated long names, and is absent with no active workspace |
| `src/utils/dates.test.ts` | 7 — `formatDate` keeps the calendar day in negative-offset timezones (deterministic via `process.env.TZ`), dd/mm/yyyy for es vs mm/dd/yyyy for en, em dash for null/malformed; `localTodayISO` returns the LOCAL day when UTC is already tomorrow, zero-pads |
| `src/components/SprintList.test.tsx` | 16 — start date rendered without UTC shift, dates formatted per app language, new-sprint form defaults to the LOCAL day (not the UTC day); rename: Editar button only on active sprints, opens a pre-filled input, saves on Enter/blur, cancels on Escape, rejects an empty name, doesn't navigate into the sprint; archive: Archivar button only on active sprints, confirm-accept calls `onArchiveSprint`, confirm-cancel doesn't, doesn't navigate into the sprint, archived cards show 🔴 + singular "Archivado" badge, active cards keep 🟢 |
| `src/App.test.tsx` | 1 — navigating between views scrolls to top |
| `src/components/UpdateBanner.test.tsx` | 3 — renders nothing when not visible, shows the update message + Actualizar button when visible, clicking Actualizar calls `onReload` |
| `src/hooks/useAppUpdate.test.ts` | 5 — starts with `needRefresh` false and a callable `reload`, calling `reload` before any update is available doesn't throw; `reload` reloads immediately when the SW API is absent, reloads exactly once on `controllerchange` (fallback timer doesn't double-fire), falls back to reloading after 2s when `controllerchange` never fires |

**Total: 421 tests across 43 files.**

Run `npm test` before committing when modifying hooks or services.

## Architecture

- **React 18 SPA**, Vite 5, TypeScript. 100% static deploy. All core logic in-browser.
- **Hash-based routing** (`#/landing`, `#/acceptance`, `#/testcase`, etc.) via `getViewFromHash()` + `hashchange` listener. `navigate(view, { prefill? })` callback. Browser back/forward and F5 work.
- **ViewType**: `'landing' | 'acceptance' | 'testcase' | 'bugreport' | 'testdata' | 'sprinttracker' | 'regressiontracker' | 'userstory' | 'refiner' | 'edgecase' | 'converter'`
- **App shell**: `<I18nProvider>` > `<div className="page">` > `<Header>` + `<div className="app-layout">` > `<Sidebar>` + `<main className="container">`. Sidebar hidden on landing.
- **Sidebar**: collapsible icon-nav grouped by category (Generar/Refinar/Convertir/Seguimiento) + active workspace name + prompt editor link. Active highlight via hash.
- **View router** wrapped in `<ErrorBoundary key={view}>`: class component with `getDerivedStateFromError`/`componentDidCatch`, renders recoverable fallback. Keyed by `view` so switching tools remounts it.
- **Settings persistence**: API keys stored per provider (`acgen_key_groq`, `acgen_key_openrouter`, `acgen_key_custom`). Model stored as `acgen_model`. Provider stored as `acgen_provider`. Theme as `acgen_theme`. Language as `acgen_lang`. Workspaces as `acgen_workspaces`. Project profile as `acgen_project_profile`. History, sprints, and sprint configs in their own keys. Regression tracker board+archived as `acgen_regressions`, column widths as `acgen_regression_col_widths`. Last backup timestamp as `acgen_last_backup` (`STORAGE_KEYS.LAST_BACKUP`).
- **`useLocalStorage` cross-instance/cross-tab sync**: dispatches custom `acgen-local-storage` window event + listens for native `storage` event. All writes wrapped in try/catch for `QuotaExceededError`.
- **LLM API**: provider-agnostic via `baseUrl` parameter. Supports Groq (default), OpenRouter, and Custom (any OpenAI-compatible endpoint). Called via `fetch` with SSE streaming. Temperature fixed at `0.2`.
- **Streaming**: `streamWithGroq()` async generator yields tokens progressively. `useStreamingResponse()` hook manages state. Supports optional `anonymizeMap` for confidential mode and `baseUrl` for multi-provider.
- **Design tokens**: `:root` invariants + `[data-theme="light"]` / `[data-theme="dark"]` in `App.css`. Key tokens: `--accent` (purple), `--bg`, `--surface`, `--border`, `--text`, `--text-2`, `--text-3`, `--radius` (16px), `--radius-sm` (11px), `--shadow-sm/md/lg`. Fonts: Manrope, Newsreader italic, JetBrains Mono.
- **Theme**: light/dark via `[data-theme]` on `<html>`. Applied synchronously from localStorage before paint. Toggle in Header.
- **i18n**: `I18nContext` + `useT()` hook. `es.json` and `en.json` (225 keys, exact parity, guarded by `src/i18n/keyParity.test.ts`). Language toggle in Header (ES|EN). Detects browser language on first visit. Missing keys fall back to Spanish. Parameter interpolation supported.
- **SVG Icons**: `src/components/Icons.tsx` exports `Icon` object with named components. All 24x24, stroke-based, `currentColor`, `strokeWidth` 1.6.
- **Shared CSS**: form fields, buttons, tables, badges, modal overlay, action bar, model badge, searchable select, sprint spreadsheet, error boundary fallback, toast, update banner in `App.css`.
- **PWA**: `vite-plugin-pwa` with `prompt` register type, manifest, icons (192+512), workbox static precache of JS/CSS/HTML/fonts. Update flow is manual (`virtual:pwa-register` wired in `useAppUpdate.ts` with `immediate: true`, not the plugin's auto-injected script): the new service worker installs but waits (`skipWaiting: false`, gated behind the `SKIP_WAITING` message); `<UpdateBanner>` appears when `onNeedRefresh` fires and only reloads when the user clicks "Actualizar". **`clientsClaim: true` is load-bearing**: in prompt mode the plugin doesn't set it, and without it the newly-activated SW never takes control of already-open pages, `controllerchange` never fires and the button silently does nothing (found live by Jorge). `reload()` is belt-and-suspenders: `updateServiceWorker(true)` + a `controllerchange` listener that reloads via `reloadPage()`, plus a 2s fallback reload for uncontrolled pages (e.g. after a hard refresh) — the button always behaves as a guaranteed reload. A background check (`registration.update()`) runs every hour so a tab left open still notices new deploys.

## Tools (10 total)

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
| Regression Tracker | `regressiontracker` | `RegressionTracker.tsx`, `TrackerGrid.tsx`, `useRegressions.ts` | No (offline) |

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
- Auto-save: each successful generation saves artifact to active workspace via `onSaveArtifact` → `useWorkspace.saveArtifact(artifact, fallbackName)`, which owns target resolution: uses `activeId` when it points at an existing workspace, otherwise (null OR stale id from corrupted/cleared storage) auto-creates a "Sin nombre" workspace and saves there — no silent data loss.
- Sidebar shows active workspace name

### Backup & persistence

- `src/services/backup.ts` — pure logic core, no React. `collectBackupData({includeApiKeys?})` snapshots every `acgen_*` localStorage entry verbatim (no `JSON.parse` — values are heterogeneous JSON/raw-string/bare-literal), always excludes `acgen_last_backup`, excludes the API-key family (`acgen_key_*` + legacy `acgen_api_key`, matched via `isSensitiveKey`) unless opted in. `createBackup(opts)` wraps that into a pretty-printed `{schemaVersion: 1, exportedAt, data}` JSON string (`BACKUP_SCHEMA_VERSION`). `parseImportFile(json)` classifies an imported file as `backup` / `legacyWorkspace` (pre-dates this feature — single-workspace export, recognized by `id`+`name`+`artifacts[]` shape) / `futureVersion` / `invalid` (`json` or `structure` reason). `restoreBackup(backup)` is a total replace of the current `acgen_*` state with the backup's `data`: always preserves `acgen_last_backup`, preserves local API keys when the backup itself carries none, rejects tampered entries whose key doesn't start with `acgen_`, never touches non-`acgen_` keys, and on `QuotaExceededError` rolls back to the exact pre-restore snapshot and returns `{ok: false, error: 'quota'}`. Plus reminder logic: `hasSignificantData()` (true if any workspace has an artifact, any sprint exists, the regression board has a filled cell or an archived run, or criteria/bug history has an entry — corrupt JSON in any one source counts as "no data" for that source, not a throw), `isBackupDue(lastBackupAt, now?)` (true when there's significant data and either no backup was ever made or the last one is older than `BACKUP_REMINDER_DAYS` = 7), `getLastBackupAt()`/`markBackupDone(now?)` over `acgen_last_backup`.
- `src/hooks/useBackupReminder.ts` — thin `useLocalStorage(STORAGE_KEYS.LAST_BACKUP, null)` wrapper exposing `{due, lastBackupAt, markDone}`; `due` is `isBackupDue(lastBackupAt)` recomputed on every render.
- `src/components/BackupMenu.tsx` — dropdown mounted in `Header` next to `WorkspacePicker` (💾 icon, reminder badge when `due`). Export: checkbox "incluir API keys" (plain-text warning shown when checked) → `createBackup` → `downloadJson`/`toFilename` → `markDone()`. Import: reads the file, `parseImportFile` routes it — `backup` goes through an inline 2-step confirm (`backup.confirmReplace` / yes / cancel) before `restoreBackup` + `onRestored` (defaults to `location.reload()`); `legacyWorkspace` calls `onImportLegacyWorkspace` (wired to `useWorkspace.importWorkspace` in `App.tsx`) directly, no confirm — wrapped in try/catch because `parseImportFile`'s shallow shape check accepts files `importWorkspace` still rejects (e.g. empty-string `id`): a throw shows `backup.importError` instead of failing silently; `futureVersion`/`invalid` show an `alert()`. A quota failure on confirm shows `backup.quotaError` and leaves the pending state so the user can retry or cancel.
- `src/services/autoBackup.ts` + `src/types/fileSystemAccess.d.ts` — File System Access API service (Chromium-only: `isFileSystemAccessSupported()` checks `'showSaveFilePicker' in window`). `chooseBackupFile()` opens the native save picker (`suggestedName: 'acgen-auto-backup.json'`), resolves `null` on user cancel (`AbortError`), otherwise propagates other errors. The chosen `FileSystemFileHandle` is persisted in IndexedDB (`saveHandle`/`loadHandle`/`clearHandle`, DB `acgen-backup` → store `handles`, fixed key `autoBackupFile`) since it's the only storage that survives a reload with a live handle. `ensurePermission(handle)` resolves readwrite permission, prompting via `requestPermission` if needed, falling back gracefully when `queryPermission`/`requestPermission` aren't implemented. `writeSnapshot(handle, contents)` never rejects — permission denial, a rejecting permission check (e.g. `SecurityError` without a user gesture, or a revoked handle), or any write I/O failure all resolve to `false` so callers can show a soft warning instead of crashing.
- `src/hooks/useAutoBackup.ts` — state machine `'unsupported' | 'off' | 'active' | 'permissionNeeded' | 'error'`. On mount, resolves a persisted handle without prompting for permission (that needs a user gesture). `enable()`/`disable()`/`reconnect()` are the only user-gesture entry points. While `active`, listens for `acgen-local-storage` (same-tab, fired by `useLocalStorage`) and the native `storage` (cross-tab) events and writes a snapshot debounced 5s (`DEBOUNCE_MS`) after the last change. Events whose changed key is `acgen_last_backup` are ignored (the CustomEvent's `detail.key` / `StorageEvent.key` identifies it; events with no key info fail open and schedule): without this filter, every successful snapshot's own `markDone()` write would re-trigger the listener and produce an infinite snapshot→`markDone`→snapshot loop rewriting the disk file every 5s. Skipping it loses nothing — `collectBackupData` excludes that key, so its change alone can never alter snapshot content. Every snapshot calls `createBackup({includeApiKeys: false})` — auto-backups never include API keys — and a successful write calls the `onSnapshot` callback (wired to `useBackupReminder().markDone` in `BackupMenu`) so auto-backups also satisfy the 7-day reminder. Guards a stale in-flight write: if the handle changed (or was cleared by `disable()`) while a debounced/`enable()` write was in flight, the result is dropped instead of resurrecting `'active'`. The auto-backup UI section in `BackupMenu` renders only when `isFileSystemAccessSupported()` is true — hidden entirely in Firefox/Safari.
- `src/services/persistence.ts` — `requestPersistentStorage()` calls `navigator.storage.persist()` once; resolves `false` (never throws) when the API is absent or `persist()` rejects. Invoked fire-and-forget (`void requestPersistentStorage()`) once at `App.tsx` mount to reduce the odds the OS evicts localStorage under storage pressure.
- **Known limitations (accepted, not bugs)**: `useSprints`/`useRegressions`/`useHistory` write `localStorage` directly without dispatching `acgen-local-storage`, so a change made only through those hooks doesn't trigger an immediate auto-backup snapshot — it's captured by the next change that does dispatch the event, or once the page reconnects. Auto-backup to a local file is Chromium-only (no File System Access API in Firefox/Safari). Changes made in the ~5s debounce window right before closing the tab can be missed by auto-backup. "Clear site data" wipes the IndexedDB handle (the auto-backup connection), though the file already written to disk survives — the user just has to re-pick it via `reconnect()`.

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

- `src/config/demoData.ts` — `DEMO_DATA` object with pre-generated input/output for 4 of the 8 LLM tools (acceptance, testcase, bugreport, testdata); the other 4 (userstory, refiner, edgecase, converter) have no demo entry or "Ver ejemplo" button
- "Ver ejemplo" button fills input + shows output without requiring API key

### Artifact chaining

- `<ChainMenu>` — dropdown on each tool's output showing valid destination tools
- `CHAIN_RULES` maps source view to available destinations
- `navigate()` supports `{ prefill: text }` to pre-fill destination tool input
- Tools: AcceptanceCriteria, UserStory, Refiner accept `prefill` prop

### Multi-provider LLM

- `src/config/providers.ts` — `PROVIDERS` registry with Groq (5 models), OpenRouter (8 models), Custom (free-text). `sanitizeModel(providerId, model)` validates a stored model against its provider's list (open-list providers like Custom accept anything); falls back to the provider's `defaultModel` otherwise. `App.tsx` derives `model` through it on every render (`useMemo(() => sanitizeModel(provider, storedModel), [provider, storedModel])`) so switching provider — or reloading with a non-Groq model already stored — never sends a model foreign to the active provider.
- `<ProviderConfig>` — unified provider + model + API key selector. Provider dropdown dynamically changes model list. Custom provider shows base URL input with inline validation (`baseUrlStatus` in providers.ts: missing/invalid/valid → hint + `aria-invalid`). `streamWithGroq` re-validates any DEFINED baseUrl before fetching and throws `error.baseUrlMissing`/`error.baseUrlInvalid` (an `undefined` baseUrl still means "default endpoint" for tests/direct calls; App passes the custom URL through even when empty so the guard fires).
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
- Sprint list: "Editar" button on active (non-archived) sprint cards renames the sprint inline (input replaces the name, Enter/blur saves, Escape cancels, empty name is a no-op); "Archivar" button (also active-only) archives from the list after a `confirm` — same `archiveSprint` + `sprint.archiveConfirm` the dashboard's "Archivar Sprint" button uses. Active cards: 🟢 + "En curso"; archived cards: 🔴 + singular "Archivado" badge (`sprint.archivedBadge` — `sprint.archived` stays plural for the section header), no Editar/Archivar buttons

### Regression Tracker

- Fully offline — no LLM dependencies
- Single permanent board with 2 platform tabs: APPS (internal id `ios`, label "APPS") and WEB (internal id `webDesktop`, label "WEB") — internal ids are historical so existing localStorage data survives renames; data from retired tabs (android, webMobile) stays orphaned-but-intact in `acgen_regressions` and never counts toward `boardHasContent`
- Editable spreadsheet grid (20x6) with headers: Regresión, Versión, Fecha, Notas, Status + empty 6th column
- Column A accepts "Nombre - URL" (accent link, Ctrl+click opens exact URL) or bare URLs. At rest a "Nombre - URL" cell displays only the name (overlay span, ellipsis); focusing the cell reveals the full value for editing. Bare URLs display as-is
- Search bar (debounced 250ms) + SnapLink link support
- "Archivar Regresión" snapshots the board to history (named "Regresión YYYY-MM-DD") and clears it; the button is disabled (and the hook no-ops) while every cell is empty; archived snapshots open read-only and can be deleted. Resizing columns in a read-only snapshot stays in memory — it never writes the shared widths key
- Shared grid component: `TrackerGrid.tsx` (linkMode 'url'). Storage: board+archived in `acgen_regressions`, column widths in `acgen_regression_col_widths`

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
| `src/config/demoData.ts` | `DEMO_DATA` pre-generated samples (acceptance/testcase/bugreport/testdata only) |
| `src/services/apiService.ts` | `streamWithGroq()` (streaming — the only generation path all tools use), `getPrompt()`, `interpolateProfile()`, `extractJsonArray()`, `isModelDecommissioned()`, `validateTestCases()`, `validateTestDataRows()`. Plain module with no React context, so it can't call `t()` — thrown errors are `I18nError` (`message` = i18n key, `params?` for interpolation, `cause` = the raw upstream error text on HTTP errors). Each of the 8 tools' catch block calls `t(err.message, err.params)` to render the translated string. |
| `src/services/anonymizer.ts` | `anonymize()`, `deanonymize()`, `applyPlaceholderEdits()`, `splitPendingPlaceholder()` — 7 regex patterns |
| `src/utils/download.ts` | `downloadJson()`, `toFilename()` — client-side file download used by workspace export and backup export |
| `src/utils/dates.ts` | `formatDate(iso, lang)` — parses 'YYYY-MM-DD' as a LOCAL date (never `new Date(iso)`, which is UTC midnight and shifts a day back in negative-offset timezones) and formats per app language (es-ES / en-US); `localTodayISO()` — today's LOCAL day, used by the new-sprint form default, `archiveSprint` and `archiveBoard` |
| `src/services/backup.ts` | `createBackup()`/`collectBackupData()`, `parseImportFile()`, `restoreBackup()`, `hasSignificantData()`/`isBackupDue()`/`getLastBackupAt()`/`markBackupDone()` — full-state backup/restore + reminder logic |
| `src/services/autoBackup.ts` | File System Access API wrapper: `chooseBackupFile()`, `saveHandle()`/`loadHandle()`/`clearHandle()` (IndexedDB), `ensurePermission()`, `writeSnapshot()` |
| `src/services/persistence.ts` | `requestPersistentStorage()` — `navigator.storage.persist()` at App mount |
| `src/hooks/useAppUpdate.ts` | Wraps `virtual:pwa-register`'s `registerSW()` — `{ needRefresh, reload }`; hourly `registration.update()` poll; `reload()` = skip-waiting + `controllerchange` listener + 2s guaranteed-reload fallback |
| `src/components/UpdateBanner.tsx` | Fixed top banner shown when `needRefresh` is true, "Actualizar" button triggers `reload()` |
| `src/utils/reloadPage.ts` | One-line `window.location.reload()` indirection so tests can mock the reload |
| `src/types/fileSystemAccess.d.ts` | Ambient types for the File System Access API (`showSaveFilePicker`, `FileSystemFileHandle`, ...) |
| `src/App.tsx` | Hash routing, provider state, workspace state, theme state, prefill/chaining state, I18nProvider wrapper, sidebar layout |
| `src/i18n/I18nContext.tsx` | `I18nProvider`, `useT()` hook, `useLang()` hook, language detection |
| `src/i18n/es.json` | 225 Spanish UI strings |
| `src/i18n/en.json` | 225 English UI strings — key set kept in exact parity with `es.json`, guarded by `src/i18n/keyParity.test.ts` |
| `src/components/Header.tsx` | Brand, WorkspacePicker, ProviderConfig, Model badge, theme toggle, language toggle |
| `src/components/Sidebar.tsx` | Collapsible tool nav grouped by category, workspace name, prompt editor link |
| `src/components/LandingScreen.tsx` | Hero, config strip (ProviderConfig), 10-tool grid |
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
| `src/components/BackupMenu.tsx` | Backup dropdown in Header: full export/import + auto-backup section (Chromium-only) |
| `src/hooks/useBackupReminder.ts` | `{due, lastBackupAt, markDone}` over `acgen_last_backup` |
| `src/hooks/useAutoBackup.ts` | Auto-backup state machine + debounced snapshot-on-change |
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

## Known issues

None outstanding as of 2026-07-22. The full fix trail is in "Evolution history" below and in each PR's / commit's description on GitHub. Two deliberate, non-blocking caveats worth knowing: (1) the Regression Tracker's hover ↗ icon can capture the last ~22px of a long cell, and touch devices without `:hover` never see it; a configured tracker base URL can't be cleared from the UI (all deliberate — see the 2026-07-21 row). (2) The PWA update banner's very first appearance for a given user is a one-time transition: a browser still running the old `autoUpdate`-era service worker won't show the banner until one hard refresh (or closing every tab) swaps it for the current `prompt`-based worker; from then on the banner + "Actualizar" button work on every deploy. (The Fase 3 audit's meta-lesson still stands: task-by-task reviews missed flow-level bugs; verify data flow end to end.)

## Evolution history

| Phase | Date | Scope |
|---|---|---|
| Bug fixes (pre-v2) | 2026-07-10 | Crash fixes, data loss prevention, Sprint UX, security, exports |
| Fase 1 (v2) | 2026-07-16 | Remove Jira, hash routing, demo mode, project profile, Ctrl+Enter, Toast |
| Fase 2 (v2) | 2026-07-16 | Streaming, 4 new tools (UserStory/Refiner/EdgeCase/Converter), artifact chaining, sidebar, ResultPanel† + ExportBar |
| Fase 3 (v2) | 2026-07-16 | Confidential mode, workspaces, i18n ES/EN, customizable prompts, PWA, multi-provider LLM |
| Fase 3 audit + fixes | 2026-07-16 | 6-agent parallel audit vs. spec/plan/ledger. Fixed: confidential mode never anonymized the outgoing request (critical), non-Groq model wiped on reload, workspace export didn't download, PWA icons were 1×1 placeholders, substitution-count badge always hidden, 8 stale-language toast handlers, workspace delete had no confirm, TTS crashed without the Speech Synthesis API, 5 lint errors, dead code (`ApiKeyConfig`, `ModelSelector`, `ResultPanel`†, the pre-streaming `generateWithGroq`/`generateCriteria`/`generateTestCases`/`generateBugReport`/`generateTestData`, unused `GroqResponse`/`TestCaseResponse` types, unused `STORAGE_KEYS.API_KEY`). 96 → 168 tests. See "Known issues" above for what's still open. |
| Post-audit fix | 2026-07-16 | Mid-stream errors no longer silently swallowed: `useStreamingResponse.stream()` rethrows after recording its state, so every tool's existing `catch` (ErrorBanner or toast) finally fires; also un-swallows errors thrown from `onComplete` (EdgeCaseTool's no-parseable-JSON case). 168 → 172 tests. |
| i18n completion | 2026-07-16 | apiService throws i18n keys + params (I18nError), translated at tool catch blocks; ExportBar, ErrorBoundary (contextType), HistoryModal (+ inline 2-step confirm replacing the last window.confirm), SearchableSelect. Key-parity guard test. |
| saveArtifact hardening | 2026-07-16 | Workspace target resolution moved from App.tsx into `useWorkspace.saveArtifact(artifact, fallbackName)`: a stale `activeId` (workspace deleted from storage but still active) now falls back to auto-creating "Sin nombre" instead of silently dropping the artifact. 194 → 197 tests. |
| Custom base URL validation | 2026-07-16 | `baseUrlStatus()` in providers.ts, applied twice: inline hint + `aria-invalid` in ProviderConfig, and a pre-fetch guard in `streamWithGroq` throwing `error.baseUrlMissing`/`error.baseUrlInvalid` — an empty custom URL no longer silently sends the custom key to Groq's endpoint. ProviderConfig's last two hardcoded labels translated. 197 → 211 tests. |
| PHONE regex digit floor | 2026-07-16 | `/\+?\d(?:[\s()-]*\d){6,}/g`: requires 7+ digits (not 7+ chars of the class), starts at +/digit, ends on a digit — indented list runs and short ids no longer become false `[PHONE_N]` rows, matches no longer swallow surrounding whitespace. Bare 7+ digit numbers stay masked on purpose (privacy-first). Closes the last known issue. 211 → 216 tests. |
| Landing layout restore | 2026-07-16 | Landing re-centered (`:only-child` span for the sidebar-less main + `.landing` wrapper), config strip's stale 1.5fr/1fr grid removed (Proveedor\|Modelo\|API Key now one horizontal row), 9 tools moved to a 2-column card grid with the "more coming" slot as the 10th cell (2×5, no scroll; 1 column <950px). Verified via playwright screenshots. 216 → 220 tests. |
| Template fields cleanup | 2026-07-16 | "Validado por:" ships as a bare label (no hardcoded name) in the acceptance and bug report templates; bug report DESCRIPCIÓN pins `Entorno/Pais: Pro/ES` (regardless of the market selector) and leaves Versión/Evidencia empty for manual fill-in. Demo data matched. Guarded by `promptTemplates.test.ts`. 220 → 225 tests. |
| Regression Tracker + TrackerGrid extraction | 2026-07-17 | New offline tracking tool for regression testing: 4 platform tabs, single permanent board (20×6 grid per platform), "Nombre - URL" accent links with Ctrl+click, SnapLink + search bar, "Archivar Regresión" snapshots to history (read-only), deletable archives. Shared spreadsheet component `TrackerGrid.tsx` extracted from Sprint Tracker (used by both via linkMode). Link cells show only the name at rest (full value on focus). 225 → 258 tests. |
| Docs sync + dead code cleanup | 2026-07-17 | Post-merge audit: removed `ExportBar.tsx`‡ (zero importers) and 10 orphaned `*.loadExample` i18n keys (superseded by the shared `common.example`); fixed the landing's hardcoded "05" section-count badge to reflect the real tool count; corrected this file's stale i18n key count (was claiming 220, real count 236 before this cleanup, 231 after removing the dead keys) and the demo-data claim (covers 4 of 8 LLM tools, not "each tool"); README.md rewritten to match the current 10-tool app. 258 → 255 tests (net: -3 from ExportBar.test.tsx). |
| Regression Tracker: 3 platform tabs | 2026-07-18 | Reduced the Regression Tracker from 4 platform tabs to 3: **iOS, Android, WEB**. Removed the Web-Mobile tab; renamed Web-Desktop → "WEB". Kept the internal `PlatformId` `webDesktop` (only the visible label changed) so existing regression data under that localStorage key is preserved under "WEB"; Web-Mobile data becomes orphaned in `acgen_regressions` (no longer rendered). Light direct-TDD (RED verified). PR #12 (`adc924b`). 255 → 255 tests. |
| Landing placeholder removed | 2026-07-18 | Removed the "Más generadores próximamente" placeholder card (dashed `.add-slot`, the tool grid's 11th cell) plus its CSS and the `landing.moreComing` i18n key; the landing now renders exactly the 10 real tool cards. PR #13 (`808c0fe`). 255 → 255 tests. |
| Dead-code + docs sweep | 2026-07-18 | Session-close audit removed remaining dead code: the unused `REQUIRED_MARKERS` export, **38 orphaned i18n keys × 2 langs** (230 → 192 keys, parity kept), and **12 unused CSS classes** (`.topbar-back`, `.field-input.has-adorn`, `.btn-icon-new`, `.panel`/`.panel-header`/`.panel-body`, the `.jira-*` config block, `.br-compact-field-jira`, `.br-form-row`) plus 2 stale CSS comments. Every orphan verified via quoted-string grep before deletion (`t()` silently falls back to the key, so tests can't catch a wrong removal). README gained a "Despliegue" section documenting the auto-deploy flow. 255 → 255 tests. |
| Backup & persistence | 2026-07-19 | New cross-cutting feature: full-state backup/restore (`backup.ts` — export/import JSON of every `acgen_*` key, API keys excluded by default with opt-in, 7-day reminder), `<BackupMenu>` in the Header, and Chromium-only auto-backup to a local file via the File System Access API (`autoBackup.ts` + `useAutoBackup`, handle persisted in IndexedDB, 5s-debounced snapshots, never includes API keys) plus `navigator.storage.persist()` at startup (`persistence.ts`). New `acgen_last_backup` storage key. 22 new `backup.*` i18n keys × 2 langs (192 → 214, parity kept). 7 new test files. Final whole-branch review caught and fixed a snapshot→`markDone`→snapshot infinite write loop (auto-backup now ignores `acgen_last_backup` events) and an unhandled throw on malformed legacy-workspace imports. 255 → 345 tests. Verified live in real Chrome (immediate snapshot on enable, 5s-debounced snapshot on change, no idle rewrites). |
| Workspace UX fixes | 2026-07-20 | Two reported layout bugs. (1) The workspace dropdown's create row: the global `.btn-primary { min-width: 240px }` made the Crear button fill the ~240px dropdown and crush the name input until its placeholder was invisible — the button now overrides `min-width` to 0 and the input takes the row at 32px. (2) The Sidebar's `WS: {name}` label rendered regardless of the collapsed state and spilled out of the 52px collapsed rail — it now hides on collapse (like the category labels) and ellipsizes with a `title` tooltip when expanded. New `Sidebar.test.tsx` (the Sidebar had no tests before). PR #15 (`ffff7e0`). 345 → 351 tests. |
| Deferred follow-ups sweep | 2026-07-20 | The 7 items deferred from the Regression Tracker final review, one commit each. New `src/utils/dates.ts`: `formatDate` parses tracker dates as LOCAL time (no more previous-day display in negative-offset timezones) and formats per app language instead of hardcoded es-ES; `localTodayISO()` replaces the UTC-based `toISOString()` default in the new-sprint form and the two hand-rolled copies in useSprints/useRegressions. readOnly column resize made ephemeral (in-memory, shared widths key untouched). Empty-board archive blocked (hook guard + disabled button). Drag-drop test coverage. TrackerGrid exhaustive-deps warning fixed (`grid` memoized). `persist()` moved out of setState updaters into an identity-guarded effect (probing showed React 18.3 StrictMode does NOT double-invoke updaters, so this was purity cleanup, not an active double-write). Scroll-to-top on view change (entering a tool from a scrolled landing kept the scroll). First tests for SprintList and App. PR #16 (`f60324d`). 351 → 375 tests. |
| Regression Tracker: 2 platform tabs | 2026-07-20 | Reduced the Regression Tracker from 3 platform tabs to 2: **APPS, WEB**. Removed the Android tab; renamed iOS → "APPS" keeping the internal `PlatformId` `ios` (label change only) so existing data under that key survives; Android data becomes orphaned-but-intact in `acgen_regressions`. `boardHasContent` now checks only active `PLATFORM_IDS`, so orphaned-key content can no longer enable archiving a visually empty board (or leak into emptiness checks). 375 → 376 tests. |
| Sprint Tracker: enlaces de ticket rotos | 2026-07-21 | Los tickets abrían la propia app: `acgen_tracker_base_url` no tenía escritores desde la eliminación de Jira (`4c258a3`) y el enlace salía relativo (`/browse/KEY` → rewrite SPA). Fix en `TrackerGrid`: guardia (`getLinkUrl` → `null` sin base URL, celdas sin estilo de enlace + title de aviso), migración one-shot de la clave huérfana `acgen_jira_base_url` (intacta, criterio datos-Android), y botón ⚙ (solo modo jira) con input inline que persiste normalizando barras finales. Un draft vacío al guardar se trata como no-cambio (el ⚙ puede fijar una URL pero nunca borrarla) para no pelear con la migración, y el flag de cancelación se arma en `mousedown` para que el propio click del ⚙ cierre el panel en vez de guardar-y-reabrir. La base debe ser absoluta: al guardar se prefija `https://` si falta esquema, y `getLinkUrl` exige `^https?://` para construir el enlace, de modo que ni un valor sin esquema tecleado ni uno heredado por migración puedan volver a producir una URL relativa. 376 → 390 tests. |
| Sprint Tracker: botón Editar (renombrar sprint) | 2026-07-22 | Nuevo botón "Editar" en las tarjetas de sprint activas (junto a "Eliminar"), solicitado por Jorge. Click sustituye el nombre por un input inline (mismo patrón que el rename de `WorkspacePicker`): Enter/blur guarda vía `updateSprint(id, { name })` (ya existía en `useSprints`, sin cambios en el hook), Escape cancela, nombre vacío tras `trim()` no guarda. Solo visible en sprints activos — los archivados no lo muestran. Nueva clave i18n `common.edit` ("Editar"/"Edit"). Direct-TDD ligero (RED verificado, 7 tests nuevos). Verificado en Chrome real vs build de producción (`vite preview` + Playwright): crear → editar → guardar con Enter → cancelar con Escape, sin errores de consola. 396 → 403 tests. |
| PWA: actualización con aviso, no silenciosa | 2026-07-22 | Bug real encontrado por Jorge tras el deploy anterior: con `registerType: 'autoUpdate'` pero sin usar `virtual:pwa-register` en la app, el flujo "auto" prometido por la config nunca se ejecutaba — el registro por defecto (`registerSW.js` auto-inyectado) solo llama a `.register()` una vez en `load`, sin polling ni recarga en `controllerchange`; una pestaña ya abierta se quedaba sirviendo el JS antiguo hasta un hard refresh (Ctrl+Shift+R). Jorge eligió aviso-con-botón sobre recarga silenciosa (evita perder una edición en curso, p.ej. el rename de un sprint). Fix: `registerType` → `prompt`; nuevo hook `useAppUpdate.ts` que registra `virtual:pwa-register` manualmente (`onNeedRefresh` → `needRefresh=true`; `onRegisteredSW` arma un poll de `registration.update()` cada hora para pestañas que quedan abiertas mucho tiempo); nuevo `<UpdateBanner>` fijo arriba, visible solo cuando `needRefresh`, con botón "Actualizar" que llama a `reload()` (envía `SKIP_WAITING` al SW en espera → `controllerchange` → `location.reload()`). Al pasar a `prompt`, `vite-plugin-pwa` deja de forzar `skipWaiting`/`clientsClaim` en el SW generado (antes se activaba solo) y, al detectar el import manual de `virtual:pwa-register`, deja de auto-inyectar el script de registro en `index.html` (verificado leyendo `dist/sw.js`/`dist/index.html` tras el build). Direct-TDD (RED verificado, 5 tests nuevos: `UpdateBanner` puro + smoke de `useAppUpdate`, cuyo `registerSW` real es un stub no-op bajo Vitest). 403 → 408 tests. |
| Sprint Tracker: botón Archivar en la lista | 2026-07-22 | El archivado solo era accesible desde dentro del dashboard del sprint; Jorge pidió archivarlo desde la tarjeta de la lista. Nuevo botón "Archivar" (`common.archive`, etiqueta corta — `sprint.archive` "Archivar Sprint" sigue siendo la del dashboard) entre "Editar" y "Eliminar", solo en sprints activos, con el mismo `confirm(t('sprint.archiveConfirm'))` del dashboard y llamando al `archiveSprint` ya existente (cero cambios en `useSprints`). Estado visual: archivados pasan de 📦 a 🔴 y el badge pasa del plural `sprint.archived` ("Archivados", que queda solo como título de sección) al nuevo singular `sprint.archivedBadge` ("Archivado"). Direct-TDD (RED verificado, 6 tests nuevos). Verificado en Chrome real vs build de producción: cancelar el confirm no archiva, aceptarlo mueve la tarjeta a Archivados con 🔴 + badge + endDate de hoy. 408 → 414 tests. |
| PWA: el botón "Actualizar" no recargaba | 2026-07-22 | Reporte en vivo de Jorge tras el deploy del banner: al abrir la app veía la versión vieja sin banner, y tras un hard refresh el banner aparecía sobre la versión ya nueva pero "Actualizar" no hacía nada. Dos causas: (1) transición única — su SW era de la era `autoUpdate` y la página vieja no tenía código de banner (irreparable desde fuera, solo ese primer salto); (2) **bug real: en modo `prompt`, `vite-plugin-pwa` no incluye `clientsClaim()` en el SW generado**, así que al pulsar el botón el SW nuevo se activaba pero nunca tomaba control de la página abierta → sin `controllerchange` → sin `location.reload()` → botón muerto en TODOS los deploys futuros. Fix: `clientsClaim: true` + `skipWaiting: false` explícitos en workbox; `reload()` reforzado (listener `controllerchange` → `reloadPage()` + fallback garantizado a los 2s para páginas descontroladas tras hard refresh — el botón actúa siempre como recarga garantizada); `immediate: true` en el registro. Nuevo `src/utils/reloadPage.ts` (indirección mockeable). Direct-TDD (RED verificado, 3 tests nuevos). **Verificado con una simulación e2e del ciclo completo en Chrome real** (server estático propio + rebuild con marcador en `<title>` + `registration.update()` forzado): banner aparece sobre la build vieja, click recarga a la nueva, banner desaparece, cero errores. 414 → 417 tests. |
| Historia de usuario: guía de entrada | 2026-07-24 | Jorge pidió que el placeholder guíe al usuario sobre qué escribir. El placeholder pasa de una sola línea genérica al esqueleto Connextra (`Como usuario...` / `Quiero [funcionalidad]...` / `Para [beneficio]...`, ES; `As a user...` / `I want [functionality]...` / `So that [benefit]...`, EN). Como un `placeholder` se esfuma al escribir, se añade además un **hint persistente** bajo el textarea (`userstory.inputHint`, patrón de estilo de `ProviderConfig`: `fontSize:12`, `var(--text-3)`) que explica la estructura y aclara que también vale texto libre. Nueva clave i18n ×2 idiomas (224 → 225, parity mantenida). TDD (RED verificado, primer `UserStoryTool.test.tsx`, 4 tests). 417 → 421 tests. |

† `ResultPanel.tsx` (added Fase 2) was removed in the audit cleanup — every tool had already grown its own output rendering and nothing imported it.

‡ `ExportBar.tsx` (added Fase 2) was removed in the 2026-07-17 docs/cleanup pass for the same reason: every tool had grown its own inline export buttons and nothing imported it.
