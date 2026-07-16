import { useState, useCallback } from 'react';

interface StreamingState {
  text: string;
  isStreaming: boolean;
  error: string | null;
}

export function useStreamingResponse() {
  const [state, setState] = useState<StreamingState>({ text: '', isStreaming: false, error: null });

  const stream = useCallback(async (
    generator: AsyncGenerator<{ token: string; done: boolean }>,
    onComplete?: (fullText: string) => void
  ) => {
    setState({ text: '', isStreaming: true, error: null });
    let full = '';
    try {
      for await (const { token, done } of generator) {
        if (done) break;
        full += token;
        setState(s => ({ ...s, text: full }));
      }
      setState(s => ({ ...s, isStreaming: false }));
      onComplete?.(full);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error inesperado';
      setState({ text: full, isStreaming: false, error: message });
    }
  }, []);

  const reset = useCallback(() => {
    setState({ text: '', isStreaming: false, error: null });
  }, []);

  return { ...state, stream, reset };
}
