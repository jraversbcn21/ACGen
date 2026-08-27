// Archivado = solo lectura, con vuelta atras.
import { chromium, targetUrl } from './_playwright.mjs';

const URL = targetUrl;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));
page.on('dialog', (d) => d.accept());

const ok = [], fail = [];
const check = (n, c, d = '') => (c ? ok : fail).push(`${n}${d ? ` — ${d}` : ''}`);

// El rediseño de la lista separa seleccionar (item lateral) de abrir (hero):
// clicar el nombre ya no navega, hay que pasar por "Abrir tablero".
const openBoard = async (name) => {
  await page.locator('.sp-item-name', { hasText: name }).first().click();
  await page.getByRole('button', { name: /Abrir tablero|Open board/ }).click();
};

await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });
await page.getByText('Sprint Tracker', { exact: true }).click();
await page.getByRole('button', { name: /Nuevo Sprint/i }).click();
await page.getByPlaceholder('Sprint 25').fill('Sprint de prueba');
await page.getByRole('button', { name: /^Crear$/ }).click();

// Escribe un dato y vuelve a la lista.
await openBoard('Sprint de prueba');
await page.waitForSelector('table');
await page.locator('input[data-row="0"][data-col="0"]').fill('ACG-1');
await page.waitForTimeout(300);
await page.getByRole('button', { name: /Volver|Back/ }).click();
await page.waitForTimeout(300);

// Archiva.
await page.getByRole('button', { name: 'Archivar' }).click();
await page.waitForTimeout(400);
check('1. Aparece el boton Desarchivar', await page.getByRole('button', { name: 'Desarchivar' }).isVisible());

// Entra al archivado: debe ser de solo lectura.
await openBoard('Sprint de prueba');
await page.waitForSelector('table');
const celda = page.locator('input[data-row="0"][data-col="0"]');
check('2. El dato sigue ahi', (await celda.inputValue()) === 'ACG-1');
check('3. Las celdas son readOnly', await celda.evaluate((el) => el.readOnly));
check('4. No hay boton "+ Fila"', !(await page.getByRole('button', { name: /^\+ (Fila|Row)$/ }).isVisible().catch(() => false)));
check('5. No hay editor de esquema en archivados',
  !(await page.getByRole('button', { name: 'Pestañas y columnas' }).isVisible().catch(() => false)));

// Intenta escribir de verdad: no debe cambiar nada.
await celda.click();
await page.keyboard.type('XXX');
await page.waitForTimeout(200);
check('6. Escribir no altera el dato', (await celda.inputValue()) === 'ACG-1', await celda.inputValue());

// Vuelve y desarchiva.
await page.getByRole('button', { name: /Volver|Back/ }).click();
await page.waitForTimeout(300);
await page.getByRole('button', { name: 'Desarchivar' }).click();
await page.waitForTimeout(400);
check('7. Vuelve a Activo', await page.getByRole('button', { name: 'Archivar' }).isVisible());

const sprint = await page.evaluate(() => JSON.parse(localStorage.getItem('acgen_sprints'))[0]);
check('8. archived=false y endDate limpia', sprint.archived === false && sprint.endDate === null,
  `archived=${sprint.archived} endDate=${sprint.endDate}`);
check('9. El grid sobrevivio al ciclo', sprint.tabGrid.resolved[0][0] === 'ACG-1', sprint.tabGrid.resolved[0][0]);

// Y vuelve a ser editable.
await openBoard('Sprint de prueba');
await page.waitForSelector('table');
check('10. Editable otra vez', !(await page.locator('input[data-row="0"][data-col="0"]').evaluate((el) => el.readOnly)));

console.log('\n=== OK ===');
ok.forEach((o) => console.log('  ✓', o));
if (fail.length) { console.log('\n=== FALLOS ==='); fail.forEach((f) => console.log('  ✗', f)); }
console.log('\nerrores de consola:', errors.length ? errors : 'ninguno');
console.log(`\nRESULTADO: ${ok.length} ok / ${fail.length} fallos`);
await browser.close();
process.exit(fail.length ? 1 : 0);
