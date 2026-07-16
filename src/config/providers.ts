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

/**
 * Providers with a fixed model list reject models outside it (a model decommissioned
 * by the provider would otherwise be sent forever). Providers with an open list
 * (custom endpoints) accept any model id.
 */
export function sanitizeModel(providerId: string, model: string): string {
  const def = getProvider(providerId);
  if (def.models.length === 0) return model;
  return def.models.includes(model) ? model : def.defaultModel;
}
