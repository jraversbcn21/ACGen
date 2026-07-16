import { describe, it, expect, vi, afterEach } from 'vitest';
import { validateTestCases, validateTestDataRows, isModelDecommissioned, streamWithGroq } from './apiService';

/** Builds an SSE body that delivers `contentChunks` as separate delta events. */
function sseResponse(contentChunks: string[]): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const content of contentChunks) {
        const payload = JSON.stringify({ model: 'test-model', choices: [{ delta: { content } }] });
        controller.enqueue(encoder.encode(`data: ${payload}\n`));
      }
      controller.enqueue(encoder.encode('data: [DONE]\n'));
      controller.close();
    },
  });
  return { ok: true, body } as unknown as Response;
}

async function collect(chunks: string[], anonymizeMap?: Record<string, string>): Promise<string> {
  vi.stubGlobal('fetch', vi.fn(async () => sseResponse(chunks)));
  const gen = streamWithGroq('key', 'model', 'input', 'prompt', 'criteria', undefined, anonymizeMap);
  let out = '';
  for await (const { token, done } of gen) {
    if (!done) out += token;
  }
  return out;
}

describe('streamWithGroq deanonymization', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('restores a placeholder delivered in a single chunk', async () => {
    const out = await collect(['Escribe a [EMAIL_1] hoy'], { '[EMAIL_1]': 'jorge@example.com' });
    expect(out).toBe('Escribe a jorge@example.com hoy');
  });

  it('restores a placeholder split across two streaming chunks', async () => {
    const out = await collect(['Escribe a [EMA', 'IL_1] hoy'], { '[EMAIL_1]': 'jorge@example.com' });
    expect(out).toBe('Escribe a jorge@example.com hoy');
  });

  it('restores a placeholder split character by character', async () => {
    const out = await collect([...'Ver [TICKET_1] ya'], { '[TICKET_1]': 'PROJ-1234' });
    expect(out).toBe('Ver PROJ-1234 ya');
  });

  it('flushes a trailing partial placeholder when the stream ends', async () => {
    const out = await collect(['texto colgando [EMA'], { '[EMAIL_1]': 'jorge@example.com' });
    expect(out).toBe('texto colgando [EMA');
  });

  it('passes text through untouched when no map is given', async () => {
    const out = await collect(['texto [EMAIL_1] normal']);
    expect(out).toBe('texto [EMAIL_1] normal');
  });
});

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
