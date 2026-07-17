### Task 4: Componente `RegressionTracker` + claves i18n + constante de anchos

**Files:**
- Create: `src/components/RegressionTracker.tsx`
- Create: `src/components/RegressionTracker.test.tsx`
- Modify: `src/config/constants.ts` (STORAGE_KEYS, líneas 68-77)
- Modify: `src/i18n/es.json`, `src/i18n/en.json`

**Interfaces:**
- Consumes: `TrackerGrid`/`TrackerGridProps` (Tasks 1-2), `useRegressions`/`PLATFORM_IDS`/`PlatformId`/`ArchivedRegression` (Task 3).
- Produces: `export function RegressionTracker()` sin props (la monta la Task 5 en `App.tsx`), y `STORAGE_KEYS.REGRESSION_COL_WIDTHS`.

- [ ] **Step 1: Añadir la constante de anchos**

En `src/config/constants.ts`, dentro de `STORAGE_KEYS`, después de `SPRINT_COL_WIDTHS`:

```ts
  REGRESSION_COL_WIDTHS: 'acgen_regression_col_widths',
```

- [ ] **Step 2: Añadir las claves i18n**

En `src/i18n/es.json`, junto a `regression.openLink` (añadida en Task 2):

```json
  "landing.tool.regressiontracker": "Regression Tracker",
  "landing.tool.regressiontrackerDesc": "Seguimiento de regresiones por plataforma",
  "sidebar.regression": "Regression",
  "regression.title": "Regression Tracker",
  "regression.archive": "Archivar Regresión",
  "regression.archiveConfirm": "¿Archivar la regresión actual? Se guardará en el historial y el tablero se vaciará.",
  "regression.archivedList": "Archivadas",
  "regression.archivedBadge": "Archivada",
  "regression.deleteConfirm": "¿Eliminar esta regresión archivada?",
  "regression.noArchived": "No hay regresiones archivadas.",
  "regression.searchPlaceholder": "Buscar por regresión, versión, status...",
```

En `src/i18n/en.json`, mismas claves:

```json
  "landing.tool.regressiontracker": "Regression Tracker",
  "landing.tool.regressiontrackerDesc": "Regression tracking by platform",
  "sidebar.regression": "Regression",
  "regression.title": "Regression Tracker",
  "regression.archive": "Archive Regression",
  "regression.archiveConfirm": "Archive the current regression? It will be saved to history and the board will be cleared.",
  "regression.archivedList": "Archived",
  "regression.archivedBadge": "Archived",
  "regression.deleteConfirm": "Delete this archived regression?",
  "regression.noArchived": "No archived regressions.",
  "regression.searchPlaceholder": "Search by regression, version, status...",
```

Run: `npm test -- src/i18n/keyParity.test.ts` → Expected: PASS.

- [ ] **Step 3: Escribir los tests del componente (fallan)**

Crear `src/components/RegressionTracker.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { I18nProvider } from '../i18n/I18nContext';
import { RegressionTracker } from './RegressionTracker';

function renderTracker() {
  return render(
    <I18nProvider>
      <RegressionTracker />
    </I18nProvider>
  );
}

beforeEach(() => {
  localStorage.clear();
  // Fija el idioma: jsdom arranca con navigator.language en-US y los textos asertados son en español
  localStorage.setItem('acgen_lang', JSON.stringify('es'));
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('RegressionTracker', () => {
  it('renders the 4 platform tabs and the regression headers', () => {
    renderTracker();
    expect(screen.getByText('iOS')).toBeInTheDocument();
    expect(screen.getByText('Android')).toBeInTheDocument();
    expect(screen.getByText('Web-Desktop')).toBeInTheDocument();
    expect(screen.getByText('Web-Mobile')).toBeInTheDocument();
    for (const h of ['Regresión', 'Versión', 'Fecha', 'Notas', 'Status']) {
      expect(screen.getByText(h)).toBeInTheDocument();
    }
  });

  it('a "Nombre - URL" cell becomes a link that ctrl+click opens', () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    renderTracker();
    const input = document.querySelector('tbody input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Smoke Login - https://zephyr.example.com/plan/9' } });
    const cell = screen.getByDisplayValue('Smoke Login - https://zephyr.example.com/plan/9');
    expect((cell as HTMLInputElement).style.color).toBe('var(--accent)');
    fireEvent.click(cell, { ctrlKey: true });
    expect(open).toHaveBeenCalledWith('https://zephyr.example.com/plan/9', '_blank');
  });

  it('each platform keeps its own grid', () => {
    renderTracker();
    const input = document.querySelector('tbody input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'solo en iOS' } });
    fireEvent.click(screen.getByText('Android'));
    expect(screen.queryByDisplayValue('solo en iOS')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('iOS'));
    expect(screen.getByDisplayValue('solo en iOS')).toBeInTheDocument();
  });

  it('archiving snapshots the board, clears it and shows the archived list button', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderTracker();
    const input = document.querySelector('tbody input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'checkout v9' } });
    fireEvent.click(screen.getByText('Archivar Regresión'));
    expect(screen.queryByDisplayValue('checkout v9')).not.toBeInTheDocument();
    const listButton = screen.getByText(/Archivadas \(1\)/);
    fireEvent.click(listButton);
    expect(screen.getByText(/^Regresión \d{4}-\d{2}-\d{2}$/)).toBeInTheDocument();
  });

  it('an archived snapshot opens read-only with its data', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderTracker();
    const input = document.querySelector('tbody input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'checkout v9' } });
    fireEvent.click(screen.getByText('Archivar Regresión'));
    fireEvent.click(screen.getByText(/Archivadas \(1\)/));
    fireEvent.click(screen.getByText(/^Regresión \d{4}-\d{2}-\d{2}$/));
    const cell = screen.getByDisplayValue('checkout v9');
    expect(cell).toHaveAttribute('readonly');
    expect(screen.queryByText('Archivar Regresión')).not.toBeInTheDocument();
  });

  it('deleting an archived snapshot shows the empty state', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderTracker();
    fireEvent.click(screen.getByText('Archivar Regresión'));
    fireEvent.click(screen.getByText(/Archivadas \(1\)/));
    fireEvent.click(screen.getByText('Eliminar'));
    expect(screen.getByText('No hay regresiones archivadas.')).toBeInTheDocument();
  });
});
```

- [ ] **Step 4: Ejecutar para verificar que fallan**

Run: `npm test -- src/components/RegressionTracker.test.tsx`
Expected: FAIL — `Failed to resolve import "./RegressionTracker"`.

- [ ] **Step 5: Crear `src/components/RegressionTracker.tsx`**

Contenido completo:

```tsx
import { useState, useCallback } from 'react';
import { TrackerGrid } from './TrackerGrid';
import { useRegressions, PLATFORM_IDS } from '../hooks/useRegressions';
import type { PlatformId, ArchivedRegression } from '../hooks/useRegressions';
import { STORAGE_KEYS } from '../config/constants';
import { useT } from '../i18n/I18nContext';

const PLATFORM_LABELS: Record<PlatformId, string> = {
  ios: 'iOS',
  android: 'Android',
  webDesktop: 'Web-Desktop',
  webMobile: 'Web-Mobile',
};

const REGRESSION_HEADERS = ['Regresión', 'Versión', 'Fecha', 'Notas', 'Status'];

const PLATFORM_HEADERS: Record<PlatformId, string[]> = {
  ios: REGRESSION_HEADERS,
  android: REGRESSION_HEADERS,
  webDesktop: REGRESSION_HEADERS,
  webMobile: REGRESSION_HEADERS,
};

type Screen = { kind: 'board' } | { kind: 'archivedList' } | { kind: 'snapshot'; id: string };

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function RegressionTracker() {
  const { board, archived, updateGridCell, setTabGrid, moveRow, archiveBoard, deleteArchived } = useRegressions();
  const [screen, setScreen] = useState<Screen>({ kind: 'board' });
  const t = useT();

  const handleArchive = useCallback(() => {
    if (!confirm(t('regression.archiveConfirm'))) return;
    archiveBoard();
  }, [archiveBoard, t]);

  const noop = useCallback(() => {}, []);

  const snapshot: ArchivedRegression | null =
    screen.kind === 'snapshot' ? archived.find((a) => a.id === screen.id) ?? null : null;

  if (snapshot) {
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <button type="button" className="btn-ghost" onClick={() => setScreen({ kind: 'archivedList' })} style={{ padding: '6px 14px' }}>
            ← {t('common.back')}
          </button>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>{snapshot.name}</h2>
          <span className="badge badge-info" style={{ fontSize: 11 }}>{t('regression.archivedBadge')}</span>
        </div>
        <TrackerGrid
          tabs={PLATFORM_IDS}
          tabLabels={PLATFORM_LABELS}
          tabHeaders={PLATFORM_HEADERS}
          tabGrid={snapshot.board}
          linkMode="url"
          readOnly
          colWidthsStorageKey={STORAGE_KEYS.REGRESSION_COL_WIDTHS}
          searchPlaceholder={t('regression.searchPlaceholder')}
          onUpdateGridCell={noop}
          onSetTabGrid={noop}
          onMoveRow={noop}
        />
      </div>
    );
  }

  if (screen.kind !== 'board') {
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <button type="button" className="btn-ghost" onClick={() => setScreen({ kind: 'board' })} style={{ padding: '6px 14px' }}>
            ← {t('common.back')}
          </button>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>{t('regression.archivedList')}</h2>
        </div>
        {archived.length === 0 && (
          <p style={{ marginTop: 32, textAlign: 'center', color: 'var(--text-3)', fontSize: 14 }}>
            {t('regression.noArchived')}
          </p>
        )}
        {archived.map((a) => (
          <div
            key={a.id}
            className="sprint-card"
            style={{
              padding: '14px 18px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
              background: 'var(--surface-2)', marginBottom: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              transition: 'box-shadow .18s var(--ease)', cursor: 'pointer',
            }}
            onClick={() => setScreen({ kind: 'snapshot', id: a.id })}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-sm)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
          >
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>{a.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                {formatDate(a.archivedAt)}
              </div>
            </div>
            <button
              type="button"
              className="btn-ghost"
              onClick={(e) => { e.stopPropagation(); if (confirm(t('regression.deleteConfirm'))) deleteArchived(a.id); }}
              style={{ padding: '4px 10px', fontSize: 12 }}
            >
              {t('common.delete')}
            </button>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>{t('regression.title')}</h2>
        {archived.length > 0 && (
          <button
            type="button"
            className="btn-ghost"
            style={{ marginLeft: 'auto', padding: '6px 14px' }}
            onClick={() => setScreen({ kind: 'archivedList' })}
          >
            {t('regression.archivedList')} ({archived.length})
          </button>
        )}
      </div>
      <TrackerGrid
        tabs={PLATFORM_IDS}
        tabLabels={PLATFORM_LABELS}
        tabHeaders={PLATFORM_HEADERS}
        tabGrid={board}
        linkMode="url"
        colWidthsStorageKey={STORAGE_KEYS.REGRESSION_COL_WIDTHS}
        searchPlaceholder={t('regression.searchPlaceholder')}
        onUpdateGridCell={updateGridCell}
        onSetTabGrid={setTabGrid}
        onMoveRow={moveRow}
      />
      <div className="actions-bar">
        <button type="button" className="btn-ghost" onClick={handleArchive}>
          {t('regression.archive')}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Ejecutar los tests**

Run: `npm test -- src/components/RegressionTracker.test.tsx`
Expected: PASS (6 tests).

- [ ] **Step 7: Suite completa y commit**

Run: `npm test`
Expected: `Tests 254 passed` (236 + 12 del hook + 6 del componente).

```bash
git add src/components/RegressionTracker.tsx src/components/RegressionTracker.test.tsx src/config/constants.ts src/i18n/es.json src/i18n/en.json
git commit -m "feat(regression): RegressionTracker board, archived snapshots UI and i18n

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

