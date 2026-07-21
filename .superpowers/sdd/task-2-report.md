# Task 2 Report — Migración de la clave huérfana `acgen_jira_base_url`

## Status: DONE

## Commit
`c932e655ede6a1c84c6b01a65f2534cb0a4ab1fa` — "fix(tracker): migrate orphaned acgen_jira_base_url into acgen_tracker_base_url"

## Files changed

### `src/components/TrackerGrid.tsx`
- Added `LEGACY_JIRA_BASE_URL_KEY = 'acgen_jira_base_url'` constant and `readLegacyBaseUrl()` helper right after `MIN_COL_WIDTH` (module-level constants block), exactly as specified in the brief. The helper reads the legacy key via `localStorage.getItem`, JSON-parses it defensively (returns `''` on missing key, non-string parse, or parse error), and never writes/deletes it.
- Replaced line 149 (`const baseUrl = (useLocalStorage(...)[0] || '').replace(...)`) with:
  - `const [storedBaseUrl, setStoredBaseUrl] = useLocalStorage(STORAGE_KEYS.TRACKER_BASE_URL, '');`
  - `const baseUrl = (storedBaseUrl || '').replace(/\/+$/, '');` — same derived value as before, so Task 1's `getLinkUrl` `null`-when-empty guard and the `unconfiguredTicket` flag keep working unchanged.
  - A `legacyMigrationTried` ref plus a `useEffect` that: bails out if migration was already attempted this mount, if `linkMode !== 'jira'` (Regression Tracker untouched), or if `storedBaseUrl` is already set (never overwrites a real configured value); otherwise reads the legacy key and, if non-empty, calls `setStoredBaseUrl(legacy)` once.
  - Dependency array `[linkMode, storedBaseUrl, setStoredBaseUrl]` — safe per the brief's note that `useLocalStorage`'s setter is `useCallback`-wrapped and referentially stable.

### `src/components/TrackerGrid.test.tsx`
- Appended the exact 3-test `describe('TrackerGrid — migración de la clave antigua acgen_jira_base_url', ...)` block from the brief, verbatim, after the last existing describe block (column resize persistence).

## TDD evidence

**RED (before implementing)** — ran `npx vitest run src/components/TrackerGrid.test.tsx`:
```
✓ ...24 pre-existing + 2 of the 3 new tests passed...
× TrackerGrid — migración ... > migra la URL huérfana al montar en modo jira y los enlaces funcionan
  → expected null to be 'https://jira.legacy.com' // Object.is equality
Tests  1 failed | 24 passed (25)
```
Matches the brief's Step 2 prediction exactly: 1st test fails (new key stays empty), 2nd and 3rd pass from the start as regression guards.

**GREEN (after implementing)** — same command:
```
✓ src/components/TrackerGrid.test.tsx (25 tests) 1470ms
Tests  25 passed (25)
```

**Full suite regression check** — `npx vitest run`:
```
Test Files  40 passed (40)
     Tests  381 passed (381)
```
No other suite affected.

## Decisions / notes
- Nothing in the brief was ambiguous; implemented verbatim as given (helper, effect, hook destructuring), no deviations.
- Confirmed `readLegacyBaseUrl` never writes/deletes `acgen_jira_base_url` — only `localStorage.getItem` is called on it anywhere in the new code.
- Confirmed the `useEffect` fires the migration at most once per mount (via the `legacyMigrationTried` ref) and does nothing in `linkMode: 'url'` (Regression Tracker), satisfying the "shared component, must not affect url mode" constraint.
- `storedBaseUrl` / `setStoredBaseUrl` are exposed under exactly those names in the component body, ready for Task 3's config UI to consume.
- Note: this report path (`task-2-report.md`) previously held a stale report from an unrelated earlier "Task 2" (URL mode/readOnly work, dated 2026-07-17, commit `34b7941`). It has been overwritten here with this task's report, per instructions to write the report to this exact path.
