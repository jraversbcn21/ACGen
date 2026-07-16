// src/components/ConfidentialToggle.tsx
import { useLocalStorage } from '../hooks/useLocalStorage';
import type { ViewType } from '../config/constants';

interface ConfidentialToggleProps {
  view: ViewType;
  substitutionCount: number;
  onReview: () => void;
}

export function ConfidentialToggle({ view, substitutionCount, onReview }: ConfidentialToggleProps) {
  const [enabled, setEnabled] = useLocalStorage(`acgen_confidential_${view}`, false);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13 }}>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          style={{ accentColor: 'var(--accent)' }}
        />
        Modo confidencial
      </label>
      {enabled && substitutionCount > 0 && (
        <button
          type="button"
          className="btn-ghost"
          onClick={onReview}
          style={{ fontSize: 12, padding: '2px 8px' }}
        >
          {substitutionCount} sustituciones — Revisar
        </button>
      )}
    </div>
  );
}
