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

  it('elimina las reglas horizontales, que no aportan nada en texto plano', () => {
    expect(stripMarkdown('arriba\n---\nabajo')).toBe('arriba\nabajo');
    expect(stripMarkdown('arriba\n***\nabajo')).toBe('arriba\nabajo');
    expect(stripMarkdown('arriba\n___\nabajo')).toBe('arriba\nabajo');
  });

  it('convierte la tabla INVEST en filas legibles y tira la fila separadora', () => {
    const tabla = [
      '| Criterio | Estado | Observacion |',
      '|-----------|--------|-------------|',
      '| Independent | OK | No bloquea checkout |',
      '| Negotiable | OK | Alcance ajustable |',
    ].join('\n');
    expect(stripMarkdown(tabla)).toBe(
      ['Criterio | Estado | Observacion', 'Independent | OK | No bloquea checkout', 'Negotiable | OK | Alcance ajustable'].join('\n'),
    );
  });

  it('limpia el markdown de dentro de las celdas', () => {
    expect(stripMarkdown('| **Independent** | `OK` |')).toBe('Independent | OK');
  });

  it('no confunde con una tabla una frase que lleve una barra', () => {
    expect(stripMarkdown('elige commit | push segun el caso')).toBe('elige commit | push segun el caso');
    expect(stripMarkdown('el separador es | y ya')).toBe('el separador es | y ya');
  });

  it('no confunde una vineta con una regla horizontal', () => {
    expect(stripMarkdown('- Independent: OK')).toBe('- Independent: OK');
    expect(stripMarkdown('-- pendiente')).toBe('-- pendiente');
  });

  it('es seguro con texto vacio o sin markdown', () => {
    expect(stripMarkdown('')).toBe('');
    expect(stripMarkdown('texto normal sin nada')).toBe('texto normal sin nada');
  });

  it('tolera markdown a medias del streaming sin comerse el texto', () => {
    expect(stripMarkdown('**Como** cliente\n**Quie')).toBe('Como cliente\n**Quie');
  });
});

describe('stripMarkdown — asteriscos que no son cursiva', () => {
  it('conserva comodines y globs como *.jpg y *.png', () => {
    expect(stripMarkdown('Acepta *.jpg y *.png')).toBe('Acepta *.jpg y *.png');
    expect(stripMarkdown('SELECT * FROM pedidos WHERE total > 0')).toBe('SELECT * FROM pedidos WHERE total > 0');
  });
});
