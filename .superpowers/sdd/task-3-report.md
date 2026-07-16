# Task 3.1.3 Report: Wire ConfidentialToggle + AnonymizerReview into all 8 LLM tools

**Status:** DONE

## Summary

Wired `ConfidentialToggle` + `AnonymizerReview` modal into all 8 LLM-powered tool components. Each tool follows the same pattern: imports `anonymize`, `ConfidentialToggle`, `AnonymizerReview`; adds `confMap` state; splits `handleGenerate` into `doGenerate` (API call with optional `anonymizeMap`) and `handleGenerate` (checks confidential mode via localStorage); renders `<ConfidentialToggle>` in the actions bar; renders `<AnonymizerReview>` modal for confirmation when sensitive data is detected.

## Files Modified

| File | View | Tool Type | Effective Input |
|---|---|---|---|
| `AcceptanceCriteriaTool.tsx` | acceptance | criteria | requirements + context + date |
| `TestCaseTool.tsx` | testcase | testcase | input |
| `BugReportTool.tsx` | bugreport | criteria | built via `buildBugReportMessage(formData)` |
| `TestDataTool.tsx` | testdata | testcase | built via `buildTestDataMessage(formData)` |
| `UserStoryTool.tsx` | userstory | criteria | idea |
| `RefinerTool.tsx` | refiner | criteria | requirement |
| `EdgeCaseTool.tsx` | edgecase | testcase | requirement |
| `ConverterTool.tsx` | converter | criteria | prompt built from input + formats |

## Verification

- `npx tsc -b --noEmit` — zero errors
- `npm test` — all **78 tests** passed (6 test files)
- No existing functionality broken — each tool retains original behavior when confidential toggle is off
- SprintTracker excluded (no LLM calls, as specified)

## Concerns

None. Pattern applied consistently across all 8 tools.
