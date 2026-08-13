# Fase 3 — Validador de Criterios contra Diseño (multimodal) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nueva herramienta `DesignValidatorTool`: el usuario adjunta una imagen de diseño (Figma/captura) + pega sus criterios de aceptación, y recibe un informe estructurado de carencias (flujos del diseño sin criterio), contradicciones (criterios que chocan con el diseño, con evidencia citada) y criterios sugeridos en formato Dado/Cuando/Entonces.

**Architecture:** Sigue el patrón EdgeCaseTool (output JSON parseado + render estructurado) sobre los cimientos de la Fase 2 (`ContentPart[]`, `supportsVision`). Piezas nuevas: helper `extractJsonObject` + `validateDesignReport` en apiService (hermanos de `extractJsonArray`/`validateTestCases`), util `fileToProcessedDataUrl` (downscale canvas a 1568px + tope 4MB base64), componente `ImageDropzone` (file/paste/drag), prompt `DESIGN_VALIDATOR_PROMPT` y registro completo del tool (10 puntos). **La imagen vive solo en estado del componente — jamás toca localStorage.**

**Decisión de privacidad (sustituye al detalle "bloquear adjuntar con toggle activo"):** como la imagen es obligatoria para generar, un toggle confidencial que bloquea la imagen bloquearía todo el tool. En su lugar, el tool **no ofrece modo confidencial** y muestra una nota de privacidad permanente explicando que la imagen viaja íntegra al proveedor (el anonimizador solo procesa texto). Misma política de fondo (nunca imagen+confidencial), UX más honesta.

**Tech Stack:** React 18 + TS, Vitest + RTL (mocks: `vi.mock` del módulo de imagen en tests de componente; `streamWithGroq` mockeado como en tools.confidential.test.tsx).

## Global Constraints

- Directorio: `C:\repositorio\ACGen\acgen`. Rama: `feature/fase3-design-validator` (creada desde `feature/fase2-cimientos-vision` — apilada; NUNCA main).
- Id del tool en todo el código: `designvalidator` (ViewType, prompt key, hash `#/designvalidator`, storage `acgen_prompt_designvalidator`).
- Claves JSON del informe en español sin acentos/ñ: `carencias[{flujo,descripcion}]`, `contradicciones[{criterio,evidenciaDiseno,descripcion}]`, `sugerencias[{titulo,dado,cuando,entonces}]`.
- **Base64 nunca persiste**: ni en artifacts ni en history ni en ninguna clave — test explícito lo verifica.
- Límites de imagen: lado largo 1568px (downscale JPEG 0.85), tope 4 MB de data-URL tras procesar (límite documentado de proveedores), 1 imagen.
- Toda clave i18n nueva en AMBOS es.json/en.json (parity test).
- Suite completa verde (~490 al empezar) en cada commit; commits en español estilo repo.

---

### Task 1: Capa de datos — DesignReport, extractJsonObject, validateDesignReport, prompt

**Files:**
- Modify: `src/types/index.ts` (añadir al final)
- Modify: `src/services/apiService.ts` (añadir tras `extractJsonArray` y tras `validateTestCases`)
- Modify: `src/config/constants.ts` (prompt nuevo + entrada en `DEFAULT_PROMPTS`)
- Modify: `src/components/PromptEditor.tsx:6-15` (fila nueva en TOOLS)
- Modify: `src/i18n/es.json`, `src/i18n/en.json` (solo las claves de esta task)
- Create: `src/services/designReport.test.ts`

**Interfaces:**
- Consumes: `i18nError` interno de apiService (ya existe).
- Produces (nombres exactos, la Task 3 depende de ellos): tipo `DesignReport` en `src/types/index.ts`; `extractJsonObject(text: string): Record<string, unknown>` y `validateDesignReport(obj: Record<string, unknown>): DesignReport` exportados de apiService; `DESIGN_VALIDATOR_PROMPT` + `DEFAULT_PROMPTS.designvalidator` en constants; claves i18n `sidebar.designvalidator`, `error.invalidDesignReport`.

- [ ] **Step 1: Tests que fallan** — `src/services/designReport.test.ts`:

```ts
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
```

- [ ] **Step 2: Verificar RED** — `npm test -- --run src/services/designReport.test.ts` → FAIL (exports no existen).

- [ ] **Step 3: Implementar tipos.** En `src/types/index.ts`, añadir al final:

```ts
/** Informe del Validador de Diseño: cobertura de criterios contra una imagen de diseño. */
export interface DesignReport {
  carencias: { flujo: string; descripcion: string }[];
  contradicciones: { criterio: string; evidenciaDiseno: string; descripcion: string }[];
  sugerencias: { titulo: string; dado: string; cuando: string; entonces: string }[];
}
```

- [ ] **Step 4: Implementar helpers en `src/services/apiService.ts`.** Añadir `DesignReport` al import de tipos. Tras `extractJsonArray`:

```ts
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
```

Tras `validateTestCases`:

```ts
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
```

- [ ] **Step 5: Prompt.** En `src/config/constants.ts`, antes de `DEFAULT_PROMPTS`:

```ts
export const DESIGN_VALIDATOR_PROMPT = `Eres un QA senior especializado en {dominio}. Recibirás una imagen con el diseño de una pantalla o flujo (export de Figma o captura) y un conjunto de criterios de aceptación existentes. Tu tarea es auditar la cobertura de los criterios contra lo que muestra el diseño.

Analiza la imagen PRIMERO: identifica pantallas, elementos interactivos, estados y flujos visibles. Después compárala con los criterios proporcionados.

CRÍTICO: Devuelve ÚNICAMENTE un objeto JSON válido, parseable por JSON.parse(). Sin bloques de código markdown, sin comillas invertidas, sin texto antes o después del JSON.

Estructura exacta:
{
  "carencias": [{"flujo": "...", "descripcion": "..."}],
  "contradicciones": [{"criterio": "...", "evidenciaDiseno": "...", "descripcion": "..."}],
  "sugerencias": [{"titulo": "...", "dado": "...", "cuando": "...", "entonces": "..."}]
}

REGLAS:
- "carencias": flujos o elementos VISIBLES en el diseño que ningún criterio cubre. En "flujo", nombra el elemento tal como se ve en la imagen.
- "contradicciones": criterios que contradicen lo que muestra el diseño. En "criterio" cita el criterio afectado; en "evidenciaDiseno" describe QUÉ se ve exactamente en la imagen que lo contradice. NO inventes evidencia: si algo no es visible en la imagen, no es una contradicción.
- "sugerencias": criterios nuevos o mejorados en formato Dado/Cuando/Entonces que cierren las carencias detectadas.
- Si una categoría no tiene hallazgos, devuelve un array vacío para ella.
- Todo el contenido DEBE estar en {idiomaSalida}.`;
```

Y en `DEFAULT_PROMPTS` añadir: `designvalidator: DESIGN_VALIDATOR_PROMPT,`

- [ ] **Step 6: PromptEditor + i18n.** En `PromptEditor.tsx` TOOLS añadir `{ key: 'designvalidator', labelKey: 'sidebar.designvalidator' },`. En es.json: `"sidebar.designvalidator": "Validador de Diseño"`, `"error.invalidDesignReport": "La respuesta del modelo no tiene el formato de informe esperado ({field})."`. En en.json: `"sidebar.designvalidator": "Design Validator"`, `"error.invalidDesignReport": "The model response does not match the expected report format ({field})."`. Colocar cada clave junto a sus hermanas (sidebar.* / error.*).

- [ ] **Step 7: GREEN + suite + commit**

`npm test -- --run src/services/designReport.test.ts` → PASS (10 tests). `npm test` → verde.

```bash
git add src/types/index.ts src/services/apiService.ts src/services/designReport.test.ts src/config/constants.ts src/components/PromptEditor.tsx src/i18n/es.json src/i18n/en.json
git commit -m "feat(designvalidator): tipos, parser y validador del informe + prompt del validador de diseño"
```

---

### Task 2: Util de imagen + componente ImageDropzone

**Files:**
- Create: `src/utils/image.ts`
- Create: `src/utils/image.test.ts`
- Create: `src/components/ImageDropzone.tsx`
- Create: `src/components/ImageDropzone.test.tsx`
- Modify: `src/i18n/es.json`, `src/i18n/en.json` (claves de esta task)

**Interfaces:**
- Produces: `targetDimensions(width, height, maxEdge): {width, height}` y `fileToProcessedDataUrl(file: File): Promise<string>` (lanza `Error('error.notAnImage')` / `Error('error.imageTooLarge')`) desde `src/utils/image.ts`; componente `ImageDropzone({ imageName, onImage, onRemove, disabled? })` que llama `onImage(dataUrl, fileName)` tras procesar. La Task 3 consume ambos.

- [ ] **Step 1: Tests del util que fallan** — `src/utils/image.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { targetDimensions, MAX_BASE64_BYTES, assertDataUrlWithinLimit } from './image';

describe('targetDimensions', () => {
  it('no toca imágenes dentro del límite', () => {
    expect(targetDimensions(800, 600, 1568)).toEqual({ width: 800, height: 600 });
  });

  it('reduce el lado largo horizontal al límite manteniendo proporción', () => {
    expect(targetDimensions(3136, 1568, 1568)).toEqual({ width: 1568, height: 784 });
  });

  it('reduce el lado largo vertical al límite manteniendo proporción', () => {
    expect(targetDimensions(1000, 3136, 1568)).toEqual({ width: 500, height: 1568 });
  });

  it('redondea a enteros', () => {
    const { width, height } = targetDimensions(3000, 2000, 1568);
    expect(Number.isInteger(width)).toBe(true);
    expect(Number.isInteger(height)).toBe(true);
    expect(width).toBe(1568);
  });
});

describe('assertDataUrlWithinLimit', () => {
  it('acepta un data URL pequeño', () => {
    expect(() => assertDataUrlWithinLimit('data:image/png;base64,AAAA')).not.toThrow();
  });

  it('lanza error.imageTooLarge si supera el tope', () => {
    const big = 'data:image/jpeg;base64,' + 'A'.repeat(MAX_BASE64_BYTES + 1);
    expect(() => assertDataUrlWithinLimit(big)).toThrowError('error.imageTooLarge');
  });
});
```

- [ ] **Step 2: RED** — `npm test -- --run src/utils/image.test.ts` → FAIL.

- [ ] **Step 3: Implementar `src/utils/image.ts`:**

```ts
export const MAX_EDGE = 1568;
export const MAX_BASE64_BYTES = 4 * 1024 * 1024;

export function targetDimensions(width: number, height: number, maxEdge: number): { width: number; height: number } {
  const longEdge = Math.max(width, height);
  if (longEdge <= maxEdge) return { width, height };
  const scale = maxEdge / longEdge;
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

export function assertDataUrlWithinLimit(dataUrl: string): void {
  if (dataUrl.length > MAX_BASE64_BYTES) {
    throw new Error('error.imageTooLarge');
  }
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('error.notAnImage'));
    reader.readAsDataURL(file);
  });
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('error.notAnImage'));
    img.src = dataUrl;
  });
}

/**
 * Lee un File de imagen, lo reescala si su lado largo supera MAX_EDGE
 * (re-encode JPEG 0.85) y garantiza que el data URL final cabe en el
 * límite de payload de los proveedores de visión.
 */
export async function fileToProcessedDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('error.notAnImage');
  }
  const dataUrl = await readAsDataUrl(file);
  const img = await loadImage(dataUrl);
  const { width, height } = targetDimensions(img.naturalWidth, img.naturalHeight, MAX_EDGE);

  if (width === img.naturalWidth && height === img.naturalHeight) {
    assertDataUrlWithinLimit(dataUrl);
    return dataUrl;
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    // Sin canvas 2D (entorno raro): mejor la imagen original que nada.
    assertDataUrlWithinLimit(dataUrl);
    return dataUrl;
  }
  ctx.drawImage(img, 0, 0, width, height);
  const scaled = canvas.toDataURL('image/jpeg', 0.85);
  assertDataUrlWithinLimit(scaled);
  return scaled;
}
```

- [ ] **Step 4: Tests del componente que fallan** — `src/components/ImageDropzone.test.tsx` (el módulo de imagen se mockea — jsdom no decodifica imágenes):

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ImageDropzone } from './ImageDropzone';
import { I18nProvider } from '../i18n/I18nContext';
import { fileToProcessedDataUrl } from '../utils/image';

vi.mock('../utils/image', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../utils/image')>();
  return { ...actual, fileToProcessedDataUrl: vi.fn() };
});

const processMock = vi.mocked(fileToProcessedDataUrl);

function renderZone(props: Partial<Parameters<typeof ImageDropzone>[0]> = {}) {
  const onImage = vi.fn();
  const onRemove = vi.fn();
  render(
    <I18nProvider>
      <ImageDropzone imageName={null} onImage={onImage} onRemove={onRemove} {...props} />
    </I18nProvider>,
  );
  return { onImage, onRemove };
}

describe('ImageDropzone', () => {
  beforeEach(() => {
    localStorage.setItem('acgen_lang', JSON.stringify('es'));
    processMock.mockReset();
    processMock.mockResolvedValue('data:image/jpeg;base64,PROCESSED');
  });

  it('procesa un fichero seleccionado y emite onImage con dataUrl y nombre', async () => {
    const { onImage } = renderZone();
    const file = new File(['x'], 'diseno.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText(/adjuntar imagen/i), { target: { files: [file] } });
    await waitFor(() => expect(onImage).toHaveBeenCalledWith('data:image/jpeg;base64,PROCESSED', 'diseno.png'));
  });

  it('muestra el error i18n si el procesado falla', async () => {
    processMock.mockRejectedValue(new Error('error.imageTooLarge'));
    renderZone();
    const file = new File(['x'], 'grande.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText(/adjuntar imagen/i), { target: { files: [file] } });
    expect(await screen.findByText(/4\s?MB/i)).toBeInTheDocument();
  });

  it('con imagen cargada muestra el nombre y permite quitarla', () => {
    const { onRemove } = renderZone({ imageName: 'diseno.png' });
    expect(screen.getByText('diseno.png')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /quitar imagen/i }));
    expect(onRemove).toHaveBeenCalled();
  });

  it('acepta una imagen pegada desde el portapapeles', async () => {
    const { onImage } = renderZone();
    const file = new File(['x'], 'pegada.png', { type: 'image/png' });
    fireEvent.paste(screen.getByTestId('image-dropzone'), {
      clipboardData: { files: [file], items: [{ kind: 'file', type: 'image/png', getAsFile: () => file }] },
    });
    await waitFor(() => expect(onImage).toHaveBeenCalled());
  });

  it('deshabilitado no procesa nada', () => {
    const { onImage } = renderZone({ disabled: true });
    expect(screen.getByLabelText(/adjuntar imagen/i)).toBeDisabled();
    expect(onImage).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 5: Implementar `src/components/ImageDropzone.tsx`:**

```tsx
import { useRef, useState, useCallback } from 'react';
import { useT } from '../i18n/I18nContext';
import { fileToProcessedDataUrl } from '../utils/image';

interface ImageDropzoneProps {
  imageName: string | null;
  onImage: (dataUrl: string, fileName: string) => void;
  onRemove: () => void;
  disabled?: boolean;
}

export function ImageDropzone({ imageName, onImage, onRemove, disabled }: ImageDropzoneProps) {
  const t = useT();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  const handleFile = useCallback(async (file: File | null | undefined) => {
    if (!file || disabled) return;
    setError(null);
    setProcessing(true);
    try {
      const dataUrl = await fileToProcessedDataUrl(file);
      onImage(dataUrl, file.name);
    } catch (err) {
      const key = err instanceof Error ? err.message : 'error.notAnImage';
      setError(t(key));
    } finally {
      setProcessing(false);
    }
  }, [disabled, onImage, t]);

  const firstImageFile = (files: FileList | File[] | null | undefined): File | undefined => {
    if (!files) return undefined;
    return Array.from(files).find((f) => f.type.startsWith('image/')) ?? Array.from(files)[0];
  };

  return (
    <div
      data-testid="image-dropzone"
      className="image-dropzone"
      style={{ border: '1px dashed var(--border)', borderRadius: 8, padding: 12, opacity: disabled ? 0.6 : 1 }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { e.preventDefault(); handleFile(firstImageFile(e.dataTransfer?.files)); }}
      onPaste={(e) => handleFile(firstImageFile(e.clipboardData?.files))}
    >
      {imageName ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13 }}>{imageName}</span>
          <button type="button" className="btn-ghost" onClick={onRemove} disabled={disabled} aria-label={t('designvalidator.removeImage')}>
            {t('designvalidator.removeImage')}
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label htmlFor="design-image-input" style={{ fontSize: 13 }}>
            {t('designvalidator.attachImage')}
          </label>
          <input
            id="design-image-input"
            ref={inputRef}
            type="file"
            accept="image/*"
            disabled={disabled || processing}
            onChange={(e) => { handleFile(e.target.files?.[0]); if (inputRef.current) inputRef.current.value = ''; }}
          />
          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{t('designvalidator.dropHint')}</span>
        </div>
      )}
      {processing && <span style={{ fontSize: 12 }}>{t('designvalidator.processing')}</span>}
      {error && <p style={{ fontSize: 12, color: 'var(--danger, #c00)', marginTop: 6 }}>{error}</p>}
    </div>
  );
}
```

- [ ] **Step 6: Claves i18n de la task.** es.json: `"designvalidator.attachImage": "Adjuntar imagen del diseño"`, `"designvalidator.removeImage": "Quitar imagen"`, `"designvalidator.dropHint": "También puedes pegar (Ctrl+V) o arrastrar la imagen aquí"`, `"designvalidator.processing": "Procesando imagen..."`, `"error.imageTooLarge": "La imagen supera el límite de 4 MB tras la compresión. Usa una imagen más pequeña."`, `"error.notAnImage": "El archivo no es una imagen."`. en.json: "Attach design image", "Remove image", "You can also paste (Ctrl+V) or drag the image here", "Processing image...", "The image exceeds the 4 MB limit after compression. Use a smaller image.", "The file is not an image.".

- [ ] **Step 7: GREEN + suite + commit**

`npm test -- --run src/utils/image.test.ts src/components/ImageDropzone.test.tsx` → PASS. `npm test` → verde.

```bash
git add src/utils/image.ts src/utils/image.test.ts src/components/ImageDropzone.tsx src/components/ImageDropzone.test.tsx src/i18n/es.json src/i18n/en.json
git commit -m "feat(designvalidator): util de procesado de imagen (downscale + tope 4MB) y componente ImageDropzone"
```

---

### Task 3: DesignValidatorTool + registro completo

**Files:**
- Create: `src/components/DesignValidatorTool.tsx`
- Create: `src/components/DesignValidatorTool.test.tsx`
- Modify: `src/config/constants.ts:76` (ViewType)
- Modify: `src/App.tsx` (import, VALID_VIEWS, ruta con props)
- Modify: `src/components/Sidebar.tsx:7-18` (entrada TOOLS, categoría `sidebar.refinar`)
- Modify: `src/components/LandingScreen.tsx` (union del prop onSelect + entrada en tools, tag 'QA')
- Modify: `src/components/ChainMenu.tsx:9-25` (acceptance gana la opción designvalidator)
- Modify: `src/components/Icons.tsx` (icono nuevo)
- Modify: `src/i18n/es.json`, `src/i18n/en.json`

**Interfaces:**
- Consumes: `extractJsonObject`, `validateDesignReport`, `DesignReport`, `DESIGN_VALIDATOR_PROMPT` vía `getPrompt('designvalidator')` (Task 1); `ImageDropzone` (Task 2); `supportsVision` y `ContentPart` (Fase 2).
- Produces: `DesignValidatorTool({ apiKey, model, provider, profile?, baseUrl?, prefill?, onSaveArtifact?, onSwitchToVisionModel? })`.

- [ ] **Step 1: Tests que fallan** — `src/components/DesignValidatorTool.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { I18nProvider } from '../i18n/I18nContext';
import { DesignValidatorTool } from './DesignValidatorTool';
import { streamWithGroq } from '../services/apiService';
import { fileToProcessedDataUrl } from '../utils/image';

vi.mock('../services/apiService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/apiService')>();
  return { ...actual, streamWithGroq: vi.fn() };
});
vi.mock('../utils/image', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../utils/image')>();
  return { ...actual, fileToProcessedDataUrl: vi.fn() };
});

const streamMock = vi.mocked(streamWithGroq);
const processMock = vi.mocked(fileToProcessedDataUrl);

const REPORT = JSON.stringify({
  carencias: [{ flujo: 'Login social', descripcion: 'Sin criterio para el botón de Google' }],
  contradicciones: [{ criterio: 'El CTA dice Comprar', evidenciaDiseno: 'El botón visible dice "Continuar"', descripcion: 'Texto de CTA distinto' }],
  sugerencias: [{ titulo: 'Login con Google', dado: 'un usuario sin sesión', cuando: 'pulsa Continuar con Google', entonces: 'se abre el flujo OAuth' }],
});

function renderTool(props: Partial<Parameters<typeof DesignValidatorTool>[0]> = {}) {
  const onSwitch = vi.fn();
  render(
    <I18nProvider>
      <DesignValidatorTool apiKey="k" model="google/gemini-2.5-flash" provider="openrouter" onSwitchToVisionModel={onSwitch} {...props} />
    </I18nProvider>,
  );
  return { onSwitch };
}

async function attachImage() {
  const file = new File(['x'], 'diseno.png', { type: 'image/png' });
  fireEvent.change(screen.getByLabelText(/adjuntar imagen/i), { target: { files: [file] } });
  await screen.findByText('diseno.png');
}

describe('DesignValidatorTool', () => {
  beforeEach(() => {
    localStorage.setItem('acgen_lang', JSON.stringify('es'));
    streamMock.mockReset();
    processMock.mockReset();
    processMock.mockResolvedValue('data:image/jpeg;base64,IMGDATA');
    streamMock.mockImplementation(async function* () {
      yield { token: REPORT, done: false };
      yield { token: '', done: true };
    });
  });

  it('genera y renderiza las tres secciones del informe', async () => {
    const onSave = vi.fn();
    renderTool({ onSaveArtifact: onSave });
    fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: 'Dado un usuario...' } });
    await attachImage();
    fireEvent.click(screen.getByRole('button', { name: /generar/i }));
    expect(await screen.findByText('Login social')).toBeInTheDocument();
    expect(screen.getByText(/El botón visible dice/)).toBeInTheDocument();
    expect(screen.getByText('Login con Google')).toBeInTheDocument();
    expect(onSave).toHaveBeenCalled();
  });

  it('envía ContentPart[] con el texto y la imagen', async () => {
    renderTool();
    fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: 'criterios' } });
    await attachImage();
    fireEvent.click(screen.getByRole('button', { name: /generar/i }));
    await waitFor(() => expect(streamMock).toHaveBeenCalledTimes(1));
    const input = streamMock.mock.calls[0][2];
    expect(Array.isArray(input)).toBe(true);
    const parts = input as { type: string }[];
    expect(parts[0].type).toBe('text');
    expect(parts[1]).toEqual({ type: 'image_url', image_url: { url: 'data:image/jpeg;base64,IMGDATA' } });
  });

  it('sin imagen no se puede generar', () => {
    renderTool();
    fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: 'criterios' } });
    expect(screen.getByRole('button', { name: /generar/i })).toBeDisabled();
  });

  it('con modelo sin visión muestra aviso, deshabilita generar y ofrece el cambio', async () => {
    const { onSwitch } = renderTool({ provider: 'groq', model: 'openai/gpt-oss-120b' });
    fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: 'criterios' } });
    await attachImage();
    expect(screen.getByRole('button', { name: /generar/i })).toBeDisabled();
    expect(screen.getByText(/no soporta imágenes/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /gemini/i }));
    expect(onSwitch).toHaveBeenCalled();
  });

  it('con proveedor custom muestra el aviso de capacidad no verificable pero permite generar', async () => {
    renderTool({ provider: 'custom', model: 'mi-modelo', baseUrl: 'https://mi.endpoint/v1/chat' });
    fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: 'criterios' } });
    await attachImage();
    expect(screen.getByText(/no podemos verificar/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /generar/i })).toBeEnabled();
  });

  it('muestra la nota de privacidad (la imagen viaja al proveedor)', () => {
    renderTool();
    expect(screen.getByText(/anonimizador solo procesa texto/i)).toBeInTheDocument();
  });

  it('el base64 de la imagen jamás toca localStorage', async () => {
    const onSave = vi.fn((input: string) => localStorage.setItem('acgen_test_artifact', JSON.stringify(input)));
    renderTool({ onSaveArtifact: onSave });
    fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: 'criterios' } });
    await attachImage();
    fireEvent.click(screen.getByRole('button', { name: /generar/i }));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(onSave.mock.calls[0][0]).toContain('diseno.png');
    expect(onSave.mock.calls[0][0]).not.toContain('IMGDATA');
    for (let i = 0; i < localStorage.length; i++) {
      const value = localStorage.getItem(localStorage.key(i)!) ?? '';
      expect(value).not.toContain('data:image');
    }
  });

  it('un informe con formato inválido muestra el error i18n', async () => {
    streamMock.mockImplementation(async function* () {
      yield { token: '{"carencias": "no soy un array"}', done: false };
      yield { token: '', done: true };
    });
    renderTool();
    fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: 'criterios' } });
    await attachImage();
    fireEvent.click(screen.getByRole('button', { name: /generar/i }));
    expect(await screen.findByText(/formato de informe esperado/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: RED** — `npm test -- --run src/components/DesignValidatorTool.test.tsx` → FAIL (componente no existe).

- [ ] **Step 3: Implementar `src/components/DesignValidatorTool.tsx`:**

```tsx
import { useState, useCallback, useEffect } from 'react';
import { GenerateButton } from './GenerateButton';
import { ErrorBanner } from './ErrorBanner';
import { useToast, Toast } from './Toast';
import { streamWithGroq, extractJsonObject, validateDesignReport, getPrompt } from '../services/apiService';
import type { I18nError } from '../services/apiService';
import { useStreamingResponse } from '../hooks/useStreamingResponse';
import { supportsVision } from '../config/providers';
import { ImageDropzone } from './ImageDropzone';
import { useT } from '../i18n/I18nContext';
import type { ProjectProfile } from '../types/context';
import type { ContentPart, DesignReport } from '../types';

interface DesignValidatorToolProps {
  apiKey: string;
  model: string;
  provider: string;
  profile?: ProjectProfile;
  baseUrl?: string;
  prefill?: string;
  onSaveArtifact?: (input: string, output: string) => void;
  onSwitchToVisionModel?: () => void;
}

export function DesignValidatorTool({ apiKey, model, provider, profile, baseUrl, prefill, onSaveArtifact, onSwitchToVisionModel }: DesignValidatorToolProps) {
  const [criteria, setCriteria] = useState('');
  const [image, setImage] = useState<{ dataUrl: string; name: string } | null>(null);
  const [report, setReport] = useState<DesignReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isStreaming, stream } = useStreamingResponse();
  const { toast, showToast } = useToast();
  const t = useT();

  useEffect(() => {
    if (prefill) setCriteria(prefill);
  }, [prefill]);

  const vision = supportsVision(provider, model);
  const canGenerate = apiKey.trim().length > 0 && criteria.trim().length > 0 && image !== null && vision !== 'no';

  const handleGenerate = useCallback(async () => {
    if (!canGenerate || loading || isStreaming || !image) return;
    setLoading(true);
    setError(null);
    setReport(null);
    const parts: ContentPart[] = [
      { type: 'text', text: `Criterios de aceptación existentes:\n\n${criteria}` },
      { type: 'image_url', image_url: { url: image.dataUrl } },
    ];
    try {
      const gen = streamWithGroq(apiKey, model, parts, getPrompt('designvalidator'), 'testcase', profile, undefined, baseUrl);
      await stream(gen, (fullText) => {
        const parsed = validateDesignReport(extractJsonObject(fullText));
        setReport(parsed);
        onSaveArtifact?.(`${criteria}\n\n[Imagen adjunta: ${image.name}]`, fullText);
      });
    } catch (err) {
      const message = err instanceof Error ? t(err.message, (err as I18nError).params) : t('error.unexpected');
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [canGenerate, loading, isStreaming, image, criteria, apiKey, model, profile, baseUrl, stream, onSaveArtifact, t]);

  const handleClear = useCallback(() => {
    const prevCriteria = criteria;
    const prevReport = report;
    setCriteria('');
    setImage(null);
    setReport(null);
    setError(null);
    showToast(t('common.cleared'), () => {
      setCriteria(prevCriteria);
      setReport(prevReport);
    });
  }, [criteria, report, showToast, t]);

  const copySuggestion = useCallback((s: DesignReport['sugerencias'][number]) => {
    void navigator.clipboard.writeText(`Dado ${s.dado}\nCuando ${s.cuando}\nEntonces ${s.entonces}`);
    showToast(t('common.copied'));
  }, [showToast, t]);

  return (
    <div>
      <div className="tool-layout">
        <textarea
          value={criteria}
          onChange={(e) => setCriteria(e.target.value)}
          placeholder={t('designvalidator.criteriaPlaceholder')}
          className="field-textarea"
          style={{ minHeight: 160 }}
        />
        <ImageDropzone
          imageName={image?.name ?? null}
          onImage={(dataUrl, name) => setImage({ dataUrl, name })}
          onRemove={() => setImage(null)}
        />
        <p style={{ fontSize: 12, color: 'var(--text-3)', margin: '6px 0' }}>{t('designvalidator.privacyNote')}</p>

        {image && vision === 'no' && (
          <div className="error-banner" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span>{t('designvalidator.needVision', { model })}</span>
            {onSwitchToVisionModel && (
              <button type="button" className="btn-ghost" onClick={onSwitchToVisionModel}>
                {t('designvalidator.switchToVision')}
              </button>
            )}
          </div>
        )}
        {image && vision === 'unknown' && (
          <p style={{ fontSize: 12, color: 'var(--text-2)' }}>{t('designvalidator.unknownVision')}</p>
        )}

        <div className="actions-bar">
          <GenerateButton
            onClick={handleGenerate}
            disabled={!canGenerate || isStreaming}
            loading={loading || isStreaming}
          />
          <button type="button" className="btn-ghost" onClick={handleClear} disabled={!criteria && !image && !report}>
            {t('common.clear')}
          </button>
        </div>

        {report && (
          <div className="output-section" style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 20 }}>
            <section>
              <h3>{t('designvalidator.gaps')} ({report.carencias.length})</h3>
              {report.carencias.length === 0 ? <p className="empty-note">{t('designvalidator.noFindings')}</p> : (
                <div className="data-table-wrap">
                  <table className="data-table">
                    <thead><tr><th>{t('designvalidator.colFlow')}</th><th>{t('designvalidator.colDescription')}</th></tr></thead>
                    <tbody>
                      {report.carencias.map((c, i) => (
                        <tr key={i}><td>{c.flujo}</td><td>{c.descripcion}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
            <section>
              <h3>{t('designvalidator.contradictions')} ({report.contradicciones.length})</h3>
              {report.contradicciones.length === 0 ? <p className="empty-note">{t('designvalidator.noFindings')}</p> : (
                <div className="data-table-wrap">
                  <table className="data-table">
                    <thead><tr><th>{t('designvalidator.colCriterion')}</th><th>{t('designvalidator.colEvidence')}</th><th>{t('designvalidator.colDescription')}</th></tr></thead>
                    <tbody>
                      {report.contradicciones.map((c, i) => (
                        <tr key={i}><td>{c.criterio}</td><td>{c.evidenciaDiseno}</td><td>{c.descripcion}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
            <section>
              <h3>{t('designvalidator.suggestions')} ({report.sugerencias.length})</h3>
              {report.sugerencias.length === 0 ? <p className="empty-note">{t('designvalidator.noFindings')}</p> : (
                report.sugerencias.map((s, i) => (
                  <div key={i} className="suggestion-card" style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12, marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                      <strong>{s.titulo}</strong>
                      <button type="button" className="btn-ghost" style={{ fontSize: 12 }} onClick={() => copySuggestion(s)}>
                        {t('common.copy')}
                      </button>
                    </div>
                    <p style={{ whiteSpace: 'pre-wrap', margin: '6px 0 0', fontSize: 13 }}>
                      {`Dado ${s.dado}\nCuando ${s.cuando}\nEntonces ${s.entonces}`}
                    </p>
                  </div>
                ))
              )}
            </section>
          </div>
        )}
      </div>
      <ErrorBanner message={error} onDismiss={() => setError(null)} />
      <Toast toast={toast} />
    </div>
  );
}
```

Nota: si `common.copy` no existe en i18n, añadirlo a ambos ficheros (`"common.copy": "Copiar"` / `"Copy"`); comprobar primero.

- [ ] **Step 4: Registro.**
  - `constants.ts:76`: añadir `| 'designvalidator'` al final del union `ViewType`.
  - `App.tsx`: import del componente; añadir `'designvalidator'` a `VALID_VIEWS`; añadir la ruta tras el bloque de `edgecase`:
```tsx
{view === 'designvalidator' && (
  <DesignValidatorTool apiKey={currentApiKey} model={model} provider={provider} profile={profile} baseUrl={currentBaseUrl}
    prefill={prefill?.view === 'designvalidator' ? prefill.text : undefined}
    onSwitchToVisionModel={() => { setProvider('openrouter'); setModel('google/gemini-2.5-flash'); }}
    onSaveArtifact={(input, output) => saveArtifact({ tool: 'designvalidator', input, output })} />
)}
```
  - `Sidebar.tsx` TOOLS, tras la fila de edgecase: `{ view: 'designvalidator' as ViewType, icon: Icon.designvalidator, labelKey: 'sidebar.designvalidator', categoryKey: 'sidebar.refinar' },`
  - `LandingScreen.tsx`: añadir `'designvalidator'` al union del prop `onSelect`; añadir entrada en `tools` tras edgecase: `{ id: 'designvalidator' as const, icon: Icon.designvalidator, titleKey: 'landing.tool.designvalidator', descKey: 'landing.tool.designvalidatorDesc', tag: 'QA' },`
  - `ChainMenu.tsx`: en `CHAIN_RULES.acceptance` añadir `{ view: 'designvalidator', label: 'chain.validateDesign' },`
  - `Icons.tsx`, dentro del objeto `Icon`:
```tsx
designvalidator: (p: SvgProps) => (
  <Svg {...p}>
    <rect x="3.5" y="5" width="17" height="14" rx="1.5" />
    <circle cx="8.5" cy="9.5" r="1.3" />
    <path d="m3.5 16 4.5-4 3.5 3.2" />
    <path d="m13.5 14.5 2 2 4-4" />
  </Svg>
),
```

- [ ] **Step 5: i18n restante.** es.json (junto a sus hermanas): `"landing.tool.designvalidator": "Validador de Diseño"`, `"landing.tool.designvalidatorDesc": "Audita tus criterios contra una imagen del diseño: carencias, contradicciones y criterios sugeridos"`, `"designvalidator.criteriaPlaceholder": "Pega aquí tus criterios de aceptación existentes..."`, `"designvalidator.privacyNote": "La imagen se envía íntegra a tu proveedor de IA. El modo confidencial no está disponible en este módulo: el anonimizador solo procesa texto."`, `"designvalidator.needVision": "El modelo actual ({model}) no soporta imágenes."`, `"designvalidator.switchToVision": "Cambiar a Gemini 2.5 Flash (OpenRouter)"`, `"designvalidator.unknownVision": "No podemos verificar que este modelo acepte imágenes. Si la petición falla, prueba con OpenRouter."`, `"designvalidator.gaps": "Flujos sin cubrir"`, `"designvalidator.contradictions": "Contradicciones"`, `"designvalidator.suggestions": "Criterios sugeridos"`, `"designvalidator.colFlow": "Flujo"`, `"designvalidator.colDescription": "Descripción"`, `"designvalidator.colCriterion": "Criterio"`, `"designvalidator.colEvidence": "Evidencia en el diseño"`, `"designvalidator.noFindings": "Sin hallazgos en esta categoría"`, `"chain.validateDesign": "Validar contra diseño"`. en.json equivalentes: "Design Validator", "Audit your criteria against a design image: gaps, contradictions and suggested criteria", "Paste your existing acceptance criteria here...", "The image is sent in full to your AI provider. Confidential mode is not available in this module: the anonymizer only processes text.", "The current model ({model}) does not support images.", "Switch to Gemini 2.5 Flash (OpenRouter)", "We cannot verify that this model accepts images. If the request fails, try OpenRouter.", "Uncovered flows", "Contradictions", "Suggested criteria", "Flow", "Description", "Criterion", "Evidence in the design", "No findings in this category", "Validate against design".

- [ ] **Step 6: GREEN + suite + build + commit**

`npm test -- --run src/components/DesignValidatorTool.test.tsx` → PASS (8 tests). `npm test` → verde. `npm run build` → limpio.

```bash
git add src/components/DesignValidatorTool.tsx src/components/DesignValidatorTool.test.tsx src/App.tsx src/config/constants.ts src/components/Sidebar.tsx src/components/LandingScreen.tsx src/components/ChainMenu.tsx src/components/Icons.tsx src/i18n/es.json src/i18n/en.json
git commit -m "feat(designvalidator): herramienta de validación de criterios contra imagen de diseño"
```

---

### Task 4: Docs sync

**Files:**
- Modify: `AGENTS.md` (tabla de tests con los ficheros nuevos y recuentos reales, total actualizado, recuento i18n actualizado, fila de evolución, sección de arquitectura si lista los tools)
- Modify: `README.md` (badge de tests con el recuento real, lista de herramientas +1 con el Validador de Diseño, nota de que requiere modelo con visión — OpenRouter/custom, Groq no tiene visión hoy)

**Interfaces:** ninguna — solo documentación. Los recuentos se obtienen ejecutando `npm test` y contando con la tabla que imprime vitest, no estimando.

- [ ] **Step 1:** `npm test` y anotar recuentos reales (tests totales, ficheros, claves i18n: contar con `node -e "console.log(Object.keys(require('./src/i18n/es.json')).length)"`).
- [ ] **Step 2:** Actualizar AGENTS.md: filas nuevas en la tabla de tests (designReport.test.ts, image.test.ts, ImageDropzone.test.tsx, DesignValidatorTool.test.tsx) con sus recuentos, total, recuento i18n, y fila de evolución: "Fase 3 productización: Validador de Criterios contra Diseño (multimodal) — ImageDropzone con downscale a 1568px y tope 4MB, informe JSON carencias/contradicciones/sugerencias, gating por supportsVision, imagen nunca persistida; corrige de paso el off-by-one 481→recuento real de la Fase 2".
- [ ] **Step 3:** Actualizar README.md: badge/mención de recuento, herramienta nueva en la lista (11 herramientas), nota de requisito de visión.
- [ ] **Step 4:** `npm test` → verde (staleTranslation/keyParity siguen pasando). Commit:

```bash
git add AGENTS.md README.md
git commit -m "docs: sync tras el Validador de Diseño — recuentos, herramienta nueva y requisito de visión"
```

---

## Verificación final de la fase

1. `npm test` y `npm run build` limpios.
2. Tests clave en verde: envío de `ContentPart[]` correcto, gating de modelo sin visión, aviso 'unknown' con custom, base64 nunca en localStorage, informe inválido → error i18n.
3. Manual (`npm run dev`, requiere API key de OpenRouter): abrir `#/designvalidator`, pegar 2-3 criterios reales, adjuntar una captura de un flujo, generar con gemini-2.5-flash → informe con las 3 secciones; probar pegado con Ctrl+V; probar con Groq activo → aviso + botón de cambio funciona; encadenar desde Criterios ("Validar contra diseño") → el texto llega prefilled.
4. Verificar en DevTools → Application → Local Storage que ninguna clave contiene `data:image` tras generar.
