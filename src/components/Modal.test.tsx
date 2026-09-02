import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Modal } from './Modal';

/**
 * Los cinco modales de la app eran divs copiados: sin role, sin Escape, sin
 * foco, y lo que se tecleaba dentro llegaba a los atajos de window del tool
 * de fondo (Ctrl+Enter generaba desde el editor de perfil).
 */
describe('Modal', () => {
  it('es un dialogo accesible: role, aria-modal, etiqueta y foco al abrir', () => {
    render(<Modal label="Perfil" onClose={vi.fn()}><input aria-label="campo" /></Modal>);
    const dialog = screen.getByRole('dialog', { name: 'Perfil' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveFocus();
  });

  it('Escape cierra', () => {
    const onClose = vi.fn();
    render(<Modal label="x" onClose={onClose}><input aria-label="campo" /></Modal>);
    fireEvent.keyDown(screen.getByLabelText('campo'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('lo que se teclea dentro no llega a los atajos de window (Ctrl+Enter de los tools, Ctrl+K de la portada)', () => {
    const onWindowKey = vi.fn();
    window.addEventListener('keydown', onWindowKey);
    render(<Modal label="x" onClose={vi.fn()}><input aria-label="campo" /></Modal>);
    fireEvent.keyDown(screen.getByLabelText('campo'), { key: 'Enter', ctrlKey: true });
    window.removeEventListener('keydown', onWindowKey);
    expect(onWindowKey).not.toHaveBeenCalled();
  });

  it('clic en el fondo cierra; clic dentro, no', () => {
    const onClose = vi.fn();
    render(<Modal label="x" onClose={onClose}><button type="button">dentro</button></Modal>);
    fireEvent.click(screen.getByText('dentro'));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(document.querySelector('.modal-overlay')!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
