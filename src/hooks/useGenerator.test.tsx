import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { I18nProvider } from '../i18n/I18nContext';
import { streamWithGroq } from '../services/apiService';
import { useGenerator, type GeneratorConfig } from './useGenerator';

vi.mock('../services/apiService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/apiService')>();
  return { ...actual, streamWithGroq: vi.fn() };
});
const streamMock = vi.mocked(streamWithGroq);

const wrapper = ({ children }: { children: ReactNode }) => <I18nProvider>{children}</I18nProvider>;

function yields(...tokens: string[]) {
  streamMock.mockImplementation(async function* () {
    for (const token of tokens) yield { token, done: false, model: 'm' };
    yield { token: '', done: true };
  });
}

function config(overrides: Partial<GeneratorConfig<string>> = {}): GeneratorConfig<string> {
  return {
    view: 'testcase',
    toolType: 'testcase',
    apiKey: 'k',
    model: 'm',
    canGenerate: true,
    buildInput: () => 'entrada',
    parse: (fullText) => fullText.toUpperCase(),
    onResult: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('acgen_lang', JSON.stringify('es'));
  streamMock.mockReset();
});

describe('useGenerator', () => {
  it('flujo feliz: loading -> parse -> onResult(result, ctx) -> success', async () => {
    yields('ho', 'la');
    const onResult = vi.fn();
    const { result } = renderHook(() => useGenerator(config({ onResult })), { wrapper });
    expect(result.current.status).toBe('idle');
    await act(async () => { await result.current.handleGenerate(); });
    expect(streamMock).toHaveBeenCalledWith('k', 'm', 'entrada', expect.any(String), 'testcase', undefined, undefined, undefined);
    expect(onResult).toHaveBeenCalledWith('HOLA', { input: 'entrada', fullText: 'hola', model: 'm' });
    expect(result.current.status).toBe('success');
    expect(result.current.error).toBeNull();
  });

  it('guard: sin canGenerate, o con una generacion en curso, no llama a la API (tampoco desde confirmReview)', async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    streamMock.mockImplementation(async function* () {
      yield { token: 'a', done: false };
      await gate;
      yield { token: '', done: true };
    });
    const { result, rerender } = renderHook((props: { can: boolean }) => useGenerator(config({ canGenerate: props.can })), { wrapper, initialProps: { can: false } });
    await act(async () => { await result.current.handleGenerate(); });
    expect(streamMock).not.toHaveBeenCalled();

    rerender({ can: true });
    let first!: Promise<void>;
    act(() => { first = result.current.handleGenerate(); });
    await act(async () => {});
    expect(streamMock).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe('loading');
    await act(async () => { await result.current.handleGenerate(); });
    act(() => { result.current.openReview(); });
    act(() => { result.current.confirmReview({}); });
    expect(streamMock).toHaveBeenCalledTimes(1);
    await act(async () => { release(); await first; });
  });

  it('error: parse que lanza -> status error y mensaje traducido con params; con onError va al callback', async () => {
    yields('x');
    const boom = Object.assign(new Error('error.testCaseInvalid'), { params: { n: 3 } });
    const { result } = renderHook(() => useGenerator(config({ parse: () => { throw boom; } })), { wrapper });
    await act(async () => { await result.current.handleGenerate(); });
    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe('El caso de prueba 3 no es un objeto válido.');
    act(() => { result.current.dismissError(); });
    expect(result.current.error).toBeNull();

    const onError = vi.fn();
    const { result: r2 } = renderHook(() => useGenerator(config({ parse: () => { throw boom; }, onError })), { wrapper });
    await act(async () => { await r2.current.handleGenerate(); });
    expect(onError).toHaveBeenCalledWith('El caso de prueba 3 no es un objeto válido.');
    expect(r2.current.error).toBeNull();
    expect(r2.current.status).toBe('error');
  });

  it('confidencial: con PII abre review sin llamar; confirmReview envia enmascarado con el mapa; cancelReview cierra', async () => {
    localStorage.setItem('acgen_confidential_testcase', 'true');
    yields('ok');
    const { result } = renderHook(() => useGenerator(config({ buildInput: () => 'avisar a jorge@example.com' })), { wrapper });
    await act(async () => { await result.current.handleGenerate(); });
    expect(streamMock).not.toHaveBeenCalled();
    expect(result.current.review).toEqual({ text: 'avisar a [EMAIL_1]', map: { '[EMAIL_1]': 'jorge@example.com' } });

    act(() => { result.current.cancelReview(); });
    expect(result.current.review).toBeNull();
    expect(streamMock).not.toHaveBeenCalled();

    await act(async () => { await result.current.handleGenerate(); });
    await act(async () => { result.current.confirmReview({ '[EMAIL_1]': '[PERSONA]' }); });
    expect(streamMock).toHaveBeenCalledTimes(1);
    expect(streamMock.mock.calls[0][2]).toBe('avisar a [PERSONA]');
    expect(streamMock.mock.calls[0][6]).toEqual({ '[PERSONA]': 'jorge@example.com' });
    expect(result.current.review).toBeNull();
  });

  it('openReview pasa por buildInput: lo que el tool capture ahi tambien se captura desde el badge', () => {
    const buildInput = vi.fn(() => 'avisar a jorge@example.com');
    const { result } = renderHook(() => useGenerator(config({ buildInput })), { wrapper });
    act(() => { result.current.openReview(); });
    expect(buildInput).toHaveBeenCalledTimes(1);
    expect(result.current.review).toEqual({ text: 'avisar a [EMAIL_1]', map: { '[EMAIL_1]': 'jorge@example.com' } });
  });

  it('confidential:false nunca abre review aunque haya PII y el flag este activo', async () => {
    localStorage.setItem('acgen_confidential_testcase', 'true');
    yields('ok');
    const { result } = renderHook(() => useGenerator(config({ confidential: false, buildInput: () => 'jorge@example.com' })), { wrapper });
    await act(async () => { await result.current.handleGenerate(); });
    expect(result.current.review).toBeNull();
    expect(streamMock).toHaveBeenCalledTimes(1);
  });

  it('clearGeneration a mitad de stream: onResult nunca se llama y status vuelve a idle', async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    streamMock.mockImplementation(async function* () {
      yield { token: 'a', done: false };
      await gate;
      yield { token: 'b', done: false };
      yield { token: '', done: true };
    });
    const onResult = vi.fn();
    const { result } = renderHook(() => useGenerator(config({ onResult })), { wrapper });
    let p!: Promise<void>;
    act(() => { p = result.current.handleGenerate(); });
    await act(async () => {});
    expect(result.current.status).toBe('loading');
    act(() => { result.current.clearGeneration(); });
    expect(result.current.status).toBe('idle');
    await act(async () => { release(); await p; });
    expect(onResult).not.toHaveBeenCalled();
    expect(result.current.status).toBe('idle');
  });

  it('Ctrl+Enter en window genera; sin canGenerate no', async () => {
    yields('ok');
    const { result, rerender } = renderHook((props: { can: boolean }) => useGenerator(config({ canGenerate: props.can })), { wrapper, initialProps: { can: false } });
    await act(async () => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true })); });
    expect(streamMock).not.toHaveBeenCalled();
    rerender({ can: true });
    await act(async () => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true })); });
    expect(streamMock).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe('success');
  });

  it('re-render con otro onResult tras montar: se llama el nuevo (la clase de bug H1)', async () => {
    yields('ok');
    const a = vi.fn();
    const b = vi.fn();
    const { result, rerender } = renderHook((props: { onResult: GeneratorConfig<string>['onResult'] }) => useGenerator(config({ onResult: props.onResult })), { wrapper, initialProps: { onResult: a } });
    rerender({ onResult: b });
    await act(async () => { await result.current.handleGenerate(); });
    expect(b).toHaveBeenCalledTimes(1);
    expect(a).not.toHaveBeenCalled();
  });
});
