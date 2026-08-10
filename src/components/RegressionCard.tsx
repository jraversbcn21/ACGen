import { useState } from 'react';
import type { Regression, TicketField } from '../hooks/useRegressions';
import { filledTicketCount, ticketRowHasContent } from '../hooks/useRegressions';
import { parseUrlCell } from '../utils/trackerLinks';
import { formatDate } from '../utils/dates';
import { useT, useLang } from '../i18n/I18nContext';

const TICKET_COLUMNS: { field: TicketField; labelKey: string }[] = [
  { field: 'ticket', labelKey: 'regression.colTicket' },
  { field: 'fecha', labelKey: 'regression.colFecha' },
  { field: 'prioridad', labelKey: 'regression.colPrioridad' },
  { field: 'creador', labelKey: 'regression.colCreador' },
  { field: 'squad', labelKey: 'regression.colSquad' },
];

interface RegressionCardProps {
  regression: Regression;
  readOnly?: boolean;
  defaultExpanded?: boolean;
  onUpdateRegression?: (patch: { version?: string; url?: string; fecha?: string }) => void;
  onUpdateTicket?: (ticketId: string, field: TicketField, value: string) => void;
  onAddTicket?: () => void;
  onDeleteTicket?: (ticketId: string) => void;
  onArchive?: () => void;
  onDelete?: () => void;
}

export function RegressionCard({
  regression,
  readOnly = false,
  defaultExpanded = false,
  onUpdateRegression,
  onUpdateTicket,
  onAddTicket,
  onDeleteTicket,
  onArchive,
  onDelete,
}: RegressionCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ version: '', url: '', fecha: '' });
  const [focusedCell, setFocusedCell] = useState<string | null>(null); // `${ticketId}` (solo columna ticket)
  const t = useT();
  const { lang } = useLang();

  const urlParts = regression.url ? parseUrlCell(regression.url) : null;
  const ticketCount = filledTicketCount(regression);

  const startEdit = () => {
    setDraft({ version: regression.version, url: regression.url, fecha: regression.fecha });
    setEditing(true);
  };
  const saveEdit = () => {
    onUpdateRegression?.(draft);
    setEditing(false);
  };

  const headerInputStyle: React.CSSProperties = {
    height: 28, padding: '0 8px', fontSize: 12, fontFamily: 'var(--font-ui)',
    background: 'var(--surface)', color: 'var(--text)',
    border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', outline: 'none',
  };

  return (
    <div
      className="sprint-card"
      style={{
        border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
        background: 'var(--surface-2)', marginBottom: 8,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', flexWrap: 'wrap' }}>
        <button
          type="button"
          className="btn-ghost"
          aria-label={t('regression.toggleTickets')}
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
          style={{ padding: '2px 8px', fontSize: 12 }}
        >
          {expanded ? '▾' : '▸'}
        </button>
        {editing ? (
          <>
            <input
              type="text"
              autoFocus
              aria-label={t('regression.versionLabel')}
              value={draft.version}
              onChange={(e) => setDraft((d) => ({ ...d, version: e.target.value }))}
              onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditing(false); }}
              style={{ ...headerInputStyle, width: 90 }}
            />
            <input
              type="text"
              aria-label={t('regression.urlLabel')}
              value={draft.url}
              onChange={(e) => setDraft((d) => ({ ...d, url: e.target.value }))}
              onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditing(false); }}
              style={{ ...headerInputStyle, flex: 1, minWidth: 180 }}
            />
            <input
              type="date"
              aria-label={t('regression.dateLabel')}
              value={draft.fecha}
              onChange={(e) => setDraft((d) => ({ ...d, fecha: e.target.value }))}
              style={{ ...headerInputStyle, width: 140 }}
            />
            <button type="button" className="btn-ghost" onClick={saveEdit} style={{ padding: '4px 10px', fontSize: 12 }}>
              {t('common.save')}
            </button>
            <button type="button" className="btn-ghost" onClick={() => setEditing(false)} style={{ padding: '4px 10px', fontSize: 12 }}>
              {t('common.cancel')}
            </button>
          </>
        ) : (
          <>
            <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>{regression.version}</span>
            {urlParts && (
              <a
                href={urlParts.url}
                target="_blank"
                rel="noopener noreferrer"
                title={t('regression.openLinkDirect')}
                style={{
                  color: 'var(--accent)', fontWeight: 600, fontSize: 12, fontFamily: 'var(--font-mono)',
                  maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}
              >
                {urlParts.name ?? urlParts.url} ↗
              </a>
            )}
            <span style={{ fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
              {formatDate(regression.fecha, lang)}
            </span>
            <span className="badge badge-info" style={{ fontSize: 11 }}>
              {ticketCount} {t('regression.ticketsBadge')}
            </span>
            {!readOnly && (
              <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                <button type="button" className="btn-ghost" onClick={startEdit} style={{ padding: '4px 10px', fontSize: 12 }}>
                  {t('common.edit')}
                </button>
                <button type="button" className="btn-ghost" onClick={onArchive} style={{ padding: '4px 10px', fontSize: 12 }}>
                  {t('common.archive')}
                </button>
                <button type="button" className="btn-ghost" onClick={onDelete} style={{ padding: '4px 10px', fontSize: 12 }}>
                  {t('common.delete')}
                </button>
              </span>
            )}
          </>
        )}
      </div>

      {expanded && (
        <div style={{ padding: '0 16px 14px' }}>
          <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
            <table style={{ borderCollapse: 'collapse', fontSize: 12, fontFamily: 'var(--font-mono)', width: '100%', tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: '30%' }} />
                <col style={{ width: '15%' }} />
                <col style={{ width: '15%' }} />
                <col style={{ width: '18%' }} />
                <col style={{ width: '17%' }} />
                {!readOnly && <col style={{ width: 36 }} />}
              </colgroup>
              <thead>
                <tr>
                  {TICKET_COLUMNS.map(({ labelKey }) => (
                    <th key={labelKey} style={{
                      height: 26, background: 'var(--surface)', border: '1px solid var(--border)',
                      fontSize: 11, fontWeight: 700, color: 'var(--text-2)', textAlign: 'left', padding: '0 6px',
                    }}>{t(labelKey)}</th>
                  ))}
                  {!readOnly && <th style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}></th>}
                </tr>
              </thead>
              <tbody>
                {regression.tickets.map((ticket) => (
                  <tr key={ticket.id}>
                    {TICKET_COLUMNS.map(({ field }) => {
                      const value = ticket[field];
                      const parts = field === 'ticket' ? parseUrlCell(value) : null;
                      const isFocused = focusedCell === ticket.id;
                      const showNameOverlay = Boolean(parts?.name) && !isFocused;
                      return (
                        <td
                          key={field}
                          onClick={(e) => {
                            if (parts && e.ctrlKey) window.open(parts.url, '_blank', 'noopener,noreferrer');
                          }}
                          title={parts ? t('regression.openLink') : undefined}
                          style={{
                            border: '1px solid var(--border)', padding: 0, position: 'relative', overflow: 'hidden',
                            cursor: parts ? 'pointer' : undefined,
                          }}
                        >
                          <input
                            type="text"
                            value={value}
                            readOnly={readOnly}
                            onChange={(e) => onUpdateTicket?.(ticket.id, field, e.target.value)}
                            onFocus={field === 'ticket' ? () => setFocusedCell(ticket.id) : undefined}
                            onBlur={field === 'ticket' ? () => setFocusedCell((prev) => (prev === ticket.id ? null : prev)) : undefined}
                            style={{
                              width: '100%', height: 28, border: 'none', outline: 'none',
                              padding: '0 6px', fontSize: 12, fontFamily: 'var(--font-mono)', background: 'transparent',
                              color: showNameOverlay ? 'transparent' : parts ? 'var(--accent)' : 'var(--text)',
                              fontWeight: parts ? 600 : 400,
                              cursor: parts ? 'pointer' : undefined,
                            }}
                          />
                          {showNameOverlay && (
                            <span style={{
                              position: 'absolute', left: 0, right: 0, top: 0, height: 28, lineHeight: '28px',
                              padding: '0 6px', fontSize: 12, fontFamily: 'var(--font-mono)',
                              color: 'var(--accent)', fontWeight: 600,
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                              pointerEvents: 'none',
                            }}>{parts!.name}</span>
                          )}
                          {parts && (
                            <button
                              type="button"
                              className="cell-open-link"
                              tabIndex={-1}
                              title={t('regression.openLinkDirect')}
                              aria-label={t('regression.openLinkDirect')}
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={(e) => {
                                e.stopPropagation();
                                window.open(parts.url, '_blank', 'noopener,noreferrer');
                              }}
                            >
                              ↗
                            </button>
                          )}
                        </td>
                      );
                    })}
                    {!readOnly && (
                      <td style={{ border: '1px solid var(--border)', textAlign: 'center', padding: 0 }}>
                        <button
                          type="button"
                          className="btn-ghost"
                          aria-label={t('common.delete')}
                          title={t('common.delete')}
                          onClick={() => {
                            if (ticketRowHasContent(ticket) && !confirm(t('regression.deleteRowConfirm'))) return;
                            onDeleteTicket?.(ticket.id);
                          }}
                          style={{ padding: '2px 8px', fontSize: 12 }}
                        >
                          ×
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!readOnly && (
            <button type="button" className="btn-ghost" onClick={onAddTicket} style={{ marginTop: 8, padding: '6px 14px', fontSize: 13 }}>
              + {t('regression.addTicket')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
