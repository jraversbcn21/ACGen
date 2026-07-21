### Task 4: Verificación completa + sync de docs

**Files:**
- Modify: `AGENTS.md:62` (recuento de tests) y tabla de historial (línea ~376, añadir fila)
- Modify: `README.md:86` (recuento de tests)

**Interfaces:**
- Consumes: suite completa en verde tras Tasks 1-3 (376 existentes + 9 nuevos = 385 en 40 archivos).
- Produces: docs sincronizados; rama lista para PR.

- [ ] **Step 1: Suite completa, lint y build**

Run: `npm test` → Expected: `Tests  385 passed (385)`, `Test Files  40 passed (40)`.
Run: `npm run lint` → Expected: sin errores.
Run: `npm run build` → Expected: build OK sin errores de tipos.

Si el recuento real difiere de 385, usar el número real en los pasos siguientes.

- [ ] **Step 2: Actualizar AGENTS.md**

Línea 62: `**Total: 376 tests across 40 files.**` → `**Total: 385 tests across 40 files.**`

Añadir fila al final de la tabla de historial (tras la fila "Regression Tracker: 2 platform tabs"):

```markdown
| Sprint Tracker: enlaces de ticket rotos | 2026-07-21 | Los tickets abrían la propia app: `acgen_tracker_base_url` no tenía escritores desde la eliminación de Jira (`4c258a3`) y el enlace salía relativo (`/browse/KEY` → rewrite SPA). Fix en `TrackerGrid`: guardia (`getLinkUrl` → `null` sin base URL, celdas sin estilo de enlace + title de aviso), migración one-shot de la clave huérfana `acgen_jira_base_url` (intacta, criterio datos-Android), y botón ⚙ (solo modo jira) con input inline que persiste normalizando barras finales. 376 → 385 tests. |
```

- [ ] **Step 3: Actualizar README.md**

Línea 86: `| Tests | Vitest + React Testing Library (376 tests) |` → `(385 tests)`.

- [ ] **Step 4: Commit**

```bash
git add AGENTS.md README.md
git commit -m "docs: sync test counts and the tracker base URL fix into AGENTS.md/README"
```
