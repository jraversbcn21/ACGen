### Task 3.1.2: Anonymizer UI components + API integration

**Files:**
- Create: `src/components/AnonymizerReview.tsx`
- Create: `src/components/ConfidentialToggle.tsx`
- Modify: `src/services/apiService.ts` — `streamWithGroq()` accepts `anonymizeMap`

**Interfaces:**
- Consumes: `anonymize()`, `deanonymize()` from `src/services/anonymizer.ts` (already created in Task 3.1.1)
- Produces: `<AnonymizerReview>` modal, `<ConfidentialToggle>` toggle, `streamWithGroq` with `anonymizeMap` param

**Context:** The anonymizer service with 7 regex patterns and 13 passing tests already exists at `src/services/anonymizer.ts`. This task creates the UI layer and integrates deanonymization into the streaming API pipeline.

- [ ] **Step 1: Add anonymization support to streamWithGroq in apiService.ts**

In `src/services/apiService.ts`, add the import for deanonymize (at the top of the file, near existing imports):

```typescript
import { deanonymize } from './anonymizer';
```

Find the `streamWithGroq` function signature:
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

Add a new optional parameter `anonymizeMap` at the end (before the colon):
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

In the streaming loop, find where tokens are yielded:
```typescript
          const token = parsed.choices?.[0]?.delta?.content;
          if (token) yield { token, done: false, model: parsed.model };
```

Replace with (add deanonymize pass-through):
```typescript
          const rawToken: string | undefined = parsed.choices?.[0]?.delta?.content;
          if (rawToken) {
            const token = anonymizeMap ? deanonymize(rawToken, anonymizeMap) : rawToken;
            yield { token, done: false, model: parsed.model };
          }
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
npx tsc -b --noEmit 2>&1
```

Expected: no type errors.

```bash
npm test 2>&1
```

Expected: all 78 tests pass (13 anonymizer + 65 original).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(confidential): AnonymizerReview modal, ConfidentialToggle, API deanonymization"
```
