## Task 6c Report — i18n Part 3: Tool Components Refactor

**Status:** Complete  
**Commit:** `9b95b95`  
**Test Summary:** 90/90 passed (7 files)  
**Type Check:** 0 errors

### Files Modified

| File | Changes |
|---|---|
| `src/i18n/es.json` | +33 new keys (acceptance, testcase, bugreport, testdata, sprint, error) |
| `src/i18n/en.json` | +33 new keys (English equivalents) |
| `src/components/AcceptanceCriteriaTool.tsx` | +useT import, t() for placeholders, buttons, error, toast |
| `src/components/TestCaseTool.tsx` | +useT import, moved INPUT_PLACEHOLDER to t(), table headers, export functions, buttons |
| `src/components/BugReportTool.tsx` | +useT import, all form labels/placeholders, dynamic platform labels, buttons |
| `src/components/TestDataTool.tsx` | +useT import, form labels/placeholders, output labels, buttons, row copy |
| `src/components/UserStoryTool.tsx` | +useT import, placeholder, error, clear toast, clear button |
| `src/components/RefinerTool.tsx` | +useT import, placeholder, error, clear toast, clear button |
| `src/components/EdgeCaseTool.tsx` | +useT import, placeholder, table headers, error, clear toast, clear button |
| `src/components/ConverterTool.tsx` | +useT import, format labels, placeholders, error, clear toast, clear button |
| `src/components/SprintTracker.tsx` | +useT import, archive confirm, back button, archived badge, title |
| `src/components/SprintDashboard.tsx` | +useT import, search placeholder, row count, open ticket tooltip, add row, archive button |
| `src/components/SprintList.tsx` | +useT import (SprintList + SprintCard), all labels, buttons, empty state, delete confirm |

### New i18n Keys Added

```
acceptance.additionalContextPlaceholder, acceptance.copyCriteria
testcase.key, testcase.summary, testcase.instructions, testcase.generatedCases
bugreport.apkVersion, bugreport.buildVersion, bugreport.androidVersion, bugreport.iosVersion
bugreport.notesPlaceholder, bugreport.apkPlaceholder, bugreport.androidPlaceholder, bugreport.iosPlaceholder
testdata.copyAllTable, testdata.generatedData
sprint.create, sprint.deleteConfirm, sprint.archiveConfirm, sprint.noSprints
sprint.addRow, sprint.searchPlaceholder, sprint.namePlaceholder, sprint.enCurso, sprint.openTicket
error.noEdgeCases
```

### Verification

- `npx tsc -b --noEmit` — zero errors
- `npm test` — 90/90 passed
- All existing behavior preserved; only Spanish UI strings replaced with t() calls
