import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { I18nProvider } from '../i18n/I18nContext';
import { HistoryModal } from './HistoryModal';
import type { HistoryEntry } from '../types';

const entries: HistoryEntry[] = [
  { id: '1', timestamp: 1700000000000, inputPreview: 'algo', output: 'salida' },
];

function renderModal(props: Partial<Parameters<typeof HistoryModal>[0]> = {}, lang: 'es' | 'en' = 'es') {
  localStorage.setItem('acgen_lang', JSON.stringify(lang));
  return render(
    <I18nProvider>
      <HistoryModal entries={entries} onLoad={() => {}} onClearAll={() => {}} onClose={() => {}} {...props} />
    </I18nProvider>
  );
}

describe('HistoryModal', () => {
  afterEach(() => localStorage.clear());

  it('clear-all requires a second confirming click', () => {
    const onClearAll = vi.fn();
    renderModal({ onClearAll });
    fireEvent.click(screen.getByRole('button', { name: 'Borrar todo' }));
    expect(onClearAll).not.toHaveBeenCalled();
    const confirmBtn = screen.getByRole('button', { name: '¿Confirmar borrado?' });
    fireEvent.click(confirmBtn);
    expect(onClearAll).toHaveBeenCalledTimes(1);
  });

  it('renders in English', () => {
    renderModal({}, 'en');
    expect(screen.getByText('History')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear all' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Load' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });

  it('shows the translated empty state', () => {
    localStorage.setItem('acgen_lang', '"en"');
    render(
      <I18nProvider>
        <HistoryModal entries={[]} onLoad={() => {}} onClearAll={() => {}} onClose={() => {}} />
      </I18nProvider>
    );
    expect(screen.getByText('No history entries yet.')).toBeInTheDocument();
  });
});
