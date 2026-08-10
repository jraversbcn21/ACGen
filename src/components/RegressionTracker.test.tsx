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

function createRegression(version = '1.0.0', url = 'Excel - https://sheets.example.com/r/1') {
  fireEvent.click(screen.getByText('+ Nueva regresión'));
  fireEvent.change(screen.getByLabelText('Versión'), { target: { value: version } });
  fireEvent.change(screen.getByLabelText('URL'), { target: { value: url } });
  fireEvent.click(screen.getByText('Crear'));
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('acgen_lang', JSON.stringify('es'));
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('RegressionTracker (versioned)', () => {
  it('renders the 2 platform tabs and the empty state', () => {
    renderTracker();
    expect(screen.getByText('APPS')).toBeInTheDocument();
    expect(screen.getByText('WEB')).toBeInTheDocument();
    expect(screen.getByText(/No hay regresiones/)).toBeInTheDocument();
  });

  it('creates a regression from the inline form (Crear disabled without version)', () => {
    renderTracker();
    fireEvent.click(screen.getByText('+ Nueva regresión'));
    const createBtn = screen.getByText('Crear') as HTMLButtonElement;
    expect(createBtn.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Versión'), { target: { value: '1.0.0' } });
    expect(createBtn.disabled).toBe(false);
    fireEvent.click(createBtn);
    expect(screen.getByText('1.0.0')).toBeInTheDocument();
    expect(screen.getByText('0 tickets')).toBeInTheDocument();
    // El formulario se cierra tras crear
    expect(screen.queryByLabelText('Versión')).not.toBeInTheDocument();
  });

  it('each platform keeps its own regression list', () => {
    renderTracker();
    createRegression('1.0.0');
    fireEvent.click(screen.getByText('WEB'));
    expect(screen.queryByText('1.0.0')).not.toBeInTheDocument();
    expect(screen.getByText(/No hay regresiones/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('APPS'));
    expect(screen.getByText('1.0.0')).toBeInTheDocument();
  });

  it('archiving a card (with confirm) moves it to the mixed history labeled PLATFORM · version', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderTracker();
    createRegression('1.0.0');
    fireEvent.click(screen.getByText('Archivar'));
    expect(screen.queryByText('1.0.0')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText(/Archivadas \(1\)/));
    expect(screen.getByText('APPS · 1.0.0')).toBeInTheDocument();
  });

  it('cancelling the archive confirm keeps the card', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderTracker();
    createRegression('1.0.0');
    fireEvent.click(screen.getByText('Archivar'));
    expect(screen.getByText('1.0.0')).toBeInTheDocument();
    expect(screen.queryByText(/Archivadas/)).not.toBeInTheDocument();
  });

  it('deleting a card (with confirm) removes it', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderTracker();
    createRegression('1.0.0');
    fireEvent.click(screen.getByText('Eliminar'));
    expect(screen.queryByText('1.0.0')).not.toBeInTheDocument();
  });

  it('a new-format archived entry opens as a read-only expanded card', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderTracker();
    createRegression('1.0.0');
    fireEvent.click(screen.getByText('Archivar'));
    fireEvent.click(screen.getByText(/Archivadas \(1\)/));
    fireEvent.click(screen.getByText('APPS · 1.0.0'));
    expect(screen.getByText('Prioridad')).toBeInTheDocument(); // tabla desplegada
    expect(screen.queryByText('Archivar')).not.toBeInTheDocument(); // readOnly
    expect(screen.getByText('Archivada')).toBeInTheDocument(); // badge
  });

  it('a legacy archived snapshot still opens with the read-only grid', () => {
    localStorage.setItem('acgen_regressions', JSON.stringify({
      archived: [{
        id: 'old-1', name: 'Regresión 2026-07-18', archivedAt: '2026-07-18',
        board: { ios: [['Smoke - https://z.example/p/1', 'v9', '', '', '', '']], webDesktop: [] },
      }],
    }));
    renderTracker();
    fireEvent.click(screen.getByText(/Archivadas \(1\)/));
    fireEvent.click(screen.getByText('Regresión 2026-07-18'));
    // El grid legacy readonly renderiza sus cabeceras hardcodeadas
    expect(screen.getByText('Notas')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Smoke - https://z.example/p/1')).toBeInTheDocument();
  });
});
