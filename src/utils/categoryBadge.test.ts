import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { categoryBadge, CATEGORY_BADGES, FALLBACK_BADGE } from './categoryBadge';

/** Lee las clases .badge-* realmente definidas en App.css: si el test las duplicara
 *  a mano volveria a desincronizarse, que es justo el bug que cubre. */
function clasesDefinidasEnCss(): Set<string> {
  const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'App.css'), 'utf8');
  return new Set(Array.from(css.matchAll(/\.(badge-[a-z]+)\s*\{/g), (m) => m[1]));
}

describe('categoryBadge', () => {
  it('toda clase del mapa existe en App.css (el bug: badge-warning y badge-danger nunca existieron)', () => {
    const definidas = clasesDefinidasEnCss();
    expect(definidas.size).toBeGreaterThan(0);
    for (const [categoria, clase] of Object.entries(CATEGORY_BADGES)) {
      expect(definidas, `${categoria} apunta a "${clase}", que no esta definida en App.css`).toContain(clase);
    }
    expect(definidas, `el fallback "${FALLBACK_BADGE}" no esta definido en App.css`).toContain(FALLBACK_BADGE);
  });

  it('las seis categorias del prompt tienen badge propio', () => {
    expect(categoryBadge('Valores frontera')).toBe('badge-high');
    expect(categoryBadge('Estados vacios')).toBe('badge-medium');
    expect(categoryBadge('Concurrencia')).toBe('badge-medium');
    expect(categoryBadge('Internacionalizacion (i18n)')).toBe('badge-info');
    expect(categoryBadge('Permisos y roles')).toBe('badge-high');
    expect(categoryBadge('Red y conectividad')).toBe('badge-medium');
  });

  it('acepta las tildes que devuelve el modelo aunque la clave vaya sin ellas', () => {
    expect(categoryBadge('Estados vacíos')).toBe('badge-medium');
    expect(categoryBadge('Internacionalización (i18n)')).toBe('badge-info');
    expect(categoryBadge('Internacionalización')).toBe('badge-info');
  });

  it('tolera diferencias de caja y espacios sobrantes del modelo', () => {
    expect(categoryBadge('  concurrencia  ')).toBe('badge-medium');
    expect(categoryBadge('VALORES FRONTERA')).toBe('badge-high');
  });

  it('una categoria inventada cae al badge neutro en vez de quedarse sin estilo', () => {
    expect(categoryBadge('Categoria que el modelo se invento')).toBe('badge-medium');
    expect(categoryBadge('')).toBe('badge-medium');
  });
});
