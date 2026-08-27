import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { I18nProvider } from '../i18n/I18nContext';
import { streamWithGroq } from '../services/apiService';
import { RefinerTool } from './RefinerTool';

vi.mock('../services/apiService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/apiService')>();
  return { ...actual, streamWithGroq: vi.fn() };
});

const streamMock = vi.mocked(streamWithGroq);

/**
 * El resumen de hallazgos parsea la salida LIBRE del modelo, asi que lo que se
 * fija aqui son los formatos que REFINER_PROMPT pide ("estructurado por
 * categorias, con viñetas claras") y los que el modelo produce en la practica
 * al interpretarlo — negrita, ### y numeracion. Si no reconoce nada, la tarjeta
 * no debe aparecer: es un resumen opcional, no puede romper la salida.
 */
function mockAnswer(text: string) {
  streamMock.mockImplementation(async function* () {
    yield { token: text, done: false };
    yield { token: '', done: true };
  });
}

async function renderAndRefine(answer: string) {
  mockAnswer(answer);
  render(
    <I18nProvider>
      <RefinerTool apiKey="test-key" model="test-model" />
    </I18nProvider>,
  );
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'El usuario puede filtrar' } });
  fireEvent.click(screen.getByRole('button', { name: /generar/i }));
  await waitFor(() => expect(streamMock).toHaveBeenCalled());
}

const chips = () =>
  [...document.querySelectorAll('.rf-finding')].map((e) => e.textContent);

describe('RefinerTool — resumen de hallazgos', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('acgen_lang', JSON.stringify('es'));
    streamMock.mockReset();
  });

  it('cuenta las viñetas de cada categoria en el formato que pide el prompt', async () => {
    await renderAndRefine(`**Ambiguedades**
- "filtrar" no dice por que campos
- no se define el orden por defecto

**Contradicciones**
- el punto 2 permite duplicados y el 5 los prohibe

**Informacion faltante**
- que pasa sin resultados
- limite de filtros simultaneos
- persistencia entre sesiones`);

    await waitFor(() => expect(chips()).toHaveLength(3));
    expect(chips()).toEqual(['Ambiguedades2', 'Contradicciones1', 'Informacion faltante3']);
  });

  it('reconoce tambien encabezados con ### y listas numeradas', async () => {
    await renderAndRefine(`### Dependencias no declaradas
- API de catalogo
- servicio de sesion

### Preguntas sugeridas
- ¿se filtra en cliente o servidor?`);

    await waitFor(() => expect(chips()).toHaveLength(2));
    expect(chips()).toEqual(['Dependencias no declaradas2', 'Preguntas sugeridas1']);
  });

  it('no pinta la tarjeta si el modelo responde en prosa sin categorias', async () => {
    await renderAndRefine('El requisito es razonablemente claro y no encuentro ambiguedades relevantes.');

    await waitFor(() => expect(screen.getByText(/razonablemente claro/)).toBeInTheDocument());
    expect(screen.queryByText('Qué ha encontrado')).not.toBeInTheDocument();
    expect(chips()).toHaveLength(0);
  });

  it('ignora las categorias declaradas que se quedan sin viñetas', async () => {
    await renderAndRefine(`**Ambiguedades**
- termino vago: "rapido"

**Contradicciones**

**Informacion faltante**
- falta el criterio de exito`);

    await waitFor(() => expect(chips()).toHaveLength(2));
    expect(chips()).toEqual(['Ambiguedades1', 'Informacion faltante1']);
  });
});

describe('RefinerTool — panel antes/despues', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('acgen_lang', JSON.stringify('es'));
    streamMock.mockReset();
  });

  it('cuenta los caracteres del requisito original', () => {
    render(
      <I18nProvider>
        <RefinerTool apiKey="test-key" model="test-model" />
      </I18nProvider>,
    );
    expect(screen.getByText('0 car.')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'hola' } });
    expect(screen.getByText('4 car.')).toBeInTheDocument();
  });

  it('no ofrece Copiar hasta que hay analisis', async () => {
    expect.assertions(2);
    mockAnswer('**Ambiguedades**\n- una');
    render(
      <I18nProvider>
        <RefinerTool apiKey="test-key" model="test-model" />
      </I18nProvider>,
    );
    expect(screen.queryByRole('button', { name: /copiar/i })).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'algo' } });
    fireEvent.click(screen.getByRole('button', { name: /generar/i }));
    await waitFor(() => expect(screen.getByRole('button', { name: /copiar/i })).toBeInTheDocument());
  });
});
