# Task 1 Report: apiService throws i18n keys with params

## What I implemented

1. **`src/i18n/es.json` / `src/i18n/en.json`**: added 6 new `error.*` keys (`error.noTestCaseArray`, `error.testCaseInvalid`, `error.testCaseMissingFields`, `error.testCaseWrongTypes`, `error.recordInvalid`, `error.recordNestedValue`) right after `error.boundary`, verbatim as specified in the brief.

2. **`src/services/apiService.ts`**:
   - Added `export type I18nError = Error & { params?: Record<string, string | number> }` and a helper `i18nError(key, params?)` right after the `ToolType` type.
   - Replaced all 12 throw sites (previously Spanish literals) to throw i18n keys via `i18nError(...)`, per the brief's table:
     - `extractJsonArray`: both JSON-parse-failure paths → `error.invalidJson`; missing-array path → `error.noTestCaseArray`; unrecognized-format path → `error.invalidFormat`.
     - `validateTestCases`: not-an-object → `error.testCaseInvalid` with `{n}`; missing required fields → `error.testCaseMissingFields` with `{n, key, fields}`; wrong types → `error.testCaseWrongTypes` with `{n, key, fields}`.
     - `streamWithGroq`: 401 → `error.apiKey`, 429 → `error.rateLimit`, decommissioned model → `error.modelDecommissioned` (all via `Object.assign(i18nError(...), apiError)`, preserving `GroqApiError` fields). The final catch-all throw (`throw Object.assign(new Error(apiError.message), apiError)`) was left unchanged, exactly as instructed, since `apiError.message` is dynamic upstream text, not a static string to key-ify.
     - `validateTestDataRows`: not-an-object row → `error.recordInvalid` with `{n}`; nested object/array value → `error.recordNestedValue` with `{n, field}`.

3. **`src/services/apiService.test.ts`**:
   - Imported `extractJsonArray` and `type I18nError` from `./apiService`.
   - Added the new `describe('i18n error keys', ...)` block (7 tests) verbatim from the brief.
   - Migrated the 7 old Spanish-regex assertions to catch the thrown `I18nError` and assert on `.message` (the key) and relevant `.params` fields, per the brief's mapping table (fixture → key: testSteps-as-string and testSteps-with-non-string-element and priority-as-number all map to `error.testCaseWrongTypes`; null item → `error.testCaseInvalid`; nested `direccion`/`tags` → `error.recordNestedValue`; non-object row → `error.recordInvalid`).

## What I tested and results

- Focused test file: `npx vitest run src/services/apiService.test.ts` — 29/29 pass (22 pre-existing + 7 new).
- Full suite: `npx vitest run` — 19 files, 179/179 tests pass.
- `npx tsc --noEmit` — no output, clean.
- `npx eslint src/services/apiService.ts src/services/apiService.test.ts` — no output, clean.

## TDD Evidence

### RED

Command: `npx vitest run src/services/apiService.test.ts` (run immediately after Step 1 dictionary edits + Step 2 test additions, before touching `apiService.ts`'s throw sites)

Result: 6 of the 7 new tests failed, exactly as expected — the module still threw Spanish literal strings with no `params`:

```
 × i18n error keys > validateTestCases throws the missing-fields key with params
   → expected 'El caso de prueba 1 (TC-1) no tiene l…' to be 'error.testCaseMissingFields'
 × i18n error keys > validateTestCases throws the wrong-type key with params
   → expected 'El caso de prueba 1 (TC-1) tiene camp…' to be 'error.testCaseWrongTypes'
 × i18n error keys > validateTestCases throws the invalid-object key with the index
   → expected 'El caso de prueba 2 no es un objeto v…' to be 'error.testCaseInvalid'
 × i18n error keys > validateTestDataRows throws the nested-value key with params
   → expected 'El registro 1 tiene un valor anidado …' to be 'error.recordNestedValue'
 × i18n error keys > validateTestDataRows throws the invalid-record key with the index
   → expected 'El registro 1 no es un objeto válido.' to be 'error.recordInvalid'
 × i18n error keys > extractJsonArray throws error.invalidJson on garbage
   → expected [Function] to throw error including 'error.invalidJson' but got 'La respuesta no es JSON válido...'
 ✓ i18n error keys > every thrown key exists in both dictionaries   (passes — guards Step 1's dictionary work only)

 Test Files  1 failed (1)
      Tests  6 failed | 23 passed (29)
```

This is exactly the expected RED: the 6 behavior-asserting tests fail because the source still throws Spanish text; the dictionary-parity test passes because Step 1 (dictionary keys) was already done.

### GREEN

Command: `npx vitest run src/services/apiService.test.ts` (after Step 4 implementation + Step 5 migration)

Result:
```
 ✓ src/services/apiService.test.ts (29 tests) 36ms

 Test Files  1 passed (1)
      Tests  29 passed (29)
```

Full-suite confirmation: `npx vitest run` → 19 files / 179 tests, all passed.

## Files changed

- `C:\repositorio\ACGen\acgen\src\services\apiService.ts`
- `C:\repositorio\ACGen\acgen\src\services\apiService.test.ts`
- `C:\repositorio\ACGen\acgen\src\i18n\es.json`
- `C:\repositorio\ACGen\acgen\src\i18n\en.json`

Commit: `fa791aa` — "feat(i18n): apiService throws i18n keys with params instead of Spanish literals"

## Self-review findings

- **Completeness**: All 12 throw sites migrated (verified via `git diff` — matches the brief's table line for line, including the correctly-unchanged catch-all at the former line 166). All 7 old Spanish-regex assertions migrated to key+params assertions. Both dictionaries got all 6 new keys in the same position (right after `error.boundary`).
- **Quality**: `i18nError()` helper is a small, single-purpose function colocated with the type it returns, consistent with the module's existing style (no class, no extra abstraction). Names (`I18nError`, `i18nError`, key names) match the brief verbatim.
- **Discipline (YAGNI)**: No changes beyond the 4 named files. Did not touch any tool components' catch blocks (that's Task 2). Did not add a translation call (`t()`) anywhere in `apiService.ts` — the module stays presentation-agnostic, which matches the stated design (raw keys surfacing in the UI post-Task-1 is expected/fine).
- **Testing**: Tests assert real thrown values (`caught.message`, `caught.params`) rather than just "did not throw" — genuine behavioral verification. TDD RED was captured and reviewed before implementing (6 real failures, 1 expected pass). Output is pristine (no warnings/errors) on tsc, eslint, and both vitest runs.
- **Note on unrelated diffs**: `.superpowers/sdd/progress.md` and `.superpowers/sdd/task-1-brief.md` show as modified in the working tree but were **not** touched by me and were **not** staged/committed — left as-is per the brief's explicit file list for `git add`.
- **Note on this report file**: `task-1-report.md` already existed on disk with stale content from an unrelated prior task ("Anonymizer service + tests") reusing the same path; it has been overwritten with this task's report.

## Issues or concerns

None. Implementation matches the brief exactly; all verification commands are clean.

## Fix round 1: HTTP-error i18n keys clobbered by Object.assign

A reviewer found that `Object.assign(i18nError('error.apiKey'), apiError)` (and the same pattern for `error.rateLimit` / `error.modelDecommissioned`) silently overwrote the Error's `.message` with `apiError.message` (the raw upstream Groq text), because `message` is an enumerable own property of the plain `apiError` object and `Object.assign` copies it onto the target, clobbering the i18n key. This violated the task's interface contract that every error thrown by this module has `.message` = i18n key.

### The fix (as approved)

In `src/services/apiService.ts`, destructured `apiError` once before the three status checks and stopped spreading the whole object:

```ts
const { message: upstreamMessage, ...meta } = apiError;

if (response.status === 401) {
  throw Object.assign(i18nError('error.apiKey'), { ...meta, cause: upstreamMessage });
}
if (response.status === 429) {
  throw Object.assign(i18nError('error.rateLimit'), { ...meta, cause: upstreamMessage });
}
if (isModelDecommissioned(apiError.message, response.status)) {
  throw Object.assign(i18nError('error.modelDecommissioned'), { ...meta, cause: upstreamMessage });
}
throw Object.assign(new Error(apiError.message), apiError); // unchanged — dynamic upstream text, not an i18n key
```

`meta` now carries only `{ status, code }` (no `message`), so it can no longer clobber the Error's `.message`. The upstream text is preserved separately as `.cause` for debugging/logging. The `isModelDecommissioned` check still reads `apiError.message` directly (the destructure doesn't mutate `apiError`, only creates new bindings), so that logic is unaffected. The final passthrough throw is untouched, exactly as instructed.

### Tests added

In `src/services/apiService.test.ts`: an `errorResponse(status, message)` helper builds a mocked non-ok `Response` (following the file's existing `sseResponse`/`vi.stubGlobal('fetch', ...)` pattern), and a `captureStreamError(status, message)` helper drives `streamWithGroq` against it, consuming the generator with `gen.next()` inside try/catch and returning the caught error. Added a new `describe('streamWithGroq HTTP errors', ...)` block (with its own `afterEach(() => vi.unstubAllGlobals())`, matching the existing `streamWithGroq deanonymization` block's pattern) with two tests:

- 401 → asserts `err.message === 'error.apiKey'`, `err.status === 401`, `err.cause === 'Invalid Authentication'`
- 429 → asserts `err.message === 'error.rateLimit'`, `err.status === 429`, `err.cause === '<upstream 429 text>'`

### TDD Evidence

**RED** — Command: `npx vitest run src/services/apiService.test.ts` (tests added, fix not yet applied — the buggy `Object.assign(i18nError(...), apiError)` was still in place):

```
 × streamWithGroq HTTP errors > throws error.apiKey on 401, preserving status and the upstream message as cause
   → expected 'Invalid Authentication' to be 'error.apiKey' // Object.is equality
 × streamWithGroq HTTP errors > throws error.rateLimit on 429, preserving status and the upstream message as cause
   → expected 'Rate limit exceeded, please try again later' to be 'error.rateLimit' // Object.is equality

 Test Files  1 failed (1)
      Tests  2 failed | 29 passed (31)
```

This confirms the defect exactly as described: `.message` held the raw upstream Groq text instead of the i18n key.

**GREEN** — Command: `npx vitest run src/services/apiService.test.ts` (after applying the fix):

```
 ✓ src/services/apiService.test.ts (31 tests) 37ms

 Test Files  1 passed (1)
      Tests  31 passed (31)
```

Full-suite / static-analysis confirmation:
- `npx vitest run` → 19 files / 181 tests, all passed.
- `npx tsc --noEmit` → clean, no output.
- `npx eslint src/services/apiService.ts src/services/apiService.test.ts` → clean, no output.

### Files changed (this round)

- `C:\repositorio\ACGen\acgen\src\services\apiService.ts`
- `C:\repositorio\ACGen\acgen\src\services\apiService.test.ts`

Commit: `07aaf61` — "fix(i18n): stop Object.assign from clobbering HTTP error i18n keys"
