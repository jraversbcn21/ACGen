// Actividad reciente: ticket flexible con elipsis en su limite, y columnas
// de estado/fecha/squad alineadas verticalmente entre filas.
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
  const sprints = [{
    id: 's1', name: 'Discovery BSK 26-Q3-S15', startDate: '2026-08-18', endDate: null, archived: false,
    tabGrid: {
      resolved: [
        ['BSKWEB-5551 [VUE] Aplicar nuevos tags CMS para guia de compra', '01/09/2026', 'Alta', 'Jorge', 'Discovery'],
        ['BSKAND-5023 [AND] Al cambiar de mercado queda informacion o formato del pais anterior y ademas mucho mas texto para forzar la elipsis', '31/08/2026', 'Media', 'Jorge', 'Core'],
        ['BSKWEB-5821 corto', '31/08/2026', 'Alta', 'Jorge', 'Catalog'],
      ],
      created: [['BSKAND-5209 [AND] No carga la app al instalar version en primera instancia', '31/08/2026', 'Alta', 'Jorge', 'Discovery']],
      reopened: [], highPriority: [], jsd: [],
    },
  }];
  localStorage.setItem('acgen_sprints', JSON.stringify(sprints));
  localStorage.setItem('acgen_lang', JSON.stringify('es'));
});
await page.reload({ waitUntil: 'networkidle' });
await page.getByText('Sprint Tracker', { exact: true }).click();
await page.waitForSelector('.sp-act-row');

// Geometria de todas las filas: x de cada celda.
const geo = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.sp-act-row')];
  return rows.map((row) => [...row.children].map((c) => ({
    x: Math.round(c.getBoundingClientRect().x),
    w: Math.round(c.getBoundingClientRect().width),
    clipped: c.scrollWidth > c.clientWidth,
    text: c.textContent.slice(0, 30),
  })));
});

// 1. Cada columna empieza en la misma x en TODAS las filas.
for (let col = 0; col < 4; col++) {
  const xs = [...new Set(geo.map((r) => r[col].x))];
  check(`1.${col} columna ${col} alineada entre ${geo.length} filas`, xs.length === 1, `x: ${xs.join(', ')}`);
}

// 2. El ticket kilometrico hace elipsis; el corto y los medianos se leen enteros.
const tickets = geo.map((r) => r[0]);
const largo = tickets.find((t) => t.text.startsWith('BSKAND-5023'));
const corto = tickets.find((t) => t.text.startsWith('BSKWEB-5821'));
const medio = tickets.find((t) => t.text.startsWith('BSKWEB-5551'));
check('2a. Ticket kilometrico recortado con elipsis', largo?.clipped === true);
check('2b. Ticket corto entero', corto?.clipped === false);
check('2c. Ticket mediano entero', medio?.clipped === false, JSON.stringify(medio));

// 3. Sin scroll horizontal en el panel.
check('3. Sin overflow horizontal', await page.evaluate(() => {
  const p = document.querySelector('.sp-act-row').closest('.sp-panel') ?? document.querySelector('.sp-act-row').parentElement;
  return p.scrollWidth <= p.clientWidth;
}));

await page.screenshot({ path: shotPath('sprint-activity-align'), fullPage: true });
console.log('captura:', shotPath('sprint-activity-align'));
console.log('\n=== OK ===');
ok.forEach((o) => console.log('  ✓', o));
if (fail.length) { console.log('\n=== FALLOS ==='); fail.forEach((f) => console.log('  ✗', f)); }
console.log('\nerrores de consola:', errors.length ? errors : 'ninguno');
console.log(`\nRESULTADO: ${ok.length} ok / ${fail.length} fallos`);
await browser.close();
process.exit(fail.length ? 1 : 0);
