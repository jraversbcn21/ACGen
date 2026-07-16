# i18n leftovers — design

**Date:** 2026-07-16
**Status:** approved
**Origin:** AGENTS.md "Known issues" item 1 (post-Fase 3 audit). Hardcoded Spanish survives in 5 places outside the audited components; 7 `error.*` keys in `es.json`/`en.json` sit dead because `apiService.ts` throws literal Spanish strings.

## Goal

English users see English everywhere the UI already claims to be bilingual: export buttons, error messages (validation and API), the crash fallback, the history modal, and select placeholders. No behavior change except one deliberate upgrade (HistoryModal's `window.confirm` → inline 2-step confirm, decided with Jorge).

## Non-goals

- LLM prompts stay Spanish (by design, documented in AGENTS.md).
- `useStreamingResponse`'s internal `'Error inesperado'` fallback string stays — it lives in state no consumer reads since the rethrow fix; tools produce their own translated message.
- No new languages, no key renames of existing live keys.

## Design decisions (settled with Jorge)

1. **`apiService.ts` throws i18n keys, translation happens at the render boundary.**
   The service stays language-agnostic. Errors carry interpolation params on the Error object:

   ```ts
   export type I18nError = Error & { params?: Record<string, string | number> };

   throw Object.assign(new Error('error.testCaseMissingFields'), {
     params: { n: i + 1, key: tc.key || `#${i + 1}`, fields: missing.join(', ') },
   });
   ```

   Tool catch blocks (which already have `t` in scope) change from `err.message` to
   `t(err.message, (err as I18nError).params)`. Safety property: `t()` returns its
   input unchanged when the key is unknown, so dynamic upstream messages (e.g. Groq's
   `apiError.message` passthrough at apiService.ts:166) survive untranslated rather
   than breaking. Alternatives rejected: passing `t` as a parameter (threads through
   every signature), reading `acgen_lang` inside the module (second source of truth).

2. **HistoryModal drops the last `window.confirm`** in favor of the inline 2-step
   confirm pattern WorkspacePicker established: first click turns "Borrar todo" into
   a confirming button ("¿Confirmar borrado?" / "Confirm deletion?"), second click
   executes; closing the modal or clicking elsewhere resets the pending state.

## Scope, file by file

| File | Change |
|---|---|
| `src/services/apiService.ts` | All 13 `throw new Error('<Spanish>')` → i18n keys + params. Existing dead keys reused where the text matches (`error.apiKey`, `error.rateLimit`, `error.modelDecommissioned`, `error.invalidJson`, `error.invalidFormat`, …); new keys added for the parameterized validation errors (test case / record shape). Export `I18nError`. |
| `src/i18n/es.json` + `en.json` | New keys: `export.*` (4 labels), `history.*` (title, clearAll, confirmClear, empty, load), `common.searchMarket`, parameterized `error.*` for validation. Both files stay at full key parity. |
| `src/components/ExportBar.tsx` | Uses `useT()`. `FORMAT_LABELS` maps format → key; "Markdown"/"Jira Wiki" stay literal (proper nouns). Copied state → `common.copied`. |
| `src/components/ErrorBoundary.tsx` | Export `I18nContext` from `I18nContext.tsx`; boundary uses `static contextType`. Title → `error.boundary` (existing key), button → `common.retry` (existing key). Falls back to Spanish literals if context is absent (defensive — it is mounted inside the provider today). |
| `src/components/HistoryModal.tsx` | 5 strings → `history.*` keys + `common.close` for the ✕ aria-label. `window.confirm` → inline 2-step confirm. |
| `src/components/SearchableSelect.tsx` | `placeholder` becomes a required prop (removes the baked-in "Buscar mercado..." domain assumption); "Sin resultados" → `common.noResults` via `useT()`. Call sites (BugReportTool:281, TestDataTool:280) pass `t('common.searchMarket')`. |
| 8 tool catch blocks | `err.message` → `t(err.message, (err as I18nError).params)`. |

## Error-key mapping (apiService.ts)

| Current literal (line) | Key |
|---|---|
| "La respuesta no es JSON válido…" (48, 51) | `error.invalidJson` (existing) |
| "La respuesta no contiene un array de casos de prueba." (62) | `error.noTestCaseArray` (new) |
| "La respuesta no tiene un formato reconocible." (65) | `error.invalidFormat` (existing) |
| "El caso de prueba {n} no es un objeto válido." (79) | `error.testCaseInvalid` (new, params: n) |
| "…no tiene los campos requeridos: {fields}" (87) | `error.testCaseMissingFields` (new, params: n, key, fields) |
| "…tiene campos con tipo incorrecto: {fields}" (95) | `error.testCaseWrongTypes` (new, params: n, key, fields) |
| "API Key invalida…" (155) | `error.apiKey` (existing) |
| "Limite de peticiones alcanzado…" (158) | `error.rateLimit` (existing) |
| "El modelo seleccionado ya no esta disponible…" (162) | `error.modelDecommissioned` (existing) |
| `apiError.message` passthrough (166) | unchanged — dynamic upstream text, `t()` passes it through |
| "El registro {n} no es un objeto válido." (220) | `error.recordInvalid` (new, params: n) |
| "El registro {n} tiene un valor anidado…" (224) | `error.recordNestedValue` (new, params: n, field) |

## Testing (TDD, RED first per change)

- `apiService.test.ts`: validation throws carry the expected key in `message` and the expected `params` (extend existing 22 tests).
- Tool-level: at least one tool test asserting a thrown `I18nError` renders translated in `<ErrorBanner>` in **en** (proves the `t(err.message, params)` wiring + interpolation).
- `HistoryModal`: 2-step confirm — first click arms, second clears, close resets; strings switch with language.
- `ExportBar`, `ErrorBoundary`, `SearchableSelect`: render in en, assert English labels; SearchableSelect placeholder comes from the prop.
- New `i18n/keyParity.test.ts`: `Object.keys(es)` ≡ `Object.keys(en)` (fails today only if drift exists; guards the new keys).

## Risks

- A tool that string-matches on Spanish error text would break — none does (checked: catches only display `err.message`).
- `t(err.message)` on a non-key message must return it verbatim — already `t()`'s documented fallback (`I18nContext.tsx:36`).
