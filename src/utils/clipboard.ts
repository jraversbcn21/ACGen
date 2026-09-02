/**
 * Copia al portapapeles con fallback a execCommand: navigator.clipboard no
 * existe en origenes no seguros y rechaza sin foco o sin permiso. Sacado de
 * EdgeCaseTool; los demas tools llevan copias locales del mismo bloque.
 */
export async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }
}
