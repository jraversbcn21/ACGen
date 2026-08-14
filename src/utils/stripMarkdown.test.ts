import { describe, it, expect } from 'vitest';
import { stripMarkdown } from './stripMarkdown';

describe('stripMarkdown', () => {
  it('quita las negritas que pide USER_STORY_PROMPT', () => {
    expect(stripMarkdown('**Como** cliente registrado')).toBe('Como cliente registrado');
    expect(stripMarkdown('**Quiero** guardar productos')).toBe('Quiero guardar productos');
    expect(stripMarkdown('__Para__ comprarlos luego')).toBe('Para comprarlos luego');
  });

  it('quita las cabeceras dejando su texto', () => {
    expect(stripMarkdown('### 1. Ambiguedades')).toBe('1. Ambiguedades');
    expect(stripMarkdown('# Titulo')).toBe('Titulo');
    expect(stripMarkdown('###### Nivel 6')).toBe('Nivel 6');
  });

  it('quita cursivas y codigo en linea', () => {
    expect(stripMarkdown('un termino *enfatizado* aqui')).toBe('un termino enfatizado aqui');
    expect(stripMarkdown('el campo `email` es obligatorio')).toBe('el campo email es obligatorio');
  });

  it('conserva las vinetas: son legibles tal cual', () => {
    expect(stripMarkdown('- Independent: OK')).toBe('- Independent: OK');
    expect(stripMarkdown('* Negotiable: OK')).toBe('* Negotiable: OK');
    expect(stripMarkdown('  - anidada')).toBe('  - anidada');
  });

  it('limpia negritas dentro de una vineta sin tocar la vineta', () => {
    expect(stripMarkdown('- **Independent**: sin dependencias')).toBe('- Independent: sin dependencias');
  });

  it('no rompe asteriscos que no son markdown', () => {
    expect(stripMarkdown('el total es 2 * 3 unidades')).toBe('el total es 2 * 3 unidades');
    expect(stripMarkdown('campo obligatorio *')).toBe('campo obligatorio *');
  });

  it('conserva saltos de linea y estructura del documento', () => {
    const entrada = '**Como** cliente\n**Quiero** guardar\n\n### INVEST\n- Independent: OK';
    expect(stripMarkdown(entrada)).toBe('Como cliente\nQuiero guardar\n\nINVEST\n- Independent: OK');
  });

  it('es seguro con texto vacio o sin markdown', () => {
    expect(stripMarkdown('')).toBe('');
    expect(stripMarkdown('texto normal sin nada')).toBe('texto normal sin nada');
  });

  it('tolera markdown a medias del streaming sin comerse el texto', () => {
    expect(stripMarkdown('**Como** cliente\n**Quie')).toBe('Como cliente\n**Quie');
  });
});
