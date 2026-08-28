import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { I18nProvider } from '../i18n/I18nContext';
import { EdgeCaseTool } from './EdgeCaseTool';
import { streamWithGroq } from '../services/apiService';

vi.mock('../services/apiService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/apiService')>();
  return { ...actual, streamWithGroq: vi.fn() };
});
const streamMock = vi.mocked(streamWithGroq);

/** Dos filas comparten categoria a proposito: la cabecera debe agruparlas, no listarlas dos veces. */
const CASOS = [
  { categoria: 'Valores frontera', escenario: 'Importe en el maximo', resultadoEsperado: 'Se acepta' },
  { categoria: 'Valores frontera', escenario: 'Un centimo por encima', resultadoEsperado: 'Error inline' },
  { categoria: 'Concurrencia', escenario: 'Dos pestanas\ta la vez', resultadoEsperado: 'Un solo cobro\nsin duplicar' },
];

function renderTool(lang: 'es' | 'en' = 'es') {
  localStorage.setItem('acgen_lang', JSON.stringify(lang));
  return render(
    <I18nProvider>
      <EdgeCaseTool apiKey="k" model="modelo-x" />
    </I18nProvider>
  );
}

async function generar(casos = CASOS) {
  streamMock.mockImplementation(async function* () {
    yield { token: JSON.stringify(casos), done: false };
    yield { token: '', done: true };
  });
  fireEvent.change(screen.getByPlaceholderText(/Describe la funcionalidad/), {
    target: { value: 'checkout con tarjeta' },
  });
  fireEvent.click(screen.getByRole('button', { name: /Generar/i }));
  await waitFor(() => expect(screen.getAllByRole('row').length).toBeGreaterThan(1));
}

describe('EdgeCaseTool', () => {
  afterEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('el estado vacio explica que columnas trae la tabla', () => {
    renderTool();
    expect(screen.getByText(/Los casos límite aparecerán aquí/i)).toBeInTheDocument();
    expect(screen.getByText(/recuento por categoría en la cabecera/i)).toBeInTheDocument();
  });

  it('sin resultados, copiar la tabla esta deshabilitado', () => {
    renderTool();
    expect(screen.getByRole('button', { name: /Copiar tabla/i })).toBeDisabled();
  });

  it('agrupa el recuento por categoria en la cabecera', async () => {
    renderTool();
    await generar();
    // 'Valores frontera' sale una vez en la cabecera (con recuento 2) y dos en la tabla.
    expect(screen.getAllByText('Valores frontera')).toHaveLength(3);
    const cabecera = document.querySelectorAll('.ec-cat');
    expect(cabecera).toHaveLength(2);
    expect(cabecera[0].textContent).toBe('Valores frontera2');
    expect(cabecera[1].textContent).toBe('Concurrencia1');
  });

  it('copia la tabla como TSV con cabecera y sin romper filas por tabuladores o saltos', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    renderTool();
    await generar();

    fireEvent.click(screen.getByRole('button', { name: /Copiar tabla/i }));
    await waitFor(() => expect(writeText).toHaveBeenCalled());

    const lineas = (writeText.mock.calls[0][0] as string).split('\n');
    expect(lineas).toHaveLength(4); // cabecera + 3 casos
    expect(lineas[0]).toBe('Categoría\tEscenario\tResultado esperado');
    expect(lineas[1]).toBe('Valores frontera\tImporte en el maximo\tSe acepta');
    // El tabulador y el salto de linea del ultimo caso pasan a espacios: una fila sigue siendo una fila.
    expect(lineas[3]).toBe('Concurrencia\tDos pestanas a la vez\tUn solo cobro sin duplicar');
  });

  it('muestra el modelo usado solo despues de generar', async () => {
    renderTool();
    expect(document.querySelector('.model-badge-new')).toBeNull();
    await generar();
    expect(document.querySelector('.model-badge-new')?.textContent).toContain('modelo-x');
  });
});
