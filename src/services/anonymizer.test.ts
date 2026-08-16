// src/services/anonymizer.test.ts
import { describe, it, expect } from 'vitest';
import { anonymize, deanonymize, applyPlaceholderEdits, splitPendingPlaceholder } from './anonymizer';

describe('anonymize', () => {
  it('replaces emails with [EMAIL_N] placeholders', () => {
    const { text, map } = anonymize('Contacto: jorge@example.com y maria@test.org');
    expect(text).toContain('[EMAIL_1]');
    expect(text).toContain('[EMAIL_2]');
    expect(text).not.toContain('jorge@example.com');
    expect(map['[EMAIL_1]']).toBe('jorge@example.com');
    expect(map['[EMAIL_2]']).toBe('maria@test.org');
  });

  it('replaces URLs with [URL_N] placeholders', () => {
    const { text, map } = anonymize('Visita https://example.com/path?q=1 o http://test.org');
    expect(text).toContain('[URL_1]');
    expect(text).toContain('[URL_2]');
    expect(text).not.toContain('https://example.com');
    expect(map['[URL_1]']).toBe('https://example.com/path?q=1');
    expect(map['[URL_2]']).toBe('http://test.org');
  });

  it('replaces IP addresses with [IP_N] placeholders', () => {
    const { text, map } = anonymize('Servidor en 192.168.1.1 y 10.0.0.255');
    expect(text).toContain('[IP_1]');
    expect(text).toContain('[IP_2]');
    expect(map['[IP_1]']).toBe('192.168.1.1');
    expect(map['[IP_2]']).toBe('10.0.0.255');
  });

  it('replaces ticket IDs with [TICKET_N] placeholders', () => {
    const { text, map } = anonymize('Issues: PROJ-1234 y AZ-5678');
    expect(text).toContain('[TICKET_1]');
    expect(text).toContain('[TICKET_2]');
    expect(map['[TICKET_1]']).toBe('PROJ-1234');
    expect(map['[TICKET_2]']).toBe('AZ-5678');
  });

  it('replaces phone numbers with [PHONE_N] placeholders', () => {
    const input = 'Llama al +34 612 345 678 o 555-1234';
    const { text, map } = anonymize(input);
    expect(text).toContain('[PHONE_1]');
    expect(text).toContain('[PHONE_2]');
    expect(text).not.toContain('612 345 678');
    expect(deanonymize(text, map)).toBe(input);
  });

  it('does not flag indented Markdown/Gherkin list runs as phones', () => {
    const input = 'Pasos:\n    - Abrir la web\n    - Pulsar comprar\n    - Verificar el carrito';
    const { text, map } = anonymize(input);
    expect(text).not.toContain('[PHONE');
    expect(text).toBe(input);
    expect(Object.keys(map)).toHaveLength(0);
  });

  it('does not flag separator runs with fewer than 7 digits as phones', () => {
    const input = 'Rango: 1 - 2 - 3';
    const { text } = anonymize(input);
    expect(text).not.toContain('[PHONE');
  });

  it('does not flag short numbers as phones', () => {
    const input = 'El pedido 555-123 tiene 42 unidades';
    const { text } = anonymize(input);
    expect(text).not.toContain('[PHONE');
  });

  it('still masks bare 7+ digit numbers (privacy-first: masking an id beats leaking a phone)', () => {
    const input = 'Referencia interna 612345678';
    const { text, map } = anonymize(input);
    expect(text).toContain('[PHONE_1]');
    expect(map['[PHONE_1]']).toBe('612345678');
  });

  it('phone matches do not swallow surrounding whitespace', () => {
    const input = 'llama al 612 345 678 ya';
    const { text, map } = anonymize(input);
    expect(text).toBe('llama al [PHONE_1] ya');
    expect(map['[PHONE_1]']).toBe('612 345 678');
    expect(deanonymize(text, map)).toBe(input);
  });

  it('replaces internal domains with [DOMAIN_N] placeholders', () => {
    const input = 'Usuarios: @miempresa.corp y @interno.local';
    const { text, map } = anonymize(input);
    expect(text).toContain('[DOMAIN_1]');
    expect(text).toContain('[DOMAIN_2]');
    expect(text).not.toContain('miempresa.corp');
    expect(deanonymize(text, map)).toBe(input);
  });

  it('replaces proper names with [NAME_N] placeholders', () => {
    const { text, map } = anonymize('Atendido por Sr. Garcia y Dra. Lopez');
    expect(text).toContain('[NAME_1]');
    expect(text).toContain('[NAME_2]');
    expect(map['[NAME_1]']).toBe('Sr. Garcia');
    expect(map['[NAME_2]']).toBe('Dra. Lopez');
  });

  it('returns unchanged text when no patterns match', () => {
    const { text, map } = anonymize('Este es un texto normal sin datos sensibles.');
    expect(text).toBe('Este es un texto normal sin datos sensibles.');
    expect(Object.keys(map)).toHaveLength(0);
  });

  it('handles overlapping patterns correctly (email vs domain)', () => {
    const { text, map } = anonymize('Contacto: admin@corp.local');
    expect(text).toContain('[EMAIL_1]');
    expect(map['[EMAIL_1]']).toBe('admin@corp.local');
    expect(text).not.toContain('[DOMAIN');
  });
});

describe('deanonymize', () => {
  it('restores all placeholders to original values', () => {
    const original = 'Email: jorge@example.com, URL: https://test.com, IP: 10.0.0.1';
    const { text, map } = anonymize(original);
    const restored = deanonymize(text, map);
    expect(restored).toBe(original);
  });

  it('returns text unchanged when map is empty', () => {
    const result = deanonymize('Texto sin cambios', {});
    expect(result).toBe('Texto sin cambios');
  });

  it('handles partial restoration (some keys missing from map)', () => {
    const result = deanonymize('Enviar a [EMAIL_1] con copia a [EMAIL_2]', {
      '[EMAIL_1]': 'a@b.com',
    });
    expect(result).toBe('Enviar a a@b.com con copia a [EMAIL_2]');
  });

  it('restaura placeholders anidados: un email incrustado en una URL', () => {
    // EMAIL corre antes que URL, asi que el valor de [URL_1] contiene el
    // placeholder [EMAIL_1]; una sola pasada en orden de insercion lo dejaba
    // sin restaurar en el texto final.
    const input = 'El enlace https://shop.example.com/reset?email=user@corp.com devuelve 500.';
    const { text, map } = anonymize(input);
    expect(deanonymize(text, map)).toBe(input);
  });

  it('round-trip: anonymize + deanonymize = identity', () => {
    const input = 'Ticket PROJ-5678: usuario jorge@test.com desde IP 192.168.1.100 en https://jira.internal.corp/browse/PROJ-5678. Tel: +34 600 000 000. Atendido por Sr. Martinez.';
    const { text, map } = anonymize(input);
    const restored = deanonymize(text, map);
    expect(restored).toBe(input);
  });
});

describe('applyPlaceholderEdits', () => {
  it('renames a placeholder in both the outgoing text and the restore map', () => {
    const { text, map } = anonymize('Avisa a jorge@example.com');
    const result = applyPlaceholderEdits(text, map, { '[EMAIL_1]': '[PERSONA]' });

    expect(result.text).toBe('Avisa a [PERSONA]');
    expect(result.map).toEqual({ '[PERSONA]': 'jorge@example.com' });
  });

  it('leaves untouched placeholders as they are', () => {
    const { text, map } = anonymize('De jorge@example.com a maria@test.org');
    const result = applyPlaceholderEdits(text, map, { '[EMAIL_2]': '[DESTINO]' });

    expect(result.text).toBe('De [EMAIL_1] a [DESTINO]');
    expect(result.map).toEqual({ '[EMAIL_1]': 'jorge@example.com', '[DESTINO]': 'maria@test.org' });
  });

  it('returns text and map unchanged when there are no edits', () => {
    const { text, map } = anonymize('Contacto: jorge@example.com');
    const result = applyPlaceholderEdits(text, map, {});

    expect(result.text).toBe(text);
    expect(result.map).toEqual(map);
  });

  it('ignores a blank edit so the value stays restorable', () => {
    const { text, map } = anonymize('Contacto: jorge@example.com');
    const result = applyPlaceholderEdits(text, map, { '[EMAIL_1]': '   ' });

    expect(result.text).toBe('Contacto: [EMAIL_1]');
    expect(result.map).toEqual({ '[EMAIL_1]': 'jorge@example.com' });
  });

  it('edited text still round-trips back to the original', () => {
    const input = 'Escribe a jorge@example.com sobre PROJ-1234';
    const { text, map } = anonymize(input);
    const edited = applyPlaceholderEdits(text, map, { '[EMAIL_1]': '[CORREO]', '[TICKET_1]': '[ISSUE]' });

    expect(edited.text).toBe('Escribe a [CORREO] sobre [ISSUE]');
    expect(deanonymize(edited.text, edited.map)).toBe(input);
  });
});

describe('splitPendingPlaceholder', () => {
  it('holds back a placeholder that is still being streamed', () => {
    expect(splitPendingPlaceholder('Contacta a [EMA')).toEqual(['Contacta a ', '[EMA']);
  });

  it('emits everything once the placeholder is complete', () => {
    expect(splitPendingPlaceholder('Contacta a [EMAIL_1] hoy')).toEqual(['Contacta a [EMAIL_1] hoy', '']);
  });

  it('emits plain text untouched', () => {
    expect(splitPendingPlaceholder('texto normal sin corchetes')).toEqual(['texto normal sin corchetes', '']);
  });

  it('does not hold back a bracket that cannot become a placeholder', () => {
    expect(splitPendingPlaceholder('ver [nota al pie')).toEqual(['ver [nota al pie', '']);
  });

  it('holds back only the trailing partial after a complete placeholder', () => {
    expect(splitPendingPlaceholder('a [EMAIL_1] y [UR')).toEqual(['a [EMAIL_1] y ', '[UR']);
  });

  it('holds back a lone opening bracket', () => {
    expect(splitPendingPlaceholder('final [')).toEqual(['final ', '[']);
  });

  it('con claves del mapa, retiene una cola que es prefijo de una clave renombrada', () => {
    // El usuario puede renombrar [EMAIL_1] a texto libre en el modal de revision;
    // el regex de placeholders por defecto no protege esas claves.
    expect(splitPendingPlaceholder('aviso a CORREO', ['CORREO_CLIENTE'])).toEqual(['aviso a ', 'CORREO']);
  });

  it('con claves del mapa, emite el texto cuando la clave esta completa', () => {
    expect(splitPendingPlaceholder('aviso a CORREO_CLIENTE ya', ['CORREO_CLIENTE'])).toEqual(['aviso a CORREO_CLIENTE ya', '']);
  });

  it('con claves del mapa, las claves por defecto [PREFIX_n] siguen protegidas', () => {
    expect(splitPendingPlaceholder('Contacta a [EMA', ['[EMAIL_1]'])).toEqual(['Contacta a ', '[EMA']);
  });
});
