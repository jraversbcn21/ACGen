/**
 * Quita la sintaxis de markdown dejando el texto legible en plano.
 *
 * `USER_STORY_PROMPT` pide literalmente `**Como**` / `**Quiero**` / `**Para**`,
 * y el modelo ademas anade cabeceras, reglas horizontales y a veces una tabla
 * para la evaluacion INVEST; como la salida se pinta en un div de texto plano,
 * todo eso se veia crudo.
 *
 * Las vinetas (`- `, `* `) se conservan: ya se leen bien tal cual y quitarlas
 * destruiria la estructura de la evaluacion INVEST.
 */

/** Prefijo de vineta al principio de la linea, con su sangria. */
const VINETA = /^(\s*[-*+]\s+)/;
/** Cabecera ATX: hasta seis almohadillas y el espacio que las separa del texto. */
const CABECERA = /^\s*#{1,6}\s+/;
/** Regla horizontal: tres o mas guiones, asteriscos o guiones bajos y nada mas. */
const REGLA = /^\s*([-*_])\1{2,}\s*$/;
/** Fila de tabla: solo si abre y cierra con barra, para no pillar frases con `|`. */
const FILA_TABLA = /^\s*\|.*\|\s*$/;
/** Fila separadora de tabla: solo barras, guiones, dos puntos y espacios. */
const SEPARADOR_TABLA = /^[\s|:-]+$/;

function limpiarInline(texto: string): string {
  return texto
    // Negritas primero: si no, la regla de cursiva partiria `**x**` por la mitad.
    .replace(/\*\*([^\n]+?)\*\*/g, '$1')
    .replace(/__([^\n]+?)__/g, '$1')
    // Cursiva: exige un caracter no-espacio tras el asterisco, para no tocar ni
    // las vinetas (`* item`) ni las multiplicaciones (`2 * 3`); y que el par no
    // vaya pegado a letras o puntos, para no comerse globs como `*.jpg y *.png`.
    .replace(/(?<![\w.])\*([^\s*][^*\n]*?)\*(?![\w.])/g, '$1')
    .replace(/`([^`\n]+)`/g, '$1');
}

/** `| a | b |` -> `a | b`, conservando la barra como separador de columnas. */
function limpiarFilaTabla(linea: string): string {
  return linea
    .trim()
    .replace(/^\||\|$/g, '')
    .split('|')
    .map((celda) => limpiarInline(celda.trim()))
    .join(' | ');
}

export function stripMarkdown(texto: string): string {
  return texto
    .split('\n')
    .map((linea): string | null => {
      if (REGLA.test(linea)) return null;
      if (FILA_TABLA.test(linea)) {
        return SEPARADOR_TABLA.test(linea) ? null : limpiarFilaTabla(linea);
      }
      const sinCabecera = linea.replace(CABECERA, '');
      const vineta = sinCabecera.match(VINETA);
      return vineta
        ? vineta[1] + limpiarInline(sinCabecera.slice(vineta[1].length))
        : limpiarInline(sinCabecera);
    })
    .filter((linea): linea is string => linea !== null)
    .join('\n');
}
