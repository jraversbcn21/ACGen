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

== Plan: regression tracker (docs/superpowers/plans/2026-07-17-regression-tracker.md), branch feat/regression-tracker, base 34fcae6 ==
Task 1: complete (commits 34fcae6..b8f6fd9, review clean after report repair — stale report file from previous plan, code was fine)
Task 2: complete (commits b8f6fd9..34b7941, review clean)
  Minor (final review triage): (a) no test asserts the title attr regression.openLink on url-link cells; (b) url mode has no paste transform (plain paste, brief-scoped); (c) drag handlers stay attached under noDrag, inert since draggable=false (pre-existing from Task 1)
Task 3: complete (commits 34b7941..fce1c1b, review clean)
  Minor (final review triage): (a) persist() called inside setState updaters — impure updater, 2x writes under StrictMode dev; plan-mandated pattern inherited from useSprints; (b) no test for defensive platform-merge inside archived snapshots (top-level board merge is tested)
Task 4: complete (commits fce1c1b..aa497f9, review clean)
  Minor (final review triage): (a) task-4-report miscounts (says 12 i18n keys, real 11; says 141 lines, real 154) — docs only; (b) three screen branches repeat the same inline header-row style block (plan-mandated verbatim code)
Task 5: complete (commits aa497f9..6e67098, review clean, no findings)
Task 6: complete (commits 6e67098..253122f + fix 1eccaaa, review clean after 1 fix round — added missing per-tool subsection, "No (offline)" wording, Evolution history row)
FINAL: regression-tracker complete (10 commits, f9b57a3..81c6716, 254 tests/30 files, e2e browser verification PASS, final review by fable: READY TO MERGE after 1 fix — window.open noopener,noreferrer)
  Deferred follow-ups: readOnly resize writes shared widths key; empty-board archive allowed; formatDate UTC/es-ES quirk (shared with SprintList); AGENTS.md "220 keys" stale (real 236); inherited exhaustive-deps lint warning in TrackerGrid; no drag-drop presence test; persist-in-updater cleanup for both hooks; scroll retained on hash navigation (pre-existing, all tools)

== Plan: backup-persistence (C:/Users/jorge.carreno_amaris/.claude/plans/act-a-como-un-software-wild-yeti.md), branch feat/backup-persistence, base a9d1b2e ==
Task 1: complete (commits a9d1b2e..1a8c2da, review clean, 275 tests)
  Minor (final review triage): (a) snapshotCurrentState/applySnapshot duplican el loop de claves acgen_*; (b) parseImportFile acepta exportedAt ausente/no-string (defaultea a "") sin test; (c) rollback anidado (quota durante applySnapshot) lanzaria, caso teorico
Task 2: complete (commits 1a8c2da..825dcc1, review clean, 293 tests)
  Minor (final review triage): (a) useBackupReminder lee acgen_last_backup via useLocalStorage generico sin la validacion de getLastBackupAt (brief-mandated, trigger solo por tampering manual); (b) sin test del limite exacto de 7 dias
Task 3: complete (commits 825dcc1..60d1c9a, review clean, 306 tests; 3 commits, extra test commit aceptado)
  Minor (final review triage): (a) rama location.reload() por defecto sin cobertura (helper de test siempre pasa onRestored); (b) test de quota no asserta rollback de datos, solo UI; (c) sin test de cierre de panel tras export; (d) reuso de clase theme-toggle en el trigger - revisar visualmente en Task 4
Task 4: complete (commits 60d1c9a..fe93363, review clean sin hallazgos, 308 tests)
Task 5: complete (commits fe93363..42aa93f, review approved tras 1 fix round — writeSnapshot podia lanzar si queryPermission rechazaba; movido dentro del try + test regresion, 326 tests)
  Minor (final review triage): (a) openDb nunca llama db.close(); (b) ramas fallback de ensurePermission sin queryPermission/requestPermission no testeadas; (c) _stores del fake IDB expuesto pero nunca leido
Task 6: complete (commits 42aa93f..19fec8c, review approved tras 1 fix round — race: snapshot en vuelo resucitaba active tras disable(); guard por identidad de handle + 2 tests deferred, 340 tests)
  Minor (final review triage): (a) reconnect() sin test dedicado (exito ni fallo); (b) fallo del snapshot inmediato de enable() solo testeado via debounce; (c) queryPermission?. optional chaining no anunciado (funcionalmente ok)
Task 7: complete (commit 0e7e13f, re-creado por el controlador: el implementador habia barrido progress.md del ledger en su commit ce45b30; código aprobado spec-tight, 343 tests)
  Minor (final review triage): line counts del report imprecisos (cosmetico)
Task 8 (docs): complete (commit 5e8844c, README seccion "Copia de seguridad" + AGENTS.md sync, contadores reales 343/36/214 verificados)
FINAL: backup-persistence complete (18 commits, a9d1b2e..e14d165, 345 tests/36 files, final review by opus: 1 CRITICAL encontrado y arreglado (bucle infinito snapshot->markDone->CustomEvent->snapshot, roto filtrando detail.key===acgen_last_backup en useAutoBackup) + 1 Important (legacy import throw sin feedback, try/catch+importError), re-review: READY TO MERGE. 15 minors triados: todos defer. Smoke e2e Chrome real vs build de prod: 15/15 PASS (export sin keys, import restaura datos borrados, key local preservada, badge lifecycle, seccion FSA presente). Verificado por controlador: vitest 345/345, tsc 0, lint 0 err, build OK.
  Deferred follow-ups: loops de collect duplicados en backup.ts; exportedAt sin validar; openDb sin db.close(); due estatico en sesion larga; reconnect() sin test dedicado; hooks de dominio no disparan CustomEvent (snapshot diferido al siguiente evento, documentado en AGENTS.md)
