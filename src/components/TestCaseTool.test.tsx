import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { I18nProvider } from '../i18n/I18nContext';
import { TestCaseTool } from './TestCaseTool';

describe('TestCaseTool — pasos', () => {
  it('no duplica la numeracion: los pasos van en <ol> y el modelo (y la demo) a veces ya los numeran', () => {
    localStorage.setItem('acgen_lang', JSON.stringify('es'));
    render(<I18nProvider><TestCaseTool apiKey="k" model="m" /></I18nProvider>);
    fireEvent.click(screen.getByRole('button', { name: /ejemplo/i }));
    const steps = [...document.querySelectorAll('ol li')].map((li) => li.textContent ?? '');
    expect(steps.length).toBeGreaterThan(0);
    expect(steps.every((s) => !/^\d+[.)]\s/.test(s))).toBe(true);
  });
});
