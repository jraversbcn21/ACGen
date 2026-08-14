# Fase 1 — Perfil v2 / Desacople de prompts — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extraer todo lo específico del proyecto de Jorge (Adyen/tarjetas, Pro/ES, mapa de sitio e-commerce, idioma español fijo) de los prompts a campos configurables del `ProjectProfile`, con defaults que reproducen el comportamiento actual, y crear el editor de perfil que hoy no existe.

**Architecture:** Se extiende el patrón existente `ProjectProfile` → `interpolateProfile()` → prompts con placeholders. 5 campos nuevos con defaults = literales actuales; los prompts por defecto se reescriben con placeholders; la interpolación gana fallback a `DEFAULT_PROFILE` por campo (perfiles guardados antiguos carecen de los campos nuevos). Se crea `ProfileEditor` (modal gemelo de `PromptEditor`) accesible desde el Sidebar. La cadena de overrides de PromptEditor (`acgen_prompt_{tool}`) no se toca.

**Tech Stack:** React 18 + TypeScript, Vitest + React Testing Library, i18n flat es/en con test de paridad.

## Global Constraints

- Directorio de trabajo: `C:\repositorio\ACGen\acgen` (el `.git` vive aquí). Comandos: `npm test` (vitest run), `npm run build`.
- Rama de trabajo: `feature/fase1-perfil-v2` (crear desde `main` antes de la Tarea 1; NUNCA commitear en main).
- **Invariante central de la fase: `interpolateProfile(DEFAULT_PROMPTS[tool], DEFAULT_PROFILE)` debe reproducir los literales de hoy** — mismas tarjetas Adyen, mismo `Pro/ES`, mismo mapa de sitio, mismo español. La conducta del usuario actual no cambia en nada.
- Placeholders nuevos (siempre en español, coherentes con `{dominio}`/`{tono}`): `{entornos}`, `{mercadoPrincipal}`, `{mapaSitio}`, `{idiomaSalida}`, `{convencionesDatos}`.
- Toda clave i18n nueva se añade a **ambos** `src/i18n/es.json` y `src/i18n/en.json` (el test `keyParity.test.ts` rompe si no).
- Mensajes de commit en el estilo del repo: `feat(profile): …` / `test(profile): …` en español.
- Los tests existentes que se toquen se reescriben, no se borran; el resto de la suite (~469 tests) debe seguir verde en cada commit.

---

### Task 1: ProjectProfile v2 + normalización + interpolación con fallback

**Files:**
- Modify: `src/types/context.ts`
- Modify: `src/components/ContextProfile.tsx`
- Modify: `src/services/apiService.ts:16-23`
- Create: `src/components/ContextProfile.test.ts`
- Modify: `src/services/apiService.test.ts` (añadir describe block; no tocar lo existente)

**Interfaces:**
- Consumes: nada de tareas previas.
- Produces: `ProjectProfile` con los campos nuevos `environments`, `mainMarket`, `siteMap`, `outputLanguage`, `testDataConventions` (todos `string`); `DEFAULT_PROFILE` con los defaults exactos de abajo; `interpolateProfile(prompt, profile)` que sustituye los 10 placeholders con fallback a `DEFAULT_PROFILE` cuando el campo está vacío/ausente; `useProfile()` que devuelve el perfil guardado **fusionado** sobre `DEFAULT_PROFILE`.

- [ ] **Step 1: Escribir los tests que fallan** — `src/components/ContextProfile.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useProfile } from './ContextProfile';
import { DEFAULT_PROFILE } from '../types/context';

describe('useProfile', () => {
  beforeEach(() => localStorage.clear());

  it('devuelve DEFAULT_PROFILE cuando no hay nada guardado', () => {
    const { result } = renderHook(() => useProfile());
    expect(result.current[0]).toEqual(DEFAULT_PROFILE);
  });

  it('fusiona un perfil guardado antiguo (sin campos nuevos) sobre los defaults', () => {
    // Perfil guardado antes de la Fase 1: solo los 5 campos originales
    localStorage.setItem('acgen_project_profile', JSON.stringify({
      domain: 'Banca digital', productType: 'Web', markets: 'LATAM',
      terminology: 'cuentas, transferencias', tone: 'Formal',
    }));
    const { result } = renderHook(() => useProfile());
    expect(result.current[0].domain).toBe('Banca digital');
    expect(result.current[0].environments).toBe(DEFAULT_PROFILE.environments);
    expect(result.current[0].testDataConventions).toBe(DEFAULT_PROFILE.testDataConventions);
  });

  it('persiste los campos nuevos al guardar', () => {
    const { result } = renderHook(() => useProfile());
    act(() => result.current[1]({ ...result.current[0], environments: 'Staging' }));
    const stored = JSON.parse(localStorage.getItem('acgen_project_profile')!);
    expect(stored.environments).toBe('Staging');
  });
});
```

Y en `src/services/apiService.test.ts`, añadir al final del fichero:

```ts
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

  it('un campo vacío cae al valor de DEFAULT_PROFILE', () => {
    const out = interpolateProfile('X {entornos} Y', { ...DEFAULT_PROFILE, environments: '' });
    expect(out).toBe('X Pro Y');
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
```

(Imports necesarios en apiService.test.ts si no están: `interpolateProfile` desde `./apiService`, `DEFAULT_PROFILE` y tipo `ProjectProfile` desde `../types/context`, `DEFAULT_PROMPTS` desde `../config/constants`.)

- [ ] **Step 2: Ejecutar y verificar que fallan**

Run: `npm test -- --run src/components/ContextProfile.test.ts src/services/apiService.test.ts`
Expected: FAIL — `environments` no existe en el tipo / placeholders sin sustituir.

- [ ] **Step 3: Implementar `src/types/context.ts`** — sustituir el fichero completo por:

```ts
export interface ProjectProfile {
  domain: string;
  productType: string;
  markets: string;
  terminology: string;
  tone: string;
  /** Nombre del entorno donde se valida (ej. "Pro", "UAT", "Staging"). */
  environments: string;
  /** Código del mercado principal usado en bug reports (ej. "ES"). */
  mainMarket: string;
  /** Áreas/páginas del producto, separadas por comas, para casos de prueba. */
  siteMap: string;
  /** Idioma en el que el LLM redacta los artefactos. */
  outputLanguage: string;
  /** Convenciones de datos de prueba (tarjetas del PSP, emails QA, passwords...). */
  testDataConventions: string;
}

export const DEFAULT_PROFILE: ProjectProfile = {
  domain: 'Ecommerce de moda multi-mercado',
  productType: 'Web + Apps nativas (Android APK, iOS IPA)',
  markets: 'Europa (ES, PT, FR, IT, DE, UK, etc.)',
  terminology: 'productos, SKUs, tallas, checkout, pasarela de pago, cupones',
  tone: 'Profesional y estructurado',
  environments: 'Pro',
  mainMarket: 'ES',
  siteMap: 'Home, Footer, Menú/Navegación, Buscador, Parrillas de productos, Filtros, PDP (Detalle de Producto), Cesta y Checkout',
  outputLanguage: 'español',
  testDataConventions: `5. Para tarjetas de pago, usa EXCLUSIVAMENTE números de tarjeta de prueba estándar de Adyen (el PSP utilizado):
   - Visa: 4111 1111 1111 1111
   - Mastercard: 5500 0000 0000 0004
   - Amex: 3700 0000 0000 002
   - Usar fecha de expiración futura (03/2030) y CVV genérico (737 para Amex, 123 para el resto)
   - Variar el tipo de tarjeta entre registros
6. Para cupones/códigos promocionales, genera códigos con formato realista (WELCOME10, SUMMER2026, FREESHIP, MODA20, etc.) e indica tipo (porcentaje, monto fijo, envío gratis), valor, y condiciones de uso.
7. Los códigos postales, formatos de teléfono y formatos de dirección DEBEN ser válidos para el país seleccionado.
8. Para datos de tipo "user-registration": los emails DEBEN seguir este formato: un nombre corto y común del país en minúsculas (sin apellidos, sin números, sin puntos, sin guiones) seguido de un dominio de prueba QA. Rota los dominios en este orden: @qa, @qa1, @qa2, @qa.1, @qa.2, @qa.3, @qa.4, etc. Ejemplos: maria@qa, jean@qa1, luca@qa2, anna@qa.1, pedro@qa.2.
9. Para datos de tipo "user-registration": la contraseña SIEMPRE debe ser exactamente "Test1234" para TODOS los registros generados. Sin excepciones ni variaciones.`,
};
```

**CRÍTICO:** el valor de `testDataConventions` debe ser byte-idéntico a las reglas 5-9 actuales de `TEST_DATA_PROMPT` (`src/config/constants.ts:336-345`) — cópialo del fichero fuente, no de este plan, y respeta la indentación interna (3 espacios antes de los guiones).

- [ ] **Step 4: Implementar la fusión en `src/components/ContextProfile.tsx`** — sustituir el fichero por:

```ts
import { useLocalStorage } from '../hooks/useLocalStorage';
import { ProjectProfile, DEFAULT_PROFILE } from '../types/context';

export function useProfile(): [ProjectProfile, (value: ProjectProfile) => void] {
  const [stored, setStored] = useLocalStorage<ProjectProfile>('acgen_project_profile', DEFAULT_PROFILE);
  // Perfiles guardados antes de la Fase 1 carecen de los campos nuevos: fusionar sobre defaults.
  return [{ ...DEFAULT_PROFILE, ...stored }, setStored];
}
```

- [ ] **Step 5: Implementar `interpolateProfile` v2 en `src/services/apiService.ts:16-23`** — sustituir la función por:

```ts
export function interpolateProfile(prompt: string, profile: ProjectProfile): string {
  const p = (key: keyof ProjectProfile): string => {
    const value = profile[key];
    return value && value.trim() ? value : DEFAULT_PROFILE[key];
  };
  return prompt
    .replace(/\{dominio\}/g, p('domain'))
    .replace(/\{tipoProducto\}/g, p('productType'))
    .replace(/\{mercados\}/g, p('markets'))
    .replace(/\{terminologia\}/g, p('terminology'))
    .replace(/\{tono\}/g, p('tone'))
    .replace(/\{entornos\}/g, p('environments'))
    .replace(/\{mercadoPrincipal\}/g, p('mainMarket'))
    .replace(/\{mapaSitio\}/g, p('siteMap'))
    .replace(/\{idiomaSalida\}/g, p('outputLanguage'))
    .replace(/\{convencionesDatos\}/g, p('testDataConventions'));
}
```

Añadir `DEFAULT_PROFILE` al import existente de `../types/context` (línea 4): `import { DEFAULT_PROFILE, type ProjectProfile } from '../types/context';`

- [ ] **Step 6: Ejecutar los tests nuevos y verificar que pasan**

Run: `npm test -- --run src/components/ContextProfile.test.ts src/services/apiService.test.ts`
Expected: PASS (el test "ningún placeholder queda sin sustituir" pasa ya porque los prompts aún no tienen placeholders nuevos — se vuelve significativo en la Tarea 2).

- [ ] **Step 7: Suite completa y commit**

Run: `npm test`
Expected: todo verde (los tests existentes de `interpolateProfile`, si los hay, siguen pasando: la conducta con los 5 campos originales no vacíos es idéntica).

```bash
git add src/types/context.ts src/components/ContextProfile.tsx src/components/ContextProfile.test.ts src/services/apiService.ts src/services/apiService.test.ts
git commit -m "feat(profile): perfil v2 con entornos, mercado, mapa de sitio, idioma y convenciones de datos"
```

---

### Task 2: Reescribir los prompts por defecto con placeholders

**Files:**
- Modify: `src/config/constants.ts` (solo los template literals de prompts)
- Modify: `src/config/promptTemplates.test.ts`

**Interfaces:**
- Consumes: placeholders y defaults de la Tarea 1 (`{entornos}`→'Pro', `{mercadoPrincipal}`→'ES', `{mapaSitio}`, `{idiomaSalida}`→'español', `{convencionesDatos}`).
- Produces: `DEFAULT_PROMPTS` sin literales personales; interpolados con `DEFAULT_PROFILE` reproducen el texto actual.

- [ ] **Step 1: Reescribir `src/config/promptTemplates.test.ts`** — sustituir el fichero completo por:

```ts
import { describe, it, expect } from 'vitest';
import { DEFAULT_PROMPTS } from './constants';
import { DEMO_DATA } from './demoData';
import { interpolateProfile } from '../services/apiService';
import { DEFAULT_PROFILE } from '../types/context';

// Reglas de plantilla de Jorge (2026-07-16) — desde la Fase 1 (2026-08-13) los
// literales del proyecto viven en DEFAULT_PROFILE y los prompts llevan
// placeholders; el perfil por defecto debe reproducir el comportamiento clásico.
describe('prompt templates', () => {
  it('ningún prompt por defecto incluye un nombre de validador', () => {
    for (const [tool, prompt] of Object.entries(DEFAULT_PROMPTS)) {
      expect(prompt, `prompt "${tool}" still names a validator`).not.toContain('Jorge-QA');
    }
  });

  it('ningún demo output incluye un nombre de validador', () => {
    for (const [tool, entry] of Object.entries(DEMO_DATA)) {
      expect(entry.output, `demo "${tool}" still names a validator`).not.toContain('Jorge-QA');
    }
  });

  it('la plantilla de criterios mantiene "Validado por:" como etiqueta vacía', () => {
    expect(DEFAULT_PROMPTS.acceptance).toContain('*Validado por:*');
  });

  it('los prompts por defecto ya no llevan literales del proyecto', () => {
    expect(DEFAULT_PROMPTS.bugreport).not.toContain('Pro/ES');
    expect(DEFAULT_PROMPTS.acceptance).not.toContain('/Pro');
    expect(DEFAULT_PROMPTS.testdata).not.toContain('Adyen');
    expect(DEFAULT_PROMPTS.testdata).not.toContain('Test1234');
    expect(DEFAULT_PROMPTS.testcase).not.toContain('PDP');
  });

  it('interpolar el perfil por defecto reproduce el comportamiento clásico', () => {
    const bugreport = interpolateProfile(DEFAULT_PROMPTS.bugreport, DEFAULT_PROFILE);
    expect(bugreport).toContain('- Entorno/Pais: Pro/ES');
    const acceptance = interpolateProfile(DEFAULT_PROMPTS.acceptance, DEFAULT_PROFILE);
    expect(acceptance).toContain('España/Pro, México/Pro, Francia/Pro');
    const testdata = interpolateProfile(DEFAULT_PROMPTS.testdata, DEFAULT_PROFILE);
    expect(testdata).toContain('4111 1111 1111 1111');
    expect(testdata).toContain('exactamente "Test1234"');
    const testcase = interpolateProfile(DEFAULT_PROMPTS.testcase, DEFAULT_PROFILE);
    expect(testcase).toContain('PDP (Detalle de Producto), Cesta y Checkout');
    expect(testcase).toContain('DEBE estar en español');
  });

  it('el bug report deja Versión y Evidencia vacías', () => {
    expect(DEFAULT_PROMPTS.bugreport).not.toContain('Adjuntar captura');
    expect(DEFAULT_PROMPTS.bugreport).not.toMatch(/- Versión: \S/);
  });
});
```

- [ ] **Step 2: Ejecutar y verificar que fallan los 2 tests nuevos**

Run: `npm test -- --run src/config/promptTemplates.test.ts`
Expected: FAIL en "ya no llevan literales" e "interpolar el perfil por defecto" (los prompts aún tienen los literales).

- [ ] **Step 3: Editar los prompts en `src/config/constants.ts`** — cambios exactos, nada más:

**`HARDCODED_PROMPT`:**
1. Tras el primer párrafo (línea 3), añadir en línea propia separada por línea en blanco: `Contexto del producto: {dominio}.`
2. Línea `*Pais/Entorno:* [País]/Pro` → `*Pais/Entorno:* [País]/{entornos}`
3. Regla: `- En el campo *Pais/Entorno:*, el entorno siempre debe ser "Pro". Formato: [País del contexto]/Pro. Ejemplo: España/Pro, México/Pro, Francia/Pro.` → `- En el campo *Pais/Entorno:*, el entorno siempre debe ser "{entornos}". Formato: [País del contexto]/{entornos}. Ejemplo: España/{entornos}, México/{entornos}, Francia/{entornos}.`

**`TESTCASE_PROMPT`:**
4. `Las áreas del sitio incluyen: Home, Footer, Menú/Navegación, Buscador, Parrillas de productos, Filtros, PDP (Detalle de Producto), Cesta y Checkout.` → `Las áreas del sitio incluyen: {mapaSitio}.`
5. `Todo el contenido generado (summary, preconditions, testSteps, expectedResult) DEBE estar en español.` → `Todo el contenido generado (summary, preconditions, testSteps, expectedResult) DEBE estar en {idiomaSalida}.`

**`TEST_DATA_PROMPT`:**
6. Las reglas 5 a 9 completas (desde `5. Para tarjetas de pago...` hasta `...Sin excepciones ni variaciones.`, líneas 336-345) se sustituyen por una única línea: `{convencionesDatos}`
7. En el esquema de "user-registration": `[{"nombre":"...","apellidos":"...","email":"nombre@qa","password":"Test1234","telefono":"...","fechaNacimiento":"...","genero":"..."}]` → `[{"nombre":"...","apellidos":"...","email":"...","password":"...","telefono":"...","fechaNacimiento":"...","genero":"..."}]`

**`BUG_REPORT_PROMPT`:**
8. `- Multi-mercado europeo con particularidades por país (impuestos, métodos de pago, idiomas, divisas)` → `- Multi-mercado con particularidades por país (impuestos, métodos de pago, idiomas, divisas)`
9. `1. Todo el contenido DEBE estar en ESPAÑOL.` → `1. Todo el contenido DEBE estar en {idiomaSalida}.`
10. Regla 8: `el campo "Entorno/Pais" debe ser siempre exactamente "Pro/ES"` → `el campo "Entorno/Pais" debe ser siempre exactamente "{entornos}/{mercadoPrincipal}"`
11. En el FORMATO DE SALIDA: `- Entorno/Pais: Pro/ES` → `- Entorno/Pais: {entornos}/{mercadoPrincipal}`

**`REFINER_PROMPT`:** 12. `Responde en espanol, estructurado por categorias` → `Responde en {idiomaSalida}, estructurado por categorias`

**`EDGE_CASE_PROMPT`:** 13. `Genera al menos 8 casos limite. Todo en espanol.` → `Genera al menos 8 casos limite. Todo en {idiomaSalida}.`

No tocar: enums de prioridad/tipo del TESTCASE_PROMPT (`Alta/Media/Baja`, `Positivo/Negativo` — ligados a las clases de badges), la regla 1 de TEST_DATA_PROMPT (etiquetas en español — ligadas a `LABEL_MAP` de TestDataTool), formatos de fecha, `USER_STORY_PROMPT` y `CONVERTER_PROMPT` (ya son genéricos con `{dominio}`/`{tono}`).

- [ ] **Step 4: Ejecutar los tests del fichero y verificar que pasan**

Run: `npm test -- --run src/config/promptTemplates.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Suite completa y commit**

Run: `npm test`
Expected: todo verde. Si algún test de demoData u otro asserta literales de prompts, reescribirlo con el mismo criterio (placeholder en el default, literal tras interpolar con DEFAULT_PROFILE) y anotarlo en el reporte.

```bash
git add src/config/constants.ts src/config/promptTemplates.test.ts
git commit -m "feat(prompts): placeholders de perfil en lugar de literales del proyecto (Adyen, Pro/ES, mapa de sitio, idioma)"
```

---

### Task 3: ProfileEditor + Sidebar + i18n + docs

**Files:**
- Create: `src/components/ProfileEditor.tsx`
- Create: `src/components/ProfileEditor.test.tsx`
- Modify: `src/components/Sidebar.tsx` (import, estado, botón en footer, render del modal — espejo exacto de cómo monta `PromptEditor`, líneas 4, 36, 81-84, 88)
- Modify: `src/components/PromptEditor.tsx:78` (línea de variables)
- Modify: `src/i18n/es.json`, `src/i18n/en.json`
- Modify: `AGENTS.md` (tabla de tests + fila de evolución), `README.md` si menciona el perfil

**Interfaces:**
- Consumes: `useProfile()` de la Tarea 1 (`[profile, setProfile]`, ya fusionado con defaults); `DEFAULT_PROFILE`.
- Produces: `ProfileEditor({ onClose })` — modal con los 10 campos, Guardar y Restaurar por defecto.

- [ ] **Step 1: Escribir los tests que fallan** — `src/components/ProfileEditor.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProfileEditor } from './ProfileEditor';
import { I18nProvider } from '../i18n/I18nContext';
import { DEFAULT_PROFILE } from '../types/context';

function renderEditor(onClose = vi.fn()) {
  return render(<I18nProvider><ProfileEditor onClose={onClose} /></I18nProvider>);
}

describe('ProfileEditor', () => {
  beforeEach(() => localStorage.clear());

  it('muestra los valores por defecto del perfil', () => {
    renderEditor();
    expect(screen.getByLabelText(/dominio|domain/i)).toHaveValue(DEFAULT_PROFILE.domain);
    expect(screen.getByLabelText(/entorno/i)).toHaveValue('Pro');
    expect(screen.getByLabelText(/mercado principal|main market/i)).toHaveValue('ES');
  });

  it('guarda los cambios en localStorage', () => {
    renderEditor();
    fireEvent.change(screen.getByLabelText(/entorno/i), { target: { value: 'UAT' } });
    fireEvent.click(screen.getByRole('button', { name: /guardar|save/i }));
    const stored = JSON.parse(localStorage.getItem('acgen_project_profile')!);
    expect(stored.environments).toBe('UAT');
  });

  it('restaurar por defecto repone DEFAULT_PROFILE', () => {
    localStorage.setItem('acgen_project_profile', JSON.stringify({ ...DEFAULT_PROFILE, environments: 'UAT' }));
    renderEditor();
    fireEvent.click(screen.getByRole('button', { name: /restaurar|reset/i }));
    const stored = JSON.parse(localStorage.getItem('acgen_project_profile')!);
    expect(stored.environments).toBe('Pro');
  });

  it('las convenciones de datos se editan en un textarea', () => {
    renderEditor();
    const field = screen.getByLabelText(/convenciones/i);
    expect(field.tagName).toBe('TEXTAREA');
    expect(field).toHaveValue(DEFAULT_PROFILE.testDataConventions);
  });
});
```

Nota: si `I18nProvider` no se exporta con ese nombre, mirar cómo lo montan otros tests de componentes (p. ej. `PromptEditor` no tiene test; `tools.confidential.test.tsx` sí envuelve con el provider) y replicar ese patrón exacto.

- [ ] **Step 2: Ejecutar y verificar que fallan**

Run: `npm test -- --run src/components/ProfileEditor.test.tsx`
Expected: FAIL — el componente no existe.

- [ ] **Step 3: Implementar `src/components/ProfileEditor.tsx`:**

```tsx
import { useState } from 'react';
import { useProfile } from './ContextProfile';
import { DEFAULT_PROFILE, ProjectProfile } from '../types/context';
import { useT } from '../i18n/I18nContext';

const FIELDS: { key: keyof ProjectProfile; labelKey: string; multiline?: boolean }[] = [
  { key: 'domain', labelKey: 'profile.domain' },
  { key: 'productType', labelKey: 'profile.productType' },
  { key: 'markets', labelKey: 'profile.markets' },
  { key: 'terminology', labelKey: 'profile.terminology' },
  { key: 'tone', labelKey: 'profile.tone' },
  { key: 'environments', labelKey: 'profile.environments' },
  { key: 'mainMarket', labelKey: 'profile.mainMarket' },
  { key: 'outputLanguage', labelKey: 'profile.outputLanguage' },
  { key: 'siteMap', labelKey: 'profile.siteMap', multiline: true },
  { key: 'testDataConventions', labelKey: 'profile.testDataConventions', multiline: true },
];

interface ProfileEditorProps {
  onClose: () => void;
}

export function ProfileEditor({ onClose }: ProfileEditorProps) {
  const t = useT();
  const [profile, setProfile] = useProfile();
  const [draft, setDraft] = useState<ProjectProfile>(profile);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setProfile(draft);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    setDraft(DEFAULT_PROFILE);
    setProfile(DEFAULT_PROFILE);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 800, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>{t('profile.title')}</h2>
          <button type="button" className="btn-ghost" onClick={onClose}>{t('common.close')}</button>
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 12 }}>{t('profile.hint')}</p>
        {FIELDS.map(({ key, labelKey, multiline }) => (
          <div key={key} style={{ marginBottom: 12 }}>
            <label htmlFor={`profile-${key}`} style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>
              {t(labelKey)}
            </label>
            {multiline ? (
              <textarea
                id={`profile-${key}`}
                value={draft[key]}
                onChange={(e) => { setDraft({ ...draft, [key]: e.target.value }); setSaved(false); }}
                className="field-textarea"
                style={{ minHeight: 100, fontFamily: 'var(--font-mono)', fontSize: 13 }}
              />
            ) : (
              <input
                id={`profile-${key}`}
                type="text"
                value={draft[key]}
                onChange={(e) => { setDraft({ ...draft, [key]: e.target.value }); setSaved(false); }}
                className="field-input"
              />
            )}
          </div>
        ))}
        <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
          <button type="button" className="btn-ghost" onClick={handleReset}>{t('profile.reset')}</button>
          <button type="button" className="btn-primary" onClick={handleSave}>
            {saved ? t('profile.saved') : t('common.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
```

(Si la clase CSS `field-input` no existe, usar la que empleen los inputs de `BugReportTool` — comprobar y reutilizar, no inventar CSS nuevo.)

- [ ] **Step 4: Claves i18n** — añadir a `src/i18n/es.json` (y equivalentes en `en.json`):

```json
"profile.title": "Perfil del proyecto",
"profile.hint": "Estos valores se inyectan en los prompts de todas las herramientas. Ajústalos a tu producto: dominio, entorno, mercado, idioma y convenciones de datos de prueba.",
"profile.domain": "Dominio / industria",
"profile.productType": "Tipo de producto",
"profile.markets": "Mercados",
"profile.terminology": "Terminología propia",
"profile.tone": "Tono",
"profile.environments": "Entorno de validación",
"profile.mainMarket": "Mercado principal (código)",
"profile.outputLanguage": "Idioma de salida",
"profile.siteMap": "Mapa del sitio / áreas del producto",
"profile.testDataConventions": "Convenciones de datos de prueba",
"profile.reset": "Restaurar por defecto",
"profile.saved": "¡Guardado!",
"sidebar.profile": "Perfil"
```

en.json: "Project profile", "These values are injected into every tool's prompt. Adjust them to your product: domain, environment, market, language and test-data conventions.", "Domain / industry", "Product type", "Markets", "Own terminology", "Tone", "Validation environment", "Main market (code)", "Output language", "Site map / product areas", "Test data conventions", "Reset to defaults", "Saved!", "Profile".

- [ ] **Step 5: Montar en `src/components/Sidebar.tsx`** — espejo del patrón PromptEditor:
  - Import: `import { ProfileEditor } from './ProfileEditor';`
  - Estado: `const [showProfileEditor, setShowProfileEditor] = useState(false);`
  - En el footer, ANTES del botón de Prompts, añadir:
```tsx
<button type="button" className="sidebar-item" onClick={() => setShowProfileEditor(true)}>
  <Icon.userstory size={18} />
  <span>{t('sidebar.profile')}</span>
</button>
```
  (Icono: revisar `Icons.tsx` y elegir uno existente que sugiera "persona/config"; si ninguno encaja mejor, `Icon.userstory` vale. No crear iconos nuevos.)
  - Render: `{showProfileEditor && <ProfileEditor onClose={() => setShowProfileEditor(false)} />}` junto al de PromptEditor.

- [ ] **Step 6: Actualizar `src/components/PromptEditor.tsx:78`** — la línea de variables pasa a:

```tsx
<p style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 8 }}>
  Variables: &#123;dominio&#125;, &#123;tipoProducto&#125;, &#123;mercados&#125;, &#123;terminologia&#125;, &#123;tono&#125;, &#123;entornos&#125;, &#123;mercadoPrincipal&#125;, &#123;mapaSitio&#125;, &#123;idiomaSalida&#125;, &#123;convencionesDatos&#125;
</p>
```

- [ ] **Step 7: Ejecutar tests del componente y suite completa**

Run: `npm test -- --run src/components/ProfileEditor.test.tsx` → PASS
Run: `npm test` → todo verde (incluye `keyParity.test.ts` y `staleTranslation.test.tsx`).
Run: `npm run build` → sin errores de tipos.

- [ ] **Step 8: Sincronizar docs** — en `AGENTS.md`: añadir `ProfileEditor.test.tsx` y `ContextProfile.test.ts` a la tabla de tests con sus recuentos reales, actualizar el total, y añadir fila a la tabla de evolución: "Fase 1 productización: perfil v2 (entornos, mercado, mapa de sitio, idioma, convenciones de datos) + editor de perfil; prompts sin literales del proyecto". En `README.md`: si describe el perfil de contexto o las variables de prompts, actualizar la lista de variables.

- [ ] **Step 9: Commit**

```bash
git add src/components/ProfileEditor.tsx src/components/ProfileEditor.test.tsx src/components/Sidebar.tsx src/components/PromptEditor.tsx src/i18n/es.json src/i18n/en.json AGENTS.md README.md
git commit -m "feat(profile): editor de perfil del proyecto accesible desde el sidebar"
```

---

## Verificación final de la fase

1. `npm test` — suite completa verde; `npm run build` limpio.
2. Invariante: los tests de `promptTemplates.test.ts` demuestran que el perfil por defecto reproduce Adyen/Pro-ES/mapa/español.
3. Manual (`npm run dev`): abrir Perfil desde el sidebar → cambiar "Entorno de validación" a "UAT" y "Mercado principal" a "FR" → generar un bug report → el output debe decir `Entorno/Pais: UAT/FR`. Restaurar por defecto → vuelve a `Pro/ES`.
4. Simular usuario antiguo: en DevTools, `localStorage.setItem('acgen_project_profile', JSON.stringify({domain:'X',productType:'Y',markets:'Z',terminology:'W',tone:'V'}))` → recargar → el editor muestra los defaults en los campos nuevos y generar funciona sin `{placeholders}` sin sustituir.
