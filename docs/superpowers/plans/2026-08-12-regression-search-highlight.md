# Regression Tracker: resalte de coincidencias + campo de búsqueda más ancho — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resaltar visualmente las coincidencias del término buscado en los resultados del Regression Tracker (incluido el caso de match solo en la URL oculta de una celda-enlace, señalado con tinte + tooltip) y duplicar el ancho del campo de búsqueda.

**Architecture:** Helper compartido `highlightMatches`/`containsMatch`/`MARK_STYLE` en `src/utils/highlight.tsx`. `RegressionCard` gana la prop opcional `highlightNeedle?: string` (sin ella, comportamiento idéntico); el resalte en celdas `<input>` reutiliza la técnica de overlay existente de los nombres SnapLink, unificada en un solo overlay por celda. `RegressionTracker` pasa el needle y ensancha el input.

**Tech Stack:** React 18 + TypeScript, Vitest + Testing Library (jsdom), i18n JSON ES/EN. Sin librerías nuevas.

**Spec:** `docs/superpowers/specs/2026-08-12-regression-search-highlight-design.md`

## Global Constraints

- **Cero dependencias nuevas.** **Cero cambios de formato** en la clave localStorage `acgen_regressions`.
- **i18n con paridad ES/EN**: clave nueva `regression.matchInUrl` = "Coincide en la URL del enlace" / "Match is in the link URL" en AMBOS archivos.
- **Sin `highlightNeedle` el card se comporta EXACTAMENTE igual que hoy** (tests existentes en verde sin tocarlos). El resalte solo existe con búsqueda activa.
- Estilo único del mark en todos los puntos de uso: `MARK_STYLE` exportado del helper (`background: 'var(--accent)', color: 'var(--surface)', borderRadius: 2, padding: '0 1px'`).
- **TDD**: test que falla → implementación mínima → verde → commit.
- Tests: `npx vitest run <ruta>` (archivo suelto) o `npm test` (suite completa, actualmente 455 tests / 45 archivos en verde).
- Rama de trabajo: `feat/regression-search-highlight` desde `main`. El cwd del repo es `acgen/`.
- Mensajes de commit estilo del repo: `feat(regression): ...` en minúsculas.

---

### Task 1: helper `highlight.tsx`

**Files:**
- Create: `src/utils/highlight.tsx`
- Test: `src/utils/highlight.test.tsx` (nuevo)

**Interfaces:**
- Consumes: nada.
- Produces (Tasks 2 y 3 dependen de estas firmas exactas):
  - `highlightMatches(text: string, needle: string): React.ReactNode[]` — divide `text` por coincidencias case-insensitive de `needle` (tras trim; needle vacío/blank → `[text]`), envolviendo cada coincidencia en `<mark style={MARK_STYLE}>` que conserva el TEXTO ORIGINAL (no el needle). Metacaracteres de regex escapados. Todas las ocurrencias marcadas.
  - `containsMatch(text: string, needle: string): boolean` — substring case-insensitive tras trim del needle; needle blank → false.
  - `MARK_STYLE: React.CSSProperties` — el estilo de resalte compartido.

- [ ] **Step 1: Crear la rama**

```bash
git checkout -b feat/regression-search-highlight
```

- [ ] **Step 2: Escribir los tests que fallan**

Crear `src/utils/highlight.test.tsx`:

```tsx
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { highlightMatches, containsMatch } from './highlight';

function renderNodes(nodes: React.ReactNode[]) {
  return render(<span>{nodes}</span>);
}

describe('highlightMatches', () => {
  it('returns the plain text when needle is empty or blank', () => {
    expect(highlightMatches('hola', '')).toEqual(['hola']);
    expect(highlightMatches('hola', '   ')).toEqual(['hola']);
  });

  it('renders no <mark> when there is no match', () => {
    const { container } = renderNodes(highlightMatches('hola mundo', 'zzz'));
    expect(container.querySelectorAll('mark')).toHaveLength(0);
    expect(container.textContent).toBe('hola mundo');
  });

  it('wraps a single match in <mark> and the full text survives', () => {
    const { container } = renderNodes(highlightMatches('BSKWEB-1475', '1475'));
    const marks = container.querySelectorAll('mark');
    expect(marks).toHaveLength(1);
    expect(marks[0].textContent).toBe('1475');
    expect(container.textContent).toBe('BSKWEB-1475');
  });

  it('marks all occurrences case-insensitively preserving original casing', () => {
    const { container } = renderNodes(highlightMatches('Abc abc ABC', 'abc'));
    const marks = container.querySelectorAll('mark');
    expect(marks).toHaveLength(3);
    expect([...marks].map((m) => m.textContent)).toEqual(['Abc', 'abc', 'ABC']);
  });

  it('escapes regex metacharacters in the needle', () => {
    const { container } = renderNodes(highlightMatches('bug (crítico) [DESK]', '(crítico)'));
    expect(container.querySelectorAll('mark')).toHaveLength(1);
    expect(container.querySelector('mark')!.textContent).toBe('(crítico)');
  });
});

describe('containsMatch', () => {
  it('is case-insensitive and trims the needle', () => {
    expect(containsMatch('BSKWEB-1475', ' 1475 ')).toBe(true);
    expect(containsMatch('hola', 'HOLA')).toBe(true);
    expect(containsMatch('hola', 'zzz')).toBe(false);
    expect(containsMatch('hola', '   ')).toBe(false);
  });
});
```

- [ ] **Step 3: Verificar que fallan**

Run: `npx vitest run src/utils/highlight.test.tsx`
Expected: FAIL — no resuelve el módulo `./highlight`.

- [ ] **Step 4: Implementación mínima**

Crear `src/utils/highlight.tsx`:

```tsx
// Resalte compartido de coincidencias de búsqueda (Regression Tracker).
// El mismo estilo de <mark> en todos los puntos de uso; el amarillo UA
// por defecto no casa con el tema.
export const MARK_STYLE: React.CSSProperties = {
  background: 'var(--accent)', color: 'var(--surface)', borderRadius: 2, padding: '0 1px',
};

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function containsMatch(text: string, needle: string): boolean {
  const n = needle.trim().toLowerCase();
  return n !== '' && text.toLowerCase().includes(n);
}

export function highlightMatches(text: string, needle: string): React.ReactNode[] {
  const n = needle.trim();
  if (!n) return [text];
  const re = new RegExp(escapeRegExp(n), 'gi');
  const nodes: React.ReactNode[] = [];
  let last = 0;
  let key = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    nodes.push(<mark key={key++} style={MARK_STYLE}>{m[0]}</mark>);
    last = m.index + m[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes.length ? nodes : [text];
}
```

- [ ] **Step 5: Verificar que pasan**

Run: `npx vitest run src/utils/highlight.test.tsx`
Expected: PASS (7 tests).

- [ ] **Step 6: Commit**

```bash
git add src/utils/highlight.tsx src/utils/highlight.test.tsx
git commit -m "feat(regression): helper de resalte de coincidencias (highlightMatches/containsMatch)"
```

---

### Task 2: prop `highlightNeedle` en `RegressionCard`

**Files:**
- Modify: `src/components/RegressionCard.tsx`
- Modify: `src/i18n/es.json`, `src/i18n/en.json` (clave `regression.matchInUrl`)
- Test: `src/components/RegressionCard.test.tsx`

**Interfaces:**
- Consumes: `highlightMatches`, `containsMatch`, `MARK_STYLE` de `src/utils/highlight` (Task 1).
- Produces (Task 3 la consume): `highlightNeedle?: string` — término de búsqueda (crudo, el card hace trim); resalta versión, enlace del Excel y celdas de tickets. Sin la prop, comportamiento idéntico al actual.

- [ ] **Step 1: Añadir la clave i18n**

`src/i18n/es.json`, junto al bloque `regression.*`:

```json
"regression.matchInUrl": "Coincide en la URL del enlace",
```

`src/i18n/en.json`:

```json
"regression.matchInUrl": "Match is in the link URL",
```

- [ ] **Step 2: Escribir los tests que fallan**

Añadir al final del `describe('RegressionCard')` en `src/components/RegressionCard.test.tsx` (los helpers `makeRegression`/`renderCard` ya existen; `makeRegression` usa `url: 'Excel Regresión - https://sheets.example.com/reg/1'`):

```tsx
describe('highlightNeedle', () => {
  it('marks the matching substring in the version and in a plain ticket cell overlay', () => {
    renderCard({
      highlightNeedle: '1.0',
      forceExpanded: true,
      regression: makeRegression({
        tickets: [{ id: 't1', ticket: '', fecha: '', prioridad: 'P1.0', creador: '', squad: '', status: '' }],
      }),
    });
    const marks = [...document.querySelectorAll('mark')];
    expect(marks.length).toBeGreaterThanOrEqual(2); // versión "1.0.0" + celda "P1.0"
    expect(marks.every((m) => m.textContent === '1.0')).toBe(true);
  });

  it('tints the whole link name and shows the matchInUrl tooltip when the match is only in the hidden URL', () => {
    renderCard({
      highlightNeedle: '1475',
      forceExpanded: true,
      regression: makeRegression({
        tickets: [{ id: 't1', ticket: '[DESK] toast roto - https://jira.example.com/browse/BSKWEB-1475', fecha: '', prioridad: '', creador: '', squad: '', status: '' }],
      }),
    });
    const td = document.querySelector('td[title="Coincide en la URL del enlace"]');
    expect(td).not.toBeNull();
    expect(td!.textContent).toContain('[DESK] toast roto');
    expect(td!.querySelectorAll('mark')).toHaveLength(0); // nombre entero tintado, sin submarca
  });

  it('highlights the substring inside the link name when the visible name matches', () => {
    renderCard({
      highlightNeedle: 'toast',
      forceExpanded: true,
      regression: makeRegression({
        tickets: [{ id: 't1', ticket: '[DESK] toast roto - https://jira.example.com/browse/BSKWEB-1475', fecha: '', prioridad: '', creador: '', squad: '', status: '' }],
      }),
    });
    const overlayMark = [...document.querySelectorAll('tbody mark')].find((m) => m.textContent === 'toast');
    expect(overlayMark).toBeTruthy();
    expect(document.querySelector('td[title="Coincide en la URL del enlace"]')).toBeNull();
  });

  it('focusing a highlighted cell removes the overlay and blur restores it', () => {
    renderCard({
      highlightNeedle: 'P1',
      forceExpanded: true,
      regression: makeRegression({
        tickets: [{ id: 't1', ticket: '', fecha: '', prioridad: 'P1', creador: '', squad: '', status: '' }],
      }),
    });
    const input = screen.getByDisplayValue('P1') as HTMLInputElement;
    expect(document.querySelectorAll('tbody mark')).toHaveLength(1);
    fireEvent.focus(input);
    expect(document.querySelectorAll('tbody mark')).toHaveLength(0);
    fireEvent.blur(input);
    expect(document.querySelectorAll('tbody mark')).toHaveLength(1);
  });

  it('without highlightNeedle no <mark> is rendered', () => {
    renderCard({ forceExpanded: true });
    expect(document.querySelectorAll('mark')).toHaveLength(0);
  });

  it('tints the header excel link and shows the tooltip when the match is only in its URL', () => {
    renderCard({ highlightNeedle: 'sheets.example' });
    const link = screen.getByRole('link', { name: /Excel Regresión/ });
    expect(link).toHaveAttribute('title', 'Coincide en la URL del enlace');
  });
});
```

- [ ] **Step 3: Verificar que fallan**

Run: `npx vitest run src/components/RegressionCard.test.tsx`
Expected: FAIL — los 6 tests nuevos en rojo (no hay `<mark>` ni tooltip); los existentes en verde. (El test "without highlightNeedle" puede pasar ya — es el snapshot de compatibilidad; los otros 5 deben fallar.)

- [ ] **Step 4: Implementación mínima**

En `src/components/RegressionCard.tsx`:

1. Import nuevo:

```ts
import { highlightMatches, containsMatch, MARK_STYLE } from '../utils/highlight';
```

2. Prop nueva en la interfaz y el destructuring:

```ts
highlightNeedle?: string;
```

3. Derivados, junto a `urlParts`/`ticketCount` (después de la línea `const urlParts = ...`):

```ts
const needle = highlightNeedle?.trim() ?? '';
const urlVisibleText = urlParts ? (urlParts.name ?? urlParts.url) : '';
const urlVisibleMatch = needle !== '' && urlParts !== null && containsMatch(urlVisibleText, needle);
const urlHiddenMatch = needle !== '' && urlParts !== null && !urlVisibleMatch && containsMatch(regression.url, needle);
```

4. El estado `focusedCell` pasa a clave compuesta (hoy solo rastrea la columna ticket). Cambiar el comentario de la línea del useState a `// \`${ticketId}:${field}\``. (El tipo ya es `string | null`.)

5. Cabecera, rama no-editing:
   - Versión: `<span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>{needle ? highlightMatches(regression.version, needle) : regression.version}</span>`
   - Anchor del Excel: `title` pasa a `{urlHiddenMatch ? t('regression.matchInUrl') : t('regression.openLinkDirect')}` y su contenido `{urlParts.name ?? urlParts.url} ↗` pasa a:

```tsx
{urlVisibleMatch
  ? highlightMatches(urlVisibleText, needle)
  : urlHiddenMatch
    ? <span style={MARK_STYLE}>{urlVisibleText}</span>
    : urlParts.name ?? urlParts.url} ↗
```

6. Celdas de tickets — sustituir el cuerpo del `TICKET_COLUMNS.map` (los derivados `value`/`parts`/`isFocused`/`showNameOverlay` y el `<td>` completo) por la versión unificada de un-overlay-por-celda. El botón ↗ queda EXACTAMENTE como está:

```tsx
{TICKET_COLUMNS.map(({ field }) => {
  const value = ticket[field];
  const parts = field === 'ticket' ? parseUrlCell(value) : null;
  const cellKey = `${ticket.id}:${field}`;
  const isFocused = focusedCell === cellKey;
  const visibleText = parts ? (parts.name ?? parts.url) : value;
  const visibleMatch = needle !== '' && containsMatch(visibleText, needle);
  const hiddenMatch = needle !== '' && !visibleMatch && containsMatch(value, needle);
  // Un solo overlay por celda: nombre SnapLink (resaltado, tintado o plano)
  // o texto plano resaltado. Con foco no hay overlay: edición normal.
  let overlayContent: React.ReactNode = null;
  if (!isFocused) {
    if (parts?.name) {
      overlayContent = visibleMatch
        ? highlightMatches(parts.name, needle)
        : hiddenMatch
          ? <span style={MARK_STYLE}>{parts.name}</span>
          : parts.name;
    } else if (visibleMatch) {
      overlayContent = highlightMatches(visibleText, needle);
    }
  }
  const showOverlay = overlayContent !== null;
  return (
    <td
      key={field}
      onClick={(e) => {
        if (parts && e.ctrlKey) window.open(parts.url, '_blank', 'noopener,noreferrer');
      }}
      title={hiddenMatch && parts ? t('regression.matchInUrl') : parts ? t('regression.openLink') : undefined}
      style={{
        border: '1px solid var(--border)', padding: 0, position: 'relative', overflow: 'hidden',
        cursor: parts ? 'pointer' : undefined,
      }}
    >
      <input
        type="text"
        value={value}
        readOnly={readOnly}
        onChange={(e) => onUpdateTicket?.(ticket.id, field, e.target.value)}
        onFocus={() => setFocusedCell(cellKey)}
        onBlur={() => setFocusedCell((prev) => (prev === cellKey ? null : prev))}
        style={{
          width: '100%', height: 28, border: 'none', outline: 'none',
          padding: '0 6px', fontSize: 12, fontFamily: 'var(--font-mono)', background: 'transparent',
          color: showOverlay ? 'transparent' : parts ? 'var(--accent)' : 'var(--text)',
          fontWeight: parts ? 600 : 400,
          cursor: parts ? 'pointer' : undefined,
        }}
      />
      {showOverlay && (
        <span style={{
          position: 'absolute', left: 0, right: 0, top: 0, height: 28, lineHeight: '28px',
          padding: '0 6px', fontSize: 12, fontFamily: 'var(--font-mono)',
          color: parts ? 'var(--accent)' : 'var(--text)', fontWeight: parts ? 600 : 400,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          pointerEvents: 'none',
        }}>{overlayContent}</span>
      )}
      {parts && (
        <button
          type="button"
          className="cell-open-link"
          tabIndex={-1}
          title={t('regression.openLinkDirect')}
          aria-label={t('regression.openLinkDirect')}
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) => {
            e.stopPropagation();
            window.open(parts.url, '_blank', 'noopener,noreferrer');
          }}
        >
          ↗
        </button>
      )}
    </td>
  );
})}
```

Notas de diseño (ya decididas en spec): sin needle, `visibleMatch`/`hiddenMatch` son false y el overlay solo aparece para nombres SnapLink — comportamiento idéntico al actual (el nombre plano `parts.name` era el overlay de siempre); `onFocus`/`onBlur` pasan de solo-columna-ticket a todas las columnas (necesario para que el foco quite el overlay de resalte en cualquier celda; para columnas sin overlay es inocuo); en celdas no-enlace `hiddenMatch` es imposible por construcción (`visibleText === value`).

- [ ] **Step 5: Verificar que pasan (incluida la paridad i18n y cero regresiones del card)**

Run: `npx vitest run src/components/RegressionCard.test.tsx src/i18n`
Expected: PASS (los 6 nuevos + los existentes + paridad ES/EN).

- [ ] **Step 6: Commit**

```bash
git add src/components/RegressionCard.tsx src/components/RegressionCard.test.tsx src/i18n/es.json src/i18n/en.json
git commit -m "feat(regression): resalte de coincidencias en tarjetas y celdas (highlightNeedle)"
```

---

### Task 3: `RegressionTracker` — pasar el needle + campo al doble

**Files:**
- Modify: `src/components/RegressionTracker.tsx`
- Test: `src/components/RegressionTracker.test.tsx`

**Interfaces:**
- Consumes: prop `highlightNeedle?: string` de `RegressionCard` (Task 2); estado `needle` ya existente en el tracker.
- Produces: nada para tasks posteriores.

- [ ] **Step 1: Escribir los tests que fallan**

Añadir al final del `describe('search', ...)` existente en `src/components/RegressionTracker.test.tsx`:

```tsx
it('search results render highlighted matches inside the cards', () => {
  renderTracker();
  createRegression('1.0.0');
  fireEvent.change(screen.getByPlaceholderText(/Buscar por versión/), { target: { value: '1.0' } });
  const marks = document.querySelectorAll('mark');
  expect(marks.length).toBeGreaterThan(0);
  expect(marks[0].textContent).toBe('1.0');
});

it('the search input is twice as wide (440px)', () => {
  renderTracker();
  const input = screen.getByPlaceholderText(/Buscar por versión/) as HTMLInputElement;
  expect(input.style.width).toBe('440px');
});
```

- [ ] **Step 2: Verificar que fallan**

Run: `npx vitest run src/components/RegressionTracker.test.tsx`
Expected: FAIL — 0 marks y width `220px` (2 tests nuevos en rojo).

- [ ] **Step 3: Implementación mínima**

En `src/components/RegressionTracker.tsx`:

1. En el `visible.map(...)` de la lista, añadir a `<RegressionCard>` (junto a `forceExpanded`/`visibleTicketIds`):

```tsx
highlightNeedle={needle || undefined}
```

(Las tarjetas readonly del historial NO la reciben — no tocar esa rama.)

2. El input de búsqueda: `style={{ ...formInputStyle, width: 220 }}` → `style={{ ...formInputStyle, width: 440, maxWidth: '100%' }}`.

- [ ] **Step 4: Verificar que pasan**

Run: `npx vitest run src/components/RegressionTracker.test.tsx`
Expected: PASS (todos).

- [ ] **Step 5: Commit**

```bash
git add src/components/RegressionTracker.tsx src/components/RegressionTracker.test.tsx
git commit -m "feat(regression): needle de resalte a las tarjetas y buscador al doble de ancho"
```

---

### Task 4: verificación integral y sincronización de docs

**Files:**
- Modify: `AGENTS.md`, `README.md` (solo las menciones al recuento de tests)

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: rama lista para merge.

- [ ] **Step 1: Suite completa, lint y build**

Run: `npm test`
Expected: PASS — 0 fallos; anotar el recuento nuevo (antes: 455 tests / 45 archivos; deben ser ~470 tests / 46 archivos por `highlight.test.tsx`).

Run: `npm run lint`
Expected: 0 errores.

Run: `npm run build`
Expected: build de producción sin errores.

- [ ] **Step 2: Verificación manual en Chrome contra build de producción**

```bash
npm run preview
```

En Chrome (http://localhost:4173), vista Regression:

1. Crear una regresión con un ticket SnapLink `[DESK] toast roto - https://jira.example.com/browse/BSKWEB-1475`; buscar `1475` → el nombre `[DESK] toast roto` aparece ENTERO tintado con tooltip "Coincide en la URL del enlace" (escenario exacto de la captura de Jorge).
2. Buscar `toast` → solo la palabra "toast" resaltada dentro del nombre.
3. Buscar por versión (p.ej. `1.0`) → subcadena resaltada en la versión de la cabecera.
4. Click en una celda resaltada → el overlay desaparece y se edita el valor crudo con caret visible; al salir vuelve el resalte.
5. El campo de búsqueda se ve al doble de ancho y no desborda al estrechar la ventana.
6. Consola sin errores ni warnings.

- [ ] **Step 3: Sincronizar recuento de tests en docs**

Actualizar las menciones "455" (tests) y "45" (archivos de test) en `AGENTS.md` y `README.md` al recuento real del Step 1.

- [ ] **Step 4: Commit final**

```bash
git add AGENTS.md README.md
git commit -m "docs: sync recuento de tests tras resalte de búsqueda"
```

Después, usar la skill superpowers:finishing-a-development-branch.
