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
