import { renderHook, act } from '@testing-library/react';
import { vi } from 'vitest';
import { useStreamingResponse } from './useStreamingResponse';

async function* okGenerator() {
  yield { token: 'Hola ', done: false };
  yield { token: 'mundo', done: false };
  yield { token: '', done: true };
}

async function* failingGenerator() {
  yield { token: 'parcial ', done: false };
  throw new Error('rate limit');
}

describe('useStreamingResponse', () => {
  it('accumulates tokens and calls onComplete with the full text', async () => {
    const { result } = renderHook(() => useStreamingResponse());
    const onComplete = vi.fn();

    await act(async () => {
      await result.current.stream(okGenerator(), onComplete);
    });

    expect(result.current.text).toBe('Hola mundo');
    expect(result.current.isStreaming).toBe(false);
    expect(result.current.error).toBeNull();
    expect(onComplete).toHaveBeenCalledWith('Hola mundo');
  });

  it('rethrows a mid-stream error so the caller catch block fires', async () => {
    const { result } = renderHook(() => useStreamingResponse());
    let caught: unknown = null;

    await act(async () => {
      try {
        await result.current.stream(failingGenerator());
      } catch (err) {
        caught = err;
      }
    });

    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toBe('rate limit');
  });

  it('keeps the partial text and clears isStreaming after a mid-stream error', async () => {
    const { result } = renderHook(() => useStreamingResponse());

    await act(async () => {
      try {
        await result.current.stream(failingGenerator());
      } catch {
        // the caller handles it; this test asserts the hook state
      }
    });

    expect(result.current.text).toBe('parcial ');
    expect(result.current.isStreaming).toBe(false);
    expect(result.current.error).toBe('rate limit');
  });

  it('does not call onComplete when the stream fails', async () => {
    const { result } = renderHook(() => useStreamingResponse());
    const onComplete = vi.fn();

    await act(async () => {
      try {
        await result.current.stream(failingGenerator(), onComplete);
      } catch {
        // expected
      }
    });

    expect(onComplete).not.toHaveBeenCalled();
  });
});
