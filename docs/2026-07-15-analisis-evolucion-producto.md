# ACGen — Análisis de evolución de producto

**Fecha:** 2026-07-15
**Perspectiva:** arquitectura de producto, UX/UI y estrategia de evolución
**Premisa:** la integración con Jira queda completamente descartada en producción (red corporativa inalcanzable desde Vercel + decisión de no procesar información sensible de tickets a través de APIs externas). Este documento no propone recuperarla por ninguna vía.

---

## 0. Diagnóstico de partida

**Lo que ACGen es hoy:** una suite de 5 herramientas QA para *ecommerce de moda*, con modelo BYOK (el usuario trae su API key de Groq), datos 100% en localStorage, y una integración Jira que en producción es peso muerto: dos bloques de configuración duplicados, mensajes de error condicionales, un aviso de "tus credenciales pasan por el servidor de la demo" y funciones serverless que nunca podrán alcanzar su objetivo.

**El activo oculto:** la arquitectura *privacy-first* (nada se guarda en servidor, el LLM se llama con la clave del propio usuario) es exactamente lo que las empresas prohíben en ChatGPT y compañía. Hoy es un detalle técnico; debería ser **la propuesta de valor central**.

**El lastre principal:** el posicionamiento. "QA de ecommerce de moda" está cableado en los prompts (`TESTCASE_PROMPT`, `BUG_REPORT_PROMPT`, `TEST_DATA_PROMPT` dicen literalmente "ecommerce de moda"). Eso limita el público a una fracción mínima de los profesionales que podrían usarla.

**Reposicionamiento propuesto:**

> De *"Generador de artefactos QA para ecommerce"* → a *"Workbench de artefactos ágiles con IA: texto dentro, entregable estructurado fuera. Tu información nunca sale de tu navegador salvo hacia tu propia API key."*

---

## 1. Evolución del producto

### 1.1 Qué eliminar

| Elemento | Justificación |
|---|---|
| Toda la superficie Jira: `jiraService.ts`, funciones `api/`, bloques "Jira (opcional)" en Criterios y Bug Report, `JIRA_ALLOWED_HOSTS`, el aviso de credenciales | Es la única parte que no funciona en producción, la que genera desconfianza (el disclaimer de credenciales) y la que más ruido visual añade a los formularios. Su eliminación simplifica el proyecto entero: desaparece el directorio `api/`, el deploy pasa a ser 100% estático. |
| El campo "URL de ticket Jira" del Bug Report | Sustituir por lo que realmente hacía por debajo: **un textarea "Contexto adicional (pega aquí la descripción del ticket)"**. El usuario copia/pega lo que él decida compartir. Mismo valor, cero dependencia, y el usuario controla exactamente qué texto sale hacia el LLM. |
| El detector `extractIssueKey` sobre el input de Criterios | Con Jira fuera, ese branch solo produce mensajes de error confusos. |

**Nota:** el pegado manual no es "recuperar Jira por otra vía" — es reconocer que la fuente de contexto es *texto que el usuario elige aportar*, venga de donde venga (Jira, Azure DevOps, un email, una conversación). Eso, de paso, hace la app compatible con *cualquier* gestor de tickets sin integrar ninguno.

### 1.2 Qué conservar y qué fusionar

| Decisión | Herramienta | Justificación |
|---|---|---|
| **Conservar** | Sprint Tracker | Ya es 100% offline, es la herramienta más diferencial (nadie más combina generadores IA + hoja de seguimiento local) y no depende de nada externo. Solo genericizar: el enlace Ctrl+click a Jira debería ser una "URL base de tracker" opcional y genérica. |
| **Conservar** | Datos de Prueba | Única en su categoría (217 mercados, protección contra inyección de fórmulas). Genérica ya de por sí para cualquier ecommerce/producto con formularios. |
| **Fusionar el input, no las herramientas** | Criterios + Test Cases + Bug Report | Cada herramienta tiene formularios y validaciones distintas — fusionarlas crearía un mega-formulario. Lo que hay que fusionar es el **flujo**: un requisito escrito una vez debe poder alimentar criterios → casos de prueba → riesgos sin re-pegarlo. Ver "encadenado de artefactos" en §2. |

### 1.3 Qué crear (nuevas herramientas)

Ordenadas por relación valor/esfuerzo. Todas funcionan solo con texto del usuario:

| # | Herramienta | Input | Output | Por qué |
|---|---|---|---|---|
| 1 | **Historias de Usuario** | Idea/necesidad en lenguaje natural | Historia formato "Como/Quiero/Para" + criterios INVEST evaluados | Es el artefacto ágil más universal; abre la app a PO/BA. Reutiliza el 90% de la infraestructura de Criterios. |
| 2 | **Refinador de Requisitos** ("Requirement Linter") | Requisito o historia en bruto | Lista de ambigüedades, contradicciones, información faltante y preguntas para el refinement | **El diferenciador.** Ninguna herramienta gratuita hace esto bien. Convierte la app de "generador" a "asistente de calidad de requisitos". |
| 3 | **Casos Límite (Edge Cases)** | Requisito o criterio | Matriz de casos límite: valores frontera, estados vacíos, concurrencia, i18n, permisos | Complemento natural del Test Case Generator. |
| 4 | **Conversor de Formatos** | Cualquier artefacto | Gherkin ↔ tabla ↔ Markdown ↔ Jira wiki ↔ Azure DevOps ↔ texto plano | Barato de construir, uso diario, y "desjirifica" la app: el formato Jira wiki pasa de ser *el* formato a ser *uno de* los formatos de salida. |
| 5 | **Análisis de Riesgos** | Descripción de feature/release | Matriz probabilidad×impacto con mitigaciones sugeridas | Abre la app a PM/SM. Output tabular — reutiliza el renderizado de tablas del Test Case Generator. |
| 6 | **Checklists (DoR/DoD/Release)** | Contexto del equipo/feature | Checklist accionable y editable | Muy barato; los checklists editables + persistidos en localStorage encajan con la filosofía Sprint Tracker. |
| 7 | **Resúmenes ejecutivos** | Notas de reunión / hilo largo | Resumen + decisiones + action items con responsable | Uso transversal a todos los roles; input 100% controlado por el usuario. |

### 1.4 La pieza que lo genericiza todo: el Perfil de Contexto

Hoy el dominio ("ecommerce de moda, multi-mercado, web + apps nativas") está *hardcodeado en los prompts*. Propuesta: extraerlo a un **perfil de proyecto configurable** en la landing, persistido en localStorage:

- Campos: dominio/industria, tipo de producto (web/app/API/desktop), mercados/idiomas, terminología propia, tono.
- Preset por defecto: "Ecommerce de moda" (el caso de uso actual no pierde nada — se convierte en el primer preset).
- Todos los prompts interpolan el perfil en lugar del texto fijo.

Con un solo cambio, las 5+7 herramientas sirven para banca, salud, SaaS, logística… Es la palanca de genericización más rentable de todo este documento.

---

## 2. Experiencia de usuario (UX)

### Problemas actuales detectados en el código

| Problema | Evidencia | Impacto |
|---|---|---|
| **No hay routing por URL** — la vista es `useState('landing')` en `App.tsx` | F5 vuelve a la landing, el botón Atrás del navegador saca de la app, no hay enlaces profundos | Alto. Para un portfolio es doblemente grave: no se puede enviar a un entrevistador el link directo a una herramienta. Solución: hash routing (`#/testcase`) — mínimo cambio, sin dependencias. |
| **Navegación hub-and-spoke** — para cambiar de herramienta: Atrás → landing → elegir (3 interacciones) | `Header.tsx` solo ofrece "Volver" | Medio. Un usuario que encadena artefactos lo sufre constantemente. |
| **Barrera de entrada dura**: sin API key de Groq no se puede probar *nada* | `canGenerate` exige `apiKey` en cada herramienta | Alto para portfolio: un entrevistador con 3 minutos no va a crear una cuenta en Groq. |
| **Historial enterrado**: cada herramienta guarda 10 generaciones pero solo son visibles desde un modal dentro de esa herramienta | `useHistory` por herramienta + `HistoryModal` | Medio. El trabajo previo del usuario es invisible desde la landing. |
| **`window.confirm` para limpiar campos** | `AcceptanceCriteriaTool.tsx` | Bajo, pero rompe la estética: diálogo nativo del navegador en una UI cuidada. Sustituir por toast con "Deshacer". |

### Propuestas de flujo

1. **Modo demo sin API key** (la mejora nº 1 para portfolio): cada herramienta incluye un botón "Ver ejemplo" que carga un input de muestra y un output pre-generado (estático, embebido en el bundle). El usuario ve el valor completo en 10 segundos; la API key se pide solo cuando quiere generar *lo suyo*.
2. **Encadenado de artefactos** ("Enviar a…"): sobre cualquier output generado, un menú que pasa el resultado como input de otra herramienta — *criterios → generar casos de prueba*, *casos de prueba → casos límite*, *requisito → historia de usuario*. Convierte 5 herramientas aisladas en un pipeline. Es el cambio de UX con más impacto en valor percibido.
3. **Atajos**: `Ctrl+Enter` para generar (patrón universal), `Ctrl+K` para saltar entre herramientas.
4. **Streaming del output**: Groq soporta streaming; hoy el usuario mira un spinner durante toda la generación. Ver el texto aparecer reduce el tiempo *percibido* a una fracción y es el estándar esperado de una app con LLM en 2026.
5. **Regenerar con feedback**: botón "Regenerar" + campo opcional "qué cambiar" ("más cortos", "en inglés", "más técnicos"). Evita el ciclo copiar-editar-pegar-regenerar.

---

## 3. Diseño de interfaz (UI)

### Arquitectura de la información

| Área | Estado actual | Propuesta |
|---|---|---|
| **Landing** | Hero + config strip (API key + modelo) + lista de 5 herramientas | Convertirla en **dashboard**: fila de "Continuar donde lo dejaste" (últimas generaciones de *todas* las herramientas, con timestamp y herramienta de origen), herramientas agrupadas por categoría (Generar · Refinar · Convertir · Seguimiento), y la config de API key colapsada una vez configurada. |
| **Navegación** | Header con "Volver" | **Sidebar fija en desktop** (iconos + nombre, herramienta activa resaltada, cambio de herramienta en 1 clic) que colapsa a drawer/bottom-nav en móvil. El header queda para marca, modelo activo y tema. |
| **Panel de output** | Cada herramienta renderiza su resultado a su manera | **Componente unificado de resultado**: pestañas Resultado / Razonamiento / Historial + barra de exportación consistente (Copiar · Markdown · Jira wiki · PDF · CSV según aplique) + botón "Enviar a…". Hoy el razonamiento es un `<details>` y el historial un modal — unificarlos reduce código y curva de aprendizaje. |
| **Formularios** | Verticales, campo a campo | Layout de dos columnas en desktop: input a la izquierda, output a la derecha (patrón "playground"). En móvil, apilado con scroll automático al resultado. |
| **Estados vacíos** | Área en blanco hasta generar | Estado vacío con ejemplo del artefacto + botón "Ver ejemplo" (conecta con el modo demo). |

### Responsive y detalles visuales

- **Sprint Tracker en móvil**: una hoja de cálculo de N columnas no cabe. Ofrecer vista de tarjetas apiladas (una tarjeta por fila, campos clave visibles) con toggle a la vista tabla con scroll horizontal.
- **Jerarquía de acción**: un único botón primario por vista (Generar); exportaciones y limpiar como secundarios/terciarios.
- **Micro-estados**: skeleton en tablas mientras llega el stream; check animado en "Copiado".
- Conservar lo que ya funciona: tema oscuro sin parpadeo, estética tipográfica de la landing (numeración 01-05, tags), badges de prioridad en tablas.

---

## 4. Casos de uso por perfil (sin Jira)

| Perfil | Escenario concreto | Herramientas |
|---|---|---|
| **Product Owner** | Convierte una idea de negocio en historia INVEST + criterios de aceptación listos para el refinement de mañana | Historias de Usuario → Criterios (encadenado) |
| **Scrum Master** | Pega las notas de la retro/daily y obtiene resumen con decisiones y action items; sigue los tickets del sprint en el Tracker | Resúmenes · Sprint Tracker |
| **QA** | Del criterio de aceptación saca casos de prueba, casos límite y datos de prueba por mercado; reporta el defecto encontrado | Test Cases → Edge Cases → Datos de Prueba · Bug Report |
| **Desarrollador** | Antes de codificar, pasa la historia por el Refinador para detectar huecos; al terminar, convierte sus notas en descripción de PR / release notes | Refinador · Conversor · Resúmenes |
| **Business Analyst** | Pega el acta de una reunión con negocio y extrae requisitos estructurados; detecta ambigüedades antes de firmarlos | Resúmenes → Refinador → Historias |
| **Project Manager** | Describe la release y obtiene matriz de riesgos + checklist de salida a producción | Análisis de Riesgos · Checklists |
| **Analista Funcional** | Convierte una especificación en tabla de casos funcionales; normaliza documentación heterogénea a un formato único | Conversor · Refinador · Test Cases |

El patrón común: **todo el input es texto que el usuario decide pegar**. La app nunca se conecta a ningún sistema corporativo.

---

## 5. Funcionalidades IA — transversales

Además de las 7 nuevas herramientas de §1.3, dos funcionalidades *transversales*:

| Funcionalidad | Descripción | Valor |
|---|---|---|
| **Modo confidencial (anonimizador local)** | Antes de enviar el prompt, un paso *local y sin IA* (regex/diccionario en el navegador) detecta y enmascara emails, nombres de dominio internos, IDs de ticket, URLs corporativas → `[EMAIL_1]`, `[ID_1]`. El usuario revisa las sustituciones y la app las revierte en el output. | Ataca de frente la preocupación de privacidad corporativa. Como se ejecuta 100% en el navegador, *reduce* lo que sale hacia el LLM. Diferenciador potente y honesto. |
| **Plantillas de prompt personalizables** | El usuario puede ver y ajustar el prompt de sistema de cada herramienta (con "restaurar por defecto"), persistido en localStorage. | Convierte usuarios avanzados en usuarios fieles; transparencia total sobre qué se envía al LLM. |

---

## 6. Diferenciación

Frente a la alternativa real (ChatGPT/Copilot con un prompt manual, o SaaS que exigen cuenta y suben los datos a su nube):

1. **Privacidad estructural, no prometida**: sin backend, sin cuentas, sin telemetría; BYOK — los datos van del navegador del usuario a *su propia* cuenta de Groq y a ningún sitio más. Merece una sección "Cómo viajan tus datos" en la propia app.
2. **Outputs estructurados y validados**, no chat: los criterios se validan contra marcadores requeridos, los test cases contra un esquema campo a campo. Un prompt manual en ChatGPT no garantiza el formato; ACGen sí.
3. **Pipeline de artefactos**: idea → historia → criterios → casos → riesgos encadenados en clics, no en copy-paste.
4. **Modo confidencial local** (§5): único en su categoría.
5. **Generador + Tracker en un solo sitio**: la combinación de artefactos IA con seguimiento offline de sprint no existe en el mercado gratuito.
6. **Gratis y sin registro**: el coste del LLM lo pone el tier gratuito de Groq.

---

## 7. Roadmap

### Fase 1 — Quick Wins (días)

| Mejora | Valor | Complejidad | Prioridad |
|---|---|---|---|
| Eliminar toda la superficie Jira (código, UI, `api/`, docs) y sustituir por textarea "Contexto adicional" | Elimina la única parte rota + disclaimers que generan desconfianza; deploy 100% estático | Baja | **Alta** |
| Modo demo / "Ver ejemplo" por herramienta | Un entrevistador ve el valor completo sin API key | Baja | **Alta** |
| Hash routing (`#/herramienta`) | Deep links, F5 y botón Atrás funcionan; imprescindible para compartir | Baja | **Alta** |
| Perfil de contexto (des-hardcodear "ecommerce de moda" de los prompts) | Multiplica el público objetivo; el caso actual queda como preset | Baja–Media | **Alta** |
| `Ctrl+Enter`, toast con deshacer en vez de `window.confirm` | Pulido diario | Baja | Media |

### Fase 2 — Impacto medio (semanas)

| Mejora | Valor | Complejidad | Prioridad |
|---|---|---|---|
| Streaming de respuestas | Tiempo percibido ÷ 5; estándar esperado | Media | **Alta** |
| Herramientas: Historias de Usuario + Refinador de Requisitos + Casos Límite | Abre la app a PO/BA/Dev; el Refinador es el diferenciador | Media (reutilizan infraestructura) | **Alta** |
| Encadenado "Enviar a…" entre herramientas | Convierte herramientas sueltas en pipeline | Media | **Alta** |
| Sidebar de navegación + landing-dashboard con actividad reciente | Cambio de herramienta en 1 clic; el historial deja de estar enterrado | Media | Media |
| Conversor de formatos + selector de formato de salida global | "Desjirifica" la app; compatible con cualquier tracker | Baja–Media | Media |
| Panel de output unificado | Consistencia + menos código duplicado entre herramientas | Media | Media |

### Fase 3 — Estratégicas (meses)

| Mejora | Valor | Complejidad | Prioridad |
|---|---|---|---|
| Modo confidencial (anonimizador local) | Diferenciador de privacidad único; deshace la objeción corporativa | Media–Alta | **Alta** |
| Modelo "Proyecto/Workspace": agrupar artefactos generados por proyecto, con export/import JSON | Pasa de "generador puntual" a "espacio de trabajo"; mitiga el riesgo de perder datos al limpiar el navegador | Alta | Media |
| i18n (interfaz + outputs en EN/ES) | Como portfolio, el mercado anglosajón es 10× el hispano | Media–Alta | Media |
| Prompts personalizables + galería de plantillas | Fidelización de usuarios avanzados | Media | Media |
| PWA / offline-first para Tracker y checklists | Coherente con la filosofía local-first | Media | Baja |
| Multi-proveedor LLM (OpenAI-compatible: el endpoint ya lo es — solo parametrizar base URL) | El usuario elige su proveedor; menos dependencia de Groq | Baja–Media | Baja |

### Lógica de secuenciación

La Fase 1 entera es **quitar fricción y ruido** (Jira fuera, demo dentro, dominio configurable): con ~1 semana la app ya es genérica, demostrable sin API key y enlazable. La Fase 2 es **profundidad de producto**: pipeline + 3 herramientas nuevas la convierten en útil para los 7 perfiles. La Fase 3 es **posicionamiento**: privacidad demostrable y workspace son lo que la separaría de cualquier alternativa.
