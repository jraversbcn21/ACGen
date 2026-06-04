import { API_URL, TEMPERATURE, REQUIRED_MARKERS, BUG_REPORT_PROMPT, TEST_DATA_PROMPT } from '../config/constants';
import type { GroqResponse, GroqApiError, TestCaseData, TestCaseResponse, BugReportFormData, TestDataFormData } from '../types';

type ToolType = 'criteria' | 'testcase';

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

function validateResponseFormat(content: string, requiredMarkers: string[]): string[] {
  const missing: string[] = [];
  for (const marker of requiredMarkers) {
    if (!content.includes(marker)) {
      missing.push(marker);
    }
  }
  return missing;
}

function extractJsonArray(text: string): unknown[] {
  let cleaned = text.trim();
  const fenceMatch = cleaned.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```\s*$/);
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

function validateTestCases(items: unknown[]): TestCaseData[] {
  const requiredFields = ['key', 'summary', 'priority', 'type', 'preconditions', 'testSteps', 'expectedResult'];
  const validated: TestCaseData[] = [];
  for (let i = 0; i < items.length; i++) {
    const tc = items[i] as Record<string, unknown>;
    const missing = requiredFields.filter(f => {
      const v = tc[f];
      return v === undefined || v === null || (Array.isArray(v) && v.length === 0) || (typeof v === 'string' && v.trim() === '');
    });
    if (missing.length > 0) {
      throw new Error(`El caso de prueba ${i + 1} (${tc.key || `#${i + 1}`}) no tiene los campos requeridos: ${missing.join(', ')}`);
    }
    validated.push(tc as unknown as TestCaseData);
  }
  return validated;
}

export async function generateWithGroq(
  apiKey: string,
  model: string,
  userInput: string,
  systemPrompt: string,
  requiredMarkers: string[],
  signal?: AbortSignal,
  reasoningParams?: Record<string, unknown>,
): Promise<GroqResponse> {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userInput },
      ],
      temperature: TEMPERATURE,
      ...(reasoningParams ?? {}),
    }),
    signal,
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    const apiError: GroqApiError = {
      message: errorBody?.error?.message ?? `Error HTTP ${response.status}`,
      status: response.status,
      code: errorBody?.error?.type,
    };

    if (response.status === 401) {
      throw Object.assign(new Error('API Key inválida. Verifica tu clave e intenta de nuevo.'), apiError);
    }
    if (response.status === 429) {
      throw Object.assign(new Error('Límite de peticiones alcanzado. Espera unos segundos y vuelve a intentar.'), apiError);
    }
    if (response.status === 400) {
      const msg = (apiError.message ?? '').toLowerCase();
      const isModelError =
        msg.includes('model_decommissioned') ||
        msg.includes('model_not_found') ||
        msg.includes('invalid model') ||
        msg.includes('model not found');
      if (isModelError) {
        throw Object.assign(
          new Error('El modelo seleccionado ya no está disponible. Por favor selecciona otro modelo.'),
          apiError,
        );
      }
    }

    throw Object.assign(new Error(apiError.message), apiError);
  }

  const data = await response.json();
  const choice = data?.choices?.[0];
  const content = choice?.message?.content?.trim();
  const reasoning = choice?.message?.reasoning?.trim() || undefined;

  if (!content) {
    throw new Error('La API no devolvió contenido. Intenta de nuevo.');
  }

  const missing = validateResponseFormat(content, requiredMarkers);
  if (missing.length > 0) {
    throw new Error(
      `La respuesta no tiene el formato esperado. Faltan los siguientes elementos:\n${missing.join('\n')}\n\nIntenta de nuevo.`,
    );
  }

  return {
    content,
    model: data?.model ?? model,
    reasoning,
  };
}

export async function generateCriteria(
  apiKey: string,
  model: string,
  userInput: string,
  systemPrompt: string,
  signal?: AbortSignal,
): Promise<GroqResponse> {
  const reasoningParams = getReasoningParams(model, 'criteria');
  return generateWithGroq(apiKey, model, userInput, systemPrompt, REQUIRED_MARKERS, signal, reasoningParams);
}

export async function generateTestCases(
  apiKey: string,
  model: string,
  userInput: string,
  systemPrompt: string,
  signal?: AbortSignal,
): Promise<TestCaseResponse> {
  const reasoningParams = getReasoningParams(model, 'testcase');
  const result = await generateWithGroq(apiKey, model, userInput, systemPrompt, [], signal, reasoningParams);
  const items = extractJsonArray(result.content);
  const testCases = validateTestCases(items);
  return { testCases, model: result.model };
}

export async function generateBugReport(
  apiKey: string,
  model: string,
  formData: BugReportFormData,
  jiraContext?: string,
): Promise<GroqResponse> {
  const now = new Date();
  const today = `${String(now.getDate()).padStart(2, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`;
  let userMessage = `Descripción del bug: ${formData.description}\n\n`;
  userMessage += `Plataforma: ${formData.platform}\n`;
  userMessage += `Mercado: ${formData.market}\n`;
  userMessage += `Fecha actual: ${today}\n`;

  if (formData.platform === 'web-desktop' || formData.platform === 'web-mobile') {
    if (formData.browser) userMessage += `Navegador: ${formData.browser}\n`;
    if (formData.url) userMessage += `URL: ${formData.url}\n`;
  } else {
    if (formData.appVersion) userMessage += `Versión de la app: ${formData.appVersion}\n`;
    if (formData.device) userMessage += `Dispositivo: ${formData.device}\n`;
    if (formData.osVersion) userMessage += `Versión del OS: ${formData.osVersion}\n`;
  }

  if (jiraContext) {
    userMessage += `\nContexto del ticket relacionado:\n${jiraContext}\n`;
  }

  const reasoningParams = getReasoningParams(model, 'criteria');
  return generateWithGroq(apiKey, model, userMessage, BUG_REPORT_PROMPT, [], undefined, reasoningParams);
}

export async function generateTestData(
  apiKey: string,
  model: string,
  formData: TestDataFormData,
  jiraContext?: string,
): Promise<{ data: Record<string, string>[]; model: string }> {
  const dataTypeLabels: Record<string, string> = {
    'shipping-address': 'direcciones de envío',
    'billing-data': 'datos de facturación',
    'user-registration': 'datos de registro de usuario',
    'payment-cards': 'tarjetas de pago de prueba',
    'promo-codes': 'cupones y códigos promocionales',
  };

  let userMessage = `Genera ${formData.quantity} registro(s) de ${dataTypeLabels[formData.dataType]} para el mercado ${formData.market}.\n`;
  userMessage += `Tipo de dato: ${formData.dataType}\n`;

  if (jiraContext) {
    userMessage += `\nContexto del ticket relacionado (usa esta información para hacer los datos más relevantes al escenario de prueba):\n${jiraContext}\n`;
  }

  const reasoningParams = getReasoningParams(model, 'testcase');
  const response = await generateWithGroq(apiKey, model, userMessage, TEST_DATA_PROMPT, [], undefined, reasoningParams);

  const jsonArray = extractJsonArray(response.content);

  if (!jsonArray || jsonArray.length === 0) {
    throw new Error('No se pudieron generar los datos de prueba. Intenta de nuevo.');
  }

  return { data: jsonArray as Record<string, string>[], model: response.model };
}
