import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { TestDataTool } from './TestDataTool';
import { I18nProvider } from '../i18n/I18nContext';
import { streamWithGroq } from '../services/apiService';

vi.mock('../services/apiService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/apiService')>();
  return { ...actual, streamWithGroq: vi.fn() };
});

const streamMock = vi.mocked(streamWithGroq);

function sentInput(): string {
  return streamMock.mock.calls[0][2];
}
function sentMap(): Record<string, string> | undefined {
  return streamMock.mock.calls[0][6];
}

/** TestData sends a message assembled from the form; the free-text context rides along in it. */
function renderTool(additionalContext: string) {
  localStorage.setItem('acgen_lang', JSON.stringify('es'));
  render(
    <I18nProvider>
      <TestDataTool apiKey="test-key" model="test-model" />
    </I18nProvider>,
  );
  fireEvent.change(document.getElementById('td-context')!, { target: { value: additionalContext } });
}

const generate = () => fireEvent.click(screen.getByRole('button', { name: /generar/i }));

const SENSITIVE = 'Usar la cuenta de jorge@example.com para el ticket PROJ-1234';

describe('TestDataTool — confidential mode', () => {
  beforeEach(() => {
    streamMock.mockReset();
    streamMock.mockImplementation(async function* () {
      yield { token: '[]', done: false };
      yield { token: '', done: true };
    });
  });

  it('anonymizes the assembled message including the additional context', async () => {
    localStorage.setItem('acgen_confidential_testdata', 'true');
    renderTool(SENSITIVE);
    generate();

    expect(streamMock).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole('button', { name: /confirmar y enviar/i }));

    await waitFor(() => expect(streamMock).toHaveBeenCalledTimes(1));
    expect(sentInput()).not.toContain('jorge@example.com');
    expect(sentInput()).not.toContain('PROJ-1234');
    expect(sentInput()).toContain('[EMAIL_1]');
    expect(sentMap()).toMatchObject({ '[EMAIL_1]': 'jorge@example.com', '[TICKET_1]': 'PROJ-1234' });
    // The form-built instruction survives anonymization.
    expect(sentInput()).toContain('Tipo de dato:');
  });

  it('sends the raw assembled message when confidential mode is off', async () => {
    renderTool(SENSITIVE);
    generate();

    await waitFor(() => expect(streamMock).toHaveBeenCalledTimes(1));
    expect(sentInput()).toContain('jorge@example.com');
    expect(sentMap()).toBeUndefined();
  });
});
