import { useState, useCallback } from 'react';
import { TrackerGrid } from './TrackerGrid';
import { RegressionCard } from './RegressionCard';
import { RegressionSchemaEditor } from './RegressionSchemaEditor';
import { useRegressions, isLegacyArchived } from '../hooks/useRegressions';
import type { PlatformId, ArchivedItem } from '../hooks/useRegressions';
import { useSchema } from '../hooks/useSchema';
import { DEFAULT_SCHEMA, resolveLabel, visibleEntries } from '../types/schema';
import { STORAGE_KEYS } from '../config/constants';
import { useT, useLang } from '../i18n/I18nContext';
import { formatDate, localTodayISO } from '../utils/dates';

// Cabeceras del grid ANTIGUO: solo para renderizar snapshots legacy del historial.
const LEGACY_HEADERS = ['Regresión', 'Versión', 'Fecha', 'Notas', 'Status'];

type Screen = { kind: 'board' } | { kind: 'archivedList' } | { kind: 'snapshot'; id: string };

export function RegressionTracker() {
  const {
    regressions, archived,
    addRegression, updateRegression, deleteRegression,
    addTicket, updateTicket, deleteTicket,
    archiveRegression, deleteArchived, moveRegression,
  } = useRegressions();
  const [screen, setScreen] = useState<Screen>({ kind: 'board' });
  const [activeTab, setActiveTab] = useState<PlatformId>(DEFAULT_SCHEMA.regression.platforms[0].id);
  const [showNewForm, setShowNewForm] = useState(false);
  const [showSchemaEditor, setShowSchemaEditor] = useState(false);
  const [draft, setDraft] = useState({ version: '', url: '', fecha: localTodayISO() });
  const [query, setQuery] = useState('');
  const needle = query.trim().toLowerCase();
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<{ index: number; half: 'top' | 'bottom' } | null>(null);
  const searching = needle !== '';
  const t = useT();
  const { lang } = useLang();

  const [schema] = useSchema();
  const platforms = visibleEntries(schema.regression.platforms);
  const platformIds = platforms.map((p) => p.id);
  const visibleFieldIds = visibleEntries(schema.regression.ticketFields).map((f) => f.id);

  // activeTab puede quedar apuntando a una plataforma que el usuario acaba de
  // ocultar; en ese caso se reencamina a la primera visible.
  const safeTab: PlatformId = platformIds.includes(activeTab) ? activeTab : platformIds[0];

  const platformLabel = (id: PlatformId): string =>
    resolveLabel(schema.regression.platforms.find((p) => p.id === id), t) || id;

  const archivedLabel = (item: ArchivedItem): string =>
    isLegacyArchived(item) ? item.name : `${platformLabel(item.platform)} · ${item.regression.version}`;

  const noop = useCallback(() => {}, []);

  const handleCreate = () => {
    if (!draft.version.trim()) return;
    addRegression(safeTab, draft);
    setDraft({ version: '', url: '', fecha: localTodayISO() });
    setShowNewForm(false);
  };

  const formInputStyle: React.CSSProperties = {
    height: 30, padding: '0 10px', fontSize: 12, fontFamily: 'var(--font-ui)',
    background: 'var(--surface-2)', color: 'var(--text)',
    border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', outline: 'none',
  };

  const snapshot: ArchivedItem | null =
    screen.kind === 'snapshot' ? archived.find((a) => a.id === screen.id) ?? null : null;

  if (snapshot) {
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <button type="button" className="btn-ghost" onClick={() => setScreen({ kind: 'archivedList' })} style={{ padding: '6px 14px' }}>
            ← {t('common.back')}
          </button>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>{archivedLabel(snapshot)}</h2>
          <span className="badge badge-info" style={{ fontSize: 11 }}>{t('regression.archivedBadge')}</span>
        </div>
        {isLegacyArchived(snapshot) ? (
          <TrackerGrid
            tabs={platformIds}
            tabLabels={Object.fromEntries(platforms.map((p) => [p.id, resolveLabel(p, t)]))}
            tabHeaders={Object.fromEntries(platformIds.map((p) => [p, LEGACY_HEADERS]))}
            tabGrid={snapshot.board}
            linkMode="url"
            readOnly
            colWidthsStorageKey={STORAGE_KEYS.REGRESSION_COL_WIDTHS}
            searchPlaceholder={t('regression.searchPlaceholder')}
            onUpdateGridCell={noop}
            onSetTabGrid={noop}
            onMoveRow={noop}
          />
        ) : (
          <RegressionCard regression={snapshot.regression} readOnly defaultExpanded />
        )}
      </div>
    );
  }

  if (screen.kind !== 'board') {
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <button type="button" className="btn-ghost" onClick={() => setScreen({ kind: 'board' })} style={{ padding: '6px 14px' }}>
            ← {t('common.back')}
          </button>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>{t('regression.archivedList')}</h2>
        </div>
        {archived.length === 0 && (
          <p style={{ marginTop: 32, textAlign: 'center', color: 'var(--text-3)', fontSize: 14 }}>
            {t('regression.noArchived')}
          </p>
        )}
        {archived.map((a) => (
          <div
            key={a.id}
            className="sprint-card"
            style={{
              padding: '14px 18px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
              background: 'var(--surface-2)', marginBottom: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              transition: 'box-shadow .18s var(--ease)', cursor: 'pointer',
            }}
            onClick={() => setScreen({ kind: 'snapshot', id: a.id })}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-sm)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
          >
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>{archivedLabel(a)}</div>
              <div style={{ fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                {formatDate(a.archivedAt, lang)}
              </div>
            </div>
            <button
              type="button"
              className="btn-ghost"
              onClick={(e) => { e.stopPropagation(); if (confirm(t('regression.deleteConfirm'))) deleteArchived(a.id); }}
              style={{ padding: '4px 10px', fontSize: 12 }}
            >
              {t('common.delete')}
            </button>
          </div>
        ))}
      </div>
    );
  }

  const list = regressions[safeTab] || [];
  const hasText = (s: string) => s.toLowerCase().includes(needle);
  const visible = list
    .map((regression, index) => {
      if (!needle) return { regression, index, forceExpanded: false, visibleTicketIds: undefined as string[] | undefined };
      const ticketIds = regression.tickets
        .filter((tk) => visibleFieldIds.some((f) => hasText(tk[f] ?? '')))
        .map((tk) => tk.id);
      if (ticketIds.length > 0) return { regression, index, forceExpanded: true, visibleTicketIds: ticketIds };
      if (hasText(regression.version) || hasText(regression.url)) {
        return { regression, index, forceExpanded: false, visibleTicketIds: undefined as string[] | undefined };
      }
      return null;
    })
    .filter((v): v is NonNullable<typeof v> => v !== null);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>{t('regression.title')}</h2>
        {archived.length > 0 && (
          <button
            type="button"
            className="btn-ghost"
            style={{ marginLeft: 'auto', padding: '6px 14px' }}
            onClick={() => setScreen({ kind: 'archivedList' })}
          >
            {t('regression.archivedList')} ({archived.length})
          </button>
        )}
      </div>

      <div className="sprint-tabs">
        {platforms.map((platform) => (
          <button
            key={platform.id}
            type="button"
            className={`btn-ghost ${safeTab === platform.id ? 'sprint-tab-active' : ''}`}
            onClick={() => setActiveTab(platform.id)}
          >
            {resolveLabel(platform, t)}
          </button>
        ))}
        <a
          href="https://chromewebstore.google.com/detail/SnapLink/nooilpnmljdmpdknbkckjiieafoaikfc?utm_source=ext_app_menu"
          target="_blank"
          rel="noopener noreferrer"
          className="btn-ghost"
          style={{ marginLeft: 'auto', padding: '6px 14px', fontSize: 12, textDecoration: 'none' }}
          title="Descargar extensión SnapLink para Chrome"
        >
          + SnapLink
        </a>
        <button
          type="button"
          className="btn-ghost"
          onClick={() => setShowSchemaEditor(true)}
          style={{ padding: '6px 14px', fontSize: 12 }}
        >
          {t('schema.open')}
        </button>
      </div>

      <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', flex: 1 }}>
          {!showNewForm ? (
            <button type="button" className="btn-ghost" onClick={() => { setDraft({ version: '', url: '', fecha: localTodayISO() }); setShowNewForm(true); }} style={{ padding: '6px 14px', fontSize: 13 }}>
              + {t('regression.newRegression')}
            </button>
          ) : (
            <>
              <input
                type="text"
                autoFocus
                aria-label={t('regression.versionLabel')}
                placeholder="1.0.0"
                value={draft.version}
                onChange={(e) => setDraft((d) => ({ ...d, version: e.target.value }))}
                onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setShowNewForm(false); }}
                style={{ ...formInputStyle, width: 100 }}
              />
              <input
                type="text"
                aria-label={t('regression.urlLabel')}
                placeholder="https://..."
                value={draft.url}
                onChange={(e) => setDraft((d) => ({ ...d, url: e.target.value }))}
                onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setShowNewForm(false); }}
                style={{ ...formInputStyle, flex: 1, minWidth: 200 }}
              />
              <input
                type="date"
                aria-label={t('regression.dateLabel')}
                value={draft.fecha}
                onChange={(e) => setDraft((d) => ({ ...d, fecha: e.target.value }))}
                style={{ ...formInputStyle, width: 150 }}
              />
              <button type="button" className="btn-ghost" disabled={!draft.version.trim()} onClick={handleCreate} style={{ padding: '6px 14px', fontSize: 13 }}>
                {t('regression.create')}
              </button>
              <button type="button" className="btn-ghost" onClick={() => setShowNewForm(false)} style={{ padding: '6px 14px', fontSize: 13 }}>
                {t('common.cancel')}
              </button>
            </>
          )}
        </span>
        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          {needle !== '' && (
            <span style={{ fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
              {visible.length} / {list.length}
            </span>
          )}
          <input
            type="text"
            aria-label={t('regression.searchPlaceholder')}
            placeholder={t('regression.searchPlaceholder')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ ...formInputStyle, width: 440, maxWidth: '100%', minWidth: 0 }}
          />
          {query !== '' && (
            <button
              type="button"
              className="btn-ghost"
              aria-label={t('regression.searchClear')}
              title={t('regression.searchClear')}
              onClick={() => setQuery('')}
              style={{ padding: '4px 8px', fontSize: 12 }}
            >
              ×
            </button>
          )}
        </span>
      </div>

      <div style={{ marginTop: 14 }}>
        {list.length === 0 && (
          <p style={{ marginTop: 24, textAlign: 'center', color: 'var(--text-3)', fontSize: 14 }}>
            {t('regression.noRegressions')}
          </p>
        )}
        {list.length > 0 && needle !== '' && visible.length === 0 && (
          <p style={{ marginTop: 24, textAlign: 'center', color: 'var(--text-3)', fontSize: 14 }}>
            {t('regression.noMatches')}
          </p>
        )}
        {visible.map(({ regression, index, forceExpanded, visibleTicketIds }) => (
          <div
            key={regression.id}
            data-drag-index={index}
            onDragOver={(e) => {
              if (dragIndex === null) return;
              e.preventDefault();
              const rect = e.currentTarget.getBoundingClientRect();
              const half = e.clientY < rect.top + rect.height / 2 ? 'top' : 'bottom';
              setDropTarget((prev) => (prev?.index === index && prev.half === half ? prev : { index, half }));
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (dragIndex !== null && dropTarget) {
                let to = dropTarget.half === 'top' ? dropTarget.index : dropTarget.index + 1;
                if (to > dragIndex) to -= 1;
                const dragged = list[dragIndex];
                if (dragged && to !== dragIndex) moveRegression(safeTab, dragged.id, to);
              }
              setDragIndex(null);
              setDropTarget(null);
            }}
            style={{
              opacity: dragIndex === index ? 0.5 : 1,
              boxShadow:
                dragIndex !== null && dropTarget?.index === index
                  ? dropTarget.half === 'top' ? '0 -2px 0 0 var(--accent)' : '0 2px 0 0 var(--accent)'
                  : undefined,
              borderRadius: 'var(--radius-sm)',
            }}
          >
            <RegressionCard
              regression={regression}
              forceExpanded={forceExpanded}
              visibleTicketIds={visibleTicketIds}
              highlightNeedle={needle || undefined}
              dragHandle={searching ? undefined : (
                <span
                  draggable
                  role="button"
                  aria-label={t('regression.dragHandle')}
                  title={t('regression.dragHandle')}
                  onDragStart={(e) => {
                    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
                    setDragIndex(index);
                  }}
                  onDragEnd={() => { setDragIndex(null); setDropTarget(null); }}
                  style={{ cursor: 'grab', color: 'var(--text-3)', fontSize: 14, userSelect: 'none', padding: '0 2px' }}
                >
                  ⠿
                </span>
              )}
              onUpdateRegression={(patch) => updateRegression(safeTab, regression.id, patch)}
              onUpdateTicket={(ticketId, field, value) => updateTicket(safeTab, regression.id, ticketId, field, value)}
              onAddTicket={() => addTicket(safeTab, regression.id)}
              onDeleteTicket={(ticketId) => deleteTicket(safeTab, regression.id, ticketId)}
              onArchive={() => { if (confirm(t('regression.archiveOneConfirm'))) archiveRegression(safeTab, regression.id); }}
              onDelete={() => { if (confirm(t('regression.deleteOneConfirm'))) deleteRegression(safeTab, regression.id); }}
            />
          </div>
        ))}
      </div>
      {showSchemaEditor && <RegressionSchemaEditor onClose={() => setShowSchemaEditor(false)} />}
    </div>
  );
}
