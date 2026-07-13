import { useState } from 'react';
import { Icon } from './Icons';

interface ApiKeyConfigProps {
  apiKey: string;
  onChange: (key: string) => void;
}

export function ApiKeyConfig({ apiKey, onChange }: ApiKeyConfigProps) {
  const [showKey, setShowKey] = useState(false);

  return (
    <div>
      <label htmlFor="api-key" className="field-label">
        API Key de GROQ
      </label>
      <div className="input-wrap">
        <input
          id="api-key"
          type={showKey ? 'text' : 'password'}
          value={apiKey}
          onChange={(e) => onChange(e.target.value)}
          placeholder="gsk_..."
          className={`field-input${showKey ? '' : ''}`}
          style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.02em', paddingRight: 46 }}
        />
        <button
          type="button"
          className="adorn-btn"
          onClick={() => setShowKey((v) => !v)}
          title={showKey ? 'Ocultar key' : 'Mostrar key'}
        >
          {showKey ? <Icon.eyeOff size={18} /> : <Icon.eye size={18} />}
        </button>
      </div>
      <a
        href="https://console.groq.com/keys"
        target="_blank"
        rel="noopener noreferrer"
        style={{ display: 'inline-block', marginTop: 6, fontSize: 11.5, fontWeight: 600, color: 'var(--accent)', textDecoration: 'none' }}
      >
        ¿No tienes una? Consíguela gratis en Groq →
      </a>
    </div>
  );
}
