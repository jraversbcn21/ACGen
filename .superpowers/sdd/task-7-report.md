# Task 7 report: key-parity guard, full verification, AGENTS.md sync

## Implemented

1. **`src/i18n/keyParity.test.ts`** (new) — transcribed verbatim from the brief. Two tests:
   - `es and en have exactly the same keys` — `Object.keys(es).sort()` vs `Object.keys(en).sort()`.
   - `every {param} placeholder in es exists in en and vice versa` — regex-extracts `{param}` tokens per key and compares sorted arrays both ways.
   Ran in isolation first (`npx vitest run src/i18n/keyParity.test.ts`): **2/2 pass**, confirming parity holds (220 keys each, verified separately with a one-off `node -e` key count).

2. **Full verification** (all green — see outputs below).

3. **AGENTS.md** updated per the brief + supplied facts:
   - Test table: `apiService.test.ts` 22→31 (added `streamWithGroq` HTTP-error `I18nError` shape note), `ErrorBoundary.test.tsx` 3→4 (added the English-fallback-via-`contextType` case), new rows for `errorTranslation.test.tsx` (1), `ExportBar.test.tsx` (3), `HistoryModal.test.tsx` (3), `SearchableSelect.test.tsx` (3), `keyParity.test.ts` (2). Total line: `172 tests across 19 files` → `194 tests across 24 files`, matching the real `npx vitest run` output exactly.
   - Architecture bullet and Key files rows: `es.json`/`en.json` 203→220 keys, both now note the `keyParity.test.ts` guard.
   - `apiService.ts` Key files row rewritten to describe the `I18nError` contract (message = i18n key, `params?` for interpolation, `cause` = raw upstream text on HTTP errors) and that the 8 tools' catch blocks call `t(err.message, err.params)` — verified this claim against the actual source (`src/services/apiService.ts:9,164,167,170` and a grep for `t(err.message` across the 8 tool components) before writing it.
   - Known issues: removed item 1 (i18n leftovers, including the stale "7 `error.*` keys sit unused" claim), renumbered 2→1, 3→2, 4→3. Intro sentence now also mentions branch `fix/i18n-leftovers` closed out the deferred i18n work (no PR exists yet, so referenced by branch name per the task instructions, not a PR link).
   - Evolution history: added the `i18n completion | 2026-07-16 | ...` row exactly as specified in the brief.

4. **Commit**: `b518df4` — `test(i18n): key-parity guard; docs: sync AGENTS.md after i18n completion`, with the requested Co-Authored-By/Claude-Session trailers. Only `src/i18n/keyParity.test.ts` and `AGENTS.md` staged/committed (the `.superpowers/sdd/*` and plan-doc modifications already present in the working tree before this task started were left untouched, as instructed).

## Verification outputs

**`npx vitest run src/i18n/keyParity.test.ts`**
```
✓ src/i18n/keyParity.test.ts (2 tests) 9ms
Test Files  1 passed (1)
     Tests  2 passed (2)
```

**`npx vitest run` (full suite)**
```
Test Files  24 passed (24)
     Tests  194 passed (194)
Duration    20.71s
```
File-by-file counts used to build the new AGENTS.md table (all passed): apiService 31, anonymizer 24, useSprints 20, useLocalStorage 14, useHistory 11, useWorkspace 12, useStreamingResponse 4, providers 12, ErrorBoundary 4, TestCaseTool.confidential 5, BugReportTool.confidential 2, TestDataTool.confidential 2, tools.confidential 15, ConfidentialToggle 6, staleTranslation 3, WorkspacePicker 5, speechSynthesis 3, errorTranslation 1, ExportBar 3, HistoryModal 3, SearchableSelect 3, download 7, pwaIcons 2, keyParity 2. Sum = 194, files = 24. Two `console.error`/uncaught-error stderr blocks appear from `ErrorBoundary.test.tsx`'s intentional-throw cases — expected jsdom noise, not failures (test still shows ✓).

**`npx tsc --noEmit`** — exit 0, no output (silent, as required).

**`npx eslint src`** — exit 0. `16 problems (0 errors, 16 warnings)` — all pre-existing `react-hooks/exhaustive-deps` and `react-refresh/only-export-components` warnings, unrelated to this task's changes (confirmed none are in `keyParity.test.ts` or any file touched by this branch's other tasks).

**`npm run build`** — `tsc -b && vite build` succeeded, exit 0. PWA precache generated (14 entries, 1302.97 KiB). One pre-existing chunk-size warning (`index-BqXv79T0.js` 711 KB) — not a new regression, not part of this task's scope.

## Files changed

- `C:\repositorio\ACGen\acgen\src\i18n\keyParity.test.ts` (new, 17 lines)
- `C:\repositorio\ACGen\acgen\AGENTS.md` (29 insertions, 12 deletions — see summary above)

## Self-review

- Parity test transcribed character-for-character from the brief; no modifications.
- Verified every AGENTS.md factual claim against real source/test output rather than trusting the brief's approximate deltas blindly: counted dictionary keys directly (220/220), grepped `apiService.ts` for the `I18nError` type definition and throw sites, grepped all 8 tool components for `t(err.message`, and cross-checked the new total (194/24) against the actual `vitest run` summary line rather than back-computing it from the brief's stated deltas.
- Confirmed `useStreamingResponse.test.ts` was already present in the pre-existing table (per the task's own caveat to check before assuming) — it was, at 4 tests, unchanged.
- Known issues renumbering double-checked: old 2/3/4 (saveArtifact, custom base URL, PHONE regex) now read 1/2/3 with no other text altered.
- No other stale "error.*" or Spanish-error claims found elsewhere in AGENTS.md (checked via grep for "error"/"Spanish"/"mensaje").
- Did not touch the "Key files" table entries for `HistoryModal.tsx`/`SearchableSelect.tsx` themselves (they were never listed there, even before this branch) — out of scope per the brief, which only asked for the test-table and Known-issues/apiService/evolution edits.
- Git diff of AGENTS.md reviewed in full before committing; commit contains exactly the two intended files.

## Concerns

None. Parity guard passes as an invariant (no drift found), all verification gates are green, and AGENTS.md now accurately reflects the branch's end state.

## Note

This file previously held a stale report for an unrelated earlier task ("Task 3.4: Customizable Prompts"); it has been overwritten with this task's report as instructed.

## Report path

`C:\repositorio\ACGen\acgen\.superpowers\sdd\task-7-report.md`
