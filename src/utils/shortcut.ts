/**
 * Etiqueta del atajo de generar. El handler de cada tool acepta Ctrl **y** Cmd
 * (`e.ctrlKey || e.metaKey`), asi que la etiqueta es lo unico que depende de la
 * plataforma: las cuatro pantallas que lo mostraban tenian el simbolo de Mac
 * escrito a mano, y en Windows —donde se usa la app— era sencillamente falso.
 *
 * `navigator.platform` esta deprecado y `userAgentData` no existe en Firefox ni
 * Safari, asi que se mira el userAgent, que sigue estando en todos.
 */
export function generateShortcutLabel(ua: string = navigator.userAgent): string {
  return /Mac|iPhone|iPad|iPod/.test(ua) ? '⌘⏎' : 'Ctrl+Enter';
}

/**
 * Etiqueta del atajo que enfoca el buscador de la portada. Mismo criterio:
 * el handler acepta Ctrl y Cmd, la etiqueta se adapta a la plataforma.
 */
export function paletteShortcutLabel(ua: string = navigator.userAgent): string {
  return /Mac|iPhone|iPad|iPod/.test(ua) ? '⌘K' : 'Ctrl K';
}
