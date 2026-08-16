// PR B: dos bugs del pipeline de streaming, en Chromium real con SSE de verdad
// (fetch interceptado en la pagina: el codigo de la app corre sin tocar, solo la
// red es falsa — Playwright route.fulfill no puede trocear la respuesta y aqui
// el troceo temporal es justo lo que se prueba).
// 1) Un evento {error} sobre HTTP 200 (asi reporta OpenRouter creditos agotados
//    o errores del upstream) se tragaba en silencio: exito falso con texto
//    truncado, guardado en historial.
// 2) Limpiar a mitad de generacion no cancelaba el stream: al completar,
//    onComplete resucitaba el texto descartado y lo persistia.
import { chromium, targetUrl } from './_playwright.mjs';

const URL = targetUrl;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));

const ok = [], fail = [];
const check = (n, c, d = '') => (c ? ok : fail).push(`${n}${d ? ` — ${d}` : ''}`);

// El modo se lee de sessionStorage para sobrevivir a los reload.
await page.addInitScript(() => {
  const realFetch = window.fetch.bind(window);
  window.fetch = (url, opts) => {
    if (!String(url).includes('/chat/completions')) return realFetch(url, opts);
    const mode = sessionStorage.getItem('sse_mode');
    const enc = new TextEncoder();
    const stream = new ReadableStream({
      async start(c) {
        const send = (o) => c.enqueue(enc.encode(`data: ${JSON.stringify(o)}\n`));
        const wait = (ms) => new Promise((r) => setTimeout(r, ms));
        if (mode === 'error-event') {
          send({ model: 'm', choices: [{ delta: { content: 'Texto parcial ' } }] });
          await wait(100);
          send({ error: { code: 402, message: 'Insufficient credits (browser-check)' } });
        } else {
          send({ model: 'm', choices: [{ delta: { content: 'CA1: primer criterio ' } }] });
          await wait(2500);
          send({ model: 'm', choices: [{ delta: { content: 'CA2: segundo criterio' } }] });
        }
        c.enqueue(enc.encode('data: [DONE]\n'));
        c.close();
      },
    });
    return Promise.resolve(new Response(stream, { status: 200, headers: { 'Content-Type': 'text/event-stream' } }));
  };
});

await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate(() => {
  localStorage.clear();
  localStorage.setItem('acgen_lang', JSON.stringify('es'));
  localStorage.setItem('acgen_key_groq', JSON.stringify('test-key'));
});

// ---- Parte 1: el evento {error} debe aflorar como error, no como exito ----
await page.evaluate(() => sessionStorage.setItem('sse_mode', 'error-event'));
// Reload: la key se sembro con setItem directo y useLocalStorage solo relee al montar.
await page.goto(`${URL}/#/acceptance`, { waitUntil: 'networkidle' });
await page.reload({ waitUntil: 'networkidle' });
await page.getByPlaceholder(/Describe la funcionalidad/).fill('Login con SSO');
await page.getByRole('button', { name: 'Generar', exact: true }).click();
await page.waitForTimeout(1500);

const bodyText = await page.locator('body').innerText();
check('1. El error del proveedor aflora en la UI', bodyText.includes('Insufficient credits (browser-check)'));
const hist1 = await page.evaluate(() => JSON.parse(localStorage.getItem('acgen_criteria_history') ?? '[]'));
check('2. El texto truncado NO se guarda en historial', hist1.length === 0, `${hist1.length} entradas`);

// ---- Parte 2: Limpiar a mitad de stream debe quedarse limpio ----
await page.evaluate(() => sessionStorage.setItem('sse_mode', 'slow'));
await page.reload({ waitUntil: 'networkidle' });
await page.getByPlaceholder(/Describe la funcionalidad/).fill('Login con SSO');
await page.getByRole('button', { name: 'Generar', exact: true }).click();
// Espera al primer token pintado y limpia con el stream aun vivo.
await page.getByText('CA1: primer criterio').waitFor({ timeout: 2000 });
await page.getByRole('button', { name: 'Limpiar', exact: true }).click();
await page.waitForTimeout(200);
const outputVacio = await page.getByPlaceholder(/criterios de aceptacion apareceran/).inputValue().catch(() => null);
check('3. Tras Limpiar, la salida queda vacia', outputVacio === '', String(outputVacio));

// Deja terminar la generacion subyacente: nada debe resucitar.
await page.waitForTimeout(3500);
const outputFinal = await page.locator('textarea').nth(2).inputValue();
check('4. El texto descartado NO resucita al completar el stream', !outputFinal.includes('CA2'), outputFinal || '(vacio)');
const hist2 = await page.evaluate(() => JSON.parse(localStorage.getItem('acgen_criteria_history') ?? '[]'));
check('5. Nada se persiste en historial tras el Limpiar', hist2.length === 0, `${hist2.length} entradas`);

console.log('\n=== OK ===');
ok.forEach((o) => console.log('  ✓', o));
if (fail.length) { console.log('\n=== FALLOS ==='); fail.forEach((f) => console.log('  ✗', f)); }
console.log('\nerrores de consola:', errors.length ? errors : 'ninguno');
console.log(`\nRESULTADO: ${ok.length} ok / ${fail.length} fallos`);
await browser.close();
process.exit(fail.length ? 1 : 0);
