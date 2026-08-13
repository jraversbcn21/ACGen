import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { TestCaseTool } from './TestCaseTool';
import { I18nProvider } from '../i18n/I18nContext';
import { streamWithGroq } from '../services/apiService';

vi.mock('../services/apiService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/apiService')>();
  return { ...actual, streamWithGroq: vi.fn() };
});

const streamMock = vi.mocked(streamWithGroq);

const DEMO_CASE = {
  key: 'TC-1',
  summary: 'Caso',
  priority: 'Alta',
  type: 'Positivo',
  preconditions: 'Ninguna',
  testSteps: ['Paso 1'],
  expectedResult: 'OK',
};

/** userInput is the 3rd arg of streamWithGroq, anonymizeMap the 7th. */
function sentInput(): string {
  const input = streamMock.mock.calls[0][2];
  if (typeof input !== 'string') throw new Error('expected a string userInput');
  return input;
}
function sentMap(): Record<string, string> | undefined {
  return streamMock.mock.calls[0][6];
}

function renderTool(input: string) {
  localStorage.setItem('acgen_lang', JSON.stringify('es')); // pin the UI language so the selectors are stable
  render(
    <I18nProvider>
      <TestCaseTool apiKey="test-key" model="test-model" />
    </I18nProvider>,
  );
  fireEvent.change(screen.getByRole('textbox'), { target: { value: input } });
}

const generate = () => fireEvent.click(screen.getByRole('button', { name: /generar/i }));

const SENSITIVE = 'Login para jorge@example.com sobre PROJ-1234';

describe('TestCaseTool — confidential mode', () => {
  beforeEach(() => {
    streamMock.mockReset();
    streamMock.mockImplementation(async function* () {
      yield { token: JSON.stringify([DEMO_CASE]), done: false };
      yield { token: '', done: true };
    });
  });

  it('sends anonymized text — never the raw sensitive input — after confirming the review', async () => {
    localStorage.setItem('acgen_confidential_testcase', 'true');
    renderTool(SENSITIVE);
    generate();

    // The review modal must gate the call.
    expect(streamMock).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole('button', { name: /confirmar y enviar/i }));

    await waitFor(() => expect(streamMock).toHaveBeenCalledTimes(1));
    expect(sentInput()).not.toContain('jorge@example.com');
    expect(sentInput()).not.toContain('PROJ-1234');
    expect(sentInput()).toContain('[EMAIL_1]');
    expect(sentInput()).toContain('[TICKET_1]');
    expect(sentMap()).toMatchObject({ '[EMAIL_1]': 'jorge@example.com', '[TICKET_1]': 'PROJ-1234' });
  });

  it('sends the renamed placeholder when the user edits a replacement', async () => {
    localStorage.setItem('acgen_confidential_testcase', 'true');
    renderTool('Avisar a jorge@example.com');
    generate();

    const replacementField = await screen.findByDisplayValue('[EMAIL_1]');
    fireEvent.change(replacementField, { target: { value: '[CORREO]' } });
    fireEvent.click(screen.getByRole('button', { name: /confirmar y enviar/i }));

    await waitFor(() => expect(streamMock).toHaveBeenCalledTimes(1));
    expect(sentInput()).toBe('Avisar a [CORREO]');
    expect(sentMap()).toEqual({ '[CORREO]': 'jorge@example.com' });
  });

  it('sends raw text with no map when confidential mode is off', async () => {
    renderTool(SENSITIVE);
    generate();

    await waitFor(() => expect(streamMock).toHaveBeenCalledTimes(1));
    expect(sentInput()).toBe(SENSITIVE);
    expect(sentMap()).toBeUndefined();
  });

  it('skips the review modal and sends directly when nothing sensitive is detected', async () => {
    localStorage.setItem('acgen_confidential_testcase', 'true');
    renderTool('Validar el formulario de registro');
    generate();

    await waitFor(() => expect(streamMock).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('button', { name: /confirmar y enviar/i })).not.toBeInTheDocument();
    expect(sentInput()).toBe('Validar el formulario de registro');
  });

  it('sends nothing when the review is cancelled', async () => {
    localStorage.setItem('acgen_confidential_testcase', 'true');
    renderTool(SENSITIVE);
    generate();

    fireEvent.click(await screen.findByRole('button', { name: /cancelar/i }));
    expect(streamMock).not.toHaveBeenCalled();
  });
});
