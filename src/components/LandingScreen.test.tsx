import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { I18nProvider } from '../i18n/I18nContext';
import { LandingScreen } from './LandingScreen';

function renderLanding() {
  return render(
    <I18nProvider>
      <LandingScreen
        onSelect={vi.fn()}
        provider="groq"
        onProviderChange={() => {}}
        apiKey=""
        onApiKeyChange={() => {}}
        model="llama-3.3-70b-versatile"
        onModelChange={() => {}}
        customBaseUrl=""
        onCustomBaseUrlChange={() => {}}
      />
    </I18nProvider>
  );
}

describe('LandingScreen layout', () => {
  afterEach(() => localStorage.clear());

  it('renders the 11 tool buttons', () => {
    renderLanding();
    const list = document.querySelector('.tool-list');
    expect(list?.querySelectorAll('.tool-row')).toHaveLength(11);
  });

  it('wraps everything in a centered .landing container', () => {
    renderLanding();
    const landing = document.querySelector('.landing');
    expect(landing).not.toBeNull();
    expect(landing?.querySelector('.hero')).not.toBeNull();
    expect(landing?.querySelector('.config-strip')).not.toBeNull();
    expect(landing?.querySelector('.tool-list')).not.toBeNull();
  });

  it('renders exactly the 11 tool cells with no placeholder slot', () => {
    renderLanding();
    const list = document.querySelector('.tool-list');
    expect(list?.querySelector('.add-slot')).toBeNull();
    expect(list?.children).toHaveLength(11);
  });

  it('still fires onSelect when a tool is clicked', () => {
    const onSelect = vi.fn();
    render(
      <I18nProvider>
        <LandingScreen
          onSelect={onSelect}
          provider="groq"
          onProviderChange={() => {}}
          apiKey=""
          onApiKeyChange={() => {}}
          model="llama-3.3-70b-versatile"
          onModelChange={() => {}}
          customBaseUrl=""
          onCustomBaseUrlChange={() => {}}
        />
      </I18nProvider>
    );
    screen.getAllByRole('button').find((b) => b.className.includes('tool-row'))?.click();
    expect(onSelect).toHaveBeenCalledWith('acceptance');
  });
});

/**
 * Perfil y Prompts vivian solo en el sidebar-footer, y App.tsx solo
 * renderiza el Sidebar cuando view !== 'landing' — asi que desde la
 * portada no habia forma de abrirlos. El config-strip ya es la franja de
 * "configura tu sesion" (proveedor, key, modelo), asi que es su sitio.
 *
 * Ojo: en jsdom navigator.language es 'en-US' y detectLang() devuelve
 * 'en'. Fijamos el idioma a mano porque estos tests afirman sobre texto.
 */
describe('LandingScreen — Perfil y Prompts', () => {
  beforeEach(() => {
    localStorage.setItem('acgen_lang', JSON.stringify('es'));
  });
  afterEach(() => localStorage.clear());

  it('coloca las dos acciones dentro del config-strip', () => {
    renderLanding();
    const actions = document.querySelector('.config-strip .config-actions');
    expect(actions).not.toBeNull();
    expect(actions?.querySelectorAll('button')).toHaveLength(2);
  });

  it('abre el editor de perfil y lo cierra', () => {
    renderLanding();
    expect(screen.queryByText('Perfil del proyecto')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Perfil' }));
    expect(screen.getByText('Perfil del proyecto')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(screen.queryByText('Perfil del proyecto')).toBeNull();
  });

  it('abre el editor de prompts', () => {
    renderLanding();
    expect(screen.queryByText('Editor de Prompts')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Prompts' }));
    expect(screen.getByText('Editor de Prompts')).toBeInTheDocument();
  });

  it('no monta ningun modal en el render inicial', () => {
    renderLanding();
    expect(document.querySelector('.modal-overlay')).toBeNull();
  });
});
