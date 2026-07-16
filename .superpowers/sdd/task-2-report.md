# Task 3.1.2 Report — Anonymizer UI components + API integration

## Status: DONE

## What was implemented

### Files created
- `src/components/AnonymizerReview.tsx` — Modal component that displays the anonymization substitution map and allows users to review/edit placeholders before sending
- `src/components/ConfidentialToggle.tsx` — Checkbox toggle using `useLocalStorage` (per-view persistence) with a "N sustituciones — Revisar" button when enabled and substitutions are detected
- Added `modal-overlay` and `modal-content` CSS classes to `src/App.css` (fixed z-layer, background blur overlay, surface styling)

### Files modified
- `src/services/apiService.ts`:
  - Added `import { deanonymize } from './anonymizer'`
  - Added optional `anonymizeMap?: Record<string, string>` parameter to `streamWithGroq()`
  - Modified streaming token yield loop to call `deanonymize(rawToken, anonymizeMap)` when `anonymizeMap` is provided; passes raw token through unchanged otherwise (backward compatible)

## Verification

### Type check
```
npx tsc -b --noEmit
```
Result: **Zero errors**

### Test results
```
npm test
```
Result: **6 test files, 78 tests — all passed**
- `src/services/anonymizer.test.ts` — 13 tests ✓
- `src/services/apiService.test.ts` — 17 tests ✓
- `src/hooks/useHistory.test.ts` — 11 tests ✓
- `src/hooks/useLocalStorage.test.ts` — 14 tests ✓
- `src/hooks/useSprints.test.ts` — 20 tests ✓
- `src/components/ErrorBoundary.test.tsx` — 3 tests ✓

## Commit
- `01a1db6` — `feat(confidential): AnonymizerReview modal, ConfidentialToggle, API deanonymization`

## Self-review
- The `anonymizeMap` parameter is backward-compatible (optional); all existing callers of `streamWithGroq` continue to work without changes
- Components are not yet wired into any tool — that is Task 3.1.3
- The `modal-overlay` and `modal-content` CSS classes were missing from `App.css` and were added as part of this task

## Concerns
None. All type checks and tests pass. Components and API integration are ready for wiring in Task 3.1.3.

## Fix: Defer onConfirm to useEffect (AnonymizerReview)

**Date:** 2026-07-16

**Problem:** `AnonymizerReview.tsx` called `onConfirm(map)` directly during render when `entries.length === 0`. This is a React anti-pattern — calling a parent state updater during a child's render triggers React warnings and can cause inconsistent state.

**Fix:** Wrapped the `onConfirm(map)` call in a `useEffect` with an empty dependency array (`[]`), so it fires after mount rather than during render. Added `eslint-disable-line react-hooks/exhaustive-deps` to suppress the missing-deps lint warning (the intent is one-time check on mount).

```diff
- import { useState } from 'react';
+ import { useEffect, useState } from 'react';

-   if (entries.length === 0) {
-     onConfirm(map);
-     return null;
-   }
+   useEffect(() => {
+     if (entries.length === 0) {
+       onConfirm(map);
+     }
+   }, []); // eslint-disable-line react-hooks/exhaustive-deps
```

**Verification:**
- `npx tsc -b --noEmit` — zero errors
- `npm test` — 6 test files, 78 tests — all passed
