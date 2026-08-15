import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { I18nProvider } from '../i18n/I18nContext';
import { TrackerGrid } from './TrackerGrid';
import type { TrackerGridProps } from './TrackerGrid';

type Tab = 'one' | 'two';

function makeGrid(rows = 3, cols = 6): string[][] {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => ''));
}

function renderGrid(overrides: Partial<TrackerGridProps<Tab>> = {}) {
  const props: TrackerGridProps<Tab> = {
    tabs: ['one', 'two'],
    tabLabels: { one: 'Uno', two: 'Dos' },
    tabColumns: {
      one: [{ label: 'Ticket', dataIndex: 0 }, { label: 'Fecha', dataIndex: 1 }],
      two: [{ label: 'Ticket', dataIndex: 0 }, { label: 'Motivo', dataIndex: 1 }],
    },
    tabGrid: { one: makeGrid(), two: makeGrid() },
    linkMode: 'jira',
    colWidthsStorageKey: 'test_grid_col_widths',
    searchPlaceholder: 'buscar',
    onUpdateGridCell: vi.fn(),
    onSetTabGrid: vi.fn(),
    onMoveRow: vi.fn(),
    ...overrides,
  };
  render(
    <I18nProvider>
      <TrackerGrid {...props} />
    </I18nProvider>
  );
  return props;
}

beforeEach(() => {
  localStorage.clear();
  // Fija el idioma: jsdom arranca con navigator.language en-US y los textos asertados son en español
  localStorage.setItem('acgen_lang', JSON.stringify('es'));
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('TrackerGrid — jira mode (extracted Sprint Tracker behavior)', () => {
  it('renders tab labels and the active tab headers', () => {
    renderGrid();
    expect(screen.getByText('Uno')).toBeInTheDocument();
    expect(screen.getByText('Dos')).toBeInTheDocument();
    expect(screen.getByText('Fecha')).toBeInTheDocument();
  });

  it('switching tab shows that tab headers', () => {
    renderGrid();
    fireEvent.click(screen.getByText('Dos'));
    expect(screen.getByText('Motivo')).toBeInTheDocument();
    expect(screen.queryByText('Fecha')).not.toBeInTheDocument();
  });

  it('ctrl+click on a ticket cell opens baseUrl/browse/KEY', () => {
    localStorage.setItem('acgen_tracker_base_url', JSON.stringify('https://jira.example.com'));
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    const grid = makeGrid();
    grid[0][0] = 'ABC-123 Login roto';
    renderGrid({ tabGrid: { one: grid, two: makeGrid() } });
    fireEvent.click(screen.getByDisplayValue('ABC-123 Login roto'), { ctrlKey: true });
    expect(open).toHaveBeenCalledWith('https://jira.example.com/browse/ABC-123', '_blank', 'noopener,noreferrer');
  });

  it('pasting a SnapLink transforms it to "KEY Nombre"', () => {
    const props = renderGrid();
    const inputs = document.querySelectorAll('tbody input');
    fireEvent.paste(inputs[0], {
      clipboardData: { getData: () => 'Mi ticket - https://jira.example.com/browse/ABC-999' },
    });
    expect(props.onUpdateGridCell).toHaveBeenCalledWith('one', 0, 0, 'ABC-999 Mi ticket');
  });

  it('"+ Fila" appends an empty row via onSetTabGrid', () => {
    const props = renderGrid();
    fireEvent.click(screen.getByText('+ Fila'));
    expect(props.onSetTabGrid).toHaveBeenCalledTimes(1);
    const [tab, newGrid] = (props.onSetTabGrid as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(tab).toBe('one');
    expect(newGrid).toHaveLength(4);
    expect(newGrid[3]).toEqual(['', '', '', '', '', '']);
  });

  it('jira cells keep showing the full value (no name overlay)', () => {
    localStorage.setItem('acgen_tracker_base_url', JSON.stringify('https://jira.example.com'));
    const grid = makeGrid();
    grid[0][0] = 'ABC-123 Login roto';
    renderGrid({ tabGrid: { one: grid, two: makeGrid() } });
    const input = screen.getByDisplayValue('ABC-123 Login roto') as HTMLInputElement;
    expect(input.style.color).toBe('var(--accent)');
    expect(input.closest('td')!.querySelector('span')).toBeNull();
  });

  it('sin URL base, la celda de ticket no es enlace ni abre nada con ctrl+click', () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    const grid = makeGrid();
    grid[0][0] = 'ABC-123 Login roto';
    renderGrid({ tabGrid: { one: grid, two: makeGrid() } });
    const input = screen.getByDisplayValue('ABC-123 Login roto') as HTMLInputElement;
    fireEvent.click(input, { ctrlKey: true });
    expect(open).not.toHaveBeenCalled();
    expect(input.style.color).toBe('var(--text)');
  });

  it('sin URL base, la celda de ticket muestra el hint de configuración en el title', () => {
    const grid = makeGrid();
    grid[0][0] = 'ABC-123 Login roto';
    renderGrid({ tabGrid: { one: grid, two: makeGrid() } });
    const td = screen.getByDisplayValue('ABC-123 Login roto').closest('td')!;
    expect(td).toHaveAttribute('title', 'Configura la URL del tracker (⚙) para abrir tickets');
  });

  it('dragDisabled removes the drag handles', () => {
    renderGrid({ dragDisabled: true });
    const handle = document.querySelector('tbody td');
    expect(handle).toHaveAttribute('draggable', 'false');
  });
});

describe('TrackerGrid — hover ↗ icon opens links directly', () => {
  it('jira mode, base URL configured: the icon has aria-label "Abrir ABC-123" and a plain click opens the ticket URL', () => {
    localStorage.setItem('acgen_tracker_base_url', JSON.stringify('https://jira.example.com'));
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    const grid = makeGrid();
    grid[0][0] = 'ABC-123 Login roto';
    renderGrid({ tabGrid: { one: grid, two: makeGrid() } });
    const button = screen.getByLabelText('Abrir ABC-123');
    fireEvent.click(button);
    expect(open).toHaveBeenCalledWith('https://jira.example.com/browse/ABC-123', '_blank', 'noopener,noreferrer');
  });

  it('jira mode, no base URL configured: no icon button is rendered for the ticket cell', () => {
    const grid = makeGrid();
    grid[0][0] = 'ABC-123 Login roto';
    renderGrid({ tabGrid: { one: grid, two: makeGrid() } });
    expect(screen.queryByLabelText('Abrir ABC-123')).not.toBeInTheDocument();
  });

  it('jira mode, base URL configured, empty cell: no icon button in that cell', () => {
    localStorage.setItem('acgen_tracker_base_url', JSON.stringify('https://jira.example.com'));
    renderGrid();
    const firstDataCell = document.querySelectorAll('tbody tr')[0].querySelectorAll('td')[1];
    expect(firstDataCell.querySelector('button.cell-open-link')).toBeNull();
  });

  it('url mode: the icon has aria-label "Abrir el enlace" and a plain click opens the exact URL', () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    const grid = makeGrid();
    grid[0][0] = 'Smoke Login - https://zephyr.example.com/plan/9';
    renderGrid({ linkMode: 'url', tabGrid: { one: grid, two: makeGrid() } });
    const button = screen.getByLabelText('Abrir el enlace');
    fireEvent.click(button);
    expect(open).toHaveBeenCalledWith('https://zephyr.example.com/plan/9', '_blank', 'noopener,noreferrer');
  });

  it('ctrl+click on the icon opens exactly one tab (no double-open via the td handler)', () => {
    localStorage.setItem('acgen_tracker_base_url', JSON.stringify('https://jira.example.com'));
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    const grid = makeGrid();
    grid[0][0] = 'ABC-123 Login roto';
    renderGrid({ tabGrid: { one: grid, two: makeGrid() } });
    const button = screen.getByLabelText('Abrir ABC-123');
    fireEvent.click(button, { ctrlKey: true });
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('the td title for a linked jira cell teaches the ctrl+click gesture', () => {
    localStorage.setItem('acgen_tracker_base_url', JSON.stringify('https://jira.example.com'));
    const grid = makeGrid();
    grid[0][0] = 'ABC-123 Login roto';
    renderGrid({ tabGrid: { one: grid, two: makeGrid() } });
    const td = screen.getByDisplayValue('ABC-123 Login roto').closest('td')!;
    expect(td).toHaveAttribute('title', 'Ctrl + Click para abrir ABC-123');
  });
});

describe('TrackerGrid — url mode', () => {
  function renderUrlGrid(cell0: string, overrides: Partial<TrackerGridProps<Tab>> = {}) {
    const grid = makeGrid();
    grid[0][0] = cell0;
    return renderGrid({ linkMode: 'url', tabGrid: { one: grid, two: makeGrid() }, ...overrides });
  }

  it('ctrl+click on "Nombre - URL" opens the exact URL', () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    renderUrlGrid('Smoke Login - https://zephyr.example.com/plan/9');
    fireEvent.click(screen.getByDisplayValue('Smoke Login - https://zephyr.example.com/plan/9'), { ctrlKey: true });
    expect(open).toHaveBeenCalledWith('https://zephyr.example.com/plan/9', '_blank', 'noopener,noreferrer');
  });

  it('a bare URL is also a link', () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    renderUrlGrid('https://zephyr.example.com/plan/9');
    fireEvent.click(screen.getByDisplayValue('https://zephyr.example.com/plan/9'), { ctrlKey: true });
    expect(open).toHaveBeenCalledWith('https://zephyr.example.com/plan/9', '_blank', 'noopener,noreferrer');
  });

  it('plain text is not a link', () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    renderUrlGrid('Smoke Login sin enlace');
    fireEvent.click(screen.getByDisplayValue('Smoke Login sin enlace'), { ctrlKey: true });
    expect(open).not.toHaveBeenCalled();
  });

  it('link cells get the accent styling on the name overlay', () => {
    renderUrlGrid('Smoke Login - https://zephyr.example.com/plan/9');
    const overlay = screen.getByText('Smoke Login');
    expect((overlay as HTMLElement).style.color).toBe('var(--accent)');
  });

  it('shows only the name over a "Nombre - URL" cell at rest', () => {
    renderUrlGrid('WEB 3.1.0+1.xlsx - https://sharepoint.example.com/Doc.aspx?sourcedoc=x&file=y');
    const input = screen.getByDisplayValue('WEB 3.1.0+1.xlsx - https://sharepoint.example.com/Doc.aspx?sourcedoc=x&file=y') as HTMLInputElement;
    const overlay = screen.getByText('WEB 3.1.0+1.xlsx');
    expect(overlay.tagName).toBe('SPAN');
    expect(input.style.color).toBe('transparent');
  });

  it('focusing the cell reveals the full value for editing, blur hides it again', () => {
    renderUrlGrid('Smoke - https://zephyr.example.com/plan/9');
    const input = screen.getByDisplayValue('Smoke - https://zephyr.example.com/plan/9') as HTMLInputElement;
    fireEvent.focus(input);
    expect(screen.queryByText('Smoke')).not.toBeInTheDocument();
    expect(input.style.color).toBe('var(--accent)');
    fireEvent.blur(input);
    expect(screen.getByText('Smoke')).toBeInTheDocument();
    expect(input.style.color).toBe('transparent');
  });

  it('a bare URL keeps showing the full URL (no overlay)', () => {
    renderUrlGrid('https://zephyr.example.com/plan/9');
    const input = screen.getByDisplayValue('https://zephyr.example.com/plan/9') as HTMLInputElement;
    expect(input.style.color).toBe('var(--accent)');
    expect(input.closest('td')!.querySelector('span')).toBeNull();
  });
});

describe('TrackerGrid — readOnly', () => {
  it('inputs are readOnly, no "+ Fila", no drag handles', () => {
    renderGrid({ readOnly: true });
    const input = document.querySelector('tbody input') as HTMLInputElement;
    expect(input).toHaveAttribute('readonly');
    expect(screen.queryByText('+ Fila')).not.toBeInTheDocument();
    const handle = document.querySelector('tbody td');
    expect(handle).toHaveAttribute('draggable', 'false');
  });
});

describe('TrackerGrid — drag and drop', () => {
  it('row handles are draggable by default', () => {
    renderGrid();
    const handle = document.querySelector('tbody td');
    expect(handle).toHaveAttribute('draggable', 'true');
  });

  it('dropping a dragged row on another row calls onMoveRow with source and target', () => {
    const props = renderGrid();
    const rows = document.querySelectorAll('tbody tr');
    const sourceHandle = rows[0].querySelector('td')!;
    fireEvent.dragStart(sourceHandle, { dataTransfer: { effectAllowed: '', setData: vi.fn() } });
    fireEvent.dragOver(rows[2], { dataTransfer: { dropEffect: '' } });
    fireEvent.drop(rows[2]);
    expect(props.onMoveRow).toHaveBeenCalledWith('one', 0, 2);
  });

  it('dropping a row on itself does not call onMoveRow', () => {
    const props = renderGrid();
    const rows = document.querySelectorAll('tbody tr');
    const sourceHandle = rows[1].querySelector('td')!;
    fireEvent.dragStart(sourceHandle, { dataTransfer: { effectAllowed: '', setData: vi.fn() } });
    fireEvent.dragOver(rows[1], { dataTransfer: { dropEffect: '' } });
    fireEvent.drop(rows[1]);
    expect(props.onMoveRow).not.toHaveBeenCalled();
  });
});

describe('TrackerGrid — column resize persistence', () => {
  function resizeFirstColumn(deltaX: number) {
    const handle = document.querySelector('thead tr:first-child th:nth-child(2) div') as HTMLElement;
    fireEvent.mouseDown(handle, { clientX: 100 });
    fireEvent.mouseMove(document, { clientX: 100 + deltaX });
    fireEvent.mouseUp(document);
  }

  it('persists resized widths to localStorage in editable mode', () => {
    renderGrid();
    resizeFirstColumn(50);
    const stored = JSON.parse(localStorage.getItem('test_grid_col_widths')!);
    expect(stored['one-0']).toBe(170);
  });

  it('readOnly resize works in memory but never touches the shared widths key', () => {
    renderGrid({ readOnly: true });
    resizeFirstColumn(50);
    const col = document.querySelectorAll('colgroup col')[1] as HTMLElement;
    expect(col.style.width).toBe('170px');
    expect(localStorage.getItem('test_grid_col_widths')).toBeNull();
  });
});

describe('TrackerGrid — migración de la clave antigua acgen_jira_base_url', () => {
  it('migra la URL huérfana al montar en modo jira y los enlaces funcionan', () => {
    localStorage.setItem('acgen_jira_base_url', JSON.stringify('https://jira.legacy.com'));
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    const grid = makeGrid();
    grid[0][0] = 'ABC-123 Login roto';
    renderGrid({ tabGrid: { one: grid, two: makeGrid() } });
    expect(JSON.parse(localStorage.getItem('acgen_tracker_base_url')!)).toBe('https://jira.legacy.com');
    expect(localStorage.getItem('acgen_jira_base_url')).toBe(JSON.stringify('https://jira.legacy.com'));
    fireEvent.click(screen.getByDisplayValue('ABC-123 Login roto'), { ctrlKey: true });
    expect(open).toHaveBeenCalledWith('https://jira.legacy.com/browse/ABC-123', '_blank', 'noopener,noreferrer');
  });

  it('no sobrescribe una URL base ya configurada en la clave nueva', () => {
    localStorage.setItem('acgen_tracker_base_url', JSON.stringify('https://jira.nueva.com'));
    localStorage.setItem('acgen_jira_base_url', JSON.stringify('https://jira.legacy.com'));
    renderGrid();
    expect(JSON.parse(localStorage.getItem('acgen_tracker_base_url')!)).toBe('https://jira.nueva.com');
  });

  it('en modo url no migra nada', () => {
    localStorage.setItem('acgen_jira_base_url', JSON.stringify('https://jira.legacy.com'));
    renderGrid({ linkMode: 'url' });
    expect(localStorage.getItem('acgen_tracker_base_url')).toBeNull();
  });

  it('una URL relativa heredada por migración no genera enlace', () => {
    localStorage.setItem('acgen_jira_base_url', JSON.stringify('jira.sin-esquema.com'));
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    const grid = makeGrid();
    grid[0][0] = 'ABC-123 Login roto';
    renderGrid({ tabGrid: { one: grid, two: makeGrid() } });
    const input = screen.getByDisplayValue('ABC-123 Login roto') as HTMLInputElement;
    fireEvent.click(input, { ctrlKey: true });
    expect(open).not.toHaveBeenCalled();
    expect(input.style.color).toBe('var(--text)');
  });
});

describe('TrackerGrid — configuración de URL base (⚙)', () => {
  it('el botón ⚙ no aparece en modo url', () => {
    renderGrid({ linkMode: 'url' });
    expect(screen.queryByTitle('Configurar URL del tracker')).not.toBeInTheDocument();
  });

  it('⚙ abre el input y Enter guarda normalizando la barra final', () => {
    renderGrid();
    fireEvent.click(screen.getByTitle('Configurar URL del tracker'));
    const input = screen.getByPlaceholderText('https://jira.example.com');
    fireEvent.change(input, { target: { value: 'https://jira.miempresa.com/' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(JSON.parse(localStorage.getItem('acgen_tracker_base_url')!)).toBe('https://jira.miempresa.com');
    expect(screen.queryByPlaceholderText('https://jira.example.com')).not.toBeInTheDocument();
  });

  it('guardar la URL activa los enlaces de ticket al momento', () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    const grid = makeGrid();
    grid[0][0] = 'ABC-123 Login roto';
    renderGrid({ tabGrid: { one: grid, two: makeGrid() } });
    fireEvent.click(screen.getByTitle('Configurar URL del tracker'));
    const input = screen.getByPlaceholderText('https://jira.example.com');
    fireEvent.change(input, { target: { value: 'https://jira.miempresa.com' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.click(screen.getByDisplayValue('ABC-123 Login roto'), { ctrlKey: true });
    expect(open).toHaveBeenCalledWith('https://jira.miempresa.com/browse/ABC-123', '_blank', 'noopener,noreferrer');
  });

  it('blur con el input montado guarda el borrador', () => {
    renderGrid();
    fireEvent.click(screen.getByTitle('Configurar URL del tracker'));
    const input = screen.getByPlaceholderText('https://jira.example.com');
    fireEvent.change(input, { target: { value: 'https://jira.blur.com/' } });
    fireEvent.blur(input);
    expect(JSON.parse(localStorage.getItem('acgen_tracker_base_url')!)).toBe('https://jira.blur.com');
    expect(screen.queryByPlaceholderText('https://jira.example.com')).not.toBeInTheDocument();
  });

  it('tras Escape y reabrir, un blur posterior vuelve a guardar', () => {
    renderGrid();
    const gear = screen.getByTitle('Configurar URL del tracker');
    fireEvent.click(gear);
    fireEvent.keyDown(screen.getByPlaceholderText('https://jira.example.com'), { key: 'Escape' });
    fireEvent.click(gear);
    const reopened = screen.getByPlaceholderText('https://jira.example.com');
    fireEvent.change(reopened, { target: { value: 'https://jira.segunda.com' } });
    fireEvent.blur(reopened);
    expect(JSON.parse(localStorage.getItem('acgen_tracker_base_url')!)).toBe('https://jira.segunda.com');
  });

  it('el ⚙ cierra el panel en la secuencia real del navegador (mousedown, blur, click)', () => {
    localStorage.setItem('acgen_tracker_base_url', JSON.stringify('https://jira.previa.com'));
    renderGrid();
    const gear = screen.getByTitle('Configurar URL del tracker');
    fireEvent.click(gear);
    const input = screen.getByPlaceholderText('https://jira.example.com');
    fireEvent.mouseDown(gear);
    fireEvent.blur(input);
    fireEvent.click(gear);
    expect(screen.queryByPlaceholderText('https://jira.example.com')).not.toBeInTheDocument();
  });

  it('guardar un borrador vacío no escribe en storage', () => {
    renderGrid();
    fireEvent.click(screen.getByTitle('Configurar URL del tracker'));
    const input = screen.getByPlaceholderText('https://jira.example.com');
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.blur(input);
    expect(localStorage.getItem('acgen_tracker_base_url')).toBeNull();
    expect(screen.queryByPlaceholderText('https://jira.example.com')).not.toBeInTheDocument();
  });

  it('una URL sin esquema se guarda con https:// y abre un enlace absoluto', () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    const grid = makeGrid();
    grid[0][0] = 'ABC-123 Login roto';
    renderGrid({ tabGrid: { one: grid, two: makeGrid() } });
    fireEvent.click(screen.getByTitle('Configurar URL del tracker'));
    const input = screen.getByPlaceholderText('https://jira.example.com');
    fireEvent.change(input, { target: { value: 'jira.miempresa.com' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(JSON.parse(localStorage.getItem('acgen_tracker_base_url')!)).toBe('https://jira.miempresa.com');
    fireEvent.click(screen.getByDisplayValue('ABC-123 Login roto'), { ctrlKey: true });
    expect(open).toHaveBeenCalledWith('https://jira.miempresa.com/browse/ABC-123', '_blank', 'noopener,noreferrer');
    expect(open.mock.calls[0][0]).toMatch(/^https?:\/\//);
  });
});

describe('TrackerGrid — tabColumns por indice de datos (columnas ocultas)', () => {
  it('ocultar una columna intermedia mantiene el ancho ligado a su columna de datos', () => {
    // El llamante omite dataIndex 1: quedan las columnas de datos 0 y 2.
    localStorage.setItem('test_grid_col_widths', JSON.stringify({ 'one-2': 300 }));
    renderGrid({
      tabColumns: { one: [{ label: 'A', dataIndex: 0 }, { label: 'C', dataIndex: 2 }], two: [] },
      tabGrid: { one: [['a', 'b', 'c']], two: [] },
    });
    const cols = document.querySelectorAll('colgroup col');
    // cols[0] es la columna del numero de fila (44px fija).
    expect((cols[2] as HTMLElement).style.width).toBe('300px');
  });

  it('las letras de columna van por indice de datos, no por posicion visual', () => {
    renderGrid({
      tabColumns: { one: [{ label: 'A', dataIndex: 0 }, { label: 'C', dataIndex: 2 }], two: [] },
      tabGrid: { one: [['a', 'b', 'c']], two: [] },
    });
    const letters = Array.from(document.querySelectorAll('thead tr:first-child th'))
      .slice(1).map((th) => th.textContent);
    expect(letters).toEqual(['A', 'C']);
  });

  it('la flecha derecha salta la columna oculta', () => {
    renderGrid({
      tabColumns: { one: [{ label: 'A', dataIndex: 0 }, { label: 'C', dataIndex: 2 }], two: [] },
      tabGrid: { one: [['a', 'b', 'c']], two: [] },
    });
    const first = document.querySelector('input[data-row="0"][data-col="0"]') as HTMLInputElement;
    act(() => { first.focus(); });
    first.setSelectionRange(first.value.length, first.value.length);
    fireEvent.keyDown(first, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(document.querySelector('input[data-row="0"][data-col="2"]'));
  });

  it('las columnas de datos sin cabecera se siguen pintando', () => {
    // La trampa de la fase: 3 cabeceras sobre 6 columnas de datos (el caso JSD).
    renderGrid({
      tabColumns: { one: [{ label: 'A', dataIndex: 0 }, { label: 'B', dataIndex: 1 }, { label: 'C', dataIndex: 2 }], two: [] },
      tabGrid: { one: [['a', 'b', 'c', 'd', 'e', 'f']], two: [] },
    });
    expect(document.querySelectorAll('tbody input').length).toBe(6);
    expect((document.querySelector('input[data-col="5"]') as HTMLInputElement).value).toBe('f');
  });

  it('la busqueda sigue encontrando por columnas ocultas', async () => {
    // Decision de producto de Jorge (2026-08-15): ocultar es una preferencia de
    // vista, no un borrado, asi que la busqueda sigue mirando la fila entera.
    // A proposito DISTINTO del Regression Tracker, donde la Fase 4 dejo de
    // buscar por campos ocultos. Este test existe para que nadie lo "arregle".
    renderGrid({
      tabColumns: { one: [{ label: 'A', dataIndex: 0 }], two: [] },
      tabGrid: { one: [['visible', 'oculto'], ['otra', 'fila']], two: [] },
    });
    fireEvent.change(screen.getByPlaceholderText('buscar'), { target: { value: 'oculto' } });
    await waitFor(() => expect(document.querySelectorAll('tbody tr').length).toBe(1));
    // La fila sale, aunque la celda que casa no este a la vista.
    expect(screen.getByDisplayValue('visible')).toBeInTheDocument();
  });
});
