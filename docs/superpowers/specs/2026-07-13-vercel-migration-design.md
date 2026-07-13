# Vercel Migration — Design Spec

**Date:** 2026-07-13
**Goal:** Make ACGen deployable to a public domain via Vercel by replacing the persistent Express proxy (`server/`) with native Vercel serverless functions under `api/`, and migrate local development from `npm run dev:all` (Express) to `vercel dev` so local and production share the same function code.

## Context

ACGen is a React 18 + Vite SPA. The Groq LLM calls go browser→Groq directly and are unaffected. The Jira integration (used by Acceptance Criteria, Bug Report, Test Data, Sprint Tracker) routes through a local Express proxy to bypass CORS. That proxy cannot run on Vercel:

- `server/index.js` is a persistent Express app (`app.listen()`); Vercel only runs serverless functions under `/api`.
- `PROXY_URL` is hardcoded to `http://localhost:3002/api` (`src/config/constants.ts:2`).
- CORS is pinned to `http://localhost:5173` (`server/index.js`).

On a public deploy as-is, every Jira call would target `localhost` from the user's browser and fail silently.

## Decisions (from brainstorming)

- **Vercel plan:** Hobby (free). Function `maxDuration` limit is 10s.
- **`server/` directory:** delete entirely after migration (git retains history). Single source of truth.
- **Local dev:** `npm run dev:all` becomes `vercel dev`. Remove `server` and `concurrently`.
- **Function structure:** two native serverless functions, 1:1 with current routes (Approach A). Not a catch-all, not a wrapped Express instance.

## Architecture

### File structure

```
acgen/
├── api/                          # NEW — Vercel auto-detects
│   ├── _lib/
│   │   ├── jiraUtils.js          # moved from server/jiraUtils.js (unchanged logic)
│   │   └── jiraUtils.test.js     # moved from server/ (16 tests, unchanged)
│   └── jira/
│       ├── issue/
│       │   └── [issueKey].js     # GET /api/jira/issue/:issueKey
│       └── search.js             # GET /api/jira/search
├── server/                       # DELETED entirely
├── vercel.json                   # NEW
├── src/config/constants.ts       # PROXY_URL → relative path
└── package.json                  # scripts + deps updated
```

- `api/_lib/` — the `_` prefix stops Vercel from treating these files as HTTP endpoints. Validation logic lives here once, imported by both handlers.
- `[issueKey].js` — Vercel's `[param]` syntax captures the dynamic URL segment (equivalent to Express `:issueKey`), read via `req.query.issueKey`.
- `search.js` — reads `req.query.jql`.

### Handler behavior

Each handler is a default-exported `(req, res)` function. Logic mirrors the current `server/jiraRoutes.js` almost exactly, with these serverless adaptations:

1. **Method guard** (new — Express `.get()` implicitly rejected non-GET; a Vercel function receives any method):
   ```js
   if (req.method !== 'GET') {
     return res.status(405).json({ error: 'Método no permitido.' });
   }
   ```
2. **Timeout reduced to 8s.** Current code uses `AbortSignal.timeout(30_000)`. On Hobby the whole function is killed at 10s and Vercel returns its own uncontrolled, non-Spanish error page. Aborting our `fetch` at 8s guarantees our own `catch` runs first and the user gets `504 { error: 'Timeout al consultar Jira. El servidor no responde.' }`. Expose as `const FETCH_TIMEOUT_MS = 8_000;` so a Pro migration only needs this one number (plus `maxDuration`) bumped.

Everything else in the contract is preserved verbatim:
- Missing `X-Jira-Token` / `X-Jira-Base-Url` → `400` "Faltan credenciales de Jira (token o URL base)."
- `validateBaseUrl` throws → `400` "URL base de Jira inválida."
- `validateAndEncodeIssueKey` throws → `400` "Clave de ticket inválida."
- `/search` missing `jql` → `400` "Falta el parámetro JQL."
- Jira 401 → `401` "Token inválido o expirado."
- Issue 404 → `404` "Ticket no encontrado." / Search 400 → `400` "JQL inválida. Revisa la sintaxis."
- Other non-ok Jira status → passthrough status with `"Error al consultar Jira: {status}"`.
- `AbortError`/`TimeoutError` → `504`.
- Any other error → `500` "Error de conexión con el servidor proxy."
- Input headers unchanged: `X-Jira-Token`, `X-Jira-Base-Url`.
- Response JSON shape unchanged: the `result` object for issue (key, summary, description, issueType, priority, status, labels, components, acceptanceCriteria) and `{ issues }` for search.

### CORS removed

With frontend and `/api` served from the same origin (both under `vercel dev` locally and in production), the `cors` middleware and the `localhost:5173` pin are unnecessary. The `cors` dependency is removed.

## Configuration changes

### `vercel.json` (new, at `acgen/` root)

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "functions": {
    "api/**/*.js": { "maxDuration": 10 }
  }
}
```

`maxDuration: 10` is the Hobby maximum; the 8s abort sits under it with margin. On Pro, this is the one place to raise the function limit.

### `src/config/constants.ts`

```diff
- export const PROXY_URL = 'http://localhost:3002/api';
+ export const PROXY_URL = '/api';
```

Relative path resolves under both `vercel dev` and production. `jiraService.ts` already builds `${PROXY_URL}/jira/issue/...` — no change there.

### `package.json` scripts

```diff
  "dev": "vite",
- "server": "node server/index.js",
- "dev:all": "concurrently \"npm run dev\" \"npm run server\"",
+ "dev:all": "vercel dev",
  "build": "tsc -b && vite build",
```

`dev` (Vite-only) stays for pure UI work without the proxy. `dev:all` becomes `vercel dev` (serves frontend + `/api` together).

### `package.json` dependencies removed

```diff
- "concurrently": "^9.2.1",
- "cors": "^2.8.6",
- "express": "^5.2.1",
```

## Testing

- **Unit tests — relocation only, no logic change.** The 16 `jiraUtils` tests move with the file to `api/_lib/jiraUtils.test.js`. Validation logic is identical, so they pass as-is. Confirm Vitest still discovers them at the new path (default glob `**/*.test.js` covers `api/`; adjust `vite.config.ts` only if needed).
- **No new unit tests for the handlers themselves** — same testing boundary the project already chose (`jiraRoutes.js` had no tests; only the validation layer did). The handlers are thin glue over `fetch` + already-tested utils; testing them would require mocking `fetch` and Vercel's req/res cycle for little value.

## Verification

1. `npm test` → 80 tests green from new location.
2. `npm run build` → clean Vite build.
3. `npm run lint` → no new errors.
4. **`vercel dev` locally** (the real migration test): exercise both endpoints — no credentials → 400; POST → 405; and (with a real ticket + PAT provided by the user) a real Jira query returning 200. Validates function discovery, `[issueKey]` dynamic route resolution, and frontend↔`/api` wiring.
5. Production deploy (`vercel --prod` or GitHub integration) is triggered by the user; local verification leaves that step direct.

**First-time-only manual step (user runs in their terminal):** `vercel link` to associate the project. Flagged with `!` prefix at implementation time; does not block code work.

## Documentation updates

- `AGENTS.md`: proxy section, commands table, key files (server → api).
- `README.md`: installation/usage (`npm run dev:all` is now `vercel dev`), Jira integration no longer mentions port 3002.

## Out of scope

- No change to Groq call path (already browser-direct).
- No new handler unit tests.
- No CI/CD pipeline setup (deploy is user-triggered).
- No change to any tool's UI or business logic.
