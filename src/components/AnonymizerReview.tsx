// src/components/AnonymizerReview.tsx
import { useEffect, useState } from 'react';
import { useT } from '../i18n/I18nContext';

interface AnonymizerReviewProps {
  map: Record<string, string>;
  onConfirm: (editedMap: Record<string, string>) => void;
  onCancel: () => void;
}

export function AnonymizerReview({ map, onConfirm, onCancel }: AnonymizerReviewProps) {
  const entries = Object.entries(map);
  const [edited, setEdited] = useState<Record<string, string>>({ ...map });
  const t = useT();

  useEffect(() => {
    if (entries.length === 0) {
      onConfirm(map);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640 }}>
        <h2 style={{ margin: '0 0 4px' }}>{t('confidential.title')}</h2>
        <p style={{ margin: '0 0 16px', color: 'var(--text-2)', fontSize: 14 }}>
          {t('confidential.subtitle', { count: entries.length })}
        </p>
        <div style={{ maxHeight: 360, overflowY: 'auto', marginBottom: 16 }}>
          <table className="data-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th style={{ width: '40%' }}>{t('confidential.original')}</th>
                <th style={{ width: '60%' }}>{t('confidential.sentAs')}</th>
              </tr>
            </thead>
            <tbody>
              {entries.map(([placeholder, original]) => (
                <tr key={placeholder}>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: 13, wordBreak: 'break-all' }}>{original}</td>
                  <td>
                    <input
                      type="text"
                      value={edited[placeholder] ?? placeholder}
                      onChange={(e) => setEdited(prev => ({ ...prev, [placeholder]: e.target.value }))}
                      className="field-input"
                      style={{ fontFamily: 'var(--font-mono)', fontSize: 13, width: '100%' }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" className="btn-ghost" onClick={onCancel}>{t('common.cancel')}</button>
          <button type="button" className="btn-primary" onClick={() => onConfirm(edited)}>
            {t('confidential.confirmSend')}
          </button>
        </div>
      </div>
    </div>
  );
}
