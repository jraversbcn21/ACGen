import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { I18nProvider } from '../i18n/I18nContext';
import { DesignValidatorTool } from './DesignValidatorTool';
import { streamWithGroq } from '../services/apiService';
import { fileToProcessedDataUrl } from '../utils/image';

vi.mock('../services/apiService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/apiService')>();
  return { ...actual, streamWithGroq: vi.fn() };
});
vi.mock('../utils/image', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../utils/image')>();
  return { ...actual, fileToProcessedDataUrl: vi.fn() };
});

const streamMock = vi.mocked(streamWithGroq);
const processMock = vi.mocked(fileToProcessedDataUrl);

const REPORT = JSON.stringify({
  carencias: [{ flujo: 'Login social', descripcion: 'Sin criterio para el botón de Google' }],
  contradicciones: [{ criterio: 'El CTA dice Comprar', evidenciaDiseno: 'El botón visible dice "Continuar"', descripcion: 'Texto de CTA distinto' }],
  sugerencias: [{ titulo: 'Login con Google', dado: 'un usuario sin sesión', cuando: 'pulsa Continuar con Google', entonces: 'se abre el flujo OAuth' }],
});

function renderTool(props: Partial<Parameters<typeof DesignValidatorTool>[0]> = {}) {
  const onSwitch = vi.fn();
  render(
    <I18nProvider>
      <DesignValidatorTool apiKey="k" model="google/gemini-2.5-flash" provider="openrouter" onSwitchToVisionModel={onSwitch} {...props} />
    </I18nProvider>,
  );
  return { onSwitch };
}

async function attachImage() {
  const file = new File(['x'], 'diseno.png', { type: 'image/png' });
  fireEvent.change(screen.getByLabelText(/adjuntar imagen/i), { target: { files: [file] } });
  await screen.findByText('diseno.png');
}

describe('DesignValidatorTool', () => {
  beforeEach(() => {
    localStorage.setItem('acgen_lang', JSON.stringify('es'));
    streamMock.mockReset();
    processMock.mockReset();
    processMock.mockResolvedValue('data:image/jpeg;base64,IMGDATA');
    streamMock.mockImplementation(async function* () {
      yield { token: REPORT, done: false };
      yield { token: '', done: true };
    });
  });

  it('genera y renderiza las tres secciones del informe', async () => {
    const onSave = vi.fn();
    renderTool({ onSaveArtifact: onSave });
    fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: 'Dado un usuario...' } });
    await attachImage();
    fireEvent.click(screen.getByRole('button', { name: /generar/i }));
    expect(await screen.findByText('Login social')).toBeInTheDocument();
    expect(screen.getByText(/El botón visible dice/)).toBeInTheDocument();
    expect(screen.getByText('Login con Google')).toBeInTheDocument();
    expect(onSave).toHaveBeenCalled();
  });

  it('Ctrl+Enter con todo listo dispara la generación', async () => {
    renderTool();
    fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: 'criterios' } });
    await attachImage();
    fireEvent.keyDown(window, { key: 'Enter', ctrlKey: true });
    await waitFor(() => expect(streamMock).toHaveBeenCalledTimes(1));
  });

  it('envía ContentPart[] con el texto y la imagen', async () => {
    renderTool();
    fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: 'criterios' } });
    await attachImage();
    fireEvent.click(screen.getByRole('button', { name: /generar/i }));
    await waitFor(() => expect(streamMock).toHaveBeenCalledTimes(1));
    const input = streamMock.mock.calls[0][2];
    expect(Array.isArray(input)).toBe(true);
    const parts = input as { type: string }[];
    expect(parts[0].type).toBe('text');
    expect(parts[1]).toEqual({ type: 'image_url', image_url: { url: 'data:image/jpeg;base64,IMGDATA' } });
  });

  it('sin imagen no se puede generar', () => {
    renderTool();
    fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: 'criterios' } });
    expect(screen.getByRole('button', { name: /generar/i })).toBeDisabled();
  });

  it('con modelo sin visión muestra aviso, deshabilita generar y ofrece el cambio', async () => {
    const { onSwitch } = renderTool({ provider: 'groq', model: 'openai/gpt-oss-120b' });
    fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: 'criterios' } });
    await attachImage();
    expect(screen.getByRole('button', { name: /generar/i })).toBeDisabled();
    expect(screen.getByText(/no soporta imágenes/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /gemini/i }));
    expect(onSwitch).toHaveBeenCalled();
  });

  it('con proveedor custom muestra el aviso de capacidad no verificable pero permite generar', async () => {
    renderTool({ provider: 'custom', model: 'mi-modelo', baseUrl: 'https://mi.endpoint/v1/chat' });
    fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: 'criterios' } });
    await attachImage();
    expect(screen.getByText(/no podemos verificar/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /generar/i })).toBeEnabled();
  });

  it('muestra la nota de privacidad (la imagen viaja al proveedor)', () => {
    renderTool();
    expect(screen.getByText(/anonimizador solo procesa texto/i)).toBeInTheDocument();
  });

  it('Limpiar y Deshacer restauran también la imagen adjunta', async () => {
    renderTool();
    fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: 'criterios' } });
    await attachImage();
    fireEvent.click(screen.getByRole('button', { name: /limpiar/i }));
    expect(screen.queryByText('diseno.png')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /deshacer/i }));
    expect(await screen.findByText('diseno.png')).toBeInTheDocument();
  });

  it('sin API key con proveedor de visión e imagen adjunta muestra el aviso de key ausente y deshabilita generar', async () => {
    renderTool({ apiKey: '' });
    fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: 'criterios' } });
    await attachImage();
    expect(screen.getByText(/falta la api key/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /generar/i })).toBeDisabled();
  });

  it('el base64 de la imagen jamás toca localStorage', async () => {
    const onSave = vi.fn((input: string) => localStorage.setItem('acgen_test_artifact', JSON.stringify(input)));
    renderTool({ onSaveArtifact: onSave });
    fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: 'criterios' } });
    await attachImage();
    fireEvent.click(screen.getByRole('button', { name: /generar/i }));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(onSave.mock.calls[0][0]).toContain('diseno.png');
    expect(onSave.mock.calls[0][0]).not.toContain('IMGDATA');
    for (let i = 0; i < localStorage.length; i++) {
      const value = localStorage.getItem(localStorage.key(i)!) ?? '';
      expect(value).not.toContain('data:image');
    }
  });

  it('un informe con formato inválido muestra el error i18n', async () => {
    streamMock.mockImplementation(async function* () {
      yield { token: '{"carencias": "no soy un array"}', done: false };
      yield { token: '', done: true };
    });
    renderTool();
    fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: 'criterios' } });
    await attachImage();
    fireEvent.click(screen.getByRole('button', { name: /generar/i }));
    expect(await screen.findByText(/formato de informe esperado/i)).toBeInTheDocument();
  });
});
