# `useGenerator()` — un solo núcleo de generación para los 9 tools

**Fecha:** 2026-09-02
**Estado:** diseño aprobado por Jorge (brainstorm en sesión), pendiente de plan
**Tipo:** refactor puro — cero cambio de comportamiento visible

## Problema

Los nueve tools de generación (Criterios, Casos de Prueba, Bug Report, Datos de
Prueba, Historia de Usuario, Refinador, Casos Límite, Conversor, Validador de
Diseño) llevan cada uno una copia de ~150-200 líneas del mismo bloque: manejo
del stream, estado de carga y error, `doGenerate` (guard, `streamWithGroq`,
`onComplete`, mapeo de errores a i18n), `handleGenerate` (comprobación de
`canGenerate` + modo confidencial), el estado del modal de revisión y el atajo
Ctrl+Enter.

Cuando ese bloque se arregla, se arregla en un tool y se olvida en los otros
ocho. En la auditoría del 2026-09-02, cuatro hallazgos nacieron exactamente así
(PRs #51 y #52):

- H1: `doGenerate` sin `onSaveArtifact`/`baseUrl` en deps — 8 tools, solo el
  Validador lo tenía bien.
- H2: `handleClear` sin `reset()` del stream — 8 tools, solo Criterios lo hacía.
- M2: `doGenerate` sin guard de carga — el badge confidencial lanzaba un
  segundo fetch.
- M5: Casos Límite sin validar el JSON — los hermanos sí validaban.

## Decisiones tomadas en el brainstorm

1. **Refactor puro, unificar después.** Las divergencias reales entre tools
   (Conversor sin Deshacer al Limpiar; Refinador, Historia y Conversor muestran
   el error como toast y los demás como banner; el Validador sin modo
   confidencial) **se conservan tal cual**. Unificarlas es cambio de producto y
   va en una PR aparte, si Jorge quiere. Quedan listadas al final.
2. **Los tests existentes son la especificación.** No se toca ningún test de
   los 785 actuales; el refactor solo se da por bueno si siguen verdes sin
   modificar. Se añade un test del hook nuevo. La poda de tests redundantes,
   si se hace, va en otra PR.
3. **Solo el hook.** La pieza compartida es `useGenerator()`; **el JSX de cada
   tool no se toca** (salvo cablear props a `gen.*`). Se descartó un componente
   envoltorio porque los rediseños de agosto colocan el toggle confidencial,
   el modal y el banner en sitios distintos en cada pantalla, y un envoltorio
   cambiaría el DOM y rompería tests y CSS.

## Interfaz

Fichero: `src/hooks/useGenerator.ts`.

```ts
interface GeneratorConfig<T> {
  /** Clave del prompt (`getPrompt(view)`) y del flag `acgen_confidential_<view>`. */
  view: string;
  /** Parámetros de reasoning de `streamWithGroq`, como hoy. */
  toolType: 'criteria' | 'testcase';
  apiKey: string;
  model: string;
  profile?: ProjectProfile;
  baseUrl?: string;
  /** El tool lo calcula como hoy (clave + entrada + lo que le aplique). */
  canGenerate: boolean;
  /** Texto (o partes multimodales en el Validador) que se envía. */
  buildInput: () => string | ContentPart[];
  /** Del texto completo al resultado tipado. Puede lanzar `Error(i18nKey)`. */
  parse: (fullText: string) => T;
  /** El tool guarda SU estado, su artefacto, su historial y su modelo. */
  onResult: (result: T, ctx: { input: string | ContentPart[]; fullText: string; model: string }) => void;
  /** Si está, el error va aquí (toast) y `error` queda null; si no, al banner. */
  onError?: (message: string) => void;
  /** `false` solo en el Validador. Por defecto `true`. */
  confidential?: boolean;
}

interface Generator {
  status: GenerationStatus;            // 'idle' | 'loading' | 'success' | 'error'
  isStreaming: boolean;
  streamText: string;                  // para los tools que pintan el stream en vivo
  error: string | null;
  dismissError: () => void;
  handleGenerate: () => Promise<void>;
  review: { text: string; map: Record<string, string> } | null;
  openReview: () => void;              // badge "N sustituciones": llama a buildInput() y abre el modal
  confirmReview: (edits: Record<string, string>) => void;
  cancelReview: () => void;
  clearGeneration: () => void;         // reset() del stream + status idle + error null + cierra el modal
}
```

Uso en un tool (Casos de Prueba):

```tsx
const gen = useGenerator<TestCaseData[]>({
  view: 'testcase', toolType: 'testcase',
  apiKey, model, profile, baseUrl,
  canGenerate,
  buildInput: () => input,
  parse: (fullText) => {
    const items = extractJsonArray(fullText);
    if (items.length === 0) throw new Error('error.noTestCases');
    return validateTestCases(items);
  },
  onResult: (cases, { input, fullText, model }) => {
    setTestCases(cases);
    onSaveArtifact?.(input as string, fullText);
    setGeneratedModel(model);
  },
});

// JSX intacto, cableado al hook:
<ConfidentialToggle view="testcase" text={input} onReview={gen.openReview} />
<GenerateButton onClick={gen.handleGenerate} disabled={!canGenerate || gen.isStreaming}
                loading={gen.status === 'loading' && !gen.isStreaming} />
<ErrorBanner message={gen.error} onDismiss={gen.dismissError} />
{gen.review && (
  <AnonymizerReview map={gen.review.map} onCancel={gen.cancelReview} onConfirm={gen.confirmReview} />
)}
```

## Comportamiento del hook (lo que hoy hace cada copia)

- `handleGenerate`: si `!canGenerate` o hay generación en curso (`status ===
  'loading' || isStreaming`), no hace nada. Si el modo confidencial está
  activo y `anonymize(buildInput())` encuentra algo, abre `review` y para; si
  no, llama a `run(input)`.
- `run(input, map?)`: mismo guard de carga (también protege a
  `confirmReview`, que entra por aquí — M2). Pone `status='loading'`, limpia
  `error`, llama a `streamWithGroq(apiKey, model, input, getPrompt(view),
  toolType, profile, map, baseUrl)` y consume el stream con
  `useStreamingResponse`. En `onComplete`: `parse(fullText)` →
  `onResult(result, ctx)` → `status='success'`. En `catch`: mensaje =
  `t(err.message, err.params)` o `t('error.unexpected')`; con `onError` lo
  entrega ahí, si no lo pone en `error`; `status='error'`. En `finally`:
  cierra `review`.
- `openReview()`: `setReview(anonymize(buildInput()))` — sin argumento a
  propósito: el badge entra por aquí sin pasar por `handleGenerate`, y
  `buildInput` es donde el tool captura lo que necesita "al arrancar"
  (historial, texto del artefacto); si el texto se construyera fuera, ese
  ref quedaría sin escribir en este camino (hallazgo de la review de la
  Tarea 5, decisión de Jorge). `confirmReview(edits)`:
  `applyPlaceholderEdits` → `run(text, map)` → cierra el modal.
  `cancelReview`: cierra el modal.
- `clearGeneration`: `reset()` de `useStreamingResponse` (invalida el stream en
  curso, H2), `status='idle'`, `error=null`, cierra `review`. Cada tool lo
  llama desde su `handleClear`, que sigue siendo suyo.
- Atajo: un `useEffect` con listener `keydown` en `window`; Ctrl/Cmd+Enter →
  `preventDefault` + `handleGenerate` si `canGenerate` y no está cargando.
  (La propagación desde dentro de un modal ya la corta `Modal`, PR #56.)

**La propiedad que elimina la clase de bug:** la config entera vive en un
`useRef` que se reasigna en cada render (`configRef.current = config`) y todas
las funciones del hook leen `configRef.current` en el momento de ejecutarse.
Ningún callback del tool entra en un array de deps, así que "se me olvidó X en
las deps" (H1) deja de ser posible por construcción. Es la única decisión de
implementación que no es negociable.

## Lo que se queda en cada tool

Estados de entrada y de resultado (`useState`, como hoy), `handleClear` con su
snapshot y su Deshacer (llamando a `gen.clearGeneration()` primero), Copiar,
Ver ejemplo, historial, exportar PDF/CSV/TSV, y **todo el JSX**.

Regla: si un tool necesitara una opción nueva del hook que ninguno de los otros
ocho usa, ese trozo no es común y se queda en el tool.

## Migración

Un commit por tool, en este orden; tras cada commit, los 785 tests siguen
verdes sin tocar ninguno:

| # | Tool | `buildInput` | `parse` | Error | Notas |
|---|---|---|---|---|---|
| 1 | Casos de Prueba | `input` | `validateTestCases(extractJsonArray)`, lanza `error.noTestCases` si vacío | banner | Canónico: ya usa `GenerationStatus`, JSON y banner. Prueba la interfaz entera antes de seguir |
| 2 | Casos Límite | `requirement` | `validateEdgeCases(extractJsonArray)`, `error.noEdgeCases` | banner | `loading` booleano → `gen.status === 'loading'` |
| 3 | Datos de Prueba | `buildTestDataMessage(formData)` | `validateTestDataRows`, `error.noTestData` | banner | `canGenerate` = solo API key |
| 4 | Criterios | `buildEffectiveInput()` (contexto + fecha) | identidad | banner | `onResult` también `addEntry(requirements, fullText)`; el textarea sigue leyendo `gen.streamText` |
| 5 | Bug Report | `buildBugReportMessage(formData)` | identidad | banner | `addEntry(formData.description, fullText)`; `streamText` |
| 6 | Historia de Usuario | `effectiveInput` (guiado o libre) | `stripMarkdown` | toast | guarda el texto limpio |
| 7 | Refinador | `requirement` | `stripMarkdown` | toast | como Historia |
| 8 | Conversor | formato origen/destino + `input` | identidad | toast | Limpiar sin Deshacer se queda como está |
| 9 | Validador | `ContentPart[]` con la imagen | `validateDesignReport(extractJsonObject)` | banner | `confidential: false`; `canGenerate` incluye imagen y visión; artefacto con `[Imagen adjunta: nombre]` |

Reglas: nunca dos tools en un commit; cada tool se migra en el sitio (se borra
su bloque copiado y se cablea, no se reescribe); lo no común no se toca.

## Tests

**Nuevo `src/hooks/useGenerator.test.ts`** (`renderHook`, `streamWithGroq`
mockeado como en `useStreamingResponse.test.ts`), un test por propiedad:

1. Flujo feliz: `status` pasa por `loading`, `parse` recibe el texto completo,
   `onResult` recibe `(result, {input, fullText, model})`, acaba en `success`.
2. Guard: con `canGenerate=false` o generación en curso, `handleGenerate` y
   `confirmReview` no llaman a `streamWithGroq`.
3. Error: `parse` que lanza → `status='error'` y `error` traducido con
   `params`; con `onError`, va a `onError` y `error` queda `null`.
4. Confidencial: con el flag activo y PII, no llama a la API y `review` trae
   el mapa; `confirmReview(edits)` aplica los renames y llama con el texto
   enmascarado y el mapa; `cancelReview` cierra sin llamar.
5. `clearGeneration` a mitad de stream: `onResult` nunca se llama (H2).
6. Ctrl+Enter en `window` dispara `handleGenerate`; con `canGenerate=false`
   no.
7. Re-render con un `onResult` distinto tras montar → se llama el nuevo (H1
   probado en el hook, no solo en los tools).

Los tres parametrizados existentes (`tools.staleClosures`, `tools.confidential`,
`staleTranslation`) siguen corriendo sobre los 9 tools reales y son la prueba
de integración del cableado.

## Verificación

Por commit: `npm test` (785 existentes sin cambios + los del hook),
`npm run typecheck`, `npm run lint` (debe seguir en 5 warnings; un
`exhaustive-deps` nuevo en un tool significa que quedó un callback en deps que
debía ir por el hook).

Antes de mergear: `npm run build`; los 7 browser-checks contra `vite preview`
(en especial `streaming-errors.mjs`); y una pasada manual de Jorge por los 9
tools en local generando con su clave.

**Hecho significa:** diff neto negativo (~500-600 líneas), cero cambios en
tests existentes, cero cambios en `App.css`, JSX solo con cableado a `gen.*`,
bundle en producción idéntico al build local.

## Fuera de alcance (decisión C, para una PR posterior si Jorge quiere)

- Dar Deshacer al Limpiar del Conversor.
- Unificar la presentación de errores (banner en todos, o toast en todos).
- Podar los tests per-tool que repiten lo que ya prueba el hook.
- Un botón "Parar" real (`AbortSignal` hasta el fetch).
