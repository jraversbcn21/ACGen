# Task 1 Report — Guardia: sin URL base no hay enlace (ni URL relativa)

## Status: DONE
## Commit: 94bcda3

## Changes per file

### `src/components/TrackerGrid.tsx`
- `getLinkUrl` (line ~151): in the `linkMode === 'jira'` branch, added an early `if (!baseUrl) return null;` guard before the `TICKET_KEY_PATTERN` match, so no relative `/browse/KEY` URL is ever built when the base URL is unconfigured.
- Cell render (line ~322): added `unconfiguredTicket = ci === 0 && linkMode === 'jira' && !baseUrl && TICKET_KEY_PATTERN.test(value)`.
- `<td title=...>` (line ~336): extended the ternary chain to fall through to `t('sprint.trackerUrlMissing')` when `unconfiguredTicket` is true, `undefined` otherwise.

### `src/components/TrackerGrid.test.tsx`
- Adjusted the existing test `'jira cells keep showing the full value (no name overlay)'`: added `localStorage.setItem('acgen_tracker_base_url', JSON.stringify('https://jira.example.com'));` as its first line, since after the guard an unconfigured base URL would make the cell non-linked (`var(--text)` instead of `var(--accent)`).
- Added `'sin URL base, la celda de ticket no es enlace ni abre nada con ctrl+click'`: renders a ticket cell with no base URL configured, ctrl+clicks it, asserts `window.open` is never called and the input color is `var(--text)`.
- Added `'sin URL base, la celda de ticket muestra el hint de configuración en el title'`: asserts the `<td>` has `title="Configura la URL del tracker (⚙) para abrir tickets"`.

### `src/i18n/es.json` / `src/i18n/en.json`
- Added `"sprint.trackerUrlMissing"` right after `"sprint.openTicket"` in both files (es: "Configura la URL del tracker (⚙) para abrir tickets", en: "Set the tracker URL (⚙) to open tickets"), keeping key parity between the two dictionaries.

## TDD evidence

**RED** — `npx vitest run src/components/TrackerGrid.test.tsx` before implementing (Step 3):
```
✓ jira cells keep showing the full value (no name overlay)   <- passed after test adjustment
× sin URL base, la celda de ticket no es enlace ni abre nada con ctrl+click
  → expected "bound " to not be called at all, but actually been called 1 times
  Received: 1st call: ["/browse/ABC-123", "_blank", "noopener,noreferrer"]
× sin URL base, la celda de ticket muestra el hint de configuración en el title
  → Expected title="Configura la URL del tracker (⚙) para abrir tickets"
    Received title="Abrir ABC-123 en el tracker"

Test Files  1 failed (1)
     Tests  2 failed | 20 passed (22)
```
Both failures matched the brief's predicted reasons exactly: `getLinkUrl` still returned `/browse/ABC-123` (so `window.open` fired) and the title still resolved to `sprint.openTicket` (not the missing-hint key) because `ticketKey` was truthy without the guard.

**GREEN** — after implementing Steps 4-5, `npx vitest run src/components/TrackerGrid.test.tsx src/i18n/keyParity.test.ts`:
```
✓ src/i18n/keyParity.test.ts (2 tests)
✓ src/components/TrackerGrid.test.tsx (22 tests)

Test Files  2 passed (2)
     Tests  24 passed (24)
```

Full suite sanity check — `npx vitest run` (all files): **40 files passed, 378 tests passed**, no regressions.

## Decisions made
- Ran the full test suite (`npx vitest run`, 378 tests / 40 files) in addition to the brief's targeted command, as a pre-commit sanity check — no code outside the brief's scope was touched as a result.
- `.superpowers/sdd/task-1-brief.md` shows as modified in `git status` — a large diff against the committed HEAD version, pre-existing before this session started (it looks like an earlier/different "Task 1" — an extraction refactor — was renumbered or superseded by this guard task). Not touched by me; correctly excluded from the commit since Step 7's `git add` list names only the 4 implementation/test/i18n files.
- This report file (`task-1-report.md`) also contained a stale report from that earlier extraction-refactor task; overwritten with this task's report per the current instructions.
