### Task 3.6 Report: Multi-Provider LLM

**Status:** Complete

**Commit:** `720c9a1` — `feat(provider): multi-provider LLM — Groq + OpenRouter + Custom, ProviderConfig, key migration`

**Files changed (13 source files):**
| File | Action |
|---|---|
| `src/config/providers.ts` | Created — ProviderDef interface, PROVIDERS map (groq/openrouter/custom), getProvider() |
| `src/config/providers.test.ts` | Created — 6 tests (provider entries, model counts, needsBaseUrl, getProvider fallback) |
| `src/services/apiService.ts` | Modified — `streamWithGroq` + `generateWithGroq` accept `baseUrl?`; all 4 helper functions pass through |
| `src/App.tsx` | Modified — Provider state (acgen_provider, per-provider keys), key migration (acgen_api_key → acgen_key_groq), computed currentApiKey/currentBaseUrl, passed to Header + LandingScreen + all 8 tools |
| `src/components/ProviderConfig.tsx` | Created — Provider dropdown + dynamic model selector + API key input + optional custom base URL field |
| `src/components/Header.tsx` | Modified — Added provider/model/apiKey props; model-chip shows provider prefix (OR:/C:) for non-Groq |
| `src/components/LandingScreen.tsx` | Modified — Replaced ApiKeyConfig + ModelSelector with single ProviderConfig component |
| `src/components/AcceptanceCriteriaTool.tsx` | Modified — Added `baseUrl?` prop, passed to streamWithGroq |
| `src/components/TestCaseTool.tsx` | Modified — Added `baseUrl?` prop, passed to streamWithGroq |
| `src/components/BugReportTool.tsx` | Modified — Added `baseUrl?` prop, passed to streamWithGroq |
| `src/components/TestDataTool.tsx` | Modified — Added `baseUrl?` prop, passed to streamWithGroq |
| `src/components/UserStoryTool.tsx` | Modified — Added `baseUrl?` prop, passed to streamWithGroq |
| `src/components/RefinerTool.tsx` | Modified — Added `baseUrl?` prop, passed to streamWithGroq |
| `src/components/EdgeCaseTool.tsx` | Modified — Added `baseUrl?` prop, passed to streamWithGroq |
| `src/components/ConverterTool.tsx` | Modified — Added `baseUrl?` prop, passed to streamWithGroq |

**Key migration:** On first load, if `acgen_api_key` exists in localStorage, its value is read and used as the initial value for `acgen_key_groq`. The old key is preserved.

**Verification:**
- `npx tsc -b --noEmit` — **zero errors**
- `npm test` — **96 tests pass** (90 existing + 6 new provider tests), 8 files
- `npm run build` — **succeeds** with PWA SW generated (14 precached entries)

**Provider architecture:**
- **Groq** — 5 models (existing AVAILABLE_MODELS), baseUrl: `https://api.groq.com/openai/v1/chat/completions`
- **OpenRouter** — 8 models (gpt-4o, claude-sonnet-4, gemini-2.5-flash, llama-4-maverick, deepseek-chat-v3, qwen3-235b, mistral-large, command-r-plus)
- **Custom** — Empty models array, requires manual base URL + model entry

**Concerns:** None. All existing functionality preserved — 90 original tests pass unchanged. The model-chip in the header now prefixes non-Groq providers with "OR:" or "C:" for clarity.
