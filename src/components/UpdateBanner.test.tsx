import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { I18nProvider } from '../i18n/I18nContext';
import { UpdateBanner } from './UpdateBanner';

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('acgen_lang', JSON.stringify('es'));
});

function renderBanner(visible: boolean, onReload = vi.fn()) {
  return { onReload, ...render(
    <I18nProvider>
      <UpdateBanner visible={visible} onReload={onReload} />
    </I18nProvider>
  ) };
}

describe('UpdateBanner', () => {
  it('renders nothing when not visible', () => {
    renderBanner(false);
    expect(screen.queryByText(/nueva versión/i)).not.toBeInTheDocument();
  });

  it('shows the update message and an Actualizar button when visible', () => {
    renderBanner(true);
    expect(screen.getByText(/nueva versión/i)).toBeInTheDocument();
    expect(screen.getByText('Actualizar')).toBeInTheDocument();
  });

  it('calls onReload when the Actualizar button is clicked', () => {
    const { onReload } = renderBanner(true);
    fireEvent.click(screen.getByText('Actualizar'));
    expect(onReload).toHaveBeenCalledTimes(1);
  });
});
