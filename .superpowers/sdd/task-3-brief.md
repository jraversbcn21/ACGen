### Task 3.1.3: Wire ConfidentialToggle into all 8 LLM tools

**Files:**
- Modify: `src/components/AcceptanceCriteriaTool.tsx`
- Modify: `src/components/TestCaseTool.tsx`
- Modify: `src/components/BugReportTool.tsx`
- Modify: `src/components/TestDataTool.tsx`
- Modify: `src/components/UserStoryTool.tsx`
- Modify: `src/components/RefinerTool.tsx`
- Modify: `src/components/EdgeCaseTool.tsx`
- Modify: `src/components/ConverterTool.tsx`

**Interfaces:**
- Consumes: `anonymize()` from `src/services/anonymizer.ts`, `ConfidentialToggle` and `AnonymizerReview` from Task 3.1.2, `streamWithGroq` with `anonymizeMap` param
- Produces: All 8 LLM tools have confidential mode toggle + review modal wired into generate flow

**Context:** SprintTracker does NOT use the LLM — it is excluded.

**Pattern to apply to EACH tool (use AcceptanceCriteriaTool as canonical example, adapt for each tool):**

For each tool component:

**A) Add imports** (at top of file, with other imports):
```typescript
import { anonymize } from '../services/anonymizer';
import { ConfidentialToggle } from './ConfidentialToggle';
import { AnonymizerReview } from './AnonymizerReview';
```

**B) Add state** (near other useState declarations):
```typescript
const [confMap, setConfMap] = useState<Record<string, string> | null>(null);
```

**C) Modify handleGenerate** — split into two parts:
- `doGenerate` — the actual API call (extract from existing handleGenerate)
- `handleGenerate` — checks confidential mode, opens review if needed

The key pattern (adapt existing tool's actual field names — e.g., `requirements` in AcceptanceCriteriaTool, `input` in others):

```typescript
const doGenerate = useCallback(async (effectiveInput: string, effectiveMap?: Record<string, string>) => {
  setLoading(true);
  setResult('');
  try {
    const gen = streamWithGroq(apiKey, model, effectiveInput, prompt, <TOOL_TYPE>, profile, effectiveMap);
    await stream(gen, (fullText) => { setResult(fullText); });
    // If tool has onSaveArtifact prop, call it here
    onSaveArtifact?.(<originalInput>, fullText);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error inesperado. Intenta de nuevo.';
    showToast(message);
  } finally {
    setLoading(false);
    setConfMap(null);
  }
}, [apiKey, model, profile, stream, showToast, onSaveArtifact]);

const handleGenerate = useCallback(async () => {
  if (!canGenerate || loading || isStreaming) return;
  const confKey = `acgen_confidential_<VIEW>`;
  const confEnabled = localStorage.getItem(confKey) === 'true';
  if (confEnabled) {
    const { text, map } = anonymize(<inputValue>);
    if (Object.keys(map).length > 0) {
      setConfMap(map);
      return; // opens review modal
    }
    await doGenerate(<inputValue>);
  } else {
    await doGenerate(<inputValue>);
  }
}, [canGenerate, loading, isStreaming, <inputValue>, doGenerate]);
```

Where `<VIEW>` is the tool's view name (acceptance, testcase, bugreport, testdata, userstory, refiner, edgecase, converter), `<TOOL_TYPE>` is `'criteria'` or `'testcase'`, `<inputValue>` is the tool's current input text.

**D) Add ConfidentialToggle in JSX** — place in the actions bar, before the GenerateButton:

```tsx
<ConfidentialToggle
  view="<VIEW>"
  substitutionCount={0}
  onReview={() => {
    const { map } = anonymize(<inputValue>);
    setConfMap(map);
  }}
/>
```

**E) Add AnonymizerReview modal** — place at the end of the component, before the final closing `</div>`:

```tsx
{confMap && (
  <AnonymizerReview
    map={confMap}
    onCancel={() => setConfMap(null)}
    onConfirm={(editedMap) => {
      doGenerate(<inputValue>, editedMap);
      setConfMap(null);
    }}
  />
)}
```

**Tool-specific mappings:**
| Tool component | View name | Tool type |
|---|---|---|
| AcceptanceCriteriaTool | acceptance | criteria |
| TestCaseTool | testcase | testcase |
| BugReportTool | bugreport | criteria |
| TestDataTool | testdata | testcase |
| UserStoryTool | userstory | criteria |
| RefinerTool | refiner | criteria |
| EdgeCaseTool | edgecase | testcase |
| ConverterTool | converter | criteria |

- [ ] **Step 1: Wire AcceptanceCriteriaTool** (canonical example)
- [ ] **Step 2: Wire TestCaseTool**
- [ ] **Step 3: Wire BugReportTool**
- [ ] **Step 4: Wire TestDataTool**
- [ ] **Step 5: Wire UserStoryTool**
- [ ] **Step 6: Wire RefinerTool**
- [ ] **Step 7: Wire EdgeCaseTool**
- [ ] **Step 8: Wire ConverterTool**
- [ ] **Step 9: Type check** — `npx tsc -b --noEmit` — zero errors
- [ ] **Step 10: Test suite** — `npm test` — all 78 passing
- [ ] **Step 11: Commit** — `git add -A && git commit -m "feat(confidential): wire ConfidentialToggle + review modal into all 8 LLM tools"`
