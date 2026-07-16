# Task 2 Report: Tool catch blocks translate I18nError

## Status: DONE

## Summary

All 8 tool components now translate the i18n-key `Error.message` (and its
optional `params`) via `t()` in their catch blocks, instead of showing the
raw key string. A new focused RTL test (`src/components/errorTranslation.test.tsx`)
proves an English-language 401 response renders the translated
`error.apiKey` banner text, not the literal key.

## TDD evidence

### RED (before the implementation change)

Command: `npx vitest run src/components/errorTranslation.test.tsx`

Result: **FAIL** — assertion `screen.getByText('Invalid API key. Verify your key and try again.')`
could not find the text; the rendered `.error-text` span instead contained
the literal string `error.apiKey` (confirmed in the printed DOM dump).

### GREEN (after the implementation change)

Command: `npx vitest run src/components/errorTranslation.test.tsx`

```
✓ src/components/errorTranslation.test.tsx (1 test) 208ms
  ✓ API errors render translated > shows the English error.apiKey text when the API returns 401

Test Files  1 passed (1)
     Tests  1 passed (1)
```

### Full suite + typecheck + lint (after implementation)

`npx vitest run`:
```
Test Files  20 passed (20)
     Tests  182 passed (182)
```
(includes `src/components/tools.confidential.test.tsx`, which exercises the
same catch paths in AcceptanceCriteriaTool/UserStoryTool/RefinerTool/
EdgeCaseTool/ConverterTool — all still green.)

`npx tsc --noEmit`: no output, exit 0 — clean.

`npx eslint src/components`: **0 errors**, 13 pre-existing warnings (all
`react-hooks/exhaustive-deps` / `react-refresh/only-export-components`,
none introduced by this change — each is either a `useCallback` missing
`baseUrl`/`onSaveArtifact` dep, unrelated to the one-line catch-block edit,
or in files this task didn't touch at all, e.g. `Icons.tsx`, `Toast.tsx`,
`SprintDashboard.tsx`).

## Deviation from the brief's test sketch

The brief's Step 1 sketch used `@testing-library/user-event`, but that
package is not installed in this project (`npx vitest run` failed with
"Failed to resolve import '@testing-library/user-event'"). Per the task's
instruction to "crib the render/mock scaffolding style from
`tools.confidential.test.tsx`," I used `fireEvent.change` /
`fireEvent.click` instead (that file's established pattern), which needs
no new dependency and produced the same RED verification.

## Files changed

One-line catch-block change + one import line added to each (all committed
in `3a9f507`):
- `src/components/AcceptanceCriteriaTool.tsx`
- `src/components/BugReportTool.tsx`
- `src/components/ConverterTool.tsx`
- `src/components/EdgeCaseTool.tsx`
- `src/components/RefinerTool.tsx`
- `src/components/TestCaseTool.tsx`
- `src/components/TestDataTool.tsx`
- `src/components/UserStoryTool.tsx`

New test file:
- `src/components/errorTranslation.test.tsx`

Each tool's catch block changed from:
```ts
const message = err instanceof Error ? err.message : t('error.unexpected');
```
to:
```ts
const message = err instanceof Error ? t(err.message, (err as I18nError).params) : t('error.unexpected');
```
with `import type { I18nError } from '../services/apiService';` added next
to each file's existing `streamWithGroq`/`getPrompt` import.

## Self-review

- All 8 tools listed in the brief were changed — verified via
  `git diff --stat` (8 tsx files, 3 lines each: +1 import, ~1 changed
  line) plus a `grep` sweep confirming no bare `err.message` remains in
  any of the 8 catch blocks — every remaining `err.message` reference is
  now wrapped in `t(...)`.
- The test asserts the real translated English string
  `'Invalid API key. Verify your key and try again.'` (from `en.json`
  `error.apiKey`), not just "not equal to the raw key" — a meaningful,
  reality-anchored assertion.
- Confirmed via `src/services/apiService.ts` that for a mocked 401,
  `err.message === 'error.apiKey'` (the key) and the upstream JSON body
  text lands on `err.cause`, matching the brief's amendment note — so the
  test's fetch mock (`json: () => Promise.resolve({ error: { message:
  'Invalid API Key' } })`) doesn't leak into the assertion; only the
  i18n-translated key text is checked.
- Verified `t()`'s fallback (unknown key/message returned verbatim) is
  intact in `src/i18n/I18nContext.tsx` — untouched by this task, so
  non-I18nError plain `Error`s (e.g. network failures with arbitrary
  messages) will still display their raw text via the `t()` fallback path,
  preserving current behavior for non-key errors.
- Diff output is pristine: only the intended 8 tool files + 1 new test
  file were staged and committed (`3a9f507`, 9 files changed,
  46 insertions, 8 deletions). Pre-existing uncommitted changes to
  `.superpowers/sdd/*` and `docs/superpowers/plans/*` (present before this
  task started, unrelated to it) were left untouched and unstaged.
- No regressions: full `vitest run` (182/182), `tsc --noEmit` (clean),
  `eslint src/components` (0 errors) all pass.

## Concerns

None. The only judgment call was substituting `fireEvent` for the brief's
`userEvent` sketch (uninstalled dependency) — documented above, and it
still achieves the same RED→GREEN proof using the codebase's own
established test pattern.

Note: this report file previously contained content from an unrelated
earlier task (stale filename reuse from before this SDD run's Task 2 —
"Anonymizer UI components + API integration"); it has been overwritten
with this task's actual report.
