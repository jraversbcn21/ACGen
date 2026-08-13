# Fase 2 — Cimientos de visión (multimodal) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preparar la capa de IA para input de imagen: mapa de capacidad de visión por proveedor/modelo y ensanche de `streamWithGroq` a `string | ContentPart[]`, sin ningún cambio visible para el usuario (el string-path queda byte-idéntico).

**Architecture:** Se añade un tipo `ContentPart` (formato OpenAI-compatible de content parts) en `src/types/index.ts`, un mapa `VISION_MODELS` + helper `supportsVision()` en `src/config/providers.ts`, y se ensancha el parámetro `userInput` de `streamWithGroq` en `src/services/apiService.ts`. Dato verificado (2026-08-13): **Groq no tiene hoy ningún modelo de visión en producción** (Llama 4 Scout/Maverick retirados en 2026) — su lista queda vacía; la visión llega vía OpenRouter (gpt-4o, claude-sonnet-4, gemini-2.5-flash, llama-4-maverick) o endpoint custom (capacidad no verificable → 'unknown').

**Tech Stack:** TypeScript, Vitest (mocks de fetch con `vi.stubGlobal`, patrón existente en apiService.test.ts).

## Global Constraints

- Directorio: `C:\repositorio\ACGen\acgen`. Rama: `feature/fase2-cimientos-vision` (creada desde `feature/fase1-perfil-v2` — apilada; NUNCA commitear en main ni en la rama de la Fase 1).
- **Invariante: con `userInput: string` el body del request es byte-idéntico al actual** — `messages[1].content` sigue siendo el string tal cual.
- Cero cambios de UI en esta fase. Cero claves i18n nuevas.
- Suite completa (~482 tests) verde en cada commit; commits en español estilo repo.

---

### Task 1: Tipo ContentPart + mapa de capacidad de visión

**Files:**
- Modify: `src/types/index.ts` (añadir tipos al final)
- Modify: `src/config/providers.ts`
- Create: `src/config/providers.vision.test.ts`

**Interfaces:**
- Consumes: `getProvider()` existente (`providers.ts:48-50`).
- Produces: `ContentPart` (union de `{type:'text',text}` y `{type:'image_url',image_url:{url}}`) exportado desde `src/types/index.ts`; `VISION_MODELS: Record<string, string[]>` y `supportsVision(providerId, model): 'yes' | 'no' | 'unknown'` exportados desde `providers.ts`. La Task 2 y la Fase 3 dependen de estos nombres exactos.

- [ ] **Step 1: Escribir los tests que fallan** — `src/config/providers.vision.test.ts`:

```ts
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
```

- [ ] **Step 2: Ejecutar y verificar que fallan**

Run: `npm test -- --run src/config/providers.vision.test.ts`
Expected: FAIL — `supportsVision`/`VISION_MODELS` no existen.

- [ ] **Step 3: Implementar.** En `src/types/index.ts`, añadir al final:

```ts
/** Parte de un mensaje multimodal en formato OpenAI-compatible. */
export type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };
```

En `src/config/providers.ts`, añadir tras `sanitizeModel`:

```ts
/**
 * Modelos con soporte de entrada de imagen, por proveedor. Groq retiró sus
 * modelos de visión (Llama 4 Scout/Maverick) en 2026 — lista vacía a propósito.
 */
export const VISION_MODELS: Record<string, string[]> = {
  groq: [],
  openrouter: [
    'openai/gpt-4o',
    'anthropic/claude-sonnet-4',
    'google/gemini-2.5-flash',
    'meta-llama/llama-4-maverick',
  ],
};

/**
 * 'unknown' = proveedor con lista de modelos abierta (custom): no podemos
 * verificar la capacidad; el llamador decide si avisa en vez de bloquear.
 */
export function supportsVision(providerId: string, model: string): 'yes' | 'no' | 'unknown' {
  const def = getProvider(providerId);
  if (def.models.length === 0) return 'unknown';
  return (VISION_MODELS[def.id] ?? []).includes(model) ? 'yes' : 'no';
}
```

- [ ] **Step 4: Verificar que pasan**

Run: `npm test -- --run src/config/providers.vision.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Suite completa y commit**

Run: `npm test`

```bash
git add src/types/index.ts src/config/providers.ts src/config/providers.vision.test.ts
git commit -m "feat(vision): tipo ContentPart y mapa de capacidad de visión por proveedor"
```

---

### Task 2: streamWithGroq acepta string | ContentPart[]

**Files:**
- Modify: `src/services/apiService.ts:131-161` (firma + body; nada más de la función)
- Modify: `src/services/apiService.test.ts` (añadir describe block al final)

**Interfaces:**
- Consumes: `ContentPart` de la Task 1 (`import type { ..., ContentPart } from '../types'` — el import de types ya existe en la línea 3).
- Produces: `streamWithGroq(apiKey, model, userInput: string | ContentPart[], ...)` — mismo orden de parámetros, resto de la firma intacto. Los 8 tools existentes pasan strings y no se tocan.

- [ ] **Step 1: Escribir los tests que fallan** — añadir al final de `src/services/apiService.test.ts`:

```ts
describe('streamWithGroq multimodal input', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  async function captureBody(userInput: string | ContentPart[]): Promise<Record<string, unknown>> {
    let captured: Record<string, unknown> = {};
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => {
      captured = JSON.parse(init.body as string);
      return sseResponse(['data: [DONE]\n']);
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
```

(Import: añadir `ContentPart` al import de tipos existente del test, o `import type { ContentPart } from '../types';`. La helper `sseResponse` ya existe en el fichero — reutilizarla; si su firma difiere, adaptar la llamada, no la helper.)

- [ ] **Step 2: Ejecutar y verificar que falla**

Run: `npm test -- --run src/services/apiService.test.ts`
Expected: FAIL — error de tipos al pasar `ContentPart[]` (vitest typecheck) o fallo de compilación.

- [ ] **Step 3: Implementar.** En `src/services/apiService.ts`:
  - Añadir `ContentPart` al import de `../types` (línea 3).
  - Firma: `userInput: string,` → `userInput: string | ContentPart[],`
  - El body NO cambia: `{ role: 'user', content: userInput }` ya serializa ambos casos correctamente. Verificar que no hay ningún uso de `userInput` como string dentro de la función (no lo hay — solo se pasa al body).

- [ ] **Step 4: Verificar que pasan**

Run: `npm test -- --run src/services/apiService.test.ts`
Expected: PASS.

- [ ] **Step 5: Suite completa, build y commit**

Run: `npm test` && `npm run build`

```bash
git add src/services/apiService.ts src/services/apiService.test.ts
git commit -m "feat(vision): streamWithGroq acepta content parts multimodales manteniendo el string-path intacto"
```

---

## Verificación final de la fase

1. `npm test` (~489 tests) y `npm run build` limpios.
2. Invariante verificado por test: con string el mensaje user es idéntico al de antes.
3. Sin cambios de UI: `git diff feature/fase1-perfil-v2..HEAD -- src/components src/i18n` debe estar vacío.
