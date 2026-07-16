# ACGen: Suite de herramientas de QA automatizadas con IA

![ACGen landing](public/screenshot.png)

**\ud83d\udd17 Demo en vivo: [acgen.vercel.app](https://acgen.vercel.app)**

![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white)

ACGen es una aplicacion web (SPA) que integra cinco herramientas para agilizar el trabajo diario de equipos QA: cuatro impulsadas por IA mediante la API de Groq (LLM) y un Sprint Tracker offline para seguimiento de tickets. Deploy 100% estatico.

## Caracteristicas

- **Criterios de Aceptacion**: Genera criterios Dado/Cuando/Entonces desde requisitos o descripcion de tickets. Validacion automatica de formato. Historial persistente de las ultimas 10 generaciones.
- **Test Case Generator**: Genera casos de prueba QA estructurados (JSON) con prioridad, tipo, pasos y resultado esperado. Exporta como tabla estructurada o PDF.
- **Bug Report Generator**: Genera bug reports en formato estructurado con paneles, seleccion de plataforma (web/App Android/App iOS), campos dinamicos y campo de contexto adicional. Historial persistente de las ultimas 10 generaciones.
- **Datos de Prueba**: Genera datos realistas (direcciones, facturacion, registros, tarjetas, cupones) adaptados a 217 mercados. Exporta como TSV o CSV (con proteccion contra inyeccion de formulas en Excel).
- **Sprint Tracker**: Hoja de calculo offline por sprint con 5 pestanas (Resueltos, Creados, ReOpen, Prioridad Alta, JSD): filas reordenables por drag-and-drop, busqueda con debounce, columnas redimensionables, enlaces a tickets (Ctrl+click), pegado desde SnapLink y archivado historico. Sin dependencia de Groq ni APIs externas.
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

### Sprint Tracker
Reemplaza el seguimiento manual en Excel de tickets por sprint. Cada sprint tiene 5 pestanas (Resueltos, Creados, ReOpen, Prioridad Alta, JSD) con una hoja de calculo editable: columnas redimensionables, filas reordenables por drag-and-drop, busqueda instantanea, navegacion con teclado y enlaces directos al tracker (Ctrl+click sobre la clave del ticket). Los sprints se archivan con fecha de cierre y permanecen consultables. Funciona completamente offline. Los datos viven en localStorage.

---

## Stack Tecnologico

| Capa | Tecnologia |
|---|---|
| Frontend | React 18, TypeScript, Vite 5 |
| LLM API | Groq (endpoint compatible con OpenAI) |
| PDF | jsPDF + jspdf-autotable |
| Tests | Vitest + React Testing Library (65 tests) |
| Estilos | CSS personalizado (sin framework) |

---

## Requisitos

- **Node.js 18+**
- **npm**
- **Clave de API de Groq**: registrate en [https://console.groq.com](https://console.groq.com) y obten una API key gratuita

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

> **Primer uso:** Al abrir la app por primera vez, introduce tu API key de Groq en el campo superior. La configuracion se almacena unicamente en el localStorage del navegador.

---

## Estructura del Proyecto

```
acgen/
├── src/
│   ├── components/         # Componentes React (uno por herramienta + compartidos)
│   ├── config/             # Constantes, prompts, configuracion de modelos
│   ├── hooks/              # useLocalStorage, useHistory, useSprints
│   ├── services/           # Servicio API (Groq)
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

Los modelos se ejecutan a traves de la API de Groq:

| Modelo | Notas |
|---|---|
| `openai/gpt-oss-120b` | **Recomendado**: mejor razonamiento |
| `openai/gpt-oss-20b` | Alternativa mas rapida |
| `llama-3.3-70b-versatile` | Buen equilibrio velocidad/calidad |
| `llama-3.1-8b-instant` | Maxima velocidad |
| `qwen/qwen3-32b` | Soporta reasoning format (visible/oculto) |

---

## Contribuir

Consulta [`AGENTS.md`](./AGENTS.md) para conocer la arquitectura completa del proyecto, los detalles de implementacion de cada herramienta, y las guias para modificar prompts, formatos de salida o modelos.

---

## Licencia

MIT
