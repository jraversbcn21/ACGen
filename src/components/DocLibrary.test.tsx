import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { I18nProvider } from '../i18n/I18nContext';
import { DocLibrary } from './DocLibrary';

function renderLib() {
  return render(
    <I18nProvider>
      <DocLibrary />
    </I18nProvider>
  );
}

function addLink(name: string, url: string, category = '') {
  fireEvent.click(screen.getByRole('button', { name: /Añadir enlace/ }));
  fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: name } });
  fireEvent.change(screen.getByLabelText('URL'), { target: { value: url } });
  if (category) fireEvent.change(screen.getByLabelText('Categoría'), { target: { value: category } });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar enlace' }));
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('acgen_lang', JSON.stringify('es'));
});
afterEach(() => vi.restoreAllMocks());

describe('DocLibrary', () => {
  it('empieza con el estado vacio que enseña el formato Nombre - URL', () => {
    renderLib();
    expect(screen.getByText('Todavía no hay enlaces')).toBeInTheDocument();
    expect(screen.getByText(/Nombre - URL/)).toBeInTheDocument();
  });

  it('da de alta un enlace y lo persiste en localStorage', () => {
    renderLib();
    addLink('Confluence QA', 'https://conf.example.com/qa', 'Documentación');
    expect(screen.getByText('Confluence QA ↗')).toBeInTheDocument();
    const stored = JSON.parse(localStorage.getItem('acgen_doclinks')!);
    expect(stored.links).toHaveLength(1);
    expect(stored.links[0]).toMatchObject({ name: 'Confluence QA', url: 'https://conf.example.com/qa', category: 'Documentación', favorite: false });
  });

  it('Guardar esta deshabilitado sin nombre o sin URL', () => {
    renderLib();
    fireEvent.click(screen.getByRole('button', { name: /Añadir enlace/ }));
    const save = screen.getByRole('button', { name: 'Guardar enlace' }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Docs' } });
    expect(save.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('URL'), { target: { value: 'https://x.example' } });
    expect(save.disabled).toBe(false);
  });

  it('pegar "Nombre - URL" en el campo URL rellena ambos campos', () => {
    renderLib();
    fireEvent.click(screen.getByRole('button', { name: /Añadir enlace/ }));
    fireEvent.change(screen.getByLabelText('URL'), { target: { value: 'Matriz regresion - https://sheets.example.com/m/1' } });
    expect((screen.getByLabelText('Nombre') as HTMLInputElement).value).toBe('Matriz regresion');
    expect((screen.getByLabelText('URL') as HTMLInputElement).value).toBe('https://sheets.example.com/m/1');
  });

  it('el enlace se abre en pestaña nueva con la URL exacta', () => {
    renderLib();
    addLink('Jira', 'https://jira.example.com/browse/Q');
    const a = document.querySelector('.dl-item-body') as HTMLAnchorElement;
    expect(a.href).toBe('https://jira.example.com/browse/Q');
    expect(a.target).toBe('_blank');
  });

  it('una URL guardada en formato "Nombre - URL" muestra el nombre SnapLink y abre la URL exacta', () => {
    renderLib();
    // Nombre ya escrito ANTES de pegar: el campo URL conserva el texto SnapLink
    // entero — el caso real que salia como URL cruda en dos lineas.
    addLink('Vacaciones QA', 'vacaciones_equipoBSK.xlsx - https://sharepoint.example.com/doc/1');
    const a = document.querySelector('.dl-item-body') as HTMLAnchorElement;
    expect(a.href).toBe('https://sharepoint.example.com/doc/1');
    expect(a.querySelector('.dl-item-url')?.textContent).toBe('vacaciones_equipoBSK.xlsx');
    expect(a.textContent).not.toContain('https://');
  });

  it('los chips de categoria se derivan con recuento y filtran (toggle)', () => {
    renderLib();
    addLink('A', 'https://a.example', 'Jira');
    addLink('B', 'https://b.example', 'Jira');
    addLink('C', 'https://c.example', 'Sheets');
    const chipJira = [...document.querySelectorAll<HTMLButtonElement>('.ld-chip')].find((b) => b.textContent?.startsWith('Jira'))!;
    expect(chipJira.querySelector('.ld-chip-count')?.textContent).toBe('2');
    fireEvent.click(chipJira);
    expect(document.querySelectorAll('.dl-item')).toHaveLength(2);
    fireEvent.click(chipJira);
    expect(document.querySelectorAll('.dl-item')).toHaveLength(3);
  });

  it('la busqueda ignora acentos y muestra el contador', () => {
    renderLib();
    addLink('Documentación de pagos', 'https://pagos.example');
    addLink('Otro', 'https://otro.example');
    fireEvent.change(screen.getByPlaceholderText(/Buscar por nombre/), { target: { value: 'documentacion' } });
    expect(document.querySelectorAll('.dl-item')).toHaveLength(1);
    expect(document.querySelector('.dl-search-count')?.textContent).toBe('1/2');
  });

  it('favorito sube el enlace arriba y el chip Favoritos filtra', () => {
    renderLib();
    addLink('Primero', 'https://p.example');
    addLink('Segundo', 'https://s.example');
    // "Segundo" entro el ultimo y esta arriba; marcamos "Primero" como favorito.
    const items = () => [...document.querySelectorAll('.dl-item-name')].map((e) => e.textContent);
    expect(items()[0]).toContain('Segundo');
    const starPrimero = document.querySelectorAll('.dl-star')[1];
    fireEvent.click(starPrimero);
    expect(items()[0]).toContain('Primero');
    const chipFav = [...document.querySelectorAll<HTMLButtonElement>('.ld-chip')].find((b) => b.textContent?.includes('Favoritos'))!;
    fireEvent.click(chipFav);
    expect(document.querySelectorAll('.dl-item')).toHaveLength(1);
  });

  it('editar reutiliza el formulario y guarda los cambios', () => {
    renderLib();
    addLink('Viejo', 'https://v.example', 'Docs');
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Nuevo' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(screen.getByText('Nuevo ↗')).toBeInTheDocument();
    const stored = JSON.parse(localStorage.getItem('acgen_doclinks')!);
    expect(stored.links).toHaveLength(1);
    expect(stored.links[0].name).toBe('Nuevo');
  });

  it('eliminar pide confirmacion y al cancelar no borra', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderLib();
    addLink('Docs', 'https://d.example');
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }));
    expect(document.querySelectorAll('.dl-item')).toHaveLength(1);
    confirmSpy.mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }));
    expect(document.querySelectorAll('.dl-item')).toHaveLength(0);
    expect(JSON.parse(localStorage.getItem('acgen_doclinks')!).links).toHaveLength(0);
  });

  it('sin coincidencias muestra su mensaje, no el estado vacio de bienvenida', () => {
    renderLib();
    addLink('Docs', 'https://d.example');
    fireEvent.change(screen.getByPlaceholderText(/Buscar por nombre/), { target: { value: 'zzz' } });
    expect(screen.getByText('Ningún enlace coincide con la búsqueda')).toBeInTheDocument();
    expect(screen.queryByText('Todavía no hay enlaces')).toBeNull();
  });
});

describe('DocLibrary — esquemas de URL', () => {
  it('solo guarda enlaces http(s): un javascript: no se da de alta y el campo se marca invalido', () => {
    renderLib();
    addLink('Evil', 'javascript:alert(1)');
    expect(screen.queryByText('Evil ↗')).not.toBeInTheDocument();
    expect(screen.getByLabelText('URL')).toHaveAttribute('aria-invalid', 'true');
    expect(localStorage.getItem('acgen_doclinks')).toBeNull();
  });
});
