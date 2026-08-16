import { useState, useCallback, useRef } from 'react';

interface StreamingState {
  text: string;
  isStreaming: boolean;
  error: string | null;
}

export function useStreamingResponse() {
  const [state, setState] = useState<StreamingState>({ text: '', isStreaming: false, error: null });
  // Numero de generacion: reset() lo invalida. Sin esto, un stream en curso
  // sobrevive al "Limpiar" del usuario: seguiria escribiendo estado y al acabar
  // dispararia onComplete, resucitando y persistiendo el texto descartado.
  const genRef = useRef(0);

  const stream = useCallback(async (
    generator: AsyncGenerator<{ token: string; done: boolean }>,
    onComplete?: (fullText: string) => void
  ) => {
    const gen = ++genRef.current;
    setState({ text: '', isStreaming: true, error: null });
    let full = '';
    try {
      for await (const { token, done } of generator) {
        // El return corta el for-await, que a su vez cierra el generador
        // (ejecuta sus finally); no se aborta el fetch subyacente, solo se
        // deja de leer — suficiente para que nada vuelva a tocar el estado.
        if (genRef.current !== gen) return;
        if (done) break;
        full += token;
        setState(s => ({ ...s, text: full }));
      }
      if (genRef.current !== gen) return;
      setState(s => ({ ...s, isStreaming: false }));
      onComplete?.(full);
    } catch (err: unknown) {
      // Un fallo de una generacion ya descartada no es un error del usuario.
      if (genRef.current !== gen) return;
      const message = err instanceof Error ? err.message : 'Error inesperado';
      setState({ text: full, isStreaming: false, error: message });
      throw err;
    }
  }, []);

  const reset = useCallback(() => {
    genRef.current++;
    setState({ text: '', isStreaming: false, error: null });
  }, []);

  return { ...state, stream, reset };
}
