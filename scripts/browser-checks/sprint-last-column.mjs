// El caso que la verificacion original NO cubria: ocultar la ULTIMA columna
// nombrada de una pestana, sobre un grid fisicamente mas ancho que sus
// cabeceras. Antes de la fix wave la columna seguia pintandose sin rotulo.
import { chromium, targetUrl } from './_playwright.mjs';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));

const ok = [], fail = [];
const check = (n, c, d = '') => (c ? ok : fail).push(`${n}${d ? ` — ${d}` : ''}`);

// El rediseño de la lista separa seleccionar (item lateral) de abrir (hero).
const openBoard = async (name) => {
  await page.locator(".sp-item-name", { hasText: name }).first().click();
  await page.getByRole("button", { name: /Abrir tablero|Open board/ }).click();
};

async function inputPorValor(valor) {
  const inputs = page.locator('.modal-content input[type="text"]');
  for (let i = 0; i < await inputs.count(); i++) {
    if ((await inputs.nth(i).inputValue()) === valor) return inputs.nth(i);
  }
  throw new Error(`sin input "${valor}"`);
}
const checkboxDeFila = async (v) => (await inputPorValor(v)).locator('xpath=..').getByRole('checkbox').first();

await page.goto(targetUrl, { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.removeItem('acgen_schema'));
await page.reload({ waitUntil: 'networkidle' });
await page.getByText('Sprint Tracker', { exact: true }).click();
await page.getByRole('button', { name: /Nuevo Sprint/i }).click();
await page.getByPlaceholder('Sprint 25').fill('Sprint de prueba');
await page.getByRole('button', { name: /^Crear$/ }).click();
await openBoard('Sprint de prueba');
await page.waitForSelector('table');

// Escribe en Squad (indice de datos 4, la ULTIMA nombrada) y en la columna 5,
// que no tiene cabecera y debe seguir pintandose pase lo que pase.
await page.locator('input[data-row="0"][data-col="4"]').fill('SECRETO');
await page.locator('input[data-row="0"][data-col="5"]').fill('SIN-CABECERA');

// Oculta Squad: la ultima columna NOMBRADA de la pestana Resueltos.
await page.getByRole('button', { name: 'Pestañas y columnas' }).click();
await page.waitForSelector('.modal-content');
await (await checkboxDeFila('Squad')).check();
await page.waitForTimeout(200);
await page.getByRole('button', { name: 'Cerrar' }).click();
await page.waitForTimeout(400);

const valores = await page.locator('tbody tr:first-child input').evaluateAll(
  (els) => els.map((e) => ({ col: e.getAttribute('data-col'), val: e.value })));

check('A. El valor de la columna oculta YA NO se pinta',
  !valores.some((v) => v.val === 'SECRETO'), JSON.stringify(valores));
check('B. La columna de datos sin cabecera SIGUE pintandose',
  valores.some((v) => v.val === 'SIN-CABECERA'), JSON.stringify(valores));
check('C. El dato oculto sigue guardado en localStorage',
  (await page.evaluate(() => JSON.parse(localStorage.getItem('acgen_sprints'))[0].tabGrid.resolved[0]))[4] === 'SECRETO');

// Y en JSD: ocultar Motivo, la ultima de 3 cabeceras sobre 6 columnas de datos.
await page.getByRole('button', { name: 'JSD', exact: true }).click();
await page.waitForTimeout(300);
await page.locator('input[data-row="0"][data-col="2"]').fill('MOTIVO-JSD');
await page.getByRole('button', { name: 'Pestañas y columnas' }).click();
await page.waitForSelector('.modal-content');
const inputs = page.locator('.modal-content input[type="text"]');
let ultimoMotivo = null;
for (let i = 0; i < await inputs.count(); i++) {
  if ((await inputs.nth(i).inputValue()) === 'Motivo') ultimoMotivo = inputs.nth(i);
}
await ultimoMotivo.locator('xpath=..').getByRole('checkbox').first().check();
await page.waitForTimeout(200);
await page.getByRole('button', { name: 'Cerrar' }).click();
await page.waitForTimeout(400);
const jsd = await page.locator('tbody tr:first-child input').evaluateAll(
  (els) => els.map((e) => e.value));
check('D. JSD: ocultar la ultima de 3 cabeceras la oculta',
  !jsd.includes('MOTIVO-JSD'), JSON.stringify(jsd));

console.log('\n=== OK ===');
ok.forEach((o) => console.log('  ✓', o));
if (fail.length) { console.log('\n=== FALLOS ==='); fail.forEach((f) => console.log('  ✗', f)); }
console.log('\nerrores de consola:', errors.length ? errors : 'ninguno');
console.log(`\nRESULTADO: ${ok.length} ok / ${fail.length} fallos`);
await browser.close();
process.exit(fail.length ? 1 : 0);
