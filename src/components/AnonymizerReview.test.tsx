import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { I18nProvider } from '../i18n/I18nContext';
import { AnonymizerReview } from './AnonymizerReview';

const MAP = { '[EMAIL_1]': 'a@x.com', '[EMAIL_2]': 'b@y.com' };

function renderReview() {
  const onConfirm = vi.fn();
  render(
    <I18nProvider>
      <AnonymizerReview map={MAP} onConfirm={onConfirm} onCancel={() => {}} />
    </I18nProvider>,
  );
  const inputs = screen.getAllByRole('textbox') as HTMLInputElement[];
  const confirm = () => screen.getByRole('button', { name: /confirmar y enviar/i });
  return { onConfirm, inputs, confirm };
}

describe('AnonymizerReview — validacion de renames', () => {
  beforeEach(() => { localStorage.setItem('acgen_lang', JSON.stringify('es')); });

  it('un rename sin forma [NOMBRE] marca la fila y bloquea Confirmar', () => {
    const { inputs, confirm, onConfirm } = renderReview();
    fireEvent.change(inputs[0], { target: { value: 'email' } });

    expect(inputs[0]).toHaveAttribute('aria-invalid', 'true');
    expect(confirm()).toBeDisabled();
    expect(screen.getByText(/\[NOMBRE\]/)).toBeInTheDocument();
    fireEvent.click(confirm());
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('un rename que repite otra clave marca ambas filas', () => {
    const { inputs, confirm } = renderReview();
    fireEvent.change(inputs[0], { target: { value: '[EMAIL_2]' } });

    expect(inputs[0]).toHaveAttribute('aria-invalid', 'true');
    expect(inputs[1]).toHaveAttribute('aria-invalid', 'true');
    expect(confirm()).toBeDisabled();
  });

  it('un rename valido pasa tal cual a onConfirm', () => {
    const { inputs, confirm, onConfirm } = renderReview();
    fireEvent.change(inputs[0], { target: { value: '[PERSONA]' } });

    expect(inputs[0]).toHaveAttribute('aria-invalid', 'false');
    expect(confirm()).toBeEnabled();
    fireEvent.click(confirm());
    expect(onConfirm).toHaveBeenCalledWith({ '[EMAIL_1]': '[PERSONA]' });
  });
});
