### Task 5: Integración — routing, landing, sidebar, icono

**Files:**
- Modify: `src/config/constants.ts` (línea del `ViewType`, actualmente 81)
- Modify: `src/App.tsx` (imports ~línea 10, `VALID_VIEWS` línea 25, render tras el bloque `sprinttracker` línea 176-178)
- Modify: `src/components/Icons.tsx` (añadir `regression` al objeto `Icon`, tras `sprint`)
- Modify: `src/components/LandingScreen.tsx` (tipo de `onSelect` línea 6, array `tools` tras la entrada `sprinttracker`)
- Modify: `src/components/Sidebar.tsx` (array `TOOLS`, tras la entrada `sprinttracker`)
- Modify: `src/components/LandingScreen.test.tsx`

**Interfaces:**
- Consumes: `RegressionTracker` (Task 4), claves i18n `landing.tool.regressiontracker(+Desc)` y `sidebar.regression` (Task 4).
- Produces: vista `'regressiontracker'` accesible por hash `#/regressiontracker`, tarjeta décima en landing, entrada en sidebar (grupo Seguimiento).

- [ ] **Step 1: Actualizar los tests de landing (fallan)**

En `src/components/LandingScreen.test.tsx`:

Test `renders the 9 tool buttons` pasa a:

```tsx
  it('renders the 10 tool buttons', () => {
    renderLanding();
    const list = document.querySelector('.tool-list');
    expect(list?.querySelectorAll('.tool-row')).toHaveLength(10);
  });
```

Test del slot pasa a:

```tsx
  it('places the "more coming" slot inside the tool grid as its 11th cell', () => {
    renderLanding();
    const list = document.querySelector('.tool-list');
    const slot = list?.querySelector('.add-slot');
    expect(slot).not.toBeNull();
    expect(list?.children).toHaveLength(11);
  });
```

- [ ] **Step 2: Ejecutar para verificar que fallan**

Run: `npm test -- src/components/LandingScreen.test.tsx`
Expected: FAIL — `expected 9 to be 10` y `expected 10 to be 11`.

- [ ] **Step 3: `ViewType` y `App.tsx`**

En `src/config/constants.ts`, la línea del tipo queda:

```ts
export type ViewType = 'landing' | 'acceptance' | 'testcase' | 'bugreport' | 'testdata' | 'sprinttracker' | 'regressiontracker' | 'userstory' | 'refiner' | 'edgecase' | 'converter';
```

En `src/App.tsx`:

Import (tras el de `SprintTracker`):

```tsx
import { RegressionTracker } from './components/RegressionTracker';
```

`VALID_VIEWS` queda:

```tsx
const VALID_VIEWS: ViewType[] = ['landing', 'acceptance', 'testcase', 'bugreport', 'testdata', 'sprinttracker', 'regressiontracker', 'userstory', 'refiner', 'edgecase', 'converter'];
```

Render, justo después del bloque `{view === 'sprinttracker' && (...)}`:

```tsx
          {view === 'regressiontracker' && (
            <RegressionTracker />
          )}
```

- [ ] **Step 4: Icono `Icon.regression`**

En `src/components/Icons.tsx`, dentro del objeto `Icon`, después de la entrada `sprint`: flecha circular de re-ejecución con check dentro (mismo estilo: 24×24, stroke 1.6, `currentColor`):

```tsx
  regression: (p: SvgProps) => (
    <Svg {...p}>
      <path d="M20 12a8 8 0 1 1-2.34-5.66" />
      <path d="M20 4v4h-4" />
      <path d="m8.8 12.5 2.2 2.2 4.2-4.2" />
    </Svg>
  ),
```

- [ ] **Step 5: Landing y Sidebar**

En `src/components/LandingScreen.tsx`:

El tipo de `onSelect` (línea 6) queda:

```tsx
  onSelect: (view: 'acceptance' | 'testcase' | 'bugreport' | 'testdata' | 'userstory' | 'refiner' | 'edgecase' | 'converter' | 'sprinttracker' | 'regressiontracker') => void;
```

En el array `tools`, después de la entrada `sprinttracker`:

```tsx
  {
    id: 'regressiontracker' as const,
    icon: Icon.regression,
    titleKey: 'landing.tool.regressiontracker',
    descKey: 'landing.tool.regressiontrackerDesc',
    tag: 'Tracking',
  },
```

En `src/components/Sidebar.tsx`, en el array `TOOLS`, después de la entrada `sprinttracker`:

```tsx
  { view: 'regressiontracker' as ViewType, icon: Icon.regression, labelKey: 'sidebar.regression', categoryKey: 'sidebar.seguimiento' },
```

- [ ] **Step 6: Ejecutar tests de landing y suite completa**

Run: `npm test -- src/components/LandingScreen.test.tsx`
Expected: PASS (4 tests).

Run: `npm test`
Expected: `Tests 254 passed` (mismo total: landing sigue con 4 tests).

- [ ] **Step 7: Verificación manual en dev**

Run: `npm run dev` y abrir `http://localhost:5173/#/regressiontracker`.
Comprobar: la tarjeta aparece en landing y navega; las 4 pestañas cambian de grid; pegar `Nombre - URL` en la columna A pinta el enlace y Ctrl+clic lo abre; "Archivar Regresión" pide confirmación, vacía el tablero y aparece "Archivadas (1)"; el snapshot se abre en solo-lectura. Parar el server al acabar.

- [ ] **Step 8: Commit**

```bash
git add src/config/constants.ts src/App.tsx src/components/Icons.tsx src/components/LandingScreen.tsx src/components/Sidebar.tsx src/components/LandingScreen.test.tsx
git commit -m "feat(regression): wire Regression Tracker into routing, landing and sidebar

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

