import { describe, it, expect } from 'vitest';
import { extractJsonObject, validateDesignReport } from './apiService';
import type { I18nError } from './apiService';

const VALID = {
  carencias: [{ flujo: 'Login social', descripcion: 'El diseño muestra botón de Google sin criterio' }],
  contradicciones: [{ criterio: 'Dado que el usuario...', evidenciaDiseno: 'El CTA dice "Continuar", no "Comprar"', descripcion: 'El texto del botón no coincide' }],
  sugerencias: [{ titulo: 'Login con Google', dado: 'un usuario en la pantalla de login', cuando: 'pulsa "Continuar con Google"', entonces: 'se inicia el flujo OAuth' }],
};

describe('extractJsonObject', () => {
  it('parsea un objeto JSON limpio', () => {
    expect(extractJsonObject(JSON.stringify(VALID))).toEqual(VALID);
  });

  it('quita fences de markdown', () => {
    expect(extractJsonObject('```json\n' + JSON.stringify(VALID) + '\n```')).toEqual(VALID);
  });

  it('recorta texto alrededor del primer { y el último }', () => {
    expect(extractJsonObject('Aquí tienes:\n' + JSON.stringify(VALID) + '\nEspero que sirva.')).toEqual(VALID);
  });

  it('lanza error.invalidJson si no hay JSON', () => {
    expect(() => extractJsonObject('sin json')).toThrowError('error.invalidJson');
  });

  it('lanza error.invalidFormat si el JSON es un array', () => {
    expect(() => extractJsonObject('[1,2]')).toThrowError('error.invalidFormat');
  });
});

describe('validateDesignReport', () => {
  it('acepta un informe válido completo', () => {
    expect(validateDesignReport(VALID as Record<string, unknown>)).toEqual(VALID);
  });

  it('una categoría ausente se normaliza a array vacío', () => {
    const r = validateDesignReport({ carencias: [] });
    expect(r).toEqual({ carencias: [], contradicciones: [], sugerencias: [] });
  });

  it('lanza error.invalidDesignReport si una categoría no es array', () => {
    let caught: I18nError | null = null;
    try { validateDesignReport({ carencias: 'no' }); } catch (e) { caught = e as I18nError; }
    expect(caught?.message).toBe('error.invalidDesignReport');
    expect(caught?.params).toEqual({ field: 'carencias' });
  });

  it('lanza error.invalidDesignReport si falta un campo string en un item', () => {
    let caught: I18nError | null = null;
    try { validateDesignReport({ sugerencias: [{ titulo: 'x', dado: 'y', cuando: 'z' }] }); } catch (e) { caught = e as I18nError; }
    expect(caught?.message).toBe('error.invalidDesignReport');
    expect(caught?.params).toEqual({ field: 'sugerencias.entonces' });
  });

  it('ignora claves extra del modelo sin fallar', () => {
    const r = validateDesignReport({ ...VALID, notas: 'bla' } as Record<string, unknown>);
    expect(r).toEqual(VALID);
  });
});
