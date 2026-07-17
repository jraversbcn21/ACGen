import { render, screen, fireEvent } from '@testing-library/react';
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
    tabHeaders: { one: ['Ticket', 'Fecha'], two: ['Ticket', 'Motivo'] },
    tabGrid: { one: makeGrid(), two: makeGrid() },
    linkMode: 'jira',
    colWidthsStorageKey: 'test_grid_col_widths',
    searchPlaceholder: 'Buscar...',
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

  it('dragDisabled removes the drag handles', () => {
    renderGrid({ dragDisabled: true });
    const handle = document.querySelector('tbody td');
    expect(handle).toHaveAttribute('draggable', 'false');
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

  it('link cells get the accent styling', () => {
    renderUrlGrid('Smoke Login - https://zephyr.example.com/plan/9');
    const input = screen.getByDisplayValue('Smoke Login - https://zephyr.example.com/plan/9') as HTMLInputElement;
    expect(input.style.color).toBe('var(--accent)');
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
