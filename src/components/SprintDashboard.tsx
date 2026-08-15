import { useMemo, useState } from 'react';
import type { Sprint, TabId } from '../hooks/useSprints';
import { STORAGE_KEYS } from '../config/constants';
import { useT } from '../i18n/I18nContext';
import { useSchema } from '../hooks/useSchema';
import { DEFAULT_SCHEMA, resolveLabel, visibleEntries } from '../types/schema';
import { TrackerGrid, type TrackerColumn } from './TrackerGrid';
import { SprintSchemaEditor } from './SprintSchemaEditor';

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
  const [showSchema, setShowSchema] = useState(false);

  // Mismo criterio que el `safeTab` del Regression Tracker: un esquema escrito
  // a mano puede dejar CERO pestanas visibles (`tabs: []`, o todas ocultas), y
  // entonces TrackerGrid se quedaria con `tabs[0] === undefined` y "+ Fila"
  // escribiria en el sprint bajo la clave literal "undefined".
  const visibleTabs = useMemo(() => {
    const shown = visibleEntries(schema.sprint.tabs);
    return shown.length ? shown : [DEFAULT_SCHEMA.sprint.tabs[0]];
  }, [schema]);
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
      tab.columns
        .map((col, dataIndex) => ({ col, dataIndex }))
        .filter(({ col }) => !col.hidden)
        .map(({ col, dataIndex }) => ({ label: resolveLabel(col, t), dataIndex })),
    ])),
    [visibleTabs, t],
  ) as Record<TabId, TrackerColumn[]>;
  // Cuantas columnas declara el esquema, ocultas incluidas: sin esto TrackerGrid
  // volveria a pintar como "columna extra sin rotulo" la que se acaba de ocultar
  // al final de la pestana. (`useSchema` garantiza que `columns` es un array.)
  const tabColCount = useMemo(
    () => Object.fromEntries(visibleTabs.map((tab) => [tab.id, tab.columns.length])),
    [visibleTabs],
  ) as Record<TabId, number>;

  return (
    <div className="sprint-dashboard">
      {!sprint.archived && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
          <button type="button" className="btn-ghost" onClick={() => setShowSchema(true)}
            style={{ padding: '6px 14px', fontSize: 13 }}>
            {t('schema.sprintOpen')}
          </button>
        </div>
      )}
      {showSchema && <SprintSchemaEditor onClose={() => setShowSchema(false)} />}
      <TrackerGrid
        tabs={tabs}
        tabLabels={tabLabels}
        tabColumns={tabColumns}
        tabColCount={tabColCount}
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
