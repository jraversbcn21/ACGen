import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { I18nProvider } from '../i18n/I18nContext';
import { UserStoryTool } from './UserStoryTool';
import { streamWithGroq } from '../services/apiService';

function renderGuidance(lang: 'es' | 'en' = 'es') {
  localStorage.setItem('acgen_lang', JSON.stringify(lang));
  return render(
    <I18nProvider>
      <UserStoryTool apiKey="" model="llama-3.3-70b-versatile" />
    </I18nProvider>
  );
}

describe('UserStoryTool input guidance', () => {
  afterEach(() => localStorage.clear());

  it('shows the Como/Quiero/Para skeleton placeholder (es)', () => {
    renderGuidance('es');
    const textarea = screen.getByPlaceholderText(/Como usuario/);
    expect(textarea).toHaveAttribute('placeholder', 'Como usuario...\nQuiero [funcionalidad]...\nPara [beneficio]...');
  });

  it('shows the equivalent skeleton placeholder (en)', () => {
    renderGuidance('en');
    const textarea = screen.getByPlaceholderText(/As a user/);
    expect(textarea).toHaveAttribute('placeholder', 'As a user...\nI want [functionality]...\nSo that [benefit]...');
  });

  it('renders a persistent hint below the field that survives typing (es)', () => {
    renderGuidance('es');
    expect(screen.getByText(/También puedes describirlo en texto libre/)).toBeInTheDocument();
  });

  it('renders the persistent hint translated (en)', () => {
    renderGuidance('en');
    expect(screen.getByText(/You can also describe it in free text/)).toBeInTheDocument();
  });
});

vi.mock('../services/apiService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/apiService')>();
  return { ...actual, streamWithGroq: vi.fn() };
});

const streamMock = vi.mocked(streamWithGroq);

// Forma real de la respuesta: USER_STORY_PROMPT pide en negrita Como, Quiero y Para.
const RESPUESTA = [
  '**Como** cliente registrado',
  '**Quiero** guardar productos en una lista de deseos',
  '**Para** comprarlos mas adelante',
  '',
  '### Evaluacion INVEST',
  '- **Independent**: sin dependencias',
  '- **Negotiable**: alcance abierto',
].join('\n');

function renderTool(props: Partial<Parameters<typeof UserStoryTool>[0]> = {}) {
  render(
    <I18nProvider>
      <UserStoryTool apiKey="k" model="m" {...props} />
    </I18nProvider>,
  );
}

async function generar() {
  fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: 'guardar favoritos' } });
  fireEvent.click(screen.getByRole('button', { name: /generar/i }));
}

describe('UserStoryTool', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('acgen_lang', JSON.stringify('es'));
    streamMock.mockReset();
    streamMock.mockImplementation(async function* () {
      yield { token: RESPUESTA, done: false };
      yield { token: '', done: true };
    });
  });

  it('muestra el resultado sin sintaxis de markdown a la vista', async () => {
    renderTool();
    await generar();

    // Por testid a proposito: con findByText, mientras el stream sigue vivo se
    // engancha el div de progreso (que ya limpia) y el test pasa en verde
    // aunque el resultado final salga con markdown.
    const salida = await screen.findByTestId('userstory-output');
    expect(salida.textContent).not.toMatch(/\*\*/);
    expect(salida.textContent).not.toMatch(/^#{1,6}\s/m);
    expect(salida.textContent).toContain('Como cliente registrado');
    expect(salida.textContent).toContain('Evaluacion INVEST');
    expect(salida.textContent).toContain('- Independent: sin dependencias');
  });

  it('guarda en el artefacto el mismo texto limpio que se muestra', async () => {
    const onSave = vi.fn();
    renderTool({ onSaveArtifact: onSave });
    await generar();

    await waitFor(() => expect(onSave).toHaveBeenCalled());
    const guardado = onSave.mock.calls.at(-1)![1] as string;
    expect(guardado).not.toMatch(/\*\*/);
    expect(guardado).toContain('Quiero guardar productos');
  });

  it('encadena a otra herramienta el texto ya limpio', async () => {
    const onChain = vi.fn();
    renderTool({ onChain });
    await generar();

    await screen.findByText(/Como cliente registrado/);
    const enlaces = screen.getAllByRole('button').filter((b) => /criterios/i.test(b.textContent ?? ''));
    expect(enlaces.length).toBeGreaterThan(0);
    fireEvent.click(enlaces[0]);
    expect(onChain).toHaveBeenCalled();
    expect(onChain.mock.calls[0][1]).not.toMatch(/\*\*/);
  });
});
