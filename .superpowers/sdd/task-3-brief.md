### Task 3: ExportBar

**Files:**
- Modify: `src/components/ExportBar.tsx` (whole file is 33 lines; shown below)
- Create: `src/components/ExportBar.test.tsx`
- Modify: `src/i18n/es.json`, `src/i18n/en.json` (4 new `export.*` keys)

**Interfaces:** none consumed/produced beyond the keys.

- [ ] **Step 1: Add keys**

`es.json`:

```json
  "export.copy": "Copiar",
  "export.pdf": "Descargar PDF",
  "export.csv": "Descargar CSV",
  "export.tsv": "Copiar TSV",
```

`en.json`:

```json
  "export.copy": "Copy",
  "export.pdf": "Download PDF",
  "export.csv": "Download CSV",
  "export.tsv": "Copy TSV",
```

- [ ] **Step 2: Write the failing test**

`src/components/ExportBar.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { I18nProvider } from '../i18n/I18nContext';
import { ExportBar } from './ExportBar';

function renderEn(ui: React.ReactElement) {
  localStorage.setItem('acgen_lang', '"en"');
  return render(<I18nProvider>{ui}</I18nProvider>);
}

describe('ExportBar i18n', () => {
  afterEach(() => localStorage.clear());

  it('renders English labels', () => {
    renderEn(<ExportBar formats={['copy', 'pdf', 'csv', 'tsv']} onExport={() => {}} />);
    expect(screen.getByRole('button', { name: 'Copy' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download PDF' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download CSV' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy TSV' })).toBeInTheDocument();
  });

  it('keeps proper nouns literal', () => {
    renderEn(<ExportBar formats={['markdown', 'jirawiki']} onExport={() => {}} />);
    expect(screen.getByRole('button', { name: 'Markdown' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Jira Wiki' })).toBeInTheDocument();
  });

  it('shows the copied state translated', () => {
    renderEn(<ExportBar formats={['copy']} onExport={() => {}} copied />);
    expect(screen.getByRole('button', { name: 'Copied!' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run to verify RED**

Run: `npx vitest run src/components/ExportBar.test.tsx`
Expected: FAIL — labels render in Spanish.

- [ ] **Step 4: Implement**

Replace `src/components/ExportBar.tsx` with:

```tsx
import { useT } from '../i18n/I18nContext';

interface ExportBarProps {
  formats: string[];
  onExport: (format: string) => void;
  copied?: boolean;
}

// Values are i18n keys, except proper nouns, which t() passes through verbatim.
const FORMAT_LABELS: Record<string, string> = {
  copy: 'export.copy',
  markdown: 'Markdown',
  jirawiki: 'Jira Wiki',
  pdf: 'export.pdf',
  csv: 'export.csv',
  tsv: 'export.tsv',
};

export function ExportBar({ formats, onExport, copied }: ExportBarProps) {
  const t = useT();
  if (formats.length === 0) return null;

  return (
    <div className="export-bar" style={{ display: 'flex', gap: 8, marginTop: 12 }}>
      {formats.map((fmt) => (
        <button
          key={fmt}
          type="button"
          className={`btn-ghost ${fmt === 'copy' && copied ? 'btn-copied' : ''}`}
          onClick={() => onExport(fmt)}
        >
          {fmt === 'copy' && copied ? t('common.copied') : t(FORMAT_LABELS[fmt] || fmt)}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Run to verify GREEN, then check all ExportBar consumers still pass**

Run: `npx vitest run src/components`
Expected: ALL PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/ExportBar.tsx src/components/ExportBar.test.tsx src/i18n/es.json src/i18n/en.json
git commit -m "feat(i18n): translate ExportBar labels"
```

---

