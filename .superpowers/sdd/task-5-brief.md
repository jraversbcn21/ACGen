### Task 5: HistoryModal — i18n + inline 2-step confirm

**Files:**
- Modify: `src/components/HistoryModal.tsx`
- Create: `src/components/HistoryModal.test.tsx`
- Modify: `src/i18n/es.json`, `src/i18n/en.json` (5 new `history.*` keys)

**Interfaces:** none.

- [ ] **Step 1: Add keys**

`es.json`:

```json
  "history.title": "Historial",
  "history.clearAll": "Borrar todo",
  "history.confirmClear": "¿Confirmar borrado?",
  "history.empty": "No hay entradas en el historial todavía.",
  "history.load": "Cargar",
```

`en.json`:

```json
  "history.title": "History",
  "history.clearAll": "Clear all",
  "history.confirmClear": "Confirm deletion?",
  "history.empty": "No history entries yet.",
  "history.load": "Load",
```

- [ ] **Step 2: Write the failing tests**

`src/components/HistoryModal.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { I18nProvider } from '../i18n/I18nContext';
import { HistoryModal } from './HistoryModal';
import type { HistoryEntry } from '../types';

const entries: HistoryEntry[] = [
  { id: '1', timestamp: 1700000000000, inputPreview: 'algo', output: 'salida' },
];

function renderModal(props: Partial<Parameters<typeof HistoryModal>[0]> = {}, lang: 'es' | 'en' = 'es') {
  localStorage.setItem('acgen_lang', JSON.stringify(lang));
  return render(
    <I18nProvider>
      <HistoryModal entries={entries} onLoad={() => {}} onClearAll={() => {}} onClose={() => {}} {...props} />
    </I18nProvider>
  );
}

describe('HistoryModal', () => {
  afterEach(() => localStorage.clear());

  it('clear-all requires a second confirming click', async () => {
    const onClearAll = vi.fn();
    renderModal({ onClearAll });
    await userEvent.click(screen.getByRole('button', { name: 'Borrar todo' }));
    expect(onClearAll).not.toHaveBeenCalled();
    const confirmBtn = screen.getByRole('button', { name: '¿Confirmar borrado?' });
    await userEvent.click(confirmBtn);
    expect(onClearAll).toHaveBeenCalledTimes(1);
  });

  it('renders in English', () => {
    renderModal({}, 'en');
    expect(screen.getByText('History')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear all' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Load' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });

  it('shows the translated empty state', () => {
    localStorage.setItem('acgen_lang', '"en"');
    render(
      <I18nProvider>
        <HistoryModal entries={[]} onLoad={() => {}} onClearAll={() => {}} onClose={() => {}} />
      </I18nProvider>
    );
    expect(screen.getByText('No history entries yet.')).toBeInTheDocument();
  });
});
```

(Check `src/types` for the exact `HistoryEntry` shape before finalizing the fixture — adjust fields if they differ.)

- [ ] **Step 3: Run to verify RED**

Run: `npx vitest run src/components/HistoryModal.test.tsx`
Expected: FAIL — `window.confirm` path (jsdom's confirm returns false → `onClearAll` never fires; there is no "¿Confirmar borrado?" button), and English strings absent.

- [ ] **Step 4: Implement**

Replace `src/components/HistoryModal.tsx`'s component body (keep `formatDate` as is):

```tsx
import { useState } from 'react';
import type { HistoryEntry } from '../types';
import { useT } from '../i18n/I18nContext';

// ... formatDate unchanged ...

export function HistoryModal({ entries, onLoad, onClearAll, onClose }: HistoryModalProps) {
  const t = useT();
  const [confirmingClear, setConfirmingClear] = useState(false);

  return (
    <div className="history-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="history-modal">
        <div className="history-modal-header">
          <span className="history-modal-title">{t('history.title')}</span>
          <div style={{ display: 'flex', gap: 8 }}>
            {entries.length > 0 && (
              <button
                type="button"
                className="btn-ghost"
                style={{ fontSize: 12, padding: '4px 10px' }}
                onClick={() => {
                  if (confirmingClear) {
                    onClearAll();
                    setConfirmingClear(false);
                  } else {
                    setConfirmingClear(true);
                  }
                }}
              >
                {confirmingClear ? t('history.confirmClear') : t('history.clearAll')}
              </button>
            )}
            <button type="button" className="history-close-btn" onClick={onClose} aria-label={t('common.close')}>✕</button>
          </div>
        </div>

        <div className="history-modal-body">
          {entries.length === 0 ? (
            <div className="history-empty">{t('history.empty')}</div>
          ) : (
            entries.map((entry) => (
              <div key={entry.id} className="history-entry">
                <div className="history-entry-meta">
                  <span className="history-entry-date">{formatDate(entry.timestamp)}</span>
                </div>
                <div className="history-entry-preview">{entry.inputPreview}{entry.inputPreview.length === 60 ? '…' : ''}</div>
                <button
                  type="button"
                  className="btn-ghost history-entry-load"
                  onClick={() => { onLoad(entry.output); onClose(); }}
                >
                  {t('history.load')}
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Run to verify GREEN**

Run: `npx vitest run src/components/HistoryModal.test.tsx`
Expected: 3 PASS. Then `npx vitest run src/components` — consumers of HistoryModal still pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/HistoryModal.tsx src/components/HistoryModal.test.tsx src/i18n/es.json src/i18n/en.json
git commit -m "feat(i18n): translate HistoryModal and replace window.confirm with inline 2-step confirm"
```

---

