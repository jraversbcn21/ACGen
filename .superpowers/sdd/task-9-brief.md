### Task 3.6: Multi-Provider LLM

**Files:**
- Create: `src/config/providers.ts`
- Create: `src/config/providers.test.ts`
- Create: `src/components/ProviderConfig.tsx`
- Modify: `src/services/apiService.ts` — streamWithGroq + generateWithGroq accept `baseUrl`
- Modify: `src/App.tsx` — provider state, key migration, pass to Header/tools
- Modify: `src/components/Header.tsx` — render ProviderConfig
- Modify: `src/components/LandingScreen.tsx` — ProviderConfig replaces ApiKeyConfig+ModelSelector

**Context:** i18n is in place. Prompts are customizable. This task makes the LLM provider configurable.

- [ ] **Step 1: Create providers.ts**

```typescript
// src/config/providers.ts
import { AVAILABLE_MODELS, DEFAULT_MODEL } from './constants';

export interface ProviderDef {
  id: string;
  name: string;
  baseUrl: string;
  models: string[];
  defaultModel: string;
  needsBaseUrl?: boolean;
}

export const PROVIDERS: Record<string, ProviderDef> = {
  groq: {
    id: 'groq',
    name: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1/chat/completions',
    models: [...AVAILABLE_MODELS],
    defaultModel: DEFAULT_MODEL,
  },
  openrouter: {
    id: 'openrouter',
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1/chat/completions',
    models: [
      'openai/gpt-4o',
      'anthropic/claude-sonnet-4',
      'google/gemini-2.5-flash',
      'meta-llama/llama-4-maverick',
      'deepseek/deepseek-chat-v3',
      'qwen/qwen3-235b',
      'mistralai/mistral-large',
      'cohere/command-r-plus',
    ],
    defaultModel: 'openai/gpt-4o',
  },
  custom: {
    id: 'custom',
    name: 'Custom',
    baseUrl: '',
    models: [],
    defaultModel: '',
    needsBaseUrl: true,
  },
};

export const DEFAULT_PROVIDER = 'groq';

export function getProvider(id: string): ProviderDef {
  return PROVIDERS[id] ?? PROVIDERS[DEFAULT_PROVIDER];
}
```

- [ ] **Step 2: Create providers.test.ts**

```typescript
// src/config/providers.test.ts
import { describe, it, expect } from 'vitest';
import { PROVIDERS, getProvider, DEFAULT_PROVIDER } from './providers';

describe('PROVIDERS', () => {
  it('has groq, openrouter, and custom entries', () => {
    expect(PROVIDERS.groq).toBeDefined();
    expect(PROVIDERS.openrouter).toBeDefined();
    expect(PROVIDERS.custom).toBeDefined();
  });
  it('groq has 5 models', () => {
    expect(PROVIDERS.groq.models).toHaveLength(5);
  });
  it('openrouter has predefined models', () => {
    expect(PROVIDERS.openrouter.models.length).toBeGreaterThan(0);
  });
  it('custom has empty models array and needsBaseUrl', () => {
    expect(PROVIDERS.custom.models).toEqual([]);
    expect(PROVIDERS.custom.needsBaseUrl).toBe(true);
    expect(PROVIDERS.custom.baseUrl).toBe('');
  });
});

describe('getProvider', () => {
  it('returns groq by default for unknown id', () => {
    const p = getProvider('nonexistent');
    expect(p.id).toBe(DEFAULT_PROVIDER);
  });
  it('returns the correct provider by id', () => {
    expect(getProvider('openrouter').id).toBe('openrouter');
  });
});
```

- [ ] **Step 3: Modify apiService.ts — add baseUrl param**

In `streamWithGroq`, add `baseUrl?: string` as the LAST optional parameter (after `anonymizeMap`). Change the fetch call from `fetch(API_URL, {` to `fetch(baseUrl || API_URL, {`.

In `generateWithGroq`, add `baseUrl?: string` as the LAST optional parameter (after `profile`). Same fetch change.

The full signatures should be (cumulative):
- `streamWithGroq(apiKey, model, userInput, systemPrompt, tool, profile?, anonymizeMap?, baseUrl?)`
- `generateWithGroq(apiKey, model, userInput, systemPrompt, requiredMarkers, signal?, reasoningParams?, profile?, baseUrl?)`

- [ ] **Step 4: Create ProviderConfig.tsx**

Create a component that shows: provider dropdown (Groq/OpenRouter/Custom), model selector (dynamic per provider), API key input, and optional base URL field for custom provider. Use existing App.css class names. Import useT().

```typescript
// src/components/ProviderConfig.tsx
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
```

- [ ] **Step 5: Integrate into App.tsx**

Add provider state:
```typescript
import { DEFAULT_PROVIDER } from './config/providers';

// Migrate old API key to groq-specific key on first load
const [apiKey, setApiKey] = useLocalStorage('acgen_key_groq', () => {
  try {
    const oldKey = localStorage.getItem('acgen_api_key');
    if (oldKey) {
      const parsed = JSON.parse(oldKey);
      if (typeof parsed === 'string' && parsed) return parsed;
    }
  } catch { }
  return '';
});

const [provider, setProvider] = useLocalStorage('acgen_provider', DEFAULT_PROVIDER);
const [openrouterKey, setOpenrouterKey] = useLocalStorage('acgen_key_openrouter', '');
const [customKey, setCustomKey] = useLocalStorage('acgen_key_custom', '');
const [customBaseUrl, setCustomBaseUrl] = useLocalStorage('acgen_custom_base_url', '');

const currentApiKey = provider === 'groq' ? apiKey : provider === 'openrouter' ? openrouterKey : customKey;
const currentModel = provider === 'groq' ? model : provider === 'openrouter' ? model : model;
const currentBaseUrl = provider === 'custom' ? customBaseUrl : (PROVIDERS[provider]?.baseUrl ?? '');
```

You'll need to keep a single `model` state. When provider changes, reset model to provider's default. Simplify: use one model state, validated per provider.

The simplest approach: keep the existing `model` state (which still works for Groq), and pass `currentApiKey`, `currentModel`, `currentBaseUrl` to tools. Also need a `providerApiKey` per provider — use the one matching current provider.

Each tool already receives `apiKey` and `model` props. Pass the resolved values and add `baseUrl` as a new prop to all 8 LLM tools.

Pass provider state as props to Header and LandingScreen for ProviderConfig rendering.

- [ ] **Step 6: Update Header and LandingScreen**

**Header.tsx**: Add provider props and render `<ProviderConfig>` alongside or replacing the existing model badge area. Remove standalone ApiKeyConfig rendering from LandingScreen.

**LandingScreen.tsx**: Replace the existing `<ApiKeyConfig ...>` + `<ModelSelector ...>` with `<ProviderConfig ...>` passed from App.

- [ ] **Step 7: Add baseUrl prop to all 8 LLM tools**

Each tool's Props interface gets `baseUrl?: string`. Pass `baseUrl` to `streamWithGroq()` calls.

- [ ] **Step 8: Type check, tests, build**

```bash
npx tsc -b --noEmit 2>&1    # zero errors
npm test 2>&1                # all 90 + 6 provider = 96 tests pass
npm run build 2>&1           # succeeds (PWA SW generated)
```

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(provider): multi-provider LLM — Groq + OpenRouter + Custom, ProviderConfig, key migration"
```
