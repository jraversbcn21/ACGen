import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BugReportTool } from './BugReportTool';
import { I18nProvider } from '../i18n/I18nContext';

function renderTool() {
  localStorage.setItem('acgen_lang', JSON.stringify('es'));
  render(
    <I18nProvider>
      <BugReportTool apiKey="test-key" model="test-model" />
    </I18nProvider>,
  );
}

describe('BugReportTool — Limpiar y Deshacer', () => {
  it('Deshacer restaura tambien la descripcion y los campos del formulario', () => {
    renderTool();
    const description = document.getElementById('br-description') as HTMLTextAreaElement;
    const url = document.getElementById('br-url') as HTMLInputElement;
    fireEvent.change(description, { target: { value: 'La pasarela de pago devuelve 500' } });
    fireEvent.change(url, { target: { value: 'https://tienda.example.com/checkout' } });

    fireEvent.click(screen.getByRole('button', { name: 'Limpiar' }));
    expect(description.value).toBe('');

    // El toast ofrece Deshacer sin avisar de que sea parcial: debe volver TODO,
    // no solo el output — la descripcion tecleada es el estado mas valioso.
    fireEvent.click(screen.getByRole('button', { name: 'Deshacer' }));
    expect(description.value).toBe('La pasarela de pago devuelve 500');
    expect(url.value).toBe('https://tienda.example.com/checkout');
  });
});
