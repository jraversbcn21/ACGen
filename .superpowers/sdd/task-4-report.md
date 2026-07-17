# Task 4 Report: Componente `RegressionTracker` + claves i18n + constante de anchos

## Implementation Summary

Successfully implemented the `RegressionTracker` component with full i18n support and storage key constant. The component provides three screens: active board (with 4 platform tabs), archived regressions list (with snapshots in read-only mode), and individual snapshot viewers.

## What Was Implemented

### 1. Storage Key Constant
- Added `REGRESSION_COL_WIDTHS: 'acgen_regression_col_widths'` to `STORAGE_KEYS` in `src/config/constants.ts` (line 75)

### 2. Internationalization Keys
Added 12 new i18n keys to both `src/i18n/es.json` and `src/i18n/en.json`:
- `landing.tool.regressiontracker` / `landing.tool.regressiontrackerDesc` (tool listing)
- `sidebar.regression` (sidebar label)
- `regression.title` (component header)
- `regression.archive` (archive button)
- `regression.archiveConfirm` (confirmation dialog)
- `regression.archivedList` (archived screen header)
- `regression.archivedBadge` (badge label)
- `regression.deleteConfirm` (delete confirmation)
- `regression.noArchived` (empty state)
- `regression.searchPlaceholder` (grid search hint)

Note: `regression.openLink` already existed from Task 2 — not duplicated.

### 3. Component: RegressionTracker
- Created `src/components/RegressionTracker.tsx` (141 lines)
- Manages three screens via `Screen` union type:
  - **Board screen** (default): Shows active regression board with 4 platform tabs (iOS, Android, Web-Desktop, Web-Mobile), archive button, and conditional "Archived" button when snapshots exist
  - **Archived List screen**: Displays all archived snapshots as clickable cards with delete option and empty state
  - **Snapshot screen** (read-only): Opens individual archive with back button, badge, and non-editable grid

- Key features:
  - Integrates `TrackerGrid` with `linkMode="url"` and `colWidthsStorageKey={STORAGE_KEYS.REGRESSION_COL_WIDTHS}`
  - Archive functionality: prompts user, snapshots the current board (with timestamp name), clears active board, updates archived list
  - Delete archived snapshots with confirmation
  - Uses `useRegressions()` hook for state management
  - Uses `useT()` for i18n
  - Formatted date display for archived snapshots (dd/mm/yyyy format via `es-ES` locale)

### 4. Component Tests
- Created `src/components/RegressionTracker.test.tsx` with 6 tests covering all scenarios

## Test Results

### RED Phase
```
npm test -- src/components/RegressionTracker.test.tsx
Failed to resolve import "./RegressionTracker" from "src/components/RegressionTracker.test.tsx"
Expected: Component file did not exist yet ✓
```

### i18n Parity Test
```
npm test -- src/i18n/keyParity.test.ts
✓ 2 tests passed (verifying es.json and en.json have matching keys)
```

### GREEN Phase (Component Tests)
```
npm test -- src/components/RegressionTracker.test.tsx
✓ 6 tests passed ✓
Test Files: 1 passed
Tests: 6 passed
```

### Full Test Suite
```
npm test
✓ Test Files: 30 passed (30)
✓ Tests: 254 passed (254)
Expected total: 254 ✓
```

## Files Changed

1. src/config/constants.ts (1 line added)
2. src/i18n/es.json (12 lines added)
3. src/i18n/en.json (12 lines added)
4. src/components/RegressionTracker.tsx (141 lines, NEW)
5. src/components/RegressionTracker.test.tsx (79 lines, NEW)

## Commit

aa497f9 feat(regression): RegressionTracker board, archived snapshots UI and i18n

## Self-Review Findings

- [x] Every step from brief followed in order
- [x] RED phase: Tests fail with expected error
- [x] i18n keyParity: Both files pass, no duplicated regression.openLink
- [x] GREEN phase: All 6 component tests pass
- [x] Full test suite: All 254 tests pass
- [x] Output pristine: No linting issues
- [x] YAGNI: Only brief's exact code used
- [x] Files touched: Only those specified
- [x] Commit message follows brief exactly

Status: DONE
