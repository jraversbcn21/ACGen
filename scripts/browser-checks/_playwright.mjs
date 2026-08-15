// Playwright NO es dependencia del proyecto: estos scripts son una comprobacion
// manual opcional, no parte de `npm test`, y no merecen ~300MB de navegadores en
// el node_modules de todo el mundo. Se resuelve del global, con escape por env.
//
// Si falla: `npm i -g playwright && npx playwright install chromium`, o exporta
// PLAYWRIGHT_PATH apuntando al index.mjs de tu instalacion.
const candidatos = [
  process.env.PLAYWRIGHT_PATH,
  'playwright',
  'file:///C:/Program Files/nodejs/node_modules/playwright/index.mjs',
  '/usr/lib/node_modules/playwright/index.mjs',
].filter(Boolean);

let chromium = null;
const fallos = [];
for (const c of candidatos) {
  try {
    ({ chromium } = await import(c));
    break;
  } catch (e) {
    fallos.push(`  ${c}: ${e.code ?? e.message}`);
  }
}

if (!chromium) {
  console.error('No se pudo cargar Playwright. Intentado:\n' + fallos.join('\n'));
  console.error('\nInstala con: npm i -g playwright && npx playwright install chromium');
  console.error('O exporta PLAYWRIGHT_PATH=/ruta/a/playwright/index.mjs');
  process.exit(2);
}

export { chromium };

/** Primer argumento de linea de comandos, o el dev server por defecto. */
export const targetUrl = process.argv[2] ?? 'http://localhost:5173';

/** Ruta para capturas: al temporal del sistema, NUNCA al repo. Correr un script
 *  de verificacion no debe dejar PNG sueltos en el arbol de trabajo. */
export function shotPath(nombre) {
  return `${process.env.TEMP ?? process.env.TMPDIR ?? '/tmp'}/acgen-${nombre}.png`;
}
