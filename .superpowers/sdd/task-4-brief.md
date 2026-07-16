### Task 4: ErrorBoundary

**Files:**
- Modify: `src/i18n/I18nContext.tsx` (export the context object)
- Modify: `src/components/ErrorBoundary.tsx`
- Modify: `src/components/ErrorBoundary.test.tsx` (3 existing tests; add 1)

**Interfaces:**
- Produces: `export { I18nContext }` from `src/i18n/I18nContext.tsx` (type `React.Context<I18nContextValue | null>`).

- [ ] **Step 1: Write the failing test**

Add to `src/components/ErrorBoundary.test.tsx` (match the existing crash-component helper already in that file — it has one for the "catches crash" test; reuse it):

```tsx
it('renders the fallback in English when lang is en', () => {
  localStorage.setItem('acgen_lang', '"en"');
  render(
    <I18nProvider>
      <ErrorBoundary><Bomb /></ErrorBoundary>
    </I18nProvider>
  );
  expect(screen.getByText('Something went wrong. Please reload or try again.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  localStorage.clear();
});
```

(`Bomb` = whatever throwing component the existing tests define; import `I18nProvider` at the top.)

- [ ] **Step 2: Run to verify RED**

Run: `npx vitest run src/components/ErrorBoundary.test.tsx`
Expected: the new test FAILS (Spanish literals); the existing 3 still pass.

- [ ] **Step 3: Implement**

In `src/i18n/I18nContext.tsx`, change the context declaration (line 16) to export it:

```ts
export const I18nContext = createContext<I18nContextValue | null>(null);
```

(Also export the `I18nContextValue` interface.)

In `src/components/ErrorBoundary.tsx`:

```tsx
import { Component } from 'react';
import type { ErrorInfo, ReactNode, ContextType } from 'react';
import { I18nContext } from '../i18n/I18nContext';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  static contextType = I18nContext;
  declare context: ContextType<typeof I18nContext>;

  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReset = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    if (this.state.error) {
      // Defensive Spanish fallback: the boundary must never crash while rendering a crash.
      const t = this.context?.t ?? ((key: string) => key === 'error.boundary'
        ? 'Algo salio mal. Por favor, recarga la pagina o intenta de nuevo.'
        : 'Reintentar');
      return (
        <div className="error-boundary-fallback">
          <h2>{t('error.boundary')}</h2>
          <p>{this.state.error.message}</p>
          <button type="button" className="btn" onClick={this.handleReset}>
            {t('common.retry')}
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
```

Note the existing 3 tests render ErrorBoundary **without** a provider — the defensive fallback keeps them meaningful; do not wrap them.

- [ ] **Step 4: Run to verify GREEN**

Run: `npx vitest run src/components/ErrorBoundary.test.tsx`
Expected: 4 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/i18n/I18nContext.tsx src/components/ErrorBoundary.tsx src/components/ErrorBoundary.test.tsx
git commit -m "feat(i18n): ErrorBoundary fallback via I18nContext contextType"
```

---

