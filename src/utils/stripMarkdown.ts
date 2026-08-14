/**
 * Quita la sintaxis de markdown dejando el texto legible en plano.
 *
 * `USER_STORY_PROMPT` pide literalmente `**Como**` / `**Quiero**` / `**Para**`,
 * y el modelo ademas anade cabeceras y enfasis por su cuenta; como la salida se
 * pinta en un div de texto plano, esos simbolos se veian crudos.
 *
 * Las vinetas (`- `, `* `) se conservan: ya se leen bien tal cual y quitarlas
 * destruiria la estructura de la evaluacion INVEST.
 */

/** Prefijo de vineta al principio de la linea, con su sangria. */
const VINETA = /^(\s*[-*+]\s+)/;
/** Cabecera ATX: hasta seis almohadillas y el espacio que las separa del texto. */
const CABECERA = /^\s*#{1,6}\s+/;

function limpiarInline(texto: string): string {
  return texto
    // Negritas primero: si no, la regla de cursiva partiria `**x**` por la mitad.
    .replace(/\*\*([^\n]+?)\*\*/g, '$1')
    .replace(/__([^\n]+?)__/g, '$1')
    // Cursiva: exige un caracter no-espacio tras el asterisco, para no tocar ni
    // las vinetas (`* item`) ni las multiplicaciones (`2 * 3`).
    .replace(/\*([^\s*][^*\n]*?)\*/g, '$1')
    .replace(/`([^`\n]+)`/g, '$1');
}

export function stripMarkdown(texto: string): string {
  return texto
    .split('\n')
    .map((linea) => {
      const sinCabecera = linea.replace(CABECERA, '');
      const vineta = sinCabecera.match(VINETA);
      return vineta
        ? vineta[1] + limpiarInline(sinCabecera.slice(vineta[1].length))
        : limpiarInline(sinCabecera);
    })
    .join('\n');
}
