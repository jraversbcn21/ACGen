import { describe, it, expect, vi, afterEach } from 'vitest';
import { targetDimensions, MAX_BASE64_BYTES, assertDataUrlWithinLimit, fileToProcessedDataUrl } from './image';

describe('targetDimensions', () => {
  it('no toca imágenes dentro del límite', () => {
    expect(targetDimensions(800, 600, 1568)).toEqual({ width: 800, height: 600 });
  });

  it('reduce el lado largo horizontal al límite manteniendo proporción', () => {
    expect(targetDimensions(3136, 1568, 1568)).toEqual({ width: 1568, height: 784 });
  });

  it('reduce el lado largo vertical al límite manteniendo proporción', () => {
    expect(targetDimensions(1000, 3136, 1568)).toEqual({ width: 500, height: 1568 });
  });

  it('redondea a enteros', () => {
    const { width, height } = targetDimensions(3000, 2000, 1568);
    expect(Number.isInteger(width)).toBe(true);
    expect(Number.isInteger(height)).toBe(true);
    expect(width).toBe(1568);
  });
});

describe('assertDataUrlWithinLimit', () => {
  it('acepta un data URL pequeño', () => {
    expect(() => assertDataUrlWithinLimit('data:image/png;base64,AAAA')).not.toThrow();
  });

  it('lanza error.imageTooLarge si supera el tope', () => {
    const big = 'data:image/jpeg;base64,' + 'A'.repeat(MAX_BASE64_BYTES + 1);
    expect(() => assertDataUrlWithinLimit(big)).toThrowError('error.imageTooLarge');
  });
});

describe('fileToProcessedDataUrl - manejo de errores', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('si el canvas lanza al dibujar/codificar, rechaza con error.notAnImage (no el mensaje crudo del navegador)', async () => {
    const originalCreateElement = document.createElement.bind(document);
    const fakeCtx = {
      drawImage: () => {
        throw new DOMException('mensaje interno del navegador', 'InvalidStateError');
      },
    };
    const fakeCanvas = {
      width: 0,
      height: 0,
      getContext: () => fakeCtx,
      toDataURL: () => 'data:image/jpeg;base64,NO_DEBERIA_LLEGAR',
    };
    vi.spyOn(document, 'createElement').mockImplementation(((tag: string) => {
      if (tag === 'canvas') return fakeCanvas as unknown as HTMLCanvasElement;
      return originalCreateElement(tag);
    }) as typeof document.createElement);

    class FakeImage {
      naturalWidth = 3000;
      naturalHeight = 2000;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_v: string) {
        queueMicrotask(() => this.onload?.());
      }
    }
    vi.stubGlobal('Image', FakeImage as unknown as typeof Image);

    const file = new File(['x'], 'foo.png', { type: 'image/png' });
    await expect(fileToProcessedDataUrl(file)).rejects.toThrow('error.notAnImage');
  });

  it('si la lectura del fichero se aborta, rechaza con error.notAnImage en vez de dejar la promesa colgada', async () => {
    class FakeFileReader {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      onabort: (() => void) | null = null;
      result: string | null = null;
      readAsDataURL() {
        queueMicrotask(() => this.onabort?.());
      }
    }
    vi.stubGlobal('FileReader', FakeFileReader as unknown as typeof FileReader);

    const file = new File(['x'], 'foo.png', { type: 'image/png' });
    await expect(fileToProcessedDataUrl(file)).rejects.toThrow('error.notAnImage');
  });
});

describe('fileToProcessedDataUrl - recompresión por tope de tamaño', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('dimensiones dentro del límite pero data URL original por encima del tope: recomprime con canvas en vez de rechazar', async () => {
    class FakeFileReader {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      onabort: (() => void) | null = null;
      result: string | null = null;
      readAsDataURL() {
        this.result = 'data:image/png;base64,' + 'A'.repeat(MAX_BASE64_BYTES + 1000);
        queueMicrotask(() => this.onload?.());
      }
    }
    vi.stubGlobal('FileReader', FakeFileReader as unknown as typeof FileReader);

    class FakeImage {
      naturalWidth = 1400;
      naturalHeight = 900;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_v: string) {
        queueMicrotask(() => this.onload?.());
      }
    }
    vi.stubGlobal('Image', FakeImage as unknown as typeof Image);

    const originalCreateElement = document.createElement.bind(document);
    const fakeCtx = { drawImage: () => {} };
    const fakeCanvas = {
      width: 0,
      height: 0,
      getContext: () => fakeCtx,
      toDataURL: () => 'data:image/jpeg;base64,SCALED_SMALL',
    };
    vi.spyOn(document, 'createElement').mockImplementation(((tag: string) => {
      if (tag === 'canvas') return fakeCanvas as unknown as HTMLCanvasElement;
      return originalCreateElement(tag);
    }) as typeof document.createElement);

    const file = new File(['x'], 'foo.png', { type: 'image/png' });
    const result = await fileToProcessedDataUrl(file);
    expect(result).toBe('data:image/jpeg;base64,SCALED_SMALL');
  });
});
