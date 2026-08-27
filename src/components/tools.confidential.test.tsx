import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import type { ComponentType } from 'react';
import { I18nProvider } from '../i18n/I18nContext';
import { streamWithGroq } from '../services/apiService';
import { AcceptanceCriteriaTool } from './AcceptanceCriteriaTool';
import { UserStoryTool } from './UserStoryTool';
import { RefinerTool } from './RefinerTool';
import { EdgeCaseTool } from './EdgeCaseTool';
import { ConverterTool } from './ConverterTool';

vi.mock('../services/apiService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/apiService')>();
  return { ...actual, streamWithGroq: vi.fn() };
});

const streamMock = vi.mocked(streamWithGroq);

/**
 * These tools all share one shape: a main textarea whose content ends up in the
 * message sent to the LLM. Each must anonymize before sending, never after.
 */
const TOOLS: { name: string; Tool: ComponentType<{ apiKey: string; model: string }>; storageKey: string }[] = [
  { name: 'AcceptanceCriteriaTool', Tool: AcceptanceCriteriaTool, storageKey: 'acgen_confidential_acceptance' },
  { name: 'UserStoryTool', Tool: UserStoryTool, storageKey: 'acgen_confidential_userstory' },
  { name: 'RefinerTool', Tool: RefinerTool, storageKey: 'acgen_confidential_refiner' },
  { name: 'EdgeCaseTool', Tool: EdgeCaseTool, storageKey: 'acgen_confidential_edgecase' },
  { name: 'ConverterTool', Tool: ConverterTool, storageKey: 'acgen_confidential_converter' },
];

const SENSITIVE = 'Revisar PROJ-1234 y avisar a jorge@example.com';

function sentInput(): string {
  const input = streamMock.mock.calls[0][2];
  if (typeof input !== 'string') throw new Error('expected a string userInput');
  return input;
}
function sentMap(): Record<string, string> | undefined {
  return streamMock.mock.calls[0][6];
}

describe.each(TOOLS)('$name — confidential mode', ({ Tool, storageKey }) => {
  beforeEach(() => {
    localStorage.setItem('acgen_lang', JSON.stringify('es'));
    streamMock.mockReset();
    streamMock.mockImplementation(async function* () {
      yield { token: '[]', done: false };
      yield { token: '', done: true };
    });
  });

  function renderAndType(text: string) {
    render(
      <I18nProvider>
        <Tool apiKey="test-key" model="test-model" />
      </I18nProvider>,
    );
    // UserStoryTool arranca en modo guiado (tres campos); el texto sensible va
    // en la pestana Texto libre, que es su entrada principal equivalente.
    const freeTab = screen.queryByRole('tab', { name: /texto libre/i });
    if (freeTab) fireEvent.click(freeTab);
    // The first textbox is the tool's main input in every one of these tools.
    fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: text } });
  }

  it('never sends the raw sensitive input once the review is confirmed', async () => {
    localStorage.setItem(storageKey, 'true');
    renderAndType(SENSITIVE);
    fireEvent.click(screen.getByRole('button', { name: /generar/i }));

    expect(streamMock).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole('button', { name: /confirmar y enviar/i }));

    await waitFor(() => expect(streamMock).toHaveBeenCalledTimes(1));
    expect(sentInput()).not.toContain('jorge@example.com');
    expect(sentInput()).not.toContain('PROJ-1234');
    expect(sentInput()).toContain('[EMAIL_1]');
    expect(sentMap()).toMatchObject({ '[EMAIL_1]': 'jorge@example.com', '[TICKET_1]': 'PROJ-1234' });
  });

  it('sends the raw input when confidential mode is off', async () => {
    renderAndType(SENSITIVE);
    fireEvent.click(screen.getByRole('button', { name: /generar/i }));

    await waitFor(() => expect(streamMock).toHaveBeenCalledTimes(1));
    expect(sentInput()).toContain('jorge@example.com');
    expect(sentMap()).toBeUndefined();
  });

  it('sends nothing when the review is cancelled', async () => {
    localStorage.setItem(storageKey, 'true');
    renderAndType(SENSITIVE);
    fireEvent.click(screen.getByRole('button', { name: /generar/i }));

    fireEvent.click(await screen.findByRole('button', { name: /cancelar/i }));
    expect(streamMock).not.toHaveBeenCalled();
  });
});
