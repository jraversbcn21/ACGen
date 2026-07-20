import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { STORAGE_KEYS } from '../config/constants';
import { useT } from '../i18n/I18nContext';

const TICKET_KEY_PATTERN = /^([A-Z]+-\d+)\b/;
const URL_CELL_PATTERN = /^(?:(.+?)\s*-\s*)?(https?:\/\/\S+)$/;
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
  readOnly?: boolean;
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
  readOnly = false,
  colWidthsStorageKey,
  searchPlaceholder,
  onUpdateGridCell,
  onSetTabGrid,
  onMoveRow,
}: TrackerGridProps<T>) {
  const noDrag = dragDisabled || readOnly;
  const [activeTab, setActiveTab] = useState<T>(tabs[0]);
  const [storedColWidths, setStoredColWidths] = useLocalStorage<Record<string, number>>(colWidthsStorageKey, {});
  // En readOnly (snapshots) el resize vive solo en memoria: arranca con los
  // anchos del board vivo pero nunca escribe en su clave compartida.
  const [ephemeralColWidths, setEphemeralColWidths] = useState<Record<string, number>>(() => storedColWidths);
  const colWidths = readOnly ? ephemeralColWidths : storedColWidths;
  const setColWidths = readOnly ? setEphemeralColWidths : setStoredColWidths;
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

  const grid = useMemo(() => tabGrid[activeTab] || [], [tabGrid, activeTab]);
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
    const m = value.match(URL_CELL_PATTERN);
    return m ? m[2] : null;
  };

  const getLinkName = (value: string): string | null => {
    if (linkMode !== 'url') return null;
    return value.match(URL_CELL_PATTERN)?.[1] ?? null;
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
                  draggable={!noDrag}
                  onDragStart={(e) => !noDrag ? handleDragStart(e, ri) : e.preventDefault()}
                  onDragEnd={handleDragEnd}
                  style={{
                    position: 'sticky', left: 0, zIndex: 1,
                    width: 44, minWidth: 44, height: 28, background: 'var(--surface-2)',
                    border: '1px solid var(--border)', fontSize: 10, color: 'var(--text-3)',
                    textAlign: 'center', fontWeight: 700,
                    cursor: noDrag ? undefined : 'grab',
                  }}
                >
                  {!noDrag && (
                    <span style={{ marginRight: 2, fontSize: 12, lineHeight: 1, verticalAlign: 'middle', opacity: 0.5 }}>&#x22EE;&#x22EE;</span>
                  )}
                  {ri + 1}
                </td>
                {Array.from({ length: colCount }, (_, ci) => {
                  const value = getCellValue(ri, ci);
                  const linkUrl = ci === 0 ? getLinkUrl(value) : null;
                  const ticketKey = linkMode === 'jira' && linkUrl ? value.match(TICKET_KEY_PATTERN)![1] : null;
                  const linkName = ci === 0 && linkUrl ? getLinkName(value) : null;
                  const isFocused = focusedCell?.row === ri && focusedCell?.col === ci;
                  const showFocus = linkUrl && isFocused;
                  const showNameOverlay = Boolean(linkName) && !isFocused;
                  return (
                    <td
                      key={ci}
                      onClick={(e) => {
                        if (linkUrl && e.ctrlKey) {
                          window.open(linkUrl, '_blank', 'noopener,noreferrer');
                        }
                      }}
                      title={ticketKey ? t('sprint.openTicket', { ticket: ticketKey }) : linkUrl ? t('regression.openLink') : undefined}
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
                        readOnly={readOnly}
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
                          background: 'transparent',
                          color: showNameOverlay ? 'transparent' : linkUrl ? 'var(--accent)' : 'var(--text)',
                          fontWeight: linkUrl ? 600 : 400,
                          caretColor: linkUrl && !(linkMode === 'url' && isFocused) ? 'transparent' : undefined,
                          cursor: linkUrl ? 'pointer' : undefined,
                        }}
                      />
                      {showNameOverlay && (
                        <span style={{
                          position: 'absolute', left: 0, right: 0, top: 0, height: 28, lineHeight: '28px',
                          padding: '0 6px', fontSize: 12, fontFamily: 'var(--font-mono)',
                          color: 'var(--accent)', fontWeight: 600,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          pointerEvents: 'none',
                        }}>{linkName}</span>
                      )}
                    </td>
                  );
                })}
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {!searchQuery.trim() && !readOnly && (
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button type="button" className="btn-ghost" onClick={handleAddRow} style={{ padding: '6px 14px', fontSize: 13 }}>
            {t('sprint.addRow')}
          </button>
        </div>
      )}
    </div>
  );
}
