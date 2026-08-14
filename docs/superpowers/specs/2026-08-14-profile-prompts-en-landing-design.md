# Perfil y Prompts alcanzables desde el landing

**Fecha:** 2026-08-14
**Estado:** Aprobado por Jorge (diseño validado)

## Contexto

`AGENTS.md` (Known issues) anotaba que `<ProfileEditor>` es inalcanzable desde
la pantalla de inicio. La afirmación es cierta pero incompleta en dos sentidos:

1. **El perfil sí es alcanzable**, solo que no desde el landing: entrando en
   cualquier herramienta aparece el Sidebar y con él su botón "Perfil"
   (`Sidebar.tsx:84-87`). El problema real es de descubribilidad, no de
   funcionalidad muerta.
2. **El botón "Prompts" sufre exactamente el mismo problema** y no estaba
   anotado. Vive en el mismo `sidebar-footer` (`Sidebar.tsx:88-91`), así que
   también desaparece en el landing.

La causa raíz es una sola: `App.tsx:147` renderiza el `<Sidebar>` solo cuando
`view !== 'landing'`, y ambos modales son estado local del Sidebar
(`Sidebar.tsx:38-39`, montados en `95-96`).

Esto importa porque el landing **ya es la pantalla de configuración de
sesión**: el `config-strip` aloja `<ProviderConfig>` (proveedor, API key,
modelo). El perfil de proyecto y los prompts personalizados son exactamente
la misma clase de ajuste — lo que quieres dejar puesto ANTES de elegir
herramienta — y son justo lo que no puedes tocar ahí.

## Decisiones de producto (validadas con Jorge)

1. **Alcance: Perfil y Prompts**, no solo Perfil. Misma causa raíz y mismo
   cambio; arreglar uno solo dejaría dos botones hermanos del mismo footer
   con comportamiento asimétrico.
2. **Colocación: el `config-strip` del landing**, junto a `<ProviderConfig>`
   (elegido sobre moverlos al Header y sobre mostrar el Sidebar en landing).
3. **El Sidebar conserva sus dos botones** para las vistas de herramienta. No
   se mueve nada, se añade un segundo punto de entrada.
4. **Icono propio para Perfil**: se cierra de paso el pendiente del glifo
   duplicado con Historia de Usuario, porque es esta misma superficie.

## Colocación y componentes

`LandingScreen.tsx` gana dos botones dentro del `config-strip`:

```tsx
<div className="config-strip">
  <ProviderConfig ... />              {/* ya existe, sin tocar */}
  <div className="config-actions">    {/* NUEVO */}
    <button className="btn-ghost">Perfil</button>
    <button className="btn-ghost">Prompts</button>
  </div>
</div>
```

Los botones usan `btn-ghost`, la clase que ya usa el Header, con su icono a
la izquierda (mismo patrón que los `sidebar-item`).

### CSS

`.config-strip` hoy es solo `margin-bottom: 46px` (`App.css:153`). Pasa a ser
contenedor flex:

```css
.config-strip {
  margin-bottom: 46px;
  display: flex; justify-content: space-between; align-items: flex-end;
  gap: 12px; flex-wrap: wrap;
}
.config-actions { display: flex; gap: 8px; }
```

`align-items: flex-end` alinea los botones con el borde inferior de los
selects: el div raíz de `<ProviderConfig>` ya usa `alignItems: 'flex-end'`
internamente (`ProviderConfig.tsx:24`), así que ambos grupos comparten línea
base. `flex-wrap` cubre ventanas estrechas — el grupo de acciones cae a una
segunda línea en vez de comprimir los campos.

## Propiedad del estado

`LandingScreen` declara su propio `useState` por modal y renderiza
`<ProfileEditor>` / `<PromptEditor>` él mismo, replicando literalmente el
patrón que ya usa `Sidebar.tsx`.

**Se descarta levantar el estado a `App.tsx`** y pasar callbacks a ambos
hijos. El único beneficio sería un punto de montaje único, y ese beneficio es
teórico aquí: landing y Sidebar son mutuamente excluyentes por construcción
(`App.tsx:147`), así que los dos modales no pueden montarse a la vez. A
cambio costaría tocar tres ficheros, cambiar dos interfaces de props y añadir
prop drilling. La duplicación real son cuatro líneas.

Esto funciona sin plumbing porque `useProfile()` (`ContextProfile.tsx:5`) es
un hook sobre `useLocalStorage`, **no un context provider**: no hay árbol que
envolver. Los dos puntos de entrada leen y escriben la misma clave
`acgen_project_profile`, de modo que editar el perfil desde el landing o
desde una herramienta es indistinguible. Lo mismo aplica a `<PromptEditor>`,
cuyo único prop es `onClose`.

## Icono

Nuevo `Icon.profile` en `Icons.tsx`: glifo de persona, mismo estilo que el
resto (`<Svg sw={1.7}>`, `size` por prop). Se usa en los dos puntos de
entrada — el nuevo del landing y `Sidebar.tsx:85`, que hoy reutiliza
`Icon.userstory`, el mismo glifo que la entrada de nav "Historia de Usuario".

`Prompts` mantiene `Icon.spark`, que no colisiona con ninguna entrada de nav
(el Header también lo usa en el `model-chip`, en un contexto distinto y sin
ambigüedad de navegación).

## i18n

**Cero claves nuevas.** Se reutilizan `sidebar.profile` y `sidebar.prompts`,
que ya contienen exactamente "Perfil"/"Profile" y "Prompts" en ambos idiomas
(`es.json:43,45`, `en.json:43,45`). El prefijo `sidebar.` queda como leve
inexactitud de nombre; renombrarlas obligaría a tocar los dos JSON más el
Sidebar sin ganancia funcional. Se mantienen las 285 claves y la paridad
ES/EN.

## Errores y casos borde

No hay caminos de fallo nuevos: son dos botones que alternan un booleano
local. Sin red, sin asincronía, sin persistencia propia. Los modales ya
gestionan lo suyo (cierre por overlay, `stopPropagation` en el contenido,
guardado en localStorage).

- Ventana estrecha: `flex-wrap` en `.config-strip` evita que los botones
  aplasten los campos de `ProviderConfig`.
- Perfil editado desde el landing y luego desde una herramienta: misma clave
  de localStorage, sin divergencia posible entre los dos puntos de entrada.
- El landing no monta Sidebar y viceversa, así que nunca hay dos instancias
  del mismo modal vivas a la vez.

## Testing (direct-TDD, convención del proyecto)

`LandingScreen.test.tsx` — con el harness existente (`I18nProvider` +
`localStorage.clear()` en `afterEach`):

- el `config-strip` contiene `.config-actions` con dos botones;
- click en "Perfil" monta el modal (`profile.title` visible); click en
  "Cerrar" lo desmonta;
- click en "Prompts" monta `<PromptEditor>`.

`Icons` / `Sidebar.test.tsx`:

- `Icon.profile` existe y **no** es la misma referencia que `Icon.userstory`
  — blinda el pendiente que se cierra aquí para que no reaparezca.

Verificación final en Chrome real contra build de producción: abrir Perfil
desde el landing, guardar un campo, entrar en una herramienta y comprobar que
el Sidebar muestra el mismo valor.

Estimación: 548 → ~553 tests (baseline verificado con `npx vitest run` el
2026-08-14: 548 tests en 55 ficheros, todos en verde).

## Fuera de alcance

- No se toca el Header (ya lleva 5 controles).
- No se muestra el Sidebar en el landing.
- No se abordan el resto de pendientes de Known issues:
  `hasSignificantData()` sin perfil/prompts, spinner-only en llamadas de
  visión, `prefill` nunca limpiado, literales pre-productización en
  `demoData.ts`, markdown crudo del Refinador.
