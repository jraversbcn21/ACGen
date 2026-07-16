import { PROVIDERS, DEFAULT_PROVIDER } from '../config/providers';
import { useT } from '../i18n/I18nContext';

interface ProviderConfigProps {
  provider: string;
  onProviderChange: (id: string) => void;
  apiKey: string;
  onApiKeyChange: (key: string) => void;
  model: string;
  onModelChange: (model: string) => void;
  baseUrl?: string;
  onBaseUrlChange?: (url: string) => void;
}

export function ProviderConfig({
  provider, onProviderChange, apiKey, onApiKeyChange,
  model, onModelChange, baseUrl = '', onBaseUrlChange,
}: ProviderConfigProps) {
  const t = useT();
  const def = PROVIDERS[provider] ?? PROVIDERS[DEFAULT_PROVIDER];

  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
      <div>
        <label className="field-label">Proveedor</label>
        <select value={provider} onChange={(e) => { const newDef = PROVIDERS[e.target.value]; onProviderChange(e.target.value); if (newDef) onModelChange(newDef.defaultModel); }}
          className="field-select" style={{ minWidth: 120 }}>
          {Object.values(PROVIDERS).map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
        </select>
      </div>
      {def.needsBaseUrl && onBaseUrlChange && (
        <div>
          <label className="field-label">URL del API</label>
          <input type="text" value={baseUrl} onChange={(e) => onBaseUrlChange(e.target.value)}
            placeholder="https://api.openai.com/v1/chat/completions" className="field-input" style={{ minWidth: 280 }} />
        </div>
      )}
      <div>
        <label className="field-label">{t('landing.model')}</label>
        {def.models.length > 0 ? (
          <select value={model} onChange={(e) => onModelChange(e.target.value)} className="field-select" style={{ minWidth: 220 }}>
            {def.models.map((m) => (<option key={m} value={m}>{m}</option>))}
          </select>
        ) : (
          <input type="text" value={model} onChange={(e) => onModelChange(e.target.value)} placeholder="gpt-4o" className="field-input" style={{ minWidth: 220 }} />
        )}
      </div>
      <div>
        <label className="field-label">{t('landing.apiKey')}</label>
        <input type="password" value={apiKey} onChange={(e) => onApiKeyChange(e.target.value)}
          placeholder={provider === 'groq' ? 'gsk_...' : 'sk-...'} className="field-input" style={{ minWidth: 220 }} />
      </div>
    </div>
  );
}
