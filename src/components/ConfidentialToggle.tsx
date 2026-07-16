// src/components/ConfidentialToggle.tsx
import { useMemo } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { useT } from '../i18n/I18nContext';
import { anonymize } from '../services/anonymizer';
import type { ViewType } from '../config/constants';

interface ConfidentialToggleProps {
  view: ViewType;
  /** The exact text the tool would send, so the badge counts what is really at stake. */
  text: string;
  onReview: () => void;
}

export function ConfidentialToggle({ view, text, onReview }: ConfidentialToggleProps) {
  const [enabled, setEnabled] = useLocalStorage(`acgen_confidential_${view}`, false);
  const t = useT();

  // Only scan while the mode is on — off, this never runs.
  const substitutionCount = useMemo(
    () => (enabled ? Object.keys(anonymize(text).map).length : 0),
    [enabled, text],
  );

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13 }}>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          style={{ accentColor: 'var(--accent)' }}
        />
        {t('confidential.toggle')}
      </label>
      {enabled && substitutionCount > 0 && (
        <button
          type="button"
          className="btn-ghost"
          onClick={onReview}
          style={{ fontSize: 12, padding: '2px 8px' }}
        >
          {substitutionCount} {t('confidential.review')}
        </button>
      )}
    </div>
  );
}
