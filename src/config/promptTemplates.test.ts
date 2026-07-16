import { describe, it, expect } from 'vitest';
import { DEFAULT_PROMPTS } from './constants';
import { DEMO_DATA } from './demoData';

// Jorge's template rules (2026-07-16): "Validado por:" ships as a bare label in
// every tool, and the bug report pins Entorno/Pais to Pro/ES with Versión and
// Evidencia left empty for manual fill-in.
describe('prompt templates', () => {
  it('no default prompt hardcodes a validator name', () => {
    for (const [tool, prompt] of Object.entries(DEFAULT_PROMPTS)) {
      expect(prompt, `prompt "${tool}" still names a validator`).not.toContain('Jorge-QA');
    }
  });

  it('no demo output hardcodes a validator name', () => {
    for (const [tool, entry] of Object.entries(DEMO_DATA)) {
      expect(entry.output, `demo "${tool}" still names a validator`).not.toContain('Jorge-QA');
    }
  });

  it('the acceptance template keeps "Validado por:" as a bare label', () => {
    expect(DEFAULT_PROMPTS.acceptance).toContain('*Validado por:*');
  });

  it('the bug report DESCRIPCIÓN pins Entorno/Pais to Pro/ES', () => {
    expect(DEFAULT_PROMPTS.bugreport).toContain('- Entorno/Pais: Pro/ES');
  });

  it('the bug report leaves Versión and Evidencia empty', () => {
    expect(DEFAULT_PROMPTS.bugreport).not.toContain('Adjuntar captura');
    expect(DEFAULT_PROMPTS.bugreport).not.toMatch(/- Versión: \S/);
  });
});
