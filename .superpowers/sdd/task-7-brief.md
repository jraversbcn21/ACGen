### Task 3.4: Customizable Prompts

**Files:**
- Modify: `src/config/constants.ts` — export `DEFAULT_PROMPTS` map
- Modify: `src/services/apiService.ts` — `getPrompt()` function
- Create: `src/components/PromptEditor.tsx`
- Modify: `src/components/Sidebar.tsx` — add prompt editor launcher
- Modify: All 8 LLM tool components — use `getPrompt()` instead of direct import

**Context:** i18n is already in place. Use useT() for any new UI strings.

- [ ] **Step 1: Export DEFAULT_PROMPTS from constants.ts**

Add at the end of `src/config/constants.ts`:
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

Add at the end of `src/services/apiService.ts` (or near the top after imports):
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
import { useT } from '../i18n/I18nContext';

const TOOLS = [
  { key: 'acceptance', labelKey: 'sidebar.criterios' },
  { key: 'testcase', labelKey: 'sidebar.testcase' },
  { key: 'bugreport', labelKey: 'sidebar.bugreport' },
  { key: 'testdata', labelKey: 'sidebar.testdata' },
  { key: 'userstory', labelKey: 'sidebar.userstory' },
  { key: 'refiner', labelKey: 'sidebar.refiner' },
  { key: 'edgecase', labelKey: 'sidebar.edgecase' },
  { key: 'converter', labelKey: 'sidebar.converter' },
];

interface PromptEditorProps {
  onClose: () => void;
}

export function PromptEditor({ onClose }: PromptEditorProps) {
  const t = useT();
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
          <button type="button" className="btn-ghost" onClick={onClose}>{t('common.close')}</button>
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          {TOOLS.map((tk) => (
            <button
              key={tk.key}
              type="button"
              className={tool === tk.key ? 'btn-primary' : 'btn-ghost'}
              onClick={() => handleToolChange(tk.key)}
              style={{ fontSize: 12 }}
            >
              {t(tk.labelKey)}
              {isOverridden(tk.key) && <span style={{ marginLeft: 4, color: 'var(--success)' }}>*</span>}
            </button>
          ))}
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 8 }}>
          Variables: &#123;dominio&#125;, &#123;tipoProducto&#125;, &#123;mercados&#125;, &#123;terminologia&#125;, &#123;tono&#125;
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
            {saved ? 'Guardado!' : t('common.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Wire PromptEditor into Sidebar**

In `src/components/Sidebar.tsx`, add:
```typescript
import { PromptEditor } from './PromptEditor';
const [showPromptEditor, setShowPromptEditor] = useState(false);
```
Add at bottom of sidebar items:
```tsx
<button type="button" className="btn-ghost" onClick={() => setShowPromptEditor(true)}
  style={{ fontSize: 12, width: '100%', textAlign: 'left', marginTop: 8 }}>
  {t('sidebar.prompts')}
</button>
{showPromptEditor && <PromptEditor onClose={() => setShowPromptEditor(false)} />}
```

- [ ] **Step 5: Wire getPrompt() into all 8 LLM tools**

Each tool currently imports a prompt constant directly (e.g., `import { HARDCODED_PROMPT } from '../config/constants'`). Replace with `import { getPrompt } from '../services/apiService'`. Compute `const prompt = getPrompt('<tool_key>')` inside the component or in doGenerate. Tool keys: acceptance, testcase, bugreport, testdata, userstory, refiner, edgecase, converter.

- [ ] **Step 6: Type check + tests**

```bash
npx tsc -b --noEmit 2>&1    # zero errors
npm test 2>&1                # all 90 tests pass
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(prompts): customizable prompts — PromptEditor, getPrompt(), per-tool localStorage override"
```
