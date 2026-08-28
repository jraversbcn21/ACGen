import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { I18nProvider } from '../i18n/I18nContext';
import { LandingScreen } from './LandingScreen';

function renderLanding(props: Partial<Parameters<typeof LandingScreen>[0]> = {}) {
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
        {...props}
      />
    </I18nProvider>
  );
}

describe('LandingScreen layout (consola + tarjetas)', () => {
  afterEach(() => localStorage.clear());

  it('renders the 11 tool buttons', () => {
    renderLanding();
    const list = document.querySelector('.tool-list');
    expect(list?.querySelectorAll('.tool-row')).toHaveLength(11);
  });

  it('wraps the console block and the grid in .landing', () => {
    renderLanding();
    const landing = document.querySelector('.landing');
    expect(landing).not.toBeNull();
    expect(landing?.querySelector('.ld-console .ld-search-input')).not.toBeNull();
    expect(landing?.querySelector('.ld-console .ld-filters')).not.toBeNull();
    expect(landing?.querySelector('.ld-console .ld-status')).not.toBeNull();
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
    renderLanding({ onSelect });
    screen.getAllByRole('button').find((b) => b.className.includes('tool-row'))?.click();
    expect(onSelect).toHaveBeenCalledWith('acceptance');
  });
});

describe('LandingScreen — buscador y filtros', () => {
  beforeEach(() => localStorage.setItem('acgen_lang', JSON.stringify('es')));
  afterEach(() => localStorage.clear());

  function search() {
    return document.querySelector('.ld-search-input') as HTMLInputElement;
  }

  it('muestra el atajo de Windows, no el de Mac', () => {
    renderLanding();
    const kbd = document.querySelector('.ld-kbd');
    expect(kbd?.textContent).toBe('Ctrl K');
  });

  it('filtra por texto sobre titulo y descripcion', () => {
    renderLanding();
    fireEvent.change(search(), { target: { value: 'gherkin' } });
    const rows = document.querySelectorAll('.tool-row');
    expect(rows).toHaveLength(1);
    expect(rows[0].textContent).toContain('Conversor de Formatos');
  });

  it('ignora los acentos en la busqueda', () => {
    renderLanding();
    fireEvent.change(search(), { target: { value: 'limite' } });
    expect(document.querySelectorAll('.tool-row')).toHaveLength(1);
  });

  it('Enter abre la herramienta cuando queda un unico resultado', () => {
    const onSelect = vi.fn();
    renderLanding({ onSelect });
    fireEvent.change(search(), { target: { value: 'gherkin' } });
    fireEvent.keyDown(search(), { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledWith('converter');
  });

  it('Escape limpia la busqueda', () => {
    renderLanding();
    fireEvent.change(search(), { target: { value: 'gherkin' } });
    fireEvent.keyDown(search(), { key: 'Escape' });
    expect(search().value).toBe('');
    expect(document.querySelectorAll('.tool-row')).toHaveLength(11);
  });

  it('el chip de familia filtra y se puede desactivar', () => {
    renderLanding();
    // getByRole con /Tracking/ es ambiguo: las tarjetas de Sprint y Regression
    // llevan la misma palabra en su pill. El chip se busca por su clase.
    const chip = [...document.querySelectorAll<HTMLButtonElement>('.ld-chip')]
      .find((b) => b.textContent?.includes('Tracking'))!;
    fireEvent.click(chip);
    expect(document.querySelectorAll('.tool-row')).toHaveLength(2);
    expect(chip.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(chip);
    expect(document.querySelectorAll('.tool-row')).toHaveLength(11);
  });

  it('conserva el numero del catalogo al filtrar', () => {
    renderLanding();
    fireEvent.change(search(), { target: { value: 'regresiones' } });
    expect(document.querySelector('.row-num')?.textContent).toBe('11');
  });

  it('muestra el vacio cuando nada coincide', () => {
    renderLanding();
    fireEvent.change(search(), { target: { value: 'zzzz' } });
    expect(document.querySelector('.tool-list')).toBeNull();
    expect(document.querySelector('.ld-empty')).not.toBeNull();
  });
});

describe('LandingScreen — tira de estado', () => {
  beforeEach(() => localStorage.setItem('acgen_lang', JSON.stringify('es')));
  afterEach(() => localStorage.clear());

  it('resume proveedor, modelo y estado de la key', () => {
    renderLanding({ apiKey: 'gsk_123' });
    const status = document.querySelector('.ld-status');
    expect(status?.textContent).toContain('llama-3.3-70b-versatile');
    expect(status?.querySelector('.ld-status-ok')?.textContent).toBe('Conectada');
  });

  it('avisa cuando falta la key', () => {
    renderLanding({ apiKey: '' });
    expect(document.querySelector('.ld-status-warn')?.textContent).toBe('Sin configurar');
  });

  it('Editar despliega y repliega los campos del proveedor', () => {
    renderLanding();
    expect(document.querySelector('.ld-config-panel')).toBeNull();
    const edit = screen.getByRole('button', { name: 'Editar' });
    fireEvent.click(edit);
    expect(document.querySelector('.ld-config-panel')).not.toBeNull();
    expect(edit.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(edit);
    expect(document.querySelector('.ld-config-panel')).toBeNull();
  });
});

/**
 * Perfil y Prompts vivian solo en el sidebar-footer, y App.tsx solo renderiza
 * el Sidebar cuando view !== 'landing' — asi que desde la portada no habia
 * forma de abrirlos. Ahora viven en .ld-actions, junto a "Editar".
 *
 * Ojo: en jsdom navigator.language es 'en-US' y detectLang() devuelve 'en'.
 * Fijamos el idioma a mano porque estos tests afirman sobre texto.
 */
describe('LandingScreen — Perfil y Prompts', () => {
  beforeEach(() => localStorage.setItem('acgen_lang', JSON.stringify('es')));
  afterEach(() => localStorage.clear());

  it('coloca las tres acciones dentro de la tira de estado', () => {
    renderLanding();
    const actions = document.querySelector('.ld-status .ld-actions');
    expect(actions).not.toBeNull();
    expect(actions?.querySelectorAll('button')).toHaveLength(3);
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
