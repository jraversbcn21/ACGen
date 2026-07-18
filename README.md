# ACGen: Suite de herramientas de QA automatizadas con IA

![ACGen landing](public/screenshot.png)

**🔗 Demo en vivo: [acgen.vercel.app](https://acgen.vercel.app)**

![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white)

ACGen es una aplicacion web (SPA) que integra diez herramientas para agilizar el trabajo diario de equipos QA: ocho generadores impulsados por IA (multi-proveedor: Groq, OpenRouter o cualquier endpoint compatible con OpenAI) y dos herramientas de seguimiento 100% offline (Sprint Tracker y Regression Tracker). Deploy 100% estatico, sin backend propio.

## Caracteristicas

- **Criterios de Aceptacion**: Genera criterios Dado/Cuando/Entonces desde requisitos o descripcion de tickets. Validacion automatica de formato. Historial persistente de las ultimas 10 generaciones.
- **Test Case Generator**: Genera casos de prueba QA estructurados (JSON) con prioridad, tipo, pasos y resultado esperado. Exporta como tabla estructurada o PDF.
- **Bug Report Generator**: Genera bug reports en formato estructurado con paneles, seleccion de plataforma (web/App Android/App iOS), campos dinamicos y campo de contexto adicional. Historial persistente de las ultimas 10 generaciones.
- **Datos de Prueba**: Genera datos realistas (direcciones, facturacion, registros, tarjetas, cupones) adaptados a 217 mercados. Exporta como TSV o CSV (con proteccion contra inyeccion de formulas en Excel).
- **Historia de Usuario**: Genera historias en formato Como/Quiero/Para con evaluacion de criterios INVEST.
- **Refinador de Requisitos**: Detecta ambiguedades, contradicciones, informacion faltante y dependencias no declaradas en un requisito.
- **Casos Limite**: Genera edge cases agrupados por categoria (valores frontera, estados vacios, concurrencia, i18n, permisos, red).
- **Conversor de Formatos**: Convierte texto entre Gherkin, Markdown, Jira wiki, Azure DevOps y texto plano.
- **Sprint Tracker**: Hoja de calculo offline por sprint con 5 pestanas (Resueltos, Creados, ReOpen, Prioridad Alta, JSD): filas reordenables por drag-and-drop, busqueda con debounce, columnas redimensionables, enlaces a tickets (Ctrl+click), pegado desde SnapLink y archivado historico.
- **Regression Tracker**: Tablero unico de regresiones con 3 pestanas por plataforma (iOS, Android, WEB). Enlaces arbitrarios (SharePoint, Zephyr, Confluence...) muestran solo el nombre en reposo y el valor completo al editar; Ctrl+click abre la URL exacta. Archivado con snapshot al historial (solo lectura).
- **Modo confidencial**: anonimiza automaticamente datos sensibles (emails, telefonos, nombres...) antes de enviarlos al proveedor de IA, con revision y edicion de las sustituciones antes de confirmar.
- **Multi-proveedor**: Groq (por defecto), OpenRouter o cualquier endpoint compatible con OpenAI (Custom), configurable por herramienta.
- **Workspaces**: agrupa artefactos generados (input/output) por proyecto, con export/import a JSON.
- **i18n**: interfaz completa en Espanol/Ingles con deteccion automatica del idioma del navegador.
- **PWA**: instalable, con precache offline de los assets estaticos.
- **Tema oscuro**: Alterna entre modo claro y oscuro. Persistencia en localStorage, aplicado antes del primer paint (sin parpadeo).
- **Text-to-speech**: Lectura en voz alta del razonamiento del modelo en Criterios y Bug Report.

---

## Herramientas

### Criterios de Aceptacion
Genera criterios Dado/Cuando/Entonces en formato Confluence wiki a partir de requisitos escritos o descripcion de tickets. Se puede anadir contexto adicional opcionalmente. Valida automaticamente que la salida contenga los marcadores requeridos.

### Test Case Generator
Genera casos de prueba estructurados (clave, resumen, prioridad, tipo, precondiciones, pasos, resultado esperado) validados campo a campo. Se renderizan como tabla HTML con badges de prioridad y tipo, exportables como tabla estructurada o PDF.

### Bug Report Generator
Genera bug reports en formato estructurado con paneles. Cuatro plataformas (Web Desktop, Web Mobile, App Android, App iOS) con campos dinamicos por plataforma y campo de contexto adicional.

### Datos de Prueba
Genera datos de prueba realistas y con formato valido para cada mercado. Cinco tipos de dato: direcciones de envio, datos de facturacion, registros de usuario, tarjetas de pago (con numeros de prueba de Adyen) y codigos promocionales. La salida se muestra en una tabla HTML con cabeceras en espanol, y permite copiar filas individuales, copiar la tabla completa en formato TSV, o descargar CSV compatible con Excel.

### Historia de Usuario
Genera una historia de usuario en formato **Como / Quiero / Para** a partir de una idea o necesidad, junto con una evaluacion de los seis criterios INVEST (Independiente, Negociable, Valiosa, Estimable, Pequena, Testeable) y criterios de aceptacion preliminares en formato Dado/Cuando/Entonces.

### Refinador de Requisitos
Analiza un requisito o historia de usuario y detecta ambiguedades, contradicciones, informacion faltante, dependencias no declaradas y sugiere preguntas concretas para refinarlo con los stakeholders.

### Casos Limite
Genera una lista de edge cases agrupados por categoria (valores frontera, estados vacios, concurrencia, i18n, permisos y roles, red y conectividad) a partir de un requisito.

### Conversor de Formatos
Convierte un texto entre formatos de documentacion agil: Gherkin (Given/When/Then), Markdown, Jira wiki, Azure DevOps y texto plano, preservando el contenido.

### Sprint Tracker
Reemplaza el seguimiento manual en Excel de tickets por sprint. Cada sprint tiene 5 pestanas (Resueltos, Creados, ReOpen, Prioridad Alta, JSD) con una hoja de calculo editable: columnas redimensionables, filas reordenables por drag-and-drop, busqueda instantanea, navegacion con teclado y enlaces directos al tracker (Ctrl+click sobre la clave del ticket). Los sprints se archivan con fecha de cierre y permanecen consultables. Funciona completamente offline. Los datos viven en localStorage.

### Regression Tracker
Tablero unico y permanente de regresiones ejecutadas, con 3 pestanas por plataforma (iOS, Android, WEB). Cada fila registra una regresion: enlace, version, fecha, notas y status. La columna de enlace acepta cualquier URL (SharePoint, Zephyr, Confluence...) pegada junto a un nombre — en reposo se muestra solo el nombre, y al hacer clic para editar aparece el valor completo; Ctrl+click abre siempre la URL exacta. "Archivar Regresion" guarda una copia del tablero en el historial y lo vacia; el historial se consulta en modo solo lectura. Comparte el componente de hoja de calculo (`TrackerGrid`) con el Sprint Tracker. Funciona completamente offline.

---

## Stack Tecnologico

| Capa | Tecnologia |
|---|---|
| Frontend | React 18, TypeScript, Vite 5 |
| LLM API | Groq (por defecto), OpenRouter, o cualquier endpoint compatible con OpenAI |
| PDF | jsPDF + jspdf-autotable |
| Tests | Vitest + React Testing Library (255 tests) |
| PWA | vite-plugin-pwa |
| Estilos | CSS personalizado (sin framework) |

---

## Requisitos

- **Node.js 18+**
- **npm**
- **Clave de API**: de [Groq](https://console.groq.com) (gratuita), [OpenRouter](https://openrouter.ai), o de tu proveedor Custom compatible con OpenAI

---

## Instalacion

```bash
git clone https://github.com/jraversbcn21/ACGen.git
cd ACGen/acgen
npm install
```

## Uso

```bash
npm run dev
```

Arranca el servidor de desarrollo de Vite (por defecto `http://localhost:5173`).

### Compilar para produccion

```bash
npm run build
```

### Tests

```bash
npm test
```

### Lint

```bash
npm run lint
```

### Despliegue

El despliegue a produccion es **automatico**. El proyecto esta conectado a Vercel por integracion Git, asi que cada merge a `main` dispara un build en la nube de Vercel que se promociona a produccion y actualiza el dominio publico [acgen.vercel.app](https://acgen.vercel.app). No hay pasos manuales (ni CLI de Vercel ni comandos de alias).

```
merge a main  ->  Vercel build + deploy (nube)  ->  produccion (acgen.vercel.app)
```

- Cada Pull Request genera ademas un deploy de *preview* con su propia URL para revisar los cambios antes de mergear.
- No requiere variables de entorno en el build: la app es 100% estatica y las API keys las introduce el usuario en el navegador.

> **Primer uso:** Al abrir la app por primera vez, elige tu proveedor (Groq/OpenRouter/Custom) e introduce tu API key en la configuracion superior. Todo se almacena unicamente en el localStorage del navegador.

---

## Estructura del Proyecto

```
acgen/
├── src/
│   ├── components/         # Componentes React (uno por herramienta + compartidos)
│   ├── config/             # Constantes, prompts, proveedores, datos de demo
│   ├── hooks/              # useLocalStorage, useHistory, useSprints, useRegressions, useWorkspace...
│   ├── services/           # Servicio API (multi-proveedor) + anonimizador
│   ├── i18n/                # Contexto de idioma, es.json / en.json
│   ├── types/              # Interfaces TypeScript
│   ├── App.tsx             # Componente principal con ruteo por vista + ErrorBoundary
│   ├── App.css             # Todos los estilos
│   └── main.tsx            # Punto de entrada
├── AGENTS.md               # Guia tecnica detallada para desarrolladores
├── README.md
├── package.json
└── vite.config.ts

Tests unitarios co-localizados con el codigo (*.test.ts / *.test.tsx).
```

---

## Modelos Disponibles

Los modelos se ejecutan a traves del proveedor seleccionado (Groq por defecto):

| Modelo | Notas |
|---|---|
| `openai/gpt-oss-120b` | **Recomendado**: mejor razonamiento |
| `openai/gpt-oss-20b` | Alternativa mas rapida |
| `llama-3.3-70b-versatile` | Buen equilibrio velocidad/calidad |
| `llama-3.1-8b-instant` | Maxima velocidad |
| `qwen/qwen3-32b` | Soporta reasoning format (visible/oculto) |

Con OpenRouter o Custom puedes usar cualquier modelo que exponga el proveedor.

---

## Contribuir

Consulta [`AGENTS.md`](./AGENTS.md) para conocer la arquitectura completa del proyecto, los detalles de implementacion de cada herramienta, y las guias para modificar prompts, formatos de salida o modelos.

---

## Licencia

MIT
