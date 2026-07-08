import { useState, useCallback } from 'react';
import { SprintList } from './SprintList';
import { SprintDashboard } from './SprintDashboard';
import { useSprints } from '../hooks/useSprints';
import type { Sprint, TabId } from '../hooks/useSprints';

interface SprintTrackerProps {
  jiraToken: string;
  jiraBaseUrl: string;
}

export function SprintTracker({ jiraToken, jiraBaseUrl }: SprintTrackerProps) {
  const { sprints, addSprint, archiveSprint, updateGridCell, setTabGrid, deleteSprint } = useSprints();
  const [selectedSprintId, setSelectedSprintId] = useState<string | null>(null);
  const selectedSprint = selectedSprintId ? sprints.find(s => s.id === selectedSprintId) ?? null : null;

  const handleSelectSprint = useCallback((sprint: Sprint) => {
    setSelectedSprintId(sprint.id);
  }, []);

  const handleBack = useCallback(() => {
    setSelectedSprintId(null);
  }, []);

  const handleArchive = useCallback(() => {
    if (!selectedSprint) return;
    if (!confirm('¿Archivar este sprint? El sprint archivado se moverá al historial.')) return;
    archiveSprint(selectedSprint.id);
    setSelectedSprintId(null);
  }, [selectedSprint, archiveSprint]);

  const handleUpdateGridCell = useCallback((tabId: TabId, row: number, col: number, value: string) => {
    if (!selectedSprint) return;
    updateGridCell(selectedSprint.id, tabId, row, col, value);
  }, [selectedSprint, updateGridCell]);

  const handleSetTabGrid = useCallback((tabId: TabId, grid: string[][]) => {
    if (!selectedSprint) return;
    setTabGrid(selectedSprint.id, tabId, grid);
  }, [selectedSprint, setTabGrid]);

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
        </div>

        <SprintDashboard
          sprint={selectedSprint}
          jiraBaseUrl={jiraBaseUrl.trim()}
          onUpdateGridCell={handleUpdateGridCell}
          onSetTabGrid={handleSetTabGrid}
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
