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
