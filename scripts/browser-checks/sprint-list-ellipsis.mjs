// Verifica el fix de elipsis: ticket completo en Actividad reciente y
// nombres completos en Todos los sprints, con acciones superpuestas.
import { chromium, targetUrl, shotPath } from './_playwright.mjs';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1718, height: 1321 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));

const ok = [], fail = [];
const check = (n, c, d = '') => (c ? ok : fail).push(`${n}${d ? ` — ${d}` : ''}`);

await page.goto(targetUrl, { waitUntil: 'networkidle' });
await page.evaluate(() => {
  localStorage.clear();
  const grid = (rows) => rows;
  const sprints = [
    {
      id: 's1', name: 'Discovery BSK 26-Q3-S15', startDate: '2026-08-18', endDate: null, archived: false,
      tabGrid: {
        resolved: grid([
          ['BSKWEB-5551 [VUELOS] checkout roto', '01/09/2026', 'Alta', 'Jorge', 'Discovery'],
          ['BSKAND-5023 [ANDROID] login', '31/08/2026', 'Media', 'Jorge', 'Core'],
          ['BSKWEB-5821 [WEB] catalogo', '31/08/2026', 'Alta', 'Jorge', 'Catalog'],
        ]),
        created: grid([['BSKAND-5209 [ANDROID] carrito duplicado', '31/08/2026', 'Alta', 'Jorge', 'Discovery']]),
        reopened: [], highPriority: [], jsd: [],
      },
    },
    { id: 's2', name: 'Discovery BSK 26-Q3-S14 cierre de temporada', startDate: '2026-08-04', endDate: '2026-08-18', archived: true, tabGrid: { resolved: [] } },
    { id: 's3', name: 'Catalog BSK 26-Q2-S13 regresion completa', startDate: '2026-07-27', endDate: '2026-08-10', archived: true, tabGrid: { resolved: [] } },
  ];
  localStorage.setItem('acgen_sprints', JSON.stringify(sprints));
  localStorage.setItem('acgen_lang', JSON.stringify('es'));
});
await page.reload({ waitUntil: 'networkidle' });
await page.getByText('Sprint Tracker', { exact: true }).click();
await page.waitForSelector('.sp-act-row');

const noClip = (el) => el.scrollWidth <= el.clientWidth;

// 1. Tickets de Actividad reciente sin recortar.
const tickets = page.locator('.sp-act-ticket');
const n = await tickets.count();
let clipped = 0;
for (let i = 0; i < n; i++) if (!(await tickets.nth(i).evaluate(noClip))) clipped++;
check(`1. ${n} tickets de actividad, ninguno recortado`, n > 0 && clipped === 0, `${clipped} recortados`);

// 2. El texto largo del ticket se lee entero en el DOM visible.
const first = await tickets.first().innerText();
check('2. Primer ticket completo', first.includes('checkout roto'), first);

// 3. Nombres de la lista lateral sin recortar (activos y archivados).
const names = page.locator('.sp-item-name');
const nn = await names.count();
let nClipped = 0;
for (let i = 0; i < nn; i++) if (!(await names.nth(i).evaluate(noClip))) nClipped++;
check(`3. ${nn} nombres de sprint, ninguno recortado`, nn === 3 && nClipped === 0, `${nClipped} recortados`);

// 4. Las acciones no ocupan sitio: el nombre llega hasta el borde del item.
const archivedItem = page.locator('.sp-item', { hasText: 'S14 cierre' });
check('4. Acciones invisibles no clicables en reposo',
  await archivedItem.locator('.sp-item-actions').evaluate((el) => getComputedStyle(el).pointerEvents === 'none'));

// 5. Al hacer hover aparecen superpuestas y clicables.
await archivedItem.hover();
await page.waitForTimeout(250);
const actions = archivedItem.locator('.sp-item-actions');
check('5. Acciones visibles y clicables en hover',
  await actions.evaluate((el) => {
    const s = getComputedStyle(el);
    return s.opacity === '1' && s.pointerEvents === 'auto' && s.position === 'absolute';
  }));
check('6. Desarchivar clicable en hover', await archivedItem.getByRole('button', { name: 'Desarchivar' }).isVisible());

await page.screenshot({ path: shotPath('sprint-ellipsis'), fullPage: true });
console.log('captura:', shotPath('sprint-ellipsis'));

console.log('\n=== OK ===');
ok.forEach((o) => console.log('  ✓', o));
if (fail.length) { console.log('\n=== FALLOS ==='); fail.forEach((f) => console.log('  ✗', f)); }
console.log('\nerrores de consola:', errors.length ? errors : 'ninguno');
console.log(`\nRESULTADO: ${ok.length} ok / ${fail.length} fallos`);
await browser.close();
process.exit(fail.length ? 1 : 0);
