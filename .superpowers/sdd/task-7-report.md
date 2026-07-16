# Task 3.4: Customizable Prompts — Report

**Status:** Complete
**Commit:** `c90263fcd90056dfc11e091128d3822ae9028491`
**Date:** 2026-07-16

## Summary

Implemented customizable prompts with `getPrompt()`, `PromptEditor` component, and per-tool localStorage overrides.

## Files Modified

| File | Change |
|---|---|
| `src/config/constants.ts` | Added `DEFAULT_PROMPTS` map |
| `src/services/apiService.ts` | Added `getPrompt()` function with localStorage override |
| `src/components/PromptEditor.tsx` | **Created** — modal editor for all 8 tool prompts |
| `src/components/Sidebar.tsx` | Added "Prompts" button in footer, wired `PromptEditor` |
| `src/components/AcceptanceCriteriaTool.tsx` | Switched from `HARDCODED_PROMPT` to `getPrompt('acceptance')` |
| `src/components/TestCaseTool.tsx` | Switched from `TESTCASE_PROMPT` to `getPrompt('testcase')` |
| `src/components/BugReportTool.tsx` | Switched from `BUG_REPORT_PROMPT` to `getPrompt('bugreport')` |
| `src/components/TestDataTool.tsx` | Switched from `TEST_DATA_PROMPT` to `getPrompt('testdata')` |
| `src/components/UserStoryTool.tsx` | Switched from `USER_STORY_PROMPT` to `getPrompt('userstory')` |
| `src/components/RefinerTool.tsx` | Switched from `REFINER_PROMPT` to `getPrompt('refiner')` |
| `src/components/EdgeCaseTool.tsx` | Switched from `EDGE_CASE_PROMPT` to `getPrompt('edgecase')` |
| `src/components/ConverterTool.tsx` | Switched from `CONVERTER_PROMPT` to `getPrompt('converter')` |

## Verification

- `npx tsc -b --noEmit` — **zero errors**
- `npm test` — **90 tests passed** (7 test files, all green)

## Notes

- `sidebar.prompts` i18n key was already present in both `es.json` and `en.json`
- PromptEditor reuses existing CSS classes (`modal-overlay`, `modal-content`, `btn-primary`, `btn-ghost`, `field-textarea`)
- Overridden tools show an asterisk (`*`) indicator in the editor tab
- localStorage prefix: `acgen_prompt_<tool>` (e.g., `acgen_prompt_acceptance`)
