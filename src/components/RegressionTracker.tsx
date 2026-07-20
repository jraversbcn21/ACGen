import { useState, useCallback } from 'react';
import { TrackerGrid } from './TrackerGrid';
import { useRegressions, PLATFORM_IDS } from '../hooks/useRegressions';
import type { PlatformId, ArchivedRegression } from '../hooks/useRegressions';
import { STORAGE_KEYS } from '../config/constants';
import { useT, useLang } from '../i18n/I18nContext';
import { formatDate } from '../utils/dates';

const PLATFORM_LABELS: Record<PlatformId, string> = {
  ios: 'iOS',
  android: 'Android',
  webDesktop: 'WEB',
};

const REGRESSION_HEADERS = ['Regresión', 'Versión', 'Fecha', 'Notas', 'Status'];

const PLATFORM_HEADERS: Record<PlatformId, string[]> = {
  ios: REGRESSION_HEADERS,
  android: REGRESSION_HEADERS,
  webDesktop: REGRESSION_HEADERS,
};

type Screen = { kind: 'board' } | { kind: 'archivedList' } | { kind: 'snapshot'; id: string };

export function RegressionTracker() {
  const { board, archived, updateGridCell, setTabGrid, moveRow, archiveBoard, deleteArchived } = useRegressions();
  const [screen, setScreen] = useState<Screen>({ kind: 'board' });
  const t = useT();
  const { lang } = useLang();

  const handleArchive = useCallback(() => {
    if (!confirm(t('regression.archiveConfirm'))) return;
    archiveBoard();
  }, [archiveBoard, t]);

  const noop = useCallback(() => {}, []);

  const snapshot: ArchivedRegression | null =
    screen.kind === 'snapshot' ? archived.find((a) => a.id === screen.id) ?? null : null;

  if (snapshot) {
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <button type="button" className="btn-ghost" onClick={() => setScreen({ kind: 'archivedList' })} style={{ padding: '6px 14px' }}>
            ← {t('common.back')}
          </button>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>{snapshot.name}</h2>
          <span className="badge badge-info" style={{ fontSize: 11 }}>{t('regression.archivedBadge')}</span>
        </div>
        <TrackerGrid
          tabs={PLATFORM_IDS}
          tabLabels={PLATFORM_LABELS}
          tabHeaders={PLATFORM_HEADERS}
          tabGrid={snapshot.board}
          linkMode="url"
          readOnly
          colWidthsStorageKey={STORAGE_KEYS.REGRESSION_COL_WIDTHS}
          searchPlaceholder={t('regression.searchPlaceholder')}
          onUpdateGridCell={noop}
          onSetTabGrid={noop}
          onMoveRow={noop}
        />
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
              <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>{a.name}</div>
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
      <TrackerGrid
        tabs={PLATFORM_IDS}
        tabLabels={PLATFORM_LABELS}
        tabHeaders={PLATFORM_HEADERS}
        tabGrid={board}
        linkMode="url"
        colWidthsStorageKey={STORAGE_KEYS.REGRESSION_COL_WIDTHS}
        searchPlaceholder={t('regression.searchPlaceholder')}
        onUpdateGridCell={updateGridCell}
        onSetTabGrid={setTabGrid}
        onMoveRow={moveRow}
      />
      <div className="actions-bar">
        <button type="button" className="btn-ghost" onClick={handleArchive}>
          {t('regression.archive')}
        </button>
      </div>
    </div>
  );
}
