// Verificacion manual de la Fase 5 en navegador real.
import { chromium, targetUrl } from './_playwright.mjs';

const URL = targetUrl;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));

const ok = [];
const fail = [];
const check = (nombre, cond, detalle = '') => (cond ? ok : fail).push(`${nombre}${detalle ? ` — ${detalle}` : ''}`);

async function cabeceras() {
  return (await page.locator('thead tr:nth-child(2) th').allTextContents()).slice(1);
}
// Playwright no tiene getByDisplayValue (eso es Testing Library): busca dentro
// del modal el input cuyo valor actual coincide, y devuelve su indice.
async function inputPorValor(valor) {
  const inputs = page.locator('.modal-content input[type="text"]');
  const n = await inputs.count();
  for (let i = 0; i < n; i++) {
    if ((await inputs.nth(i).inputValue()) === valor) return inputs.nth(i);
  }
  throw new Error(`no hay input con valor "${valor}" en el modal`);
}

// La fila del editor (SchemaEntryRow) es el div que contiene el input de
// nombre y su label con el checkbox: el PADRE directo del input, no el abuelo.
// Con '../..' se sube al contenedor de columnas y `.first()` acaba marcando la
// primera columna de la pestana en vez de la que se pide.
async function checkboxDeFila(valor) {
  const input = await inputPorValor(valor);
  return input.locator('xpath=..').getByRole('checkbox').first();
}

async function abrirSprint() {
  await page.getByText('Sprint Tracker', { exact: true }).click();
  const nuevo = page.getByRole('button', { name: /Nuevo Sprint/i });
  if (await nuevo.isVisible().catch(() => false)) {
    await nuevo.click();
    await page.getByPlaceholder('Sprint 25').fill('Sprint de prueba');
    await page.getByRole('button', { name: /^Crear$/ }).click();
  }
  await page.getByText('Sprint de prueba', { exact: true }).click();
  await page.waitForSelector('table');
}

await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.removeItem('acgen_schema'));
await page.reload({ waitUntil: 'networkidle' });
await abrirSprint();

// 1. GUARDIAN: sin esquema guardado, todo igual que antes de la fase.
const base = await cabeceras();
check('1. Guardian sin acgen_schema',
  JSON.stringify(base) === JSON.stringify(['Ticket', 'Fecha', 'Prioridad', 'Autor', 'Squad', '']),
  base.join(' | '));

// Escribe datos reales en la fila 0 para poder seguirlos.
for (const [col, val] of [[0, 'ACG-1'], [1, '2026-08-01'], [2, 'Alta'], [3, 'jorge'], [4, 'QA']]) {
  await page.locator(`input[data-row="0"][data-col="${col}"]`).fill(val);
}

// 2. Ajusta a mano el ancho de la ultima columna (Squad, indice de datos 4).
const th = page.locator('thead tr:first-child th').nth(5);
const box = await th.boundingBox();
await page.mouse.move(box.x + box.width - 2, box.y + box.height / 2);
await page.mouse.down();
await page.mouse.move(box.x + box.width + 120, box.y + box.height / 2, { steps: 10 });
await page.mouse.up();
const anchoAntes = await page.evaluate(() =>
  JSON.parse(localStorage.getItem(Object.keys(localStorage).find((k) => k.includes('sprint_col_widths'))) || '{}'));
check('2. Ancho guardado por indice de datos', Boolean(anchoAntes['resolved-4']),
  JSON.stringify(anchoAntes));

// 3. Abre el editor, renombra Squad -> Equipo.
await page.getByRole('button', { name: 'Pestañas y columnas' }).click();
await page.waitForSelector('.modal-content');
const squad = await inputPorValor('Squad');
await squad.fill('Equipo');
await squad.blur();
await page.waitForTimeout(200);

// 4. Oculta "Prioridad" (columna intermedia, indice de datos 2).
await (await checkboxDeFila('Prioridad')).check();
await page.waitForTimeout(200);
await page.getByRole('button', { name: 'Cerrar' }).click();
await page.waitForTimeout(300);

const trasOcultar = await cabeceras();
check('3. Renombrar Squad -> Equipo', trasOcultar.includes('Equipo'), trasOcultar.join(' | '));
check('4. Prioridad oculta desaparece', !trasOcultar.includes('Prioridad'), trasOcultar.join(' | '));

// 5. La invariante: el ancho sigue ligado a la columna de datos 4, no desplazado.
const anchoDespues = await page.evaluate(() =>
  JSON.parse(localStorage.getItem(Object.keys(localStorage).find((k) => k.includes('sprint_col_widths'))) || '{}'));
check('5. El ancho NO se desplazo al ocultar',
  anchoAntes['resolved-4'] === anchoDespues['resolved-4'],
  `antes ${anchoAntes['resolved-4']} / despues ${anchoDespues['resolved-4']}`);

// 6. Los datos no se desplazaron: Squad/Equipo sigue mostrando 'QA' en data-col 4.
const valorEquipo = await page.locator('input[data-row="0"][data-col="4"]').inputValue();
check('6. Los datos NO se desplazaron', valorEquipo === 'QA', `data-col=4 vale "${valorEquipo}"`);

// 7. El dato de la columna oculta sigue guardado.
const guardado = await page.evaluate(() => JSON.parse(localStorage.getItem('acgen_sprints'))[0].tabGrid.resolved[0]);
check('7. El dato oculto sigue en localStorage', guardado[2] === 'Alta', JSON.stringify(guardado));

// 8. Las letras de columna saltan la oculta (A, B, D, E), como una hoja de calculo.
const letras = (await page.locator('thead tr:first-child th').allTextContents()).slice(1);
check('8. Letras por indice de datos (salta la C)',
  letras[0] === 'A' && letras[1] === 'B' && letras[2] === 'D', letras.join(''));

// 9. La busqueda SIGUE encontrando por la columna oculta (decision de Jorge).
await page.getByPlaceholder(/Buscar/i).fill('Alta');
await page.waitForTimeout(600);
const filasVisibles = await page.locator('tbody tr').count();
check('9. La busqueda encuentra por columna oculta', filasVisibles === 1, `${filasVisibles} filas`);
await page.getByPlaceholder(/Buscar/i).fill('');
await page.waitForTimeout(400);

// 10. Volver a mostrar Prioridad devuelve el dato.
await page.getByRole('button', { name: 'Pestañas y columnas' }).click();
await page.waitForSelector('.modal-content');
await (await checkboxDeFila('Prioridad')).uncheck();
await page.waitForTimeout(200);
await page.getByRole('button', { name: 'Cerrar' }).click();
await page.waitForTimeout(300);
const restaurado = await page.locator('input[data-row="0"][data-col="2"]').inputValue();
check('10. Mostrar de nuevo devuelve el dato', restaurado === 'Alta', `vale "${restaurado}"`);

// 11. JSD sigue pintando sus 6 columnas de datos.
await page.getByRole('button', { name: 'JSD', exact: true }).click();
await page.waitForTimeout(300);
const jsdInputs = await page.locator('tbody tr:first-child input').count();
check('11. JSD conserva sus 6 columnas de datos', jsdInputs === 6, `${jsdInputs} celdas`);
await page.getByRole('button', { name: 'Resueltos', exact: true }).click();
await page.waitForTimeout(200);

// 12. Anadir una pestana nueva y navegar a ella.
await page.getByRole('button', { name: 'Pestañas y columnas' }).click();
await page.waitForSelector('.modal-content');
await page.getByPlaceholder(/Nombre de la pestaña nueva/i).fill('Bloqueados');
await page.getByRole('button', { name: 'Añadir pestaña' }).click();
await page.waitForTimeout(200);
await page.getByRole('button', { name: 'Cerrar' }).click();
await page.waitForTimeout(300);
const hayPestana = await page.getByRole('button', { name: 'Bloqueados', exact: true }).isVisible();
await page.getByRole('button', { name: 'Bloqueados', exact: true }).click();
await page.waitForTimeout(300);
await page.locator('input[data-row="0"][data-col="0"]').fill('BLOQ-1');
await page.waitForTimeout(300);
check('12. Pestana nueva navegable y editable', hayPestana);

// 13. Persistencia tras recarga.
await page.reload({ waitUntil: 'networkidle' });
await page.getByText('Sprint de prueba', { exact: true }).click();
await page.waitForSelector('table');
await page.getByRole('button', { name: 'Bloqueados', exact: true }).click();
await page.waitForTimeout(300);
const trasRecarga = await page.locator('input[data-row="0"][data-col="0"]').inputValue();
check('13. Persiste tras recargar', trasRecarga === 'BLOQ-1', `vale "${trasRecarga}"`);

await page.getByRole('button', { name: 'Resueltos', exact: true }).click();
await page.waitForTimeout(300);
await page.screenshot({ path: 'fase5-final.png', fullPage: false });
await page.getByRole('button', { name: 'Pestañas y columnas' }).click();
await page.waitForSelector('.modal-content');
await page.screenshot({ path: 'fase5-editor.png', fullPage: false });

console.log('\n=== OK ===');
ok.forEach((o) => console.log('  ✓', o));
if (fail.length) {
  console.log('\n=== FALLOS ===');
  fail.forEach((f) => console.log('  ✗', f));
}
console.log('\nerrores de consola:', errors.length ? errors : 'ninguno');
console.log(`\nRESULTADO: ${ok.length} ok / ${fail.length} fallos`);

await browser.close();
process.exit(fail.length ? 1 : 0);
