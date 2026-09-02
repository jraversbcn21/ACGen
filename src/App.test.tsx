import { render, act, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import App from './App';
import { streamWithGroq } from './services/apiService';

vi.mock('./services/apiService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./services/apiService')>();
  return { ...actual, streamWithGroq: vi.fn() };
});

const streamMock = vi.mocked(streamWithGroq);

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('acgen_lang', JSON.stringify('es'));
  window.location.hash = '';
});

afterEach(() => {
  vi.restoreAllMocks();
  window.location.hash = '';
});

describe('App — hash navigation', () => {
  it('scrolls to top when navigating to a tool', () => {
    const scrollSpy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    render(<App />);
    scrollSpy.mockClear();
    act(() => {
      window.location.hash = '#/acceptance';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    expect(scrollSpy).toHaveBeenCalledWith(0, 0);
  });
});

/**
 * El prefill de encadenado debe ser one-shot: se entrega una vez a la vista
 * destino y se limpia. Sin eso, cada revisita posterior de esa vista la
 * remonta y reinyecta el texto viejo durante el resto de la sesion — incluso
 * despues de un Limpiar explicito. Los tests de chain de las herramientas
 * montan el componente una vez con el prop puesto y no pueden verlo.
 */
describe('App — chain prefill es one-shot', () => {
  const goTo = (v: string) => act(() => {
    window.location.hash = `#/${v}`;
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });

  it('el texto encadenado no se reinyecta al revisitar la herramienta destino', async () => {
    streamMock.mockImplementation(async function* () {
      yield { token: 'Como usuario quiero pagar con tarjeta', done: false };
      yield { token: '', done: true };
    });
    localStorage.setItem('acgen_key_groq', JSON.stringify('k'));
    render(<App />);

    goTo('userstory');
    // La tool arranca en modo guiado; el textarea libre es el que encadena texto ya redactado.
    fireEvent.click(screen.getByRole('tab', { name: 'Texto libre' }));
    fireEvent.change(screen.getByPlaceholderText(/Como usuario/), { target: { value: 'pago con tarjeta' } });
    fireEvent.click(screen.getByRole('button', { name: 'Generar' }));
    const chainBtn = await screen.findByRole('button', { name: /Generar Criterios/ });

    // El click encadena via navigate(), que solo cambia el hash; el evento se
    // dispara a mano porque jsdom no lo emite de forma fiable.
    fireEvent.click(chainBtn);
    act(() => { window.dispatchEvent(new HashChangeEvent('hashchange')); });
    expect(await screen.findByPlaceholderText(/Describe la funcionalidad/))
      .toHaveValue('Como usuario quiero pagar con tarjeta');

    // Marcharse y volver: la vista se remonta y NO debe reinyectar el texto.
    goTo('bugreport');
    goTo('acceptance');
    expect(await screen.findByPlaceholderText(/Describe la funcionalidad/)).toHaveValue('');
  });
});

/**
 * `<ProfileEditor>`/`<PromptEditor>` modal state is deliberately duplicated
 * between `Sidebar.tsx` and `LandingScreen.tsx` instead of lifted to `App`,
 * which is only safe because `App.tsx` never renders `<Sidebar>` on the
 * landing view. Pin that premise so a future change can't silently break it.
 */
describe('App — landing view', () => {
  it('renders no sidebar on the landing view', () => {
    render(<App />);
    expect(document.querySelector('aside.sidebar')).toBeNull();
  });
});

describe('App — migracion de la API key legada', () => {
  it('mueve acgen_api_key a acgen_key_groq y borra la clave vieja', () => {
    localStorage.setItem('acgen_api_key', JSON.stringify('gsk_vieja'));
    render(<App />);
    expect(JSON.parse(localStorage.getItem('acgen_key_groq')!)).toBe('gsk_vieja');
    expect(localStorage.getItem('acgen_api_key')).toBeNull();
  });
});
