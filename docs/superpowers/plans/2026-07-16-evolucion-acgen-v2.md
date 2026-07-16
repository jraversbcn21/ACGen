# ACGen v2 Evolution — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform ACGen from a fashion-ecommerce QA suite into a generic agile-artifact workbench with AI, structural privacy, and a chained-tool pipeline.

**Architecture:** React 18 SPA, Vite 5, TypeScript, Groq API (BYOK), 100% static (no serverless), localStorage persistence. All Jira surface removed. 7 new tools added. Hash routing, streaming, sidebar navigation, configurable project profile.

**Tech Stack:** React 18, TypeScript 5.6, Vite 5, Vitest, Groq OpenAI-compatible API, jsPDF, CSS custom properties (no framework).

## Global Constraints

- Deploy 100% static (no Vercel functions, no `vercel dev`)
- No data leaves the browser except toward the user's own Groq API key
- Existing 87 tests must keep passing
- All existing prompts interpolate project profile instead of hardcoded domain text
- View `'landing'` remains default; hash route not found → landing
- All new components use `Icons.tsx` for icon SVGs and `App.css` for styles
- Temperature fixed at `0.2` for all Groq calls

---

## FASE 1 — Quick Wins (~1 semana)

### Task 1.1: Remove all Jira surface

**Files:**
- Remove: `api/` (entire directory), `vercel.json`, `src/services/jiraService.ts`
- Modify: `package.json`, `src/config/constants.ts`, `src/types/index.ts`, `src/App.tsx`, `src/components/AcceptanceCriteriaTool.tsx`, `src/components/BugReportTool.tsx`, `src/components/TestDataTool.tsx`, `src/services/apiService.ts`, `README.md`, `AGENTS.md`

**Interfaces:**
- Produces: Clean project with no Jira references. `App.tsx` props simplified (no jiraToken/jiraBaseUrl). BugReport tool has textarea "Contexto adicional" instead of Jira URL field.

- [ ] **1.1.1: Delete Jira directories and files**

```bash
Remove-Item -Recurse -Force "acgen\api" -ErrorAction SilentlyContinue
Remove-Item -Force "acgen\vercel.json" -ErrorAction SilentlyContinue
Remove-Item -Force "acgen\src\services\jiraService.ts" -ErrorAction SilentlyContinue
```

- [ ] **1.1.2: Clean package.json — remove dev:all script and jspdf (no longer needed without Jira integration)**

```json
// Remove "dev:all": "vercel dev" line from scripts
```

- [ ] **1.1.3: Clean constants.ts — remove Jira references**

Remove: `JIRA_URL_REGEX`, all Jira-related `STORAGE_KEYS` entries, Jira mentions in prompts. Replace "en Jira" with "estructurado" in prompts.

- [ ] **1.1.4: Clean types/index.ts — remove Jira interfaces**

Remove: `JiraTicketData`, `JiraConfig`, any Jira-related props.

- [ ] **1.1.5: Clean App.tsx — remove Jira state and props**

Remove: `useLocalStorage` for Jira token/URL, all Jira props passed to child components.

- [ ] **1.1.6: Modify AcceptanceCriteriaTool.tsx — remove Jira integration**

Remove: Jira config collapsible, `extractIssueKey` detection, jiraWarning state. Add collapsible textarea "Contexto adicional" below main input.

- [ ] **1.1.7: Modify BugReportTool.tsx — replace Jira URL field with context textarea**

Remove: `.br-compact-field-jira` field. Add `textarea` for "Contexto adicional (pega aqui la descripcion del ticket, notas, etc.)".

- [ ] **1.1.8: Modify TestDataTool.tsx — remove Jira collapsible**

Remove Jira config section and related props.

- [ ] **1.1.9: Modify apiService.ts — remove Jira-dependent logic from generateBugReport**

Remove `jiraContext` parameter from `generateBugReport()`. Keep `additionalContext` from the new textarea.

- [ ] **1.1.10: Run tests and lint**

```bash
npm test
```

Expected: all existing non-Jira tests pass (jiraUtils.test.js and jiraService.test.ts already deleted).

```bash
npm run lint
```

Expected: no errors.

- [ ] **1.1.11: Update README.md**

Remove: "Integracion con Jira" section, `JIRA_ALLOWED_HOSTS` references, `vercel dev` instructions. Update stack table removing "Proxy Jira / Vercel serverless". Update project structure removing `api/`.

- [ ] **1.1.12: Update AGENTS.md**

Remove sections: "Jira serverless functions (Vercel)", "Jira ticket integration", "Known limitation private-network Jira". Remove `api/` from key files and test files lists.

- [ ] **1.1.13: Commit**

```bash
git add -A
git commit -m "feat: remove all Jira surface — 100% static deploy"
```

---

### Task 1.2: Hash routing (`#/herramienta`)

**Files:**
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: Clean project from Task 1.1
- Produces: `navigate(view: ViewType, opts?: { prefill?: string })` callback. Views persist across F5. Browser back/forward work.

- [ ] **1.2.1: Implement hash-based view routing**

Replace `useState<'landing'>('landing')` with hash parsing:

```typescript
const VALID_VIEWS: ViewType[] = ['landing', 'acceptance', 'testcase', 'bugreport', 'testdata', 'sprinttracker'];

function getViewFromHash(): ViewType {
  const hash = window.location.hash.replace('#/', '') || 'landing';
  return VALID_VIEWS.includes(hash as ViewType) ? (hash as ViewType) : 'landing';
}

// In App component:
const [view, setView] = useState<ViewType>(getViewFromHash);

useEffect(() => {
  const onHashChange = () => setView(getViewFromHash());
  window.addEventListener('hashchange', onHashChange);
  return () => window.removeEventListener('hashchange', onHashChange);
}, []);

const navigate = useCallback((v: ViewType) => {
  window.location.hash = `#/${v}`;
}, []);
```

- [ ] **1.2.2: Update all onNavigate/onBack to use navigate**

All components currently call `onNavigate('landing')` — update to use `navigate` via props.

- [ ] **1.2.3: Verify**

```bash
npm run dev
```

Check: F5 preserves view. `/#/testcase` loads directly. Back/forward works.

- [ ] **1.2.4: Commit**

```bash
git add -A
git commit -m "feat: hash routing — deep links, F5, back/forward support"
```

---

### Task 1.3: Demo mode / "Ver ejemplo"

**Files:**
- Create: `src/config/demoData.ts`
- Modify: `src/components/AcceptanceCriteriaTool.tsx`, `src/components/TestCaseTool.tsx`, `src/components/BugReportTool.tsx`, `src/components/TestDataTool.tsx`

**Interfaces:**
- Consumes: Hash routing from Task 1.2
- Produces: Each tool has a "Ver ejemplo" button that fills input + shows pre-generated output without requiring API key. `DEMO_DATA` object with sample inputs/outputs for each tool.

- [ ] **1.3.1: Create demoData.ts with sample data for all tools**

```typescript
// src/config/demoData.ts
export interface DemoEntry {
  input: string;
  output: string;
}

export const DEMO_DATA: Record<string, DemoEntry> = {
  acceptance: {
    input: 'Como usuario registrado, quiero filtrar productos por talla para encontrar solo lo que me queda.',
    output: `{panel:title=Criterios de Aceptacion}\n*Dado* que soy un usuario registrado...`,
  },
  testcase: {
    input: 'Validacion del formulario de registro con email invalido.',
    output: `[{"key":"TC-01","summary":"Registro con email sin @","priority":"High","type":"Negative","preconditions":"...","testSteps":["1. Ingresar email sin @"],"expectedResult":"..."}]`,
  },
  bugreport: {
    input: 'El boton de pago no responde en iOS Safari 17. Pasarela: Adyen. Entorno: Staging.',
    output: `{panel:title=Descripcion}\nEl boton "Pagar" no ejecuta ninguna accion...`,
  },
  testdata: {
    input: '',
    output: `[{"nombre":"Maria","apellidos":"Garcia Lopez","direccion":"Calle Mayor 12","ciudad":"Madrid","codigoPostal":"28013","pais":"ES"}]`,
  },
};
```

- [ ] **1.3.2: Add "Ver ejemplo" button to AcceptanceCriteriaTool**

```tsx
const handleLoadDemo = () => {
  const demo = DEMO_DATA.acceptance;
  setRequirements(demo.input);
  setResult(demo.output);
};
// JSX: button next to Generate
<button className="btn btn-outline" onClick={handleLoadDemo} type="button">Ver ejemplo</button>
```

The button is always visible (no API key required).

- [ ] **1.3.3: Repeat pattern in TestCaseTool, BugReportTool, TestDataTool**

Same `handleLoadDemo` mechanism for each tool.

- [ ] **1.3.4: Commit**

```bash
git add -A
git commit -m "feat: demo mode — 'Ver ejemplo' loads pre-generated output without API key"
```

---

### Task 1.4: Configurable project profile

**Files:**
- Create: `src/types/context.ts`, `src/components/ContextProfile.tsx`
- Modify: `src/config/constants.ts`, `src/services/apiService.ts`, `src/App.tsx`, `src/components/LandingScreen.tsx`

**Interfaces:**
- Consumes: Clean project from Tasks 1.1-1.3
- Produces: `ProjectProfile` type, `DEFAULT_PROFILE`, `useProfile()` hook, `interpolateProfile(prompt, profile)` utility. All prompts use `{dominio}`, `{tipoProducto}`, etc. placeholders. ContextProfile editor in landing config strip.

- [ ] **1.4.1: Define ProjectProfile type and default**

```typescript
// src/types/context.ts
export interface ProjectProfile {
  domain: string;
  productType: string;
  markets: string;
  terminology: string;
  tone: string;
}

export const DEFAULT_PROFILE: ProjectProfile = {
  domain: 'Ecommerce de moda multi-mercado',
  productType: 'Web + Apps nativas (Android APK, iOS IPA)',
  markets: 'Europa (ES, PT, FR, IT, DE, UK, etc.)',
  terminology: 'productos, SKUs, tallas, checkout, pasarela de pago, cupones',
  tone: 'Profesional y estructurado',
};
```

- [ ] **1.4.2: Create hook in ContextProfile.tsx to manage profile in localStorage**

```typescript
// src/components/ContextProfile.tsx
export function useProfile() {
  return useLocalStorage<ProjectProfile>('acgen_project_profile', DEFAULT_PROFILE);
}
```

- [ ] **1.4.3: Create interpolateProfile utility in apiService.ts**

```typescript
export function interpolateProfile(prompt: string, profile: ProjectProfile): string {
  return prompt
    .replace(/\{dominio\}/g, profile.domain)
    .replace(/\{tipoProducto\}/g, profile.productType)
    .replace(/\{mercados\}/g, profile.markets)
    .replace(/\{terminologia\}/g, profile.terminology)
    .replace(/\{tono\}/g, profile.tone);
}
```

- [ ] **1.4.4: Replace hardcoded domain text in all prompts with placeholders**

In `constants.ts`, replace specific domain references:
- `TESTCASE_PROMPT`: "ecommerce de moda" → `{dominio}`
- `BUG_REPORT_PROMPT`: domain-specific text → `{dominio}`, `{tipoProducto}`
- `HARDCODED_PROMPT`: domain text → `{dominio}`
- `TEST_DATA_PROMPT`: "ecommerce de moda" → `{dominio}`, markets → `{mercados}`

- [ ] **1.4.5: Integrate interpolateProfile into generateWithGroq**

Pass `profile` to all generation functions. Call `interpolateProfile` before building the API request body.

- [ ] **1.4.6: Create ContextProfile editor UI**

Collapsible section in LandingScreen config strip with 5 editable fields, "Restaurar por defecto" button.

- [ ] **1.4.7: Commit**

```bash
git add -A
git commit -m "feat: configurable project profile — de-hardcodes domain from all prompts"
```

---

### Task 1.5: UX polish — Ctrl+Enter, Toast with undo

**Files:**
- Create: `src/components/Toast.tsx`
- Modify: `src/components/AcceptanceCriteriaTool.tsx`, `src/components/TestCaseTool.tsx`, `src/components/BugReportTool.tsx`, `src/components/TestDataTool.tsx`, `src/App.css`

**Interfaces:**
- Consumes: All Phase 1 tasks
- Produces: `useToast()` hook and `<Toast>` component. Ctrl+Enter triggers generate in all tools. Clear actions use toast with undo instead of `window.confirm`.

- [ ] **1.5.1: Create Toast component and useToast hook**

```typescript
// src/components/Toast.tsx
import { useState, useEffect, useCallback } from 'react';

interface ToastData {
  message: string;
  undo?: () => void;
}

export function useToast() {
  const [toast, setToast] = useState<ToastData | null>(null);
  const showToast = useCallback((message: string, undo?: () => void) => {
    setToast({ message, undo });
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);
  return { toast, showToast };
}

export function Toast({ toast }: { toast: ToastData | null }) {
  if (!toast) return null;
  return (
    <div className="toast">
      <span>{toast.message}</span>
      {toast.undo && (
        <button className="toast-undo" onClick={toast.undo}>Deshacer</button>
      )}
    </div>
  );
}
```

- [ ] **1.5.2: Add Toast CSS to App.css**

```css
.toast {
  position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
  background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 12px 20px;
  display: flex; align-items: center; gap: 16px;
  box-shadow: var(--shadow-lg); z-index: 1000;
  animation: toastIn 0.2s ease-out;
}
.toast-undo { font-weight: 600; color: var(--accent); background: none; border: none; cursor: pointer; }
@keyframes toastIn {
  from { opacity: 0; transform: translateX(-50%) translateY(12px); }
  to { opacity: 1; transform: translateX(-50%) translateY(0); }
}
```

- [ ] **1.5.3: Add Ctrl+Enter shortcut to AcceptanceCriteriaTool**

```tsx
useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      if (canGenerate) handleGenerate();
    }
  };
  window.addEventListener('keydown', handler);
  return () => window.removeEventListener('keydown', handler);
}, [canGenerate, requirements]);
```

- [ ] **1.5.4: Replace window.confirm with Toast in clear actions**

Before:
```typescript
if (!window.confirm('Limpiar campos?')) return;
setResult(''); setRequirements('');
```
After:
```typescript
const prev = { result, requirements };
setResult(''); setRequirements('');
showToast('Campos limpiados', () => {
  setResult(prev.result); setRequirements(prev.requirements);
});
```

- [ ] **1.5.5: Repeat Ctrl+Enter and Toast in TestCaseTool, BugReportTool, TestDataTool**

Same patterns applied to each tool.

- [ ] **1.5.6: Commit**

```bash
git add -A
git commit -m "feat: Ctrl+Enter shortcut, Toast with undo replaces window.confirm"
```

---

## FASE 2 — Impacto Medio (~3-4 semanas)

### Task 2.1: Streaming responses

**Files:**
- Create: `src/hooks/useStreamingResponse.ts`
- Modify: `src/services/apiService.ts`, `src/components/AcceptanceCriteriaTool.tsx`, `src/components/TestCaseTool.tsx`, `src/components/BugReportTool.tsx`, `src/components/TestDataTool.tsx`

- [ ] **2.1.1: Add streaming generator to apiService.ts**

```typescript
export async function* streamWithGroq(
  systemPrompt: string,
  userMessage: string,
  apiKey: string,
  model: string,
  tool: 'criteria' | 'testcase',
  profile: ProjectProfile
): AsyncGenerator<{ token: string; done: boolean; model?: string }> {
  const interpolatedPrompt = interpolateProfile(systemPrompt, profile);
  const reasoningParams = getReasoningParams(model, tool);
  const body = { model, messages: [{ role: 'system', content: interpolatedPrompt }, { role: 'user', content: userMessage }], temperature: 0.2, stream: true, ...reasoningParams };

  const response = await fetch(`${API_URL}/chat/completions`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` }, body: JSON.stringify(body) });
  if (!response.ok) throw new Error(/* existing error handling */);
  
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (data === '[DONE]') return;
        try {
          const parsed = JSON.parse(data);
          const token = parsed.choices?.[0]?.delta?.content;
          if (token) yield { token, done: false, model: parsed.model };
        } catch {}
      }
    }
  }
  yield { token: '', done: true };
}
```

- [ ] **2.1.2: Create useStreamingResponse hook**

```typescript
// src/hooks/useStreamingResponse.ts
export function useStreamingResponse() {
  const [state, setState] = useState<{ text: string; isStreaming: boolean; error: string | null }>({ text: '', isStreaming: false, error: null });

  const stream = useCallback(async (
    generator: AsyncGenerator<{ token: string; done: boolean }>,
    onComplete?: (fullText: string) => void
  ) => {
    setState({ text: '', isStreaming: true, error: null });
    let full = '';
    try {
      for await (const { token, done } of generator) {
        if (done) break;
        full += token;
        setState(s => ({ ...s, text: full }));
      }
      setState(s => ({ ...s, isStreaming: false }));
      onComplete?.(full);
    } catch (err: any) {
      setState({ text: full, isStreaming: false, error: err.message });
    }
  }, []);

  return { ...state, stream, reset: () => setState({ text: '', isStreaming: false, error: null }) };
}
```

- [ ] **2.1.3: Integrate streaming into AcceptanceCriteriaTool**

Use `useStreamingResponse` hook. Show progressive text in output textarea while `isStreaming`. Parse and validate result on complete.

- [ ] **2.1.4: Repeat in TestCaseTool, BugReportTool, TestDataTool**

- [ ] **2.1.5: Commit**

---

### Task 2.2: New tool — User Story Generator

**Files:**
- Create: `src/components/UserStoryTool.tsx`
- Modify: `src/config/constants.ts`, `src/services/apiService.ts`, `src/App.tsx`, `src/components/Icons.tsx`, `src/components/LandingScreen.tsx`

- [ ] **2.2.1: Add USER_STORY_PROMPT to constants.ts** — Como/Quiero/Para + INVEST checklist evaluation
- [ ] **2.2.2: Add generateUserStory() to apiService.ts**
- [ ] **2.2.3: Create UserStoryTool.tsx** — textarea input + generate button + output with INVEST checklist display
- [ ] **2.2.4: Add to ViewType, App.tsx routing, hash route `#/userstory`**
- [ ] **2.2.5: Add icon to Icons.tsx and entry to LandingScreen**
- [ ] **2.2.6: Commit**

---

### Task 2.3: New tool — Requirement Refiner

- [ ] **2.3.1: Add REFINER_PROMPT** — detects ambiguities, contradictions, missing info, suggests refinement questions
- [ ] **2.3.2: Add generateRefinement() to apiService.ts**
- [ ] **2.3.3: Create RefinerTool.tsx** — input textarea + output categorized with badges per issue type
- [ ] **2.3.4: Integrate into App.tsx, routing, landing, sidebar**
- [ ] **2.3.5: Commit**

---

### Task 2.4: New tool — Edge Cases

- [ ] **2.4.1: Add EDGE_CASE_PROMPT** — boundary values, empty states, concurrency, i18n, permissions
- [ ] **2.4.2: Add generateEdgeCases()** — reuses extractJsonArray() + validation
- [ ] **2.4.3: Create EdgeCaseTool.tsx** — table output (reuses TestCase render pattern)
- [ ] **2.4.4: Integrate into App.tsx, routing, landing, sidebar**
- [ ] **2.4.5: Commit**

---

### Task 2.5: Artifact chaining "Send to..."

**Files:**
- Create: `src/components/ChainMenu.tsx`
- Modify: `src/App.tsx`

- [ ] **2.5.1: Create ChainMenu.tsx** — dropdown with valid destination tools per source view
- [ ] **2.5.2: Add prefill support to App.tsx navigate** — `navigate(view, { prefill: text })` fills destination input
- [ ] **2.5.3: Integrate ChainMenu into output panels of all tools**
- [ ] **2.5.4: Commit**

---

### Task 2.6: Sidebar + Landing Dashboard

**Files:**
- Create: `src/components/Sidebar.tsx`
- Modify: `src/App.tsx`, `src/App.css`, `src/components/LandingScreen.tsx`, `src/components/Header.tsx`, `src/hooks/useHistory.ts`

- [ ] **2.6.1: Create Sidebar.tsx** — icon-based nav grouped by category (Generar/Refinar/Convertir/Seguimiento), collapsible, active highlight
- [ ] **2.6.2: Implement sidebar layout in App.tsx** — `grid: sidebar 220px / main 1fr`. Header stays full-width top.
- [ ] **2.6.3: Redesign LandingScreen as dashboard** — "Continuar donde lo dejaste" section with unified recent history across all tools
- [ ] **2.6.4: Add useUnifiedHistory() to useHistory.ts** — reads all tool history keys, sorts by timestamp
- [ ] **2.6.5: Simplify Header** — remove single "Volver" button; keep logo, model badge, theme toggle
- [ ] **2.6.6: Commit**

---

### Task 2.7: Format Converter tool

- [ ] **2.7.1: Add CONVERTER_PROMPT** — converts between Gherkin, Markdown, Jira wiki, Azure DevOps, plain text
- [ ] **2.7.2: Add generateConversion() to apiService.ts**
- [ ] **2.7.3: Create ConverterTool.tsx** — source format select + input textarea | output textarea + target format select
- [ ] **2.7.4: Integrate into App.tsx, routing, landing, sidebar**
- [ ] **2.7.5: Commit**

---

### Task 2.8: Unified ResultPanel + ExportBar

**Files:**
- Create: `src/components/ResultPanel.tsx`, `src/components/ExportBar.tsx`
- Modify: All 4 existing tool components (refactor)
- Remove: `src/components/HistoryModal.tsx`

- [ ] **2.8.1: Create ResultPanel.tsx** — tabs Resultado/Razonamiento/Historial + embedded ChainMenu
- [ ] **2.8.2: Create ExportBar.tsx** — context-aware export buttons (Copy, Markdown, Jira wiki, PDF, CSV, TSV)
- [ ] **2.8.3: Refactor AcceptanceCriteriaTool** — replace custom output section with ResultPanel
- [ ] **2.8.4: Refactor TestCaseTool, BugReportTool, TestDataTool**
- [ ] **2.8.5: Remove HistoryModal.tsx** — absorbed by ResultPanel's History tab
- [ ] **2.8.6: Commit**

---

## FASE 3 — Estrategicas (~2-3 meses)

### Task 3.1: Confidential mode (local anonymizer)

**Files:**
- Create: `src/services/anonymizer.ts`, `src/services/deanonymizer.ts`, `src/components/AnonymizerReview.tsx`
- Modify: `src/services/apiService.ts`

- [ ] **3.1.1: Create anonymizer** — regex patterns for emails, internal domains, ticket IDs, URLs. Replace with `[EMAIL_1]`, `[ID_1]`, etc.
- [ ] **3.1.2: Create deanonymizer** — reverse substitutions in LLM output
- [ ] **3.1.3: Create AnonymizerReview modal** — shows substitution table pre-send, allows editing
- [ ] **3.1.4: Integrate into generateWithGroq** — anonymize before API call, deanonymize output
- [ ] **3.1.5: Add toggle "Modo confidencial" to each tool's input area**
- [ ] **3.1.6: Commit**

---

### Task 3.2: Workspaces / Projects

**Files:**
- Create: `src/types/workspace.ts`, `src/hooks/useWorkspace.ts`, `src/components/WorkspacePicker.tsx`
- Modify: `src/App.tsx`, each tool component

- [ ] **3.2.1: Define Workspace and Artifact types**
- [ ] **3.2.2: Create useWorkspace hook** — CRUD workspaces + artifacts, localStorage persistence
- [ ] **3.2.3: Create WorkspacePicker in Header/Sidebar** — create/rename/delete/switch workspaces
- [ ] **3.2.4: Save artifacts on each generation** — auto-save to active workspace
- [ ] **3.2.5: Add export/import JSON for workspaces**
- [ ] **3.2.6: Commit**

---

### Task 3.3: i18n ES/EN

**Files:**
- Create: `src/i18n/es.json`, `src/i18n/en.json`, `src/i18n/index.tsx`
- Modify: All components with user-visible strings

- [ ] **3.3.1: Extract all UI strings** — labels, buttons, placeholders, errors, tooltips
- [ ] **3.3.2: Create es.json** — all Spanish strings (~200 keys)
- [ ] **3.3.3: Create en.json** — English translations
- [ ] **3.3.4: Create I18nContext + useT hook**
- [ ] **3.3.5: Add language toggle to Header**
- [ ] **3.3.6: Refactor components batch by batch** — replace hardcoded strings with `t('key')`
- [ ] **3.3.7: Commit**

---

### Task 3.4: Customizable prompts

**Files:**
- Create: `src/components/PromptEditor.tsx`
- Modify: `src/config/constants.ts`, `src/services/apiService.ts`

- [ ] **3.4.1: Add getPrompt() function** — reads override from localStorage, falls back to default
- [ ] **3.4.2: Create PromptEditor component** — textarea per tool, "Restaurar por defecto", variable preview
- [ ] **3.4.3: Modify apiService to use getPrompt()** instead of direct imports
- [ ] **3.4.4: Commit**

---

### Task 3.5: PWA / offline-first

**Files:**
- Create: `public/icon-192.png`, `public/icon-512.png`
- Modify: `vite.config.ts`, `package.json`, `index.html`

- [ ] **3.5.1: Install vite-plugin-pwa**
- [ ] **3.5.2: Configure in vite.config.ts** — manifest (name, theme_color, display: standalone), icons, workbox static caching
- [ ] **3.5.3: Add PWA icons**
- [ ] **3.5.4: Commit**

---

### Task 3.6: Multi-provider LLM

**Files:**
- Create: `src/components/ProviderConfig.tsx`
- Modify: `src/config/constants.ts`, `src/services/apiService.ts`

- [ ] **3.6.1: Add PROVIDERS config** — Groq, OpenRouter, Custom (OpenAI-compatible)
- [ ] **3.6.2: Create ProviderConfig selector** — provider dropdown + custom URL field
- [ ] **3.6.3: Modify generateWithGroq to use selected provider's base URL**
- [ ] **3.6.4: Commit**

---

## Extension (post-F3)

### Analysis of Risks
System prompt: `RISK_ANALYSIS_PROMPT` → probability×impact matrix with mitigations. Tabular output reusing TestCase render. New tool component + ViewType entry.

### Checklists (DoR/DoD/Release)
Editable checklist persisted in localStorage. Sprint Tracker-style grid. New tool component.

### Executive Summaries
Meeting notes → summary + decisions + action items. New tool component.

### Regenerate with feedback
"Regenerate" button + optional "que cambiar" field on each tool's output panel.

### Sprint Tracker mobile card view
Toggle between table (scroll horizontal) and stacked cards in mobile viewport.
