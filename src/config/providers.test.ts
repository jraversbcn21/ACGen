import { describe, it, expect } from 'vitest';
import { PROVIDERS, getProvider, DEFAULT_PROVIDER, sanitizeModel, baseUrlStatus } from './providers';
import { AVAILABLE_MODELS, DEFAULT_MODEL } from './constants';

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

describe('sanitizeModel', () => {
  it('keeps an openrouter model that belongs to the openrouter list', () => {
    expect(sanitizeModel('openrouter', 'anthropic/claude-sonnet-4')).toBe('anthropic/claude-sonnet-4');
  });

  it('keeps a groq model that exists in AVAILABLE_MODELS', () => {
    expect(sanitizeModel('groq', AVAILABLE_MODELS[0])).toBe(AVAILABLE_MODELS[0]);
  });

  it('resets a decommissioned groq model to the groq default', () => {
    expect(sanitizeModel('groq', 'old-deprecated-model')).toBe(DEFAULT_MODEL);
  });

  it('does not judge a groq model by the openrouter list', () => {
    expect(sanitizeModel('openrouter', DEFAULT_MODEL)).toBe(PROVIDERS.openrouter.defaultModel);
  });

  it('keeps any free-text model for the custom provider', () => {
    expect(sanitizeModel('custom', 'my-self-hosted-model')).toBe('my-self-hosted-model');
  });

  it('falls back to the groq default for an unknown provider with an invalid model', () => {
    expect(sanitizeModel('nonexistent', 'whatever')).toBe(DEFAULT_MODEL);
  });
});

describe('baseUrlStatus', () => {
  it('reports missing for an empty string', () => {
    expect(baseUrlStatus('')).toBe('missing');
  });

  it('reports missing for whitespace only', () => {
    expect(baseUrlStatus('   ')).toBe('missing');
  });

  it('reports invalid for a non-parseable URL', () => {
    expect(baseUrlStatus('not a url')).toBe('invalid');
  });

  it('reports valid for a well-formed https URL', () => {
    expect(baseUrlStatus('https://api.example.com/v1/chat/completions')).toBe('valid');
  });

  it('reports valid for a localhost URL with port', () => {
    expect(baseUrlStatus('http://localhost:11434/v1/chat/completions')).toBe('valid');
  });
});
