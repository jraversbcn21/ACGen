## Task 3.2.2: WorkspacePicker UI + wire into App

**Status:** Complete

### Commit
- SHA: `33d56257bf83bfec8a797761adb48e29cdcb4908`
- Message: `feat(workspaces): WorkspacePicker UI, Header/Sidebar/App integration, auto-save artifacts`

### Test Summary
- **7 test files, 90 tests — all passing**
- Existing tests: `apiService.test.ts` (17), `useSprints.test.ts` (20), `useLocalStorage.test.ts` (14), `useHistory.test.ts` (11), `ErrorBoundary.test.tsx` (3), `anonymizer.test.ts` (13)
- New: `useWorkspace.test.ts` (12 — from Task 3.2.1)

### Type Check
- `npx tsc -b --noEmit` — zero errors

### Changes Made

**Created:**
- `src/components/WorkspacePicker.tsx` — Workspace selector dropdown with create, select, rename, delete, export, and import actions

**Modified to add `onSaveArtifact` prop:**
- `src/components/AcceptanceCriteriaTool.tsx` — calls `onSaveArtifact(effectiveInput, fullText)` after `setCriteria`
- `src/components/TestCaseTool.tsx` — calls after `setTestCases`
- `src/components/BugReportTool.tsx` — calls after `setOutput`
- `src/components/TestDataTool.tsx` — calls after `setGeneratedData`
- `src/components/UserStoryTool.tsx` — calls after `setResult`
- `src/components/RefinerTool.tsx` — calls after `setResult`
- `src/components/EdgeCaseTool.tsx` — calls after `setEdgeCases`
- `src/components/ConverterTool.tsx` — calls after `setResult`

**Modified for integration:**
- `src/components/Header.tsx` — Added workspace props + `<WorkspacePicker>` rendered next to model chip
- `src/components/Sidebar.tsx` — Added `activeWorkspaceName` prop + WS label at top
- `src/App.tsx` — Added `useWorkspace` hook, `saveArtifact` callback, wired all props to Header/Sidebar and `onSaveArtifact` to all 8 LLM tools

### Concerns
- None
