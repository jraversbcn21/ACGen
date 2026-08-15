import { useMemo } from 'react';
import type { Sprint, TabId } from '../hooks/useSprints';
import { STORAGE_KEYS } from '../config/constants';
import { useT } from '../i18n/I18nContext';
import { useSchema } from '../hooks/useSchema';
import { resolveLabel, visibleEntries } from '../types/schema';
import { TrackerGrid, type TrackerColumn } from './TrackerGrid';

interface SprintDashboardProps {
  sprint: Sprint;
  onUpdateGridCell: (tabId: TabId, row: number, col: number, value: string) => void;
  onSetTabGrid: (tabId: TabId, grid: string[][]) => void;
  onMoveRow: (tabId: TabId, fromRow: number, toRow: number) => void;
  onArchive: () => void;
}

export function SprintDashboard({ sprint, onUpdateGridCell, onSetTabGrid, onMoveRow, onArchive }: SprintDashboardProps) {
  const t = useT();
  const [schema] = useSchema();

  const visibleTabs = useMemo(() => visibleEntries(schema.sprint.tabs), [schema]);
  const tabs = useMemo(() => visibleTabs.map((tab) => tab.id), [visibleTabs]);
  const tabLabels = useMemo(
    () => Object.fromEntries(visibleTabs.map((tab) => [tab.id, resolveLabel(tab, t)])),
    [visibleTabs, t],
  ) as Record<TabId, string>;
  // El indice en `columns` ES la columna de datos: se calcula ANTES de filtrar
  // las ocultas, porque filtrar primero desplazaria en silencio los datos.
  const tabColumns = useMemo(
    () => Object.fromEntries(visibleTabs.map((tab) => [
      tab.id,
      (tab.columns ?? [])
        .map((col, dataIndex) => ({ col, dataIndex }))
        .filter(({ col }) => !col.hidden)
        .map(({ col, dataIndex }) => ({ label: resolveLabel(col, t), dataIndex })),
    ])),
    [visibleTabs, t],
  ) as Record<TabId, TrackerColumn[]>;

  return (
    <div className="sprint-dashboard">
      <TrackerGrid
        tabs={tabs}
        tabLabels={tabLabels}
        tabColumns={tabColumns}
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
