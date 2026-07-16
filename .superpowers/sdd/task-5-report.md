# Task 5: HistoryModal — i18n + inline 2-step confirm

**Status:** DONE

**Commit:** `9a05584` — feat(i18n): translate HistoryModal and replace window.confirm with inline 2-step confirm

---

## Implementation Summary

Completed full TDD cycle: RED → GREEN → verification.

### Changes Made

1. **Dictionary keys** (5 new keys added to both `es.json` and `en.json`):
   - `history.title` — "Historial" / "History"
   - `history.clearAll` — "Borrar todo" / "Clear all"
   - `history.confirmClear` — "¿Confirmar borrado?" / "Confirm deletion?"
   - `history.empty` — "No hay entradas..." / "No history entries yet."
   - `history.load` — "Cargar" / "Load"

2. **HistoryModal component** (`src/components/HistoryModal.tsx`):
   - Added `useState(false)` for `confirmingClear` state
   - Imported `useT` from I18nContext
   - Replaced all hardcoded Spanish strings with `t()` calls
   - Implemented 2-step confirm pattern: first click arms the button (shows confirm label), second click executes `onClearAll()`
   - Button label toggles between `history.clearAll` and `history.confirmClear` based on state
   - Close button now uses `t('common.close')` for accessibility label

3. **Test file** (`src/components/HistoryModal.test.tsx`):
   - Created new test suite with 3 test cases
   - Used `fireEvent.click()` instead of `userEvent.click()` (per amendment)
   - Fixture verified against actual `HistoryEntry` type (all fields match)
   - Tests cover:
     - 2-step confirm flow (first click sets state, second calls onClearAll)
     - English language rendering
     - Empty state translation

---

## TDD Evidence

### RED Phase
```
npx vitest run src/components/HistoryModal.test.tsx
Result: 3 FAILED
- "clear-all requires a second confirming click" — Unable to find "¿Confirmar borrado?" button
- "renders in English" — Unable to find "History" text
- "shows the translated empty state" — Unable to find "No history entries yet."
```

### GREEN Phase
```
npx vitest run src/components/HistoryModal.test.tsx
Result: 3 PASSED (140ms)
✓ HistoryModal (3 tests) 140ms
  Test Files: 1 passed (1)
  Tests: 3 passed (3)
```

### Full Test Suite
```
npm run test
Result: 189 PASSED across 22 test files (19.74s)
- All existing tests continue to pass
- HistoryModal.test.tsx: 3 PASSED
- No regressions
```

### Type Checking & Linting
```
npx tsc --noEmit         → No errors
npx eslint *.tsx         → No errors
```

---

## Self-Review

✓ **Faithfulness to brief:** Component implementation exactly matches Step 4 code spec

✓ **Dictionary completeness:** All 5 keys added to both es.json and en.json

✓ **Test amendment compliance:** Used fireEvent.click() as instructed

✓ **Fixture validation:** Verified HistoryEntry type matches test fixture

✓ **2-step confirm logic:** Clean state flow, no edge cases

✓ **Accessibility:** aria-label on close button now dynamic via t('common.close')

✓ **Quality gates:** All tests pass, no TypeScript errors, no ESLint violations

---

## Files Changed

- `src/components/HistoryModal.tsx` — i18n + 2-step confirm refactor
- `src/components/HistoryModal.test.tsx` — New test suite (3 tests)
- `src/i18n/es.json` — 5 new history.* keys
- `src/i18n/en.json` — 5 new history.* keys

**Total:** 4 files changed, 80 insertions, 8 deletions

---

## Test Coverage

| Test | Expected | Result |
|------|----------|--------|
| 2-step confirm (1st click) | state true, confirm label visible | ✓ PASS |
| 2-step confirm (2nd click) | onClearAll() called once | ✓ PASS |
| English rendering | "History", "Clear all", "Load", "Close" visible | ✓ PASS |
| Empty state i18n | Uses t('history.empty') | ✓ PASS |
| Full suite (189 tests) | No regressions | ✓ PASS |

---

## Concerns

None identified. Implementation complete and verified.
