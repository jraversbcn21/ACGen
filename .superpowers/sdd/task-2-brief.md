### Task 2: Tool catch blocks translate I18nError

**Files:**
- Modify (identical one-line change in each): `src/components/AcceptanceCriteriaTool.tsx:73`, `BugReportTool.tsx:122`, `EdgeCaseTool.tsx:54`, `ConverterTool.tsx:49`, `RefinerTool.tsx:50`, `TestCaseTool.tsx:75`, `TestDataTool.tsx:157`, `UserStoryTool.tsx:50`
- Create: `src/components/errorTranslation.test.tsx`

**Interfaces:**
- Consumes: `I18nError` from `src/services/apiService.ts` (Task 1).
- Produces: nothing downstream.

- [ ] **Step 1: Write the failing test**

`src/components/errorTranslation.test.tsx` — mock fetch to fail with 401 so `streamWithGroq` throws `error.apiKey`, render in **English**, assert the translated banner. Crib the render/mock scaffolding style from `src/components/tools.confidential.test.tsx` (provider wrapper, fetch mock):

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { I18nProvider } from '../i18n/I18nContext';
import { AcceptanceCriteriaTool } from './AcceptanceCriteriaTool';

describe('API errors render translated', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('acgen_lang', '"en"');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ error: { message: 'Invalid API Key' } }),
    }));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('shows the English error.apiKey text when the API returns 401', async () => {
    render(
      <I18nProvider>
        <AcceptanceCriteriaTool apiKey="bad-key" model="m" />
      </I18nProvider>
    );
    await userEvent.type(screen.getByRole('textbox'), 'some requirement');
    await userEvent.click(screen.getByRole('button', { name: /generate/i }));
    await waitFor(() => {
      expect(screen.getByText('Invalid API key. Verify your key and try again.')).toBeInTheDocument();
    });
  });
});
```

Adjust the concrete props/roles to what `AcceptanceCriteriaTool` actually requires — check `tools.confidential.test.tsx` for the exact prop set and generate-button query it already uses, and reuse them verbatim.

- [ ] **Step 2: Run to verify RED**

Run: `npx vitest run src/components/errorTranslation.test.tsx`
Expected: FAIL — the banner shows the raw key `error.apiKey` (Task 1 made messages keys; nothing translates them yet).

- [ ] **Step 3: Implement — the same one-line change in all 8 tools**

In each file listed above, the catch currently reads:

```ts
const message = err instanceof Error ? err.message : t('error.unexpected');
```

Change to:

```ts
const message = err instanceof Error ? t(err.message, (err as I18nError).params) : t('error.unexpected');
```

and add to each file's imports:

```ts
import type { I18nError } from '../services/apiService';
```

(`t()` returns unknown keys/messages verbatim, so upstream dynamic messages still display.)

- [ ] **Step 4: Run to verify GREEN + no regressions**

Run: `npx vitest run src/components`
Expected: ALL PASS (confidential suites exercise these same catch paths).

- [ ] **Step 5: Commit**

```bash
git add src/components/*.tsx
git commit -m "feat(i18n): tool catch blocks translate I18nError keys via t()"
```

---

