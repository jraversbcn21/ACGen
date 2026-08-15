import { useState, useCallback } from 'react';
import { SprintList } from './SprintList';
import { SprintDashboard } from './SprintDashboard';
import { useSprints } from '../hooks/useSprints';
import { useT } from '../i18n/I18nContext';
import type { Sprint, TabId } from '../hooks/useSprints';

export function SprintTracker() {
  const { sprints, addSprint, updateSprint, archiveSprint, unarchiveSprint, updateGridCell, setTabGrid, moveRow, deleteSprint } = useSprints();
  const [selectedSprintId, setSelectedSprintId] = useState<string | null>(null);
  const selectedSprint = selectedSprintId ? sprints.find(s => s.id === selectedSprintId) ?? null : null;
  const t = useT();

  const handleSelectSprint = useCallback((sprint: Sprint) => {
    setSelectedSprintId(sprint.id);
  }, []);

  const handleBack = useCallback(() => {
    setSelectedSprintId(null);
  }, []);

  const handleArchive = useCallback(() => {
    if (!selectedSprint) return;
    if (!confirm(t('sprint.archiveConfirm'))) return;
    archiveSprint(selectedSprint.id);
    setSelectedSprintId(null);
  }, [selectedSprint, archiveSprint, t]);

  const handleUpdateGridCell = useCallback((tabId: TabId, row: number, col: number, value: string) => {
    if (!selectedSprint) return;
    updateGridCell(selectedSprint.id, tabId, row, col, value);
  }, [selectedSprint, updateGridCell]);

  const handleSetTabGrid = useCallback((tabId: TabId, grid: string[][]) => {
    if (!selectedSprint) return;
    setTabGrid(selectedSprint.id, tabId, grid);
  }, [selectedSprint, setTabGrid]);

  const handleMoveRow = useCallback((tabId: TabId, fromRow: number, toRow: number) => {
    if (!selectedSprint) return;
    moveRow(selectedSprint.id, tabId, fromRow, toRow);
  }, [selectedSprint, moveRow]);

  const handleRenameSprint = useCallback((id: string, name: string) => {
    updateSprint(id, { name });
  }, [updateSprint]);

  if (selectedSprint) {
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <button type="button" className="btn-ghost" onClick={handleBack} style={{ padding: '6px 14px' }}>
            ← {t('common.back')}
          </button>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>{selectedSprint.name}</h2>
          {selectedSprint.archived && (
            <span className="badge badge-info" style={{ fontSize: 11 }}>{t('sprint.archived')}</span>
          )}
        </div>

        <SprintDashboard
          sprint={selectedSprint}
          onUpdateGridCell={handleUpdateGridCell}
          onSetTabGrid={handleSetTabGrid}
          onMoveRow={handleMoveRow}
          onArchive={handleArchive}
        />
      </div>
    );
  }

  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 20 }}>
        {t('sprint.title')}
      </h2>
      <SprintList
        sprints={sprints}
        onAddSprint={addSprint}
        onSelectSprint={handleSelectSprint}
        onDeleteSprint={deleteSprint}
        onRenameSprint={handleRenameSprint}
        onArchiveSprint={archiveSprint}
        onUnarchiveSprint={unarchiveSprint}
      />
    </div>
  );
}
