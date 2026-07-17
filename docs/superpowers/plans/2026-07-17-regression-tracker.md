# Regression Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir la herramienta Regression Tracker (tablero único de regresiones con 4 pestañas de plataforma) reutilizando el spreadsheet del Sprint Tracker extraído a un componente compartido `TrackerGrid`.

**Architecture:** Se extrae el spreadsheet de `SprintDashboard` a `TrackerGrid<T>` (genérico por id de pestaña, con `linkMode: 'jira' | 'url'` y `readOnly`). `SprintDashboard` queda como envoltorio fino sin cambio de comportamiento. `RegressionTracker` usa `TrackerGrid` con el hook nuevo `useRegressions` (tablero único + snapshots archivados en localStorage).

**Tech Stack:** React 18 + TypeScript + Vite. Tests con Vitest + React Testing Library (jsdom). Sin dependencias nuevas.

**Spec:** `docs/superpowers/specs/2026-07-17-regression-tracker-design.md`

## Global Constraints

- Todo se ejecuta desde `acgen/` (la raíz del repo git). Comandos: `npm test -- <fichero>` para un fichero, `npm test` para toda la suite, `npm run lint`, `npm run build`.
- Rama de trabajo: `feat/regression-tracker` (ya creada, contiene el spec).
- **Los 225 tests existentes deben seguir en verde en todo momento.** No se cambia ninguna aserción de comportamiento del Sprint Tracker.
- Toda cadena visible de UI pasa por i18n (`useT()`), con claves en `src/i18n/es.json` y `src/i18n/en.json` en paridad exacta (guardada por `src/i18n/keyParity.test.ts`). Excepciones (literales sin traducir, como en sprints): etiquetas de pestaña `iOS`, `Android`, `Web-Desktop`, `Web-Mobile` y cabeceras de columna `Regresión, Versión, Fecha, Notas, Status`.
- Grid por pestaña: 20 filas × 6 columnas (columna F vacía sin cabecera), igual que sprints.
- Persistencia: clave `acgen_regressions`; anchos de columna en `acgen_regression_col_widths`. Escrituras a localStorage siempre con try/catch (patrón de `useSprints`).
- Estilo de código: el de los ficheros vecinos (inline styles con tokens `var(--...)`, componentes función, `useCallback`).
- Commits frecuentes, uno por tarea como mínimo, terminados en:
  `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`

---

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

### Task 2: `linkMode: 'url'` y `readOnly` en `TrackerGrid`

**Files:**
- Modify: `src/components/TrackerGrid.tsx`
- Modify: `src/components/TrackerGrid.test.tsx`
- Modify: `src/i18n/es.json`, `src/i18n/en.json` (clave `regression.openLink`)

**Interfaces:**
- Consumes: `TrackerGrid`/`TrackerGridProps` de la Task 1.
- Produces: prop nueva `readOnly?: boolean` en `TrackerGridProps` (la usa la Task 4 para snapshots). En `linkMode: 'url'`, una celda de la columna A cuyo valor completo sea `Nombre - URL` o solo `URL` (patrón `/^(?:.+?\s*-\s*)?(https?:\/\/\S+)$/`) se pinta como enlace y Ctrl+clic abre la URL exacta.

- [ ] **Step 1: Añadir los tests (fallan)**

Añadir al final de `src/components/TrackerGrid.test.tsx`:

```tsx
describe('TrackerGrid — url mode', () => {
  function renderUrlGrid(cell0: string, overrides: Partial<TrackerGridProps<Tab>> = {}) {
    const grid = makeGrid();
    grid[0][0] = cell0;
    return renderGrid({ linkMode: 'url', tabGrid: { one: grid, two: makeGrid() }, ...overrides });
  }

  it('ctrl+click on "Nombre - URL" opens the exact URL', () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    renderUrlGrid('Smoke Login - https://zephyr.example.com/plan/9');
    fireEvent.click(screen.getByDisplayValue('Smoke Login - https://zephyr.example.com/plan/9'), { ctrlKey: true });
    expect(open).toHaveBeenCalledWith('https://zephyr.example.com/plan/9', '_blank');
  });

  it('a bare URL is also a link', () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    renderUrlGrid('https://zephyr.example.com/plan/9');
    fireEvent.click(screen.getByDisplayValue('https://zephyr.example.com/plan/9'), { ctrlKey: true });
    expect(open).toHaveBeenCalledWith('https://zephyr.example.com/plan/9', '_blank');
  });

  it('plain text is not a link', () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    renderUrlGrid('Smoke Login sin enlace');
    fireEvent.click(screen.getByDisplayValue('Smoke Login sin enlace'), { ctrlKey: true });
    expect(open).not.toHaveBeenCalled();
  });

  it('link cells get the accent styling', () => {
    renderUrlGrid('Smoke Login - https://zephyr.example.com/plan/9');
    const input = screen.getByDisplayValue('Smoke Login - https://zephyr.example.com/plan/9') as HTMLInputElement;
    expect(input.style.color).toBe('var(--accent)');
  });
});

describe('TrackerGrid — readOnly', () => {
  it('inputs are readOnly, no "+ Fila", no drag handles', () => {
    renderGrid({ readOnly: true });
    const input = document.querySelector('tbody input') as HTMLInputElement;
    expect(input).toHaveAttribute('readonly');
    expect(screen.queryByText('+ Fila')).not.toBeInTheDocument();
    const handle = document.querySelector('tbody td');
    expect(handle).toHaveAttribute('draggable', 'false');
  });
});
```

- [ ] **Step 2: Ejecutar para verificar que fallan**

Run: `npm test -- src/components/TrackerGrid.test.tsx`
Expected: FAIL — los 4 tests de url mode (window.open no llamado / estilo no accent) y el de readOnly (`readonly` ausente).

- [ ] **Step 3: Implementar en `TrackerGrid.tsx`**

3a. Añadir el patrón junto a `TICKET_KEY_PATTERN`:

```tsx
const URL_CELL_PATTERN = /^(?:.+?\s*-\s*)?(https?:\/\/\S+)$/;
```

3b. Añadir `readOnly` a la interfaz y a la desestructuración de props:

```tsx
  linkMode: 'jira' | 'url';
  dragDisabled?: boolean;
  readOnly?: boolean;
```

```tsx
  dragDisabled = false,
  readOnly = false,
```

3c. Calcular el bloqueo de edición una vez, después de la desestructuración (primera línea del cuerpo):

```tsx
  const noDrag = dragDisabled || readOnly;
```

y sustituir TODAS las apariciones de `dragDisabled` del JSX (`draggable={!dragDisabled}`, `onDragStart`, `cursor`, el span `⋮⋮`) por `noDrag`.

3d. Completar `getLinkUrl`:

```tsx
  const getLinkUrl = (value: string): string | null => {
    if (linkMode === 'jira') {
      const m = value.match(TICKET_KEY_PATTERN);
      return m ? `${baseUrl}/browse/${m[1]}` : null;
    }
    const m = value.match(URL_CELL_PATTERN);
    return m ? m[1] : null;
  };
```

3e. En el `<input>` de celda, añadir el atributo y el title del modo url:

```tsx
                        readOnly={readOnly}
```

y cambiar el `title` del `<td>`:

```tsx
                      title={ticketKey ? t('sprint.openTicket', { ticket: ticketKey }) : linkUrl ? t('regression.openLink') : undefined}
```

3f. Ocultar "+ Fila" en readOnly:

```tsx
      {!searchQuery.trim() && !readOnly && (
```

3g. Añadir la clave i18n en `src/i18n/es.json` (junto a las claves `sprint.*`):

```json
  "regression.openLink": "Abrir enlace",
```

y en `src/i18n/en.json`:

```json
  "regression.openLink": "Open link",
```

- [ ] **Step 4: Ejecutar los tests**

Run: `npm test -- src/components/TrackerGrid.test.tsx src/i18n/keyParity.test.ts`
Expected: PASS (11 tests de TrackerGrid + 2 de paridad).

- [ ] **Step 5: Suite completa y commit**

Run: `npm test`
Expected: `Tests 236 passed`.

```bash
git add src/components/TrackerGrid.tsx src/components/TrackerGrid.test.tsx src/i18n/es.json src/i18n/en.json
git commit -m "feat(tracker): url link mode and readOnly support in TrackerGrid

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Hook `useRegressions`

**Files:**
- Create: `src/hooks/useRegressions.ts`
- Create: `src/hooks/useRegressions.test.ts`

**Interfaces:**
- Consumes: nada del resto de tareas (hook autocontenido; persiste en la clave literal `'acgen_regressions'`).
- Produces (lo consume la Task 4):

```ts
export type PlatformId = 'ios' | 'android' | 'webDesktop' | 'webMobile';
export const PLATFORM_IDS: readonly PlatformId[];
export interface ArchivedRegression {
  id: string;
  name: string;        // "Regresión YYYY-MM-DD"
  archivedAt: string;  // YYYY-MM-DD local
  board: Record<PlatformId, string[][]>;
}
export function useRegressions(): {
  board: Record<PlatformId, string[][]>;
  archived: ArchivedRegression[];
  updateGridCell: (tab: PlatformId, row: number, col: number, value: string) => void;
  setTabGrid: (tab: PlatformId, grid: string[][]) => void;
  moveRow: (tab: PlatformId, fromRow: number, toRow: number) => void;
  archiveBoard: () => void;
  deleteArchived: (id: string) => void;
};
```

- [ ] **Step 1: Escribir el test (falla)**

Crear `src/hooks/useRegressions.test.ts`:

```ts
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useRegressions, PLATFORM_IDS } from './useRegressions';

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useRegressions', () => {
  it('initializes with an empty 20x6 board per platform and no archived', () => {
    const { result } = renderHook(() => useRegressions());
    expect(PLATFORM_IDS).toEqual(['ios', 'android', 'webDesktop', 'webMobile']);
    for (const p of PLATFORM_IDS) {
      expect(result.current.board[p]).toHaveLength(20);
      expect(result.current.board[p][0]).toHaveLength(6);
      expect(result.current.board[p][0][0]).toBe('');
    }
    expect(result.current.archived).toEqual([]);
  });

  it('updateGridCell writes a value in the right platform', () => {
    const { result } = renderHook(() => useRegressions());
    act(() => {
      result.current.updateGridCell('android', 2, 1, 'v9.1.0');
    });
    expect(result.current.board.android[2][1]).toBe('v9.1.0');
    expect(result.current.board.ios[2][1]).toBe('');
  });

  it('persists to localStorage and hydrates on a fresh mount', () => {
    const first = renderHook(() => useRegressions());
    act(() => {
      first.result.current.updateGridCell('ios', 0, 0, 'Smoke - https://z.example/p/1');
    });
    first.unmount();
    const second = renderHook(() => useRegressions());
    expect(second.result.current.board.ios[0][0]).toBe('Smoke - https://z.example/p/1');
  });

  it('setTabGrid replaces the whole grid of one platform', () => {
    const { result } = renderHook(() => useRegressions());
    const newGrid = [['a', 'b', 'c', 'd', 'e', 'f']];
    act(() => {
      result.current.setTabGrid('webDesktop', newGrid);
    });
    expect(result.current.board.webDesktop).toEqual(newGrid);
    expect(result.current.board.webMobile).toHaveLength(20);
  });

  it('moveRow reorders rows', () => {
    const { result } = renderHook(() => useRegressions());
    act(() => {
      result.current.updateGridCell('ios', 0, 0, 'primera');
      result.current.updateGridCell('ios', 1, 0, 'segunda');
    });
    act(() => {
      result.current.moveRow('ios', 0, 2);
    });
    expect(result.current.board.ios[0][0]).toBe('segunda');
    expect(result.current.board.ios[1][0]).toBe('primera');
  });

  it('moveRow ignores out-of-range indices', () => {
    const { result } = renderHook(() => useRegressions());
    act(() => {
      result.current.updateGridCell('ios', 0, 0, 'fija');
    });
    act(() => {
      result.current.moveRow('ios', -1, 5);
      result.current.moveRow('ios', 0, 99);
    });
    expect(result.current.board.ios[0][0]).toBe('fija');
  });

  it('archiveBoard snapshots the board, clears it and names it with today', () => {
    const { result } = renderHook(() => useRegressions());
    act(() => {
      result.current.updateGridCell('webMobile', 0, 0, 'Regresión checkout');
    });
    act(() => {
      result.current.archiveBoard();
    });
    expect(result.current.archived).toHaveLength(1);
    const snap = result.current.archived[0];
    expect(snap.id).toBeTruthy();
    expect(snap.name).toMatch(/^Regresión \d{4}-\d{2}-\d{2}$/);
    expect(snap.archivedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(snap.board.webMobile[0][0]).toBe('Regresión checkout');
    expect(result.current.board.webMobile[0][0]).toBe('');
  });

  it('archiveBoard persists snapshot and cleared board', () => {
    const first = renderHook(() => useRegressions());
    act(() => {
      first.result.current.updateGridCell('ios', 0, 0, 'algo');
      first.result.current.archiveBoard();
    });
    first.unmount();
    const second = renderHook(() => useRegressions());
    expect(second.result.current.archived).toHaveLength(1);
    expect(second.result.current.board.ios[0][0]).toBe('');
  });

  it('deleteArchived removes a snapshot', () => {
    const { result } = renderHook(() => useRegressions());
    act(() => {
      result.current.archiveBoard();
    });
    const id = result.current.archived[0].id;
    act(() => {
      result.current.deleteArchived(id);
    });
    expect(result.current.archived).toEqual([]);
  });

  it('recovers from corrupt JSON in localStorage', () => {
    localStorage.setItem('acgen_regressions', '{no es json');
    const { result } = renderHook(() => useRegressions());
    expect(result.current.board.ios).toHaveLength(20);
    expect(result.current.archived).toEqual([]);
  });

  it('merges missing platforms when hydrating old data', () => {
    localStorage.setItem('acgen_regressions', JSON.stringify({
      board: { ios: [['x', '', '', '', '', '']] },
      archived: [],
    }));
    const { result } = renderHook(() => useRegressions());
    expect(result.current.board.ios[0][0]).toBe('x');
    expect(result.current.board.android).toHaveLength(20);
    expect(result.current.board.webDesktop).toHaveLength(20);
    expect(result.current.board.webMobile).toHaveLength(20);
  });

  it('keeps changes in memory even when localStorage.setItem throws (quota exceeded)', () => {
    const { result } = renderHook(() => useRegressions());
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError');
    });
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    act(() => {
      result.current.updateGridCell('ios', 0, 0, 'sobrevive');
    });
    expect(result.current.board.ios[0][0]).toBe('sobrevive');
    expect(errSpy).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Ejecutar para verificar que falla**

Run: `npm test -- src/hooks/useRegressions.test.ts`
Expected: FAIL — `Failed to resolve import "./useRegressions"`.

- [ ] **Step 3: Crear `src/hooks/useRegressions.ts`**

Contenido completo:

```ts
import { useState, useCallback } from 'react';

const STORAGE_KEY = 'acgen_regressions';

export type PlatformId = 'ios' | 'android' | 'webDesktop' | 'webMobile';

export const PLATFORM_IDS: readonly PlatformId[] = ['ios', 'android', 'webDesktop', 'webMobile'];

export interface ArchivedRegression {
  id: string;
  name: string;
  archivedAt: string;
  board: Record<PlatformId, string[][]>;
}

interface RegressionState {
  board: Record<PlatformId, string[][]>;
  archived: ArchivedRegression[];
}

function createEmptyGrid(rows: number = 20, cols: number = 6): string[][] {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => ''));
}

function emptyBoard(): Record<PlatformId, string[][]> {
  return {
    ios: createEmptyGrid(),
    android: createEmptyGrid(),
    webDesktop: createEmptyGrid(),
    webMobile: createEmptyGrid(),
  };
}

function persist(state: RegressionState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.error('No se pudo guardar el regression tracker en localStorage:', err);
  }
}

function localToday(): string {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}

export function useRegressions() {
  const [state, setState] = useState<RegressionState>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { board: emptyBoard(), archived: [] };
      const parsed = JSON.parse(raw);
      const archived: ArchivedRegression[] = Array.isArray(parsed.archived)
        ? parsed.archived.map((a: ArchivedRegression) => ({
            ...a,
            board: { ...emptyBoard(), ...(a.board || {}) },
          }))
        : [];
      return {
        board: { ...emptyBoard(), ...(parsed.board || {}) },
        archived,
      };
    } catch {
      return { board: emptyBoard(), archived: [] };
    }
  });

  const updateGridCell = useCallback((tab: PlatformId, row: number, col: number, value: string) => {
    setState((prev) => {
      const grid = prev.board[tab] || [];
      const newGrid = grid.map((r, ri) => {
        if (ri !== row) return r;
        const newRow = [...r];
        while (newRow.length <= col) newRow.push('');
        newRow[col] = value;
        return newRow;
      });
      const updated = { ...prev, board: { ...prev.board, [tab]: newGrid } };
      persist(updated);
      return updated;
    });
  }, []);

  const setTabGrid = useCallback((tab: PlatformId, grid: string[][]) => {
    setState((prev) => {
      const updated = { ...prev, board: { ...prev.board, [tab]: grid } };
      persist(updated);
      return updated;
    });
  }, []);

  const moveRow = useCallback((tab: PlatformId, fromRow: number, toRow: number) => {
    setState((prev) => {
      const grid = prev.board[tab] || [];
      if (fromRow < 0 || fromRow >= grid.length || toRow < 0 || toRow >= grid.length) return prev;
      if (fromRow === toRow) return prev;
      const newGrid = [...grid];
      const [movedRow] = newGrid.splice(fromRow, 1);
      const targetIndex = fromRow < toRow ? toRow - 1 : toRow;
      newGrid.splice(targetIndex, 0, movedRow);
      const updated = { ...prev, board: { ...prev.board, [tab]: newGrid } };
      persist(updated);
      return updated;
    });
  }, []);

  const archiveBoard = useCallback(() => {
    const date = localToday();
    setState((prev) => {
      const snapshot: ArchivedRegression = {
        id: crypto.randomUUID(),
        name: `Regresión ${date}`,
        archivedAt: date,
        board: prev.board,
      };
      const updated = { board: emptyBoard(), archived: [snapshot, ...prev.archived] };
      persist(updated);
      return updated;
    });
  }, []);

  const deleteArchived = useCallback((id: string) => {
    setState((prev) => {
      const updated = { ...prev, archived: prev.archived.filter((a) => a.id !== id) };
      persist(updated);
      return updated;
    });
  }, []);

  return { board: state.board, archived: state.archived, updateGridCell, setTabGrid, moveRow, archiveBoard, deleteArchived };
}
```

- [ ] **Step 4: Ejecutar los tests**

Run: `npm test -- src/hooks/useRegressions.test.ts`
Expected: PASS (12 tests).

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useRegressions.ts src/hooks/useRegressions.test.ts
git commit -m "feat(regression): useRegressions hook with single board + archived snapshots

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

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

### Task 5: Integración — routing, landing, sidebar, icono

**Files:**
- Modify: `src/config/constants.ts` (línea del `ViewType`, actualmente 81)
- Modify: `src/App.tsx` (imports ~línea 10, `VALID_VIEWS` línea 25, render tras el bloque `sprinttracker` línea 176-178)
- Modify: `src/components/Icons.tsx` (añadir `regression` al objeto `Icon`, tras `sprint`)
- Modify: `src/components/LandingScreen.tsx` (tipo de `onSelect` línea 6, array `tools` tras la entrada `sprinttracker`)
- Modify: `src/components/Sidebar.tsx` (array `TOOLS`, tras la entrada `sprinttracker`)
- Modify: `src/components/LandingScreen.test.tsx`

**Interfaces:**
- Consumes: `RegressionTracker` (Task 4), claves i18n `landing.tool.regressiontracker(+Desc)` y `sidebar.regression` (Task 4).
- Produces: vista `'regressiontracker'` accesible por hash `#/regressiontracker`, tarjeta décima en landing, entrada en sidebar (grupo Seguimiento).

- [ ] **Step 1: Actualizar los tests de landing (fallan)**

En `src/components/LandingScreen.test.tsx`:

Test `renders the 9 tool buttons` pasa a:

```tsx
  it('renders the 10 tool buttons', () => {
    renderLanding();
    const list = document.querySelector('.tool-list');
    expect(list?.querySelectorAll('.tool-row')).toHaveLength(10);
  });
```

Test del slot pasa a:

```tsx
  it('places the "more coming" slot inside the tool grid as its 11th cell', () => {
    renderLanding();
    const list = document.querySelector('.tool-list');
    const slot = list?.querySelector('.add-slot');
    expect(slot).not.toBeNull();
    expect(list?.children).toHaveLength(11);
  });
```

- [ ] **Step 2: Ejecutar para verificar que fallan**

Run: `npm test -- src/components/LandingScreen.test.tsx`
Expected: FAIL — `expected 9 to be 10` y `expected 10 to be 11`.

- [ ] **Step 3: `ViewType` y `App.tsx`**

En `src/config/constants.ts`, la línea del tipo queda:

```ts
export type ViewType = 'landing' | 'acceptance' | 'testcase' | 'bugreport' | 'testdata' | 'sprinttracker' | 'regressiontracker' | 'userstory' | 'refiner' | 'edgecase' | 'converter';
```

En `src/App.tsx`:

Import (tras el de `SprintTracker`):

```tsx
import { RegressionTracker } from './components/RegressionTracker';
```

`VALID_VIEWS` queda:

```tsx
const VALID_VIEWS: ViewType[] = ['landing', 'acceptance', 'testcase', 'bugreport', 'testdata', 'sprinttracker', 'regressiontracker', 'userstory', 'refiner', 'edgecase', 'converter'];
```

Render, justo después del bloque `{view === 'sprinttracker' && (...)}`:

```tsx
          {view === 'regressiontracker' && (
            <RegressionTracker />
          )}
```

- [ ] **Step 4: Icono `Icon.regression`**

En `src/components/Icons.tsx`, dentro del objeto `Icon`, después de la entrada `sprint`: flecha circular de re-ejecución con check dentro (mismo estilo: 24×24, stroke 1.6, `currentColor`):

```tsx
  regression: (p: SvgProps) => (
    <Svg {...p}>
      <path d="M20 12a8 8 0 1 1-2.34-5.66" />
      <path d="M20 4v4h-4" />
      <path d="m8.8 12.5 2.2 2.2 4.2-4.2" />
    </Svg>
  ),
```

- [ ] **Step 5: Landing y Sidebar**

En `src/components/LandingScreen.tsx`:

El tipo de `onSelect` (línea 6) queda:

```tsx
  onSelect: (view: 'acceptance' | 'testcase' | 'bugreport' | 'testdata' | 'userstory' | 'refiner' | 'edgecase' | 'converter' | 'sprinttracker' | 'regressiontracker') => void;
```

En el array `tools`, después de la entrada `sprinttracker`:

```tsx
  {
    id: 'regressiontracker' as const,
    icon: Icon.regression,
    titleKey: 'landing.tool.regressiontracker',
    descKey: 'landing.tool.regressiontrackerDesc',
    tag: 'Tracking',
  },
```

En `src/components/Sidebar.tsx`, en el array `TOOLS`, después de la entrada `sprinttracker`:

```tsx
  { view: 'regressiontracker' as ViewType, icon: Icon.regression, labelKey: 'sidebar.regression', categoryKey: 'sidebar.seguimiento' },
```

- [ ] **Step 6: Ejecutar tests de landing y suite completa**

Run: `npm test -- src/components/LandingScreen.test.tsx`
Expected: PASS (4 tests).

Run: `npm test`
Expected: `Tests 254 passed` (mismo total: landing sigue con 4 tests).

- [ ] **Step 7: Verificación manual en dev**

Run: `npm run dev` y abrir `http://localhost:5173/#/regressiontracker`.
Comprobar: la tarjeta aparece en landing y navega; las 4 pestañas cambian de grid; pegar `Nombre - URL` en la columna A pinta el enlace y Ctrl+clic lo abre; "Archivar Regresión" pide confirmación, vacía el tablero y aparece "Archivadas (1)"; el snapshot se abre en solo-lectura. Parar el server al acabar.

- [ ] **Step 8: Commit**

```bash
git add src/config/constants.ts src/App.tsx src/components/Icons.tsx src/components/LandingScreen.tsx src/components/Sidebar.tsx src/components/LandingScreen.test.tsx
git commit -m "feat(regression): wire Regression Tracker into routing, landing and sidebar

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Sincronizar AGENTS.md y verificación final

**Files:**
- Modify: `AGENTS.md`

**Interfaces:**
- Consumes: los totales reales de la suite tras las Tasks 1-5 (esperado: 254 tests / 30 ficheros — verificar con la salida real de `npm test` y usar ESOS números).
- Produces: AGENTS.md fiel al estado del repo.

- [ ] **Step 1: Ejecutar la suite y anotar los totales reales**

Run: `npm test`
Expected: `Test Files 30 passed (30)`, `Tests 254 passed (254)`. Si difiere, usar los números reales en los pasos siguientes.

- [ ] **Step 2: Actualizar AGENTS.md**

1. Tabla de tests — añadir tres filas y actualizar la de LandingScreen:

```markdown
| `src/components/TrackerGrid.test.tsx` | 11 — shared spreadsheet: tabs/headers render and switch, jira mode (ctrl+click opens baseUrl/browse/KEY, SnapLink paste → "KEY Nombre"), url mode (ctrl+click opens the exact pasted URL, bare URL, plain text is not a link, accent styling), readOnly (inputs readonly, no "+ Fila", no drag), "+ Fila" appends, dragDisabled removes handles |
| `src/hooks/useRegressions.test.ts` | 12 — init 4×(20×6), updateGridCell, persistence+hydration, setTabGrid, moveRow (incl. out-of-range), archiveBoard (snapshot+clear+name "Regresión YYYY-MM-DD", persisted), deleteArchived, corrupt JSON, missing-platform merge, quota resilience |
| `src/components/RegressionTracker.test.tsx` | 6 — 4 platform tabs + headers, "Nombre - URL" cell is an accent link that ctrl+click opens, per-platform grids, archive flow (confirm → cleared board → "Archivadas (1)" → snapshot listed), snapshot read-only, delete archived → empty state |
```

Fila de LandingScreen — actualizar a:

```markdown
| `src/components/LandingScreen.test.tsx` | 4 — 10 tool cards rendered, centered `.landing` wrapper present, "more coming" slot is the tool grid's 11th cell, `onSelect` fires |
```

Línea de total: `**Total: 254 tests across 30 files.**` (o los números reales del Step 1).

2. Sección **Architecture**:
- Línea de hash-based routing / ViewType: añadir `'regressiontracker'` a la lista de vistas.
- Línea de Settings persistence: añadir `Regression tracker board+archived as `acgen_regressions`, column widths as `acgen_regression_col_widths`.`

3. Sección **Tools**: el encabezado pasa a `## Tools (10 total)` y en el grupo de tracking (donde está Sprint Tracker) añadir la fila:

```markdown
| Regression Tracker | `regressiontracker` | `RegressionTracker.tsx`, `TrackerGrid.tsx`, `useRegressions.ts` | No |
```

(Ajustar las columnas exactas al formato real de la tabla de AGENTS.md al editarla.)

4. Si AGENTS.md menciona que `SprintDashboard` contiene el spreadsheet, actualizar la mención: el spreadsheet vive ahora en `TrackerGrid.tsx` (compartido por Sprint Tracker y Regression Tracker).

- [ ] **Step 3: Verificación final completa**

Run: `npm test` → verde con los totales de AGENTS.md.
Run: `npm run lint` → sin errores.
Run: `npm run build` → compila (tsc + vite) sin errores.

- [ ] **Step 4: Commit**

```bash
git add AGENTS.md
git commit -m "docs: sync AGENTS.md with Regression Tracker and TrackerGrid extraction

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```
