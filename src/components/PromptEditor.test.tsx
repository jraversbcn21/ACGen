import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { I18nProvider } from '../i18n/I18nContext';
import { PromptEditor } from './PromptEditor';

describe('PromptEditor', () => {
  beforeEach(() => { localStorage.clear(); });

  it('se traduce entero: titulo, variables y botones no se quedan en español con la UI en ingles', () => {
    localStorage.setItem('acgen_lang', JSON.stringify('en'));
    render(<I18nProvider><PromptEditor onClose={vi.fn()} /></I18nProvider>);
    expect(screen.getByRole('heading', { name: 'Prompt editor' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reset to defaults' })).toBeInTheDocument();
    expect(screen.queryByText(/Restaurar por defecto|Editor de Prompts/)).not.toBeInTheDocument();
  });
});
