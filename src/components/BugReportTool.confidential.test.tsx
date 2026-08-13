import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { BugReportTool } from './BugReportTool';
import { I18nProvider } from '../i18n/I18nContext';
import { streamWithGroq } from '../services/apiService';

vi.mock('../services/apiService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/apiService')>();
  return { ...actual, streamWithGroq: vi.fn() };
});

const streamMock = vi.mocked(streamWithGroq);

function sentInput(): string {
  const input = streamMock.mock.calls[0][2];
  if (typeof input !== 'string') throw new Error('expected a string userInput');
  return input;
}
function sentMap(): Record<string, string> | undefined {
  return streamMock.mock.calls[0][6];
}

/**
 * BugReport does not send the raw textarea: it assembles a composite message from
 * the whole form. Anonymization must cover that assembled message, URL field included.
 */
function renderTool({ description, url }: { description: string; url?: string }) {
  localStorage.setItem('acgen_lang', JSON.stringify('es'));
  render(
    <I18nProvider>
      <BugReportTool apiKey="test-key" model="test-model" />
    </I18nProvider>,
  );
  fireEvent.change(document.getElementById('br-description')!, { target: { value: description } });
  if (url !== undefined) {
    fireEvent.change(document.getElementById('br-url')!, { target: { value: url } });
  }
}

const generate = () => fireEvent.click(screen.getByRole('button', { name: /generar/i }));

describe('BugReportTool — confidential mode', () => {
  beforeEach(() => {
    streamMock.mockReset();
    streamMock.mockImplementation(async function* () {
      yield { token: 'reporte generado', done: false };
      yield { token: '', done: true };
    });
  });

  it('anonymizes the whole assembled message, not just the description', async () => {
    localStorage.setItem('acgen_confidential_bugreport', 'true');
    renderTool({
      description: 'Error al pagar, avisar a jorge@example.com',
      url: 'https://tienda.example.com/checkout',
    });
    generate();

    expect(streamMock).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole('button', { name: /confirmar y enviar/i }));

    await waitFor(() => expect(streamMock).toHaveBeenCalledTimes(1));
    // Both the description email and the URL field must be gone from the payload.
    expect(sentInput()).not.toContain('jorge@example.com');
    expect(sentInput()).not.toContain('tienda.example.com');
    expect(sentInput()).toContain('[EMAIL_1]');
    expect(sentMap()).toMatchObject({ '[EMAIL_1]': 'jorge@example.com' });
    // The message structure survives anonymization.
    expect(sentInput()).toContain('Descripcion del bug:');
    expect(sentInput()).toContain('Plataforma:');
  });

  it('sends the raw assembled message when confidential mode is off', async () => {
    renderTool({ description: 'Error al pagar, avisar a jorge@example.com' });
    generate();

    await waitFor(() => expect(streamMock).toHaveBeenCalledTimes(1));
    expect(sentInput()).toContain('jorge@example.com');
    expect(sentMap()).toBeUndefined();
  });
});
