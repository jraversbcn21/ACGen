import { useState, useEffect, useRef } from 'react';
import type { Regression } from '../hooks/useRegressions';
import { filledTicketCount, ticketRowHasContent } from '../hooks/useRegressions';
import { useSchema } from '../hooks/useSchema';
import { resolveLabel, visibleEntries } from '../types/schema';
import { parseUrlCell } from '../utils/trackerLinks';
import { formatDate } from '../utils/dates';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { STORAGE_KEYS } from '../config/constants';
import { useT, useLang } from '../i18n/I18nContext';
import { highlightMatches, containsMatch, MARK_STYLE } from '../utils/highlight';

// Anchos iniciales en px de los campos por defecto (Ticket ancho, el resto
// compacto); el usuario los ajusta arrastrando el borde de cada cabecera.
// Un campo anadido por el usuario arranca en FALLBACK_COL_WIDTH.
const DEFAULT_COL_WIDTHS: Record<string, number> = {
  ticket: 300, fecha: 110, prioridad: 110, creador: 130, squad: 120, status: 110,
};
const FALLBACK_COL_WIDTH = 120;
const MIN_COL_WIDTH = 50;

interface RegressionCardProps {
  regression: Regression;
  /** 'card' = acordeon apilado (historial). 'panel' = detalle a toda la altura (tablero 11b). */
  variant?: 'card' | 'panel';
  readOnly?: boolean;
  defaultExpanded?: boolean;
  dragHandle?: React.ReactNode;
  forceExpanded?: boolean;
  visibleTicketIds?: string[];
  onUpdateRegression?: (patch: { version?: string; url?: string; fecha?: string }) => void;
  onUpdateTicket?: (ticketId: string, field: string, value: string) => void;
  onAddTicket?: () => void;
  onDeleteTicket?: (ticketId: string) => void;
  onArchive?: () => void;
  onDelete?: () => void;
  highlightNeedle?: string;
}

export function RegressionCard({
  regression,
  variant = 'card',
  readOnly = false,
  defaultExpanded = false,
  dragHandle,
  forceExpanded = false,
  visibleTicketIds,
  onUpdateRegression,
  onUpdateTicket,
  onAddTicket,
  onDeleteTicket,
  onArchive,
  onDelete,
  highlightNeedle,
}: RegressionCardProps) {
  const isPanel = variant === 'panel';
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ version: '', url: '', fecha: '' });
  const [focusedCell, setFocusedCell] = useState<string | null>(null); // `${ticketId}:${field}`
  const t = useT();
  const { lang } = useLang();

  const [schema] = useSchema();
  const columns = visibleEntries(schema.regression.ticketFields);
  const fieldIds = columns.map((c) => c.id);
  // La celda-enlace es la PRIMERA COLUMNA VISIBLE, no el id 'ticket': asi
  // sobrevive a renombrados y a que se oculte algo por delante. Con el esquema
  // por defecto es exactamente la misma celda que antes.
  const linkFieldId = fieldIds[0];

  // Resize de columnas (patrón TrackerGrid): en readOnly (snapshots) vive solo
  // en memoria — arranca con los anchos guardados pero nunca escribe la clave.
  const [storedColWidths, setStoredColWidths] = useLocalStorage<Record<string, number>>(
    STORAGE_KEYS.REGRESSION_TICKET_COL_WIDTHS, {}
  );
  const [ephemeralColWidths, setEphemeralColWidths] = useState<Record<string, number>>(
    () => storedColWidths
  );
  const colWidths = readOnly ? ephemeralColWidths : storedColWidths;
  const setColWidths = readOnly ? setEphemeralColWidths : setStoredColWidths;
  const [isResizing, setIsResizing] = useState(false);
  const resizeRef = useRef<{ field: string; startX: number; startWidth: number } | null>(null);

  useEffect(() => {
    if (!isResizing) return;
    const handleMouseMove = (e: MouseEvent) => {
      if (!resizeRef.current) return;
      const { field, startX, startWidth } = resizeRef.current;
      const newWidth = Math.max(MIN_COL_WIDTH, startWidth + e.clientX - startX);
      setColWidths((prev) => ({ ...prev, [field]: newWidth }));
    };
    const handleMouseUp = () => {
      resizeRef.current = null;
      setIsResizing(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, setColWidths]);

  const startResize = (e: React.MouseEvent, field: string) => {
    e.preventDefault();
    e.stopPropagation();
    resizeRef.current = {
      field, startX: e.clientX,
      startWidth: colWidths[field] ?? DEFAULT_COL_WIDTHS[field] ?? FALLBACK_COL_WIDTH,
    };
    setIsResizing(true);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  // El panel no se pliega: su cuerpo ES la pantalla.
  const isExpanded = isPanel || forceExpanded || expanded;
  const visibleTickets = visibleTicketIds
    ? regression.tickets.filter((tk) => visibleTicketIds.includes(tk.id))
    : regression.tickets;

  const urlParts = regression.url ? parseUrlCell(regression.url) : null;
  const ticketCount = filledTicketCount(regression, fieldIds);

  // Resumen de estados: los valores de `status` los escribe el usuario, asi que
  // se cuentan tal cual en vez de asumir un vocabulario cerrado. Sin columna
  // status visible (o sin ningun valor escrito) no se muestra nada.
  const statusFieldId = fieldIds.includes('status') ? 'status' : null;
  const statusSummary = (() => {
    if (!statusFieldId) return '';
    const counts = new Map<string, number>();
    for (const tk of regression.tickets) {
      const value = (tk[statusFieldId] ?? '').trim();
      if (!value) continue;
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([value, n]) => `${n} ${value.toLowerCase()}`)
      .join(' · ');
  })();

  const needle = highlightNeedle?.trim() ?? '';
  const urlVisibleText = urlParts ? (urlParts.name ?? urlParts.url) : '';
  const urlVisibleMatch = needle !== '' && urlParts !== null && containsMatch(urlVisibleText, needle);
  const urlHiddenMatch = needle !== '' && urlParts !== null && !urlVisibleMatch && containsMatch(regression.url, needle);

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

  const editFields = (
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
  );

  const urlLink = urlParts && (
    <a
      href={urlParts.url}
      target="_blank"
      rel="noopener noreferrer"
      title={urlHiddenMatch ? t('regression.matchInUrl') : t('regression.openLinkDirect')}
      style={{
        color: 'var(--accent)', fontWeight: 600, fontSize: 12, fontFamily: 'var(--font-mono)',
        maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}
    >
      {urlVisibleMatch
        ? highlightMatches(urlVisibleText, needle)
        : urlHiddenMatch
          ? <span style={MARK_STYLE}>{urlVisibleText}</span>
          : urlParts.name ?? urlParts.url} ↗
    </a>
  );

  const rowActions = !readOnly && (
    <>
      <button type="button" className="btn-ghost" onClick={startEdit} style={{ padding: '4px 10px', fontSize: 12 }}>
        {t('common.edit')}
      </button>
      <button type="button" className="btn-ghost" onClick={onArchive} style={{ padding: '4px 10px', fontSize: 12 }}>
        {t('common.archive')}
      </button>
      <button type="button" className="btn-ghost" onClick={onDelete} style={{ padding: '4px 10px', fontSize: 12 }}>
        {t('common.delete')}
      </button>
    </>
  );

  const ticketTable = (
    <table style={{ borderCollapse: 'collapse', fontSize: 12, fontFamily: 'var(--font-mono)', width: '100%', tableLayout: 'fixed' }}>
      <colgroup>
        {columns.map(({ id }) => (
          <col key={id} style={{ width: colWidths[id] ?? DEFAULT_COL_WIDTHS[id] ?? FALLBACK_COL_WIDTH }} />
        ))}
        {!readOnly && <col style={{ width: 36 }} />}
      </colgroup>
      <thead>
        <tr>
          {columns.map((column) => (
            <th key={column.id} style={{
              position: isPanel ? 'sticky' : 'relative', top: isPanel ? 0 : undefined, zIndex: isPanel ? 2 : undefined,
              height: 26, background: 'var(--surface)', border: '1px solid var(--border)',
              fontSize: 11, fontWeight: 700, color: 'var(--text-2)', textAlign: 'left', padding: '0 6px',
            }}>
              {resolveLabel(column, t)}
              <div
                data-col-resize={column.id}
                onMouseDown={(e) => startResize(e, column.id)}
                style={{
                  position: 'absolute', right: -1, top: 0, width: 5, height: '100%',
                  cursor: 'col-resize', zIndex: 10,
                }}
              />
            </th>
          ))}
          {!readOnly && (
            <th style={{
              position: isPanel ? 'sticky' : undefined, top: isPanel ? 0 : undefined, zIndex: isPanel ? 2 : undefined,
              background: 'var(--surface)', border: '1px solid var(--border)',
            }}></th>
          )}
        </tr>
      </thead>
      <tbody>
        {visibleTickets.map((ticket) => (
          <tr key={ticket.id}>
            {columns.map(({ id: field }) => {
              const value = ticket[field] ?? '';
              const parts = field === linkFieldId ? parseUrlCell(value) : null;
              const cellKey = `${ticket.id}:${field}`;
              const isFocused = focusedCell === cellKey;
              const visibleText = parts ? (parts.name ?? parts.url) : value;
              const visibleMatch = needle !== '' && containsMatch(visibleText, needle);
              const hiddenMatch = needle !== '' && !visibleMatch && containsMatch(value, needle);
              // Un solo overlay por celda: nombre SnapLink (resaltado, tintado o plano)
              // o texto plano resaltado. Con foco no hay overlay: edición normal.
              let overlayContent: React.ReactNode = null;
              if (!isFocused) {
                if (parts?.name) {
                  overlayContent = visibleMatch
                    ? highlightMatches(parts.name, needle)
                    : hiddenMatch
                      ? <span style={MARK_STYLE}>{parts.name}</span>
                      : parts.name;
                } else if (visibleMatch) {
                  overlayContent = highlightMatches(visibleText, needle);
                }
              }
              const showOverlay = overlayContent !== null;
              return (
                <td
                  key={field}
                  onClick={(e) => {
                    if (parts && e.ctrlKey) window.open(parts.url, '_blank', 'noopener,noreferrer');
                  }}
                  title={hiddenMatch && parts ? t('regression.matchInUrl') : parts ? t('regression.openLink') : undefined}
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
                    onFocus={() => setFocusedCell(cellKey)}
                    onBlur={() => setFocusedCell((prev) => (prev === cellKey ? null : prev))}
                    style={{
                      width: '100%', height: 28, border: 'none', outline: 'none',
                      padding: '0 6px', fontSize: 12, fontFamily: 'var(--font-mono)', background: 'transparent',
                      color: showOverlay ? 'transparent' : parts ? 'var(--accent)' : 'var(--text)',
                      fontWeight: parts ? 600 : 400,
                      cursor: parts ? 'pointer' : undefined,
                    }}
                  />
                  {showOverlay && (
                    <span style={{
                      position: 'absolute', left: 0, right: 0, top: 0, height: 28, lineHeight: '28px',
                      padding: '0 6px', fontSize: 12, fontFamily: 'var(--font-mono)',
                      color: parts ? 'var(--accent)' : 'var(--text)', fontWeight: parts ? 600 : 400,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      pointerEvents: 'none',
                    }}>{overlayContent}</span>
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
                    // Todos los campos del esquema, no solo los visibles:
                    // una fila con contenido solo en una columna oculta no
                    // esta vacia, y borrarla sin confirm destruiria un dato
                    // que "ocultar nunca borra" promete conservar.
                    if (ticketRowHasContent(ticket, schema.regression.ticketFields.map((f) => f.id)) && !confirm(t('regression.deleteRowConfirm'))) return;
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
  );

  const canAddTicket = !readOnly && !visibleTicketIds;

  // ---------- PANEL (tablero 11b): cabecera + tabla a toda la altura ----------
  if (isPanel) {
    return (
      <div className="rg-detail">
        <div className="rg-detail-head">
          {editing ? (
            <div className="rg-detail-edit">{editFields}</div>
          ) : (
            <>
              <div className="rg-detail-id">
                <div className="rg-detail-title">
                  <span className="rg-detail-version">{needle ? highlightMatches(regression.version, needle) : regression.version}</span>
                  {urlLink}
                </div>
                <div className="rg-detail-meta">
                  <span>{regression.fecha ? formatDate(regression.fecha, lang) : ''}</span>
                  <span className="rg-detail-count">{ticketCount} {t('regression.ticketsBadge')}</span>
                  {statusSummary && <span>{statusSummary}</span>}
                </div>
              </div>
              <div className="rg-detail-actions">{rowActions}</div>
            </>
          )}
        </div>

        <div className="rg-detail-body">{ticketTable}</div>

        <div className="rg-detail-foot">
          {canAddTicket ? (
            <button type="button" className="btn-ghost" onClick={onAddTicket} style={{ padding: '6px 14px', fontSize: 13 }}>
              + {t('regression.addTicket')}
            </button>
          ) : <span />}
          <span className="rg-detail-hint">{t('regression.ctrlHint')}</span>
        </div>
      </div>
    );
  }

  // ---------- CARD (historial archivado): acordeón apilado ----------
  return (
    <div
      className="sprint-card"
      style={{
        border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
        background: 'var(--surface-2)', marginBottom: 8,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', flexWrap: 'wrap' }}>
        {dragHandle}
        <button
          type="button"
          className="btn-ghost"
          aria-label={t('regression.toggleTickets')}
          aria-expanded={isExpanded}
          disabled={forceExpanded}
          onClick={() => setExpanded((v) => !v)}
          style={{ padding: '2px 8px', fontSize: 12 }}
        >
          {isExpanded ? '▾' : '▸'}
        </button>
        {editing ? editFields : (
          <>
            <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>{needle ? highlightMatches(regression.version, needle) : regression.version}</span>
            {urlLink}
            <span style={{ fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
              {formatDate(regression.fecha, lang)}
            </span>
            <span className="badge badge-info" style={{ fontSize: 11 }}>
              {ticketCount} {t('regression.ticketsBadge')}
            </span>
            {!readOnly && (
              <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>{rowActions}</span>
            )}
          </>
        )}
      </div>

      {isExpanded && (
        <div style={{ padding: '0 16px 14px' }}>
          <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
            {ticketTable}
          </div>
          {canAddTicket && (
            <button type="button" className="btn-ghost" onClick={onAddTicket} style={{ marginTop: 8, padding: '6px 14px', fontSize: 13 }}>
              + {t('regression.addTicket')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
