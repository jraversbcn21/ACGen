### Task 6: Sincronizar AGENTS.md y verificación final

**Files:**
- Modify: `AGENTS.md`

**Interfaces:**
- Consumes: los totales reales de la suite tras las Tasks 1-5 (esperado: 254 tests / 30 ficheros — verificar con la salida real de `npm test` y usar ESOS números).
- Produces: AGENTS.md fiel al estado del repo.

- [ ] **Step 1: Ejecutar la suite y anotar los totales reales**

Run: `npm test`
Expected: `Test Files 30 passed (30)`, `Tests 254 passed (254)`. Si difiere, usar los números reales en los pasos siguientes.

- [ ] **Step 2: Actualizar AGENTS.md**

1. Tabla de tests — añadir tres filas y actualizar la de LandingScreen:

```markdown
| `src/components/TrackerGrid.test.tsx` | 11 — shared spreadsheet: tabs/headers render and switch, jira mode (ctrl+click opens baseUrl/browse/KEY, SnapLink paste → "KEY Nombre"), url mode (ctrl+click opens the exact pasted URL, bare URL, plain text is not a link, accent styling), readOnly (inputs readonly, no "+ Fila", no drag), "+ Fila" appends, dragDisabled removes handles |
| `src/hooks/useRegressions.test.ts` | 12 — init 4×(20×6), updateGridCell, persistence+hydration, setTabGrid, moveRow (incl. out-of-range), archiveBoard (snapshot+clear+name "Regresión YYYY-MM-DD", persisted), deleteArchived, corrupt JSON, missing-platform merge, quota resilience |
| `src/components/RegressionTracker.test.tsx` | 6 — 4 platform tabs + headers, "Nombre - URL" cell is an accent link that ctrl+click opens, per-platform grids, archive flow (confirm → cleared board → "Archivadas (1)" → snapshot listed), snapshot read-only, delete archived → empty state |
```

Fila de LandingScreen — actualizar a:

```markdown
| `src/components/LandingScreen.test.tsx` | 4 — 10 tool cards rendered, centered `.landing` wrapper present, "more coming" slot is the tool grid's 11th cell, `onSelect` fires |
```

Línea de total: `**Total: 254 tests across 30 files.**` (o los números reales del Step 1).

2. Sección **Architecture**:
- Línea de hash-based routing / ViewType: añadir `'regressiontracker'` a la lista de vistas.
- Línea de Settings persistence: añadir `Regression tracker board+archived as `acgen_regressions`, column widths as `acgen_regression_col_widths`.`

3. Sección **Tools**: el encabezado pasa a `## Tools (10 total)` y en el grupo de tracking (donde está Sprint Tracker) añadir la fila:

```markdown
| Regression Tracker | `regressiontracker` | `RegressionTracker.tsx`, `TrackerGrid.tsx`, `useRegressions.ts` | No |
```

(Ajustar las columnas exactas al formato real de la tabla de AGENTS.md al editarla.)

4. Si AGENTS.md menciona que `SprintDashboard` contiene el spreadsheet, actualizar la mención: el spreadsheet vive ahora en `TrackerGrid.tsx` (compartido por Sprint Tracker y Regression Tracker).

- [ ] **Step 3: Verificación final completa**

Run: `npm test` → verde con los totales de AGENTS.md.
Run: `npm run lint` → sin errores.
Run: `npm run build` → compila (tsc + vite) sin errores.

- [ ] **Step 4: Commit**

```bash
git add AGENTS.md
git commit -m "docs: sync AGENTS.md with Regression Tracker and TrackerGrid extraction

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```
