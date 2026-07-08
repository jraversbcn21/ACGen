import { useState, useEffect, useCallback } from 'react';
import { jiraSearch } from '../services/jiraService';
import type { JiraSearchResult } from '../types';
import type { Sprint } from '../hooks/useSprints';

type TabId = 'resolved' | 'created' | 'reopened' | 'highPriority';

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
  onUpdateNotes: (ticketKey: string, note: string) => void;
  onArchive: () => void;
}

export function SprintDashboard({ sprint, jiraToken, jiraBaseUrl, onUpdateNotes, onArchive }: SprintDashboardProps) {
  const [activeTab, setActiveTab] = useState<TabId>('resolved');
  const [results, setResults] = useState<Record<TabId, JiraSearchResult[]>>({
    resolved: [],
    created: [],
    reopened: [],
    highPriority: [],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

      {error && (
        <div className="error-banner" style={{ marginTop: 12 }}>
          <span className="error-text">{error}</span>
        </div>
      )}

      {loading && (
        <span className="loading-status" style={{ display: 'block', marginTop: 12 }}>Consultando Jira...</span>
      )}

      {!loading && results[activeTab].length === 0 && sprint.jql[activeTab].trim() && (
        <p style={{ marginTop: 16, color: 'var(--text-3)', fontSize: 14 }}>Sin tickets en esta categoria</p>
      )}

      {!loading && !sprint.jql[activeTab].trim() && (
        <p style={{ marginTop: 16, color: 'var(--text-3)', fontSize: 14 }}>Configura la JQL para ver tickets</p>
      )}

      {!loading && results[activeTab].length > 0 && (
        <div className="data-table-wrap" style={{ marginTop: 16 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Ticket</th>
                <th>Resumen</th>
                <th>Estado</th>
                <th>Fecha</th>
                <th>Notas</th>
              </tr>
            </thead>
            <tbody>
              {results[activeTab].map((ticket) => (
                <tr key={ticket.key}>
                  <td>
                    <a
                      href={`${jiraBaseUrl}/browse/${ticket.key}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}
                    >
                      {ticket.key}
                    </a>
                  </td>
                  <td style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' }}>{ticket.summary}</td>
                  <td>
                    <span className="badge badge-info">{ticket.status}</span>
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {formatDate(activeTab === 'created' ? ticket.created : ticket.updated)}
                  </td>
                  <td>
                    <input
                      type="text"
                      className="field-input"
                      value={sprint.notes[ticket.key] || ''}
                      onChange={(e) => onUpdateNotes(ticket.key, e.target.value)}
                      placeholder="Añadir nota..."
                      style={{ height: 34, fontSize: 12, minWidth: 200 }}
                    />
                  </td>
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
