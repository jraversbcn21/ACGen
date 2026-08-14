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
      'qwen/qwen3.7-flash',
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

/**
 * Modelos con soporte de entrada de imagen, por proveedor. Groq retiró sus
 * modelos de visión (Llama 4 Scout/Maverick) en 2026 — lista vacía a propósito.
 */
export const VISION_MODELS: Readonly<Record<string, readonly string[]>> = {
  groq: [],
  openrouter: [
    'openai/gpt-4o',
    'anthropic/claude-sonnet-4',
    'google/gemini-2.5-flash',
    'meta-llama/llama-4-maverick',
    'qwen/qwen3.7-flash',
  ],
};

/**
 * 'unknown' = proveedor con lista de modelos abierta (custom): no podemos
 * verificar la capacidad; el llamador decide si avisa en vez de bloquear.
 * Recibe el modelo ya saneado (pásalo por sanitizeModel antes si viene de localStorage).
 */
export function supportsVision(providerId: string, model: string): 'yes' | 'no' | 'unknown' {
  const def = getProvider(providerId);
  if (def.models.length === 0) return 'unknown';
  return (VISION_MODELS[def.id] ?? []).includes(model) ? 'yes' : 'no';
}

/**
 * A custom provider's base URL is free text; an empty one would silently fall
 * back to the default (Groq) endpoint downstream, sending the wrong key to the
 * wrong host. Callers branch on the status to block or explain instead.
 */
export function baseUrlStatus(url: string): 'missing' | 'invalid' | 'valid' {
  if (!url.trim()) return 'missing';
  try {
    new URL(url);
    return 'valid';
  } catch {
    return 'invalid';
  }
}
