import { API_URL, TEMPERATURE, DEFAULT_PROMPTS } from '../config/constants';
import { baseUrlStatus } from '../config/providers';
import type { ContentPart, DesignReport, EdgeCase, GroqApiError, TestCaseData } from '../types';
import { DEFAULT_PROFILE, type ProjectProfile } from '../types/context';
import { deanonymize, splitPendingPlaceholder } from './anonymizer';

type ToolType = 'criteria' | 'testcase';

/** Errors whose message is an i18n key; params feed t()'s interpolation. */
export type I18nError = Error & { params?: Record<string, string | number> };

function i18nError(key: string, params?: Record<string, string | number>): I18nError {
  return params ? Object.assign(new Error(key), { params }) : new Error(key);
}

const PROFILE_PLACEHOLDERS = new Map<string, keyof ProjectProfile>([
  ['dominio', 'domain'],
  ['tipoProducto', 'productType'],
  ['mercados', 'markets'],
  ['terminologia', 'terminology'],
  ['tono', 'tone'],
  ['entornos', 'environments'],
  ['mercadoPrincipal', 'mainMarket'],
  ['mapaSitio', 'siteMap'],
  ['idiomaSalida', 'outputLanguage'],
  ['convencionesDatos', 'testDataConventions'],
]);

export function interpolateProfile(prompt: string, profile: ProjectProfile): string {
  const p = (key: keyof ProjectProfile): string => {
    const value = profile[key];
    return typeof value === 'string' ? value : DEFAULT_PROFILE[key];
  };
  // Replacer en funcion: un `$&` o `$$` escrito en el perfil se copia literal
  // en vez de interpretarse como patron de String.replace.
  return prompt.replace(/\{(\w+)\}/g, (match, name: string) => {
    const key = PROFILE_PLACEHOLDERS.get(name);
    return key ? p(key) : match;
  });
}

function getReasoningParams(model: string, tool: ToolType): Record<string, unknown> {
  const isQwen3 = model === 'qwen/qwen3-32b';
  const isGptOss = model.startsWith('openai/gpt-oss-');

  if (tool === 'testcase') {
    if (isQwen3) return { reasoning_format: 'hidden' };
    return {};
  }

  if (isQwen3) return { reasoning_format: 'parsed' };
  if (isGptOss) return {};
  return {};
}

export function extractJsonArray(text: string): unknown[] {
  let cleaned = text.trim();
  const fenceMatch = cleaned.match(/```(?:json)?\s*\n([\s\S]*?)\n\s*```/i);
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim();
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const firstBracket = cleaned.indexOf('[');
    const lastBracket = cleaned.lastIndexOf(']');
    if (firstBracket !== -1 && lastBracket > firstBracket) {
      try {
        parsed = JSON.parse(cleaned.slice(firstBracket, lastBracket + 1));
      } catch {
        throw i18nError('error.invalidJson');
      }
    } else {
      throw i18nError('error.invalidJson');
    }
  }

  let items: unknown[];
  if (Array.isArray(parsed)) {
    items = parsed;
  } else if (parsed && typeof parsed === 'object') {
    const obj = parsed as Record<string, unknown>;
    items = (obj.testCases || obj.cases || obj.data || []) as unknown[];
    if (!Array.isArray(items)) {
      throw i18nError('error.noTestCaseArray');
    }
  } else {
    throw i18nError('error.invalidFormat');
  }

  return items;
}

export function extractJsonObject(text: string): Record<string, unknown> {
  let cleaned = text.trim();
  const fenceMatch = cleaned.match(/```(?:json)?\s*\n([\s\S]*?)\n\s*```/i);
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim();
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      try {
        parsed = JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
      } catch {
        throw i18nError('error.invalidJson');
      }
    } else {
      throw i18nError('error.invalidJson');
    }
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw i18nError('error.invalidFormat');
  }
  return parsed as Record<string, unknown>;
}

const STRING_FIELDS = ['key', 'summary', 'priority', 'type', 'preconditions', 'expectedResult'] as const;

export function validateTestCases(items: unknown[]): TestCaseData[] {
  const requiredFields = ['key', 'summary', 'priority', 'type', 'preconditions', 'testSteps', 'expectedResult'];
  const validated: TestCaseData[] = [];
  for (let i = 0; i < items.length; i++) {
    const raw = items[i];
    if (!raw || typeof raw !== 'object') {
      throw i18nError('error.testCaseInvalid', { n: i + 1 });
    }
    const tc = raw as Record<string, unknown>;
    const missing = requiredFields.filter(f => {
      const v = tc[f];
      return v === undefined || v === null || (Array.isArray(v) && v.length === 0) || (typeof v === 'string' && v.trim() === '');
    });
    if (missing.length > 0) {
      throw i18nError('error.testCaseMissingFields', { n: i + 1, key: String(tc.key || `#${i + 1}`), fields: missing.join(', ') });
    }

    const wrongType: string[] = STRING_FIELDS.filter(f => typeof tc[f] !== 'string');
    if (!Array.isArray(tc.testSteps) || tc.testSteps.some(s => typeof s !== 'string')) {
      wrongType.push('testSteps');
    }
    if (wrongType.length > 0) {
      throw i18nError('error.testCaseWrongTypes', { n: i + 1, key: String(tc.key || `#${i + 1}`), fields: wrongType.join(', ') });
    }

    validated.push(tc as unknown as TestCaseData);
  }
  return validated;
}

const DESIGN_REPORT_FIELDS = {
  carencias: ['flujo', 'descripcion'],
  contradicciones: ['criterio', 'evidenciaDiseno', 'descripcion'],
  sugerencias: ['titulo', 'dado', 'cuando', 'entonces'],
} as const;

export function validateDesignReport(obj: Record<string, unknown>): DesignReport {
  const report = {} as Record<string, unknown[]>;
  for (const [section, fields] of Object.entries(DESIGN_REPORT_FIELDS)) {
    const raw = obj[section] ?? [];
    if (!Array.isArray(raw)) {
      throw i18nError('error.invalidDesignReport', { field: section });
    }
    report[section] = raw.map((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        throw i18nError('error.invalidDesignReport', { field: section });
      }
      const record = item as Record<string, unknown>;
      const clean: Record<string, string> = {};
      for (const field of fields) {
        const value = record[field];
        if (typeof value !== 'string') {
          throw i18nError('error.invalidDesignReport', { field: `${section}.${field}` });
        }
        clean[field] = value;
      }
      return clean;
    });
  }
  return report as unknown as DesignReport;
}

export function isModelDecommissioned(errorMessage: string | undefined, status: number): boolean {
  if (status !== 400 && status !== 404) return false;
  const msg = (errorMessage ?? '').toLowerCase();
  return (
    msg.includes('model_decommissioned') ||
    msg.includes('model_not_found') ||
    msg.includes('invalid model') ||
    msg.includes('model not found')
  );
}

/** Mapea un payload de error del proveedor (ruta HTTP non-ok o evento {error}
 *  dentro del SSE) al mismo error i18n que ven los catch de las herramientas. */
function mappedApiError(
  errorBody: { error?: { message?: string; type?: string } } | null,
  status: number,
): Error {
  const apiError: GroqApiError = {
    message: errorBody?.error?.message ?? `Error HTTP ${status}`,
    status,
    code: errorBody?.error?.type,
  };

  const { message: upstreamMessage, ...meta } = apiError;

  if (status === 401) {
    return Object.assign(i18nError('error.apiKey'), { ...meta, cause: upstreamMessage });
  }
  if (status === 429) {
    return Object.assign(i18nError('error.rateLimit'), { ...meta, cause: upstreamMessage });
  }
  if (isModelDecommissioned(apiError.message, status)) {
    return Object.assign(i18nError('error.modelDecommissioned'), { ...meta, cause: upstreamMessage });
  }
  return Object.assign(new Error(apiError.message), apiError);
}

export async function* streamWithGroq(
  apiKey: string,
  model: string,
  userInput: string | ContentPart[],
  systemPrompt: string,
  tool: ToolType,
  profile?: ProjectProfile,
  anonymizeMap?: Record<string, string>,
  baseUrl?: string,
): AsyncGenerator<{ token: string; done: boolean; model?: string }> {
  // undefined = "use the default endpoint"; a DEFINED baseUrl comes from provider
  // config and must be usable — an empty one would silently hit the default host
  // with the wrong key.
  if (baseUrl !== undefined) {
    const status = baseUrlStatus(baseUrl);
    if (status === 'missing') throw i18nError('error.baseUrlMissing');
    if (status === 'invalid') throw i18nError('error.baseUrlInvalid');
  }
  // Solo el proveedor custom deja el modelo en blanco; un "model": "" llega al
  // endpoint y vuelve como un 404 que se disfraza de "modelo retirado".
  if (!model.trim()) throw i18nError('error.modelMissing');

  const effectivePrompt = profile ? interpolateProfile(systemPrompt, profile) : systemPrompt;
  const reasoningParams = getReasoningParams(model, tool);
  const body = {
    model,
    messages: [
      { role: 'system', content: effectivePrompt },
      { role: 'user', content: userInput },
    ],
    temperature: TEMPERATURE,
    stream: true,
    ...reasoningParams,
  };

  const response = await fetch(baseUrl || API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    throw mappedApiError(errorBody, response.status);
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  // Text held back because it may still grow into a placeholder split across chunks.
  let pending = '';
  const anonymizeKeys = anonymizeMap ? Object.keys(anonymizeMap) : undefined;
  let lastModel: string | undefined;
  let gotToken = false;

  try {
    reading: while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const lines = buffer.split('\n');
      // Al cerrar la conexion, la ultima linea sin \n tambien cuenta.
      buffer = done ? '' : (lines.pop() || '');
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6);
        if (data === '[DONE]') break reading;
        let parsed;
        try {
          parsed = JSON.parse(data);
        } catch { continue; /* skip malformed chunks */ }
        // OpenRouter reporta fallos a mitad de generacion (creditos agotados,
        // error del upstream, moderacion) como un evento {error} sobre HTTP 200.
        // Sin esto el stream "termina bien" y el texto truncado pasa por exito.
        if (parsed.error) {
          throw mappedApiError(parsed, typeof parsed.error.code === 'number' ? parsed.error.code : 0);
        }
        const rawToken: string | undefined = parsed.choices?.[0]?.delta?.content;
        if (!rawToken) continue;
        gotToken = true;
        lastModel = parsed.model ?? lastModel;
        if (!anonymizeMap) {
          yield { token: rawToken, done: false, model: parsed.model };
          continue;
        }
        pending += rawToken;
        const [emit, rest] = splitPendingPlaceholder(pending, anonymizeKeys);
        pending = rest;
        if (emit) {
          yield { token: deanonymize(emit, anonymizeMap), done: false, model: parsed.model };
        }
      }
      if (done) break;
    }
  } finally {
    // Si el consumidor deja de leer (Limpiar, otra generacion, unmount), el
    // for-await cierra este generador y esto corta la descarga de verdad, en
    // vez de dejar el fetch bajando la respuesta entera en segundo plano.
    reader.cancel().catch(() => {});
  }
  // Un 200 sin ningun delta (endpoint que ignora stream:true, solo reasoning,
  // moderacion) no es un exito con texto vacio.
  if (!gotToken) throw i18nError('error.emptyResponse');
  if (pending && anonymizeMap) {
    yield { token: deanonymize(pending, anonymizeMap), done: false, model: lastModel };
  }
  yield { token: '', done: true };
}

export function validateTestDataRows(items: unknown[]): Record<string, string>[] {
  return items.map((row, i) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) {
      throw i18nError('error.recordInvalid', { n: i + 1 });
    }
    const entries = Object.entries(row as Record<string, unknown>).map(([field, value]) => {
      if (value !== null && typeof value === 'object') {
        throw i18nError('error.recordNestedValue', { n: i + 1, field });
      }
      return [field, value === null || value === undefined ? '' : String(value)] as const;
    });
    return Object.fromEntries(entries);
  });
}

/** Mismo criterio que los datos de prueba: tres campos de texto, nada anidado. */
export function validateEdgeCases(items: unknown[]): EdgeCase[] {
  return validateTestDataRows(items).map((row) => ({
    categoria: row.categoria ?? '',
    escenario: row.escenario ?? '',
    resultadoEsperado: row.resultadoEsperado ?? '',
  }));
}

export function getPrompt(tool: string): string {
  try {
    const key = `acgen_prompt_${tool}`;
    const override = localStorage.getItem(key);
    if (override && override.trim()) return override;
  } catch { /* localStorage unavailable */ }
  return DEFAULT_PROMPTS[tool] ?? '';
}
