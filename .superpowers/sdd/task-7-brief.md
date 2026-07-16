### Task 7: Key-parity guard, full verification, AGENTS.md sync

**Files:**
- Create: `src/i18n/keyParity.test.ts`
- Modify: `AGENTS.md` (Known issues item 1 removed + renumber; test table; evolution row)

**Interfaces:** none.

- [ ] **Step 1: Write the parity test**

`src/i18n/keyParity.test.ts`:

```ts
import es from './es.json';
import en from './en.json';

describe('i18n dictionaries', () => {
  it('es and en have exactly the same keys', () => {
    const esKeys = Object.keys(es).sort();
    const enKeys = Object.keys(en).sort();
    expect(esKeys).toEqual(enKeys);
  });

  it('every {param} placeholder in es exists in en and vice versa', () => {
    const params = (s: string) => (s.match(/\{[a-zA-Z]+\}/g) ?? []).sort();
    for (const key of Object.keys(es)) {
      expect(params((en as Record<string, string>)[key] ?? ''), `param mismatch in ${key}`).toEqual(params((es as Record<string, string>)[key]));
    }
  });
});
```

This is an invariant guard, not a behavior change — it is expected to PASS immediately (parity holds today). If it fails, a previous task drifted: fix the dictionaries, not the test.

- [ ] **Step 2: Full verification**

```bash
npx vitest run          # expect: all tests pass, count > 172
npx tsc --noEmit        # expect: silent
npx eslint src          # expect: 0 errors
npm run build           # expect: build OK
```

- [ ] **Step 3: Update AGENTS.md**

- "Known issues": delete item 1 (i18n leftovers), renumber 2→1, 3→2, 4→3. Update the intro sentence's PR list to include this branch's PR.
- Test table: add rows for the new test files (`errorTranslation`, `ExportBar`, `ErrorBoundary` delta, `HistoryModal`, `SearchableSelect`, `keyParity`, apiService delta) and update the total line with the real count from Step 2's output.
- Evolution history: add a row `| i18n completion | 2026-07-16 | apiService throws i18n keys + params (I18nError), translated at tool catch blocks; ExportBar, ErrorBoundary (contextType), HistoryModal (+ inline 2-step confirm replacing the last window.confirm), SearchableSelect. Key-parity guard test. |`
- Also remove the now-stale claim (if present) that 7 `error.*` keys sit unused.

- [ ] **Step 4: Commit**

```bash
git add src/i18n/keyParity.test.ts AGENTS.md
git commit -m "test(i18n): key-parity guard; docs: sync AGENTS.md after i18n completion"
```

---

## Self-Review Notes

- Spec coverage: apiService (Task 1), catch blocks (Task 2), ExportBar (Task 3), ErrorBoundary (Task 4), HistoryModal + confirm upgrade (Task 5), SearchableSelect + call sites (Task 6), parity test + docs (Task 7). All spec rows covered.
- The spec's "placeholder becomes a required prop" was refined during planning: SearchableSelect already had an optional trigger `placeholder`; the hardcoded string was the **search input**. Resolved as a new optional `searchPlaceholder` prop + translated defaults for everything (trigger, search, empty) — no breaking prop change needed.
- Deliberate minor UX change (Task 6): BugReportTool's market search input previously implied "Buscar mercado..." via the component's hardcoded string while its trigger said "Buscar..."; both now come from keys, trigger `common.search`, search `common.searchMarket`.
