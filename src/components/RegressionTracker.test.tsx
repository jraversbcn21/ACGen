import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { I18nProvider } from '../i18n/I18nContext';
import { RegressionTracker } from './RegressionTracker';
import { STORAGE_KEYS } from '../config/constants';
import { DEFAULT_SCHEMA } from '../types/schema';

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

  it('expanding a card and editing a ticket cell round-trips through the real hook to localStorage', () => {
    renderTracker();
    createRegression('1.0.0');
    fireEvent.click(screen.getByLabelText('Mostrar u ocultar tickets'));
    const firstRowInputs = document.querySelectorAll('tbody tr:first-child input');
    fireEvent.change(firstRowInputs[0], { target: { value: 'PROJ-42' } });

    const stored = JSON.parse(localStorage.getItem('acgen_regressions')!);
    expect(stored.regressions.ios[0].tickets[0].ticket).toBe('PROJ-42');
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

  describe('search', () => {
    it('filters by version leaving matching cards collapsed and shows the N / M counter', () => {
      renderTracker();
      createRegression('1.0.0');
      createRegression('2.0.0');
      fireEvent.change(screen.getByPlaceholderText(/Buscar por versión/), { target: { value: '2.0' } });
      const matches = screen.queryAllByText((_, element) => element?.textContent?.includes('2.0.0') ?? false);
      expect(matches.length).toBeGreaterThan(0);
      expect(screen.queryByText('1.0.0')).not.toBeInTheDocument();
      expect(screen.getByText('1 / 2')).toBeInTheDocument();
      expect(screen.queryByText('Prioridad')).not.toBeInTheDocument(); // match por cabecera: colapsada
    });

    it('a ticket match auto-expands the card showing only matching rows (case-insensitive)', () => {
      renderTracker();
      createRegression('1.0.0');
      fireEvent.click(screen.getByLabelText('Mostrar u ocultar tickets'));
      const firstRowInputs = document.querySelectorAll('tbody tr:first-child input');
      fireEvent.change(firstRowInputs[0], { target: { value: 'PROJ-42' } });
      fireEvent.change(screen.getByPlaceholderText(/Buscar por versión/), { target: { value: 'proj-42' } });
      expect(screen.getByText('Prioridad')).toBeInTheDocument(); // auto-expandida
      expect(document.querySelectorAll('tbody tr')).toHaveLength(1); // solo la fila coincidente
      expect(screen.getByDisplayValue('PROJ-42')).toBeInTheDocument();
    });

    it('shows the no-matches message and clears the search with the × button', () => {
      renderTracker();
      createRegression('1.0.0');
      fireEvent.change(screen.getByPlaceholderText(/Buscar por versión/), { target: { value: 'zzz' } });
      expect(screen.getByText('Sin coincidencias.')).toBeInTheDocument();
      expect(screen.queryByText('1.0.0')).not.toBeInTheDocument();
      fireEvent.click(screen.getByLabelText('Limpiar búsqueda'));
      expect(screen.getByText('1.0.0')).toBeInTheDocument();
    });

    it('keeps the query when switching tabs', () => {
      renderTracker();
      createRegression('1.0.0');
      fireEvent.change(screen.getByPlaceholderText(/Buscar por versión/), { target: { value: '1.0' } });
      fireEvent.click(screen.getByText('WEB'));
      expect((screen.getByPlaceholderText(/Buscar por versión/) as HTMLInputElement).value).toBe('1.0');
    });

    it('search results render highlighted matches inside the cards', () => {
      renderTracker();
      createRegression('1.0.0');
      fireEvent.change(screen.getByPlaceholderText(/Buscar por versión/), { target: { value: '1.0' } });
      const marks = document.querySelectorAll('mark');
      expect(marks.length).toBeGreaterThan(0);
      expect(marks[0].textContent).toBe('1.0');
    });

    it('the search input is twice as wide (440px)', () => {
      renderTracker();
      const input = screen.getByPlaceholderText(/Buscar por versión/) as HTMLInputElement;
      expect(input.style.width).toBe('440px');
    });
  });

  describe('drag & drop reorder', () => {
    // jsdom devuelve rects de tamaño 0, así que clientY negativo = mitad
    // superior y positivo = mitad inferior respecto a rect.top + height/2 = 0.
    it('dragging a card by its handle onto the top half of the first card moves it to the top', () => {
      renderTracker();
      createRegression('1.0.0');
      createRegression('2.0.0');
      createRegression('3.0.0');
      // orden actual (las nuevas entran arriba): 3.0.0, 2.0.0, 1.0.0
      const handles = screen.getAllByLabelText('Arrastrar para reordenar');
      fireEvent.dragStart(handles[2]); // 1.0.0
      const first = document.querySelector('[data-drag-index="0"]')!;
      fireEvent.dragOver(first, { clientY: -5 });
      fireEvent.drop(first);
      const stored = JSON.parse(localStorage.getItem('acgen_regressions')!);
      expect(stored.regressions.ios.map((r: { version: string }) => r.version)).toEqual(['1.0.0', '3.0.0', '2.0.0']);
    });

    it('dropping on the bottom half of the last card moves it to the bottom', () => {
      renderTracker();
      createRegression('1.0.0');
      createRegression('2.0.0');
      createRegression('3.0.0');
      const handles = screen.getAllByLabelText('Arrastrar para reordenar');
      fireEvent.dragStart(handles[0]); // 3.0.0
      const last = document.querySelector('[data-drag-index="2"]')!;
      fireEvent.dragOver(last, { clientY: 5 });
      fireEvent.drop(last);
      const stored = JSON.parse(localStorage.getItem('acgen_regressions')!);
      expect(stored.regressions.ios.map((r: { version: string }) => r.version)).toEqual(['2.0.0', '1.0.0', '3.0.0']);
    });

    it('dropping a card on its own position leaves the stored order unchanged', () => {
      renderTracker();
      createRegression('1.0.0');
      createRegression('2.0.0');
      const before = localStorage.getItem('acgen_regressions');
      const handles = screen.getAllByLabelText('Arrastrar para reordenar');
      fireEvent.dragStart(handles[0]);
      const self = document.querySelector('[data-drag-index="0"]')!;
      fireEvent.dragOver(self, { clientY: -5 });
      fireEvent.drop(self);
      expect(localStorage.getItem('acgen_regressions')).toBe(before);
    });

    it('handles disappear while a search is active', () => {
      renderTracker();
      createRegression('1.0.0');
      expect(screen.getByLabelText('Arrastrar para reordenar')).toBeInTheDocument();
      fireEvent.change(screen.getByPlaceholderText(/Buscar por versión/), { target: { value: '1.0' } });
      expect(screen.queryByLabelText('Arrastrar para reordenar')).not.toBeInTheDocument();
    });
  });
});

describe('RegressionTracker con esquema', () => {
  it('GUARDIAN: sin esquema guardado pinta las dos pestanas de hoy', () => {
    renderTracker();
    expect(screen.getByRole('button', { name: 'APPS' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'WEB' })).toBeTruthy();
  });

  it('renombrar una plataforma cambia la pestana sin mover los datos', () => {
    localStorage.setItem('acgen_regressions', JSON.stringify({
      regressions: { ios: [{ id: 'r1', version: '1.2.3', url: '', fecha: '2026-08-10', tickets: [] }], webDesktop: [] },
      archived: [],
    }));
    localStorage.setItem(STORAGE_KEYS.SCHEMA, JSON.stringify({
      version: 1,
      regression: {
        ...DEFAULT_SCHEMA.regression,
        platforms: [{ id: 'ios', label: 'Moviles' }, { id: 'webDesktop', label: 'WEB' }],
      },
    }));
    renderTracker();
    expect(screen.getByRole('button', { name: 'Moviles' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'APPS' })).toBeNull();
    expect(screen.getByText('1.2.3')).toBeTruthy();
  });

  it('ocultar la plataforma activa reencamina a la primera visible', () => {
    localStorage.setItem(STORAGE_KEYS.SCHEMA, JSON.stringify({
      version: 1,
      regression: {
        ...DEFAULT_SCHEMA.regression,
        platforms: [{ id: 'ios', label: 'APPS', hidden: true }, { id: 'webDesktop', label: 'WEB' }],
      },
    }));
    renderTracker();
    expect(screen.queryByRole('button', { name: 'APPS' })).toBeNull();
    expect(screen.getByRole('button', { name: 'WEB' })).toBeTruthy();
  });

  it('la busqueda no encuentra por campos ocultos', () => {
    localStorage.setItem('acgen_regressions', JSON.stringify({
      regressions: {
        ios: [{ id: 'r1', version: '1.0.0', url: '', fecha: '2026-08-10', tickets: [
          { id: 't1', ticket: '', fecha: '', prioridad: '', creador: '', squad: 'Checkout', status: '' },
        ] }],
        webDesktop: [],
      },
      archived: [],
    }));
    localStorage.setItem(STORAGE_KEYS.SCHEMA, JSON.stringify({
      version: 1,
      regression: {
        ...DEFAULT_SCHEMA.regression,
        ticketFields: DEFAULT_SCHEMA.regression.ticketFields.map((f) =>
          f.id === 'squad' ? { ...f, hidden: true } : f
        ),
      },
    }));
    renderTracker();
    const search = screen.getByLabelText(/Buscar por versión/);
    fireEvent.change(search, { target: { value: 'Checkout' } });
    expect(screen.getByText('Sin coincidencias.')).toBeTruthy();
  });
});
