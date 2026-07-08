import { useState, useEffect, useCallback } from 'react';
import { jiraSearch } from '../services/jiraService';
import type { JiraSearchResult } from '../types';
import type { Sprint, TabId } from '../hooks/useSprints';

const TAB_LABELS: Record<TabId, string> = {
  resolved: 'Resueltos',
  created: 'Creados',
  reopened: 'ReOpen',
  highPriority: 'Prioridad Alta',
};

interface SprintDashboardProps {
  sprint: Sprint;
  jiraToken: string;
  jiraBaseUrl: string;
  onUpdateTabJql: (tabId: TabId, jql: string) => void;
  onUpdateCell: (tabId: TabId, ticketKey: string, column: string, value: string) => void;
  onUpdateTabColumns: (tabId: TabId, columns: string[]) => void;
  onArchive: () => void;
}

export function SprintDashboard({ sprint, jiraToken, jiraBaseUrl, onUpdateTabJql, onUpdateCell, onUpdateTabColumns, onArchive }: SprintDashboardProps) {
  const [activeTab, setActiveTab] = useState<TabId>('resolved');
  const [results, setResults] = useState<Record<TabId, JiraSearchResult[]>>({
    resolved: [],
    created: [],
    reopened: [],
    highPriority: [],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newColName, setNewColName] = useState('');

  const fetchTab = useCallback(async (tab: TabId) => {
    const jql = sprint.jql[tab];
    if (!jql.trim()) {
      setResults((prev) => ({ ...prev, [tab]: [] }));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await jiraSearch(jql, jiraToken, jiraBaseUrl);
      setResults((prev) => ({ ...prev, [tab]: data.issues }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al consultar Jira');
    } finally {
      setLoading(false);
    }
  }, [sprint.jql, jiraToken, jiraBaseUrl]);

  useEffect(() => {
    fetchTab(activeTab);
  }, [activeTab, fetchTab]);

  const tabs: TabId[] = ['resolved', 'created', 'reopened', 'highPriority'];

  const formatDate = (iso: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const userColumns = sprint.tabColumns[activeTab] || [];

  const handleAddColumn = () => {
    const name = newColName.trim();
    if (!name) return;
    if (userColumns.includes(name)) return;
    onUpdateTabColumns(activeTab, [...userColumns, name]);
    setNewColName('');
  };

  const handleRemoveColumn = (col: string) => {
    onUpdateTabColumns(activeTab, userColumns.filter((c) => c !== col));
  };

  const getCellValue = (ticketKey: string, col: string) => {
    const tabData = sprint.tabCells[activeTab] || {};
    const ticketData = tabData[ticketKey] || {};
    return ticketData[col] || '';
  };

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
            {results[tab].length > 0 && (
              <span className="history-count">{results[tab].length}</span>
            )}
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
        <label className="field-label">JQL para {TAB_LABELS[activeTab]}</label>
        <textarea
          value={sprint.jql[activeTab]}
          onChange={(e) => onUpdateTabJql(activeTab, e.target.value)}
          placeholder={`project = BERSHKA AND sprint = "${sprint.name}"...`}
          className="field-textarea"
          style={{ minHeight: 48 }}
        />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, marginBottom: 8 }}>
        <input
          type="text"
          className="field-input"
          value={newColName}
          onChange={(e) => setNewColName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleAddColumn(); }}
          placeholder="Nombre de columna..."
          style={{ height: 34, fontSize: 13, maxWidth: 220 }}
        />
        <button type="button" className="btn-ghost" onClick={handleAddColumn} style={{ padding: '6px 14px', fontSize: 13 }}>
          + Columna
        </button>
        {userColumns.map((col) => (
          <span key={col} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6, padding: '2px 8px', fontSize: 12, fontFamily: 'var(--font-mono)' }}>
            {col}
            <button
              type="button"
              onClick={() => handleRemoveColumn(col)}
              style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 0 }}
            >
              ×
            </button>
          </span>
        ))}
      </div>

      {error && (
        <div className="error-banner" style={{ marginTop: 12 }}>
          <span className="error-text">{error}</span>
        </div>
      )}

      {loading && (
        <span className="loading-status" style={{ display: 'block', marginTop: 12 }}>Consultando Jira...</span>
      )}

      {!loading && results[activeTab].length === 0 && sprint.jql[activeTab].trim() && (
        <p style={{ marginTop: 16, color: 'var(--text-3)', fontSize: 14 }}>Sin tickets en esta categoría</p>
      )}

      {!loading && !sprint.jql[activeTab].trim() && (
        <p style={{ marginTop: 16, color: 'var(--text-3)', fontSize: 14 }}>Configura la JQL para ver los tickets</p>
      )}

      {!loading && results[activeTab].length > 0 && (
        <div className="data-table-wrap" style={{ marginTop: 16 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Ticket</th>
                <th>Fecha</th>
                {userColumns.map((col) => (
                  <th key={col}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {results[activeTab].map((ticket) => (
                <tr key={ticket.key}>
                  <td>
                    <a
                      href={`${jiraBaseUrl.replace(/\/+$/, '')}/browse/${ticket.key}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}
                    >
                      {ticket.key}
                    </a>
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {formatDate(activeTab === 'created' ? ticket.created : ticket.updated)}
                  </td>
                  {userColumns.map((col) => (
                    <td key={col}>
                      <input
                        type="text"
                        className="field-input"
                        value={getCellValue(ticket.key, col)}
                        onChange={(e) => onUpdateCell(activeTab, ticket.key, col, e.target.value)}
                        placeholder={col}
                        style={{ height: 32, fontSize: 12, minWidth: 120 }}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

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
