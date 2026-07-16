### Task 1: apiService throws i18n keys with params

**Files:**
- Modify: `src/services/apiService.ts` (throws at lines 48, 51, 62, 65, 79, 87, 95, 155, 158, 162, 220, 224)
- Modify: `src/services/apiService.test.ts` (existing assertions at lines 81, 86, 91, 96, 113, 118, 122 match Spanish text — migrate to keys+params)
- Modify: `src/i18n/es.json`, `src/i18n/en.json` (6 new `error.*` keys)

**Interfaces:**
- Produces: `export type I18nError = Error & { params?: Record<string, string | number> }` from `src/services/apiService.ts`. Every validation/HTTP error thrown by this module has `message` = i18n key and optional `params`. Task 2 consumes this.

- [ ] **Step 1: Add the 6 new keys to both dictionaries**

In `src/i18n/es.json`, after the `"error.boundary"` entry:

```json
  "error.noTestCaseArray": "La respuesta no contiene un array de casos de prueba.",
  "error.testCaseInvalid": "El caso de prueba {n} no es un objeto válido.",
  "error.testCaseMissingFields": "El caso de prueba {n} ({key}) no tiene los campos requeridos: {fields}",
  "error.testCaseWrongTypes": "El caso de prueba {n} ({key}) tiene campos con tipo incorrecto: {fields}",
  "error.recordInvalid": "El registro {n} no es un objeto válido.",
  "error.recordNestedValue": "El registro {n} tiene un valor anidado no soportado en el campo \"{field}\".",
```

In `src/i18n/en.json`, same position:

```json
  "error.noTestCaseArray": "The response does not contain an array of test cases.",
  "error.testCaseInvalid": "Test case {n} is not a valid object.",
  "error.testCaseMissingFields": "Test case {n} ({key}) is missing required fields: {fields}",
  "error.testCaseWrongTypes": "Test case {n} ({key}) has fields with the wrong type: {fields}",
  "error.recordInvalid": "Record {n} is not a valid object.",
  "error.recordNestedValue": "Record {n} has an unsupported nested value in field \"{field}\".",
```

- [ ] **Step 2: Write the failing tests**

In `src/services/apiService.test.ts`, add a new describe block:

```ts
import type { I18nError } from './apiService';

describe('i18n error keys', () => {
  it('validateTestCases throws the missing-fields key with params', () => {
    const items = [{ key: 'TC-1', summary: 's', priority: 'p', type: 't', preconditions: 'pre', testSteps: ['a'], expectedResult: '' }];
    let caught: I18nError | null = null;
    try { validateTestCases(items); } catch (e) { caught = e as I18nError; }
    expect(caught?.message).toBe('error.testCaseMissingFields');
    expect(caught?.params).toEqual({ n: 1, key: 'TC-1', fields: 'expectedResult' });
  });

  it('validateTestCases throws the wrong-type key with params', () => {
    const items = [{ key: 'TC-1', summary: 's', priority: 42, type: 't', preconditions: 'pre', testSteps: ['a'], expectedResult: 'r' }];
    let caught: I18nError | null = null;
    try { validateTestCases(items); } catch (e) { caught = e as I18nError; }
    expect(caught?.message).toBe('error.testCaseWrongTypes');
    expect(caught?.params).toEqual({ n: 1, key: 'TC-1', fields: 'priority' });
  });

  it('validateTestCases throws the invalid-object key with the index', () => {
    let caught: I18nError | null = null;
    try { validateTestCases([{ key: 'TC-1', summary: 's', priority: 'p', type: 't', preconditions: 'pre', testSteps: ['a'], expectedResult: 'r' }, 'nope']); } catch (e) { caught = e as I18nError; }
    expect(caught?.message).toBe('error.testCaseInvalid');
    expect(caught?.params).toEqual({ n: 2 });
  });

  it('validateTestDataRows throws the nested-value key with params', () => {
    let caught: I18nError | null = null;
    try { validateTestDataRows([{ nombre: 'x', direccion: { calle: 'y' } }]); } catch (e) { caught = e as I18nError; }
    expect(caught?.message).toBe('error.recordNestedValue');
    expect(caught?.params).toEqual({ n: 1, field: 'direccion' });
  });

  it('validateTestDataRows throws the invalid-record key with the index', () => {
    let caught: I18nError | null = null;
    try { validateTestDataRows(['not-an-object']); } catch (e) { caught = e as I18nError; }
    expect(caught?.message).toBe('error.recordInvalid');
    expect(caught?.params).toEqual({ n: 1 });
  });

  it('extractJsonArray throws error.invalidJson on garbage', () => {
    expect(() => extractJsonArray('not json at all')).toThrow('error.invalidJson');
  });

  it('every thrown key exists in both dictionaries', async () => {
    const es = (await import('../i18n/es.json')).default as Record<string, string>;
    const en = (await import('../i18n/en.json')).default as Record<string, string>;
    for (const key of ['error.invalidJson', 'error.noTestCaseArray', 'error.invalidFormat', 'error.testCaseInvalid', 'error.testCaseMissingFields', 'error.testCaseWrongTypes', 'error.apiKey', 'error.rateLimit', 'error.modelDecommissioned', 'error.recordInvalid', 'error.recordNestedValue']) {
      expect(es[key], `missing in es: ${key}`).toBeTruthy();
      expect(en[key], `missing in en: ${key}`).toBeTruthy();
    }
  });
});
```

Note: `validateTestCases`, `validateTestDataRows`, `extractJsonArray` are already imported at the top of this test file.

- [ ] **Step 3: Run to verify RED**

Run: `npx vitest run src/services/apiService.test.ts`
Expected: the new tests FAIL (messages are still Spanish literals, no `params`). The dictionary-keys test PASSES (keys were added in Step 1) — that is fine, it guards Step 1's work.

- [ ] **Step 4: Implement in apiService.ts**

Add after the imports (line 6, next to `type ToolType`):

```ts
/** Errors whose message is an i18n key; params feed t()'s interpolation. */
export type I18nError = Error & { params?: Record<string, string | number> };

function i18nError(key: string, params?: Record<string, string | number>): I18nError {
  return params ? Object.assign(new Error(key), { params }) : new Error(key);
}
```

Replace each throw:

| Line (pre-edit) | New code |
|---|---|
| 48, 51 | `throw i18nError('error.invalidJson');` |
| 62 | `throw i18nError('error.noTestCaseArray');` |
| 65 | `throw i18nError('error.invalidFormat');` |
| 79 | `throw i18nError('error.testCaseInvalid', { n: i + 1 });` |
| 87 | `throw i18nError('error.testCaseMissingFields', { n: i + 1, key: String(tc.key \|\| `#${i + 1}`), fields: missing.join(', ') });` |
| 95 | `throw i18nError('error.testCaseWrongTypes', { n: i + 1, key: String(tc.key \|\| `#${i + 1}`), fields: wrongType.join(', ') });` |
| 155 | `throw Object.assign(i18nError('error.apiKey'), apiError);` |
| 158 | `throw Object.assign(i18nError('error.rateLimit'), apiError);` |
| 162 | `throw Object.assign(i18nError('error.modelDecommissioned'), apiError);` |
| 166 | unchanged (`apiError.message` is dynamic upstream text) |
| 220 | `throw i18nError('error.recordInvalid', { n: i + 1 });` |
| 224 | `throw i18nError('error.recordNestedValue', { n: i + 1, field });` |

- [ ] **Step 5: Migrate the existing Spanish-text assertions**

In `src/services/apiService.test.ts`:

- Line 81/86: `expect(() => validateTestCases(items)).toThrow(/testSteps/)` → catch and assert `caught?.message === 'error.testCaseWrongTypes'` (line 81 case) / `'error.testCaseMissingFields'` (line 86 case) and `expect(String(caught?.params?.fields)).toContain('testSteps')`. Read each test's fixture to pick the right key: missing/empty field → MissingFields, present-but-wrong-type → WrongTypes.
- Line 91 (`/priority/`): same pattern, assert the key and `params.fields` contains `'priority'`.
- Line 96 (`/caso de prueba 2/`): assert `caught?.message === 'error.testCaseInvalid'` (or the applicable key per fixture) and `caught?.params?.n === 2`.
- Line 113 (`/direccion/`): assert key `'error.recordNestedValue'` and `caught?.params?.field === 'direccion'`.
- Line 118 (`/tags/`): same, `field === 'tags'`.
- Line 122 (`/registro 1/`): assert key `'error.recordInvalid'` and `params.n === 1`.

- [ ] **Step 6: Run to verify GREEN**

Run: `npx vitest run src/services/apiService.test.ts`
Expected: ALL PASS.

- [ ] **Step 7: Commit**

```bash
git add src/services/apiService.ts src/services/apiService.test.ts src/i18n/es.json src/i18n/en.json
git commit -m "feat(i18n): apiService throws i18n keys with params instead of Spanish literals"
```

---

