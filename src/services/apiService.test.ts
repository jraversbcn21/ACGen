import { describe, it, expect, vi, afterEach } from 'vitest';
import { validateTestCases, validateTestDataRows, isModelDecommissioned, streamWithGroq, extractJsonArray, interpolateProfile } from './apiService';
import type { I18nError } from './apiService';
import { DEFAULT_PROFILE, type ProjectProfile } from '../types/context';
import { DEFAULT_PROMPTS } from '../config/constants';
import type { ContentPart } from '../types';

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

/** Builds a non-ok Groq error response with the given HTTP status and upstream error message. */
function errorResponse(status: number, message: string): Response {
  return {
    ok: false,
    status,
    json: async () => ({ error: { message } }),
  } as unknown as Response;
}

async function captureStreamError(status: number, message: string): Promise<I18nError & { status?: number; cause?: unknown }> {
  vi.stubGlobal('fetch', vi.fn(async () => errorResponse(status, message)));
  const gen = streamWithGroq('key', 'model', 'input', 'prompt', 'criteria');
  try {
    await gen.next();
  } catch (e) {
    return e as I18nError & { status?: number; cause?: unknown };
  }
  throw new Error('expected streamWithGroq to throw');
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

describe('streamWithGroq HTTP errors', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('throws error.apiKey on 401, preserving status and the upstream message as cause', async () => {
    const caught = await captureStreamError(401, 'Invalid Authentication');
    expect(caught.message).toBe('error.apiKey');
    expect(caught.status).toBe(401);
    expect(caught.cause).toBe('Invalid Authentication');
  });

  it('throws error.rateLimit on 429, preserving status and the upstream message as cause', async () => {
    const caught = await captureStreamError(429, 'Rate limit exceeded, please try again later');
    expect(caught.message).toBe('error.rateLimit');
    expect(caught.status).toBe(429);
    expect(caught.cause).toBe('Rate limit exceeded, please try again later');
  });
});

describe('streamWithGroq base URL validation', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  async function captureWithBaseUrl(baseUrl: string | undefined): Promise<I18nError | null> {
    const fetchMock = vi.fn(async () => errorResponse(500, 'should not be reached'));
    vi.stubGlobal('fetch', fetchMock);
    const gen = streamWithGroq('key', 'model', 'input', 'prompt', 'criteria', undefined, undefined, baseUrl);
    try {
      await gen.next();
    } catch (e) {
      return e as I18nError;
    }
    return null;
  }

  it('throws error.baseUrlMissing before fetching when baseUrl is an empty string', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const gen = streamWithGroq('key', 'model', 'input', 'prompt', 'criteria', undefined, undefined, '');
    let caught: I18nError | null = null;
    try { await gen.next(); } catch (e) { caught = e as I18nError; }
    expect(caught?.message).toBe('error.baseUrlMissing');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('throws error.baseUrlMissing on a whitespace-only baseUrl', async () => {
    const caught = await captureWithBaseUrl('   ');
    expect(caught?.message).toBe('error.baseUrlMissing');
  });

  it('throws error.baseUrlInvalid before fetching when baseUrl is not a parseable URL', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const gen = streamWithGroq('key', 'model', 'input', 'prompt', 'criteria', undefined, undefined, 'not a url');
    let caught: I18nError | null = null;
    try { await gen.next(); } catch (e) { caught = e as I18nError; }
    expect(caught?.message).toBe('error.baseUrlInvalid');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('an undefined baseUrl keeps falling back to the default endpoint (no validation)', async () => {
    const caught = await captureWithBaseUrl(undefined);
    // reaches fetch and fails with the mocked 500 → generic passthrough, not a baseUrl key
    expect(caught?.message).not.toBe('error.baseUrlMissing');
    expect(caught?.message).not.toBe('error.baseUrlInvalid');
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
    let caught: I18nError | null = null;
    try { validateTestCases(items); } catch (e) { caught = e as I18nError; }
    expect(caught?.message).toBe('error.testCaseWrongTypes');
    expect(String(caught?.params?.fields)).toContain('testSteps');
  });

  it('throws when testSteps contains non-string elements', () => {
    const items = [validCase({ testSteps: ['Abrir la app', 42] })];
    let caught: I18nError | null = null;
    try { validateTestCases(items); } catch (e) { caught = e as I18nError; }
    expect(caught?.message).toBe('error.testCaseWrongTypes');
    expect(String(caught?.params?.fields)).toContain('testSteps');
  });

  it('throws when a string field is a number', () => {
    const items = [validCase({ priority: 1 })];
    let caught: I18nError | null = null;
    try { validateTestCases(items); } catch (e) { caught = e as I18nError; }
    expect(caught?.message).toBe('error.testCaseWrongTypes');
    expect(String(caught?.params?.fields)).toContain('priority');
  });

  it('throws a clear error when an item is null', () => {
    const items = [validCase(), null];
    let caught: I18nError | null = null;
    try { validateTestCases(items); } catch (e) { caught = e as I18nError; }
    expect(caught?.message).toBe('error.testCaseInvalid');
    expect(caught?.params?.n).toBe(2);
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
    let caught: I18nError | null = null;
    try { validateTestDataRows(rows); } catch (e) { caught = e as I18nError; }
    expect(caught?.message).toBe('error.recordNestedValue');
    expect(caught?.params?.field).toBe('direccion');
  });

  it('throws when a row contains a nested array', () => {
    const rows = [{ nombre: 'Maria', tags: ['a', 'b'] }];
    let caught: I18nError | null = null;
    try { validateTestDataRows(rows); } catch (e) { caught = e as I18nError; }
    expect(caught?.message).toBe('error.recordNestedValue');
    expect(caught?.params?.field).toBe('tags');
  });

  it('throws when a row is not an object', () => {
    let caught: I18nError | null = null;
    try { validateTestDataRows(['not-an-object']); } catch (e) { caught = e as I18nError; }
    expect(caught?.message).toBe('error.recordInvalid');
    expect(caught?.params?.n).toBe(1);
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

describe('i18n error keys', () => {
  it('validateTestCases throws the missing-fields key with params', () => {
    const items = [{ key: 'TC-1', summary: 's', priority: 'p', type: 't', preconditions: 'pre', testSteps: ['a'], expectedResult: '' }];
    let caught: I18nError | null = null;
    try { validateTestCases(items); } catch (e) { caught = e as I18nError; }
    expect(caught?.message).toBe('error.testCaseMissingFields');
    expect(caught?.params).toEqual({ n: 1, key: 'TC-1', fields: 'expectedResult' });
  });

  it('validateTestCases throws the wrong-type key with params', () => {
    const items = [{ key: 'TC-1', summary: 's', priority: 42, type: 't', preconditions: 'pre', testSteps: ['a'], expectedResult: 'r' }];
    let caught: I18nError | null = null;
    try { validateTestCases(items); } catch (e) { caught = e as I18nError; }
    expect(caught?.message).toBe('error.testCaseWrongTypes');
    expect(caught?.params).toEqual({ n: 1, key: 'TC-1', fields: 'priority' });
  });

  it('validateTestCases throws the invalid-object key with the index', () => {
    let caught: I18nError | null = null;
    try { validateTestCases([{ key: 'TC-1', summary: 's', priority: 'p', type: 't', preconditions: 'pre', testSteps: ['a'], expectedResult: 'r' }, 'nope']); } catch (e) { caught = e as I18nError; }
    expect(caught?.message).toBe('error.testCaseInvalid');
    expect(caught?.params).toEqual({ n: 2 });
  });

  it('validateTestDataRows throws the nested-value key with params', () => {
    let caught: I18nError | null = null;
    try { validateTestDataRows([{ nombre: 'x', direccion: { calle: 'y' } }]); } catch (e) { caught = e as I18nError; }
    expect(caught?.message).toBe('error.recordNestedValue');
    expect(caught?.params).toEqual({ n: 1, field: 'direccion' });
  });

  it('validateTestDataRows throws the invalid-record key with the index', () => {
    let caught: I18nError | null = null;
    try { validateTestDataRows(['not-an-object']); } catch (e) { caught = e as I18nError; }
    expect(caught?.message).toBe('error.recordInvalid');
    expect(caught?.params).toEqual({ n: 1 });
  });

  it('extractJsonArray throws error.invalidJson on garbage', () => {
    expect(() => extractJsonArray('not json at all')).toThrow('error.invalidJson');
  });

  it('every thrown key exists in both dictionaries', async () => {
    const es = (await import('../i18n/es.json')).default as Record<string, string>;
    const en = (await import('../i18n/en.json')).default as Record<string, string>;
    for (const key of ['error.invalidJson', 'error.noTestCaseArray', 'error.invalidFormat', 'error.testCaseInvalid', 'error.testCaseMissingFields', 'error.testCaseWrongTypes', 'error.apiKey', 'error.rateLimit', 'error.modelDecommissioned', 'error.recordInvalid', 'error.recordNestedValue']) {
      expect(es[key], `missing in es: ${key}`).toBeTruthy();
      expect(en[key], `missing in en: ${key}`).toBeTruthy();
    }
  });
});

describe('interpolateProfile v2', () => {
  it('sustituye los cinco placeholders nuevos', () => {
    const prompt = 'A {entornos} B {mercadoPrincipal} C {mapaSitio} D {idiomaSalida} E {convencionesDatos}';
    const out = interpolateProfile(prompt, {
      ...DEFAULT_PROFILE,
      environments: 'UAT', mainMarket: 'FR', siteMap: 'Login, Dashboard',
      outputLanguage: 'inglés', testDataConventions: 'usar tarjetas Stripe',
    });
    expect(out).toBe('A UAT B FR C Login, Dashboard D inglés E usar tarjetas Stripe');
  });

  it('un campo vacío se respeta (queda vacío en el prompt)', () => {
    const out = interpolateProfile('X {entornos} Y', { ...DEFAULT_PROFILE, environments: '' });
    expect(out).toBe('X  Y');
  });

  it('un campo con valor no-string cae al valor de DEFAULT_PROFILE', () => {
    const broken = { ...DEFAULT_PROFILE, environments: 123 } as unknown as ProjectProfile;
    expect(interpolateProfile('X {entornos} Y', broken)).toBe('X Pro Y');
  });

  it('un perfil antiguo sin los campos nuevos cae a los defaults', () => {
    const legacy = {
      domain: 'Salud', productType: 'App', markets: 'ES',
      terminology: 'citas', tone: 'Cercano',
    } as unknown as ProjectProfile;
    const out = interpolateProfile('{mercadoPrincipal}/{entornos} en {idiomaSalida}', legacy);
    expect(out).toBe('ES/Pro en español');
  });

  it('ningún placeholder queda sin sustituir con el perfil por defecto', () => {
    for (const prompt of Object.values(DEFAULT_PROMPTS)) {
      const out = interpolateProfile(prompt, DEFAULT_PROFILE);
      expect(out).not.toMatch(/\{(dominio|tipoProducto|mercados|terminologia|tono|entornos|mercadoPrincipal|mapaSitio|idiomaSalida|convencionesDatos)\}/);
    }
  });
});

describe('streamWithGroq multimodal input', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  async function captureBody(userInput: string | ContentPart[]): Promise<Record<string, unknown>> {
    let captured: Record<string, unknown> = {};
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => {
      captured = JSON.parse(init.body as string);
      return sseResponse([]);
    }));
    const gen = streamWithGroq('key', 'model', userInput, 'prompt', 'criteria');
    for await (const chunk of gen) { void chunk; }
    return captured;
  }

  it('con string, el mensaje de usuario es el string tal cual (byte-idéntico)', async () => {
    const body = await captureBody('hola mundo');
    const messages = body.messages as { role: string; content: unknown }[];
    expect(messages[1]).toEqual({ role: 'user', content: 'hola mundo' });
  });

  it('con ContentPart[], el content es el array de partes', async () => {
    const parts: ContentPart[] = [
      { type: 'text', text: 'valida estos criterios' },
      { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,AAAA' } },
    ];
    const body = await captureBody(parts);
    const messages = body.messages as { role: string; content: unknown }[];
    expect(messages[1]).toEqual({ role: 'user', content: parts });
  });
});
