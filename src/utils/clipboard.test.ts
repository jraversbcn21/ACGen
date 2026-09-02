import { describe, it, expect, vi, afterEach } from 'vitest';
import { copyText } from './clipboard';

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('copyText', () => {
  it('usa navigator.clipboard cuando existe', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    await copyText('hola');
    expect(writeText).toHaveBeenCalledWith('hola');
  });

  it('cae a execCommand si el portapapeles falla o no existe (origen no seguro, permiso denegado)', async () => {
    vi.stubGlobal('navigator', {});
    const exec = vi.fn().mockReturnValue(true);
    document.execCommand = exec;
    await copyText('hola');
    expect(exec).toHaveBeenCalledWith('copy');
    expect(document.querySelector('textarea')).toBeNull(); // el textarea temporal se retira
  });
});
