import { describe, it, expect } from 'vitest';
import { supportsVision, VISION_MODELS, PROVIDERS } from './providers';

describe('supportsVision', () => {
  it('ningún modelo de Groq soporta visión (Llama 4 retirados en 2026)', () => {
    expect(VISION_MODELS.groq).toEqual([]);
    for (const model of PROVIDERS.groq.models) {
      expect(supportsVision('groq', model)).toBe('no');
    }
  });

  it('los modelos de visión de OpenRouter devuelven yes', () => {
    expect(supportsVision('openrouter', 'google/gemini-2.5-flash')).toBe('yes');
    expect(supportsVision('openrouter', 'openai/gpt-4o')).toBe('yes');
    expect(supportsVision('openrouter', 'anthropic/claude-sonnet-4')).toBe('yes');
    expect(supportsVision('openrouter', 'meta-llama/llama-4-maverick')).toBe('yes');
  });

  it('un modelo de OpenRouter sin visión devuelve no', () => {
    expect(supportsVision('openrouter', 'deepseek/deepseek-chat-v3')).toBe('no');
  });

  it('el proveedor custom devuelve unknown (capacidad no verificable)', () => {
    expect(supportsVision('custom', 'cualquier-modelo')).toBe('unknown');
  });

  it('todo modelo listado en VISION_MODELS existe en la lista de su proveedor', () => {
    for (const [providerId, models] of Object.entries(VISION_MODELS)) {
      for (const model of models) {
        expect(PROVIDERS[providerId].models, `${model} no está en ${providerId}`).toContain(model);
      }
    }
  });
});
