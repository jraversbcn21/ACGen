# `useGenerator()` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extraer a un hook `useGenerator()` el bloque de generación que los 9 tools llevan copiado (stream, estado, `doGenerate`, `handleGenerate`, modal de revisión, Ctrl+Enter) sin cambiar nada visible.

**Architecture:** Un hook en `src/hooks/useGenerator.ts` que recibe la config del tool por un `useRef` (nunca por deps) y devuelve estado + handlers. Cada tool se migra en un commit propio: se borra su copia del bloque y se cablea su JSX intacto a `gen.*`. Los 785 tests existentes no se tocan y son la especificación.

**Tech Stack:** React 18, TypeScript, Vitest + Testing Library (jsdom). Spec: `docs/superpowers/specs/2026-09-02-use-generator-design.md`.

## Global Constraints

- **Refactor puro**: cero cambio de comportamiento visible. Las divergencias entre tools (Conversor sin Deshacer; toast vs banner; Validador sin confidencial) se conservan.
- **Ningún test existente se modifica.** Tras cada commit: `npm test` → 785 verdes + los del hook; `npm run typecheck` limpio; `npm run lint` → 5 warnings (solo `react-refresh`). Un `react-hooks/exhaustive-deps` nuevo es un fallo del refactor.
- **Un tool por commit.** Nunca dos.
- **El JSX de cada tool no se toca** salvo cambiar la prop a `gen.*`. `App.css` no se toca.
- **La config del hook se lee siempre desde `configRef.current`**, nunca desde deps. Regla no negociable (es lo que elimina la clase de bug H1).
- **Lo que necesite el valor de entrada "al arrancar" la generación (historial, texto del artefacto del Validador) lo captura el tool dentro de `buildInput` en un ref**, no en `onResult` — así el comportamiento es idéntico aunque el usuario edite durante el stream.
- Comandos desde `acgen/`: `npm test`, `npm run typecheck` (NO `npx tsc --noEmit`), `npm run lint`.
- Commits con el pie de atribución de la sesión (ver mensaje de commit de cada tarea).

---

### Task 1: El hook `useGenerator` y su test

**Files:**
- Create: `src/hooks/useGenerator.ts`
- Create: `src/hooks/useGenerator.test.tsx` (`.tsx` porque el `wrapper` del test lleva JSX)

**Interfaces:**
- Consumes: `useStreamingResponse()` (`{ text, isStreaming, stream, reset }`), `streamWithGroq`, `getPrompt`, `anonymize`, `applyPlaceholderEdits`, `useT`.
- Produces (para las tareas 2-10):

```ts
export interface GeneratorConfig<T> {
  view: string;
  toolType: 'criteria' | 'testcase';
  apiKey: string;
  model: string;
  profile?: ProjectProfile;
  baseUrl?: string;
  canGenerate: boolean;
  buildInput: () => string | ContentPart[];
  parse: (fullText: string) => T;
  onResult: (result: T, ctx: { input: string | ContentPart[]; fullText: string; model: string }) => void;
  onError?: (message: string) => void;
  confidential?: boolean; // default true
}
export interface Generator {
  status: GenerationStatus;
  isStreaming: boolean;
  streamText: string;
  error: string | null;
  dismissError: () => void;
  handleGenerate: () => Promise<void>;
  review: { text: string; map: Record<string, string> } | null;
  openReview: () => void; // llama a buildInput() él mismo: todo camino hacia run pasa por buildInput
  confirmReview: (edits: Record<string, string>) => void;
  cancelReview: () => void;
  clearGeneration: () => void;
}
export function useGenerator<T>(config: GeneratorConfig<T>): Generator;
```

- [ ] **Step 1: Escribir el test del hook (rojo)**

`src/hooks/useGenerator.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { I18nProvider } from '../i18n/I18nContext';
import { streamWithGroq } from '../services/apiService';
import { useGenerator, type GeneratorConfig } from './useGenerator';

vi.mock('../services/apiService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/apiService')>();
  return { ...actual, streamWithGroq: vi.fn() };
});
const streamMock = vi.mocked(streamWithGroq);

const wrapper = ({ children }: { children: ReactNode }) => <I18nProvider>{children}</I18nProvider>;

function yields(...tokens: string[]) {
  streamMock.mockImplementation(async function* () {
    for (const token of tokens) yield { token, done: false, model: 'm' };
    yield { token: '', done: true };
  });
}

function config(overrides: Partial<GeneratorConfig<string>> = {}): GeneratorConfig<string> {
  return {
    view: 'testcase',
    toolType: 'testcase',
    apiKey: 'k',
    model: 'm',
    canGenerate: true,
    buildInput: () => 'entrada',
    parse: (fullText) => fullText.toUpperCase(),
    onResult: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('acgen_lang', JSON.stringify('es'));
  streamMock.mockReset();
});

describe('useGenerator', () => {
  it('flujo feliz: loading -> parse -> onResult(result, ctx) -> success', async () => {
    yields('ho', 'la');
    const onResult = vi.fn();
    const { result } = renderHook(() => useGenerator(config({ onResult })), { wrapper });
    expect(result.current.status).toBe('idle');
    await act(async () => { await result.current.handleGenerate(); });
    expect(streamMock).toHaveBeenCalledWith('k', 'm', 'entrada', expect.any(String), 'testcase', undefined, undefined, undefined);
    expect(onResult).toHaveBeenCalledWith('HOLA', { input: 'entrada', fullText: 'hola', model: 'm' });
    expect(result.current.status).toBe('success');
    expect(result.current.error).toBeNull();
  });

  it('guard: sin canGenerate, o con una generacion en curso, no llama a la API (tampoco desde confirmReview)', async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    streamMock.mockImplementation(async function* () {
      yield { token: 'a', done: false };
      await gate;
      yield { token: '', done: true };
    });
    const { result, rerender } = renderHook((props: { can: boolean }) => useGenerator(config({ canGenerate: props.can })), { wrapper, initialProps: { can: false } });
    await act(async () => { await result.current.handleGenerate(); });
    expect(streamMock).not.toHaveBeenCalled();

    rerender({ can: true });
    let first!: Promise<void>;
    act(() => { first = result.current.handleGenerate(); });
    await act(async () => {});
    expect(streamMock).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe('loading');
    await act(async () => { await result.current.handleGenerate(); });
    act(() => { result.current.openReview(); });
    act(() => { result.current.confirmReview({}); });
    expect(streamMock).toHaveBeenCalledTimes(1);
    await act(async () => { release(); await first; });
  });

  it('error: parse que lanza -> status error y mensaje traducido con params; con onError va al callback', async () => {
    yields('x');
    const boom = Object.assign(new Error('error.testCaseInvalid'), { params: { n: 3 } });
    const { result } = renderHook(() => useGenerator(config({ parse: () => { throw boom; } })), { wrapper });
    await act(async () => { await result.current.handleGenerate(); });
    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe('El caso de prueba 3 no es un objeto válido.');
    act(() => { result.current.dismissError(); });
    expect(result.current.error).toBeNull();

    const onError = vi.fn();
    const { result: r2 } = renderHook(() => useGenerator(config({ parse: () => { throw boom; }, onError })), { wrapper });
    await act(async () => { await r2.current.handleGenerate(); });
    expect(onError).toHaveBeenCalledWith('El caso de prueba 3 no es un objeto válido.');
    expect(r2.current.error).toBeNull();
    expect(r2.current.status).toBe('error');
  });

  it('confidencial: con PII abre review sin llamar; confirmReview envia enmascarado con el mapa; cancelReview cierra', async () => {
    localStorage.setItem('acgen_confidential_testcase', 'true');
    yields('ok');
    const { result } = renderHook(() => useGenerator(config({ buildInput: () => 'avisar a jorge@example.com' })), { wrapper });
    await act(async () => { await result.current.handleGenerate(); });
    expect(streamMock).not.toHaveBeenCalled();
    expect(result.current.review).toEqual({ text: 'avisar a [EMAIL_1]', map: { '[EMAIL_1]': 'jorge@example.com' } });

    act(() => { result.current.cancelReview(); });
    expect(result.current.review).toBeNull();
    expect(streamMock).not.toHaveBeenCalled();

    await act(async () => { await result.current.handleGenerate(); });
    await act(async () => { result.current.confirmReview({ '[EMAIL_1]': '[PERSONA]' }); });
    expect(streamMock).toHaveBeenCalledTimes(1);
    expect(streamMock.mock.calls[0][2]).toBe('avisar a [PERSONA]');
    expect(streamMock.mock.calls[0][6]).toEqual({ '[PERSONA]': 'jorge@example.com' });
    expect(result.current.review).toBeNull();
  });

  it('openReview pasa por buildInput: lo que el tool capture ahi tambien se captura desde el badge', () => {
    const buildInput = vi.fn(() => 'avisar a jorge@example.com');
    const { result } = renderHook(() => useGenerator(config({ buildInput })), { wrapper });
    act(() => { result.current.openReview(); });
    expect(buildInput).toHaveBeenCalledTimes(1);
    expect(result.current.review).toEqual({ text: 'avisar a [EMAIL_1]', map: { '[EMAIL_1]': 'jorge@example.com' } });
  });

  it('confidential:false nunca abre review aunque haya PII y el flag este activo', async () => {
    localStorage.setItem('acgen_confidential_testcase', 'true');
    yields('ok');
    const { result } = renderHook(() => useGenerator(config({ confidential: false, buildInput: () => 'jorge@example.com' })), { wrapper });
    await act(async () => { await result.current.handleGenerate(); });
    expect(result.current.review).toBeNull();
    expect(streamMock).toHaveBeenCalledTimes(1);
  });

  it('clearGeneration a mitad de stream: onResult nunca se llama y status vuelve a idle', async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    streamMock.mockImplementation(async function* () {
      yield { token: 'a', done: false };
      await gate;
      yield { token: 'b', done: false };
      yield { token: '', done: true };
    });
    const onResult = vi.fn();
    const { result } = renderHook(() => useGenerator(config({ onResult })), { wrapper });
    let p!: Promise<void>;
    act(() => { p = result.current.handleGenerate(); });
    await act(async () => {});
    expect(result.current.status).toBe('loading');
    act(() => { result.current.clearGeneration(); });
    expect(result.current.status).toBe('idle');
    await act(async () => { release(); await p; });
    expect(onResult).not.toHaveBeenCalled();
    expect(result.current.status).toBe('idle');
  });

  it('Ctrl+Enter en window genera; sin canGenerate no', async () => {
    yields('ok');
    const { result, rerender } = renderHook((props: { can: boolean }) => useGenerator(config({ canGenerate: props.can })), { wrapper, initialProps: { can: false } });
    await act(async () => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true })); });
    expect(streamMock).not.toHaveBeenCalled();
    rerender({ can: true });
    await act(async () => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true })); });
    expect(streamMock).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe('success');
  });

  it('re-render con otro onResult tras montar: se llama el nuevo (la clase de bug H1)', async () => {
    yields('ok');
    const a = vi.fn();
    const b = vi.fn();
    const { result, rerender } = renderHook((props: { onResult: GeneratorConfig<string>['onResult'] }) => useGenerator(config({ onResult: props.onResult })), { wrapper, initialProps: { onResult: a } });
    rerender({ onResult: b });
    await act(async () => { await result.current.handleGenerate(); });
    expect(b).toHaveBeenCalledTimes(1);
    expect(a).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Comprobar que falla**

Run: `npx vitest run src/hooks/useGenerator.test.tsx`
Expected: FAIL — `Cannot find module './useGenerator'`.

- [ ] **Step 3: Implementar el hook**

`src/hooks/useGenerator.ts`:

```ts
import { useState, useCallback, useEffect, useRef } from 'react';
import { streamWithGroq, getPrompt } from '../services/apiService';
import type { I18nError } from '../services/apiService';
import { anonymize, applyPlaceholderEdits } from '../services/anonymizer';
import { useStreamingResponse } from './useStreamingResponse';
import { useT } from '../i18n/I18nContext';
import type { ContentPart, GenerationStatus } from '../types';
import type { ProjectProfile } from '../types/context';

export interface GeneratorConfig<T> {
  /** Clave del prompt (`getPrompt(view)`) y del flag `acgen_confidential_<view>`. */
  view: string;
  /** Parametros de reasoning de streamWithGroq. */
  toolType: 'criteria' | 'testcase';
  apiKey: string;
  model: string;
  profile?: ProjectProfile;
  baseUrl?: string;
  canGenerate: boolean;
  /** Texto (o partes multimodales) que se envia. Lo que el tool necesite "al arrancar" lo captura aqui. */
  buildInput: () => string | ContentPart[];
  /** Del texto completo al resultado tipado. Puede lanzar Error(i18nKey) con `params`. */
  parse: (fullText: string) => T;
  /** El tool guarda SU estado, su artefacto, su historial y su modelo. */
  onResult: (result: T, ctx: { input: string | ContentPart[]; fullText: string; model: string }) => void;
  /** Si esta, el error va aqui (toast) y `error` queda null; si no, al banner. */
  onError?: (message: string) => void;
  /** false solo en el Validador. */
  confidential?: boolean;
}

export interface Generator {
  status: GenerationStatus;
  isStreaming: boolean;
  streamText: string;
  error: string | null;
  dismissError: () => void;
  handleGenerate: () => Promise<void>;
  review: { text: string; map: Record<string, string> } | null;
  openReview: () => void; // llama a buildInput() él mismo: todo camino hacia run pasa por buildInput
  confirmReview: (edits: Record<string, string>) => void;
  cancelReview: () => void;
  clearGeneration: () => void;
}

/**
 * Nucleo de generacion compartido por los nueve tools. La config vive en un
 * ref que se reasigna en cada render y se lee en el momento de usarla: ningun
 * callback del tool entra en deps, asi que "se me olvido onSaveArtifact en las
 * deps" (auditoria 2026-09-02, H1) deja de ser posible por construccion.
 */
export function useGenerator<T>(config: GeneratorConfig<T>): Generator {
  const configRef = useRef(config);
  configRef.current = config;
  const t = useT();
  const { text: streamText, isStreaming, stream, reset } = useStreamingResponse();
  const [status, setStatus] = useState<GenerationStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [review, setReview] = useState<Generator['review']>(null);
  // Guard en ref, no en closure: confirmReview entra sin pasar por handleGenerate
  // y el status de su closure puede ser viejo. runId evita que el finally de una
  // generacion descartada libere el guard de la siguiente.
  const busyRef = useRef(false);
  const runIdRef = useRef(0);

  const run = useCallback(async (input: string | ContentPart[], map?: Record<string, string>) => {
    if (busyRef.current) return;
    const id = ++runIdRef.current;
    busyRef.current = true;
    const c = configRef.current;
    setStatus('loading');
    setError(null);
    try {
      const gen = streamWithGroq(c.apiKey, c.model, input, getPrompt(c.view), c.toolType, c.profile, map, c.baseUrl);
      await stream(gen, (fullText) => {
        const cfg = configRef.current;
        const result = cfg.parse(fullText);
        cfg.onResult(result, { input, fullText, model: cfg.model });
        setStatus('success');
      });
    } catch (err) {
      if (runIdRef.current !== id) return; // descartada por clearGeneration
      const message = err instanceof Error ? t(err.message, (err as I18nError).params) : t('error.unexpected');
      const onError = configRef.current.onError;
      if (onError) onError(message); else setError(message);
      setStatus('error');
    } finally {
      if (runIdRef.current === id) {
        busyRef.current = false;
        setReview(null);
      }
    }
  }, [stream, t]);

  const handleGenerate = useCallback(async () => {
    const c = configRef.current;
    if (!c.canGenerate || busyRef.current) return;
    const input = c.buildInput();
    if (c.confidential !== false && typeof input === 'string' && localStorage.getItem(`acgen_confidential_${c.view}`) === 'true') {
      const { text, map } = anonymize(input);
      if (Object.keys(map).length > 0) {
        setReview({ text, map });
        return;
      }
    }
    await run(input);
  }, [run]);

  // Sin argumento a proposito: el badge "N sustituciones — Revisar" entra por
  // aqui sin pasar por handleGenerate, y buildInput es donde el tool captura
  // lo que necesita "al arrancar" (historial, texto del artefacto). Si el
  // texto se construyera fuera, ese ref se quedaria sin escribir en este camino.
  const openReview = useCallback(() => {
    const input = configRef.current.buildInput();
    if (typeof input !== 'string') return;
    setReview(anonymize(input));
  }, []);
  const cancelReview = useCallback(() => setReview(null), []);
  const confirmReview = useCallback((edits: Record<string, string>) => {
    if (!review) return;
    const { text, map } = applyPlaceholderEdits(review.text, review.map, edits);
    setReview(null);
    void run(text, map);
  }, [review, run]);

  const clearGeneration = useCallback(() => {
    reset();
    runIdRef.current++;
    busyRef.current = false;
    setStatus('idle');
    setError(null);
    setReview(null);
  }, [reset]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        void handleGenerate();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleGenerate]);

  return {
    status, isStreaming, streamText, error,
    dismissError: () => setError(null),
    handleGenerate, review, openReview, confirmReview, cancelReview, clearGeneration,
  };
}
```

- [ ] **Step 4: Comprobar que pasa**

Run: `npx vitest run src/hooks/useGenerator.test.tsx`
Expected: 8 passed.

Si el test "guard" falla en `expect(result.current.status).toBe('loading')`, es porque `act` no vació el primer `setStatus`: añade `await act(async () => {})` justo después de lanzar `first`.

- [ ] **Step 5: Gates y commit**

Run: `npm run typecheck && npm run lint`
Expected: typecheck limpio; lint 5 warnings, 0 errores.

```bash
git checkout -b refactor/use-generator
git add src/hooks/useGenerator.ts src/hooks/useGenerator.test.tsx
git commit -m "refactor(hooks): useGenerator — nucleo de generacion compartido (aun sin consumidores)

Config por useRef, nunca por deps; guard en ref (confirmReview no pasa por
handleGenerate); runId para que el finally de una generacion descartada no
libere el guard de la siguiente. 8 tests.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01EaAf9mtreSJq24DYfD2SND"
```

---

### Task 2: Migrar Casos de Prueba (el canónico)

**Files:**
- Modify: `src/components/TestCaseTool.tsx`
- Test (sin tocar): `src/components/TestCaseTool.test.tsx`, `TestCaseTool.confidential.test.tsx`, `tools.confidential.test.tsx`, `tools.staleClosures.test.tsx`, `staleTranslation.test.tsx`

**Interfaces:** Consumes `useGenerator<TestCaseData[]>` (Task 1).

- [ ] **Step 1: Borrar el bloque copiado**

Elimina de `TestCaseTool.tsx`, buscando por nombre:
- estados `status`/`setStatus`, `error`/`setError`, `conf`/`setConf`;
- la línea `const { isStreaming, stream, reset: resetStream } = useStreamingResponse();`;
- `const doGenerate = useCallback(...)` entero;
- `const handleGenerate = useCallback(...)` entero;
- el `useEffect` con `window.addEventListener('keydown', handler)` entero;
- imports que quedan sin uso: `useEffect` (si ya no lo usa nadie más en el fichero — `prefill` lo usa, así que se queda), `streamWithGroq`, `getPrompt`, `I18nError`, `useStreamingResponse`, `anonymize`, `applyPlaceholderEdits`, `GenerationStatus`.

- [ ] **Step 2: Añadir el hook**

Debajo de `const t = useT();`:

```ts
  const gen = useGenerator<TestCaseData[]>({
    view: 'testcase',
    toolType: 'testcase',
    apiKey, model, profile, baseUrl,
    canGenerate,
    buildInput: () => input,
    parse: (fullText) => {
      const items = extractJsonArray(fullText);
      if (items.length === 0) throw new Error('error.noTestCases');
      return validateTestCases(items);
    },
    onResult: (validated, { input: sent, fullText, model: usedModel }) => {
      setTestCases(validated);
      onSaveArtifact?.(sent as string, fullText);
      setGeneratedModel(usedModel);
    },
  });
```

Import: `import { useGenerator } from '../hooks/useGenerator';`. `canGenerate` se define ANTES del hook (ya lo está: `const canGenerate = apiKey.trim().length > 0 && input.trim().length > 0;`).

- [ ] **Step 3: Cablear `handleClear`**

Sustituye `resetStream();` por `gen.clearGeneration();` y quita `setError(null); setStatus('idle');` (los hace `clearGeneration`). Deps: quita `resetStream`. Queda:

```ts
  const handleClear = useCallback(() => {
    gen.clearGeneration();
    const prevInput = input;
    const prevTestCases = testCases;
    const prevModel = generatedModel;
    setInput('');
    setTestCases([]);
    setGeneratedModel(undefined);
    setCopied(false);
    showToast(t('common.cleared'), () => {
      setInput(prevInput);
      setTestCases(prevTestCases);
      setGeneratedModel(prevModel);
    });
  }, [input, testCases, generatedModel, gen, showToast, t]);
```

`handleLoadDemo` hacía `setError(null); setStatus('success');` — sustituye por `gen.clearGeneration();` al principio (deja `idle`; el demo no necesita `success`: ningún test ni JSX lo lee — comprueba con `grep -n "status" src/components/TestCaseTool.tsx` que solo lo use el `GenerateButton`).

- [ ] **Step 4: Cablear el JSX (solo props)**

```tsx
<ConfidentialToggle view="testcase" text={input} onReview={gen.openReview} />
<GenerateButton onClick={gen.handleGenerate} disabled={!canGenerate || gen.isStreaming} loading={gen.status === 'loading'} />
<ErrorBanner message={gen.error} onDismiss={gen.dismissError} />
{gen.review && (
  <AnonymizerReview map={gen.review.map} onCancel={gen.cancelReview} onConfirm={gen.confirmReview} />
)}
```

- [ ] **Step 5: Gates**

Run: `npm test`
Expected: 793 passed (785 + 8), 1 skipped, ningún fichero de test modificado (`git status` no muestra `*.test.*`).
Run: `npm run typecheck && npm run lint`
Expected: limpio / 5 warnings.

- [ ] **Step 6: Commit**

```bash
git add src/components/TestCaseTool.tsx
git commit -m "refactor(testcase): migrar a useGenerator

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01EaAf9mtreSJq24DYfD2SND"
```

---

### Task 3: Migrar Casos Límite

**Files:**
- Modify: `src/components/EdgeCaseTool.tsx`

- [ ] **Step 1: Borrar** estados `loading`/`setLoading`, `error`/`setError`, `conf`/`setConf`; la línea de `useStreamingResponse()`; `doGenerate`; `handleGenerate`; el `useEffect` del `keydown`; imports sin uso (`streamWithGroq`, `getPrompt`, `I18nError`, `useStreamingResponse`, `anonymize`, `applyPlaceholderEdits`).

- [ ] **Step 2: Añadir el hook** (debajo de `const canGenerate = ...`):

```ts
  const gen = useGenerator<EdgeCase[]>({
    view: 'edgecase',
    toolType: 'testcase',
    apiKey, model, profile, baseUrl,
    canGenerate,
    buildInput: () => requirement,
    parse: (fullText) => {
      const items = extractJsonArray(fullText);
      if (!items || items.length === 0) throw new Error('error.noEdgeCases');
      return validateEdgeCases(items);
    },
    onResult: (cases, { input: sent, fullText, model: usedModel }) => {
      setEdgeCases(cases);
      setGeneratedModel(usedModel);
      onSaveArtifact?.(sent as string, fullText);
    },
  });
```

- [ ] **Step 3: `handleClear`**: `resetStream()` → `gen.clearGeneration()`; quita `setError(null)`; deps `resetStream` → `gen`.

- [ ] **Step 4: JSX**: `onReview={gen.openReview}`; `GenerateButton onClick={gen.handleGenerate} disabled={!canGenerate || gen.isStreaming} loading={gen.status === 'loading'}` (antes `loading || isStreaming`; equivalente: `isStreaming` solo es true dentro de la ventana de `loading`); `ErrorBanner message={gen.error} onDismiss={gen.dismissError}`; `{gen.review && <AnonymizerReview map={gen.review.map} onCancel={gen.cancelReview} onConfirm={gen.confirmReview} />}`.

- [ ] **Step 5: Gates**: `npm test` → 793 verdes, sin tests tocados; typecheck; lint 5 warnings.

- [ ] **Step 6: Commit**: `git add src/components/EdgeCaseTool.tsx && git commit -m "refactor(edgecase): migrar a useGenerator"` (mismo pie de atribución que Task 2).

---

### Task 4: Migrar Datos de Prueba

**Files:**
- Modify: `src/components/TestDataTool.tsx`

- [ ] **Step 1: Borrar** `isLoading`/`setIsLoading`, `error`/`setError`, `conf`/`setConf`, `useStreamingResponse()`, `doGenerate`, `handleGenerate`, el `useEffect` del `keydown`, imports sin uso (`streamWithGroq`, `getPrompt`, `I18nError`, `useStreamingResponse`, `anonymize`, `applyPlaceholderEdits`; `useEffect` solo si nadie más lo usa).

- [ ] **Step 2: Hook** (debajo de `const canGenerate = apiKey.trim().length > 0;`):

```ts
  const gen = useGenerator<Record<string, string>[]>({
    view: 'testdata',
    toolType: 'testcase',
    apiKey, model, profile, baseUrl,
    canGenerate,
    buildInput: () => buildTestDataMessage(formData),
    parse: (fullText) => {
      const jsonArray = extractJsonArray(fullText);
      if (!jsonArray || jsonArray.length === 0) throw new Error('error.noTestData');
      return validateTestDataRows(jsonArray);
    },
    onResult: (rows, { input: sent, fullText, model: usedModel }) => {
      setGeneratedData(rows);
      onSaveArtifact?.(sent as string, fullText);
      setGeneratedModel(usedModel);
    },
  });
```

- [ ] **Step 3: `handleClear`**: `resetStream()` → `gen.clearGeneration()`; quita `setError(null)`; deps.

- [ ] **Step 4: JSX**: `onReview={gen.openReview}`; `GenerateButton onClick={gen.handleGenerate} disabled={!canGenerate || gen.isStreaming} loading={gen.status === 'loading'}`; `ErrorBanner`/`AnonymizerReview` como en Task 2.

- [ ] **Step 5: Gates** (793 / limpio / 5). **Step 6: Commit** `refactor(testdata): migrar a useGenerator`.

---

### Task 5: Migrar Criterios de Aceptación

**Files:**
- Modify: `src/components/AcceptanceCriteriaTool.tsx`

Particularidad: `onComplete` hacía `addEntry(requirements, fullText)` con el `requirements` de cuando arrancó la generación. Se captura en `buildInput` (constraint global).

- [ ] **Step 1: Borrar** `status`/`setStatus`, `error`/`setError`, `conf`/`setConf`, `useStreamingResponse()`, `doGenerate`, `handleGenerate`, el `useEffect` del `keydown`, imports sin uso (`streamWithGroq`, `getPrompt`, `I18nError`, `useStreamingResponse`, `anonymize`, `applyPlaceholderEdits`, `GenerationStatus`). `useRef` hay que importarlo.

- [ ] **Step 2: Hook** (debajo de `buildEffectiveInput`, que debe quedar ANTES del hook):

```ts
  const historyInputRef = useRef('');
  const gen = useGenerator<string>({
    view: 'acceptance',
    toolType: 'criteria',
    apiKey, model, profile, baseUrl,
    canGenerate,
    buildInput: () => {
      historyInputRef.current = requirements; // el historial guarda el texto de cuando se pulso Generar
      return buildEffectiveInput();
    },
    parse: (fullText) => fullText,
    onResult: (fullText, { input: sent }) => {
      setCriteria(fullText);
      onSaveArtifact?.(sent as string, fullText);
      addEntry(historyInputRef.current, fullText);
    },
  });
```

- [ ] **Step 3: `handleClear`**: `resetStream()` → `gen.clearGeneration()`; quita `setError(null); setStatus('idle');`; deps. `handleLoadDemo`: `setError(null); setStatus('success');` → `gen.clearGeneration();`.

- [ ] **Step 4: JSX**: `onReview={gen.openReview}`; `<GenerateButton onClick={gen.handleGenerate} disabled={!canGenerate || gen.isStreaming} loading={gen.status === 'loading' && !gen.isStreaming} />`; el textarea de salida `value={gen.isStreaming ? gen.streamText : criteria}` y `readOnly={gen.isStreaming}`; `ErrorBanner`/`AnonymizerReview` como en Task 2.

- [ ] **Step 5: Gates** (793 / limpio / 5). **Step 6: Commit** `refactor(acceptance): migrar a useGenerator`.

---

### Task 6: Migrar Bug Report

**Files:**
- Modify: `src/components/BugReportTool.tsx`

- [ ] **Step 1: Borrar** `isLoading`/`setIsLoading`, `error`/`setError`, `conf`/`setConf`, `useStreamingResponse()`, `doGenerate`, `handleGenerate`, el `useEffect` del `keydown`, imports sin uso. Importar `useRef`.

- [ ] **Step 2: Hook** (debajo de `const canGenerate = ...`):

```ts
  const historyInputRef = useRef('');
  const gen = useGenerator<string>({
    view: 'bugreport',
    toolType: 'criteria',
    apiKey, model, profile, baseUrl,
    canGenerate,
    buildInput: () => {
      historyInputRef.current = formData.description;
      return buildBugReportMessage(formData);
    },
    parse: (fullText) => fullText,
    onResult: (fullText, { input: sent }) => {
      setOutput(fullText);
      onSaveArtifact?.(sent as string, fullText);
      addEntry(historyInputRef.current, fullText);
    },
  });
```

- [ ] **Step 3: `handleClear`**: `resetStream()` → `gen.clearGeneration()`; quita `setError(null)`; deps.

- [ ] **Step 4: JSX**: `onReview={gen.openReview}`; `GenerateButton onClick={gen.handleGenerate} disabled={!canGenerate || gen.isStreaming} loading={gen.status === 'loading'}`; textarea de salida `value={gen.isStreaming ? gen.streamText : output}`; `ErrorBanner`/`AnonymizerReview` como en Task 2.

- [ ] **Step 5: Gates**. **Step 6: Commit** `refactor(bugreport): migrar a useGenerator`.

---

### Task 7: Migrar Historia de Usuario

**Files:**
- Modify: `src/components/UserStoryTool.tsx`

Particularidad: error por toast; guarda el texto limpio; `isBusy` derivado de `loading || isStreaming`.

- [ ] **Step 1: Borrar** `loading`/`setLoading`, `conf`/`setConf`, `useStreamingResponse()`, `doGenerate`, `handleGenerate`, el `useEffect` del `keydown`, imports sin uso.

- [ ] **Step 2: Hook** (debajo de `const canGenerate = ...`; `effectiveInput` ya está calculado antes):

```ts
  const gen = useGenerator<string>({
    view: 'userstory',
    toolType: 'criteria',
    apiKey, model, profile, baseUrl,
    canGenerate,
    buildInput: () => effectiveInput,
    parse: (fullText) => stripMarkdown(fullText),
    onResult: (limpio, { input: sent }) => {
      setResult(limpio);
      onSaveArtifact?.(sent as string, limpio);
    },
    onError: showToast,
  });
  const isBusy = gen.status === 'loading';
```

(Busca la definición actual de `isBusy` y sustitúyela por esta línea.)

- [ ] **Step 3: `handleClear`**: `resetStream()` → `gen.clearGeneration()`; deps.

- [ ] **Step 4: JSX**: `onReview={gen.openReview}`; `GenerateButton onClick={gen.handleGenerate} disabled={!canGenerate || gen.isStreaming} loading={isBusy}`; `stripMarkdown(streamText)` → `stripMarkdown(gen.streamText)`; `<ErrorBanner message={null} onDismiss={() => {}} />` se queda tal cual (decisión C); `{gen.review && <AnonymizerReview map={gen.review.map} onCancel={gen.cancelReview} onConfirm={gen.confirmReview} />}`.

- [ ] **Step 5: Gates**. **Step 6: Commit** `refactor(userstory): migrar a useGenerator`.

---

### Task 8: Migrar Refinador

**Files:**
- Modify: `src/components/RefinerTool.tsx`

- [ ] **Step 1: Borrar** `loading`/`setLoading`, `conf`/`setConf`, `useStreamingResponse()`, `doGenerate`, `handleGenerate`, el `useEffect` del `keydown`, imports sin uso.

- [ ] **Step 2: Hook** (debajo de `const canGenerate = ...`):

```ts
  const gen = useGenerator<string>({
    view: 'refiner',
    toolType: 'criteria',
    apiKey, model, profile, baseUrl,
    canGenerate,
    buildInput: () => requirement,
    parse: (fullText) => stripMarkdown(fullText),
    onResult: (limpio, { input: sent }) => {
      setResult(limpio);
      onSaveArtifact?.(sent as string, limpio);
    },
    onError: showToast,
  });
```

- [ ] **Step 3: `handleClear`**: `resetStream()` → `gen.clearGeneration()`; deps. La línea `const shown = result || ((isStreaming || loading) ? streamText : '');` → `const shown = result || (gen.status === 'loading' ? gen.streamText : '');`.

- [ ] **Step 4: JSX**: `onReview={gen.openReview}`; `GenerateButton onClick={gen.handleGenerate} disabled={!canGenerate || gen.isStreaming} loading={gen.status === 'loading'}`; `ErrorBanner` con `null` se queda; `AnonymizerReview` como en Task 2.

- [ ] **Step 5: Gates**. **Step 6: Commit** `refactor(refiner): migrar a useGenerator`.

---

### Task 9: Migrar Conversor

**Files:**
- Modify: `src/components/ConverterTool.tsx`

- [ ] **Step 1: Borrar** `loading`/`setLoading`, `conf`/`setConf`, `useStreamingResponse()`, `doGenerate`, `handleGenerate`, el `useEffect` del `keydown`, imports sin uso.

- [ ] **Step 2: Hook** (debajo de `buildEffectiveInput`, que debe quedar antes):

```ts
  const gen = useGenerator<string>({
    view: 'converter',
    toolType: 'criteria',
    apiKey, model, profile, baseUrl,
    canGenerate,
    buildInput: () => buildEffectiveInput(),
    parse: (fullText) => fullText,
    onResult: (fullText, { input: sent }) => {
      setResult(fullText);
      onSaveArtifact?.(sent as string, fullText);
    },
    onError: showToast,
  });
```

- [ ] **Step 3: `handleClear`**: `resetStream()` → `gen.clearGeneration()`; deps. Sigue SIN Deshacer (decisión C). `const shown = isStreaming ? streamText : result;` → `gen.isStreaming ? gen.streamText : result`.

- [ ] **Step 4: JSX**: `onReview={gen.openReview}`; `GenerateButton onClick={gen.handleGenerate} disabled={!canGenerate || gen.isStreaming} loading={gen.status === 'loading'}`; `ErrorBanner` con `null` se queda; `AnonymizerReview` como en Task 2.

- [ ] **Step 5: Gates**. **Step 6: Commit** `refactor(converter): migrar a useGenerator`.

---

### Task 10: Migrar Validador de Diseño

**Files:**
- Modify: `src/components/DesignValidatorTool.tsx`

Particularidades: sin modo confidencial; entrada `ContentPart[]`; `canGenerate` ya incluye imagen y visión; el artefacto se guarda con `\`${criteria}\n\n[Imagen adjunta: ${image.name}]\`` — se captura en `buildInput`. Hoy `handleGenerate` contiene el `doGenerate` en línea.

- [ ] **Step 1: Borrar** `loading`/`setLoading`, `error`/`setError`, `useStreamingResponse()`, `handleGenerate` entero, el `useEffect` del `keydown`, imports sin uso (`streamWithGroq`, `getPrompt`, `I18nError`, `useStreamingResponse`). Importar `useRef`.

- [ ] **Step 2: Hook** (debajo de `const canGenerate = ...`):

```ts
  const artifactInputRef = useRef('');
  const gen = useGenerator<DesignReport>({
    view: 'designvalidator',
    toolType: 'testcase',
    apiKey, model, profile, baseUrl,
    canGenerate,
    confidential: false,
    buildInput: () => {
      // canGenerate garantiza image !== null; el `!` es solo para el tipo.
      artifactInputRef.current = `${criteria}\n\n[Imagen adjunta: ${image!.name}]`;
      const parts: ContentPart[] = [
        { type: 'text', text: `Criterios de aceptación existentes:\n\n${criteria}` },
        { type: 'image_url', image_url: { url: image!.dataUrl } },
      ];
      return parts;
    },
    parse: (fullText) => validateDesignReport(extractJsonObject(fullText)),
    onResult: (parsed, { fullText }) => {
      setReport(parsed);
      onSaveArtifact?.(artifactInputRef.current, fullText);
    },
  });
```

`handleGenerate` hacía `setReport(null)` al arrancar. Para conservarlo sin tocar el hook, envuelve: `const handleGenerate = useCallback(() => { setReport(null); return gen.handleGenerate(); }, [gen]);` — pero OJO: eso vacía el informe aunque el guard del hook rechace la llamada (p. ej. sin imagen). Comprueba en `DesignValidatorTool.test.tsx` si algún test cubre "generar sin imagen conserva el informe anterior"; si no lo cubre y el comportamiento antiguo era `if (!canGenerate ...) return;` ANTES de `setReport(null)`, replica el guard: `if (!canGenerate || gen.status === 'loading' || gen.isStreaming) return; setReport(null); return gen.handleGenerate();`.

- [ ] **Step 3: `handleClear`**: `resetStream()` → `gen.clearGeneration()`; quita `setError(null)`; deps.

- [ ] **Step 4: JSX**: `GenerateButton onClick={handleGenerate} disabled={!canGenerate || gen.isStreaming} loading={gen.status === 'loading'}`; `ErrorBanner message={gen.error} onDismiss={gen.dismissError}`. (No hay toggle ni modal.)

- [ ] **Step 5: Gates**. **Step 6: Commit** `refactor(designvalidator): migrar a useGenerator`.

---

### Task 11: Verificación final, docs y PR

**Files:**
- Modify: `AGENTS.md` (tabla Testing, sección Key files, fila de historial), `README.md` (recuento de tests)

- [ ] **Step 1: Confirmar que ningún tool conserva el bloque**

Run: `grep -ln "useStreamingResponse\|applyPlaceholderEdits\|addEventListener('keydown'" src/components/*Tool.tsx`
Expected: sin resultados. (Solo `src/hooks/useGenerator.ts` y `LandingScreen.tsx` deben tener listener de `keydown`.)

Run: `git diff main --stat | tail -1`
Expected: diff neto negativo (del orden de -500 líneas).

- [ ] **Step 2: Gates completos**

Run: `npm test && npm run typecheck && npm run lint && npm run build`
Expected: 793 passed / 1 skipped, 74 ficheros; ningún `*.test.*` en `git diff main --name-only`; lint 5 warnings; build OK.

- [ ] **Step 3: Browser-checks contra el build**

En una terminal: `npm run preview` (anota el puerto). En otra:
```bash
for s in sprint-schema sprint-last-column sprint-archived tracker-readonly-paste streaming-errors sprint-list-ellipsis sprint-activity-align; do node scripts/browser-checks/$s.mjs http://localhost:4173; done
```
Expected: 52 ok / 0 fallos. `streaming-errors.mjs` es el que ejercita el núcleo migrado (error SSE + Limpiar a mitad de stream).

- [ ] **Step 4: Docs**

- `AGENTS.md`, tabla Testing: añade `| \`src/hooks/useGenerator.test.tsx\` | 8 — flujo feliz, guard (tampoco desde confirmReview), error a banner o a onError, modo confidencial (review/confirm/cancel), confidential:false, clearGeneration a mitad de stream, Ctrl+Enter, y re-render con otro onResult llama al nuevo (la clase de bug H1 fijada en el hook) |`; total `785` → `793` (y `73` → `74` ficheros).
- `AGENTS.md`, Key files: fila `| \`src/hooks/useGenerator.ts\` | Núcleo de generación de los 9 tools: stream, status/error, handleGenerate (canGenerate + modo confidencial), review del anonimizador, Ctrl+Enter, clearGeneration. La config se lee de un ref, nunca de deps |`.
- `AGENTS.md`, Evolution history: fila `| useGenerator: un solo núcleo de generación | <fecha del merge, YYYY-MM-DD> | Refactor puro (spec 2026-09-02-use-generator-design.md). Los 9 tools dejan su copia del bloque de generación; el hook lee la config por ref. Cero tests existentes tocados; <la cifra de "deletions" del git diff --stat del Step 1> líneas menos. Divergencias conservadas y listadas en el spec (Conversor sin Deshacer, toast vs banner). |` — los dos `<...>` se rellenan con los valores reales al ejecutar este paso.
- `README.md`: `785 tests / 73 files` → `793 tests / 74 files`.

- [ ] **Step 5: Commit docs y PR**

```bash
git add AGENTS.md README.md
git commit -m "docs: useGenerator en AGENTS.md y README"
git push -u origin refactor/use-generator
gh pr create --title "refactor: useGenerator — un solo núcleo de generación para los 9 tools" --body "Spec: docs/superpowers/specs/2026-09-02-use-generator-design.md. Refactor puro: cero tests existentes tocados (793 verdes), cero cambios en App.css, JSX solo cableado a gen.*. Divergencias conservadas (Conversor sin Deshacer, toast vs banner, Validador sin confidencial) y listadas en el spec para otra PR. Browser-checks 52/52 contra vite preview."
```

- [ ] **Step 6: Pasada manual de Jorge** (no automatizable): los 9 tools en local con su clave — generar, Limpiar a mitad, modo confidencial con renombrado, Ctrl+Enter — antes de mergear.
