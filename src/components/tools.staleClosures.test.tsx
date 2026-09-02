import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import type { ComponentType } from 'react';
import { I18nProvider } from '../i18n/I18nContext';
import { streamWithGroq } from '../services/apiService';
import { fileToProcessedDataUrl } from '../utils/image';
import { DEMO_DATA } from '../config/demoData';
import { AcceptanceCriteriaTool } from './AcceptanceCriteriaTool';
import { BugReportTool } from './BugReportTool';
import { ConverterTool } from './ConverterTool';
import { DesignValidatorTool } from './DesignValidatorTool';
import { EdgeCaseTool } from './EdgeCaseTool';
import { RefinerTool } from './RefinerTool';
import { TestCaseTool } from './TestCaseTool';
import { TestDataTool } from './TestDataTool';
import { UserStoryTool } from './UserStoryTool';

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
  carencias: [{ flujo: 'Login', descripcion: 'x' }],
  contradicciones: [],
  sugerencias: [],
});

type ToolProps = { apiKey: string; model: string; onSaveArtifact?: (i: string, o: string) => void };

/**
 * Los nueve tools comparten el mismo esqueleto copiado a mano, y dos bugs
 * vivian exactamente en la deriva entre copias:
 *  - `doGenerate` sin `onSaveArtifact` en deps: tras cambiar de workspace en
 *    la cabecera (sin remontar el tool) el artefacto se guardaba en el ANTERIOR.
 *  - `handleClear` sin `reset()` del stream: Limpiar a mitad de generacion no
 *    invalidaba el stream en curso, que al acabar resucitaba y persistia el
 *    resultado descartado.
 */
const PII = 'Revisar con jorge@example.com';

const TOOLS: {
  name: string;
  Tool: ComponentType<ToolProps>;
  output: string;
  /** Clave del modo confidencial; sin ella (Validador) no hay badge que probar. */
  confidentialKey?: string;
  props?: Record<string, unknown>;
  prepare?: () => Promise<void> | void;
  /** Como meter texto con PII para que el badge confidencial tenga algo que contar. */
  preparePii?: () => void;
  /** Texto garantizado en pantalla tras una generacion con `output`. */
  token: string;
  /** true en los 5 tools de texto (muestran el stream en vivo); false en los 4 de JSON/informe. */
  streams: boolean;
}[] = [
  { name: 'AcceptanceCriteriaTool', Tool: AcceptanceCriteriaTool, output: 'Criterios generados', confidentialKey: 'acgen_confidential_acceptance', token: 'Criterios generados', streams: true },
  { name: 'BugReportTool', Tool: BugReportTool, output: 'Informe generado', confidentialKey: 'acgen_confidential_bugreport', token: 'Informe generado', streams: true },
  { name: 'ConverterTool', Tool: ConverterTool, output: 'Texto convertido', confidentialKey: 'acgen_confidential_converter', token: 'Texto convertido', streams: true },
  { name: 'RefinerTool', Tool: RefinerTool, output: 'Requisito refinado', confidentialKey: 'acgen_confidential_refiner', token: 'Requisito refinado', streams: true },
  // El output no puede coincidir literalmente con el titulo estatico del panel
  // ("Historia generada", userstory.generated) o `visible()` seria siempre true.
  { name: 'UserStoryTool', Tool: UserStoryTool, output: 'Como QA quiero validar el alta de usuario', confidentialKey: 'acgen_confidential_userstory', token: 'Como QA quiero validar el alta de usuario', streams: true },
  { name: 'TestCaseTool', Tool: TestCaseTool, output: DEMO_DATA.testcase.output, confidentialKey: 'acgen_confidential_testcase', token: 'TC-001', streams: false },
  { name: 'EdgeCaseTool', Tool: EdgeCaseTool, output: JSON.stringify([{ categoria: 'Limites', escenario: 'x', resultadoEsperado: 'y' }]), confidentialKey: 'acgen_confidential_edgecase', token: 'Limites', streams: false },
  {
    name: 'TestDataTool',
    Tool: TestDataTool,
    output: DEMO_DATA.testdata.output,
    confidentialKey: 'acgen_confidential_testdata',
    // Sin texto que escribir; Limpiar solo se habilita si el formulario difiere del defecto.
    prepare: () => { fireEvent.change(document.getElementById('td-quantity')!, { target: { value: '5' } }); },
    preparePii: () => { fireEvent.change(document.getElementById('td-context')!, { target: { value: PII } }); },
    token: 'Maria',
    streams: false,
  },
  {
    name: 'DesignValidatorTool',
    // Exige `provider`; se lo pasamos por `props`.
    Tool: DesignValidatorTool as unknown as ComponentType<ToolProps>,
    output: REPORT,
    props: { provider: 'openrouter', model: 'google/gemini-2.5-flash', onSwitchToVisionModel: vi.fn() },
    prepare: async () => {
      fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: 'Dado un usuario...' } });
      fireEvent.change(screen.getByLabelText(/adjuntar imagen/i), { target: { files: [new File(['x'], 'd.png', { type: 'image/png' })] } });
      await screen.findByText('d.png');
    },
    token: 'Login',
    streams: false,
  },
];

function fillEveryTextbox(text = 'algo') {
  screen.getAllByRole('textbox').forEach((el) => fireEvent.change(el, { target: { value: text } }));
}

/** El resultado de texto vive en un `<textarea>`, cuyo `.value` no entra en
 *  `textContent`; el de JSON/informe es DOM normal y si entra. */
function visible(text: string): boolean {
  if (document.body.textContent?.includes(text)) return true;
  return [...document.querySelectorAll('textarea')].some((ta) => ta.value.includes(text));
}

describe.each(TOOLS)('$name — closures que no se quedan viejas', ({ Tool, output, confidentialKey, props, prepare, preparePii, token, streams }) => {
  const ui = (onSaveArtifact: (i: string, o: string) => void) => (
    <I18nProvider>
      <Tool apiKey="k" model="m" {...props} onSaveArtifact={onSaveArtifact} />
    </I18nProvider>
  );

  beforeEach(() => {
    localStorage.setItem('acgen_lang', JSON.stringify('es'));
    streamMock.mockReset();
    processMock.mockReset();
    processMock.mockResolvedValue('data:image/jpeg;base64,IMG');
  });

  it('guarda el artefacto con el onSaveArtifact vigente al generar, no con el del montaje', async () => {
    streamMock.mockImplementation(async function* () {
      yield { token: output, done: false };
      yield { token: '', done: true };
    });
    const saveA = vi.fn();
    const saveB = vi.fn();
    const { rerender } = render(ui(saveA));
    await (prepare ?? fillEveryTextbox)();
    // El cambio de workspace en la cabecera re-renderiza el tool con otro callback, sin remontarlo.
    rerender(ui(saveB));
    fireEvent.click(screen.getByRole('button', { name: /generar/i }));

    await waitFor(() => expect(saveA.mock.calls.length + saveB.mock.calls.length).toBe(1));
    expect(saveB).toHaveBeenCalledTimes(1);
    expect(saveA).not.toHaveBeenCalled();
  });

  it('Limpiar a mitad de stream descarta la generacion en curso y no la persiste', async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    let finished = false;
    streamMock.mockImplementation(async function* () {
      try {
        yield { token: output.slice(0, 1), done: false };
        await gate;
        yield { token: output.slice(1), done: false };
        yield { token: '', done: true };
      } finally {
        finished = true;
      }
    });
    const save = vi.fn();
    render(ui(save));
    await (prepare ?? fillEveryTextbox)();
    fireEvent.click(screen.getByRole('button', { name: /generar/i }));
    await waitFor(() => expect(streamMock).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole('button', { name: /limpiar/i }));
    await act(async () => { release(); });
    await waitFor(() => expect(finished).toBe(true));

    expect(save).not.toHaveBeenCalled();
  });

  // El badge "N sustituciones — Revisar" sigue clicable durante el stream y su
  // confirmacion entra por doGenerate, saltandose el guard de handleGenerate.
  it.skipIf(!confidentialKey)('el badge confidencial no arranca una segunda generacion mientras hay una en curso', async () => {
    localStorage.setItem(confidentialKey!, 'true');
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    streamMock.mockImplementation(async function* () {
      yield { token: output.slice(0, 1), done: false };
      await gate;
      yield { token: output.slice(1), done: false };
      yield { token: '', done: true };
    });
    render(ui(vi.fn()));
    (preparePii ?? (() => fillEveryTextbox(PII)))();
    fireEvent.click(screen.getByRole('button', { name: /generar/i }));
    fireEvent.click(await screen.findByRole('button', { name: /confirmar y enviar/i }));
    await waitFor(() => expect(streamMock).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole('button', { name: /revisar/i }));
    fireEvent.click(await screen.findByRole('button', { name: /confirmar y enviar/i }));
    await act(async () => { release(); });

    expect(streamMock).toHaveBeenCalledTimes(1);
  });

  it('al arrancar una segunda generacion, el resultado anterior desaparece antes del primer token (y donde hay vista de stream, el stream se ve)', async () => {
    streamMock.mockImplementation(async function* () {
      yield { token: output, done: false };
      yield { token: '', done: true };
    });
    render(ui(vi.fn()));
    await (prepare ?? fillEveryTextbox)();
    fireEvent.click(screen.getByRole('button', { name: /generar/i }));
    await waitFor(() => expect(visible(token)).toBe(true));

    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    let finished = false;
    streamMock.mockImplementation(async function* () {
      try {
        yield { token: streams ? 'STREAM-MARK' : output.slice(0, 1), done: false };
        await gate;
        yield { token: streams ? ' resto' : output.slice(1), done: false };
        yield { token: '', done: true };
      } finally {
        finished = true;
      }
    });
    fireEvent.click(screen.getByRole('button', { name: /generar/i }));
    await waitFor(() => expect(streamMock).toHaveBeenCalledTimes(2));
    expect(visible(token)).toBe(false);
    if (streams) {
      await waitFor(() => expect(visible('STREAM-MARK')).toBe(true));
    }

    await act(async () => { release(); });
    await waitFor(() => expect(finished).toBe(true));
  });
});
