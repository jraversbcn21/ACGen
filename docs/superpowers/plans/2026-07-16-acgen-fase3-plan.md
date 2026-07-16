# ACGen v2 Fase 3 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add six strategic capabilities: local anonymization (confidential mode), workspaces/projects, i18n ES/EN, customizable prompts, PWA installability, and multi-provider LLM support.

**Architecture:** React 18 SPA, Vite 5, TypeScript, Groq API (BYOK). 100% static deploy. All 6 features are additive except i18n which requires touching every component. Features 3.1-3.2 are new files + light wiring. Feature 3.3 is the big refactor. Features 3.4-3.6 are new files + moderate wiring.

**Tech Stack:** React 18, TypeScript 5.6, Vite 5, Vitest, CSS custom properties, vite-plugin-pwa, localStorage persistence.

## Global Constraints

- Deploy 100% static (no Vercel functions, no `vercel dev`)
- No data leaves the browser except toward the user's own API key
- All 65 existing tests must keep passing at each commit
- Temperature fixed at `0.2` for all Groq/LLM calls
- All new components use `Icons.tsx` for icon SVGs and `App.css` for styles
- Prompts remain in Spanish; only UI strings get i18n
- Hash routing (`#/tool`) preserved
- ViewType set extended as needed

---

## File Structure

```
New files (14):
  src/services/anonymizer.ts          — anonymize(), deanonymize(), 7 regex patterns
  src/services/anonymizer.test.ts     — unit tests for all 7 patterns + edge cases
  src/components/AnonymizerReview.tsx — modal showing substitution table
  src/components/ConfidentialToggle.tsx — toggle + badge + review link
  src/types/workspace.ts             — Workspace, Artifact interfaces
  src/hooks/useWorkspace.ts          — CRUD hook for workspaces
  src/hooks/useWorkspace.test.ts     — unit tests for workspace CRUD
  src/components/WorkspacePicker.tsx  — dropdown in Header
  src/i18n/es.json                   — ~200 Spanish UI strings
  src/i18n/en.json                   — ~200 English UI strings
  src/i18n/I18nContext.tsx           — React context + useT() hook
  src/components/PromptEditor.tsx     — per-tool prompt override editor
  src/config/providers.ts            — PROVIDERS config + model lists
  src/config/providers.test.ts       — model lookup tests
  src/components/ProviderConfig.tsx   — provider + model selector
  public/icon-192.png                — PWA icon 192x192
  public/icon-512.png                — PWA icon 512x512

Modified files (20):
  src/services/apiService.ts         — anonymize integration, getPrompt(), baseUrl param
  src/config/constants.ts            — DEFAULT_PROMPTS export map, STORAGE_KEYS additions
  src/App.tsx                        — workspace state, provider state, I18nProvider wrapper
  src/components/Header.tsx          — WorkspacePicker, ProviderConfig, language toggle
  src/components/Sidebar.tsx         — workspace section, prompts link, i18n
  src/components/LandingScreen.tsx   — ProviderConfig replaces ApiKeyConfig+ModelSelector, i18n
  src/components/AcceptanceCriteriaTool.tsx — ConfidentialToggle, save artifact, i18n
  src/components/TestCaseTool.tsx    — ConfidentialToggle, save artifact, i18n
  src/components/BugReportTool.tsx   — ConfidentialToggle, save artifact, i18n
  src/components/TestDataTool.tsx    — ConfidentialToggle, save artifact, i18n
  src/components/UserStoryTool.tsx   — ConfidentialToggle, save artifact, i18n
  src/components/RefinerTool.tsx     — ConfidentialToggle, save artifact, i18n
  src/components/EdgeCaseTool.tsx    — ConfidentialToggle, save artifact, i18n
  src/components/ConverterTool.tsx   — ConfidentialToggle, save artifact, i18n
  src/components/SprintTracker.tsx   — i18n (no confidential/workspace needed, offline)
  src/components/SprintDashboard.tsx — i18n
  src/components/SprintList.tsx      — i18n
  src/components/GenerateButton.tsx  — i18n
  package.json                       — vite-plugin-pwa dependency
  vite.config.ts                     — PWA plugin config
  index.html                         — PWA meta tags
```

---

### Task 3.1.1: Anonymizer service + tests

**Files:**
- Create: `src/services/anonymizer.ts`
- Create: `src/services/anonymizer.test.ts`

**Interfaces:**
- Produces: `anonymize(text: string): { text: string; map: Record<string, string> }`, `deanonymize(text: string, map: Record<string, string>): string`

- [ ] **Step 1: Create anonymizer.ts**

```typescript
// src/services/anonymizer.ts

type SubMap = Record<string, string>; // placeholder -> original

const PATTERNS: { regex: RegExp; prefix: string }[] = [
  { regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, prefix: 'EMAIL' },
  { regex: /https?:\/\/[^\s)]+/g, prefix: 'URL' },
  { regex: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g, prefix: 'IP' },
  { regex: /\b[A-Z]{2,}-\d{3,}\b/g, prefix: 'TICKET' },
  { regex: /\+?[\d\s()-]{7,}/g, prefix: 'PHONE' },
  { regex: /@[\w.-]+\.(?:local|internal|corp|lan)\b/gi, prefix: 'DOMAIN' },
  { regex: /\b(?:Sr|Sra|Dra?|Ing|Lic|Prof)\.\s+[A-ZÁÉÍÓÚÜÑ][a-záéíóúüñ]+\b/g, prefix: 'NAME' },
];

export function anonymize(text: string): { text: string; map: SubMap } {
  const map: SubMap = {};
  const counters: Record<string, number> = {};
  let result = text;

  for (const { regex, prefix } of PATTERNS) {
    result = result.replace(regex, (match) => {
      if (!counters[prefix]) counters[prefix] = 0;
      counters[prefix]++;
      const placeholder = `[${prefix}_${counters[prefix]}]`;
      map[placeholder] = match;
      return placeholder;
    });
  }

  return { text: result, map };
}

export function deanonymize(text: string, map: SubMap): string {
  let result = text;
  for (const [placeholder, original] of Object.entries(map)) {
    result = result.split(placeholder).join(original);
  }
  return result;
}
```

- [ ] **Step 2: Create anonymizer.test.ts**

```typescript
// src/services/anonymizer.test.ts
import { describe, it, expect } from 'vitest';
import { anonymize, deanonymize } from './anonymizer';

describe('anonymize', () => {
  it('replaces emails with [EMAIL_N] placeholders', () => {
    const { text, map } = anonymize('Contacto: jorge@example.com y maria@test.org');
    expect(text).toContain('[EMAIL_1]');
    expect(text).toContain('[EMAIL_2]');
    expect(text).not.toContain('jorge@example.com');
    expect(map['[EMAIL_1]']).toBe('jorge@example.com');
    expect(map['[EMAIL_2]']).toBe('maria@test.org');
  });

  it('replaces URLs with [URL_N] placeholders', () => {
    const { text, map } = anonymize('Visita https://example.com/path?q=1 o http://test.org');
    expect(text).toContain('[URL_1]');
    expect(text).toContain('[URL_2]');
    expect(text).not.toContain('https://example.com');
    expect(map['[URL_1]']).toBe('https://example.com/path?q=1');
    expect(map['[URL_2]']).toBe('http://test.org');
  });

  it('replaces IP addresses with [IP_N] placeholders', () => {
    const { text, map } = anonymize('Servidor en 192.168.1.1 y 10.0.0.255');
    expect(text).toContain('[IP_1]');
    expect(text).toContain('[IP_2]');
    expect(map['[IP_1]']).toBe('192.168.1.1');
    expect(map['[IP_2]']).toBe('10.0.0.255');
  });

  it('replaces ticket IDs with [TICKET_N] placeholders', () => {
    const { text, map } = anonymize('Issues: PROJ-1234 y Z2-5678');
    expect(text).toContain('[TICKET_1]');
    expect(text).toContain('[TICKET_2]');
    expect(map['[TICKET_1]']).toBe('PROJ-1234');
    expect(map['[TICKET_2]']).toBe('Z2-5678');
  });

  it('replaces phone numbers with [PHONE_N] placeholders', () => {
    const { text, map } = anonymize('Llama al +34 612 345 678 o 555-1234');
    expect(text).toContain('[PHONE_1]');
    expect(text).toContain('[PHONE_2]');
  });

  it('replaces internal domains with [DOMAIN_N] placeholders', () => {
    const { text, map } = anonymize('Usuarios: admin@miempresa.corp y soporte@interno.local');
    expect(text).toContain('[DOMAIN_1]');
    expect(text).toContain('[DOMAIN_2]');
  });

  it('replaces proper names with [NAME_N] placeholders', () => {
    const { text, map } = anonymize('Atendido por Sr. Garcia y Dra. Lopez');
    expect(text).toContain('[NAME_1]');
    expect(text).toContain('[NAME_2]');
    expect(map['[NAME_1]']).toBe('Sr. Garcia');
    expect(map['[NAME_2]']).toBe('Dra. Lopez');
  });

  it('returns unchanged text when no patterns match', () => {
    const { text, map } = anonymize('Este es un texto normal sin datos sensibles.');
    expect(text).toBe('Este es un texto normal sin datos sensibles.');
    expect(Object.keys(map)).toHaveLength(0);
  });

  it('handles overlapping patterns correctly (email vs domain)', () => {
    const { text, map } = anonymize('Contacto: admin@corp.local');
    // Email pattern runs first and captures the whole email
    expect(text).toContain('[EMAIL_1]');
    expect(map['[EMAIL_1]']).toBe('admin@corp.local');
    // Domain pattern runs after, but email is already replaced
    expect(text).not.toContain('[DOMAIN');
  });
});

describe('deanonymize', () => {
  it('restores all placeholders to original values', () => {
    const original = 'Email: jorge@example.com, URL: https://test.com, IP: 10.0.0.1';
    const { text, map } = anonymize(original);
    const restored = deanonymize(text, map);
    expect(restored).toBe(original);
  });

  it('returns text unchanged when map is empty', () => {
    const result = deanonymize('Texto sin cambios', {});
    expect(result).toBe('Texto sin cambios');
  });

  it('handles partial restoration (some keys missing from map)', () => {
    const result = deanonymize('Enviar a [EMAIL_1] con copia a [EMAIL_2]', {
      '[EMAIL_1]': 'a@b.com',
    });
    expect(result).toBe('Enviar a a@b.com con copia a [EMAIL_2]');
  });

  it('round-trip: anonymize + deanonymize = identity', () => {
    const input = 'Ticket PROJ-5678: usuario jorge@test.com desde IP 192.168.1.100 en https://jira.internal.corp/browse/PROJ-5678. Tel: +34 600 000 000. Atendido por Sr. Martinez.';
    const { text, map } = anonymize(input);
    const restored = deanonymize(text, map);
    expect(restored).toBe(input);
  });
});
```

- [ ] **Step 3: Run tests to verify they pass**

```bash
cd acgen; npx vitest run src/services/anonymizer.test.ts 2>&1
```

Expected: 12 tests pass.

- [ ] **Step 4: Run full test suite to confirm no regressions**

```bash
cd acgen; npm test 2>&1
```

Expected: 12 + 65 = 77 tests pass.

- [ ] **Step 5: Commit**

```bash
cd acgen; git add -A; git commit -m "feat(confidential): anonymizer service with 7 regex patterns + tests"
```

---

### Task 3.1.2: Anonymizer UI components + API integration

**Files:**
- Create: `src/components/AnonymizerReview.tsx`
- Create: `src/components/ConfidentialToggle.tsx`
- Modify: `src/services/apiService.ts` — `streamWithGroq()` accepts `anonymizeMap`

**Interfaces:**
- Consumes: `anonymize()`, `deanonymize()` from Task 3.1.1
- Produces: `<AnonymizerReview>` modal, `<ConfidentialToggle>` toggle, `streamWithGroq` with `anonymizeMap` param

- [ ] **Step 1: Add anonymization support to streamWithGroq in apiService.ts**

In `src/services/apiService.ts`, modify the `streamWithGroq` signature and streaming loop:

Find:
```typescript
export async function* streamWithGroq(
  apiKey: string,
  model: string,
  userInput: string,
  systemPrompt: string,
  tool: ToolType,
  profile?: ProjectProfile,
): AsyncGenerator<{ token: string; done: boolean; model?: string }> {
```

Replace with:
```typescript
export async function* streamWithGroq(
  apiKey: string,
  model: string,
  userInput: string,
  systemPrompt: string,
  tool: ToolType,
  profile?: ProjectProfile,
  anonymizeMap?: Record<string, string>,
): AsyncGenerator<{ token: string; done: boolean; model?: string }> {
```

In the streaming loop, find:
```typescript
          const token = parsed.choices?.[0]?.delta?.content;
          if (token) yield { token, done: false, model: parsed.model };
```

Replace with:
```typescript
          const rawToken: string | undefined = parsed.choices?.[0]?.delta?.content;
          if (rawToken) {
            const token = anonymizeMap ? deanonymize(rawToken, anonymizeMap) : rawToken;
            yield { token, done: false, model: parsed.model };
          }
```

Add the import (if not already present — add it):
```typescript
import { anonymize, deanonymize } from './anonymizer';
```

Wait — `anonymize` needs to be called by tool components, not in the service. Only `deanonymize` is used in the service. So import only `deanonymize`:
```typescript
import { deanonymize } from './anonymizer';
```

- [ ] **Step 2: Create AnonymizerReview.tsx**

```typescript
// src/components/AnonymizerReview.tsx
import { useState } from 'react';

interface AnonymizerReviewProps {
  map: Record<string, string>;
  onConfirm: (editedMap: Record<string, string>) => void;
  onCancel: () => void;
}

export function AnonymizerReview({ map, onConfirm, onCancel }: AnonymizerReviewProps) {
  const entries = Object.entries(map);
  const [edited, setEdited] = useState<Record<string, string>>({ ...map });

  if (entries.length === 0) {
    onConfirm(map);
    return null;
  }

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640 }}>
        <h2 style={{ margin: '0 0 4px' }}>Revision de datos — Modo Confidencial</h2>
        <p style={{ margin: '0 0 16px', color: 'var(--text-2)', fontSize: 14 }}>
          Se detectaron {entries.length} datos sensibles. Revisa los reemplazos antes de enviar.
        </p>
        <div style={{ maxHeight: 360, overflowY: 'auto', marginBottom: 16 }}>
          <table className="data-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th style={{ width: '40%' }}>Original</th>
                <th style={{ width: '60%' }}>Se enviara como</th>
              </tr>
            </thead>
            <tbody>
              {entries.map(([placeholder, original]) => (
                <tr key={placeholder}>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: 13, wordBreak: 'break-all' }}>{original}</td>
                  <td>
                    <input
                      type="text"
                      value={edited[placeholder] ?? placeholder}
                      onChange={(e) => setEdited(prev => ({ ...prev, [placeholder]: e.target.value }))}
                      className="field-input"
                      style={{ fontFamily: 'var(--font-mono)', fontSize: 13, width: '100%' }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" className="btn-ghost" onClick={onCancel}>Cancelar</button>
          <button type="button" className="btn-primary" onClick={() => onConfirm(edited)}>
            Confirmar y enviar
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create ConfidentialToggle.tsx**

```typescript
// src/components/ConfidentialToggle.tsx
import { useLocalStorage } from '../hooks/useLocalStorage';
import type { ViewType } from '../config/constants';

interface ConfidentialToggleProps {
  view: ViewType;
  substitutionCount: number;
  onReview: () => void;
}

export function ConfidentialToggle({ view, substitutionCount, onReview }: ConfidentialToggleProps) {
  const [enabled, setEnabled] = useLocalStorage(`acgen_confidential_${view}`, false);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13 }}>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          style={{ accentColor: 'var(--accent)' }}
        />
        Modo confidencial
      </label>
      {enabled && substitutionCount > 0 && (
        <button
          type="button"
          className="btn-ghost"
          onClick={onReview}
          style={{ fontSize: 12, padding: '2px 8px' }}
        >
          {substitutionCount} sustituciones — Revisar
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Verify type check and tests**

```bash
cd acgen; npx tsc -b --noEmit 2>&1
```

Expected: no errors.

```bash
cd acgen; npm test 2>&1
```

Expected: all 77 tests pass (65 original + 12 anonymizer).

- [ ] **Step 5: Commit**

```bash
cd acgen; git add -A; git commit -m "feat(confidential): AnonymizerReview modal, ConfidentialToggle, API deanonymization"
```

---

### Task 3.1.3: Wire ConfidentialToggle into all LLM-powered tools

**Files:**
- Modify: `src/components/AcceptanceCriteriaTool.tsx`
- Modify: `src/components/TestCaseTool.tsx`
- Modify: `src/components/BugReportTool.tsx`
- Modify: `src/components/TestDataTool.tsx`
- Modify: `src/components/UserStoryTool.tsx`
- Modify: `src/components/RefinerTool.tsx`
- Modify: `src/components/EdgeCaseTool.tsx`
- Modify: `src/components/ConverterTool.tsx`

**Note:** SprintTracker does NOT use the LLM, so it gets no ConfidentialToggle.

Each tool follows the same pattern. We show AcceptanceCriteriaTool as the canonical example; repeat identically across the other 7 tools.

- [ ] **Step 1: Wire into AcceptanceCriteriaTool.tsx**

In `AcceptanceCriteriaTool.tsx`, add imports:
```typescript
import { anonymize } from '../services/anonymizer';
import { ConfidentialToggle } from './ConfidentialToggle';
import { AnonymizerReview } from './AnonymizerReview';
```

Add state:
```typescript
const [confMap, setConfMap] = useState<Record<string, string> | null>(null);
```

Modify `handleGenerate` to support confidential flow. Find the existing `handleGenerate` and wrap the generation logic:

```typescript
const doGenerate = useCallback(async (effectiveInput: string, effectiveMap?: Record<string, string>) => {
  setLoading(true);
  setResult('');
  try {
    const gen = streamWithGroq(apiKey, model, effectiveInput, prompt, 'criteria', profile, effectiveMap);
    await stream(gen, (fullText) => { setResult(fullText); });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error inesperado. Intenta de nuevo.';
    showToast(message);
  } finally {
    setLoading(false);
    setConfMap(null);
  }
}, [apiKey, model, profile, stream, showToast]);

const handleGenerate = useCallback(async () => {
  if (!canGenerate || loading || isStreaming) return;

  const confEnabled = localStorage.getItem(`acgen_confidential_acceptance`) === 'true';
  if (confEnabled) {
    const { text, map } = anonymize(requirements);
    if (Object.keys(map).length > 0) {
      setConfMap(map);
      return;
    }
    // No patterns matched — proceed directly
    await doGenerate(requirements);
  } else {
    await doGenerate(requirements);
  }
}, [canGenerate, loading, isStreaming, requirements, doGenerate]);
```

In JSX, add ConfidentialToggle in the actions bar area (before GenerateButton). Find the actions bar `<div className="actions-bar">` and add before the GenerateButton:

```tsx
<ConfidentialToggle
  view="acceptance"
  substitutionCount={0}
  onReview={() => {
    const { text, map } = anonymize(requirements);
    setConfMap(map);
  }}
/>
```

Add the AnonymizerReview modal at the end of the component (before the final closing `</div>`):

```tsx
{confMap && (
  <AnonymizerReview
    map={confMap}
    onCancel={() => setConfMap(null)}
    onConfirm={(editedMap) => {
      const { text } = anonymize(requirements);
      doGenerate(text, editedMap);
      setConfMap(null);
    }}
  />
)}
```

- [ ] **Step 2: Repeat the same pattern in TestCaseTool.tsx**

Same imports, same state, same `ConfidentialToggle` (view="testcase"), same `AnonymizerReview` modal. The only difference is the `tool` param is `'testcase'`.

- [ ] **Step 3: Repeat in BugReportTool.tsx**

Same pattern. `view="bugreport"`. BugReport builds a composite user message — apply `anonymize()` to the final assembled user message string.

- [ ] **Step 4: Repeat in TestDataTool.tsx**

Same pattern. `view="testdata"`. Tool is `'testcase'`.

- [ ] **Step 5: Repeat in UserStoryTool.tsx**

Same pattern. `view="userstory"`. Tool is `'criteria'`.

- [ ] **Step 6: Repeat in RefinerTool.tsx**

Same pattern. `view="refiner"`. Tool is `'criteria'`.

- [ ] **Step 7: Repeat in EdgeCaseTool.tsx**

Same pattern. `view="edgecase"`. Tool is `'testcase'`.

- [ ] **Step 8: Repeat in ConverterTool.tsx**

Same pattern. `view="converter"`. Tool is `'criteria'`.

- [ ] **Step 9: Verify type check and all tests**

```bash
cd acgen; npx tsc -b --noEmit 2>&1
```

Expected: no errors.

```bash
cd acgen; npm test 2>&1
```

Expected: all 77 tests pass.

- [ ] **Step 10: Commit**

```bash
cd acgen; git add -A; git commit -m "feat(confidential): wire ConfidentialToggle + review modal into all 8 LLM tools"
```

---

### Task 3.2.1: Workspace types + hook + tests

**Files:**
- Create: `src/types/workspace.ts`
- Create: `src/hooks/useWorkspace.ts`
- Create: `src/hooks/useWorkspace.test.ts`

**Interfaces:**
- Produces: `Workspace`, `Artifact` types, `useWorkspace()` hook returning `{ workspaces, activeId, setActiveId, createWorkspace, renameWorkspace, deleteWorkspace, addArtifact, exportWorkspace, importWorkspace }`

- [ ] **Step 1: Create workspace types**

```typescript
// src/types/workspace.ts
import type { ViewType } from '../config/constants';

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

- [ ] **Step 2: Create useWorkspace hook**

```typescript
// src/hooks/useWorkspace.ts
import { useCallback } from 'react';
import { useLocalStorage } from './useLocalStorage';
import { STORAGE_KEYS } from '../config/constants';
import type { Workspace, Artifact } from '../types/workspace';

export function useWorkspace() {
  const [workspaces, setWorkspaces] = useLocalStorage<Workspace[]>(
    STORAGE_KEYS.WORKSPACES,
    [],
  );
  const [activeId, setActiveId] = useLocalStorage<string | null>(
    STORAGE_KEYS.ACTIVE_WORKSPACE,
    null,
  );

  const createWorkspace = useCallback((name: string) => {
    const ws: Workspace = {
      id: crypto.randomUUID(),
      name,
      createdAt: Date.now(),
      artifacts: [],
    };
    setWorkspaces((prev) => [...prev, ws]);
    setActiveId(ws.id);
    return ws;
  }, [setWorkspaces, setActiveId]);

  const renameWorkspace = useCallback((id: string, name: string) => {
    setWorkspaces((prev) =>
      prev.map((ws) => (ws.id === id ? { ...ws, name } : ws)),
    );
  }, [setWorkspaces]);

  const deleteWorkspace = useCallback((id: string) => {
    setWorkspaces((prev) => prev.filter((ws) => ws.id !== id));
    if (activeId === id) {
      setActiveId(null);
    }
  }, [setWorkspaces, setActiveId, activeId]);

  const addArtifact = useCallback((workspaceId: string, artifact: Omit<Artifact, 'id' | 'timestamp'>) => {
    const newArtifact: Artifact = {
      ...artifact,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
    };
    setWorkspaces((prev) =>
      prev.map((ws) =>
        ws.id === workspaceId
          ? { ...ws, artifacts: [...ws.artifacts, newArtifact].slice(-50) }
          : ws,
      ),
    );
  }, [setWorkspaces]);

  const exportWorkspace = useCallback((id: string): string | null => {
    const ws = workspaces.find((w) => w.id === id);
    if (!ws) return null;
    return JSON.stringify(ws, null, 2);
  }, [workspaces]);

  const importWorkspace = useCallback((json: string) => {
    const parsed: unknown = JSON.parse(json);
    if (!parsed || typeof parsed !== 'object') throw new Error('JSON invalido');
    const ws = parsed as Workspace;
    if (!ws.id || !ws.name || !Array.isArray(ws.artifacts)) {
      throw new Error('Estructura de workspace invalida');
    }
    setWorkspaces((prev) => {
      const exists = prev.find((w) => w.id === ws.id);
      if (exists) {
        return prev.map((w) => (w.id === ws.id ? ws : w));
      }
      return [...prev, ws];
    });
    setActiveId(ws.id);
  }, [setWorkspaces, setActiveId]);

  return {
    workspaces,
    activeId,
    setActiveId,
    createWorkspace,
    renameWorkspace,
    deleteWorkspace,
    addArtifact,
    exportWorkspace,
    importWorkspace,
  };
}
```

Add STORAGE_KEYS entries. In `src/config/constants.ts`, find `STORAGE_KEYS` object and add:

```typescript
  WORKSPACES: 'acgen_workspaces',
  ACTIVE_WORKSPACE: 'acgen_active_workspace',
```

- [ ] **Step 3: Create useWorkspace.test.ts**

```typescript
// src/hooks/useWorkspace.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWorkspace } from './useWorkspace';

describe('useWorkspace', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('starts with empty workspaces and null activeId', () => {
    const { result } = renderHook(() => useWorkspace());
    expect(result.current.workspaces).toEqual([]);
    expect(result.current.activeId).toBeNull();
  });

  it('creates a workspace with a generated id and sets it as active', () => {
    const { result } = renderHook(() => useWorkspace());
    act(() => {
      result.current.createWorkspace('Proyecto Alpha');
    });
    expect(result.current.workspaces).toHaveLength(1);
    expect(result.current.workspaces[0].name).toBe('Proyecto Alpha');
    expect(result.current.workspaces[0].artifacts).toEqual([]);
    expect(result.current.activeId).toBe(result.current.workspaces[0].id);
  });

  it('renames a workspace', () => {
    const { result } = renderHook(() => useWorkspace());
    let wsId: string;
    act(() => {
      const ws = result.current.createWorkspace('Old Name');
      wsId = ws.id;
    });
    act(() => {
      result.current.renameWorkspace(wsId!, 'New Name');
    });
    expect(result.current.workspaces[0].name).toBe('New Name');
  });

  it('deletes a workspace and unsets activeId if it was active', () => {
    const { result } = renderHook(() => useWorkspace());
    let wsId: string;
    act(() => {
      const ws = result.current.createWorkspace('To Delete');
      wsId = ws.id;
    });
    expect(result.current.activeId).toBe(wsId!);
    act(() => {
      result.current.deleteWorkspace(wsId!);
    });
    expect(result.current.workspaces).toHaveLength(0);
    expect(result.current.activeId).toBeNull();
  });

  it('adds an artifact to a workspace', () => {
    const { result } = renderHook(() => useWorkspace());
    let wsId: string;
    act(() => {
      const ws = result.current.createWorkspace('Test');
      wsId = ws.id;
    });
    act(() => {
      result.current.addArtifact(wsId!, {
        tool: 'acceptance',
        input: 'test input',
        output: 'test output',
      });
    });
    expect(result.current.workspaces[0].artifacts).toHaveLength(1);
    expect(result.current.workspaces[0].artifacts[0].tool).toBe('acceptance');
    expect(result.current.workspaces[0].artifacts[0].input).toBe('test input');
    expect(result.current.workspaces[0].artifacts[0].output).toBe('test output');
    expect(typeof result.current.workspaces[0].artifacts[0].id).toBe('string');
    expect(typeof result.current.workspaces[0].artifacts[0].timestamp).toBe('number');
  });

  it('caps artifacts at 50 per workspace', () => {
    const { result } = renderHook(() => useWorkspace());
    let wsId: string;
    act(() => {
      const ws = result.current.createWorkspace('Full');
      wsId = ws.id;
    });
    act(() => {
      for (let i = 0; i < 55; i++) {
        result.current.addArtifact(wsId!, {
          tool: 'acceptance',
          input: `input ${i}`,
          output: `output ${i}`,
        });
      }
    });
    expect(result.current.workspaces[0].artifacts).toHaveLength(50);
  });

  it('exports a workspace as JSON string', () => {
    const { result } = renderHook(() => useWorkspace());
    act(() => {
      result.current.createWorkspace('Export Test');
    });
    const json = result.current.exportWorkspace(result.current.workspaces[0].id);
    expect(json).not.toBeNull();
    const parsed = JSON.parse(json!);
    expect(parsed.name).toBe('Export Test');
  });

  it('returns null when exporting non-existent workspace', () => {
    const { result } = renderHook(() => useWorkspace());
    const json = result.current.exportWorkspace('non-existent');
    expect(json).toBeNull();
  });

  it('imports a workspace from valid JSON', () => {
    const { result } = renderHook(() => useWorkspace());
    const wsJson = JSON.stringify({
      id: 'imported-id',
      name: 'Imported WS',
      createdAt: 1234567890,
      artifacts: [],
    });
    act(() => {
      result.current.importWorkspace(wsJson);
    });
    expect(result.current.workspaces).toHaveLength(1);
    expect(result.current.workspaces[0].name).toBe('Imported WS');
    expect(result.current.activeId).toBe('imported-id');
  });

  it('import overwrites existing workspace with same id', () => {
    const { result } = renderHook(() => useWorkspace());
    const wsJson = JSON.stringify({
      id: 'duplicate-id',
      name: 'First',
      createdAt: 1,
      artifacts: [],
    });
    act(() => {
      result.current.importWorkspace(wsJson);
    });
    const wsJson2 = JSON.stringify({
      id: 'duplicate-id',
      name: 'Second',
      createdAt: 2,
      artifacts: [],
    });
    act(() => {
      result.current.importWorkspace(wsJson2);
    });
    expect(result.current.workspaces).toHaveLength(1);
    expect(result.current.workspaces[0].name).toBe('Second');
  });

  it('throws on invalid import JSON', () => {
    const { result } = renderHook(() => useWorkspace());
    expect(() => {
      act(() => {
        result.current.importWorkspace('not json');
      });
    }).toThrow();
  });

  it('throws on import with missing fields', () => {
    const { result } = renderHook(() => useWorkspace());
    expect(() => {
      act(() => {
        result.current.importWorkspace(JSON.stringify({ id: 'x', name: 'y' }));
      });
    }).toThrow();
  });
});
```

- [ ] **Step 4: Run tests**

```bash
cd acgen; npx vitest run src/hooks/useWorkspace.test.ts 2>&1
```

Expected: 12 tests pass.

```bash
cd acgen; npm test 2>&1
```

Expected: all 77 + 12 = 89 tests pass.

- [ ] **Step 5: Commit**

```bash
cd acgen; git add -A; git commit -m "feat(workspaces): types, useWorkspace hook with CRUD + export/import, 12 tests"
```

---

### Task 3.2.2: WorkspacePicker UI + wire into App

**Files:**
- Create: `src/components/WorkspacePicker.tsx`
- Modify: `src/components/Header.tsx`
- Modify: `src/components/Sidebar.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `useWorkspace()` from Task 3.2.1
- Produces: `<WorkspacePicker>` in Header, workspace name in Sidebar, `workspaceId` and `onSaveArtifact` passed to all tools

- [ ] **Step 1: Create WorkspacePicker.tsx**

```typescript
// src/components/WorkspacePicker.tsx
import { useState, useRef, useEffect } from 'react';
import type { Workspace } from '../types/workspace';

interface WorkspacePickerProps {
  workspaces: Workspace[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onCreate: (name: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onExport: (id: string) => void;
  onImport: (json: string) => void;
}

export function WorkspacePicker({
  workspaces,
  activeId,
  onSelect,
  onCreate,
  onRename,
  onDelete,
  onExport,
  onImport,
}: WorkspacePickerProps) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const activeWorkspace = workspaces.find((w) => w.id === activeId);

  const handleCreate = () => {
    if (newName.trim()) {
      onCreate(newName.trim());
      setNewName('');
      setCreating(false);
    }
  };

  const handleRename = (id: string) => {
    if (editName.trim()) {
      onRename(id, editName.trim());
      setEditingId(null);
    }
  };

  const handleImport = () => {
    fileRef.current?.click();
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        onImport(reader.result as string);
        setOpen(false);
      } catch {
        alert('Archivo JSON invalido.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        className="btn-ghost"
        onClick={() => setOpen((o) => !o)}
        style={{ fontSize: 13 }}
      >
        {activeWorkspace ? activeWorkspace.name : 'Sin workspace'}
        <span style={{ marginLeft: 6, color: 'var(--text-3)' }}>
          {activeWorkspace ? `(${activeWorkspace.artifacts.length})` : ''}
        </span>
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: 4,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            boxShadow: 'var(--shadow-lg)',
            minWidth: 240,
            zIndex: 100,
            padding: 8,
          }}
        >
          {workspaces.map((ws) => (
            <div
              key={ws.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '6px 8px',
                borderRadius: 'var(--radius-sm)',
                background: ws.id === activeId ? 'var(--accent-bg, color-mix(in srgb, var(--accent) 10%, transparent))' : 'transparent',
              }}
            >
              {editingId === ws.id ? (
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleRename(ws.id);
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                  onBlur={() => handleRename(ws.id)}
                  className="field-input"
                  style={{ flex: 1, fontSize: 13 }}
                  autoFocus
                />
              ) : (
                <button
                  type="button"
                  onClick={() => { onSelect(ws.id); setOpen(false); }}
                  style={{
                    flex: 1,
                    textAlign: 'left',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 13,
                    color: 'var(--text)',
                  }}
                >
                  {ws.name}
                  <span style={{ color: 'var(--text-3)', marginLeft: 6 }}>
                    {ws.artifacts.length}
                  </span>
                </button>
              )}
              <button
                type="button"
                onClick={() => { setEditingId(ws.id); setEditName(ws.name); }}
                className="btn-ghost"
                style={{ padding: '2px 4px', fontSize: 12 }}
                title="Renombrar"
              >
                ✎
              </button>
              <button
                type="button"
                onClick={() => { onDelete(ws.id); }}
                className="btn-ghost"
                style={{ padding: '2px 4px', fontSize: 12 }}
                title="Eliminar"
              >
                🗑
              </button>
            </div>
          ))}

          <div style={{ borderTop: '1px solid var(--border)', margin: '4px 0' }} />

          {creating ? (
            <div style={{ padding: '4px 8px', display: 'flex', gap: 4 }}>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreate();
                  if (e.key === 'Escape') setCreating(false);
                }}
                placeholder="Nombre del workspace"
                className="field-input"
                style={{ flex: 1, fontSize: 13 }}
                autoFocus
              />
              <button type="button" className="btn-primary" onClick={handleCreate} style={{ fontSize: 12, padding: '2px 8px' }}>
                Crear
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="btn-ghost"
              style={{ width: '100%', textAlign: 'left', fontSize: 13 }}
            >
              + Nuevo workspace
            </button>
          )}

          <div style={{ display: 'flex', gap: 4, marginTop: 4, padding: '0 8px' }}>
            <button
              type="button"
              className="btn-ghost"
              style={{ flex: 1, fontSize: 12 }}
              onClick={() => {
                if (activeId) {
                  onExport(activeId);
                  setOpen(false);
                }
              }}
              disabled={!activeId}
            >
              Exportar
            </button>
            <button
              type="button"
              className="btn-ghost"
              style={{ flex: 1, fontSize: 12 }}
              onClick={handleImport}
            >
              Importar
            </button>
          </div>
          <input ref={fileRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleFile} />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Integrate WorkspacePicker into Header.tsx**

In `src/components/Header.tsx`, add import:
```typescript
import { WorkspacePicker } from './WorkspacePicker';
import type { Workspace } from '../types/workspace';
```

Add props to the HeaderProps interface:
```typescript
interface HeaderProps {
  model: string;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  onSelectWorkspace: (id: string) => void;
  onCreateWorkspace: (name: string) => void;
  onRenameWorkspace: (id: string, name: string) => void;
  onDeleteWorkspace: (id: string) => void;
  onExportWorkspace: (id: string) => void;
  onImportWorkspace: (json: string) => void;
}
```

Destructure new props and render WorkspacePicker next to the model chip. Find the model badge in Header and add before it:

```tsx
<WorkspacePicker
  workspaces={workspaces}
  activeId={activeWorkspaceId}
  onSelect={onSelectWorkspace}
  onCreate={onCreateWorkspace}
  onRename={onRenameWorkspace}
  onDelete={onDeleteWorkspace}
  onExport={onExportWorkspace}
  onImport={onImportWorkspace}
/>
```

- [ ] **Step 3: Integrate workspace into App.tsx**

In `src/App.tsx`, add import:
```typescript
import { useWorkspace } from './hooks/useWorkspace';
```

Add workspace hook:
```typescript
const workspace = useWorkspace();
```

Pass workspace props to `<Header>`:
```tsx
<Header
  model={model}
  theme={theme}
  onToggleTheme={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
  workspaces={workspace.workspaces}
  activeWorkspaceId={workspace.activeId}
  onSelectWorkspace={workspace.setActiveId}
  onCreateWorkspace={workspace.createWorkspace}
  onRenameWorkspace={workspace.renameWorkspace}
  onDeleteWorkspace={workspace.deleteWorkspace}
  onExportWorkspace={workspace.exportWorkspace}
  onImportWorkspace={workspace.importWorkspace}
/>
```

Auto-create workspace on first artifact save. Add a `saveArtifact` callback that creates a default workspace if none exists:

```typescript
const saveArtifact = useCallback((artifact: { tool: ViewType; input: string; output: string }) => {
  let targetId = workspace.activeId;
  if (!targetId) {
    targetId = workspace.createWorkspace('Sin nombre').id;
  }
  workspace.addArtifact(targetId, artifact);
}, [workspace]);
```

Wire auto-save into tool views. For each tool that generates output (all except SprintTracker), pass `onSave` and call it on successful generation. Add after the `{view === 'acceptance' &&` block, inside each tool's props:

For AcceptanceCriteriaTool, add:
```tsx
onSave={(output) => saveArtifact({ tool: 'acceptance', input: currentInput, output })}
```

For TestCaseTool, add similar. And so on for all 8 LLM tools.

Actually, the simpler approach: each tool can call `onSaveArtifact` prop that App passes down. Let me add this cleaner pattern.

Each tool gets a new optional prop `onSaveArtifact?: (input: string, output: string) => void`.

In each tool's `interface Props`, add:
```typescript
onSaveArtifact?: (input: string, output: string) => void;
```

In each tool's `handleGenerate` success path, after setting the result:
```typescript
onSaveArtifact?.(currentInput, fullText);
```

In App.tsx, pass the callback to each tool:
```tsx
onSaveArtifact={(input, output) => saveArtifact({ tool: 'acceptance', input, output })}
```

- [ ] **Step 4: Add workspace section to Sidebar.tsx**

In `src/components/Sidebar.tsx`, add import:
```typescript
import type { Workspace } from '../types/workspace';
```

Add props:
```typescript
activeWorkspaceName: string;
onWorkspaceClick: () => void;
```

Render at the top of the sidebar (before the tool items list):
```tsx
{activeWorkspaceName && (
  <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', marginBottom: 8 }}>
    <button
      type="button"
      onClick={onWorkspaceClick}
      className="btn-ghost"
      style={{ fontSize: 12, width: '100%', textAlign: 'left', color: 'var(--text-2)' }}
    >
      WS: {activeWorkspaceName}
    </button>
  </div>
)}
```

In App.tsx, pass the new sidebar props:
```tsx
<Sidebar
  activeView={view}
  onNavigate={(v) => navigate(v)}
  activeWorkspaceName={workspace.workspaces.find(w => w.id === workspace.activeId)?.name ?? ''}
  onWorkspaceClick={() => document.querySelector<HTMLButtonElement>('.workspace-picker-btn')?.click()}
/>
```

- [ ] **Step 5: Verify type check and all tests**

```bash
cd acgen; npx tsc -b --noEmit 2>&1
```

Expected: no errors.

```bash
cd acgen; npm test 2>&1
```

Expected: all 89 tests pass.

- [ ] **Step 6: Commit**

```bash
cd acgen; git add -A; git commit -m "feat(workspaces): WorkspacePicker UI, Header integration, auto-save artifacts"
```

---

### Task 3.3: i18n ES/EN (consolidated — largest refactor)

**Files:**
- Create: `src/i18n/es.json`
- Create: `src/i18n/en.json`
- Create: `src/i18n/I18nContext.tsx`
- Modify: `src/App.tsx` — wrap in I18nProvider
- Modify: `src/components/Header.tsx` — language toggle
- Modify: `src/components/Sidebar.tsx`
- Modify: `src/components/LandingScreen.tsx`
- Modify: `src/components/AcceptanceCriteriaTool.tsx`
- Modify: `src/components/TestCaseTool.tsx`
- Modify: `src/components/BugReportTool.tsx`
- Modify: `src/components/TestDataTool.tsx`
- Modify: `src/components/SprintTracker.tsx`
- Modify: `src/components/SprintDashboard.tsx`
- Modify: `src/components/SprintList.tsx`
- Modify: `src/components/UserStoryTool.tsx`
- Modify: `src/components/RefinerTool.tsx`
- Modify: `src/components/EdgeCaseTool.tsx`
- Modify: `src/components/ConverterTool.tsx`
- Modify: `src/components/GenerateButton.tsx`
- Modify: `src/components/Toast.tsx`

Given the volume, we split this into sub-steps. First, create the i18n infrastructure and JSON files. Then refactor components one at a time.

- [ ] **Step 1: Create es.json with all current Spanish strings**

This is a data file with ~200 key-value pairs. Write the full file.

```json
{
  "common.generate": "Generar",
  "common.generating": "Generando...",
  "common.clear": "Limpiar",
  "common.cleared": "Campos limpiados",
  "common.undo": "Deshacer",
  "common.copy": "Copiar",
  "common.copied": "Copiado!",
  "common.cancel": "Cancelar",
  "common.confirm": "Confirmar",
  "common.save": "Guardar",
  "common.delete": "Eliminar",
  "common.rename": "Renombrar",
  "common.export": "Exportar",
  "common.import": "Importar",
  "common.back": "Volver",
  "common.close": "Cerrar",
  "common.loading": "Cargando...",
  "common.example": "Ver ejemplo",
  "common.retry": "Reintentar",
  "common.optional": "Opcional",
  "common.required": "Requerido",
  "common.noResults": "Sin resultados",
  "common.search": "Buscar...",
  "common.rows": "filas",

  "header.model": "Modelo",
  "header.language": "Idioma",

  "sidebar.generar": "Generar",
  "sidebar.refinar": "Refinar",
  "sidebar.seguimiento": "Seguimiento",
  "sidebar.convertir": "Convertir",
  "sidebar.criterios": "Criterios",
  "sidebar.testcase": "Casos de Prueba",
  "sidebar.bugreport": "Bug Report",
  "sidebar.testdata": "Datos de Prueba",
  "sidebar.userstory": "Hist. de Usuario",
  "sidebar.refiner": "Refinador",
  "sidebar.edgecase": "Casos Limite",
  "sidebar.converter": "Conversor",
  "sidebar.sprint": "Sprint",

  "landing.hero": "ACGen",
  "landing.subtitle": "Workbench de artefactos agiles con IA",
  "landing.eyebrow": "Quality Assurance",
  "landing.generators": "Generadores",
  "landing.config": "Configuracion",
  "landing.apiKey": "API Key",
  "landing.apiKeyPlaceholder": "gsk_...",
  "landing.model": "Modelo",

  "acceptance.title": "Criterios de Aceptacion",
  "acceptance.inputPlaceholder": "Describe la funcionalidad o el flujo que necesita criterios de aceptacion...",
  "acceptance.loadExample": "Ver ejemplo",
  "acceptance.history": "Historial",
  "acceptance.copyJira": "Copiar como tabla Jira",
  "acceptance.outputPlaceholder": "Los criterios de aceptacion apareceran aqui...",

  "testcase.title": "Casos de Prueba",
  "testcase.inputPlaceholder": "Describe la funcionalidad a probar (ej: 'Validacion del formulario de registro')...",
  "testcase.loadExample": "Ver ejemplo",
  "testcase.quantity": "Cantidad",
  "testcase.exportJira": "Copiar como tabla Jira",
  "testcase.exportPdf": "Descargar PDF",
  "testcase.priority": "Prioridad",
  "testcase.type": "Tipo",
  "testcase.preconditions": "Precondiciones",
  "testcase.testSteps": "Pasos",
  "testcase.expectedResult": "Resultado esperado",
  "testcase.noResults": "No hay casos de prueba generados.",

  "bugreport.title": "Bug Report",
  "bugreport.platform": "Plataforma",
  "bugreport.market": "Mercado",
  "bugreport.description": "Descripcion del bug",
  "bugreport.descriptionPlaceholder": "Describe el bug que encontraste...",
  "bugreport.browser": "Navegador",
  "bugreport.url": "URL",
  "bugreport.appVersion": "Version",
  "bugreport.device": "Dispositivo",
  "bugreport.osVersion": "OS",
  "bugreport.additionalContext": "Contexto adicional",
  "bugreport.additionalContextPlaceholder": "Pega aqui la descripcion del ticket, notas, etc...",
  "bugreport.copy": "Copiar reporte",
  "bugreport.history": "Historial",
  "bugreport.outputPlaceholder": "El bug report aparecera aqui...",

  "testdata.title": "Datos de Prueba",
  "testdata.dataType": "Tipo de dato",
  "testdata.market": "Mercado",
  "testdata.quantity": "Cantidad",
  "testdata.additionalContext": "Contexto adicional",
  "testdata.additionalContextPlaceholder": "Pega aqui informacion adicional para contextualizar los datos...",
  "testdata.loadExample": "Ver ejemplo",
  "testdata.exportCsv": "Descargar CSV",
  "testdata.exportTsv": "Copiar TSV",
  "testdata.noData": "No hay datos generados.",

  "userstory.title": "Historias de Usuario",
  "userstory.inputPlaceholder": "Describe la necesidad o funcionalidad deseada...",
  "userstory.loadExample": "Ver ejemplo",
  "userstory.outputPlaceholder": "La historia de usuario aparecera aqui...",

  "refiner.title": "Refinador de Requisitos",
  "refiner.inputPlaceholder": "Pega el requisito o historia de usuario a refinar...",
  "refiner.outputPlaceholder": "El analisis de refinamiento aparecera aqui...",

  "edgecase.title": "Casos Limite",
  "edgecase.inputPlaceholder": "Describe la funcionalidad para generar casos limite...",
  "edgecase.loadExample": "Ver ejemplo",
  "edgecase.category": "Categoria",
  "edgecase.scenario": "Escenario",
  "edgecase.expectedResult": "Resultado esperado",

  "converter.title": "Conversor de Formatos",
  "converter.inputFormat": "Formato origen",
  "converter.outputFormat": "Formato destino",
  "converter.inputPlaceholder": "Pega el texto a convertir...",
  "converter.outputPlaceholder": "El resultado aparecera aqui...",
  "converter.convert": "Convertir",
  "converter.converting": "Convirtiendo...",

  "sprint.title": "Sprint Tracker",
  "sprint.newSprint": "Nuevo Sprint",
  "sprint.name": "Nombre",
  "sprint.goal": "Objetivo",
  "sprint.startDate": "Inicio",
  "sprint.endDate": "Fin",
  "sprint.archive": "Archivar Sprint",
  "sprint.archived": "Archivados",
  "sprint.active": "Activo",
  "sprint.rowsOf": "de",

  "chain.sendTo": "Enviar a...",
  "chain.acceptance": "Criterios",
  "chain.testcase": "Casos de Prueba",
  "chain.bugreport": "Bug Report",
  "chain.refiner": "Refinador",
  "chain.edgecase": "Casos Limite",

  "confidential.toggle": "Modo confidencial",
  "confidential.review": "sustituciones — Revisar",
  "confidential.title": "Revision de datos — Modo Confidencial",
  "confidential.subtitle": "Se detectaron {count} datos sensibles. Revisa los reemplazos antes de enviar.",
  "confidential.original": "Original",
  "confidential.sentAs": "Se enviara como",
  "confidential.confirmSend": "Confirmar y enviar",

  "error.apiKey": "API Key invalida. Verifica tu clave e intenta de nuevo.",
  "error.rateLimit": "Limite de peticiones alcanzado. Espera unos segundos y vuelve a intentar.",
  "error.modelDecommissioned": "El modelo seleccionado ya no esta disponible. Por favor selecciona otro modelo.",
  "error.unexpected": "Error inesperado. Intenta de nuevo.",
  "error.noContent": "La API no devolvio contenido. Intenta de nuevo.",
  "error.invalidJson": "La respuesta no es JSON valido. Intenta de nuevo.",
  "error.noTestCases": "No se generaron casos de prueba. Intenta con una descripcion mas detallada.",
  "error.noTestData": "No se pudieron generar los datos de prueba. Intenta de nuevo.",
  "error.invalidFormat": "La respuesta no tiene el formato esperado.",
  "error.boundary": "Algo salio mal. Por favor, recarga la pagina o intenta de nuevo.",
  "error.noArray": "La respuesta no contiene un array.",
  "error.noRecognizableFormat": "La respuesta no tiene un formato reconocible.",
  "error.nestedValue": "valor anidado no soportado",
  "error.notObject": "no es un objeto valido",
  "error.missingFields": "no tiene los campos requeridos",
  "error.wrongType": "tiene campos con tipo incorrecto",
  "error.historySave": "No se pudo guardar el historial",
  "error.sprintSave": "No se pudieron guardar los sprints"
}
```

- [ ] **Step 2: Create en.json**

```json
{
  "common.generate": "Generate",
  "common.generating": "Generating...",
  "common.clear": "Clear",
  "common.cleared": "Fields cleared",
  "common.undo": "Undo",
  "common.copy": "Copy",
  "common.copied": "Copied!",
  "common.cancel": "Cancel",
  "common.confirm": "Confirm",
  "common.save": "Save",
  "common.delete": "Delete",
  "common.rename": "Rename",
  "common.export": "Export",
  "common.import": "Import",
  "common.back": "Back",
  "common.close": "Close",
  "common.loading": "Loading...",
  "common.example": "See example",
  "common.retry": "Retry",
  "common.optional": "Optional",
  "common.required": "Required",
  "common.noResults": "No results",
  "common.search": "Search...",
  "common.rows": "rows",

  "header.model": "Model",
  "header.language": "Language",

  "sidebar.generar": "Generate",
  "sidebar.refinar": "Refine",
  "sidebar.seguimiento": "Tracking",
  "sidebar.convertir": "Convert",
  "sidebar.criterios": "Criteria",
  "sidebar.testcase": "Test Cases",
  "sidebar.bugreport": "Bug Report",
  "sidebar.testdata": "Test Data",
  "sidebar.userstory": "User Stories",
  "sidebar.refiner": "Refiner",
  "sidebar.edgecase": "Edge Cases",
  "sidebar.converter": "Converter",
  "sidebar.sprint": "Sprint",

  "landing.hero": "ACGen",
  "landing.subtitle": "AI-powered Agile Artifact Workbench",
  "landing.eyebrow": "Quality Assurance",
  "landing.generators": "Generators",
  "landing.config": "Configuration",
  "landing.apiKey": "API Key",
  "landing.apiKeyPlaceholder": "gsk_...",
  "landing.model": "Model",

  "acceptance.title": "Acceptance Criteria",
  "acceptance.inputPlaceholder": "Describe the functionality or flow that needs acceptance criteria...",
  "acceptance.loadExample": "See example",
  "acceptance.history": "History",
  "acceptance.copyJira": "Copy as Jira table",
  "acceptance.outputPlaceholder": "Acceptance criteria will appear here...",

  "testcase.title": "Test Cases",
  "testcase.inputPlaceholder": "Describe the functionality to test (e.g. 'Registration form validation')...",
  "testcase.loadExample": "See example",
  "testcase.quantity": "Quantity",
  "testcase.exportJira": "Copy as Jira table",
  "testcase.exportPdf": "Download PDF",
  "testcase.priority": "Priority",
  "testcase.type": "Type",
  "testcase.preconditions": "Preconditions",
  "testcase.testSteps": "Steps",
  "testcase.expectedResult": "Expected result",
  "testcase.noResults": "No test cases generated.",

  "bugreport.title": "Bug Report",
  "bugreport.platform": "Platform",
  "bugreport.market": "Market",
  "bugreport.description": "Bug description",
  "bugreport.descriptionPlaceholder": "Describe the bug you found...",
  "bugreport.browser": "Browser",
  "bugreport.url": "URL",
  "bugreport.appVersion": "Version",
  "bugreport.device": "Device",
  "bugreport.osVersion": "OS",
  "bugreport.additionalContext": "Additional context",
  "bugreport.additionalContextPlaceholder": "Paste ticket description, notes, etc. here...",
  "bugreport.copy": "Copy report",
  "bugreport.history": "History",
  "bugreport.outputPlaceholder": "Bug report will appear here...",

  "testdata.title": "Test Data",
  "testdata.dataType": "Data type",
  "testdata.market": "Market",
  "testdata.quantity": "Quantity",
  "testdata.additionalContext": "Additional context",
  "testdata.additionalContextPlaceholder": "Paste additional context here...",
  "testdata.loadExample": "See example",
  "testdata.exportCsv": "Download CSV",
  "testdata.exportTsv": "Copy TSV",
  "testdata.noData": "No data generated.",

  "userstory.title": "User Stories",
  "userstory.inputPlaceholder": "Describe the need or desired functionality...",
  "userstory.loadExample": "See example",
  "userstory.outputPlaceholder": "User story will appear here...",

  "refiner.title": "Requirement Refiner",
  "refiner.inputPlaceholder": "Paste the requirement or user story to refine...",
  "refiner.outputPlaceholder": "Refinement analysis will appear here...",

  "edgecase.title": "Edge Cases",
  "edgecase.inputPlaceholder": "Describe the functionality to generate edge cases for...",
  "edgecase.loadExample": "See example",
  "edgecase.category": "Category",
  "edgecase.scenario": "Scenario",
  "edgecase.expectedResult": "Expected result",

  "converter.title": "Format Converter",
  "converter.inputFormat": "Source format",
  "converter.outputFormat": "Target format",
  "converter.inputPlaceholder": "Paste the text to convert...",
  "converter.outputPlaceholder": "Result will appear here...",
  "converter.convert": "Convert",
  "converter.converting": "Converting...",

  "sprint.title": "Sprint Tracker",
  "sprint.newSprint": "New Sprint",
  "sprint.name": "Name",
  "sprint.goal": "Goal",
  "sprint.startDate": "Start",
  "sprint.endDate": "End",
  "sprint.archive": "Archive Sprint",
  "sprint.archived": "Archived",
  "sprint.active": "Active",
  "sprint.rowsOf": "of",

  "chain.sendTo": "Send to...",
  "chain.acceptance": "Criteria",
  "chain.testcase": "Test Cases",
  "chain.bugreport": "Bug Report",
  "chain.refiner": "Refiner",
  "chain.edgecase": "Edge Cases",

  "confidential.toggle": "Confidential mode",
  "confidential.review": "substitutions — Review",
  "confidential.title": "Data Review — Confidential Mode",
  "confidential.subtitle": "{count} sensitive data items detected. Review replacements before sending.",
  "confidential.original": "Original",
  "confidential.sentAs": "Will be sent as",
  "confidential.confirmSend": "Confirm & send",

  "error.apiKey": "Invalid API key. Verify your key and try again.",
  "error.rateLimit": "Rate limit reached. Wait a few seconds and try again.",
  "error.modelDecommissioned": "The selected model is no longer available. Please select another model.",
  "error.unexpected": "Unexpected error. Try again.",
  "error.noContent": "The API returned no content. Try again.",
  "error.invalidJson": "Response is not valid JSON. Try again.",
  "error.noTestCases": "No test cases were generated. Try a more detailed description.",
  "error.noTestData": "Could not generate test data. Try again.",
  "error.invalidFormat": "Response does not have the expected format.",
  "error.boundary": "Something went wrong. Please reload the page or try again.",
  "error.noArray": "Response does not contain an array.",
  "error.noRecognizableFormat": "Response has no recognizable format.",
  "error.nestedValue": "unsupported nested value",
  "error.notObject": "is not a valid object",
  "error.missingFields": "missing required fields",
  "error.wrongType": "has fields with wrong type",
  "error.historySave": "Could not save history",
  "error.sprintSave": "Could not save sprints"
}
```

- [ ] **Step 3: Create I18nContext.tsx**

```typescript
// src/i18n/I18nContext.tsx
import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import es from './es.json';
import en from './en.json';

type Lang = 'es' | 'en';

interface I18nContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const translations: Record<Lang, Record<string, string>> = { es, en };

const I18nContext = createContext<I18nContextValue | null>(null);

function detectLang(): Lang {
  try {
    const stored = localStorage.getItem('acgen_lang');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed === 'es' || parsed === 'en') return parsed;
    }
  } catch { /* corrupt */ }
  if (typeof navigator !== 'undefined' && navigator.language?.startsWith('en')) {
    return 'en';
  }
  return 'es';
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useLocalStorage<Lang>('acgen_lang', detectLang());

  const t = useCallback((key: string, params?: Record<string, string | number>): string => {
    let str = translations[lang][key] ?? translations['es'][key] ?? key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        str = str.replace(`{${k}}`, String(v));
      }
    }
    return str;
  }, [lang]);

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useT() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useT must be used inside I18nProvider');
  return ctx.t;
}

export function useLang() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useLang must be used inside I18nProvider');
  return { lang: ctx.lang, setLang: ctx.setLang };
}
```

- [ ] **Step 4: Wrap app in I18nProvider (App.tsx)**

In `src/App.tsx`, import:
```typescript
import { I18nProvider } from './i18n/I18nContext';
```

Wrap the return JSX:
```tsx
return (
  <I18nProvider>
    <div className="page">
      ...
    </div>
  </I18nProvider>
);
```

- [ ] **Step 5: Add language toggle to Header.tsx**

In `src/components/Header.tsx`, import:
```typescript
import { useLang } from '../i18n/I18nContext';
```

In the Header component, add:
```typescript
const { lang, setLang } = useLang();
```

Add the toggle button next to the theme toggle. Find the theme toggle button and add beside it:

```tsx
<button
  type="button"
  className="btn-ghost"
  onClick={() => setLang(lang === 'es' ? 'en' : 'es')}
  style={{ fontSize: 12, padding: '2px 8px' }}
  title="Idioma / Language"
>
  {lang === 'es' ? 'EN' : 'ES'}
</button>
```

- [ ] **Step 6: Refactor GenerateButton to use useT()**

In `src/components/GenerateButton.tsx`, import `useT`:
```typescript
import { useT } from '../i18n/I18nContext';
```

In the component:
```typescript
const t = useT();
```

Replace hardcoded text:
```tsx
{t(loading ? 'common.generating' : 'common.generate')}
```

Update the GenerateButton props — remove `label` and `loadingLabel`, compute from `t()`:
```tsx
interface GenerateButtonProps {
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
}
```

And render:
```tsx
<button ...>
  {loading ? t('common.generating') : t('common.generate')}
</button>
```

Update all 8 tools that use `<GenerateButton label="..." loadingLabel="..." />` to use the new prop-less version.

- [ ] **Step 7: Refactor Toast.tsx to use useT()**

In `src/components/Toast.tsx`, the `useToast` hook itself doesn't need i18n — it stores the message string. But where toasts are called (showToast), replace hardcoded strings with `t('...')`.

- [ ] **Step 8: Refactor Sidebar.tsx**

Import `useT`, replace all labels:
```tsx
const t = useT();
```

Replace hardcoded labels like `'Criterios de Aceptacion'` with `t('sidebar.criterios')`, etc.

- [ ] **Step 9: Refactor all 9 tool components + SprintTracker sub-components**

For each tool component:
1. Import `{ useT }` from `'../i18n/I18nContext'`
2. Add `const t = useT();`
3. Replace every hardcoded Spanish string (labels, placeholders, button text, error messages) with `t('key')` calls

This is repetitive but straightforward. Each tool uses ~15-25 t() calls.

- [ ] **Step 10: Verify type check**

```bash
cd acgen; npx tsc -b --noEmit 2>&1
```

Fix any type errors (likely GenerateButton prop changes).

- [ ] **Step 11: Run full test suite**

```bash
cd acgen; npm test 2>&1
```

Expected: all 89 tests pass (no new tests added for i18n — the refactor preserves existing behavior).

- [ ] **Step 12: Commit**

```bash
cd acgen; git add -A; git commit -m "feat(i18n): full ES/EN translation — ~200 keys, I18nContext, useT() hook, language toggle"
```

---

### Task 3.4: Customizable Prompts

**Files:**
- Create: `src/components/PromptEditor.tsx`
- Modify: `src/config/constants.ts` — export `DEFAULT_PROMPTS`
- Modify: `src/services/apiService.ts` — `getPrompt()` function
- Modify: `src/components/Sidebar.tsx` — per-tool "Edit prompt" link
- Modify: All 8 LLM tool components — use `getPrompt()` instead of direct import

- [ ] **Step 1: Export DEFAULT_PROMPTS from constants.ts**

In `src/config/constants.ts`, add at the end of the file:

```typescript
export const DEFAULT_PROMPTS: Record<string, string> = {
  acceptance: HARDCODED_PROMPT,
  testcase: TESTCASE_PROMPT,
  bugreport: BUG_REPORT_PROMPT,
  testdata: TEST_DATA_PROMPT,
  userstory: USER_STORY_PROMPT,
  refiner: REFINER_PROMPT,
  edgecase: EDGE_CASE_PROMPT,
  converter: CONVERTER_PROMPT,
};
```

- [ ] **Step 2: Create getPrompt() in apiService.ts**

In `src/services/apiService.ts`, add:

```typescript
import { DEFAULT_PROMPTS } from '../config/constants';

export function getPrompt(tool: string): string {
  try {
    const key = `acgen_prompt_${tool}`;
    const override = localStorage.getItem(key);
    if (override && override.trim()) return override;
  } catch { /* localStorage unavailable */ }
  return DEFAULT_PROMPTS[tool] ?? '';
}
```

- [ ] **Step 3: Create PromptEditor.tsx**

```typescript
// src/components/PromptEditor.tsx
import { useState } from 'react';
import { DEFAULT_PROMPTS } from '../config/constants';
import { getPrompt } from '../services/apiService';

const TOOLS = [
  { key: 'acceptance', label: 'Criterios de Aceptacion' },
  { key: 'testcase', label: 'Casos de Prueba' },
  { key: 'bugreport', label: 'Bug Report' },
  { key: 'testdata', label: 'Datos de Prueba' },
  { key: 'userstory', label: 'Historias de Usuario' },
  { key: 'refiner', label: 'Refinador' },
  { key: 'edgecase', label: 'Casos Limite' },
  { key: 'converter', label: 'Conversor' },
];

interface PromptEditorProps {
  onClose: () => void;
}

export function PromptEditor({ onClose }: PromptEditorProps) {
  const [tool, setTool] = useState('acceptance');
  const [text, setText] = useState(() => getPrompt('acceptance'));
  const [saved, setSaved] = useState(false);

  const handleToolChange = (key: string) => {
    setTool(key);
    setText(getPrompt(key));
    setSaved(false);
  };

  const handleSave = () => {
    if (text.trim()) {
      localStorage.setItem(`acgen_prompt_${tool}`, text);
    } else {
      localStorage.removeItem(`acgen_prompt_${tool}`);
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    localStorage.removeItem(`acgen_prompt_${tool}`);
    setText(DEFAULT_PROMPTS[tool]);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const isOverridden = (key: string) => {
    try {
      return localStorage.getItem(`acgen_prompt_${key}`) !== null;
    } catch { return false; }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 800, maxHeight: '90vh' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>Editor de Prompts</h2>
          <button type="button" className="btn-ghost" onClick={onClose}>Cerrar</button>
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          {TOOLS.map((t) => (
            <button
              key={t.key}
              type="button"
              className={tool === t.key ? 'btn-primary' : 'btn-ghost'}
              onClick={() => handleToolChange(t.key)}
              style={{ fontSize: 12 }}
            >
              {t.label}
              {isOverridden(t.key) && <span style={{ marginLeft: 4, color: 'var(--success)' }}>*</span>}
            </button>
          ))}
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 8 }}>
          Variables disponibles: &#123;dominio&#125;, &#123;tipoProducto&#125;, &#123;mercados&#125;, &#123;terminologia&#125;, &#123;tono&#125;
        </p>
        <textarea
          value={text}
          onChange={(e) => { setText(e.target.value); setSaved(false); }}
          className="field-textarea"
          style={{ minHeight: 300, fontFamily: 'var(--font-mono)', fontSize: 13 }}
        />
        <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
          <button type="button" className="btn-ghost" onClick={handleReset}>
            Restaurar por defecto
          </button>
          <button type="button" className="btn-primary" onClick={handleSave}>
            {saved ? 'Guardado!' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Wire PromptEditor into Sidebar and tools**

In `src/components/Sidebar.tsx`, add a state + button for opening PromptEditor:
```typescript
const [showPromptEditor, setShowPromptEditor] = useState(false);
```

Add an item at the bottom of the sidebar:
```tsx
<button
  type="button"
  className="btn-ghost"
  onClick={() => setShowPromptEditor(true)}
  style={{ fontSize: 12, width: '100%', textAlign: 'left' }}
>
  Prompts
</button>

{showPromptEditor && <PromptEditor onClose={() => setShowPromptEditor(false)} />}
```

In each tool component that currently imports prompts directly from constants.ts, change to use `getPrompt()`. For example, in AcceptanceCriteriaTool.tsx:

Remove:
```typescript
import { HARDCODED_PROMPT } from '../config/constants';
```

Add:
```typescript
import { getPrompt } from '../services/apiService';
```

And compute `const prompt = getPrompt('acceptance');` inside the component (or in the handleGenerate callback to get fresh overrides each time).

Repeat for all 8 LLM tools.

- [ ] **Step 5: Verify type check and tests**

```bash
cd acgen; npx tsc -b --noEmit 2>&1
```
Expected: no errors.

```bash
cd acgen; npm test 2>&1
```
Expected: all 89 tests pass.

- [ ] **Step 6: Commit**

```bash
cd acgen; git add -A; git commit -m "feat(prompts): customizable prompts — PromptEditor, getPrompt(), per-tool localStorage override"
```

---

### Task 3.5: PWA (Installable + Static Cache)

**Files:**
- Create: `public/icon-192.png`
- Create: `public/icon-512.png`
- Modify: `package.json`
- Modify: `vite.config.ts`
- Modify: `index.html`

- [ ] **Step 1: Install vite-plugin-pwa**

```bash
cd acgen; npm install -D vite-plugin-pwa 2>&1
```

- [ ] **Step 2: Generate PWA icons**

Create a simple SVG icon and convert to PNG. Since we can't run image tools natively, create a minimal valid PNG placeholder. The actual icon can be created by:

```bash
# Use the SVG from Icons.tsx (spark icon) as the basis
# For now, create minimal valid PNG files using PowerShell
```

Actually, let's create minimal valid 1x1 PNGs as placeholders that the manifest expects. The user can replace them later.

```powershell
# Create minimal valid PNG (1x1 purple pixel)
$png192 = [Convert]::FromBase64String("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPj/HwADBwIAMCbHYQAAAABJRU5ErkJggg==")
Set-Content -LiteralPath "public/icon-192.png" -Value $png192 -Encoding Byte
Copy-Item -LiteralPath "public/icon-192.png" -Destination "public/icon-512.png"
```

- [ ] **Step 3: Configure PWA in vite.config.ts**

Replace `src/vite.config.ts` content (keeping the existing vitest config):

```typescript
/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
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
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    typecheck: {
      tsconfig: './tsconfig.test.json',
    },
  },
})
```

- [ ] **Step 4: Add PWA meta tags to index.html**

In `index.html`, add inside `<head>` (before the existing tags):

```html
<meta name="theme-color" content="#7c3aed">
<link rel="apple-touch-icon" href="/icon-192.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
```

- [ ] **Step 5: Verify build works with PWA plugin**

```bash
cd acgen; npm run build 2>&1
```

Expected: builds successfully, `dist/` contains `sw.js` (service worker) and `manifest.webmanifest`.

- [ ] **Step 6: Run tests**

```bash
cd acgen; npm test 2>&1
```

Expected: all 89 tests pass.

- [ ] **Step 7: Commit**

```bash
cd acgen; git add -A; git commit -m "feat(pwa): installable PWA — vite-plugin-pwa, manifest, icons, static precache"
```

---

### Task 3.6: Multi-Provider LLM

**Files:**
- Create: `src/config/providers.ts`
- Create: `src/config/providers.test.ts`
- Create: `src/components/ProviderConfig.tsx`
- Modify: `src/services/apiService.ts`
- Modify: `src/App.tsx`
- Modify: `src/components/Header.tsx`
- Modify: `src/components/LandingScreen.tsx`

- [ ] **Step 1: Create providers.ts**

```typescript
// src/config/providers.ts
import { AVAILABLE_MODELS, DEFAULT_MODEL } from './constants';

export interface ProviderDef {
  id: string;
  name: string;
  baseUrl: string;
  models: string[];
  defaultModel: string;
  needsBaseUrl?: boolean;
  needsApiKey?: boolean;
}

export const PROVIDERS: Record<string, ProviderDef> = {
  groq: {
    id: 'groq',
    name: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1/chat/completions',
    models: [...AVAILABLE_MODELS],
    defaultModel: DEFAULT_MODEL,
  },
  openrouter: {
    id: 'openrouter',
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1/chat/completions',
    models: [
      'openai/gpt-4o',
      'anthropic/claude-sonnet-4',
      'google/gemini-2.5-flash',
      'meta-llama/llama-4-maverick',
      'deepseek/deepseek-chat-v3',
      'qwen/qwen3-235b',
      'mistralai/mistral-large',
      'cohere/command-r-plus',
    ],
    defaultModel: 'openai/gpt-4o',
  },
  custom: {
    id: 'custom',
    name: 'Custom',
    baseUrl: '',
    models: [],
    defaultModel: '',
    needsBaseUrl: true,
  },
};

export const DEFAULT_PROVIDER = 'groq';

export function getProvider(id: string): ProviderDef {
  return PROVIDERS[id] ?? PROVIDERS[DEFAULT_PROVIDER];
}
```

- [ ] **Step 2: Create providers.test.ts**

```typescript
// src/config/providers.test.ts
import { describe, it, expect } from 'vitest';
import { PROVIDERS, getProvider, DEFAULT_PROVIDER } from './providers';

describe('PROVIDERS', () => {
  it('has groq, openrouter, and custom entries', () => {
    expect(PROVIDERS.groq).toBeDefined();
    expect(PROVIDERS.openrouter).toBeDefined();
    expect(PROVIDERS.custom).toBeDefined();
  });

  it('groq has 5 models', () => {
    expect(PROVIDERS.groq.models).toHaveLength(5);
  });

  it('openrouter has predefined models', () => {
    expect(PROVIDERS.openrouter.models.length).toBeGreaterThan(0);
  });

  it('custom has empty models array and needsBaseUrl', () => {
    expect(PROVIDERS.custom.models).toEqual([]);
    expect(PROVIDERS.custom.needsBaseUrl).toBe(true);
    expect(PROVIDERS.custom.baseUrl).toBe('');
  });
});

describe('getProvider', () => {
  it('returns groq by default for unknown id', () => {
    const p = getProvider('nonexistent');
    expect(p.id).toBe(DEFAULT_PROVIDER);
  });

  it('returns the correct provider by id', () => {
    expect(getProvider('openrouter').id).toBe('openrouter');
  });
});
```

- [ ] **Step 3: Modify apiService.ts to accept baseUrl**

In `src/services/apiService.ts`, modify `streamWithGroq` signature to accept `baseUrl`:

Add a new parameter `baseUrl?: string` after `model`:

```typescript
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
```

Change the fetch call from:
```typescript
const response = await fetch(API_URL, {
```
to:
```typescript
const response = await fetch(baseUrl || API_URL, {
```

Also modify `generateWithGroq` similarly — add `baseUrl?: string` parameter and use it in the fetch call.

- [ ] **Step 4: Create ProviderConfig.tsx**

```typescript
// src/components/ProviderConfig.tsx
import { PROVIDERS, DEFAULT_PROVIDER, type ProviderDef } from '../config/providers';
import { SearchableSelect } from './SearchableSelect';

interface ProviderConfigProps {
  provider: string;
  onProviderChange: (id: string) => void;
  apiKey: string;
  onApiKeyChange: (key: string) => void;
  model: string;
  onModelChange: (model: string) => void;
  baseUrl?: string;
  onBaseUrlChange?: (url: string) => void;
}

export function ProviderConfig({
  provider,
  onProviderChange,
  apiKey,
  onApiKeyChange,
  model,
  onModelChange,
  baseUrl = '',
  onBaseUrlChange,
}: ProviderConfigProps) {
  const def = PROVIDERS[provider] ?? PROVIDERS[DEFAULT_PROVIDER];

  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
      <div>
        <label className="field-label">Proveedor</label>
        <select
          value={provider}
          onChange={(e) => {
            const newDef = PROVIDERS[e.target.value];
            onProviderChange(e.target.value);
            if (newDef) onModelChange(newDef.defaultModel);
          }}
          className="field-select"
          style={{ minWidth: 120 }}
        >
          {Object.values(PROVIDERS).map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      {def.needsBaseUrl && onBaseUrlChange && (
        <div>
          <label className="field-label">URL del API</label>
          <input
            type="text"
            value={baseUrl}
            onChange={(e) => onBaseUrlChange(e.target.value)}
            placeholder="https://api.openai.com/v1/chat/completions"
            className="field-input"
            style={{ minWidth: 280 }}
          />
        </div>
      )}

      <div>
        <label className="field-label">Modelo</label>
        {def.models.length > 0 ? (
          <select
            value={model}
            onChange={(e) => onModelChange(e.target.value)}
            className="field-select"
            style={{ minWidth: 220 }}
          >
            {def.models.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        ) : (
          <input
            type="text"
            value={model}
            onChange={(e) => onModelChange(e.target.value)}
            placeholder="gpt-4o"
            className="field-input"
            style={{ minWidth: 220 }}
          />
        )}
      </div>

      <div>
        <label className="field-label">API Key</label>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => onApiKeyChange(e.target.value)}
          placeholder={provider === 'groq' ? 'gsk_...' : 'sk-...'}
          className="field-input"
          style={{ minWidth: 220 }}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Integrate provider state into App.tsx**

In `src/App.tsx`, add provider-related state and migrate the old API key:

```typescript
import { DEFAULT_PROVIDER } from './config/providers';

// Migrate old key
const [apiKey, setApiKey] = useLocalStorage('acgen_key_groq', () => {
  try {
    const oldKey = localStorage.getItem('acgen_api_key');
    if (oldKey) {
      const parsed = JSON.parse(oldKey);
      if (typeof parsed === 'string' && parsed) {
        localStorage.removeItem('acgen_api_key'); // clean up old key
        return parsed;
      }
    }
  } catch { /* ignore */ }
  return '';
});

const [provider, setProvider] = useLocalStorage('acgen_provider', DEFAULT_PROVIDER);
const [openrouterKey, setOpenrouterKey] = useLocalStorage('acgen_key_openrouter', '');
const [customKey, setCustomKey] = useLocalStorage('acgen_key_custom', '');
const [customBaseUrl, setCustomBaseUrl] = useLocalStorage('acgen_custom_base_url', '');

const currentApiKey = provider === 'groq' ? apiKey : provider === 'openrouter' ? openrouterKey : customKey;
const currentBaseUrl = provider === 'custom' ? customBaseUrl : (PROVIDERS[provider]?.baseUrl ?? API_URL);

// Remove the old model state and use model from provider
const [model, setModel] = useLocalStorage(`acgen_model_${provider}`, PROVIDERS[provider]?.defaultModel ?? DEFAULT_MODEL);
```

Pass all this to Header and LandingScreen.

- [ ] **Step 6: Update Header and LandingScreen**

In Header.tsx, accept and render `<ProviderConfig>` props. Replace the standalone model badge with ProviderConfig.

In LandingScreen.tsx, replace `ApiKeyConfig` + `ModelSelector` with `<ProviderConfig>`.

- [ ] **Step 7: Verify type check and all tests**

```bash
cd acgen; npx tsc -b --noEmit 2>&1
```
Expected: no errors.

```bash
cd acgen; npm test 2>&1
```
Expected: all 89 + 5 = 94 tests pass.

- [ ] **Step 8: Commit**

```bash
cd acgen; git add -A; git commit -m "feat(provider): multi-provider LLM — Groq + OpenRouter + Custom, ProviderConfig, key migration"
```

---

## Verification Checklist

After completing all tasks, run:

```bash
cd acgen
npx tsc -b --noEmit   # Type check
npm test              # All tests (estimated 94 total: 65 original + 12 anonymizer + 12 workspace + 5 provider)
npm run build         # Production build (verifies PWA + all imports)
```

**Final commit count:** 7 commits for Fase 3 (one per task group, i18n may split into 2-3).
