import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TestDataTool } from './TestDataTool';
import { I18nProvider } from '../i18n/I18nContext';
import { streamWithGroq } from '../services/apiService';

vi.mock('../services/apiService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/apiService')>();
  return { ...actual, streamWithGroq: vi.fn() };
});

function renderTool() {
  localStorage.setItem('acgen_lang', JSON.stringify('es'));
  render(
    <I18nProvider>
      <TestDataTool apiKey="test-key" model="test-model" />
    </I18nProvider>,
  );
}

describe('TestDataTool — Limpiar y Deshacer', () => {
  it('Deshacer restaura tambien el contexto adicional y los campos del formulario', () => {
    renderTool();
    const quantity = document.getElementById('td-quantity') as HTMLInputElement;
    const context = document.getElementById('td-context') as HTMLTextAreaElement;
    fireEvent.change(quantity, { target: { value: '5' } });
    fireEvent.change(context, { target: { value: 'usuarios con tarjetas caducadas' } });

    fireEvent.click(screen.getByRole('button', { name: 'Limpiar' }));
    expect(context.value).toBe('');

    fireEvent.click(screen.getByRole('button', { name: 'Deshacer' }));
    expect(context.value).toBe('usuarios con tarjetas caducadas');
    expect(quantity.value).toBe('5');
  });
});

describe('TestDataTool — Limpiar y columnas', () => {
  it('Limpiar se habilita con solo el contexto adicional escrito', () => {
    renderTool();
    fireEvent.change(document.getElementById('td-context')!, { target: { value: 'solo contexto' } });
    expect(screen.getByRole('button', { name: 'Limpiar' })).toBeEnabled();
  });

  it('la tabla muestra la union de columnas, no solo las de la primera fila', async () => {
    vi.mocked(streamWithGroq).mockImplementation(async function* () {
      yield { token: JSON.stringify([{ nombre: 'Ana' }, { nombre: 'Luis', email: 'l@x.com' }]), done: false };
      yield { token: '', done: true };
    });
    renderTool();
    fireEvent.click(screen.getByRole('button', { name: /generar/i }));
    await waitFor(() => expect(screen.getByText('l@x.com')).toBeInTheDocument());
    expect(screen.getByRole('columnheader', { name: /email/i })).toBeInTheDocument();
  });
});
