Task 1 (3.1.1): complete (commits 7c056d9..5944dfc, review clean)
Task 2 (3.1.2): complete (commits 5944dfc..45d5db1, review clean)
Task 3 (3.1.3): complete (commits 45d5db1..d5b64e8, review clean)
Task 4 (3.2.1): complete (commits d5b64e8..f85cac9, review clean)
Task 5 (3.2.2): complete (commits f85cac9..33d5625, review clean)
Task 6 (3.3): complete (commits 33d5625..9b95b95, review clean with minor notes)
Task 7 (3.4): complete (commits 9b95b95..c90263f, review clean)
Task 8 (3.5): complete (commits c90263f..e295268, review clean)
Task 9 (3.6): complete (commits e295268..720c9a1, review clean)
FINAL: Phase 3 complete (12 commits, 7c056d9..720c9a1, 96 tests, final review: ready to merge with minor items)

== Plan: i18n leftovers (docs/superpowers/plans/2026-07-16-i18n-leftovers.md), branch fix/i18n-leftovers, base 3429409 ==
Task 1: complete (commits 3429409..07aaf61, review clean after 1 fix round — Object.assign clobbered i18n key on HTTP errors, fixed with destructure+cause, human-approved)
  Minor (for final review triage): (a) no direct streamWithGroq test for the modelDecommissioned branch; (b) error.invalidFormat reuse changes wording vs old literal (accepted, plan-mandated); (c) split `import type` statement in apiService.test.ts (cosmetic)
Task 2: complete (commits 07aaf61..3a9f507, review clean)
  Minor (final review triage): params-interpolation branch (e.g. error.testCaseInvalid {n}) untested end-to-end in any tool
  Note: @testing-library/user-event NOT installed — use fireEvent in Tasks 5/6 test code
Task 3: complete (commits 3a9f507..479da68, review clean, no findings)
Task 4: complete (commits 479da68..f0ca544, review clean)
  Minor (final review triage): new react-refresh warning at I18nContext.tsx:16 from exporting the context (plan-mandated, warning not error); task-4-report misattributes it as pre-existing
Task 5: complete (commits f0ca544..9a05584, review clean)
  Minor (final review triage): spec says "closing the modal or clicking elsewhere resets the pending [confirm] state" — reset happens via unmount on close, but clicking elsewhere within the modal does not reset confirmingClear (plan's code shape; spec-vs-plan nit)
Task 6: complete (commits 9a05584..d699b13, review clean)
  Minor (final review triage): BugReportTool market-picker trigger now says "Search..." (common.search) — plan-mandated to preserve the original hardcoded "Buscar...", but arguably odd label for a market picker
Task 7: complete (commits d699b13..b518df4, review clean; 194 tests/24 files verified independently)
FINAL: i18n-leftovers complete (10 commits, 092eaca..b518df4, 194 tests/24 files, final review by opus: READY TO MERGE, all 8 minor findings triaged defer)
  Deferred follow-ups worth remembering: t() replace→replaceAll hardening; params-interpolation e2e test in errorTranslation.test.tsx; hand-maintained key list in apiService.test.ts can rot
