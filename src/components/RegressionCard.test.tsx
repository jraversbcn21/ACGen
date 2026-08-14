import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { I18nProvider } from '../i18n/I18nContext';
import { RegressionCard } from './RegressionCard';
import type { Regression } from '../hooks/useRegressions';
import { STORAGE_KEYS } from '../config/constants';
import { DEFAULT_SCHEMA } from '../types/schema';

function makeRegression(overrides: Partial<Regression> = {}): Regression {
  return {
    id: 'reg-1',
    version: '1.0.0',
    url: 'Excel Regresión - https://sheets.example.com/reg/1',
    fecha: '2026-08-10',
    tickets: [
      { id: 't1', ticket: '', fecha: '', prioridad: '', creador: '', squad: '', status: '' },
      { id: 't2', ticket: '', fecha: '', prioridad: '', creador: '', squad: '', status: '' },
      { id: 't3', ticket: '', fecha: '', prioridad: '', creador: '', squad: '', status: '' },
    ],
    ...overrides,
  };
}

function renderCard(props: Partial<React.ComponentProps<typeof RegressionCard>> = {}) {
  return render(
    <I18nProvider>
      <RegressionCard regression={makeRegression()} {...props} />
    </I18nProvider>
  );
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('acgen_lang', JSON.stringify('es'));
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('RegressionCard', () => {
  it('shows version, formatted date, excel link name and filled-ticket badge', () => {
    renderCard({
      regression: makeRegression({
        tickets: [
          { id: 't1', ticket: 'PROJ-1 - https://j.example/browse/PROJ-1', fecha: '', prioridad: '', creador: '', squad: '', status: '' },
          { id: 't2', ticket: '', fecha: '', prioridad: '', creador: '', squad: '', status: '' },
        ],
      }),
    });
    expect(screen.getByText('1.0.0')).toBeInTheDocument();
    expect(screen.getByText('10/08/2026')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /Excel Regresión/ });
    expect(link).toHaveAttribute('href', 'https://sheets.example.com/reg/1');
    expect(screen.getByText('1 tickets')).toBeInTheDocument();
  });

  it('starts collapsed and expands to show the ticket table with its headers and 3 rows', () => {
    renderCard();
    expect(screen.queryByText('Prioridad')).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Mostrar u ocultar tickets'));
    for (const h of ['Ticket', 'Prioridad', 'Creador', 'Squad']) {
      expect(screen.getByText(h)).toBeInTheDocument();
    }
    expect(document.querySelectorAll('tbody tr')).toHaveLength(3);
  });

  it('add ticket button calls onAddTicket; per-row × calls onDeleteTicket (confirm only when the row has content)', () => {
    const onAddTicket = vi.fn();
    const onDeleteTicket = vi.fn();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderCard({
      onAddTicket,
      onDeleteTicket,
      regression: makeRegression({
        tickets: [
          { id: 't1', ticket: '', fecha: '', prioridad: 'Alta', creador: '', squad: '', status: '' },
          { id: 't2', ticket: '', fecha: '', prioridad: '', creador: '', squad: '', status: '' },
        ],
      }),
    });
    fireEvent.click(screen.getByLabelText('Mostrar u ocultar tickets'));
    fireEvent.click(screen.getByText('+ Añadir ticket'));
    expect(onAddTicket).toHaveBeenCalledOnce();
    const deleteButtons = screen.getAllByLabelText('Eliminar');
    fireEvent.click(deleteButtons[1]); // fila vacía: sin confirm
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(onDeleteTicket).toHaveBeenCalledWith('t2');
    fireEvent.click(deleteButtons[0]); // fila con contenido: confirm
    expect(confirmSpy).toHaveBeenCalledOnce();
    expect(onDeleteTicket).toHaveBeenCalledWith('t1');
  });

  it('editing a ticket cell calls onUpdateTicket with field and value', () => {
    const onUpdateTicket = vi.fn();
    renderCard({ onUpdateTicket });
    fireEvent.click(screen.getByLabelText('Mostrar u ocultar tickets'));
    const firstRowInputs = document.querySelectorAll('tbody tr:first-child input');
    fireEvent.change(firstRowInputs[2], { target: { value: 'Alta' } });
    expect(onUpdateTicket).toHaveBeenCalledWith('t1', 'prioridad', 'Alta');
  });

  it('a "Nombre - URL" ticket cell shows the name overlay and ctrl+click opens the url', () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    renderCard({
      regression: makeRegression({
        tickets: [{ id: 't1', ticket: 'PROJ-9 - https://j.example/browse/PROJ-9', fecha: '', prioridad: '', creador: '', squad: '', status: '' }],
      }),
    });
    fireEvent.click(screen.getByLabelText('Mostrar u ocultar tickets'));
    expect(screen.getByText('PROJ-9')).toBeInTheDocument();
    fireEvent.click(screen.getByDisplayValue('PROJ-9 - https://j.example/browse/PROJ-9'), { ctrlKey: true });
    expect(open).toHaveBeenCalledWith('https://j.example/browse/PROJ-9', '_blank', 'noopener,noreferrer');
  });

  it('Editar swaps the header for inputs and Guardar sends the patch', () => {
    const onUpdateRegression = vi.fn();
    renderCard({ onUpdateRegression });
    fireEvent.click(screen.getByText('Editar'));
    fireEvent.change(screen.getByDisplayValue('1.0.0'), { target: { value: '1.0.1' } });
    fireEvent.click(screen.getByText('Guardar'));
    expect(onUpdateRegression).toHaveBeenCalledWith(
      expect.objectContaining({ version: '1.0.1', fecha: '2026-08-10' })
    );
  });

  it('Archivar and Eliminar delegate to their callbacks', () => {
    const onArchive = vi.fn();
    const onDelete = vi.fn();
    renderCard({ onArchive, onDelete });
    fireEvent.click(screen.getByText('Archivar'));
    expect(onArchive).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByText('Eliminar'));
    expect(onDelete).toHaveBeenCalledOnce();
  });

  it('readOnly + defaultExpanded: opens expanded, inputs readOnly, no mutation buttons', () => {
    renderCard({ readOnly: true, defaultExpanded: true });
    expect(screen.getByText('Prioridad')).toBeInTheDocument();
    expect(screen.queryByText('Editar')).not.toBeInTheDocument();
    expect(screen.queryByText('Archivar')).not.toBeInTheDocument();
    expect(screen.queryByText('Eliminar')).not.toBeInTheDocument();
    expect(screen.queryByText('+ Añadir ticket')).not.toBeInTheDocument();
    const input = document.querySelector('tbody input') as HTMLInputElement;
    expect(input.readOnly).toBe(true);
  });

  it('shows the Status column right after Squad', () => {
    renderCard();
    fireEvent.click(screen.getByLabelText('Mostrar u ocultar tickets'));
    const headers = Array.from(document.querySelectorAll('thead th')).map((th) => th.textContent);
    // Última columna de datos = Status; la celda extra final es la del botón ×
    expect(headers.slice(0, 6)).toEqual(['Ticket', 'Fecha', 'Prioridad', 'Creador', 'Squad', 'Status']);
    // Y es editable: la fila tiene 6 inputs de datos
    expect(document.querySelectorAll('tbody tr:first-child input')).toHaveLength(6);
  });

  it('columns are resizable by dragging the header handle and widths persist in localStorage', () => {
    renderCard();
    fireEvent.click(screen.getByLabelText('Mostrar u ocultar tickets'));
    const handles = document.querySelectorAll('[data-col-resize]');
    expect(handles).toHaveLength(6);
    const fechaHandle = document.querySelector('[data-col-resize="fecha"]') as HTMLElement;
    fireEvent.mouseDown(fechaHandle, { clientX: 200 });
    fireEvent.mouseMove(document, { clientX: 140 });
    fireEvent.mouseUp(document);
    const cols = document.querySelectorAll('colgroup col');
    // fecha es la 2ª columna; su ancho por defecto (110) - 60 = 50
    expect((cols[1] as HTMLElement).style.width).toBe('50px');
    const stored = JSON.parse(localStorage.getItem('acgen_regression_ticket_col_widths')!);
    expect(stored.fecha).toBe(50);
  });

  it('readOnly resize is ephemeral: dragging works but never writes the shared widths key', () => {
    renderCard({ readOnly: true, defaultExpanded: true });
    const handle = document.querySelector('[data-col-resize="fecha"]') as HTMLElement;
    fireEvent.mouseDown(handle, { clientX: 200 });
    fireEvent.mouseMove(document, { clientX: 260 });
    fireEvent.mouseUp(document);
    const cols = document.querySelectorAll('colgroup col');
    expect((cols[1] as HTMLElement).style.width).toBe('170px');
    expect(localStorage.getItem('acgen_regression_ticket_col_widths')).toBeNull();
  });

  it('forceExpanded shows the table without interaction and disables the chevron', () => {
    renderCard({ forceExpanded: true });
    expect(screen.getByText('Prioridad')).toBeInTheDocument();
    const chevron = screen.getByLabelText('Mostrar u ocultar tickets') as HTMLButtonElement;
    expect(chevron.disabled).toBe(true);
  });

  it('visibleTicketIds renders only those rows and hides the add-ticket button', () => {
    renderCard({
      forceExpanded: true,
      visibleTicketIds: ['t2'],
      regression: makeRegression({
        tickets: [
          { id: 't1', ticket: 'PROJ-1', fecha: '', prioridad: '', creador: '', squad: '', status: '' },
          { id: 't2', ticket: 'PROJ-2', fecha: '', prioridad: '', creador: '', squad: '', status: '' },
        ],
      }),
    });
    expect(document.querySelectorAll('tbody tr')).toHaveLength(1);
    expect(screen.getByDisplayValue('PROJ-2')).toBeInTheDocument();
    expect(screen.queryByText('+ Añadir ticket')).not.toBeInTheDocument();
  });

  it('renders the dragHandle node in the header when provided', () => {
    renderCard({ dragHandle: <span data-testid="handle">⠿</span> });
    expect(screen.getByTestId('handle')).toBeInTheDocument();
  });

  describe('highlightNeedle', () => {
    it('marks the matching substring in the version and in a plain ticket cell overlay', () => {
      renderCard({
        highlightNeedle: '1.0',
        forceExpanded: true,
        regression: makeRegression({
          tickets: [{ id: 't1', ticket: '', fecha: '', prioridad: 'P1.0', creador: '', squad: '', status: '' }],
        }),
      });
      const marks = [...document.querySelectorAll('mark')];
      expect(marks.length).toBeGreaterThanOrEqual(2); // versión "1.0.0" + celda "P1.0"
      expect(marks.every((m) => m.textContent === '1.0')).toBe(true);
    });

    it('tints the whole link name and shows the matchInUrl tooltip when the match is only in the hidden URL', () => {
      renderCard({
        highlightNeedle: '1475',
        forceExpanded: true,
        regression: makeRegression({
          tickets: [{ id: 't1', ticket: '[DESK] toast roto - https://jira.example.com/browse/BSKWEB-1475', fecha: '', prioridad: '', creador: '', squad: '', status: '' }],
        }),
      });
      const td = document.querySelector('td[title="Coincide en la URL del enlace"]');
      expect(td).not.toBeNull();
      expect(td!.textContent).toContain('[DESK] toast roto');
      expect(td!.querySelectorAll('mark')).toHaveLength(0); // nombre entero tintado, sin submarca
    });

    it('highlights the substring inside the link name when the visible name matches', () => {
      renderCard({
        highlightNeedle: 'toast',
        forceExpanded: true,
        regression: makeRegression({
          tickets: [{ id: 't1', ticket: '[DESK] toast roto - https://jira.example.com/browse/BSKWEB-1475', fecha: '', prioridad: '', creador: '', squad: '', status: '' }],
        }),
      });
      const overlayMark = [...document.querySelectorAll('tbody mark')].find((m) => m.textContent === 'toast');
      expect(overlayMark).toBeTruthy();
      expect(document.querySelector('td[title="Coincide en la URL del enlace"]')).toBeNull();
    });

    it('focusing a highlighted cell removes the overlay and blur restores it', () => {
      renderCard({
        highlightNeedle: 'P1',
        forceExpanded: true,
        regression: makeRegression({
          tickets: [{ id: 't1', ticket: '', fecha: '', prioridad: 'P1', creador: '', squad: '', status: '' }],
        }),
      });
      const input = screen.getByDisplayValue('P1') as HTMLInputElement;
      expect(document.querySelectorAll('tbody mark')).toHaveLength(1);
      fireEvent.focus(input);
      expect(document.querySelectorAll('tbody mark')).toHaveLength(0);
      fireEvent.blur(input);
      expect(document.querySelectorAll('tbody mark')).toHaveLength(1);
    });

    it('without highlightNeedle no <mark> is rendered', () => {
      renderCard({ forceExpanded: true });
      expect(document.querySelectorAll('mark')).toHaveLength(0);
    });

    it('tints the header excel link and shows the tooltip when the match is only in its URL', () => {
      renderCard({ highlightNeedle: 'sheets.example' });
      const link = screen.getByRole('link', { name: /Excel Regresión/ });
      expect(link).toHaveAttribute('title', 'Coincide en la URL del enlace');
    });
  });
});

describe('RegressionCard con esquema', () => {
  beforeEach(() => {
    // El beforeEach del fichero fuerza 'es' para las suites de arriba; estas
    // pruebas asumen el idioma por defecto de jsdom (navigator.language
    // 'en-US' => INGLES), asi que se retira el override justo para ellas.
    localStorage.removeItem('acgen_lang');
  });

  it('GUARDIAN: sin esquema guardado pinta las 6 cabeceras de hoy en orden', () => {
    renderCard({ defaultExpanded: true });
    const headers = screen.getAllByRole('columnheader').map((th) => th.textContent);
    // jsdom => navigator.language 'en-US' => la app renderiza en INGLES.
    expect(headers.slice(0, 6)).toEqual(['Ticket', 'Date', 'Priority', 'Creator', 'Squad', 'Status']);
  });

  it('renombrar un campo cambia el rotulo sin tocar el dato', () => {
    localStorage.setItem(STORAGE_KEYS.SCHEMA, JSON.stringify({
      version: 1,
      regression: {
        ...DEFAULT_SCHEMA.regression,
        ticketFields: DEFAULT_SCHEMA.regression.ticketFields.map((f) =>
          f.id === 'squad' ? { ...f, label: 'Equipo' } : f
        ),
      },
    }));
    renderCard({
      defaultExpanded: true,
      regression: makeRegression({
        tickets: [{ id: 't1', ticket: '', fecha: '', prioridad: '', creador: '', squad: 'Checkout', status: '' }],
      }),
    });
    const headers = screen.getAllByRole('columnheader').map((th) => th.textContent);
    expect(headers.slice(0, 6)).toEqual(['Ticket', 'Date', 'Priority', 'Creator', 'Equipo', 'Status']);
    expect(screen.getByDisplayValue('Checkout')).toBeTruthy();
  });

  it('un campo oculto desaparece de la tabla pero su valor sigue en el ticket', () => {
    localStorage.setItem(STORAGE_KEYS.SCHEMA, JSON.stringify({
      version: 1,
      regression: {
        ...DEFAULT_SCHEMA.regression,
        ticketFields: DEFAULT_SCHEMA.regression.ticketFields.map((f) =>
          f.id === 'squad' ? { ...f, hidden: true } : f
        ),
      },
    }));
    renderCard({
      defaultExpanded: true,
      regression: makeRegression({
        tickets: [{ id: 't1', ticket: '', fecha: '', prioridad: '', creador: '', squad: 'Checkout', status: '' }],
      }),
    });
    const headers = screen.getAllByRole('columnheader').map((th) => th.textContent);
    expect(headers.slice(0, 5)).toEqual(['Ticket', 'Date', 'Priority', 'Creator', 'Status']);
    expect(screen.queryByDisplayValue('Checkout')).toBeNull();
  });

  it('un campo anadido por el usuario se pinta y es editable', () => {
    const onUpdateTicket = vi.fn();
    localStorage.setItem(STORAGE_KEYS.SCHEMA, JSON.stringify({
      version: 1,
      regression: {
        ...DEFAULT_SCHEMA.regression,
        ticketFields: [...DEFAULT_SCHEMA.regression.ticketFields, { id: 'entorno', label: 'Entorno' }],
      },
    }));
    renderCard({
      defaultExpanded: true,
      onUpdateTicket,
      regression: makeRegression({
        tickets: [{ id: 't1', ticket: '', fecha: '', prioridad: '', creador: '', squad: '', status: '', entorno: 'Pro' }],
      }),
    });
    const headers = screen.getAllByRole('columnheader').map((th) => th.textContent);
    expect(headers.slice(0, 7)).toEqual(['Ticket', 'Date', 'Priority', 'Creator', 'Squad', 'Status', 'Entorno']);
    fireEvent.change(screen.getByDisplayValue('Pro'), { target: { value: 'UAT' } });
    expect(onUpdateTicket).toHaveBeenCalledWith('t1', 'entorno', 'UAT');
  });

  it('con el campo ticket oculto, el enlace se mueve a la primera columna visible', () => {
    localStorage.setItem(STORAGE_KEYS.SCHEMA, JSON.stringify({
      version: 1,
      regression: {
        ...DEFAULT_SCHEMA.regression,
        ticketFields: DEFAULT_SCHEMA.regression.ticketFields.map((f) =>
          f.id === 'ticket' ? { ...f, hidden: true } : f
        ),
      },
    }));
    renderCard({
      defaultExpanded: true,
      regression: makeRegression({
        tickets: [{
          id: 't1',
          ticket: 'PROJ-1 - https://j.example/browse/PROJ-1',
          fecha: 'PROJ-2 - https://j.example/browse/PROJ-2',
          prioridad: '', creador: '', squad: '', status: '',
        }],
      }),
    });
    // La columna Ticket esta oculta: su valor no se pinta en ningun sitio.
    expect(screen.queryByText('PROJ-1')).not.toBeInTheDocument();
    // Fecha, ahora la primera columna VISIBLE, se parsea como enlace "Nombre - URL"
    // en su lugar — antes del cambio del plan esto solo pasaba en el campo 'ticket'.
    const overlay = screen.getByText('PROJ-2');
    expect(overlay).toBeInTheDocument();
    const cell = overlay.closest('td')!;
    expect(cell).toHaveAttribute('title', 'Ctrl + Click to open the link');
  });

  it('el contador de tickets no cuenta contenido de campos ocultos', () => {
    localStorage.setItem(STORAGE_KEYS.SCHEMA, JSON.stringify({
      version: 1,
      regression: {
        ...DEFAULT_SCHEMA.regression,
        ticketFields: DEFAULT_SCHEMA.regression.ticketFields.map((f) =>
          f.id === 'squad' ? { ...f, hidden: true } : f
        ),
      },
    }));
    renderCard({
      regression: makeRegression({
        tickets: [{ id: 't1', ticket: '', fecha: '', prioridad: '', creador: '', squad: 'Checkout', status: '' }],
      }),
    });
    expect(screen.getByText(/^0 /)).toBeTruthy();
  });
});
