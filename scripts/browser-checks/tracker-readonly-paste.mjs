// PR A: dos vias de corrupcion de datos que jsdom no puede ver.
// 1) El evento paste SI dispara sobre un input readonly en Chromium real
//    (readonly solo bloquea la insercion por defecto): antes del fix, pegar una
//    URL de Jira sobre una celda de un sprint archivado la sobreescribia.
// 2) El confirm de borrar fila de ticket ignoraba el contenido de columnas
//    ocultas: una fila "aparentemente vacia" se borraba sin preguntar.
import { chromium, targetUrl } from './_playwright.mjs';

const URL = targetUrl;
const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  permissions: ['clipboard-read', 'clipboard-write'],
});
const errors = [];
// El rediseño de la lista separa seleccionar (item lateral) de abrir (hero):
// clicar el nombre ya no navega, hay que pasar por "Abrir tablero".
const openBoard = async (name) => {
  await page.locator('.sp-item-name', { hasText: name }).first().click();
  await page.getByRole('button', { name: /Abrir tablero|Open board/ }).click();
};
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));
// Parte 1 acepta los confirm (Archivar pregunta); la parte 2 los cancela a proposito.
let dialogAction = 'accept';
let dialogMsg = null;
page.on('dialog', (d) => { dialogMsg = d.message(); void d[dialogAction](); });

const ok = [], fail = [];
const check = (n, c, d = '') => (c ? ok : fail).push(`${n}${d ? ` — ${d}` : ''}`);

const JIRA_PASTE = 'Mi ticket - https://jira.example.com/browse/ABC-999';
const pegar = async (locator) => {
  await page.evaluate((txt) => navigator.clipboard.writeText(txt), JIRA_PASTE);
  await locator.click();
  await page.keyboard.press('Control+v');
  await page.waitForTimeout(300);
};

// ---- Parte 1: paste sobre sprint archivado ----
await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });
await page.getByText('Sprint Tracker', { exact: true }).click();
await page.getByRole('button', { name: /Nuevo Sprint/i }).click();
await page.getByPlaceholder('Sprint 25').fill('Sprint paste');
await page.getByRole('button', { name: /^Crear$/ }).click();
await openBoard('Sprint paste');
await page.waitForSelector('table');

// Control positivo: en un sprint ACTIVO el paste transforma la celda. Sin esto,
// un "no cambio nada" en el archivado podria significar que el paste nunca disparo.
const celda = page.locator('input[data-row="0"][data-col="0"]');
await pegar(celda);
check('1. Control: pegar en sprint activo escribe "ABC-999 Mi ticket"',
  (await celda.inputValue()) === 'ABC-999 Mi ticket', await celda.inputValue());

// Deja un dato conocido y archiva.
await celda.fill('ACG-1');
await page.waitForTimeout(300);
await page.getByRole('button', { name: /Volver|Back/ }).click();
await page.waitForTimeout(300);
await page.getByRole('button', { name: 'Archivar' }).click();
await page.waitForTimeout(400);

// El mismo paste sobre el sprint archivado no debe tocar nada.
await openBoard('Sprint paste');
await page.waitForSelector('table');
const celdaRO = page.locator('input[data-row="0"][data-col="0"]');
check('2. La celda archivada es readOnly', await celdaRO.evaluate((el) => el.readOnly));
await pegar(celdaRO);
check('3. Pegar sobre el archivado NO altera la celda',
  (await celdaRO.inputValue()) === 'ACG-1', await celdaRO.inputValue());
const guardado = await page.evaluate(() => JSON.parse(localStorage.getItem('acgen_sprints'))[0].tabGrid.resolved[0][0]);
check('4. localStorage sigue intacto', guardado === 'ACG-1', guardado);

// ---- Parte 2: confirm de borrado con contenido solo en columna oculta ----
await page.evaluate(() => {
  const schema = JSON.parse(JSON.stringify({
    version: 1,
    regression: {
      ticketFields: [
        { id: 'ticket', labelKey: 'regression.colTicket' },
        { id: 'fecha', labelKey: 'regression.colFecha' },
        { id: 'prioridad', labelKey: 'regression.colPrioridad' },
        { id: 'creador', labelKey: 'regression.colCreador' },
        { id: 'squad', labelKey: 'regression.colSquad', hidden: true },
        { id: 'status', labelKey: 'regression.colStatus' },
      ],
      platforms: [
        { id: 'apps', label: 'APPS' },
        { id: 'web', label: 'WEB' },
      ],
    },
    sprint: JSON.parse(localStorage.getItem('acgen_schema') ?? '{}').sprint ?? undefined,
  }));
  localStorage.setItem('acgen_schema', JSON.stringify(schema));
  localStorage.setItem('acgen_regressions', JSON.stringify({
    regressions: {
      apps: [{
        id: 'reg-1', version: '9.9.9', url: '', fecha: '2026-08-16',
        tickets: [{ id: 't1', ticket: '', fecha: '', prioridad: '', creador: '', squad: 'Squad Pagos', status: '' }],
      }],
      web: [],
    },
    archived: [],
  }));
});
// Navegacion por hash: la vista activa sigue siendo el Sprint Tracker y el
// landing (con su tarjeta "Regression Tracker") ya no esta en pantalla.
await page.goto(`${URL}/#/regressiontracker`, { waitUntil: 'networkidle' });
await page.reload({ waitUntil: 'networkidle' });
// Rediseño 11b: el detalle de la version seleccionada (la primera por defecto)
// muestra su tabla siempre desplegada — ya no existe el toggle de tickets.
await page.waitForSelector('.rg-detail table');

dialogAction = 'dismiss';
dialogMsg = null;
await page.getByLabel('Eliminar').click();
await page.waitForTimeout(300);
check('5. Borrar la fila con contenido oculto pide confirm',
  dialogMsg === '¿Eliminar esta fila de ticket?', String(dialogMsg));
const tickets = await page.evaluate(() => JSON.parse(localStorage.getItem('acgen_regressions')).regressions.apps[0].tickets);
check('6. Al cancelar, la fila (y su dato oculto) sobrevive',
  tickets.length === 1 && tickets[0].squad === 'Squad Pagos', JSON.stringify(tickets));

console.log('\n=== OK ===');
ok.forEach((o) => console.log('  ✓', o));
if (fail.length) { console.log('\n=== FALLOS ==='); fail.forEach((f) => console.log('  ✗', f)); }
console.log('\nerrores de consola:', errors.length ? errors : 'ninguno');
console.log(`\nRESULTADO: ${ok.length} ok / ${fail.length} fallos`);
await browser.close();
process.exit(fail.length ? 1 : 0);
