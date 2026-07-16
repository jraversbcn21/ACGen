import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { I18nProvider } from '../i18n/I18nContext';
import { AcceptanceCriteriaTool } from './AcceptanceCriteriaTool';
import { BugReportTool } from './BugReportTool';

vi.mock('../services/apiService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/apiService')>();
  return { ...actual, streamWithGroq: vi.fn() };
});

/**
 * The read-aloud feature is optional, but its teardown was not guarded: where
 * the Speech Synthesis API is missing the tool took the whole view down with it.
 * jsdom has no speechSynthesis, so simply not stubbing it reproduces that browser.
 */
const TOOLS = [
  { name: 'AcceptanceCriteriaTool', Tool: AcceptanceCriteriaTool },
  { name: 'BugReportTool', Tool: BugReportTool },
];

describe.each(TOOLS)('$name — without the Speech Synthesis API', ({ Tool }) => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    localStorage.setItem('acgen_lang', JSON.stringify('es'));
    expect(window.speechSynthesis).toBeUndefined(); // guard the premise of this suite
  });

  it('mounts and unmounts without crashing', () => {
    const { unmount } = render(
      <I18nProvider>
        <Tool apiKey="test-key" model="test-model" />
      </I18nProvider>,
    );
    expect(() => unmount()).not.toThrow();
  });
});

describe('AcceptanceCriteriaTool — without the Speech Synthesis API', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    localStorage.setItem('acgen_lang', JSON.stringify('es'));
  });

  it('clears the form without crashing', () => {
    render(
      <I18nProvider>
        <AcceptanceCriteriaTool apiKey="test-key" model="test-model" />
      </I18nProvider>,
    );
    fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: 'un requisito' } });

    // handleClear stops any speech first — that must not take the tool down.
    expect(() => fireEvent.click(screen.getByRole('button', { name: /limpiar/i }))).not.toThrow();
    expect(screen.getByText('Campos limpiados')).toBeInTheDocument();
  });
});
