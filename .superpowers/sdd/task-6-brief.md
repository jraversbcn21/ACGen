### Task 6: SearchableSelect + call sites

**Files:**
- Modify: `src/components/SearchableSelect.tsx`
- Create: `src/components/SearchableSelect.test.tsx`
- Modify: `src/components/BugReportTool.tsx:285`, `src/components/TestDataTool.tsx:284` (hardcoded `placeholder` props)
- Modify: `src/i18n/es.json`, `src/i18n/en.json` (2 new keys)

**Interfaces:**
- Produces: `SearchableSelectProps` gains optional `searchPlaceholder?: string` (search input placeholder, defaults to `t('common.search')`). Existing `placeholder` prop (trigger button) keeps its signature; its default becomes `t('common.select')`.

- [ ] **Step 1: Add keys**

`es.json`:

```json
  "common.select": "Seleccionar...",
  "common.searchMarket": "Buscar mercado...",
```

`en.json`:

```json
  "common.select": "Select...",
  "common.searchMarket": "Search market...",
```

- [ ] **Step 2: Write the failing tests**

`src/components/SearchableSelect.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nProvider } from '../i18n/I18nContext';
import { SearchableSelect } from './SearchableSelect';

const options = [{ value: 'es', label: 'España' }];

function renderEn(ui: React.ReactElement) {
  localStorage.setItem('acgen_lang', '"en"');
  return render(<I18nProvider>{ui}</I18nProvider>);
}

describe('SearchableSelect i18n', () => {
  afterEach(() => localStorage.clear());

  it('search input placeholder defaults to the translated common.search', async () => {
    renderEn(<SearchableSelect options={options} value="" onChange={() => {}} />);
    await userEvent.click(screen.getByRole('button'));
    expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument();
  });

  it('shows the translated empty state', async () => {
    renderEn(<SearchableSelect options={options} value="" onChange={() => {}} />);
    await userEvent.click(screen.getByRole('button'));
    await userEvent.type(screen.getByPlaceholderText('Search...'), 'zzz');
    expect(screen.getByText('No results')).toBeInTheDocument();
  });

  it('trigger placeholder defaults to the translated common.select', () => {
    renderEn(<SearchableSelect options={options} value="" onChange={() => {}} />);
    expect(screen.getByText('Select...')).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run to verify RED**

Run: `npx vitest run src/components/SearchableSelect.test.tsx`
Expected: FAIL on all 3 (Spanish literals).

- [ ] **Step 4: Implement**

In `src/components/SearchableSelect.tsx`:

```tsx
import { useT } from '../i18n/I18nContext';

interface SearchableSelectProps {
  options: readonly SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
}

export function SearchableSelect({ options, value, onChange, placeholder, searchPlaceholder }: SearchableSelectProps) {
  const t = useT();
  // ... existing state/hooks unchanged ...
```

Then three render changes:
- Trigger (line 104): `{selectedOption ? selectedOption.label : (placeholder || t('common.select'))}`
- Search input (line 119): `placeholder={searchPlaceholder || t('common.search')}`
- Empty item (line 130): `<li className="sselect-empty">{t('common.noResults')}</li>`

Call sites (both already have `t` in scope):
- `BugReportTool.tsx:285`: `placeholder="Buscar..."` → `placeholder={t('common.search')} searchPlaceholder={t('common.searchMarket')}`
- `TestDataTool.tsx:284`: `placeholder="Buscar mercado..."` → `placeholder={t('common.searchMarket')} searchPlaceholder={t('common.searchMarket')}`

- [ ] **Step 5: Run to verify GREEN**

Run: `npx vitest run src/components`
Expected: ALL PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/SearchableSelect.tsx src/components/SearchableSelect.test.tsx src/components/BugReportTool.tsx src/components/TestDataTool.tsx src/i18n/es.json src/i18n/en.json
git commit -m "feat(i18n): translate SearchableSelect and its call-site placeholders"
```

---

