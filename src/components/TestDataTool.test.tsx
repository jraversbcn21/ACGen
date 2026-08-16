import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TestDataTool } from './TestDataTool';
import { I18nProvider } from '../i18n/I18nContext';

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
