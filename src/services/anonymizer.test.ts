// src/services/anonymizer.test.ts
import { describe, it, expect } from 'vitest';
import { anonymize, deanonymize } from './anonymizer';

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
    const { text, map } = anonymize('Llama al +34 612 345 678 o 555-1234');
    expect(text).toContain('[PHONE_1]');
    expect(text).toContain('[PHONE_2]');
  });

  it('replaces internal domains with [DOMAIN_N] placeholders', () => {
    const { text, map } = anonymize('Usuarios: @miempresa.corp y @interno.local');
    expect(text).toContain('[DOMAIN_1]');
    expect(text).toContain('[DOMAIN_2]');
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

  it('round-trip: anonymize + deanonymize = identity', () => {
    const input = 'Ticket PROJ-5678: usuario jorge@test.com desde IP 192.168.1.100 en https://jira.internal.corp/browse/PROJ-5678. Tel: +34 600 000 000. Atendido por Sr. Martinez.';
    const { text, map } = anonymize(input);
    const restored = deanonymize(text, map);
    expect(restored).toBe(input);
  });
});
