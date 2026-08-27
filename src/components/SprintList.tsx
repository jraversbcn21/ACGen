import { useMemo, useState } from 'react';
import type { Sprint } from '../hooks/useSprints';
import { useT, useLang } from '../i18n/I18nContext';
import { useSchema } from '../hooks/useSchema';
import { DEFAULT_SCHEMA, resolveLabel, visibleEntries } from '../types/schema';
import { formatDate, localTodayISO } from '../utils/dates';

interface SprintListProps {
  sprints: Sprint[];
  onAddSprint: (name: string, startDate: string) => void;
  onSelectSprint: (sprint: Sprint) => void;
  onDeleteSprint: (id: string) => void;
  onRenameSprint: (id: string, name: string) => void;
  onArchiveSprint: (id: string) => void;
  onUnarchiveSprint: (id: string) => void;
}

// Una fila "cuenta" si alguna celda tiene contenido real.
function countRows(grid: string[][] | undefined): number {
  return (grid ?? []).filter((row) => row.some((cell) => cell?.trim())).length;
}

// Dias transcurridos desde el inicio, contando el dia de inicio como dia 1.
function dayNumber(startDate: string): number {
  const start = new Date(`${startDate}T00:00:00`);
  const today = new Date(`${localTodayISO()}T00:00:00`);
  const diff = Math.floor((today.getTime() - start.getTime()) / 86400000);
  return Math.max(1, diff + 1);
}

export function SprintList({ sprints, onAddSprint, onSelectSprint, onDeleteSprint, onRenameSprint, onArchiveSprint, onUnarchiveSprint }: SprintListProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState(localTodayISO);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const t = useT();
  const { lang } = useLang();
  const [schema] = useSchema();

  const active = sprints.filter((s) => !s.archived);
  const archived = sprints.filter((s) => s.archived);

  // Seleccion derivada: lo clicado si sigue existiendo; si no, el primer activo.
  const selected = (selectedId ? sprints.find((s) => s.id === selectedId) : undefined) ?? active[0] ?? null;

  // Mismo criterio `safeTab` que SprintDashboard: un esquema manual puede dejar
  // cero pestanas visibles y aqui las barras se quedarian sin filas que contar.
  const visibleTabs = useMemo(() => {
    const shown = visibleEntries(schema.sprint.tabs);
    return shown.length ? shown : [DEFAULT_SCHEMA.sprint.tabs[0]];
  }, [schema]);

  const tabCounts = useMemo(() => {
    if (!selected) return [];
    return visibleTabs.map((tab) => ({
      id: tab.id,
      label: resolveLabel(tab, t),
      count: countRows(selected.tabGrid[tab.id]),
    }));
  }, [selected, visibleTabs, t]);
  const totalRows = tabCounts.reduce((acc, c) => acc + c.count, 0);
  const maxCount = Math.max(...tabCounts.map((c) => c.count), 1);

  const sprintRowTotal = (s: Sprint) =>
    visibleTabs.reduce((acc, tab) => acc + countRows(s.tabGrid[tab.id]), 0);

  const handleAdd = () => {
    if (!name.trim()) return;
    onAddSprint(name.trim(), startDate);
    setName('');
    setStartDate(localTodayISO());
    setShowForm(false);
  };

  const saveRename = () => {
    if (selected && renameValue.trim()) onRenameSprint(selected.id, renameValue.trim());
    setIsRenaming(false);
  };

  const q = query.trim().toLowerCase();
  const matches = (s: Sprint) => !q || s.name.toLowerCase().includes(q);
  const filteredActive = active.filter(matches);
  const filteredArchived = archived.filter(matches);
  const noMatches = q.length > 0 && filteredActive.length === 0 && filteredArchived.length === 0;

  const datesLine = (s: Sprint) =>
    `${formatDate(s.startDate, lang)} — ${s.archived ? formatDate(s.endDate, lang) : t('sprint.enCurso')}`;

  const renderItem = (s: Sprint) => {
    const isSelected = selected?.id === s.id;
    const dot = isSelected ? 'sp-dot-current' : s.archived ? 'sp-dot-archived' : 'sp-dot-active';
    return (
      <div
        key={s.id}
        className={`sp-item ${isSelected ? 'sp-item-selected' : ''}`}
        onClick={() => { setSelectedId(s.id); setIsRenaming(false); }}
      >
        <span className={`sp-dot ${dot}`} aria-hidden="true" />
        <div className="sp-item-text">
          <div className="sp-item-name">{s.name}</div>
          <div className="sp-item-meta">{datesLine(s)} · {t('sprint.rows', { n: String(sprintRowTotal(s)) })}</div>
        </div>
        <div className="sp-item-actions">
          {s.archived && (
            <button
              type="button"
              className="sp-mini"
              onClick={(e) => { e.stopPropagation(); onUnarchiveSprint(s.id); }}
            >
              {t('sprint.unarchive')}
            </button>
          )}
          <button
            type="button"
            className="sp-mini"
            onClick={(e) => { e.stopPropagation(); if (confirm(t('sprint.deleteConfirm'))) onDeleteSprint(s.id); }}
          >
            {t('common.delete')}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="sp-root">
      <header className="tool-head">
        <div className="tool-head-main">
          <h1 className="tool-title">{t('sprint.title')}</h1>
          <p className="tool-sub">
            {t('sprint.subtitle', { active: String(active.length), archived: String(archived.length) })}
          </p>
        </div>
        <div className="tool-head-aside">
          <button type="button" className="btn-primary" onClick={() => setShowForm(true)}>
            {t('sprint.newSprint')}
          </button>
        </div>
      </header>

      {showForm && (
        <div className="sp-form">
          <div className="sp-form-row">
            <div>
              <label htmlFor="sprint-name" className="field-label">{t('sprint.name')}</label>
              <input
                id="sprint-name"
                type="text"
                className="field-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('sprint.namePlaceholder')}
              />
            </div>
            <div>
              <label htmlFor="sprint-start" className="field-label">{t('sprint.startDate')}</label>
              <input
                id="sprint-start"
                type="date"
                className="field-input"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
          </div>
          <div className="sp-form-actions">
            <button type="button" className="btn-primary" onClick={handleAdd} style={{ minWidth: 120 }}>
              {t('sprint.create')}
            </button>
            <button type="button" className="btn-ghost" onClick={() => setShowForm(false)}>
              {t('common.cancel')}
            </button>
          </div>
        </div>
      )}

      <div className="sp-grid">
        <div className="sp-main">
          {!selected ? (
            <div className="sp-empty">
              <p className="sp-empty-title">{t('sprint.noCurrent')}</p>
              <p className="sp-empty-sub">{t('sprint.noCurrentHint')}</p>
            </div>
          ) : (
            <>
              <section className="sp-hero">
                <div className="sp-hero-top">
                  <div className="sp-hero-id">
                    <div className="sp-hero-flags">
                      {selected.archived ? (
                        <span className="badge badge-info">{t('sprint.archivedBadge')}</span>
                      ) : (
                        <>
                          <span className="sp-hero-badge">{t('sprint.current')}</span>
                          <span className="sp-hero-day">{t('sprint.day', { n: String(dayNumber(selected.startDate)) })}</span>
                        </>
                      )}
                    </div>
                    {isRenaming ? (
                      <input
                        type="text"
                        className="field-input sp-hero-name-input"
                        value={renameValue}
                        autoFocus
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveRename();
                          if (e.key === 'Escape') setIsRenaming(false);
                        }}
                        onBlur={saveRename}
                      />
                    ) : (
                      <div className="sp-hero-name">{selected.name}</div>
                    )}
                    <div className="sp-hero-dates">{datesLine(selected)}</div>
                  </div>
                  <div className="sp-hero-actions">
                    <button type="button" className="btn-primary" onClick={() => onSelectSprint(selected)}>
                      {t('sprint.openBoard')}
                    </button>
                    {!selected.archived && (
                      <>
                        <button
                          type="button"
                          className="btn-ghost"
                          onClick={() => { setRenameValue(selected.name); setIsRenaming(true); }}
                        >
                          {t('sprint.rename')}
                        </button>
                        <button
                          type="button"
                          className="btn-ghost"
                          onClick={() => { if (confirm(t('sprint.archiveConfirm'))) onArchiveSprint(selected.id); }}
                        >
                          {t('common.archive')}
                        </button>
                      </>
                    )}
                    {selected.archived && (
                      <button type="button" className="btn-ghost" onClick={() => onUnarchiveSprint(selected.id)}>
                        {t('sprint.unarchive')}
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() => { if (confirm(t('sprint.deleteConfirm'))) onDeleteSprint(selected.id); }}
                    >
                      {t('common.delete')}
                    </button>
                  </div>
                </div>
                <div className="sp-metrics">
                  <div className="sp-metric">
                    <span className="sp-metric-label">{t('sprint.startDate')}</span>
                    <span className="sp-metric-value">{formatDate(selected.startDate, lang)}</span>
                  </div>
                  <div className="sp-metric">
                    <span className="sp-metric-label">{t('common.rows')}</span>
                    <span className="sp-metric-value">{totalRows}</span>
                  </div>
                  <div className="sp-metric">
                    <span className="sp-metric-label">{t('schema.tabs')}</span>
                    <span className="sp-metric-value">{visibleTabs.length}</span>
                  </div>
                </div>
              </section>

              <section className="sp-panel">
                <div className="sp-panel-head">
                  <span className="sp-panel-title">{t('sprint.rowsPerTab')}</span>
                  <span className="sp-panel-sub">
                    {t('sprint.rowsTotal', { rows: String(totalRows), tabs: String(visibleTabs.length) })}
                  </span>
                </div>
                <div className="sp-panel-body">
                  {tabCounts.map((tab) => (
                    <div key={tab.id} className="sp-bar-row">
                      <span className="sp-bar-label">{tab.label}</span>
                      <div className="sp-bar-track">
                        <div className="sp-bar-fill" style={{ width: `${(tab.count / maxCount) * 100}%` }} />
                      </div>
                      <span className="sp-bar-value">{tab.count}</span>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}
        </div>

        <aside className="sp-side">
          <div className="sp-side-head">
            <span className="sp-side-title">{t('sprint.allSprints')}</span>
            <input
              type="text"
              className="field-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('sprint.searchSprint')}
            />
          </div>
          <div className="sp-side-body">
            {filteredActive.length > 0 && (
              <>
                <h3 className="sp-side-group">{t('sprint.active')}</h3>
                {filteredActive.map(renderItem)}
              </>
            )}
            {filteredArchived.length > 0 && (
              <>
                <h3 className="sp-side-group">{t('sprint.archived')}</h3>
                {filteredArchived.map(renderItem)}
              </>
            )}
            {noMatches && (
              <div className="sp-empty">
                <p className="sp-empty-title">{t('sprint.noMatches')}</p>
              </div>
            )}
            {sprints.length === 0 && (
              <div className="sp-empty">
                <p className="sp-empty-title">{t('sprint.noSprints')}</p>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
