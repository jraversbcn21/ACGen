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

/** El modo por defecto es Guiado; la plantilla Como/Quiero/Para vive en la pestana Texto libre. */
function irATextoLibre(lang: 'es' | 'en' = 'es') {
  fireEvent.click(screen.getByRole('tab', { name: lang === 'es' ? /texto libre/i : /free text/i }));
}

describe('UserStoryTool input guidance', () => {
  afterEach(() => localStorage.clear());

  it('el modo guiado ofrece los tres campos rol/accion/beneficio (es)', () => {
    renderGuidance('es');
    expect(screen.getByPlaceholderText(/cliente registrado/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/carrito conserve mis articulos/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/completar la compra/)).toBeInTheDocument();
  });

  it('shows the Como/Quiero/Para skeleton placeholder in free text (es)', () => {
    renderGuidance('es');
    irATextoLibre('es');
    const textarea = screen.getByPlaceholderText(/Como usuario/);
    expect(textarea).toHaveAttribute('placeholder', 'Como usuario...\nQuiero [funcionalidad]...\nPara [beneficio]...');
  });

  it('shows the equivalent skeleton placeholder (en)', () => {
    renderGuidance('en');
    irATextoLibre('en');
    const textarea = screen.getByPlaceholderText(/As a user/);
    expect(textarea).toHaveAttribute('placeholder', 'As a user...\nI want [functionality]...\nSo that [benefit]...');
  });

  it('renders a persistent hint below the field that survives typing (es)', () => {
    renderGuidance('es');
    irATextoLibre('es');
    expect(screen.getAllByText(/También puedes describirlo en texto libre/).length).toBeGreaterThan(0);
  });

  it('renders the persistent hint translated (en)', () => {
    renderGuidance('en');
    irATextoLibre('en');
    expect(screen.getAllByText(/You can also describe it in free text/).length).toBeGreaterThan(0);
  });
});

vi.mock('../services/apiService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/apiService')>();
  return { ...actual, streamWithGroq: vi.fn() };
});

const streamMock = vi.mocked(streamWithGroq);

// Forma real observada en produccion: el prompt pide en negrita Como/Quiero/Para,
// y el modelo anade cabeceras, reglas horizontales y a veces una tabla INVEST en
// vez de la lista de vinetas que se le pide.
const RESPUESTA = [
  '### Historia de Usuario',
  '',
  '**Como** cliente registrado',
  '**Quiero** guardar productos en una lista de deseos',
  '**Para** comprarlos mas adelante',
  '',
  '---',
  '',
  '### Evaluacion INVEST',
  '',
  '| Criterio | Estado | Observacion |',
  '|----------|--------|-------------|',
  '| **Independent** | OK | No bloquea checkout |',
  '| **Negotiable** | OK | Alcance ajustable |',
].join('\n');

function renderTool(props: Partial<Parameters<typeof UserStoryTool>[0]> = {}) {
  render(
    <I18nProvider>
      <UserStoryTool apiKey="k" model="m" {...props} />
    </I18nProvider>,
  );
}

async function generar() {
  // Modo guiado: rol y accion son los dos campos que habilitan Generar.
  fireEvent.change(screen.getByPlaceholderText(/cliente registrado/), { target: { value: 'cliente registrado' } });
  fireEvent.change(screen.getByPlaceholderText(/carrito conserve mis articulos/), { target: { value: 'guardar favoritos' } });
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

  it('compone la entrada desde los tres campos del modo guiado', async () => {
    renderTool();
    await generar();

    await waitFor(() => expect(streamMock).toHaveBeenCalled());
    const enviado = streamMock.mock.calls.at(-1)![2] as string;
    expect(enviado).toBe('Como cliente registrado, quiero guardar favoritos');
  });

  it('muestra el resultado sin sintaxis de markdown a la vista', async () => {
    renderTool();
    await generar();

    // Por testid a proposito: con findByText, mientras el stream sigue vivo se
    // engancha el div de progreso (que ya limpia) y el test pasa en verde
    // aunque el resultado final salga con markdown.
    const salida = await screen.findByTestId('userstory-output');
    const texto = salida.textContent ?? '';
    expect(texto).not.toMatch(/\*\*/);
    expect(texto).not.toMatch(/^#{1,6}\s/m);
    expect(texto).not.toMatch(/^\s*[-*_]{3,}\s*$/m);   // reglas horizontales
    expect(texto).not.toMatch(/^\s*\|[\s|:-]+\|\s*$/m); // fila separadora de tabla
    expect(texto).toContain('Historia de Usuario');
    expect(texto).toContain('Como cliente registrado');
    expect(texto).toContain('Independent | OK | No bloquea checkout');
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
