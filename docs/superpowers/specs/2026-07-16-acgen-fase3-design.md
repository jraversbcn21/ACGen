# ACGen v2 Fase 3 — Design Document

> **Date:** 2026-07-16
> **Status:** Approved
> **Parent plan:** `docs/superpowers/plans/2026-07-16-evolucion-acgen-v2.md`

## Overview

Phase 3 adds six strategic capabilities to ACGen: confidential mode (local anonymization), workspaces (artifact grouping), i18n (ES/EN), customizable prompts, PWA (installable + static cache), and multi-provider LLM support.

**Implementation order:** 3.1 → 3.2 → 3.3 → 3.4 → 3.5 → 3.6

**Global constraints (carried forward from Phase 1-2):**
- 100% static deploy (no serverless)
- No data leaves the browser except toward the user's own API key
- All 65 existing tests must keep passing
- Temperature fixed at `0.2` for all LLM calls
- All new components use `Icons.tsx` for SVGs and `App.css` for styles

---

## Task 3.1: Modo Confidencial (Local Anonymizer)

### Motivation
Users paste real data (emails, URLs, ticket IDs) into tool inputs. A local anonymizer replaces sensitive patterns before the text reaches the LLM API, then reverses the substitution on the output — all client-side.

### Decisions
| Decision | Choice |
|---|---|
| Default state | Off (opt-in). Toggle in each tool's input area. |
| Review frequency | Modal opens before every API call when toggle is on. |
| Pattern scope | 7 patterns: emails, URLs, IPs, ticket IDs, phones, internal domains, proper names. |

### New Files

**`src/services/anonymizer.ts`**
- `anonymize(text: string): { text: string; map: Map<string, string> }` — scans text with 7 regex patterns in order, replaces matches with placeholders `[EMAIL_1]`, `[URL_2]`, etc., returns substituted text + reverse map.
- `deanonymize(text: string, map: Map<string, string>): string` — applies reverse map to restore original values.
- Regex patterns, in application order:
  1. Emails: `[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}` → `[EMAIL_N]`
  2. URLs: `https?://[^\s)]+` → `[URL_N]`
  3. IPs: `\b(?:\d{1,3}\.){3}\d{1,3}\b` → `[IP_N]`
  4. Ticket IDs: `[A-Z]{2,}-\d{3,}` → `[TICKET_N]`
  5. Phones: `\+?[\d\s()-]{7,}` → `[PHONE_N]`
  6. Internal domains: `@[\w.-]+\.(local\|internal\|corp\|lan)\b` → `[DOMAIN_N]`
  7. Proper names: heuristic — capitalized word after common title prefixes (Sr., Sra., Dr., etc.) in Spanish/English → `[NAME_N]`

**`src/components/AnonymizerReview.tsx`**
- Modal with two-column table: "Original" | "Reemplazo"
- Each replacement row is editable (click to edit the placeholder text)
- "Confirmar y enviar" button + "Cancelar" button

**`src/components/ConfidentialToggle.tsx`**
- Toggle switch + label "Modo confidencial"
- Badge showing count of detected substitutions (e.g., "5 sustituciones")
- Link "Revisar" to manually open the review modal
- Persisted per-tool in localStorage: `acgen_confidential_{view}`

### Modified Files

**`src/services/apiService.ts`**
- `streamWithGroq()` gains optional parameter `anonymizeMap?: Map<string, string>`. If provided: calls `deanonymize()` on each accumulated token chunk before yielding it, so streaming output shows real data progressively.

**All 9 tool components**
- Add `<ConfidentialToggle>` in the actions bar area (below input, above generate button).
- On generate: if toggle is on, call `anonymize(input)`, open `AnonymizerReview` with the map, on confirm send anonymized text via `streamWithGroq({ anonymizeMap })`.

### Flow
```
User types input with real data
  → Clicks "Generar"
  → anonymize() scans input
  → AnonymizerReview modal shows substitution table
  → User reviews, optionally edits substitutions, confirms
  → Anonymized text sent to Groq API
  → Streaming tokens deanonymized in real time
  → User sees output with original data restored
```

---

## Task 3.2: Workspaces / Projects

### Motivation
Users generate many artifacts across 9 tools. Workspaces group related artifacts into named projects, with export/import for sharing and backup.

### Decisions
| Decision | Choice |
|---|---|
| Profile per workspace? | No. Workspaces are pure grouping. Project profile remains global. |
| Default workspace | Auto-created as "Sin nombre" on first generation if none exists. |

### New Files

**`src/types/workspace.ts`**
```ts
export interface Artifact {
  id: string;
  tool: ViewType;
  input: string;
  output: string;
  timestamp: number;
}

export interface Workspace {
  id: string;
  name: string;
  createdAt: number;
  artifacts: Artifact[];
}
```

**`src/hooks/useWorkspace.ts`**
- Wraps `useLocalStorage<Workspace[]>('acgen_workspaces', [])`.
- Exports: `workspaces`, `activeId`, `setActiveId`, `createWorkspace(name)`, `renameWorkspace(id, name)`, `deleteWorkspace(id)`, `addArtifact(id, artifact)`, `exportWorkspace(id): string` (JSON blob), `importWorkspace(json: string)`.
- `addArtifact` generates `crypto.randomUUID()` for artifact ID and `Date.now()` for timestamp.

**`src/components/WorkspacePicker.tsx`**
- Renders in Header, next to model chip.
- Dropdown button showing active workspace name + artifact count badge.
- Dropdown items: list of workspaces (click to switch), "+ Nuevo workspace" at bottom.
- Each item has edit (pencil) and delete (trash) icon buttons.
- Delete shows confirm dialog.
- Export/Import buttons at bottom of dropdown.

### Modified Files

**`src/App.tsx`**
- Add `useWorkspace()` hook, pass `workspaceId` and `onSaveArtifact` to all tool views.

**`src/components/Header.tsx`**
- Accept and render `<WorkspacePicker>`.

**`src/components/Sidebar.tsx`**
- Add "Workspace" section at top showing active workspace name (clickable → opens WorkspacePicker).

**All 9 tool components**
- Call `onSaveArtifact({ tool, input, output, timestamp })` on successful generation completion.

---

## Task 3.3: i18n ES/EN

### Motivation
Full UI internationalization enables English-speaking users. ~200 strings across all components.

### Decisions
| Decision | Choice |
|---|---|
| Coverage | All UI strings (labels, buttons, placeholders, errors, tooltips, tool descriptions). |
| AI prompts | Never translated — always Spanish. |
| Language detection | Browser `navigator.language` on first visit, then localStorage override. |
| Default language | Spanish (current behavior, no breakage). |

### New Files

**`src/i18n/es.json`**
- ~200 keys. Spanish strings extracted from current components.
- Namespaced: `common.*`, `header.*`, `sidebar.*`, `landing.*`, `acceptance.*`, `testcase.*`, `bugreport.*`, `testdata.*`, `sprinttracker.*`, `userstory.*`, `refiner.*`, `edgecase.*`, `converter.*`, `errors.*`.

**`src/i18n/en.json`**
- English translations matching the exact same key structure.

**`src/i18n/I18nContext.tsx`**
```tsx
interface I18nContextValue {
  lang: 'es' | 'en';
  setLang: (l: 'es' | 'en') => void;
}

function useT(): (key: string, params?: Record<string, string>) => string
```
- `useT()` reads `translations[lang][key]`, falls back to `key` if missing.
- Supports `{param}` interpolation for dynamic strings.

### Modified Files

**`src/App.tsx`** — wrap tree in `<I18nProvider>`.

**`src/components/Header.tsx`** — add language toggle "ES | EN" next to theme toggle.

**All components with user-visible strings** (~15 files)
- Migration strategy: extract all strings to `es.json`, then replace hardcoded strings with `t('key')` component by component.
- Order: Header → Sidebar → Landing → tools (one per commit).

---

## Task 3.4: Customizable Prompts

### Motivation
Power users want to tune system prompts per tool without editing source code. Each tool's prompt is editable via a textarea, persisted in localStorage.

### Decisions
| Decision | Choice |
|---|---|
| Granularity | Full prompt per tool. User sees and edits the entire system prompt. |
| Variable support | `{dominio}`, `{tipoProducto}`, `{mercados}`, `{terminologia}`, `{tono}` remain functional in overrides. |

### New Files

**`src/components/PromptEditor.tsx`**
- Panel accessible from Sidebar (gear icon) or inline per tool.
- Dropdown to select which tool's prompt to edit.
- Textarea pre-filled with current prompt (override or default).
- "Restaurar por defecto" button — removes override from localStorage.
- Variable reference: shows `{dominio}`, `{tipoProducto}`, etc. that will be interpolated.

### Modified Files

**`src/services/apiService.ts`**
- New function `getPrompt(tool: string): string` — checks `localStorage.getItem('acgen_prompt_{tool}')`, returns override if present, otherwise falls back to `DEFAULT_PROMPTS[tool]`.
- `streamWithGroq()` and `generateWithGroq()` use `getPrompt()` instead of receiving prompts directly.

**`src/config/constants.ts`**
- Export `DEFAULT_PROMPTS: Record<string, string>` map with all 8 prompts: `acceptance`, `testcase`, `bugreport`, `testdata`, `userstory`, `refiner`, `edgecase`, `converter`.

**Tool components**
- Each tool reads its prompt via `getPrompt()` on mount, uses it for generation.
- Optional: "Editar prompt" link in each tool's actions bar opens PromptEditor scoped to that tool.

**`src/components/Sidebar.tsx`**
- Add gear icon item "Prompts" that navigates to PromptEditor panel.

---

## Task 3.5: PWA (Installable + Static Cache)

### Motivation
Installable as a desktop/mobile app with offline access to static assets. No offline API functionality needed since all tools depend on LLM API.

### Decisions
| Decision | Choice |
|---|---|
| Offline depth | Installable + static precache only. No API response caching or offline queue. |
| Icons | Derived from existing app iconography (SVG → PNG), no external design dependency. |

### New Files

**`public/icon-192.png`** — 192x192 app icon
**`public/icon-512.png`** — 512x512 app icon

### Modified Files

**`package.json`**
- Add `vite-plugin-pwa` as devDependency.

**`vite.config.ts`**
```ts
import { VitePWA } from 'vite-plugin-pwa';

plugins: [
  react(),
  VitePWA({
    registerType: 'autoUpdate',
    manifest: {
      name: 'ACGen — Agile Artifact Workbench',
      short_name: 'ACGen',
      theme_color: '#7c3aed',
      background_color: '#ffffff',
      display: 'standalone',
      icons: [
        { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      ],
    },
    workbox: {
      globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
    },
  }),
]
```

**`index.html`**
- Add `<meta name="theme-color" content="#7c3aed">`
- Add `<link rel="apple-touch-icon" href="/icon-192.png">`

---

## Task 3.6: Multi-Proveedor LLM

### Motivation
Users want flexibility beyond Groq. Support OpenRouter (multi-model proxy) and any OpenAI-compatible custom endpoint.

### Decisions
| Decision | Choice |
|---|---|
| Model selection | Predefined lists per provider. Custom provider uses free-text model ID. |
| API keys | Stored separately per provider. Current Groq key auto-migrated. |
| Provider list | Groq, OpenRouter, Custom (OpenAI-compatible). |

### New Files

**`src/config/providers.ts`**
```ts
export interface ProviderConfig {
  id: string;
  name: string;
  baseUrl: string;
  models: string[];
  needsBaseUrl?: boolean; // custom provider
}

export const PROVIDERS: Record<string, ProviderConfig> = {
  groq: {
    id: 'groq',
    name: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1/chat/completions',
    models: [/* AVAILABLE_MODELS */],
  },
  openrouter: {
    id: 'openrouter',
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1/chat/completions',
    models: [
      'openai/gpt-4o', 'anthropic/claude-sonnet-4',
      'google/gemini-2.5-flash', 'meta-llama/llama-4-maverick',
      'deepseek/deepseek-chat-v3', 'qwen/qwen3-235b',
      'mistralai/mistral-large', 'cohere/command-r-plus',
    ],
  },
  custom: {
    id: 'custom',
    name: 'Custom',
    baseUrl: '',
    models: [],
    needsBaseUrl: true,
  },
};
```

**`src/components/ProviderConfig.tsx`**
- Provider dropdown (Groq / OpenRouter / Custom).
- Model selector — content changes based on selected provider.
- Custom: shows base URL text input + model ID text input.
- API key input per provider (shown below model selector).
- Persisted in localStorage: `acgen_provider`, `acgen_key_groq`, `acgen_key_openrouter`, `acgen_key_custom`.

### Modified Files

**`src/services/apiService.ts`**
- `streamWithGroq()` accepts `baseUrl` parameter instead of using hardcoded `API_URL`.
- Rename to `streamWithLLM()` to reflect multi-provider reality (keep old name as deprecated alias for backward compat).

**`src/App.tsx`**
- State: `provider`, `providerApiKey`, `providerBaseUrl` (for custom).
- Pass to all tools instead of just `apiKey`.

**`src/components/Header.tsx`**
- Integrate `<ProviderConfig>` alongside existing config (replaces standalone API key input).
- Model badge reflects current provider + model.

**`src/components/LandingScreen.tsx`**
- Config strip updated: ProviderConfig replaces standalone ApiKeyConfig + ModelSelector.

**Migration:** On first load, if `acgen_api_key` exists and `acgen_key_groq` does not, copy the value automatically.

---

## Architecture Summary

```
Phase 3 file changes:
  New: 14 files (anonymizer, deanonymizer, AnonymizerReview, ConfidentialToggle,
                  workspace types, useWorkspace, WorkspacePicker,
                  es.json, en.json, I18nContext,
                  PromptEditor,
                  providers.ts, ProviderConfig,
                  icon-192.png, icon-512.png)
  Modified: ~20 files (App, Header, Sidebar, Landing, apiService, constants,
                        all 9 tool components, vite.config, package.json, index.html)
  Tests: add tests for anonymizer, useWorkspace; existing 65 must keep passing.
```

## Error Handling

- **Anonymizer:** If no patterns match, skip review modal and send directly.
- **Workspaces:** localStorage quota — catch and show toast. Import — validate JSON structure before accepting.
- **i18n:** Missing keys fall back to the key string itself (visible as `common.missing_key` in UI — easy to spot and fix).
- **Prompts:** If override is invalid (empty after trim), fall back to default silently.
- **PWA:** Service worker registration failure is non-fatal — app works without install capability.
- **Multi-provider:** Connection errors surface existing HTTP error handling (401/429/400). Custom base URL validated with HEAD request on save.

## Testing Strategy

| Component | Test scope |
|---|---|
| `anonymizer.ts` | Unit: all 7 patterns, edge cases (no matches, overlapping patterns, unicode), deanonymize round-trip |
| `useWorkspace.ts` | Unit: CRUD operations, quota exceeded, import validation, artifact ordering |
| `I18nContext.tsx` | Unit: `useT()` interpolation, fallback behavior, language switching |
| `providers.ts` | Unit: provider lookup, default model fallback |
| Existing 65 tests | Must pass unchanged after all 6 tasks |
