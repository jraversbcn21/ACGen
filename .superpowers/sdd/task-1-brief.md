### Task 1: Extraer `TrackerGrid` de `SprintDashboard` (refactor sin cambio de comportamiento)

**Files:**
- Create: `src/components/TrackerGrid.tsx`
- Create: `src/components/TrackerGrid.test.tsx`
- Modify: `src/components/SprintDashboard.tsx` (reescritura completa como envoltorio)

**Interfaces:**
- Consumes: `useLocalStorage` (`src/hooks/useLocalStorage.ts`), `STORAGE_KEYS.TRACKER_BASE_URL` (`src/config/constants.ts`), `useT` (`src/i18n/I18nContext.tsx`).
- Produces: `TrackerGrid<T extends string>` y `TrackerGridProps<T>` exportados desde `src/components/TrackerGrid.tsx` con esta firma exacta (Tasks 2, 4 y 5 dependen de ella):

```tsx
export interface TrackerGridProps<T extends string> {
  tabs: readonly T[];
  tabLabels: Record<T, string>;
  tabHeaders: Record<T, string[]>;
  tabGrid: Record<T, string[][]>;
  linkMode: 'jira' | 'url';
  dragDisabled?: boolean;
  colWidthsStorageKey: string;
  searchPlaceholder: string;
  onUpdateGridCell: (tab: T, row: number, col: number, value: string) => void;
  onSetTabGrid: (tab: T, grid: string[][]) => void;
  onMoveRow: (tab: T, fromRow: number, toRow: number) => void;
}
```

En esta tarea `linkMode: 'url'` se declara pero aún no enlaza nada (lo implementa la Task 2 con TDD). `dragDisabled` sustituye al antiguo `sprint.archived` dentro del grid.

- [ ] **Step 1: Baseline — ejecutar la suite completa**

Run: `npm test`
Expected: `Test Files 27 passed (27)`, `Tests 225 passed (225)`. Si algo falla, PARAR: el problema no es de esta tarea.

- [ ] **Step 2: Escribir los tests del nuevo componente (fallan: el módulo no existe)**

Crear `src/components/TrackerGrid.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { I18nProvider } from '../i18n/I18nContext';
import { TrackerGrid } from './TrackerGrid';
import type { TrackerGridProps } from './TrackerGrid';

type Tab = 'one' | 'two';

function makeGrid(rows = 3, cols = 6): string[][] {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => ''));
}

function renderGrid(overrides: Partial<TrackerGridProps<Tab>> = {}) {
  const props: TrackerGridProps<Tab> = {
    tabs: ['one', 'two'],
    tabLabels: { one: 'Uno', two: 'Dos' },
    tabHeaders: { one: ['Ticket', 'Fecha'], two: ['Ticket', 'Motivo'] },
    tabGrid: { one: makeGrid(), two: makeGrid() },
    linkMode: 'jira',
    colWidthsStorageKey: 'test_grid_col_widths',
    searchPlaceholder: 'Buscar...',
    onUpdateGridCell: vi.fn(),
    onSetTabGrid: vi.fn(),
    onMoveRow: vi.fn(),
    ...overrides,
  };
  render(
    <I18nProvider>
      <TrackerGrid {...props} />
    </I18nProvider>
  );
  return props;
}

beforeEach(() => {
  localStorage.clear();
  // Fija el idioma: jsdom arranca con navigator.language en-US y los textos asertados son en español
  localStorage.setItem('acgen_lang', JSON.stringify('es'));
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('TrackerGrid — jira mode (extracted Sprint Tracker behavior)', () => {
  it('renders tab labels and the active tab headers', () => {
    renderGrid();
    expect(screen.getByText('Uno')).toBeInTheDocument();
    expect(screen.getByText('Dos')).toBeInTheDocument();
    expect(screen.getByText('Fecha')).toBeInTheDocument();
  });

  it('switching tab shows that tab headers', () => {
    renderGrid();
    fireEvent.click(screen.getByText('Dos'));
    expect(screen.getByText('Motivo')).toBeInTheDocument();
    expect(screen.queryByText('Fecha')).not.toBeInTheDocument();
  });

  it('ctrl+click on a ticket cell opens baseUrl/browse/KEY', () => {
    localStorage.setItem('acgen_tracker_base_url', JSON.stringify('https://jira.example.com'));
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    const grid = makeGrid();
    grid[0][0] = 'ABC-123 Login roto';
    renderGrid({ tabGrid: { one: grid, two: makeGrid() } });
    fireEvent.click(screen.getByDisplayValue('ABC-123 Login roto'), { ctrlKey: true });
    expect(open).toHaveBeenCalledWith('https://jira.example.com/browse/ABC-123', '_blank');
  });

  it('pasting a SnapLink transforms it to "KEY Nombre"', () => {
    const props = renderGrid();
    const inputs = document.querySelectorAll('tbody input');
    fireEvent.paste(inputs[0], {
      clipboardData: { getData: () => 'Mi ticket - https://jira.example.com/browse/ABC-999' },
    });
    expect(props.onUpdateGridCell).toHaveBeenCalledWith('one', 0, 0, 'ABC-999 Mi ticket');
  });

  it('"+ Fila" appends an empty row via onSetTabGrid', () => {
    const props = renderGrid();
    fireEvent.click(screen.getByText('+ Fila'));
    expect(props.onSetTabGrid).toHaveBeenCalledTimes(1);
    const [tab, newGrid] = (props.onSetTabGrid as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(tab).toBe('one');
    expect(newGrid).toHaveLength(4);
    expect(newGrid[3]).toEqual(['', '', '', '', '', '']);
  });

  it('dragDisabled removes the drag handles', () => {
    renderGrid({ dragDisabled: true });
    const handle = document.querySelector('tbody td');
    expect(handle).toHaveAttribute('draggable', 'false');
  });
});
```

- [ ] **Step 3: Ejecutar para verificar que fallan**

Run: `npm test -- src/components/TrackerGrid.test.tsx`
Expected: FAIL — `Failed to resolve import "./TrackerGrid"` (o `Cannot find module`).

- [ ] **Step 4: Crear `src/components/TrackerGrid.tsx`**

Es la extracción literal del spreadsheet de `SprintDashboard.tsx` actual con estas sustituciones: `sprint.tabGrid` → `tabGrid`, `TAB_LABELS`/`TAB_HEADERS` → props, `sprint.archived` → `dragDisabled`, clave de anchos → `colWidthsStorageKey`, placeholder → `searchPlaceholder`, y el enlace de celda encapsulado en `getLinkUrl` según `linkMode`. Contenido completo:

```tsx
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { STORAGE_KEYS } from '../config/constants';
import { useT } from '../i18n/I18nContext';

const TICKET_KEY_PATTERN = /^([A-Z]+-\d+)\b/;
const MIN_COL_WIDTH = 50;

function colToLetter(col: number): string {
  let letter = '';
  let n = col;
  while (n >= 0) {
    letter = String.fromCharCode(65 + (n % 26)) + letter;
    n = Math.floor(n / 26) - 1;
  }
  return letter;
}

export interface TrackerGridProps<T extends string> {
  tabs: readonly T[];
  tabLabels: Record<T, string>;
  tabHeaders: Record<T, string[]>;
  tabGrid: Record<T, string[][]>;
  linkMode: 'jira' | 'url';
  dragDisabled?: boolean;
  colWidthsStorageKey: string;
  searchPlaceholder: string;
  onUpdateGridCell: (tab: T, row: number, col: number, value: string) => void;
  onSetTabGrid: (tab: T, grid: string[][]) => void;
  onMoveRow: (tab: T, fromRow: number, toRow: number) => void;
}

export function TrackerGrid<T extends string>({
  tabs,
  tabLabels,
  tabHeaders,
  tabGrid,
  linkMode,
  dragDisabled = false,
  colWidthsStorageKey,
  searchPlaceholder,
  onUpdateGridCell,
  onSetTabGrid,
  onMoveRow,
}: TrackerGridProps<T>) {
  const [activeTab, setActiveTab] = useState<T>(tabs[0]);
  const [colWidths, setColWidths] = useLocalStorage<Record<string, number>>(colWidthsStorageKey, {});
  const [isResizing, setIsResizing] = useState(false);
  const [focusedCell, setFocusedCell] = useState<{ row: number; col: number } | null>(null);
  const [dragSourceRow, setDragSourceRow] = useState<number | null>(null);
  const [dragTargetRow, setDragTargetRow] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const t = useT();

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(value);
    }, 250);
  }, []);

  const clearSearch = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSearchQuery('');
    setDebouncedQuery('');
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);
  const resizeRef = useRef<{ col: number; startX: number; startWidth: number } | null>(null);
  const cellRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  useEffect(() => {
    if (!isResizing) return;
    const handleMouseMove = (e: MouseEvent) => {
      if (!resizeRef.current) return;
      const { col, startX, startWidth } = resizeRef.current;
      const diff = e.clientX - startX;
      const newWidth = Math.max(MIN_COL_WIDTH, startWidth + diff);
      setColWidths((prev) => ({ ...prev, [`${activeTab}-${col}`]: newWidth }));
    };
    const handleMouseUp = () => {
      resizeRef.current = null;
      setIsResizing(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, activeTab, setColWidths]);

  const startResize = (e: React.MouseEvent, col: number) => {
    e.preventDefault();
    e.stopPropagation();
    const currentWidth = colWidths[`${activeTab}-${col}`] || 120;
    resizeRef.current = { col, startX: e.clientX, startWidth: currentWidth };
    setIsResizing(true);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const grid = tabGrid[activeTab] || [];
  const colCount = grid[0]?.length || 6;

  const filteredRowIndices = useMemo(() => {
    if (!debouncedQuery.trim()) return null;
    const q = debouncedQuery.toLowerCase();
    const indices: number[] = [];
    for (let ri = 0; ri < grid.length; ri++) {
      const row = grid[ri];
      if (!row) continue;
      const matches = row.some((cell) => (cell || '').toLowerCase().includes(q));
      if (matches) indices.push(ri);
    }
    return indices;
  }, [grid, debouncedQuery]);

  const displayRowIndices = filteredRowIndices ?? Array.from({ length: grid.length }, (_, i) => i);
  const displayRowCount = displayRowIndices.length;

  const handleAddRow = () => {
    const newGrid = [...grid, Array.from({ length: colCount }, () => '')];
    onSetTabGrid(activeTab, newGrid);
  };

  const getCellValue = (row: number, col: number) => {
    return grid[row]?.[col] || '';
  };

  const baseUrl = (useLocalStorage(STORAGE_KEYS.TRACKER_BASE_URL, '')[0] || '').replace(/\/+$/, '');

  const getLinkUrl = (value: string): string | null => {
    if (linkMode === 'jira') {
      const m = value.match(TICKET_KEY_PATTERN);
      return m ? `${baseUrl}/browse/${m[1]}` : null;
    }
    return null;
  };

  const handleDragStart = (e: React.DragEvent, ri: number) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(ri));
    setDragSourceRow(ri);
    setDragTargetRow(ri);
  };

  const handleDragOver = (e: React.DragEvent, ri: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragSourceRow !== null) setDragTargetRow(ri);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (dragSourceRow !== null && dragTargetRow !== null && dragSourceRow !== dragTargetRow) {
      onMoveRow(activeTab, dragSourceRow, dragTargetRow);
    }
    setDragSourceRow(null);
    setDragTargetRow(null);
  };

  const handleDragEnd = () => {
    setDragSourceRow(null);
    setDragTargetRow(null);
  };

  return (
    <div>
      <div className="sprint-tabs">
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            className={`btn-ghost ${activeTab === tab ? 'sprint-tab-active' : ''}`}
            onClick={() => { setActiveTab(tab); clearSearch(); }}
          >
            {tabLabels[tab]}
          </button>
        ))}
        <a
          href="https://chromewebstore.google.com/detail/SnapLink/nooilpnmljdmpdknbkckjiieafoaikfc?utm_source=ext_app_menu"
          target="_blank"
          rel="noopener noreferrer"
          className="btn-ghost"
          style={{ marginLeft: 'auto', padding: '6px 14px', fontSize: 12, textDecoration: 'none' }}
          title="Descargar extensión SnapLink para Chrome"
        >
          + SnapLink
        </a>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginTop: 10, gap: 8 }}>
        {searchQuery.trim() && (
          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
            {displayRowCount} {t('sprint.rowsOf')} {grid.length} {t('common.rows')}
          </span>
        )}
        <input
          type="text"
          placeholder={searchPlaceholder}
          value={searchQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Escape') clearSearch(); }}
          style={{
            width: 240, height: 30, padding: '0 10px', fontSize: 12,
            fontFamily: 'var(--font-ui)', background: 'var(--surface-2)',
            color: 'var(--text)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)', outline: 'none',
          }}
        />
      </div>

      <div style={{ marginTop: 12, overflowX: 'auto', width: '100%', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
        <table style={{ borderCollapse: 'collapse', fontSize: 12, fontFamily: 'var(--font-mono)', tableLayout: 'fixed', width: '100%' }}>
          <colgroup>
            <col style={{ width: 44 }} />
            {Array.from({ length: colCount }, (_, ci) => {
              const w = colWidths[`${activeTab}-${ci}`];
              return <col key={ci} style={w ? { width: w } : undefined} />;
            })}
          </colgroup>
          <thead>
            <tr>
              <th style={{
                position: 'sticky', top: 0, left: 0, zIndex: 2,
                width: 44, minWidth: 44, height: 28, background: 'var(--surface-2)',
                border: '1px solid var(--border)', fontSize: 10, color: 'var(--text-3)',
              }}></th>
              {Array.from({ length: colCount }, (_, ci) => (
                <th key={ci} style={{
                  position: 'sticky', top: 0, zIndex: 1,
                  height: 28, background: 'var(--surface-2)',
                  border: '1px solid var(--border)', fontSize: 11, fontWeight: 700,
                  color: 'var(--text-3)', textAlign: 'center',
                }}>
                  {colToLetter(ci)}
                  <div
                    onMouseDown={(e) => startResize(e, ci)}
                    style={{
                      position: 'absolute', right: -1, top: 0, width: 5, height: '100%',
                      cursor: 'col-resize', zIndex: 10,
                    }}
                  />
                </th>
              ))}
            </tr>
            <tr>
              <th style={{
                position: 'sticky', top: 28, left: 0, zIndex: 2,
                width: 44, minWidth: 44, height: 26, background: 'var(--surface-2)',
                border: '1px solid var(--border)', fontSize: 10, color: 'var(--text-3)',
              }}></th>
              {Array.from({ length: colCount }, (_, ci) => (
                <th key={ci} style={{
                  position: 'sticky', top: 28, zIndex: 1,
                  height: 26, background: 'var(--surface-2)',
                  border: '1px solid var(--border)', fontSize: 11, fontWeight: 700,
                  color: 'var(--text-2)', textAlign: 'left',
                  padding: '0 6px',
                }}>{tabHeaders[activeTab][ci] || ''}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayRowIndices.map((ri, pos) => {
              const isDragging = dragSourceRow === ri;
              const isDropTarget = dragTargetRow === ri && dragSourceRow !== ri;
              return (
              <tr
                key={ri}
                onDragOver={(e) => handleDragOver(e, ri)}
                onDrop={handleDrop}
                style={{
                  opacity: isDragging ? 0.4 : undefined,
                  borderTop: isDropTarget ? '2px solid var(--accent)' : undefined,
                }}
              >
                <td
                  draggable={!dragDisabled}
                  onDragStart={(e) => !dragDisabled ? handleDragStart(e, ri) : e.preventDefault()}
                  onDragEnd={handleDragEnd}
                  style={{
                    position: 'sticky', left: 0, zIndex: 1,
                    width: 44, minWidth: 44, height: 28, background: 'var(--surface-2)',
                    border: '1px solid var(--border)', fontSize: 10, color: 'var(--text-3)',
                    textAlign: 'center', fontWeight: 700,
                    cursor: dragDisabled ? undefined : 'grab',
                  }}
                >
                  {!dragDisabled && (
                    <span style={{ marginRight: 2, fontSize: 12, lineHeight: 1, verticalAlign: 'middle', opacity: 0.5 }}>&#x22EE;&#x22EE;</span>
                  )}
                  {ri + 1}
                </td>
                {Array.from({ length: colCount }, (_, ci) => {
                  const value = getCellValue(ri, ci);
                  const linkUrl = ci === 0 ? getLinkUrl(value) : null;
                  const ticketKey = linkMode === 'jira' && linkUrl ? value.match(TICKET_KEY_PATTERN)![1] : null;
                  const isFocused = focusedCell?.row === ri && focusedCell?.col === ci;
                  const showFocus = linkUrl && isFocused;
                  return (
                    <td
                      key={ci}
                      onClick={(e) => {
                        if (linkUrl && e.ctrlKey) {
                          window.open(linkUrl, '_blank');
                        }
                      }}
                      title={ticketKey ? t('sprint.openTicket', { ticket: ticketKey }) : undefined}
                      style={{
                        border: '1px solid var(--border)', padding: 0, position: 'relative', overflow: 'hidden',
                        cursor: linkUrl ? 'pointer' : undefined,
                        background: showFocus ? 'var(--accent-weak)' : undefined,
                        outline: showFocus ? '1px solid var(--accent)' : undefined,
                        outlineOffset: -1,
                      }}
                    >
                      <input
                        type="text"
                        data-row={ri}
                        data-col={ci}
                        ref={(el) => {
                          const key = `${ri}-${ci}`;
                          if (el) cellRefs.current.set(key, el);
                          else cellRefs.current.delete(key);
                        }}
                        value={value}
                        onChange={(e) => onUpdateGridCell(activeTab, ri, ci, e.target.value)}
                        onKeyDown={(e) => {
                          const key = e.key;
                          let nextPos = pos;
                          let tc = ci;
                          if (key === 'ArrowUp') nextPos--;
                          else if (key === 'ArrowDown') nextPos++;
                          else if (key === 'ArrowLeft') {
                            const input = e.currentTarget as HTMLInputElement;
                            if (input.selectionStart !== 0 || input.selectionEnd !== 0) return;
                            tc--;
                          } else if (key === 'ArrowRight') {
                            const input = e.currentTarget as HTMLInputElement;
                            const len = input.value.length;
                            if (input.selectionStart !== len || input.selectionEnd !== len) return;
                            tc++;
                          } else return;
                          if (nextPos < 0 || nextPos >= displayRowIndices.length || tc < 0 || tc >= colCount) return;
                          e.preventDefault();
                          const tr = key === 'ArrowUp' || key === 'ArrowDown' ? displayRowIndices[nextPos] : ri;
                          cellRefs.current.get(`${tr}-${tc}`)?.focus();
                        }}
                        onFocus={() => setFocusedCell({ row: ri, col: ci })}
                        onBlur={() => setFocusedCell((prev) => {
                          if (prev?.row === ri && prev?.col === ci) return null;
                          return prev;
                        })}
                        onPaste={linkMode === 'jira' ? (e) => {
                          const text = e.clipboardData.getData('text/plain');
                          const snapLinkMatch = text.match(/^(.+?)\s*-\s*(https?:\/\/[^\s]+\/browse\/([A-Z]+-\d+))/i);
                          if (snapLinkMatch) {
                            e.preventDefault();
                            onUpdateGridCell(activeTab, ri, ci, `${snapLinkMatch[3].toUpperCase()} ${snapLinkMatch[1].trim()}`);
                            return;
                          }
                          const urlMatch = text.match(/\/browse\/([A-Z]+-\d+)/i);
                          if (urlMatch) {
                            e.preventDefault();
                            onUpdateGridCell(activeTab, ri, ci, urlMatch[1].toUpperCase());
                          }
                        } : undefined}
                        style={{
                          width: '100%', height: 28, border: 'none', outline: 'none',
                          padding: '0 6px', fontSize: 12, fontFamily: 'var(--font-mono)',
                          background: 'transparent', color: linkUrl ? 'var(--accent)' : 'var(--text)',
                          fontWeight: linkUrl ? 600 : 400,
                          caretColor: linkUrl ? 'transparent' : undefined,
                          cursor: linkUrl ? 'pointer' : undefined,
                        }}
                      />
                    </td>
                  );
                })}
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {!searchQuery.trim() && (
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button type="button" className="btn-ghost" onClick={handleAddRow} style={{ padding: '6px 14px', fontSize: 13 }}>
            {t('sprint.addRow')}
          </button>
        </div>
      )}
    </div>
  );
}
```

Nota: la dependencia `setColWidths` se añade al `useEffect` del resize porque el linter puede exigirla; es estable (viene de `useLocalStorage`).

- [ ] **Step 5: Ejecutar los tests nuevos**

Run: `npm test -- src/components/TrackerGrid.test.tsx`
Expected: PASS (6 tests).

- [ ] **Step 6: Reescribir `src/components/SprintDashboard.tsx` como envoltorio**

Contenido completo del fichero:

```tsx
import type { Sprint, TabId } from '../hooks/useSprints';
import { STORAGE_KEYS } from '../config/constants';
import { useT } from '../i18n/I18nContext';
import { TrackerGrid } from './TrackerGrid';

const TABS: readonly TabId[] = ['resolved', 'created', 'reopened', 'highPriority', 'jsd'];

const TAB_LABELS: Record<TabId, string> = {
  resolved: 'Resueltos',
  created: 'Creados',
  reopened: 'ReOpen',
  highPriority: 'Prioridad Alta',
  jsd: 'JSD',
};

const TAB_HEADERS: Record<TabId, string[]> = {
  resolved: ['Ticket', 'Fecha', 'Prioridad', 'Autor', 'Squad'],
  created: ['Ticket', 'Fecha', 'Prioridad', 'Autor', 'Squad'],
  reopened: ['Ticket', 'Fecha', 'Motivo', 'Squad'],
  highPriority: ['Ticket', 'Fecha', 'Motivo', 'Squad'],
  jsd: ['JSD', 'Fecha', 'Motivo'],
};

interface SprintDashboardProps {
  sprint: Sprint;
  onUpdateGridCell: (tabId: TabId, row: number, col: number, value: string) => void;
  onSetTabGrid: (tabId: TabId, grid: string[][]) => void;
  onMoveRow: (tabId: TabId, fromRow: number, toRow: number) => void;
  onArchive: () => void;
}

export function SprintDashboard({ sprint, onUpdateGridCell, onSetTabGrid, onMoveRow, onArchive }: SprintDashboardProps) {
  const t = useT();

  return (
    <div className="sprint-dashboard">
      <TrackerGrid
        tabs={TABS}
        tabLabels={TAB_LABELS}
        tabHeaders={TAB_HEADERS}
        tabGrid={sprint.tabGrid}
        linkMode="jira"
        dragDisabled={sprint.archived}
        colWidthsStorageKey={`${STORAGE_KEYS.SPRINT_COL_WIDTHS}_${sprint.id}`}
        searchPlaceholder={t('sprint.searchPlaceholder')}
        onUpdateGridCell={onUpdateGridCell}
        onSetTabGrid={onSetTabGrid}
        onMoveRow={onMoveRow}
      />

      {!sprint.archived && (
        <div className="actions-bar">
          <button type="button" className="btn-ghost" onClick={onArchive}>
            {t('sprint.archive')}
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 7: Ejecutar la suite completa + lint**

Run: `npm test` y después `npm run lint`
Expected: `Tests 231 passed` (225 + 6 nuevos), 28 ficheros. Lint sin errores.

- [ ] **Step 8: Commit**

```bash
git add src/components/TrackerGrid.tsx src/components/TrackerGrid.test.tsx src/components/SprintDashboard.tsx
git commit -m "refactor(tracker): extract shared TrackerGrid from SprintDashboard

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

