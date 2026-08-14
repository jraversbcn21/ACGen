import { describe, it, expect } from 'vitest';
import { DEFAULT_PROMPTS } from './constants';
import { DEMO_DATA } from './demoData';
import { interpolateProfile } from '../services/apiService';
import { DEFAULT_PROFILE } from '../types/context';

// Reglas de plantilla de Jorge (2026-07-16) — desde la Fase 1 (2026-08-13) los
// literales del proyecto viven en DEFAULT_PROFILE y los prompts llevan
// placeholders; el perfil por defecto debe reproducir el comportamiento clásico.
describe('prompt templates', () => {
  it('ningún prompt por defecto incluye un nombre de validador', () => {
    for (const [tool, prompt] of Object.entries(DEFAULT_PROMPTS)) {
      expect(prompt, `prompt "${tool}" still names a validator`).not.toContain('Jorge-QA');
    }
  });

  it('ningún demo output incluye un nombre de validador', () => {
    for (const [tool, entry] of Object.entries(DEMO_DATA)) {
      expect(entry.output, `demo "${tool}" still names a validator`).not.toContain('Jorge-QA');
    }
  });

  it('la plantilla de criterios mantiene "Validado por:" como etiqueta vacía', () => {
    expect(DEFAULT_PROMPTS.acceptance).toContain('*Validado por:*');
  });

  it('los prompts por defecto ya no llevan literales del proyecto', () => {
    expect(DEFAULT_PROMPTS.bugreport).not.toContain('Pro/ES');
    expect(DEFAULT_PROMPTS.acceptance).not.toContain('/Pro');
    expect(DEFAULT_PROMPTS.testdata).not.toContain('Adyen');
    expect(DEFAULT_PROMPTS.testdata).not.toContain('Test1234');
    expect(DEFAULT_PROMPTS.testcase).not.toContain('PDP');
  });

  it('interpolar el perfil por defecto reproduce el comportamiento clásico', () => {
    const bugreport = interpolateProfile(DEFAULT_PROMPTS.bugreport, DEFAULT_PROFILE);
    expect(bugreport).toContain('- Entorno/Pais: Pro/ES');
    const acceptance = interpolateProfile(DEFAULT_PROMPTS.acceptance, DEFAULT_PROFILE);
    expect(acceptance).toContain('España/Pro, México/Pro, Francia/Pro');
    const testdata = interpolateProfile(DEFAULT_PROMPTS.testdata, DEFAULT_PROFILE);
    expect(testdata).toContain('4111 1111 1111 1111');
    expect(testdata).toContain('exactamente "Test1234"');
    const testcase = interpolateProfile(DEFAULT_PROMPTS.testcase, DEFAULT_PROFILE);
    expect(testcase).toContain('PDP (Detalle de Producto), Cesta y Checkout');
    expect(testcase).toContain('DEBE estar en español');
  });

  it('el bug report deja Versión y Evidencia vacías', () => {
    expect(DEFAULT_PROMPTS.bugreport).not.toContain('Adjuntar captura');
    expect(DEFAULT_PROMPTS.bugreport).not.toMatch(/- Versión: \S/);
  });
});
