import type { HistoryEntry } from '../types';

interface HistoryModalProps {
  entries: HistoryEntry[];
  onLoad: (output: string) => void;
  onClearAll: () => void;
  onClose: () => void;
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
}

export function HistoryModal({ entries, onLoad, onClearAll, onClose }: HistoryModalProps) {
  return (
    <div className="history-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="history-modal">
        <div className="history-modal-header">
          <span className="history-modal-title">Historial</span>
          <div style={{ display: 'flex', gap: 8 }}>
            {entries.length > 0 && (
              <button
                type="button"
                className="btn-ghost"
                style={{ fontSize: 12, padding: '4px 10px' }}
                onClick={() => { if (window.confirm('¿Borrar todo el historial?')) onClearAll(); }}
              >
                Borrar todo
              </button>
            )}
            <button type="button" className="history-close-btn" onClick={onClose} aria-label="Cerrar">✕</button>
          </div>
        </div>

        <div className="history-modal-body">
          {entries.length === 0 ? (
            <div className="history-empty">No hay entradas en el historial todavía.</div>
          ) : (
            entries.map((entry) => (
              <div key={entry.id} className="history-entry">
                <div className="history-entry-meta">
                  <span className="history-entry-date">{formatDate(entry.timestamp)}</span>
                </div>
                <div className="history-entry-preview">{entry.inputPreview}{entry.inputPreview.length === 60 ? '…' : ''}</div>
                <button
                  type="button"
                  className="btn-ghost history-entry-load"
                  onClick={() => { onLoad(entry.output); onClose(); }}
                >
                  Cargar
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
