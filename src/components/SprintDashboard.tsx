import { useState, useEffect, useCallback, useRef } from 'react';
import { jiraSearch } from '../services/jiraService';
import type { Sprint, TabId } from '../hooks/useSprints';

const TAB_LABELS: Record<TabId, string> = {
  resolved: 'Resueltos',
  created: 'Creados',
  reopened: 'ReOpen',
  highPriority: 'Prioridad Alta',
};

const TICKET_KEY_PATTERN = /^[A-Z]+-\d+$/;
const DEFAULT_COL_WIDTH = 120;
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

interface SprintDashboardProps {
  sprint: Sprint;
  jiraToken: string;
  jiraBaseUrl: string;
  onUpdateTabJql: (tabId: TabId, jql: string) => void;
  onUpdateGridCell: (tabId: TabId, row: number, col: number, value: string) => void;
  onSetTabGrid: (tabId: TabId, grid: string[][]) => void;
  onArchive: () => void;
}

export function SprintDashboard({ sprint, jiraToken, jiraBaseUrl, onUpdateTabJql, onUpdateGridCell, onSetTabGrid, onArchive }: SprintDashboardProps) {
  const [activeTab, setActiveTab] = useState<TabId>('resolved');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [colWidths, setColWidths] = useState<Record<string, number>>({});

  const resizeRef = useRef<{ col: number; startX: number; startWidth: number } | null>(null);

  const fetchTab = useCallback(async (tab: TabId) => {
    const jql = sprint.jql[tab];
    if (!jql.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const data = await jiraSearch(jql, jiraToken, jiraBaseUrl);
      const existingGrid = sprint.tabGrid[tab] || [];
      const maxRows = Math.max(existingGrid.length, data.issues.length, 20);
      const maxCols = existingGrid[0]?.length || 10;
      const newGrid: string[][] = Array.from({ length: maxRows }, (_, ri) => {
        const existing = existingGrid[ri] || [];
        const ticket = data.issues[ri];
        const row: string[] = Array.from({ length: maxCols }, (_, ci) => {
          if (ticket && ci === 0) return ticket.key;
          if (ticket && ci === 1) {
            const d = new Date(tab === 'created' ? ticket.created : ticket.updated);
            return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
          }
          return existing[ci] || '';
        });
        return row;
      });
      onSetTabGrid(tab, newGrid);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al consultar Jira');
    } finally {
      setLoading(false);
    }
  }, [sprint.jql, sprint.tabGrid, jiraToken, jiraBaseUrl, onSetTabGrid]);

  useEffect(() => {
    const jql = sprint.jql[activeTab];
    if (jql.trim()) {
      fetchTab(activeTab);
    }
  }, [activeTab, fetchTab]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!resizeRef.current) return;
      const { col, startX, startWidth } = resizeRef.current;
      const diff = e.clientX - startX;
      const newWidth = Math.max(MIN_COL_WIDTH, startWidth + diff);
      setColWidths((prev) => ({ ...prev, [`${activeTab}-${col}`]: newWidth }));
    };
    const handleMouseUp = () => {
      resizeRef.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    if (resizeRef.current) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [activeTab]);

  const startResize = (e: React.MouseEvent, col: number) => {
    e.preventDefault();
    e.stopPropagation();
    const currentWidth = colWidths[`${activeTab}-${col}`] || DEFAULT_COL_WIDTH;
    resizeRef.current = { col, startX: e.clientX, startWidth: currentWidth };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const tabs: TabId[] = ['resolved', 'created', 'reopened', 'highPriority'];
  const grid = sprint.tabGrid[activeTab] || [];
  const rowCount = grid.length || 20;
  const colCount = grid[0]?.length || 10;

  const getColWidth = (col: number) => colWidths[`${activeTab}-${col}`] || DEFAULT_COL_WIDTH;

  const handleAddRow = () => {
    const newGrid = [...grid, Array.from({ length: colCount }, () => '')];
    onSetTabGrid(activeTab, newGrid);
  };

  const handleAddCol = () => {
    const newGrid = grid.map((row) => [...row, '']);
    onSetTabGrid(activeTab, newGrid);
  };

  const getCellValue = (row: number, col: number) => {
    return grid[row]?.[col] || '';
  };

  const baseUrl = jiraBaseUrl.replace(/\/+$/, '');

  return (
    <div className="sprint-dashboard">
      <div className="sprint-tabs">
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            className={`btn-ghost ${activeTab === tab ? 'sprint-tab-active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
        <button
          type="button"
          className="btn-ghost"
          onClick={() => fetchTab(activeTab)}
          style={{ marginLeft: 'auto' }}
        >
          Refrescar
        </button>
      </div>

      <div style={{ marginTop: 12 }}>
        <label className="field-label">JQL</label>
        <textarea
          value={sprint.jql[activeTab]}
          onChange={(e) => onUpdateTabJql(activeTab, e.target.value)}
          placeholder={`project = BERSHKA AND sprint = "${sprint.name}"...`}
          className="field-textarea"
          style={{ minHeight: 48 }}
        />
      </div>

      {error && (
        <div className="error-banner" style={{ marginTop: 12 }}>
          <span className="error-text">{error}</span>
        </div>
      )}

      {loading && (
        <span className="loading-status" style={{ display: 'block', marginTop: 12 }}>Consultando Jira...</span>
      )}

      <div style={{ marginTop: 12, overflow: 'auto', maxWidth: '100%', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
        <table style={{ borderCollapse: 'collapse', fontSize: 12, fontFamily: 'var(--font-mono)', tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: 36 }} />
            {Array.from({ length: colCount }, (_, ci) => (
              <col key={ci} style={{ width: getColWidth(ci) }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th style={{
                position: 'sticky', top: 0, left: 0, zIndex: 2,
                width: 36, minWidth: 36, height: 28, background: 'var(--surface-2)',
                border: '1px solid var(--border)', fontSize: 10, color: 'var(--text-3)',
              }}></th>
              {Array.from({ length: colCount }, (_, ci) => (
                <th key={ci} style={{
                  position: 'sticky', top: 0, zIndex: 1,
                  height: 28, background: 'var(--surface-2)',
                  border: '1px solid var(--border)', fontSize: 11, fontWeight: 700,
                  color: 'var(--text-3)', textAlign: 'center',
                  position: 'relative',
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
          </thead>
          <tbody>
            {Array.from({ length: rowCount }, (_, ri) => (
              <tr key={ri}>
                <td style={{
                  position: 'sticky', left: 0, zIndex: 1,
                  width: 36, minWidth: 36, height: 28, background: 'var(--surface-2)',
                  border: '1px solid var(--border)', fontSize: 10, color: 'var(--text-3)',
                  textAlign: 'center', fontWeight: 700,
                }}>{ri + 1}</td>
                {Array.from({ length: colCount }, (_, ci) => {
                  const value = getCellValue(ri, ci);
                  const isTicketKey = ci === 0 && TICKET_KEY_PATTERN.test(value);
                  return (
                    <td key={ci} style={{ border: '1px solid var(--border)', padding: 0, position: 'relative', overflow: 'hidden' }}>
                      <input
                        type="text"
                        value={value}
                        onChange={(e) => onUpdateGridCell(activeTab, ri, ci, e.target.value)}
                        style={{
                          width: '100%', height: 28, border: 'none', outline: 'none',
                          padding: '0 6px', fontSize: 12, fontFamily: 'var(--font-mono)',
                          background: 'transparent', color: isTicketKey ? 'var(--accent)' : 'var(--text)',
                          fontWeight: isTicketKey ? 600 : 400,
                        }}
                      />
                      {isTicketKey && (
                        <a
                          href={`${baseUrl}/browse/${value}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            position: 'absolute', right: 2, top: '50%', transform: 'translateY(-50%)',
                            fontSize: 10, color: 'var(--accent)', textDecoration: 'none',
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >↗</a>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button type="button" className="btn-ghost" onClick={handleAddRow} style={{ padding: '6px 14px', fontSize: 13 }}>
          + Fila
        </button>
        <button type="button" className="btn-ghost" onClick={handleAddCol} style={{ padding: '6px 14px', fontSize: 13 }}>
          + Columna
        </button>
      </div>

      {!sprint.archived && (
        <div className="actions-bar">
          <button type="button" className="btn-ghost" onClick={onArchive}>
            Archivar Sprint
          </button>
        </div>
      )}
    </div>
  );
}
