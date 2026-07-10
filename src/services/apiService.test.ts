import { describe, it, expect } from 'vitest';
import { validateTestCases, validateTestDataRows, isModelDecommissioned } from './apiService';

function validCase(overrides: Record<string, unknown> = {}) {
  return {
    key: 'TC-1',
    summary: 'Login válido',
    priority: 'High',
    type: 'Positivo',
    preconditions: 'Usuario registrado',
    testSteps: ['Abrir la app', 'Iniciar sesión'],
    expectedResult: 'El usuario accede correctamente',
    ...overrides,
  };
}

describe('validateTestCases', () => {
  it('accepts a well-formed test case', () => {
    const result = validateTestCases([validCase()]);
    expect(result).toHaveLength(1);
    expect(result[0].testSteps).toEqual(['Abrir la app', 'Iniciar sesión']);
  });

  it('throws when testSteps is a string instead of an array', () => {
    const items = [validCase({ testSteps: '1. Abrir la app\n2. Iniciar sesión' })];
    expect(() => validateTestCases(items)).toThrow(/testSteps/);
  });

  it('throws when testSteps contains non-string elements', () => {
    const items = [validCase({ testSteps: ['Abrir la app', 42] })];
    expect(() => validateTestCases(items)).toThrow(/testSteps/);
  });

  it('throws when a string field is a number', () => {
    const items = [validCase({ priority: 1 })];
    expect(() => validateTestCases(items)).toThrow(/priority/);
  });

  it('throws a clear error when an item is null', () => {
    const items = [validCase(), null];
    expect(() => validateTestCases(items)).toThrow(/caso de prueba 2/);
  });
});

describe('validateTestDataRows', () => {
  it('accepts rows with only primitive values', () => {
    const rows = validateTestDataRows([{ nombre: 'Maria', telefono: '+34612345678' }]);
    expect(rows).toEqual([{ nombre: 'Maria', telefono: '+34612345678' }]);
  });

  it('coerces numeric and boolean values to strings', () => {
    const rows = validateTestDataRows([{ cantidad: 5, activo: true }]);
    expect(rows).toEqual([{ cantidad: '5', activo: 'true' }]);
  });

  it('throws when a row contains a nested object', () => {
    const rows = [{ nombre: 'Maria', direccion: { calle: 'Mayor', numero: 1 } }];
    expect(() => validateTestDataRows(rows)).toThrow(/direccion/);
  });

  it('throws when a row contains a nested array', () => {
    const rows = [{ nombre: 'Maria', tags: ['a', 'b'] }];
    expect(() => validateTestDataRows(rows)).toThrow(/tags/);
  });

  it('throws when a row is not an object', () => {
    expect(() => validateTestDataRows(['not-an-object'])).toThrow(/registro 1/);
  });
});

describe('isModelDecommissioned', () => {
  it('returns true for 404 with model_not_found', () => {
    expect(isModelDecommissioned('model_not_found in message', 404)).toBe(true);
  });

  it('returns true for 400 with model_decommissioned', () => {
    expect(isModelDecommissioned('model_decommissioned: removed', 400)).toBe(true);
  });

  it('returns true for 400 with "invalid model"', () => {
    expect(isModelDecommissioned('This is an invalid model', 400)).toBe(true);
  });

  it('returns true for 400 with "model not found"', () => {
    expect(isModelDecommissioned('The requested model not found in catalog', 400)).toBe(true);
  });

  it('returns false for 401 (auth errors are not model errors)', () => {
    expect(isModelDecommissioned('Invalid API key', 401)).toBe(false);
  });

  it('returns false for generic 400 errors unrelated to models', () => {
    expect(isModelDecommissioned('Bad request: invalid parameter', 400)).toBe(false);
  });

  it('returns false for 404 without model keywords', () => {
    expect(isModelDecommissioned('Resource not found', 404)).toBe(false);
  });
});
