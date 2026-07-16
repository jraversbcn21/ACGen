import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConfidentialToggle } from './ConfidentialToggle';
import { I18nProvider } from '../i18n/I18nContext';

function renderToggle(text: string, onReview = vi.fn()) {
  render(
    <I18nProvider>
      <ConfidentialToggle view="testcase" text={text} onReview={onReview} />
    </I18nProvider>,
  );
  return onReview;
}

const SENSITIVE = 'Avisar a jorge@example.com sobre PROJ-1234';

describe('ConfidentialToggle', () => {
  beforeEach(() => {
    localStorage.setItem('acgen_lang', JSON.stringify('es'));
  });

  it('shows how many substitutions the current text would produce', () => {
    localStorage.setItem('acgen_confidential_testcase', 'true');
    renderToggle(SENSITIVE);

    expect(screen.getByRole('button', { name: /2 .*revisar/i })).toBeInTheDocument();
  });

  it('recounts as the text changes', () => {
    localStorage.setItem('acgen_confidential_testcase', 'true');
    const { rerender } = render(
      <I18nProvider>
        <ConfidentialToggle view="testcase" text={SENSITIVE} onReview={vi.fn()} />
      </I18nProvider>,
    );
    expect(screen.getByRole('button', { name: /2 .*revisar/i })).toBeInTheDocument();

    rerender(
      <I18nProvider>
        <ConfidentialToggle view="testcase" text="Avisar a jorge@example.com" onReview={vi.fn()} />
      </I18nProvider>,
    );
    expect(screen.getByRole('button', { name: /1 .*revisar/i })).toBeInTheDocument();
  });

  it('opens the review when the badge is clicked', () => {
    localStorage.setItem('acgen_confidential_testcase', 'true');
    const onReview = renderToggle(SENSITIVE);

    fireEvent.click(screen.getByRole('button', { name: /revisar/i }));
    expect(onReview).toHaveBeenCalledTimes(1);
  });

  it('hides the badge while confidential mode is off', () => {
    renderToggle(SENSITIVE);
    expect(screen.queryByRole('button', { name: /revisar/i })).not.toBeInTheDocument();
  });

  it('hides the badge when the text holds nothing sensitive', () => {
    localStorage.setItem('acgen_confidential_testcase', 'true');
    renderToggle('Validar el formulario de registro');
    expect(screen.queryByRole('button', { name: /revisar/i })).not.toBeInTheDocument();
  });

  it('starts counting as soon as the checkbox is ticked', () => {
    renderToggle(SENSITIVE);
    expect(screen.queryByRole('button', { name: /revisar/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('checkbox'));
    expect(screen.getByRole('button', { name: /2 .*revisar/i })).toBeInTheDocument();
  });
});
