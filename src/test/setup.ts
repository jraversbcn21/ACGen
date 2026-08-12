import '@testing-library/jest-dom';

let uuidCounter = 0;
Object.defineProperty(globalThis, 'crypto', {
  value: {
    randomUUID: () => `test-uuid-${++uuidCounter}`,
  },
});

// jsdom no implementa DragEvent (https://github.com/jsdom/jsdom/issues/2913),
// así que fireEvent.dragStart/dragOver/drop caen a un Event genérico que
// descarta clientY y dataTransfer. Este polyfill mínimo basado en MouseEvent
// conserva clientY (usado para calcular la mitad superior/inferior en el
// reorder por drag & drop) sin necesitar DataTransfer real.
if (typeof globalThis.DragEvent === 'undefined') {
  class DragEventPolyfill extends MouseEvent {
    dataTransfer: unknown;
    constructor(type: string, eventInitDict: MouseEventInit & { dataTransfer?: unknown } = {}) {
      const { dataTransfer, ...mouseInit } = eventInitDict;
      super(type, mouseInit);
      this.dataTransfer = dataTransfer ?? null;
    }
  }
  // @ts-expect-error -- polyfill mínimo para entorno de test, no implementa toda la interfaz DragEvent
  globalThis.DragEvent = DragEventPolyfill;
}

beforeEach(() => {
  uuidCounter = 0;
  try { localStorage.clear(); } catch { /* node env lacks localStorage */ }
});
