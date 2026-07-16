import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { I18nProvider } from '../i18n/I18nContext';
import { AcceptanceCriteriaTool } from './AcceptanceCriteriaTool';

describe('API errors render translated', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('acgen_lang', '"en"');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ error: { message: 'Invalid API Key' } }),
    }));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('shows the English error.apiKey text when the API returns 401', async () => {
    render(
      <I18nProvider>
        <AcceptanceCriteriaTool apiKey="bad-key" model="m" />
      </I18nProvider>
    );
    fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: 'some requirement' } });
    fireEvent.click(screen.getByRole('button', { name: /generate/i }));
    await waitFor(() => {
      expect(screen.getByText('Invalid API key. Verify your key and try again.')).toBeInTheDocument();
    });
  });
});
