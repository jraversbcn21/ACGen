# Perfil y Prompts alcanzables desde el landing — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir un segundo punto de entrada a `<ProfileEditor>` y `<PromptEditor>` en el `config-strip` del landing, para que ambos dejen de ser inalcanzables desde la portada.

**Architecture:** `LandingScreen` gana dos botones y su propio estado de modal, replicando el patrón que ya usa `Sidebar`. No se levanta estado a `App.tsx` porque landing y Sidebar son mutuamente excluyentes (`App.tsx:147`). `.config-strip` pasa de simple margen a contenedor flex. De paso se crea `Icon.profile` para que el botón deje de reutilizar el glifo de Historia de Usuario.

**Tech Stack:** React 18 + TypeScript, Vite, Vitest + @testing-library/react (jsdom), CSS plano en `src/App.css`, i18n propio por JSON (`src/i18n/{es,en}.json`).

## Global Constraints

- **Directorio de trabajo:** todos los comandos se ejecutan desde `C:\repositorio\ACGen\acgen` (el repo git está en la subcarpeta `acgen/`, no en la raíz).
- **Rama:** `feat/profile-prompts-en-landing`, ya creada y con la spec commiteada (`a4b9822`). No trabajar sobre `main`.
- **Baseline verificado el 2026-08-14:** 548 tests en 55 ficheros, todos en verde. Cualquier caída por debajo de 548 es una regresión, no un ajuste.
- **i18n: CERO claves nuevas.** Se reutilizan `sidebar.profile` y `sidebar.prompts`. Las dos locales deben seguir con **285 claves exactas** y paridad ES/EN.
- **GOTCHA DE TESTS — el idioma por defecto en jsdom es INGLÉS.** `detectLang()` (`src/i18n/I18nContext.tsx:26`) lee `navigator.language`, que en jsdom es `'en-US'`, y devuelve `'en'`. Por eso los tests actuales de `LandingScreen.test.tsx` nunca afirman sobre texto. **Todo test nuevo que afirme sobre texto visible DEBE fijar el idioma primero** con `localStorage.setItem('acgen_lang', JSON.stringify('es'))` en un `beforeEach`, igual que hace `Sidebar.test.tsx:26`.
- **Limpieza de localStorage:** los modales persisten en `localStorage`. Todo bloque de tests nuevo necesita `afterEach(() => localStorage.clear())`.
- **Estilo de commits del repo:** mensajes en español, `tipo(ámbito): descripción en minúscula`. Cerrar con el trailer `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`.

## File Structure

| Fichero | Estado | Responsabilidad |
|---|---|---|
| `src/components/Icons.tsx` | Modificar | Añadir `Icon.profile` (tarjeta de identificación) al objeto `Icon`, tras `userstory` |
| `src/components/Icons.test.tsx` | **Crear** | Blindar que `Icon.profile` existe y dibuja algo distinto de `Icon.userstory` |
| `src/components/Sidebar.tsx` | Modificar (línea 85) | El botón "Perfil" pasa de `Icon.userstory` a `Icon.profile` |
| `src/components/Sidebar.test.tsx` | Modificar (append) | Test de que Perfil y Hist. de Usuario ya no comparten glifo |
| `src/components/LandingScreen.tsx` | Modificar | Dos botones nuevos en el `config-strip` + estado local de los dos modales |
| `src/components/LandingScreen.test.tsx` | Modificar (append) | Tests de apertura/cierre de ambos modales desde el landing |
| `src/App.css` | Modificar (línea 153) | `.config-strip` a flex + regla nueva `.config-actions` |
| `AGENTS.md` | Modificar | Cerrar los dos pendientes de "Known issues" + fila en "Evolution history" |
| `README.md` | Modificar | Actualizar el recuento de tests |

`src/components/ProfileEditor.tsx` y `src/components/PromptEditor.tsx` **no se tocan**: su único prop es `onClose` y ya son autónomos.

---

### Task 1: `Icon.profile` y desacople del glifo duplicado

Hoy el botón "Perfil" del Sidebar usa `Icon.userstory`, exactamente el mismo glifo que la entrada de navegación "Hist. de Usuario" — dos cosas distintas con el mismo dibujo en la misma barra. Esta tarea crea un icono propio y lo cablea.

**Files:**
- Modify: `src/components/Icons.tsx:113` (insertar tras el cierre de `userstory`)
- Modify: `src/components/Sidebar.tsx:85`
- Create: `src/components/Icons.test.tsx`
- Modify: `src/components/Sidebar.test.tsx` (añadir un `describe` al final)

**Interfaces:**
- Consumes: el helper `Svg` ya existente en `Icons.tsx:6`, con props `{ size = 24, sw = 1.6 }`.
- Produces: `Icon.profile: (p: SvgProps) => JSX.Element` — misma firma que el resto de entradas de `Icon`, consumida por `Sidebar.tsx` y por la Task 2 en `LandingScreen.tsx`.

- [ ] **Step 1: Escribir el test del icono (fallará)**

Crear `src/components/Icons.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Icon } from './Icons';

/**
 * El botón "Perfil" del Sidebar reutilizaba Icon.userstory, el mismo glifo
 * que la entrada de nav "Hist. de Usuario". Icon.profile existe para
 * romper esa ambigüedad: comparamos el markup renderizado, no la
 * referencia de función, porque dos funciones distintas podrían dibujar
 * exactamente el mismo SVG.
 */
describe('Icon.profile', () => {
  it('renderiza un svg', () => {
    const { container } = render(<Icon.profile size={18} />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute('width')).toBe('18');
  });

  it('dibuja algo distinto de Icon.userstory', () => {
    const { container: perfil } = render(<Icon.profile size={18} />);
    const { container: userstory } = render(<Icon.userstory size={18} />);
    expect(perfil.querySelector('svg')?.innerHTML).not.toBe(
      userstory.querySelector('svg')?.innerHTML,
    );
  });
});
```

- [ ] **Step 2: Ejecutar el test y verificar que falla**

Run: `npx vitest run src/components/Icons.test.tsx`
Expected: FAIL. TypeScript/runtime error porque `Icon.profile` es `undefined` (`Cannot read properties of undefined` al renderizar).

- [ ] **Step 3: Implementar `Icon.profile`**

En `src/components/Icons.tsx`, insertar justo después del cierre de `userstory` (línea 113, entre `),` y `refiner:`):

```tsx
  profile: (p: SvgProps) => (
    <Svg {...p}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="9" cy="10.5" r="2.2" />
      <path d="M5.8 16.5a3.4 3.4 0 0 1 6.4 0" />
      <path d="M15 9.5h3.5M15 13h3.5" />
    </Svg>
  ),
```

Es una tarjeta de identificación: marco, avatar (cabeza + hombros) a la izquierda y dos líneas de texto a la derecha. Semánticamente lee como "ficha del proyecto" y es inconfundible con la persona-con-antenas de `userstory`.

- [ ] **Step 4: Ejecutar el test y verificar que pasa**

Run: `npx vitest run src/components/Icons.test.tsx`
Expected: PASS, 2 tests.

- [ ] **Step 5: Escribir el test del Sidebar (fallará)**

Añadir al final de `src/components/Sidebar.test.tsx`, después del último `describe`:

```tsx
/**
 * Perfil y Hist. de Usuario convivían en la misma barra con el mismo
 * glifo. Este test impide que vuelvan a converger.
 */
describe('Sidebar — icono propio de Perfil', () => {
  beforeEach(() => {
    localStorage.setItem('acgen_lang', JSON.stringify('es'));
  });

  it('el botón Perfil no comparte glifo con la entrada Hist. de Usuario', () => {
    renderSidebar();
    const perfil = screen.getByRole('button', { name: 'Perfil' });
    const userstory = screen.getByRole('button', { name: 'Hist. de Usuario' });
    expect(perfil.querySelector('svg')).not.toBeNull();
    expect(perfil.querySelector('svg')?.innerHTML).not.toBe(
      userstory.querySelector('svg')?.innerHTML,
    );
  });
});
```

- [ ] **Step 6: Ejecutar el test y verificar que falla**

Run: `npx vitest run src/components/Sidebar.test.tsx`
Expected: FAIL en el test nuevo con `expected '<circle cx="12" …' not to be '<circle cx="12" …'` — ambos botones dibujan el mismo SVG. El resto de tests del fichero siguen en verde.

- [ ] **Step 7: Cablear el icono en el Sidebar**

En `src/components/Sidebar.tsx`, línea 85, dentro del botón de perfil del `sidebar-footer`:

```tsx
              <Icon.profile size={18} />
```

(sustituye a `<Icon.userstory size={18} />`; el resto del botón no cambia)

- [ ] **Step 8: Ejecutar los tests y verificar que pasan**

Run: `npx vitest run src/components/Sidebar.test.tsx src/components/Icons.test.tsx`
Expected: PASS, todo en verde.

- [ ] **Step 9: Commit**

```bash
git add src/components/Icons.tsx src/components/Icons.test.tsx src/components/Sidebar.tsx src/components/Sidebar.test.tsx
git commit -F - <<'EOF'
feat(icons): Perfil estrena glifo propio en vez del de Historia de Usuario

El boton "Perfil" del sidebar-footer reutilizaba Icon.userstory, el mismo
dibujo que la entrada de navegacion "Hist. de Usuario" — dos destinos
distintos con el mismo icono en la misma barra.

Icon.profile es una tarjeta de identificacion (marco + avatar + lineas de
texto). El test compara el markup renderizado, no la referencia de funcion,
para que dos iconos distintos no puedan volver a converger en el mismo SVG.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 2: Botones de Perfil y Prompts en el `config-strip` del landing

El núcleo del cambio: los dos puntos de entrada nuevos.

**Files:**
- Modify: `src/components/LandingScreen.tsx` (imports, estado, `config-strip`, montaje de modales)
- Modify: `src/App.css:153`
- Modify: `src/components/LandingScreen.test.tsx` (añadir un `describe` al final)

**Interfaces:**
- Consumes: `Icon.profile` de la Task 1; `<ProfileEditor onClose={() => void} />` (`ProfileEditor.tsx:23`) y `<PromptEditor onClose={() => void} />` (`PromptEditor.tsx:23`) — `onClose` es su único prop en ambos casos.
- Produces: nada que consuman tareas posteriores. La interfaz de props de `LandingScreen` **no cambia**, así que `App.tsx` no se toca.

- [ ] **Step 1: Escribir los tests del landing (fallarán)**

Añadir al final de `src/components/LandingScreen.test.tsx`, después del último `describe`:

```tsx
/**
 * Perfil y Prompts vivian solo en el sidebar-footer, y App.tsx solo
 * renderiza el Sidebar cuando view !== 'landing' — asi que desde la
 * portada no habia forma de abrirlos. El config-strip ya es la franja de
 * "configura tu sesion" (proveedor, key, modelo), asi que es su sitio.
 *
 * Ojo: en jsdom navigator.language es 'en-US' y detectLang() devuelve
 * 'en'. Fijamos el idioma a mano porque estos tests afirman sobre texto.
 */
describe('LandingScreen — Perfil y Prompts', () => {
  beforeEach(() => {
    localStorage.setItem('acgen_lang', JSON.stringify('es'));
  });
  afterEach(() => localStorage.clear());

  it('coloca las dos acciones dentro del config-strip', () => {
    renderLanding();
    const actions = document.querySelector('.config-strip .config-actions');
    expect(actions).not.toBeNull();
    expect(actions?.querySelectorAll('button')).toHaveLength(2);
  });

  it('abre el editor de perfil y lo cierra', () => {
    renderLanding();
    expect(screen.queryByText('Perfil del proyecto')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Perfil' }));
    expect(screen.getByText('Perfil del proyecto')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(screen.queryByText('Perfil del proyecto')).toBeNull();
  });

  it('abre el editor de prompts', () => {
    renderLanding();
    expect(screen.queryByText('Editor de Prompts')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Prompts' }));
    expect(screen.getByText('Editor de Prompts')).toBeInTheDocument();
  });

  it('no monta ningun modal en el render inicial', () => {
    renderLanding();
    expect(document.querySelector('.modal-overlay')).toBeNull();
  });
});
```

Actualizar además la primera línea del fichero para importar `fireEvent`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
```

- [ ] **Step 2: Ejecutar los tests y verificar que fallan**

Run: `npx vitest run src/components/LandingScreen.test.tsx`
Expected: FAIL en los 3 primeros tests nuevos — `.config-actions` es `null` y `getByRole('button', { name: 'Perfil' })` lanza "Unable to find an accessible element". El cuarto (`no monta ningun modal`) pasa ya, y debe seguir pasando después.

- [ ] **Step 3: Implementar los botones y el estado en `LandingScreen`**

En `src/components/LandingScreen.tsx`, sustituir el bloque de imports (líneas 1-3) por:

```tsx
import { useState } from 'react';
import { ProviderConfig } from './ProviderConfig';
import { Icon } from './Icons';
import { useT } from '../i18n/I18nContext';
import { ProfileEditor } from './ProfileEditor';
import { PromptEditor } from './PromptEditor';
```

Declarar el estado justo después de `const t = useT();` (línea 98):

```tsx
  const [showProfileEditor, setShowProfileEditor] = useState(false);
  const [showPromptEditor, setShowPromptEditor] = useState(false);
```

Sustituir el bloque `config-strip` completo (líneas 110-121) por:

```tsx
      <div className="config-strip">
        <ProviderConfig
          provider={provider}
          onProviderChange={onProviderChange}
          apiKey={apiKey}
          onApiKeyChange={onApiKeyChange}
          model={model}
          onModelChange={onModelChange}
          baseUrl={customBaseUrl}
          onBaseUrlChange={onCustomBaseUrlChange}
        />
        <div className="config-actions">
          <button type="button" className="btn-ghost" onClick={() => setShowProfileEditor(true)}>
            <Icon.profile size={18} />
            {t('sidebar.profile')}
          </button>
          <button type="button" className="btn-ghost" onClick={() => setShowPromptEditor(true)}>
            <Icon.spark size={18} />
            {t('sidebar.prompts')}
          </button>
        </div>
      </div>
```

Montar los modales al final del `<div className="landing">`, justo antes de su cierre (después del `</div>` que cierra `tool-list`, línea 144):

```tsx
      {showProfileEditor && <ProfileEditor onClose={() => setShowProfileEditor(false)} />}
      {showPromptEditor && <PromptEditor onClose={() => setShowPromptEditor(false)} />}
```

No se tocan `LandingScreenProps` ni la lista `tools`.

- [ ] **Step 4: Implementar el CSS**

En `src/App.css`, sustituir la línea 153 (`.config-strip { margin-bottom: 46px; }`) por:

```css
.config-strip {
  margin-bottom: 46px;
  display: flex; justify-content: space-between; align-items: flex-end;
  gap: 12px; flex-wrap: wrap;
}
.config-actions { display: flex; gap: 8px; }
```

`align-items: flex-end` alinea los botones con el borde inferior de los selects: el div raíz de `ProviderConfig` ya usa `alignItems: 'flex-end'` internamente (`ProviderConfig.tsx:24`), así que ambos grupos comparten línea base. `flex-wrap` hace que en ventanas estrechas el grupo de acciones caiga a una segunda línea en vez de comprimir los campos.

- [ ] **Step 5: Ejecutar los tests y verificar que pasan**

Run: `npx vitest run src/components/LandingScreen.test.tsx`
Expected: PASS, incluidos los 4 tests nuevos y los que ya existían (recuento de 11 herramientas, `.landing` centrado, `onSelect`).

- [ ] **Step 6: Verificar que no hay regresión global ni de tipos**

Run: `npx vitest run 2>&1 | tail -5`
Expected: `Test Files 56 passed (56)` y `Tests 555 passed (555)` — 548 de baseline + 2 de Icons + 1 de Sidebar + 4 de Landing = 555; los ficheros suben de 55 a 56 por el `Icons.test.tsx` nuevo. **Si el número no cuadra exactamente, contar los tests nuevos antes de seguir: cualquier cifra por debajo de 548 es una regresión real.**

Run: `npm run typecheck`
Expected: exit 0, sin salida de errores.

Run: `npm run lint`
Expected: exit 0.

- [ ] **Step 7: Verificar en Chrome real contra build de producción**

```bash
npm run build
npx vite preview --port 4173
```

Con la app abierta en `http://localhost:4173`:
1. En el landing, comprobar que los dos botones aparecen alineados a la derecha del `config-strip`, a la misma altura que los selects.
2. Abrir "Perfil", escribir un valor reconocible en el campo *Dominio*, pulsar Guardar, cerrar.
3. Entrar en una herramienta cualquiera (p. ej. Criterios), abrir "Perfil" desde el Sidebar y **confirmar que el valor guardado está ahí** (misma clave `acgen_project_profile`, sin divergencia entre puntos de entrada).
4. Volver a Inicio, abrir "Prompts" desde el landing y comprobar que carga el editor.
5. Estrechar la ventana hasta ~600px y confirmar que el grupo de botones envuelve a una segunda línea sin aplastar los campos.
6. Consola del navegador sin errores.

- [ ] **Step 8: Commit**

```bash
git add src/components/LandingScreen.tsx src/components/LandingScreen.test.tsx src/App.css
git commit -F - <<'EOF'
feat(landing): Perfil y Prompts alcanzables desde la portada

Ambos botones vivian solo en el sidebar-footer, y App.tsx solo renderiza el
Sidebar cuando view !== 'landing', asi que desde la portada no habia forma
de abrirlos. Known issues solo anotaba Perfil; Prompts tenia el mismo bug.

Van al config-strip, que ya es la franja de "configura tu sesion" (proveedor,
key, modelo) y es donde quieres dejar puesto el perfil ANTES de elegir
herramienta. El Sidebar conserva los suyos para las vistas de herramienta.

El estado de los modales es local a LandingScreen en vez de levantarlo a
App: landing y Sidebar son mutuamente excluyentes por construccion, asi que
los dos modales no pueden montarse a la vez y levantarlo solo anadiria prop
drilling. useProfile() es un hook sobre useLocalStorage, no un context
provider, asi que no hace falta plumbing: ambos puntos de entrada leen y
escriben la misma clave.

Cero claves i18n nuevas: sidebar.profile y sidebar.prompts ya dicen lo justo.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 3: Documentación

`AGENTS.md` es el contexto que carga cualquier sesión futura. Dejar los pendientes cerrados sin actualizarlo hace que la siguiente sesión los persiga otra vez.

**Files:**
- Modify: `AGENTS.md` (sección "Known issues" ~línea 387 y tabla "Evolution history")
- Modify: `README.md` (recuento de tests)

**Interfaces:**
- Consumes: los recuentos reales de tests y ficheros de la Task 2, Step 6.
- Produces: nada de código.

- [ ] **Step 1: Retirar los dos pendientes cerrados de "Known issues"**

En `AGENTS.md`, borrar de la lista `Pending items, none blocking a release:` estas dos entradas, que ya no son ciertas:

- la de `<ProfileEditor>` inalcanzable desde el landing;
- la del botón "Perfil" del Sidebar reutilizando `Icon.userstory`.

**No tocar** las otras cinco (`demoData.ts`, `hasSignificantData()`, spinner de visión, `prefill` sin limpiar, markdown crudo del Refinador): siguen abiertas.

- [ ] **Step 2: Añadir la fila al historial**

Añadir al final de la tabla "Evolution history" de `AGENTS.md` una fila con este contenido (ajustar los recuentos a los que devolvió realmente la Task 2, Step 6):

```markdown
| Perfil y Prompts alcanzables desde el landing | 2026-08-14 | `<ProfileEditor>` y `<PromptEditor>` vivían solo en el `sidebar-footer`, y `App.tsx:147` solo renderiza el `<Sidebar>` cuando `view !== 'landing'`, así que ninguno de los dos era alcanzable desde la portada — "Known issues" solo anotaba el primero. Nuevo grupo `.config-actions` en el `config-strip` del landing (la franja que ya alojaba `<ProviderConfig>`), con el estado de ambos modales **local a `LandingScreen`** en vez de levantado a `App`: landing y Sidebar son mutuamente excluyentes por construcción, así que los modales no pueden montarse a la vez y levantar el estado solo añadiría prop drilling; `useProfile()` es un hook sobre `useLocalStorage`, no un context provider, así que ambos puntos de entrada comparten la clave `acgen_project_profile` sin plumbing. `.config-strip` pasa de `margin-bottom` suelto a flex con `justify-content: space-between` + `align-items: flex-end` (comparte línea base con el flex interno de `ProviderConfig`) y `flex-wrap` para ventanas estrechas. De paso se cierra el pendiente del glifo duplicado: nuevo `Icon.profile` (tarjeta de identificación) sustituye a `Icon.userstory` en el botón del Sidebar, que compartía dibujo con la entrada de nav "Hist. de Usuario"; su test compara el markup renderizado, no la referencia de función, para que no puedan volver a converger. **Cero claves i18n nuevas** (285, paridad ES/EN intacta): `sidebar.profile` y `sidebar.prompts` ya decían lo justo. Verificado en Chrome real contra build de producción: perfil guardado desde el landing y releído desde el Sidebar de una herramienta, wrap a ~600px, consola limpia. 548 → 555 tests. |
```

- [ ] **Step 3: Actualizar el recuento en README**

En `README.md`, línea 92, la fila de la tabla de stack. Hoy dice
`| Tests | Vitest + React Testing Library (548 tests / 55 files) |`. Pasa a:

```markdown
| Tests | Vitest + React Testing Library (555 tests / 56 files) |
```

(ajustar a los valores reales que devolvió la Task 2, Step 6 si difieren)

- [ ] **Step 4: Verificar que no se rompió nada**

Run: `npx vitest run 2>&1 | tail -5`
Expected: mismo recuento que en la Task 2, Step 6 — la documentación no cambia comportamiento.

- [ ] **Step 5: Commit**

```bash
git add AGENTS.md README.md
git commit -F - <<'EOF'
docs: cerrar los pendientes de Perfil en landing y del glifo duplicado

Retira de "Known issues" las dos entradas que este trabajo resuelve y anade
la fila correspondiente al historial. Las otras cinco pendientes siguen
abiertas y sin tocar.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
```

---

## Cierre

Con las tres tareas commiteadas, la rama está lista para PR contra `main`. El repo tiene `delete_branch_on_merge` en `false`, así que si esta PR se apila sobre otra hay que hacer `gh pr edit N --base main` antes de mergear (gotcha documentado en `AGENTS.md`, fila del 2026-08-14).

El deploy a `acgen.vercel.app` es automático al mergear a `main` (integración Git de Vercel); basta con verificar el hash del bundle en producción.
