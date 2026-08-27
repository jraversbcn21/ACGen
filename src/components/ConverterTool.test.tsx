import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { I18nProvider } from '../i18n/I18nContext';
import { streamWithGroq } from '../services/apiService';
import { ConverterTool } from './ConverterTool';

vi.mock('../services/apiService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/apiService')>();
  return { ...actual, streamWithGroq: vi.fn() };
});

const streamMock = vi.mocked(streamWithGroq);

const selects = () => screen.getAllByRole('combobox') as HTMLSelectElement[];
const textareas = () => screen.getAllByRole('textbox') as HTMLTextAreaElement[];

/**
 * Intercambiar formatos no solo permuta los dos selects: si ya hay resultado, lo
 * mueve a la entrada y vacia el panel derecho, que es el gesto util real
 * (convertir de vuelta, o seguir encadenando desde lo generado).
 */
describe('ConverterTool — intercambiar formatos', () => {
  beforeEach(() => {
    localStorage.setItem('acgen_lang', JSON.stringify('es'));
    streamMock.mockReset();
  });

  function renderTool() {
    render(
      <I18nProvider>
        <ConverterTool apiKey="test-key" model="test-model" />
      </I18nProvider>,
    );
  }

  it('permuta origen y destino sin tocar el texto cuando no hay resultado', () => {
    renderTool();
    const [source, target] = selects();
    expect([source.value, target.value]).toEqual(['text', 'markdown']);

    fireEvent.change(textareas()[0], { target: { value: 'algo sin convertir' } });
    fireEvent.click(screen.getByRole('button', { name: /intercambiar formatos/i }));

    expect([source.value, target.value]).toEqual(['markdown', 'text']);
    expect(textareas()[0]).toHaveValue('algo sin convertir');
  });

  it('mueve el resultado a la entrada y vacia el panel al intercambiar', async () => {
    streamMock.mockImplementation(async function* () {
      yield { token: '# Convertido', done: false };
      yield { token: '', done: true };
    });
    renderTool();

    fireEvent.change(textareas()[0], { target: { value: 'texto origen' } });
    fireEvent.click(screen.getByRole('button', { name: /generar/i }));
    await waitFor(() => expect(textareas()[1]).toHaveValue('# Convertido'));

    fireEvent.click(screen.getByRole('button', { name: /intercambiar formatos/i }));

    expect(textareas()[0]).toHaveValue('# Convertido');
    expect(textareas()[1]).toHaveValue('');
  });

  it('copiar y descargar estan deshabilitados mientras no hay resultado', () => {
    renderTool();
    expect(screen.getByRole('button', { name: /copiar/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /descargar/i })).toBeDisabled();
  });
});
