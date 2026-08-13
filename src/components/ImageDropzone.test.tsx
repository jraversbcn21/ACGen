import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ImageDropzone } from './ImageDropzone';
import { I18nProvider } from '../i18n/I18nContext';
import { fileToProcessedDataUrl } from '../utils/image';

vi.mock('../utils/image', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../utils/image')>();
  return { ...actual, fileToProcessedDataUrl: vi.fn() };
});

const processMock = vi.mocked(fileToProcessedDataUrl);

function renderZone(props: Partial<Parameters<typeof ImageDropzone>[0]> = {}) {
  const onImage = vi.fn();
  const onRemove = vi.fn();
  render(
    <I18nProvider>
      <ImageDropzone imageName={null} onImage={onImage} onRemove={onRemove} {...props} />
    </I18nProvider>,
  );
  return { onImage, onRemove };
}

describe('ImageDropzone', () => {
  beforeEach(() => {
    localStorage.setItem('acgen_lang', JSON.stringify('es'));
    processMock.mockReset();
    processMock.mockResolvedValue('data:image/jpeg;base64,PROCESSED');
  });

  it('procesa un fichero seleccionado y emite onImage con dataUrl y nombre', async () => {
    const { onImage } = renderZone();
    const file = new File(['x'], 'diseno.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText(/adjuntar imagen/i), { target: { files: [file] } });
    await waitFor(() => expect(onImage).toHaveBeenCalledWith('data:image/jpeg;base64,PROCESSED', 'diseno.png'));
  });

  it('muestra el error i18n si el procesado falla', async () => {
    processMock.mockRejectedValue(new Error('error.imageTooLarge'));
    renderZone();
    const file = new File(['x'], 'grande.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText(/adjuntar imagen/i), { target: { files: [file] } });
    expect(await screen.findByText(/4\s?MB/i)).toBeInTheDocument();
  });

  it('con imagen cargada muestra el nombre y permite quitarla', () => {
    const { onRemove } = renderZone({ imageName: 'diseno.png' });
    expect(screen.getByText('diseno.png')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /quitar imagen/i }));
    expect(onRemove).toHaveBeenCalled();
  });

  it('acepta una imagen pegada desde el portapapeles en cualquier punto de la página (paste global)', async () => {
    const { onImage } = renderZone();
    const file = new File(['x'], 'pegada.png', { type: 'image/png' });
    fireEvent.paste(document.body, {
      clipboardData: { files: [file], items: [{ kind: 'file', type: 'image/png', getAsFile: () => file }] },
    });
    await waitFor(() => expect(onImage).toHaveBeenCalled());
  });

  it('un pegado de solo texto (sin imagen en el portapapeles) no llama a onImage', async () => {
    const { onImage } = renderZone();
    fireEvent.paste(document.body, {
      clipboardData: { files: [], items: [{ kind: 'string', type: 'text/plain', getAsFile: () => null }] },
    });
    await new Promise((r) => setTimeout(r, 0));
    expect(onImage).not.toHaveBeenCalled();
  });

  it('deshabilitado no procesa nada', () => {
    const { onImage } = renderZone({ disabled: true });
    expect(screen.getByLabelText(/adjuntar imagen/i)).toBeDisabled();
    expect(onImage).not.toHaveBeenCalled();
  });
});
