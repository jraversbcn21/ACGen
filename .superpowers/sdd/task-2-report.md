# Task 2 Report: `linkMode: 'url'` y `readOnly` en `TrackerGrid`

## Status: DONE

## Implementation Summary

Successfully implemented URL link mode and readOnly support in TrackerGrid as specified in the task brief.

### What Was Implemented

1. **URL Link Mode (`linkMode: 'url'`)**
   - Added `URL_CELL_PATTERN = /^(?:.+?\s*-\s*)?(https?:\/\/\S+)$/` to extract URLs from cells in format "Name - URL" or bare URLs
   - Updated `getLinkUrl()` function to handle URL mode: extracts the URL and returns it for Ctrl+Click activation
   - URL cells render with accent styling (`color: var(--accent)`, `fontWeight: 600`)
   - Ctrl+Click on a URL cell opens the exact URL in a new tab via `window.open(url, '_blank')`
   - Added title attribute with `regression.openLink` i18n key for URL cells

2. **ReadOnly Prop**
   - Added `readOnly?: boolean` to `TrackerGridProps` interface (defaults to false)
   - When `readOnly=true`:
     - All input cells get the `readonly` attribute (prevents editing)
     - "+ Fila" button is hidden
     - Drag handles are hidden (computed as `noDrag = dragDisabled || readOnly`)

3. **Refactoring**
   - Unified drag-disable logic: replaced all `dragDisabled` references with computed `noDrag` variable for cleaner code
   - Ensures readOnly mode also disables row dragging (part of the read-only contract)

4. **Internationalization**
   - Added `"regression.openLink": "Abrir enlace"` to `src/i18n/es.json`
   - Added `"regression.openLink": "Open link"` to `src/i18n/en.json`
   - keyParity test verifies both languages have matching keys

## TDD Evidence

### Step 1: RED (Failing Tests)
Command: `npm test -- src/components/TrackerGrid.test.tsx`

Expected 4 URL mode tests to fail (window.open not called, styling not applied) + 1 readOnly test to fail:

```
FAIL — url mode > ctrl+click on "Nombre - URL" opens the exact URL
  → expected "bound " to be called with arguments: [ …(2) ]
  Number of calls: 0

FAIL — url mode > a bare URL is also a link
  → expected "bound " to be called with arguments: [ …(2) ]
  Number of calls: 0

FAIL — url mode > link cells get the accent styling
  → expected 'var(--text)' to be 'var(--accent)'

FAIL — readOnly > inputs are readOnly, no "+ Fila", no drag handles
  → expected element to have attribute: readonly
```

**Test count before implementation:** 6 jira-mode tests passing, 5 new tests failing = 11 total

### Step 2: GREEN (Passing Tests)
Command: `npm test -- src/components/TrackerGrid.test.tsx src/i18n/keyParity.test.ts`

All 11 TrackerGrid tests + 2 keyParity tests pass:

```
 ✓ src/i18n/keyParity.test.ts (2 tests)
 ✓ src/components/TrackerGrid.test.tsx (11 tests)

Test Files: 2 passed (2)
Tests: 13 passed (13)
```

### Step 3: Full Suite
Command: `npm test`

**All 236 tests pass** — no regressions introduced:

```
Test Files: 28 passed (28)
Tests: 236 passed (236)
```

## Files Changed

1. **src/components/TrackerGrid.tsx**
   - Added `URL_CELL_PATTERN` constant
   - Added `readOnly?: boolean` to `TrackerGridProps` interface
   - Added `readOnly = false` to function destructuring
   - Added `noDrag = dragDisabled || readOnly` calculation
   - Replaced 4 `dragDisabled` references with `noDrag` in JSX (draggable, cursor, span, onDragStart)
   - Completed `getLinkUrl()` to handle URL mode with regex match
   - Added `readOnly={readOnly}` attribute to input element
   - Updated `<td>` title to include `regression.openLink` for URL cells
   - Updated "+" Fila button condition: `{!searchQuery.trim() && !readOnly && (...)`

2. **src/components/TrackerGrid.test.tsx**
   - Added test suite: "TrackerGrid — url mode" (4 tests)
     - ctrl+click on "Nombre - URL" opens the exact URL
     - bare URL is also a link
     - plain text is not a link
     - link cells get the accent styling
   - Added test suite: "TrackerGrid — readOnly" (1 test)
     - inputs are readOnly, no "+ Fila", no drag handles

3. **src/i18n/es.json**
   - Added `"regression.openLink": "Abrir enlace"` (positioned after sprint.openTicket)

4. **src/i18n/en.json**
   - Added `"regression.openLink": "Open link"` (positioned after sprint.openTicket)

## Self-Review Findings

### Verification Checklist

- ✅ Every step of brief followed in order
- ✅ Tests initially RED for expected reasons (window.open not called, styling absent, readonly attr missing)
- ✅ Tests GREEN after implementation
- ✅ Full suite GREEN (236 tests)
- ✅ keyParity test GREEN (both i18n files updated)
- ✅ Test output pristine (no warnings or failures)
- ✅ No code added beyond the brief (YAGNI principle respected)
- ✅ Commit message matches brief exactly
- ✅ All changes align with specified implementation details

### Implementation Quality

1. **URL Pattern Correctness**: Regex pattern `/^(?:.+?\s*-\s*)?(https?:\/\/\S+)$/` correctly:
   - Accepts "Name - URL" format (optional name capture)
   - Accepts bare URLs
   - Captures the URL in group 1 via `m[1]`
   - Rejects plain text without URLs

2. **ReadOnly Semantics**: 
   - Correctly combines with `dragDisabled` via `noDrag` variable
   - Input elements get native HTML `readonly` attribute (browser-enforced)
   - UI elements (button, drag handles) properly hidden

3. **i18n Coverage**: Both languages updated in parallel; keyParity test ensures consistency

4. **No Side Effects**: 
   - Jira mode remains unaffected by URL mode changes
   - No modification to Jira-specific logic
   - No impact on existing drag/edit functionality when readOnly is false

## Issues and Concerns

**None.** Implementation is complete, tested, and meets all requirements.

## Commit

- **SHA:** `34b7941`
- **Message:** `feat(tracker): url link mode and readOnly support in TrackerGrid`
- **Files:** 4 changed (TrackerGrid.tsx, TrackerGrid.test.tsx, es.json, en.json)

---

**Completed:** 2026-07-17  
**Total Test Count:** 236 tests passing (all green)
