import { describe, it, expect } from 'vitest';
import { targetDimensions, MAX_BASE64_BYTES, assertDataUrlWithinLimit } from './image';

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
