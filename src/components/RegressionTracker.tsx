import { useState, useCallback } from 'react';
import { TrackerGrid } from './TrackerGrid';
import { RegressionCard } from './RegressionCard';
import { useRegressions, PLATFORM_IDS, isLegacyArchived } from '../hooks/useRegressions';
import type { PlatformId, ArchivedItem } from '../hooks/useRegressions';
import { STORAGE_KEYS } from '../config/constants';
import { useT, useLang } from '../i18n/I18nContext';
import { formatDate, localTodayISO } from '../utils/dates';

const PLATFORM_LABELS: Record<PlatformId, string> = {
  ios: 'APPS',
  webDesktop: 'WEB',
};

// Cabeceras del grid ANTIGUO: solo para renderizar snapshots legacy del historial.
const LEGACY_HEADERS = ['Regresión', 'Versión', 'Fecha', 'Notas', 'Status'];
const LEGACY_PLATFORM_HEADERS: Record<PlatformId, string[]> = {
  ios: LEGACY_HEADERS,
  webDesktop: LEGACY_HEADERS,
};

type Screen = { kind: 'board' } | { kind: 'archivedList' } | { kind: 'snapshot'; id: string };

function archivedLabel(item: ArchivedItem): string {
  return isLegacyArchived(item) ? item.name : `${PLATFORM_LABELS[item.platform]} · ${item.regression.version}`;
}

export function RegressionTracker() {
  const {
    regressions, archived,
    addRegression, updateRegression, deleteRegression,
    addTicket, updateTicket, deleteTicket,
    archiveRegression, deleteArchived,
  } = useRegressions();
  const [screen, setScreen] = useState<Screen>({ kind: 'board' });
  const [activeTab, setActiveTab] = useState<PlatformId>(PLATFORM_IDS[0]);
  const [showNewForm, setShowNewForm] = useState(false);
  const [draft, setDraft] = useState({ version: '', url: '', fecha: localTodayISO() });
  const [query, setQuery] = useState('');
  const needle = query.trim().toLowerCase();
  const t = useT();
  const { lang } = useLang();

  const noop = useCallback(() => {}, []);

  const handleCreate = () => {
    if (!draft.version.trim()) return;
    addRegression(activeTab, draft);
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
            tabs={PLATFORM_IDS}
            tabLabels={PLATFORM_LABELS}
            tabHeaders={LEGACY_PLATFORM_HEADERS}
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

  const list = regressions[activeTab] || [];
  const hasText = (s: string) => s.toLowerCase().includes(needle);
  const visible = list
    .map((regression, index) => {
      if (!needle) return { regression, index, forceExpanded: false, visibleTicketIds: undefined as string[] | undefined };
      const ticketIds = regression.tickets
        .filter((tk) => [tk.ticket, tk.fecha, tk.prioridad, tk.creador, tk.squad, tk.status].some(hasText))
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
        {PLATFORM_IDS.map((tab) => (
          <button
            key={tab}
            type="button"
            className={`btn-ghost ${activeTab === tab ? 'sprint-tab-active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {PLATFORM_LABELS[tab]}
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
        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
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
            style={{ ...formInputStyle, width: 220 }}
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
        {visible.map(({ regression, forceExpanded, visibleTicketIds }) => (
          <RegressionCard
            key={regression.id}
            regression={regression}
            forceExpanded={forceExpanded}
            visibleTicketIds={visibleTicketIds}
            onUpdateRegression={(patch) => updateRegression(activeTab, regression.id, patch)}
            onUpdateTicket={(ticketId, field, value) => updateTicket(activeTab, regression.id, ticketId, field, value)}
            onAddTicket={() => addTicket(activeTab, regression.id)}
            onDeleteTicket={(ticketId) => deleteTicket(activeTab, regression.id, ticketId)}
            onArchive={() => { if (confirm(t('regression.archiveOneConfirm'))) archiveRegression(activeTab, regression.id); }}
            onDelete={() => { if (confirm(t('regression.deleteOneConfirm'))) deleteRegression(activeTab, regression.id); }}
          />
        ))}
      </div>
    </div>
  );
}
