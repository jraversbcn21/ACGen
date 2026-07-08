import { useState, useCallback } from 'react';
import { SprintList } from './SprintList';
import { SprintDashboard } from './SprintDashboard';
import { SprintJqlConfig } from './SprintJqlConfig';
import { useSprints } from '../hooks/useSprints';
import type { Sprint } from '../hooks/useSprints';

interface SprintTrackerProps {
  jiraToken: string;
  jiraBaseUrl: string;
}

export function SprintTracker({ jiraToken, jiraBaseUrl }: SprintTrackerProps) {
  const { sprints, addSprint, updateSprint, archiveSprint, updateNotes, deleteSprint } = useSprints();
  const [selectedSprintId, setSelectedSprintId] = useState<string | null>(null);
  const selectedSprint = selectedSprintId ? sprints.find(s => s.id === selectedSprintId) ?? null : null;
  const [showJqlConfig, setShowJqlConfig] = useState(false);

  const handleSelectSprint = useCallback((sprint: Sprint) => {
    setSelectedSprintId(sprint.id);
  }, []);

  const handleBack = useCallback(() => {
    setSelectedSprintId(null);
    setShowJqlConfig(false);
  }, []);

  const handleArchive = useCallback(() => {
    if (!selectedSprint) return;
    if (!confirm('¿Archivar este sprint? El sprint archivado se moverá al historial.')) return;
    archiveSprint(selectedSprint.id);
    setSelectedSprintId(null);
  }, [selectedSprint, archiveSprint]);

  const handleUpdateNotes = useCallback((ticketKey: string, note: string) => {
    if (!selectedSprint) return;
    updateNotes(selectedSprint.id, ticketKey, note);
  }, [selectedSprint, updateNotes]);

  const jiraConfigured = jiraToken.trim().length > 0 && jiraBaseUrl.trim().length > 0;

  if (!jiraConfigured) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px' }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>
          Sprint Tracker
        </h2>
        <p style={{ color: 'var(--text-2)', marginBottom: 8, fontSize: 15 }}>
          Configura la conexión con Jira para usar el Sprint Tracker.
        </p>
        <p style={{ color: 'var(--text-3)', fontSize: 13 }}>
          Necesitas configurar la URL base y el token PAT de Jira en las herramientas que ya usan Jira
          (Criterios de aceptación, Bug Report o Datos de Prueba).
        </p>
      </div>
    );
  }

  if (selectedSprint) {
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <button type="button" className="btn-ghost" onClick={handleBack} style={{ padding: '6px 14px' }}>
            ← Volver
          </button>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>{selectedSprint.name}</h2>
          {selectedSprint.archived && (
            <span className="badge badge-info" style={{ fontSize: 11 }}>Archivado</span>
          )}
          <button
            type="button"
            className="btn-ghost"
            onClick={() => setShowJqlConfig((p) => !p)}
            style={{ marginLeft: 'auto' }}
          >
            {showJqlConfig ? 'Ocultar JQLs' : 'Configurar JQLs'}
          </button>
        </div>

        {showJqlConfig && (
          <SprintJqlConfig
            jql={selectedSprint.jql}
            onChange={(jql) => updateSprint(selectedSprint.id, { jql })}
          />
        )}

        <SprintDashboard
          sprint={selectedSprint}
          jiraToken={jiraToken.trim()}
          jiraBaseUrl={jiraBaseUrl.trim()}
          onUpdateNotes={handleUpdateNotes}
          onArchive={handleArchive}
        />
      </div>
    );
  }

  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 20 }}>
        Sprint Tracker
      </h2>
      <SprintList
        sprints={sprints}
        onAddSprint={addSprint}
        onSelectSprint={handleSelectSprint}
        onDeleteSprint={deleteSprint}
      />
    </div>
  );
}
