import { useState } from 'react';

interface ApiKeyConfigProps {
  apiKey: string;
  onChange: (key: string) => void;
}

export function ApiKeyConfig({ apiKey, onChange }: ApiKeyConfigProps) {
  const [showKey, setShowKey] = useState(false);

  return (
    <div className="config-section">
      <label htmlFor="api-key" className="config-label">
        API Key de GROQ
      </label>
      <div className="input-wrapper">
        <input
          id="api-key"
          type={showKey ? 'text' : 'password'}
          value={apiKey}
          onChange={(e) => onChange(e.target.value)}
          placeholder="gsk_..."
          className="input input-api-key"
        />
        <button
          type="button"
          className="btn btn-icon"
          onClick={() => setShowKey((v) => !v)}
          title={showKey ? 'Ocultar key' : 'Mostrar key'}
        >
          {showKey ? '🙈' : '👁️'}
        </button>
      </div>
    </div>
  );
}
