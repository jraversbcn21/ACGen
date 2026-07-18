import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { I18nProvider } from '../i18n/I18nContext';
import { RegressionTracker } from './RegressionTracker';

function renderTracker() {
  return render(
    <I18nProvider>
      <RegressionTracker />
    </I18nProvider>
  );
}

beforeEach(() => {
  localStorage.clear();
  // Fija el idioma: jsdom arranca con navigator.language en-US y los textos asertados son en español
  localStorage.setItem('acgen_lang', JSON.stringify('es'));
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('RegressionTracker', () => {
  it('renders the 3 platform tabs and the regression headers', () => {
    renderTracker();
    expect(screen.getByText('iOS')).toBeInTheDocument();
    expect(screen.getByText('Android')).toBeInTheDocument();
    expect(screen.getByText('WEB')).toBeInTheDocument();
    expect(screen.queryByText('Web-Desktop')).not.toBeInTheDocument();
    expect(screen.queryByText('Web-Mobile')).not.toBeInTheDocument();
    for (const h of ['Regresión', 'Versión', 'Fecha', 'Notas', 'Status']) {
      expect(screen.getByText(h)).toBeInTheDocument();
    }
  });

  it('a "Nombre - URL" cell becomes a link that ctrl+click opens', () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    renderTracker();
    const input = document.querySelector('tbody input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Smoke Login - https://zephyr.example.com/plan/9' } });
    const cell = screen.getByDisplayValue('Smoke Login - https://zephyr.example.com/plan/9');
    // En reposo la celda muestra solo el nombre; el valor completo sigue en el input
    expect(screen.getByText('Smoke Login')).toBeInTheDocument();
    expect((cell as HTMLInputElement).style.color).toBe('transparent');
    fireEvent.click(cell, { ctrlKey: true });
    expect(open).toHaveBeenCalledWith('https://zephyr.example.com/plan/9', '_blank', 'noopener,noreferrer');
  });

  it('each platform keeps its own grid', () => {
    renderTracker();
    const input = document.querySelector('tbody input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'solo en iOS' } });
    fireEvent.click(screen.getByText('Android'));
    expect(screen.queryByDisplayValue('solo en iOS')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('iOS'));
    expect(screen.getByDisplayValue('solo en iOS')).toBeInTheDocument();
  });

  it('archiving snapshots the board, clears it and shows the archived list button', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderTracker();
    const input = document.querySelector('tbody input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'checkout v9' } });
    fireEvent.click(screen.getByText('Archivar Regresión'));
    expect(screen.queryByDisplayValue('checkout v9')).not.toBeInTheDocument();
    const listButton = screen.getByText(/Archivadas \(1\)/);
    fireEvent.click(listButton);
    expect(screen.getByText(/^Regresión \d{4}-\d{2}-\d{2}$/)).toBeInTheDocument();
  });

  it('an archived snapshot opens read-only with its data', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderTracker();
    const input = document.querySelector('tbody input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'checkout v9' } });
    fireEvent.click(screen.getByText('Archivar Regresión'));
    fireEvent.click(screen.getByText(/Archivadas \(1\)/));
    fireEvent.click(screen.getByText(/^Regresión \d{4}-\d{2}-\d{2}$/));
    const cell = screen.getByDisplayValue('checkout v9');
    expect(cell).toHaveAttribute('readonly');
    expect(screen.queryByText('Archivar Regresión')).not.toBeInTheDocument();
  });

  it('deleting an archived snapshot shows the empty state', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderTracker();
    fireEvent.click(screen.getByText('Archivar Regresión'));
    fireEvent.click(screen.getByText(/Archivadas \(1\)/));
    fireEvent.click(screen.getByText('Eliminar'));
    expect(screen.getByText('No hay regresiones archivadas.')).toBeInTheDocument();
  });
});
