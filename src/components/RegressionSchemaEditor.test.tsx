import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { I18nProvider } from '../i18n/I18nContext';
import { RegressionSchemaEditor } from './RegressionSchemaEditor';
import { STORAGE_KEYS } from '../config/constants';
import { DEFAULT_SCHEMA } from '../types/schema';

function renderEditor(onClose = () => {}) {
  return render(
    <I18nProvider>
      <RegressionSchemaEditor onClose={onClose} />
    </I18nProvider>
  );
}

function storedSchema() {
  return JSON.parse(localStorage.getItem(STORAGE_KEYS.SCHEMA)!);
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('RegressionSchemaEditor', () => {
  it('lista los 6 campos y las 2 plataformas por defecto', () => {
    renderEditor();
    expect(screen.getByDisplayValue('Squad')).toBeTruthy();
    expect(screen.getByDisplayValue('Creator')).toBeTruthy();
    expect(screen.getByDisplayValue('APPS')).toBeTruthy();
    expect(screen.getByDisplayValue('WEB')).toBeTruthy();
  });

  it('renombrar un campo persiste el label al salir del input', () => {
    renderEditor();
    const input = screen.getByDisplayValue('Squad');
    fireEvent.change(input, { target: { value: 'Equipo' } });
    fireEvent.blur(input);
    expect(storedSchema().regression.ticketFields.find((f: { id: string }) => f.id === 'squad').label).toBe('Equipo');
  });

  it('un nombre vacio se descarta y restaura la etiqueta anterior', () => {
    renderEditor();
    const input = screen.getByDisplayValue('Squad');
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.blur(input);
    expect(localStorage.getItem(STORAGE_KEYS.SCHEMA)).toBeNull();
    expect(screen.getByDisplayValue('Squad')).toBeTruthy();
  });

  it('ocultar un campo escribe hidden sin tocar nada mas', () => {
    renderEditor();
    const row = screen.getByDisplayValue('Squad').closest('div')!;
    fireEvent.click(row.querySelector('input[type="checkbox"]')!);
    const fields = storedSchema().regression.ticketFields;
    expect(fields.find((f: { id: string }) => f.id === 'squad').hidden).toBe(true);
    expect(fields).toHaveLength(6);
    expect(fields.map((f: { id: string }) => f.id)).toEqual(
      DEFAULT_SCHEMA.regression.ticketFields.map((f) => f.id)
    );
  });

  it('anadir un campo lo agrega al final con un id UUID', () => {
    renderEditor();
    fireEvent.change(screen.getByPlaceholderText('New field name'), { target: { value: 'Entorno' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add field' }));
    const fields = storedSchema().regression.ticketFields;
    expect(fields).toHaveLength(7);
    expect(fields[6].label).toBe('Entorno');
    expect(fields[6].id).not.toBe('Entorno');
    expect(fields[6].id.length).toBeGreaterThan(10);
  });

  it('anadir con el nombre vacio no hace nada', () => {
    renderEditor();
    fireEvent.click(screen.getByRole('button', { name: 'Add field' }));
    expect(localStorage.getItem(STORAGE_KEYS.SCHEMA)).toBeNull();
  });

  it('anadir una plataforma la agrega al final con un id UUID', () => {
    renderEditor();
    fireEvent.change(screen.getByPlaceholderText('New platform name'), { target: { value: 'Android' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add platform' }));
    const platforms = storedSchema().regression.platforms;
    expect(platforms).toHaveLength(3);
    expect(platforms[2].label).toBe('Android');
    expect(platforms[2].id).not.toBe('Android');
    expect(platforms[2].id.length).toBeGreaterThan(10);
  });

  it('anadir una plataforma con el nombre vacio no hace nada', () => {
    renderEditor();
    fireEvent.click(screen.getByRole('button', { name: 'Add platform' }));
    expect(localStorage.getItem(STORAGE_KEYS.SCHEMA)).toBeNull();
  });

  it('no deja ocultar la ultima entrada visible de una lista', () => {
    localStorage.setItem(STORAGE_KEYS.SCHEMA, JSON.stringify({
      version: 1,
      regression: {
        ticketFields: DEFAULT_SCHEMA.regression.ticketFields,
        platforms: [{ id: 'ios', label: 'APPS' }, { id: 'webDesktop', label: 'WEB', hidden: true }],
      },
    }));
    renderEditor();
    const row = screen.getByDisplayValue('APPS').closest('div')!;
    expect((row.querySelector('input[type="checkbox"]') as HTMLInputElement).disabled).toBe(true);
  });

  it('restaurar por defecto solo toca la seccion regression', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    localStorage.setItem(STORAGE_KEYS.SCHEMA, JSON.stringify({
      version: 1,
      regression: {
        ...DEFAULT_SCHEMA.regression,
        ticketFields: DEFAULT_SCHEMA.regression.ticketFields.map((f) =>
          f.id === 'squad' ? { ...f, label: 'Equipo' } : f
        ),
      },
      sprint: { tabs: [{ id: 'resolved', label: 'Mio', headers: [] }] },
    }));
    renderEditor();
    fireEvent.click(screen.getByRole('button', { name: 'Reset to defaults' }));
    const next = storedSchema();
    expect(next.regression).toEqual(DEFAULT_SCHEMA.regression);
    // Una seccion que esta fase ni conoce (Fase 5 anadira `sprint`) sobrevive
    // al reset intacta: "Restaurar por defecto" toca solo `regression`.
    expect(next.sprint).toEqual({ tabs: [{ id: 'resolved', label: 'Mio', headers: [] }] });
  });

  it('un renombrado normal (no un reset) tambien preserva una seccion desconocida', () => {
    localStorage.setItem(STORAGE_KEYS.SCHEMA, JSON.stringify({
      version: 1,
      regression: DEFAULT_SCHEMA.regression,
      sprint: { tabs: [{ id: 'resolved', label: 'Mio', headers: [] }] },
    }));
    renderEditor();
    const input = screen.getByDisplayValue('Squad');
    fireEvent.change(input, { target: { value: 'Equipo' } });
    fireEvent.blur(input);
    const next = storedSchema();
    expect(next.regression.ticketFields.find((f: { id: string }) => f.id === 'squad').label).toBe('Equipo');
    expect(next.sprint).toEqual({ tabs: [{ id: 'resolved', label: 'Mio', headers: [] }] });
  });

  it('cierra con el boton de cerrar', () => {
    const onClose = vi.fn();
    renderEditor(onClose);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalled();
  });
});
