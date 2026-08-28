import { useState, useCallback } from 'react';
import { TrackerGrid } from './TrackerGrid';
import { RegressionCard } from './RegressionCard';
import { RegressionSchemaEditor } from './RegressionSchemaEditor';
import { useRegressions, isLegacyArchived, filledTicketCount } from '../hooks/useRegressions';
import type { PlatformId, ArchivedItem, Regression } from '../hooks/useRegressions';
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
  // Version enfocada POR PLATAFORMA: cambiar de APPS a WEB y volver no pierde
  // la que estabas mirando. Una plataforma sin entrada aqui cae a la primera
  // visible, asi que el panel nunca arranca vacio habiendo regresiones.
  const [selectedIds, setSelectedIds] = useState<Record<PlatformId, string>>({});
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
  // ocultar; en ese caso se reencamina a la primera visible. Si un esquema
  // escrito a mano deja CERO plataformas visibles, platformIds[0] tambien es
  // undefined — sin el fallback final, `regressions[undefined]` escribiria
  // bajo la clave literal "undefined" en vez de fallar de forma audible.
  const safeTab: PlatformId =
    platformIds.includes(activeTab) ? activeTab : platformIds[0] ?? DEFAULT_SCHEMA.regression.platforms[0].id;

  const platformLabel = (id: PlatformId): string =>
    resolveLabel(schema.regression.platforms.find((p) => p.id === id), t) || id;

  const archivedLabel = (item: ArchivedItem): string =>
    isLegacyArchived(item) ? item.name : `${platformLabel(item.platform)} · ${item.regression.version}`;

  const noop = useCallback(() => {}, []);

  const handleCreate = () => {
    if (!draft.version.trim()) return;
    addRegression(safeTab, draft);
    // Se limpia la seleccion de la plataforma para que el detalle caiga a la
    // primera visible, que es la recien creada (addRegression inserta arriba):
    // creas una version para rellenarla, no para tener que clicarla despues.
    setSelectedIds((prev) => {
      const next = { ...prev };
      delete next[safeTab];
      return next;
    });
    setDraft({ version: '', url: '', fecha: localTodayISO() });
    setShowNewForm(false);
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
            tabColumns={Object.fromEntries(platformIds.map((p) => [
              p, LEGACY_HEADERS.map((label, i) => ({ label, dataIndex: i })),
            ]))}
            tabColCount={Object.fromEntries(platformIds.map((p) => [p, LEGACY_HEADERS.length]))}
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
      if (!needle) return { regression, index, visibleTicketIds: undefined as string[] | undefined };
      const ticketIds = regression.tickets
        .filter((tk) => visibleFieldIds.some((f) => hasText(tk[f] ?? '')))
        .map((tk) => tk.id);
      if (ticketIds.length > 0) return { regression, index, visibleTicketIds: ticketIds };
      if (hasText(regression.version) || hasText(regression.url)) {
        return { regression, index, visibleTicketIds: undefined as string[] | undefined };
      }
      return null;
    })
    .filter((v): v is NonNullable<typeof v> => v !== null);

  // El detalle sigue a la version que el usuario toca en el rail; si aun no ha
  // tocado ninguna —o la que miraba ya no pasa el filtro— cae a la primera
  // visible, que es la mas reciente porque addRegression inserta al principio.
  const selected = visible.find((v) => v.regression.id === selectedIds[safeTab]) ?? visible[0] ?? null;

  const ticketsInTab = list.reduce((sum, r) => sum + filledTicketCount(r, visibleFieldIds), 0);

  const renderRailItem = ({ regression, index }: { regression: Regression; index: number }) => {
    const isSelected = selected?.regression.id === regression.id;
    const count = filledTicketCount(regression, visibleFieldIds);
    return (
      <div
        key={regression.id}
        className={`rg-item ${isSelected ? 'rg-item-selected' : ''}`}
        role="button"
        tabIndex={0}
        aria-current={isSelected}
        data-drag-index={index}
        onClick={() => setSelectedIds((prev) => ({ ...prev, [safeTab]: regression.id }))}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setSelectedIds((prev) => ({ ...prev, [safeTab]: regression.id }));
          }
        }}
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
        }}
      >
        {!searching && (
          <span
            draggable
            role="button"
            aria-label={t('regression.dragHandle')}
            title={t('regression.dragHandle')}
            className="rg-item-grip"
            onClick={(e) => e.stopPropagation()}
            onDragStart={(e) => {
              if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
              setDragIndex(index);
            }}
            onDragEnd={() => { setDragIndex(null); setDropTarget(null); }}
          >
            ⠿
          </span>
        )}
        <span className="rg-item-text">
          <span className="rg-item-version">{regression.version}</span>
          <span className="rg-item-url" title={regression.url}>{regression.url || '—'}</span>
        </span>
        <span className="rg-item-meta">
          <span className="rg-item-count">{count}</span>
          <span className="rg-item-date">{regression.fecha ? formatDate(regression.fecha, lang) : ''}</span>
        </span>
      </div>
    );
  };

  return (
    <div className="rg-root">
      <header className="tool-head">
        <div className="tool-head-main">
          <h1 className="tool-title">{t('regression.title')}</h1>
          <p className="tool-sub">
            {t('regression.subtitle', {
              platform: platformLabel(safeTab),
              regs: String(list.length),
              tickets: String(ticketsInTab),
            })}
          </p>
        </div>
        <div className="tool-head-aside">
          {archived.length > 0 && (
            <button type="button" className="btn-ghost" onClick={() => setScreen({ kind: 'archivedList' })}>
              {t('regression.archivedList')} ({archived.length})
            </button>
          )}
          <button type="button" className="btn-ghost" onClick={() => setShowSchemaEditor(true)}>
            {t('schema.open')}
          </button>
          <a
            href="https://chromewebstore.google.com/detail/SnapLink/nooilpnmljdmpdknbkckjiieafoaikfc?utm_source=ext_app_menu"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-ghost"
            style={{ textDecoration: 'none' }}
            title="Descargar extensión SnapLink para Chrome"
          >
            + SnapLink
          </a>
        </div>
      </header>

      {showNewForm && (
        <div className="rg-form">
          <div className="rg-form-row">
            <div className="rg-form-field" style={{ flex: '0 0 120px' }}>
              <label htmlFor="rg-version" className="field-label">{t('regression.versionLabel')}</label>
              <input
                id="rg-version"
                type="text"
                className="field-input"
                autoFocus
                placeholder="1.0.0"
                value={draft.version}
                onChange={(e) => setDraft((d) => ({ ...d, version: e.target.value }))}
                onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setShowNewForm(false); }}
              />
            </div>
            <div className="rg-form-field" style={{ flex: 1, minWidth: 220 }}>
              <label htmlFor="rg-url" className="field-label">{t('regression.urlLabel')}</label>
              <input
                id="rg-url"
                type="text"
                className="field-input"
                placeholder="https://..."
                value={draft.url}
                onChange={(e) => setDraft((d) => ({ ...d, url: e.target.value }))}
                onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setShowNewForm(false); }}
              />
            </div>
            <div className="rg-form-field" style={{ flex: '0 0 170px' }}>
              <label htmlFor="rg-fecha" className="field-label">{t('regression.dateLabel')}</label>
              <input
                id="rg-fecha"
                type="date"
                className="field-input"
                value={draft.fecha}
                onChange={(e) => setDraft((d) => ({ ...d, fecha: e.target.value }))}
              />
            </div>
          </div>
          <div className="rg-form-actions">
            <button type="button" className="btn-primary" disabled={!draft.version.trim()} onClick={handleCreate} style={{ minWidth: 140 }}>
              {t('regression.create')}
            </button>
            <button type="button" className="btn-ghost" onClick={() => setShowNewForm(false)}>
              {t('common.cancel')}
            </button>
          </div>
        </div>
      )}

      <div className="rg-grid">
        {/* ---------- RAIL: versiones de la plataforma ---------- */}
        <aside className="rg-rail">
          <div className="rg-rail-head">
            <div className="rg-tabs" role="tablist">
              {platforms.map((platform) => (
                <button
                  key={platform.id}
                  type="button"
                  role="tab"
                  aria-selected={safeTab === platform.id}
                  className={`rg-tab ${safeTab === platform.id ? 'rg-tab-active' : ''}`}
                  onClick={() => setActiveTab(platform.id)}
                >
                  {resolveLabel(platform, t)}
                </button>
              ))}
            </div>
            <div className="rg-search">
              <input
                type="search"
                className="field-input"
                aria-label={t('regression.searchPlaceholder')}
                placeholder={t('regression.searchPlaceholder')}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {searching && (
                <span className="rg-search-count">{visible.length}/{list.length}</span>
              )}
            </div>
            <button type="button" className="btn-primary rg-new" onClick={() => {
              setDraft({ version: '', url: '', fecha: localTodayISO() });
              setShowNewForm((v) => !v);
            }}>
              + {t('regression.newRegression')}
            </button>
          </div>
          <div className="rg-rail-body">
            {list.length === 0 && <p className="rg-rail-empty">{t('regression.noRegressions')}</p>}
            {list.length > 0 && visible.length === 0 && <p className="rg-rail-empty">{t('regression.noMatches')}</p>}
            {visible.map(renderRailItem)}
          </div>
        </aside>

        {/* ---------- DETALLE: tickets de la version enfocada ---------- */}
        <section className="rg-detail-wrap">
          {selected ? (
            <RegressionCard
              key={selected.regression.id}
              variant="panel"
              regression={selected.regression}
              visibleTicketIds={selected.visibleTicketIds}
              highlightNeedle={needle || undefined}
              onUpdateRegression={(patch) => updateRegression(safeTab, selected.regression.id, patch)}
              onUpdateTicket={(ticketId, field, value) => updateTicket(safeTab, selected.regression.id, ticketId, field, value)}
              onAddTicket={() => addTicket(safeTab, selected.regression.id)}
              onDeleteTicket={(ticketId) => deleteTicket(safeTab, selected.regression.id, ticketId)}
              onArchive={() => { if (confirm(t('regression.archiveOneConfirm'))) archiveRegression(safeTab, selected.regression.id); }}
              onDelete={() => { if (confirm(t('regression.deleteOneConfirm'))) deleteRegression(safeTab, selected.regression.id); }}
            />
          ) : (
            <div className="rg-detail-empty">
              <span className="rg-detail-empty-title">{t('regression.selectVersion')}</span>
              <span className="rg-detail-empty-sub">{t('regression.selectHint')}</span>
            </div>
          )}
        </section>
      </div>

      {showSchemaEditor && <RegressionSchemaEditor onClose={() => setShowSchemaEditor(false)} />}
    </div>
  );
}
