import type { Sprint, TabId } from '../hooks/useSprints';
import { STORAGE_KEYS } from '../config/constants';
import { useT } from '../i18n/I18nContext';
import { TrackerGrid } from './TrackerGrid';
import type { TrackerColumn } from './TrackerGrid';

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

// Temporal: la Task 4 sustituye esta derivacion local por columnas resueltas
// desde el esquema (visibleEntries), incluyendo el filtrado de ocultas.
const TAB_COLUMNS: Record<TabId, TrackerColumn[]> = Object.fromEntries(
  (Object.entries(TAB_HEADERS) as [TabId, string[]][]).map(([tab, headers]) => [
    tab, headers.map((label, i) => ({ label, dataIndex: i })),
  ]),
) as Record<TabId, TrackerColumn[]>;

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
        tabColumns={TAB_COLUMNS}
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
