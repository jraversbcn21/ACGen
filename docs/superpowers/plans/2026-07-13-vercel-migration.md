# Vercel Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the persistent Express Jira proxy (`server/`) with native Vercel serverless functions under `api/`, and switch local dev from `npm run dev:all` (Express) to `vercel dev`, so ACGen can deploy to a public domain via Vercel.

**Architecture:** Two native Vercel serverless functions (`api/jira/issue/[issueKey].js`, `api/jira/search.js`) that reuse the existing validation layer moved to `api/_lib/jiraUtils.js`. Same request/response contract as the current proxy, minus CORS (same-origin now). Frontend calls a relative `/api` path that resolves under both `vercel dev` and production.

**Tech Stack:** React 18 + Vite 5 SPA, Vercel serverless functions (Node runtime, ESM), Vitest for the validation tests, Groq LLM calls (unchanged, browser-direct).

## Global Constraints

- Vercel plan: **Hobby** — function `maxDuration` limit is **10s**; internal Jira `fetch` timeout must stay under it at **8s** (`FETCH_TIMEOUT_MS = 8_000`).
- `package.json` has `"type": "module"` — all `api/` files use ESM (`import` / `export default`).
- All user-facing error copy is **in Spanish**, copied verbatim from the current proxy.
- ESLint only lints `.ts`/`.tsx` (`eslint.config.js` → `files: ['**/*.{ts,tsx}']`). Files under `api/` are `.js` and are **not** linted — same as the current `server/*.js`. `npm run lint` verifies no regressions in `.ts`/`.tsx` only.
- Vitest default glob discovers `**/*.test.js` across the whole project (the current `server/jiraUtils.test.js` is found this way); no Vitest config change is needed for `api/_lib/`.
- Files/folders under an underscore-prefixed directory (`api/_lib/`) are **not** turned into Vercel functions — this shelters both `jiraUtils.js` and its test from being deployed as endpoints.
- Full test suite is **80 tests** before this work; the 16 `jiraUtils` tests relocate but their count and assertions do not change.

## File Structure

```
acgen/
├── api/                              # NEW — Vercel auto-detects this directory
│   ├── _lib/
│   │   ├── jiraUtils.js              # MOVED from server/jiraUtils.js (byte-identical)
│   │   └── jiraUtils.test.js         # MOVED from server/jiraUtils.test.js (byte-identical)
│   └── jira/
│       ├── issue/
│       │   └── [issueKey].js         # NEW — GET /api/jira/issue/:issueKey handler
│       └── search.js                 # NEW — GET /api/jira/search handler
├── server/                           # DELETED entirely (index.js, jiraRoutes.js, jiraUtils.js, jiraUtils.test.js)
├── vercel.json                       # NEW — build + function config
├── .gitignore                        # MODIFIED — add .vercel
├── src/config/constants.ts           # MODIFIED — PROXY_URL → '/api'
├── package.json                      # MODIFIED — scripts + remove express/cors/concurrently
├── AGENTS.md                         # MODIFIED — proxy docs
└── README.md                         # MODIFIED — install/usage docs
```

Responsibilities:
- `api/_lib/jiraUtils.js` — the single source of validation logic (`validateAndEncodeIssueKey`, `validateBaseUrl`), imported by both handlers.
- `api/jira/issue/[issueKey].js` — fetches one Jira issue; owns the issue-specific error mapping (404 → "Ticket no encontrado.").
- `api/jira/search.js` — runs a JQL search; owns the search-specific error mapping (400 → "JQL inválida.").
- `vercel.json` — declares build command, output dir, and `maxDuration`.

---

### Task 1: Move the validation layer to `api/_lib/` and delete the Express proxy

**Files:**
- Create: `api/_lib/jiraUtils.js`
- Create: `api/_lib/jiraUtils.test.js`
- Delete: `server/jiraUtils.js`, `server/jiraUtils.test.js`, `server/jiraRoutes.js`, `server/index.js` (the whole `server/` directory)

**Interfaces:**
- Produces: `validateAndEncodeIssueKey(key: string): string` (throws on invalid) and `validateBaseUrl(url: string): string` (returns `parsed.origin`, throws on invalid), importable from `api/_lib/jiraUtils.js`.

Nothing in the test suite or the Vite build imports `server/` — only `server/jiraUtils.test.js` imports `./jiraUtils.js`, and `server/jiraRoutes.js`/`server/index.js` are used solely by the removed `npm run server`. Deleting `server/` therefore keeps `npm test` and `npm run build` green.

- [ ] **Step 1: Create `api/_lib/jiraUtils.js` with the exact current validation code**

```js
const ISSUE_KEY_RE = /^[A-Z][A-Z0-9]*-\d+$/;

export function validateAndEncodeIssueKey(key) {
  if (!key || typeof key !== 'string') {
    throw new Error('Clave de ticket inválida.');
  }
  if (!ISSUE_KEY_RE.test(key)) {
    throw new Error('Clave de ticket inválida.');
  }
  return encodeURIComponent(key);
}

export function validateBaseUrl(url) {
  if (!url || typeof url !== 'string') {
    throw new Error('URL base de Jira inválida.');
  }

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('URL base de Jira inválida.');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('URL base de Jira inválida.');
  }

  return parsed.origin;
}
```

- [ ] **Step 2: Create `api/_lib/jiraUtils.test.js` with the exact current tests**

The relative import (`./jiraUtils.js`) is unchanged because the test moves together with the util.

```js
// @vitest-environment node

import { describe, test, expect } from 'vitest';
import { validateAndEncodeIssueKey, validateBaseUrl } from './jiraUtils.js';

describe('validateAndEncodeIssueKey', () => {
  test('encodes a valid issue key (PROJ-123)', () => {
    expect(validateAndEncodeIssueKey('PROJ-123')).toBe('PROJ-123');
  });

  test('encodes a valid issue key with a single letter project (A-1)', () => {
    expect(validateAndEncodeIssueKey('A-1')).toBe('A-1');
  });

  test('encodes a valid issue key with numbers in the project key (ABC2-456)', () => {
    expect(validateAndEncodeIssueKey('ABC2-456')).toBe('ABC2-456');
  });

  test('applies encodeURIComponent to valid keys (defense-in-depth)', () => {
    const encoded = validateAndEncodeIssueKey('PRJ-123');
    expect(encoded).not.toContain('/');
    expect(encoded).toBe(encodeURIComponent('PRJ-123'));
  });

  test('rejects an empty issue key', () => {
    expect(() => validateAndEncodeIssueKey('')).toThrow();
  });

  test('rejects issue keys without hyphens', () => {
    expect(() => validateAndEncodeIssueKey('PROJ123')).toThrow();
  });

  test('rejects issue keys with lowercase project prefix', () => {
    expect(() => validateAndEncodeIssueKey('proj-123')).toThrow();
  });

  test('rejects issue keys with path traversal after a valid key', () => {
    expect(() => validateAndEncodeIssueKey('ABC-1/../../admin/delete')).toThrow();
  });

  test('rejects issue keys with query string injection', () => {
    expect(() => validateAndEncodeIssueKey('ABC-1?fields=*')).toThrow();
  });
});

describe('validateBaseUrl', () => {
  test('accepts a valid https Jira URL', () => {
    expect(validateBaseUrl('https://mycompany.atlassian.net')).toBe(
      'https://mycompany.atlassian.net',
    );
  });

  test('accepts a valid http URL', () => {
    expect(validateBaseUrl('http://localhost:8080')).toBe('http://localhost:8080');
  });

  test('accepts a URL with a trailing slash and normalizes it', () => {
    expect(validateBaseUrl('https://mycompany.atlassian.net/')).toBe(
      'https://mycompany.atlassian.net',
    );
  });

  test('rejects an empty base URL', () => {
    expect(() => validateBaseUrl('')).toThrow();
  });

  test('rejects a base URL with no host', () => {
    expect(() => validateBaseUrl('not-a-url')).toThrow();
  });

  test('rejects a base URL with unsupported protocol (ftp)', () => {
    expect(() => validateBaseUrl('ftp://evil.com')).toThrow();
  });

  test('rejects a base URL with javascript: protocol (XSS)', () => {
    expect(() => validateBaseUrl('javascript:alert(1)')).toThrow();
  });
});
```

- [ ] **Step 3: Delete the entire `server/` directory**

Run: `rm -rf server` (from `acgen/`)

- [ ] **Step 4: Run the full test suite and confirm it still passes from the new location**

Run: `npm test`
Expected: `Test Files 6 passed (6)`, `Tests 80 passed (80)`. The `jiraUtils` file now shows as `api/_lib/jiraUtils.test.js (16 tests)`.

- [ ] **Step 5: Confirm the build is unaffected**

Run: `npm run build`
Expected: `✓ built in ...s` with no errors. (`tsc -b` only includes `src`; `api/` is untouched by the build.)

- [ ] **Step 6: Commit**

```bash
git add api/_lib/jiraUtils.js api/_lib/jiraUtils.test.js
git add -A server
git commit -m "refactor: move Jira validation layer to api/_lib and remove Express proxy"
```

---

### Task 2: Create the two serverless function handlers

**Files:**
- Create: `api/jira/issue/[issueKey].js`
- Create: `api/jira/search.js`

**Interfaces:**
- Consumes: `validateAndEncodeIssueKey`, `validateBaseUrl` from `api/_lib/jiraUtils.js` (Task 1).
- Produces: two HTTP endpoints — `GET /api/jira/issue/:issueKey` returning `{ key, summary, description, issueType, priority, status, labels, components, acceptanceCriteria }`, and `GET /api/jira/search?jql=` returning `{ issues: Array<{ key, summary, status, created, updated }> }`. Both read `X-Jira-Token` and `X-Jira-Base-Url` headers. These are consumed by `src/services/jiraService.ts` (unchanged) via `PROXY_URL`.

Per the spec, the handlers have **no unit tests** (same testing boundary as the old `jiraRoutes.js`, which had none); they are thin glue over `fetch` plus the already-tested utils. Verification is build + test + the `vercel dev` e2e pass in Task 5.

- [ ] **Step 1: Create `api/jira/issue/[issueKey].js`**

The import path `../../_lib/jiraUtils.js` resolves from `api/jira/issue/` up to `api/_lib/`.

```js
import { validateAndEncodeIssueKey, validateBaseUrl } from '../../_lib/jiraUtils.js';

const FETCH_TIMEOUT_MS = 8_000;

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido.' });
  }

  const { issueKey } = req.query;
  const token = req.headers['x-jira-token'];
  const baseUrl = req.headers['x-jira-base-url'];

  if (!token || !baseUrl) {
    return res.status(400).json({ error: 'Faltan credenciales de Jira (token o URL base).' });
  }

  let validatedBaseUrl;
  try {
    validatedBaseUrl = validateBaseUrl(baseUrl);
  } catch {
    return res.status(400).json({ error: 'URL base de Jira inválida.' });
  }

  let encodedIssueKey;
  try {
    encodedIssueKey = validateAndEncodeIssueKey(issueKey);
  } catch {
    return res.status(400).json({ error: 'Clave de ticket inválida.' });
  }

  try {
    const response = await fetch(
      `${validatedBaseUrl}/rest/api/2/issue/${encodedIssueKey}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      },
    );

    if (!response.ok) {
      if (response.status === 401) {
        return res.status(401).json({ error: 'Token inválido o expirado.' });
      }
      if (response.status === 404) {
        return res.status(404).json({ error: 'Ticket no encontrado.' });
      }
      return res.status(response.status).json({ error: `Error al consultar Jira: ${response.status}` });
    }

    const data = await response.json();
    const fields = data.fields || {};

    const result = {
      key: data.key || null,
      summary: fields.summary || null,
      description: fields.description || null,
      issueType: fields.issuetype?.name || null,
      priority: fields.priority?.name || null,
      status: fields.status?.name || null,
      labels: fields.labels || [],
      components: (fields.components || []).map((c) => c.name),
      acceptanceCriteria: fields.customfield_10401 || null,
    };

    return res.json(result);
  } catch (err) {
    if (err.name === 'AbortError' || err.name === 'TimeoutError') {
      return res.status(504).json({ error: 'Timeout al consultar Jira. El servidor no responde.' });
    }
    console.error('Jira proxy error:', err);
    return res.status(500).json({ error: 'Error de conexión con el servidor proxy.' });
  }
}
```

- [ ] **Step 2: Create `api/jira/search.js`**

The import path `../_lib/jiraUtils.js` resolves from `api/jira/` up to `api/_lib/`.

```js
import { validateBaseUrl } from '../_lib/jiraUtils.js';

const FETCH_TIMEOUT_MS = 8_000;

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido.' });
  }

  const token = req.headers['x-jira-token'];
  const baseUrl = req.headers['x-jira-base-url'];
  const jql = req.query.jql;

  if (!token || !baseUrl) {
    return res.status(400).json({ error: 'Faltan credenciales de Jira (token o URL base).' });
  }

  if (!jql) {
    return res.status(400).json({ error: 'Falta el parámetro JQL.' });
  }

  let validatedBaseUrl;
  try {
    validatedBaseUrl = validateBaseUrl(baseUrl);
  } catch {
    return res.status(400).json({ error: 'URL base de Jira inválida.' });
  }

  try {
    const response = await fetch(
      `${validatedBaseUrl}/rest/api/2/search?jql=${encodeURIComponent(jql)}&fields=key,summary,status,created,updated&maxResults=100`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      },
    );

    if (!response.ok) {
      if (response.status === 401) {
        return res.status(401).json({ error: 'Token inválido o expirado.' });
      }
      if (response.status === 400) {
        return res.status(400).json({ error: 'JQL inválida. Revisa la sintaxis.' });
      }
      return res.status(response.status).json({ error: `Error al consultar Jira: ${response.status}` });
    }

    const data = await response.json();
    const issues = (data.issues || []).map((issue) => ({
      key: issue.key,
      summary: issue.fields?.summary || '',
      status: issue.fields?.status?.name || '',
      created: issue.fields?.created || '',
      updated: issue.fields?.updated || '',
    }));

    return res.json({ issues });
  } catch (err) {
    if (err.name === 'AbortError' || err.name === 'TimeoutError') {
      return res.status(504).json({ error: 'Timeout al consultar Jira. El servidor no responde.' });
    }
    console.error('Jira proxy error:', err);
    return res.status(500).json({ error: 'Error de conexión con el servidor proxy.' });
  }
}
```

- [ ] **Step 3: Confirm tests and build are still green (no regression from adding handlers)**

Run: `npm test`
Expected: `Tests 80 passed (80)`.

Run: `npm run build`
Expected: `✓ built in ...s`, no errors.

- [ ] **Step 4: Commit**

```bash
git add api/jira/issue/[issueKey].js api/jira/search.js
git commit -m "feat: add Vercel serverless functions for Jira issue and search"
```

---

### Task 3: Wire Vercel config, relative proxy URL, scripts, and gitignore

**Files:**
- Create: `vercel.json`
- Modify: `src/config/constants.ts:2`
- Modify: `package.json:8-9` (scripts), `package.json:31,32,36` (devDependencies)
- Modify: `.gitignore`

**Interfaces:**
- Consumes: the `api/` functions from Task 2.
- Produces: `PROXY_URL = '/api'` (relative) consumed by `src/services/jiraService.ts`; `npm run dev:all` now launches `vercel dev`.

- [ ] **Step 1: Create `vercel.json`**

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "functions": {
    "api/**/*.js": { "maxDuration": 10 }
  }
}
```

- [ ] **Step 2: Change `PROXY_URL` to a relative path in `src/config/constants.ts`**

Old (line 2):
```ts
export const PROXY_URL = 'http://localhost:3002/api';
```
New:
```ts
export const PROXY_URL = '/api';
```

- [ ] **Step 3: Update `package.json` scripts**

Replace these two script lines:
```json
    "server": "node server/index.js",
    "dev:all": "concurrently \"npm run dev\" \"npm run server\"",
```
with this single line (the `server` script is removed entirely):
```json
    "dev:all": "vercel dev",
```

- [ ] **Step 4: Remove the three now-unused devDependencies from `package.json`**

Delete these three lines from `devDependencies`:
```json
    "concurrently": "^9.2.1",
    "cors": "^2.8.6",
    "express": "^5.2.1",
```

- [ ] **Step 5: Add `.vercel` to `.gitignore`**

Append under the `# Environment` block (so `vercel link` project settings are never committed):
```
.vercel
```

- [ ] **Step 6: Update the lockfile after removing dependencies**

Run: `npm install`
Expected: completes without errors; `package-lock.json` updates to drop `express`, `cors`, `concurrently`.

- [ ] **Step 7: Confirm tests, build, and lint are green**

Run: `npm test`
Expected: `Tests 80 passed (80)`.

Run: `npm run build`
Expected: `✓ built in ...s`.

Run: `npm run lint`
Expected: same 3 pre-existing warnings (Icons.tsx, SprintDashboard.tsx x2), `0 errors`.

- [ ] **Step 8: Commit**

```bash
git add vercel.json src/config/constants.ts package.json package-lock.json .gitignore
git commit -m "chore: configure Vercel build, relative proxy URL, and vercel dev script"
```

---

### Task 4: Update documentation

**Files:**
- Modify: `AGENTS.md`
- Modify: `README.md`

**Interfaces:** none (docs only).

- [ ] **Step 1: Update the `AGENTS.md` commands table**

Remove the `npm run server` row and change the `dev:all` row. Old rows:
```
| `npm run server` | Start Express proxy (port 3002) |
| `npm run dev:all` | Start both Vite + proxy concurrently |
```
New (single row replacing both):
```
| `npm run dev:all` | Start Vite + Jira functions together via `vercel dev` |
```

- [ ] **Step 2: Replace the `AGENTS.md` "Proxy Server" section**

Old section:
```
### Proxy Server

- **`server/index.js`** — Express app on port 3002, CORS origin `http://localhost:5173`, JSON middleware, mounts Jira routes at `/api/jira`.
- **`server/jiraUtils.js`** — `validateAndEncodeIssueKey()` (regex `^[A-Z][A-Z0-9]*-\d+$` + `encodeURIComponent`) and `validateBaseUrl()` (http/https only via `new URL()`).
- **`server/jiraRoutes.js`** routes:
  - `GET /api/jira/issue/:issueKey` — validates issueKey, validates baseUrl, proxies with 30s timeout. Returns 400 on invalid input, 504 on timeout.
  - `GET /api/jira/search?jql=` — validates baseUrl, proxies with 30s timeout. Returns 400 on invalid input, 504 on timeout.
- Headers: `X-Jira-Token` (PAT), `X-Jira-Base-Url`. Errors in Spanish.
```
New section:
```
### Jira serverless functions (Vercel)

- **`api/jira/issue/[issueKey].js`** — `GET /api/jira/issue/:issueKey`. Validates issueKey + baseUrl, proxies to Jira with an 8s `AbortSignal.timeout` (under the 10s Hobby function limit). Returns 400 on invalid input, 404 on missing ticket, 504 on timeout, 405 on non-GET.
- **`api/jira/search.js`** — `GET /api/jira/search?jql=`. Validates baseUrl, proxies with 8s timeout. Returns 400 on invalid input/JQL, 504 on timeout, 405 on non-GET.
- **`api/_lib/jiraUtils.js`** — `validateAndEncodeIssueKey()` (regex `^[A-Z][A-Z0-9]*-\d+$` + `encodeURIComponent`) and `validateBaseUrl()` (http/https only via `new URL()`). The `_lib` prefix keeps it (and its test) from being deployed as an endpoint.
- Headers: `X-Jira-Token` (PAT), `X-Jira-Base-Url`. Errors in Spanish. Same-origin, so no CORS layer.
- `FETCH_TIMEOUT_MS = 8_000` in each handler and `maxDuration: 10` in `vercel.json` are the two knobs to raise on a Pro plan.
```

- [ ] **Step 3: Update the `AGENTS.md` "Key files" table rows**

Remove these rows:
```
| `server/index.js` | Express proxy entry: CORS, JSON middleware, mounts Jira routes |
| `server/jiraRoutes.js` | `GET /issue/:issueKey` and `GET /search?jql=` — validates inputs, proxies with 30s timeout |
| `server/jiraUtils.js` | `validateAndEncodeIssueKey()`, `validateBaseUrl()` — input validation |
| `server/jiraUtils.test.js` | 16 unit tests for validation functions |
```
Add these rows in their place:
```
| `api/jira/issue/[issueKey].js` | Serverless function: `GET /api/jira/issue/:issueKey`, 8s timeout |
| `api/jira/search.js` | Serverless function: `GET /api/jira/search?jql=`, 8s timeout |
| `api/_lib/jiraUtils.js` | `validateAndEncodeIssueKey()`, `validateBaseUrl()` — shared validation |
| `api/_lib/jiraUtils.test.js` | 16 unit tests for validation functions |
```

- [ ] **Step 4: Update the `AGENTS.md` "Notable" line about devDependencies**

Old:
```
- `express` + `cors` + `concurrently` are devDependencies (proxy server).
```
New:
```
- Jira proxying runs as Vercel serverless functions under `api/` (no Express/CORS). `vercel dev` serves frontend + functions together locally.
```

- [ ] **Step 5: Update the `README.md` "Desarrollo" usage section**

Old:
```
### Desarrollo (con servidor proxy de Jira)

```bash
npm run dev:all
```

Esto inicia simultáneamente:
- **Vite dev server** en `http://localhost:5173`
- **Express proxy** en `http://localhost:3002`
```
New:
```
### Desarrollo (con integración Jira)

```bash
npm run dev:all
```

Ejecuta `vercel dev`, que sirve el frontend y las funciones serverless de `/api` juntos en el mismo origen (por defecto `http://localhost:3000`). Requiere el [Vercel CLI](https://vercel.com/docs/cli) instalado y, la primera vez, ejecutar `vercel link` para vincular el proyecto.
```

- [ ] **Step 6: Update the `README.md` "Estructura del Proyecto" tree**

Old:
```
├── server/                 # Proxy Express para API de Jira
│   ├── index.js
│   ├── jiraRoutes.js       # Rutas /issue y /search con timeouts
│   └── jiraUtils.js        # Validación de issue keys y URL base
```
New:
```
├── api/                    # Funciones serverless de Vercel (proxy Jira)
│   ├── _lib/               # Validación compartida (issue keys, URL base)
│   └── jira/               # Endpoints /issue/[issueKey] y /search
```

- [ ] **Step 7: Update the `README.md` "Integración con Jira" section**

Old:
```
1. Inicia el servidor proxy con `npm run dev:all` o `npm run server`
```
New:
```
1. Inicia el entorno con `npm run dev:all` (`vercel dev`), que levanta las funciones de `/api`
```

Old:
```
> El proxy se ejecuta localmente en el puerto 3002. Las credenciales nunca se envían a servidores externos — solo viajan desde tu navegador al proxy local y de ahí a tu instancia de Jira.
```
New:
```
> Las funciones de `/api` se ejecutan en el mismo origen que la app (local vía `vercel dev`, o en Vercel en producción). Las credenciales viajan desde tu navegador a la función y de ahí a tu instancia de Jira; nunca a terceros.
```

- [ ] **Step 8: Commit**

```bash
git add AGENTS.md README.md
git commit -m "docs: document Vercel serverless Jira functions and vercel dev workflow"
```

---

### Task 5: End-to-end verification with `vercel dev`

**Files:** none (verification only).

This task confirms the migration actually works end-to-end. It needs two user-run steps (marked **USER**) because they are interactive / require secrets.

- [ ] **Step 1: (USER) Link the project to Vercel — first time only**

In the terminal, type: `! vercel link`
Follow the prompts (scope + project). This creates a gitignored `.vercel/` directory. Skip if already linked.

- [ ] **Step 2: Start the local Vercel environment**

Run: `npm run dev:all`
Expected: `vercel dev` starts and prints a local URL (e.g. `http://localhost:3000`). Both the SPA and `/api/*` are served from that origin.

- [ ] **Step 3: Verify the method guard (no secrets needed)**

Run: `curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3000/api/jira/search`
Expected: `405`

- [ ] **Step 4: Verify the missing-credentials path (no secrets needed)**

Run: `curl -s http://localhost:3000/api/jira/search`
Expected JSON: `{"error":"Faltan credenciales de Jira (token o URL base)."}` with HTTP 400.

Run: `curl -s "http://localhost:3000/api/jira/issue/PROJ-1"`
Expected JSON: `{"error":"Faltan credenciales de Jira (token o URL base)."}` with HTTP 400.

- [ ] **Step 5: Verify an invalid issue key is rejected (no secrets needed)**

Run: `curl -s -H "X-Jira-Token: x" -H "X-Jira-Base-Url: https://example.com" "http://localhost:3000/api/jira/issue/not-a-key"`
Expected JSON: `{"error":"Clave de ticket inválida."}` with HTTP 400.

- [ ] **Step 6: (USER) Verify a real Jira round-trip through the UI**

With `npm run dev:all` running, open the local URL, configure the Jira base URL + PAT in any tool (e.g. Bug Report), and either fetch a real ticket by key or open the Sprint Tracker search. A real ticket's data should load. This confirms the frontend→`/api`→Jira path works over the same origin.

- [ ] **Step 7: Final full verification sweep**

Run: `npm test`
Expected: `Tests 80 passed (80)`.

Run: `npm run build`
Expected: `✓ built in ...s`.

Run: `npm run lint`
Expected: `0 errors` (3 pre-existing warnings).

No commit — this task only verifies. Production deploy (`vercel --prod` or GitHub integration) is user-triggered afterward.

---

## Self-Review

**Spec coverage:**
- File structure (api/_lib, api/jira, server deleted) → Tasks 1–2. ✓
- Handler behavior: method guard 405 → Task 2 both handlers. ✓ 8s timeout constant → Task 2 + Global Constraints. ✓ Full error contract preserved → Task 2 code. ✓
- CORS removed → Task 3 (cors dep removed) + Task 1 (server deleted). ✓
- `vercel.json` with maxDuration 10 → Task 3 Step 1. ✓
- `PROXY_URL` relative → Task 3 Step 2. ✓
- Scripts `dev:all` → `vercel dev`, `dev` kept, `server` removed → Task 3 Step 3. ✓
- Deps express/cors/concurrently removed → Task 3 Step 4. ✓
- Tests relocated, no logic change → Task 1 Steps 1–2, 4. ✓
- No handler unit tests → stated in Task 2. ✓
- Verification incl. `vercel dev` e2e and `vercel link` user step → Task 5. ✓
- Docs (AGENTS.md, README.md) → Task 4. ✓
- `.gitignore` `.vercel` (implied by `vercel link` creating `.vercel/`) → Task 3 Step 5. ✓

**Placeholder scan:** No TBD/TODO; every code and doc step shows exact content. ✓

**Type/name consistency:** `validateAndEncodeIssueKey` / `validateBaseUrl` used identically across Tasks 1–2. `FETCH_TIMEOUT_MS` consistent (8_000) in both handlers. `PROXY_URL` = `/api` matches `jiraService.ts`'s existing `${PROXY_URL}/jira/...` construction. Import paths verified: `../../_lib/jiraUtils.js` from `api/jira/issue/`, `../_lib/jiraUtils.js` from `api/jira/`. ✓
