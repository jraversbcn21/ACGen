import { API_URL, TEMPERATURE, DEFAULT_PROMPTS } from '../config/constants';
import type { GroqApiError, TestCaseData } from '../types';
import type { ProjectProfile } from '../types/context';
import { deanonymize, splitPendingPlaceholder } from './anonymizer';

type ToolType = 'criteria' | 'testcase';

export function interpolateProfile(prompt: string, profile: ProjectProfile): string {
  return prompt
    .replace(/\{dominio\}/g, profile.domain)
    .replace(/\{tipoProducto\}/g, profile.productType)
    .replace(/\{mercados\}/g, profile.markets)
    .replace(/\{terminologia\}/g, profile.terminology)
    .replace(/\{tono\}/g, profile.tone);
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
        throw new Error('La respuesta no es JSON válido. Intenta de nuevo.');
      }
    } else {
      throw new Error('La respuesta no es JSON válido. Intenta de nuevo.');
    }
  }

  let items: unknown[];
  if (Array.isArray(parsed)) {
    items = parsed;
  } else if (parsed && typeof parsed === 'object') {
    const obj = parsed as Record<string, unknown>;
    items = (obj.testCases || obj.cases || obj.data || []) as unknown[];
    if (!Array.isArray(items)) {
      throw new Error('La respuesta no contiene un array de casos de prueba.');
    }
  } else {
    throw new Error('La respuesta no tiene un formato reconocible.');
  }

  return items;
}

const STRING_FIELDS = ['key', 'summary', 'priority', 'type', 'preconditions', 'expectedResult'] as const;

export function validateTestCases(items: unknown[]): TestCaseData[] {
  const requiredFields = ['key', 'summary', 'priority', 'type', 'preconditions', 'testSteps', 'expectedResult'];
  const validated: TestCaseData[] = [];
  for (let i = 0; i < items.length; i++) {
    const raw = items[i];
    if (!raw || typeof raw !== 'object') {
      throw new Error(`El caso de prueba ${i + 1} no es un objeto válido.`);
    }
    const tc = raw as Record<string, unknown>;
    const missing = requiredFields.filter(f => {
      const v = tc[f];
      return v === undefined || v === null || (Array.isArray(v) && v.length === 0) || (typeof v === 'string' && v.trim() === '');
    });
    if (missing.length > 0) {
      throw new Error(`El caso de prueba ${i + 1} (${tc.key || `#${i + 1}`}) no tiene los campos requeridos: ${missing.join(', ')}`);
    }

    const wrongType: string[] = STRING_FIELDS.filter(f => typeof tc[f] !== 'string');
    if (!Array.isArray(tc.testSteps) || tc.testSteps.some(s => typeof s !== 'string')) {
      wrongType.push('testSteps');
    }
    if (wrongType.length > 0) {
      throw new Error(`El caso de prueba ${i + 1} (${tc.key || `#${i + 1}`}) tiene campos con tipo incorrecto: ${wrongType.join(', ')}`);
    }

    validated.push(tc as unknown as TestCaseData);
  }
  return validated;
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

export async function* streamWithGroq(
  apiKey: string,
  model: string,
  userInput: string,
  systemPrompt: string,
  tool: ToolType,
  profile?: ProjectProfile,
  anonymizeMap?: Record<string, string>,
  baseUrl?: string,
): AsyncGenerator<{ token: string; done: boolean; model?: string }> {
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
    const apiError: GroqApiError = {
      message: errorBody?.error?.message ?? `Error HTTP ${response.status}`,
      status: response.status,
      code: errorBody?.error?.type,
    };

    if (response.status === 401) {
      throw Object.assign(new Error('API Key invalida. Verifica tu clave e intenta de nuevo.'), apiError);
    }
    if (response.status === 429) {
      throw Object.assign(new Error('Limite de peticiones alcanzado. Espera unos segundos y vuelve a intentar.'), apiError);
    }
    if (isModelDecommissioned(apiError.message, response.status)) {
      throw Object.assign(
        new Error('El modelo seleccionado ya no esta disponible. Por favor selecciona otro modelo.'),
        apiError,
      );
    }
    throw Object.assign(new Error(apiError.message), apiError);
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  // Text held back because it may still grow into a placeholder split across chunks.
  let pending = '';
  let lastModel: string | undefined;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (data === '[DONE]') {
          if (pending && anonymizeMap) {
            yield { token: deanonymize(pending, anonymizeMap), done: false, model: lastModel };
          }
          return;
        }
        try {
          const parsed = JSON.parse(data);
          const rawToken: string | undefined = parsed.choices?.[0]?.delta?.content;
          if (rawToken) {
            lastModel = parsed.model ?? lastModel;
            if (!anonymizeMap) {
              yield { token: rawToken, done: false, model: parsed.model };
            } else {
              pending += rawToken;
              const [emit, rest] = splitPendingPlaceholder(pending);
              pending = rest;
              if (emit) {
                yield { token: deanonymize(emit, anonymizeMap), done: false, model: parsed.model };
              }
            }
          }
        } catch { /* skip malformed chunks */ }
      }
    }
  }
  if (pending && anonymizeMap) {
    yield { token: deanonymize(pending, anonymizeMap), done: false, model: lastModel };
  }
  yield { token: '', done: true };
}

export function validateTestDataRows(items: unknown[]): Record<string, string>[] {
  return items.map((row, i) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) {
      throw new Error(`El registro ${i + 1} no es un objeto válido.`);
    }
    const entries = Object.entries(row as Record<string, unknown>).map(([field, value]) => {
      if (value !== null && typeof value === 'object') {
        throw new Error(`El registro ${i + 1} tiene un valor anidado no soportado en el campo "${field}".`);
      }
      return [field, value === null || value === undefined ? '' : String(value)] as const;
    });
    return Object.fromEntries(entries);
  });
}

export function getPrompt(tool: string): string {
  try {
    const key = `acgen_prompt_${tool}`;
    const override = localStorage.getItem(key);
    if (override && override.trim()) return override;
  } catch { /* localStorage unavailable */ }
  return DEFAULT_PROMPTS[tool] ?? '';
}
