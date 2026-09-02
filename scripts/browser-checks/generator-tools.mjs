// PR #60 (useGenerator): la pasada "manual" de los 9 tools de generacion contra
// la app real, con el modelo simulado en la pagina (fetch interceptado: SSE
// troceado con 1,5 s de retardo entre el primer token y el resto). Por tool:
//  1 generar (clic) -> resultado
//  2 regenerar con Ctrl+Enter -> el resultado viejo desaparece ANTES del 2o token
//    y, donde hay vista de stream, el stream se ve (el C1 que cazo la review final:
//    8/9 tools habian perdido el vaciado del resultado al arrancar)
//  3 Limpiar a mitad de stream -> nada resucita
//  4 modo confidencial con renombrado [EMAIL_1] -> [PERSONA]: la red recibe
//    [PERSONA] y no el email; el resultado vuelve deanonimizado
// Uso: node generator-tools.mjs [url] [view]  (view opcional: solo ese tool)
import { chromium, targetUrl, shotPath } from './_playwright.mjs';

const URL = targetUrl;
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
const PII = 'Contactar a jorge@example.com por el checkout';

const TOOLS = [
  { view: 'acceptance', name: 'Criterios', input: (p) => p.getByPlaceholder(/Describe la funcionalidad o el flujo/), streams: true, conf: true,
    payload: { first: 'STREAM-{{n}} ', rest: 'MARK{{n}} {{echo}}' } },
  { view: 'testcase', name: 'Casos de Prueba', input: (p) => p.getByPlaceholder(/Describe la funcionalidad a probar/), streams: false, conf: true,
    payload: { first: '[', rest: '{"key":"MARK{{n}}","summary":"{{echo}}","priority":"Alta","type":"Positivo","preconditions":"P","testSteps":["paso"],"expectedResult":"R"}]' } },
  { view: 'bugreport', name: 'Bug Report', input: (p) => p.locator('#br-description'), streams: true, conf: true,
    payload: { first: 'STREAM-{{n}} ', rest: 'MARK{{n}} {{echo}}' } },
  { view: 'testdata', name: 'Datos de Prueba', input: (p) => p.locator('#td-context'), streams: false, conf: true,
    payload: { first: '[', rest: '{"nombre":"MARK{{n}}","contexto":"{{echo}}"}]' } },
  { view: 'userstory', name: 'Historia de Usuario', pre: async (p) => { await p.getByRole('tab', { name: /texto libre/i }).click(); }, input: (p) => p.getByPlaceholder(/Como usuario/), streams: true, conf: true,
    payload: { first: 'STREAM-{{n}} ', rest: 'MARK{{n}} {{echo}}' } },
  { view: 'refiner', name: 'Refinador', input: (p) => p.locator('textarea').first(), streams: true, conf: true,
    payload: { first: 'STREAM-{{n}} ', rest: 'MARK{{n}} {{echo}}' } },
  { view: 'edgecase', name: 'Casos Limite', input: (p) => p.locator('textarea').first(), streams: false, conf: true,
    payload: { first: '[', rest: '{"categoria":"Concurrencia","escenario":"MARK{{n}}","resultadoEsperado":"{{echo}}"}]' } },
  { view: 'converter', name: 'Conversor', input: (p) => p.locator('textarea').first(), streams: true, conf: true,
    payload: { first: 'STREAM-{{n}} ', rest: 'MARK{{n}} {{echo}}' } },
  { view: 'designvalidator', name: 'Validador', input: (p) => p.locator('textarea').first(), streams: false, conf: false, image: true,
    payload: { first: '{', rest: '"carencias":[{"flujo":"MARK{{n}}","descripcion":"d"}],"contradicciones":[],"sugerencias":[]}' } },
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));
const ok = [], fail = [];
const check = (n, c, d = '') => (c ? ok : fail).push(`${n}${d ? ` — ${d}` : ''}`);

await page.addInitScript(() => {
  const realFetch = window.fetch.bind(window);
  window.fetch = (url, opts) => {
    if (!String(url).includes('/chat/completions')) return realFetch(url, opts);
    const n = Number(sessionStorage.getItem('sse_n') ?? '0') + 1;
    sessionStorage.setItem('sse_n', String(n));
    const payload = JSON.parse(sessionStorage.getItem('sse_payload'));
    let user = '';
    try {
      const body = JSON.parse(opts.body);
      const c = body.messages[1].content;
      user = typeof c === 'string' ? c : c.filter((p) => p.type === 'text').map((p) => p.text).join(' ');
    } catch { /* ignore */ }
    const sent = JSON.parse(sessionStorage.getItem('sse_sent') ?? '[]');
    sent.push(user);
    sessionStorage.setItem('sse_sent', JSON.stringify(sent));
    const flat = user.replace(/[\n"\\]/g, ' ');
    const echo = flat.length > 160 ? `${flat.slice(0, 80)} ${flat.slice(-80)}` : flat;
    const fill = (s) => s.replaceAll('{{n}}', String(n)).replaceAll('{{echo}}', echo);
    const enc = new TextEncoder();
    const stream = new ReadableStream({
      async start(ctl) {
        const send = (t) => ctl.enqueue(enc.encode(`data: ${JSON.stringify({ model: 'm', choices: [{ delta: { content: t } }] })}\n`));
        send(fill(payload.first));
        await new Promise((r) => setTimeout(r, 1500));
        send(fill(payload.rest));
        ctl.enqueue(enc.encode('data: [DONE]\n'));
        ctl.close();
      },
    });
    return Promise.resolve(new Response(stream, { status: 200, headers: { 'Content-Type': 'text/event-stream' } }));
  };
});

const visible = (text) => page.evaluate((t) => document.body.innerText.includes(t) || [...document.querySelectorAll('textarea')].some((ta) => ta.value.includes(t)), text);
const generar = () => page.getByRole('button', { name: 'Generar', exact: true }).click();
const limpiar = () => page.getByRole('button', { name: 'Limpiar', exact: true }).click();

await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate(() => {
  localStorage.clear();
  localStorage.setItem('acgen_lang', JSON.stringify('es'));
  localStorage.setItem('acgen_key_groq', JSON.stringify('test-key'));
  localStorage.setItem('acgen_key_openrouter', JSON.stringify('test-key'));
});

const only = process.argv[3];
for (const t of TOOLS.filter((x) => !only || x.view === only)) {
  const tag = `[${t.name}]`;
  await page.evaluate(({ view, payload, img }) => {
    sessionStorage.setItem('sse_n', '0');
    sessionStorage.setItem('sse_sent', '[]');
    sessionStorage.setItem('sse_payload', JSON.stringify(payload));
    localStorage.setItem(`acgen_confidential_${view}`, JSON.stringify(false));
    localStorage.setItem('acgen_provider', JSON.stringify(img ? 'openrouter' : 'groq'));
    localStorage.setItem('acgen_model', JSON.stringify(img ? 'google/gemini-2.5-flash' : 'openai/gpt-oss-120b'));
  }, { view: t.view, payload: t.payload, img: !!t.image });
  await page.goto(`${URL}/#/${t.view}`, { waitUntil: 'networkidle' });
  await page.reload({ waitUntil: 'networkidle' });
  const setup = async (text) => {
    if (t.pre) await t.pre(page);
    await t.input(page).fill(text);
    if (t.image) {
      await page.locator('input[type="file"]').setInputFiles({ name: 'd.png', mimeType: 'image/png', buffer: PNG });
      await page.getByText('d.png').waitFor({ timeout: 3000 });
    }
  };

  try {
    // 1. Generar
    await setup('Login con SSO');
    await generar();
    await page.waitForFunction((m) => document.body.innerText.includes(m) || [...document.querySelectorAll('textarea')].some((ta) => ta.value.includes(m)), 'MARK1', { timeout: 6000 });
    check(`${tag} 1. generar pinta el resultado`, true);

    // 2. Regenerar con Ctrl+Enter: el viejo desaparece antes del 2o token; stream visible
    await t.input(page).focus();
    await page.keyboard.press('Control+Enter');
    await page.waitForTimeout(500);
    const oldGone = !(await visible('MARK1'));
    check(`${tag} 2a. Ctrl+Enter regenera y el resultado anterior desaparece antes del 2o token`, oldGone);
    if (t.streams) check(`${tag} 2b. el stream de la 2a generacion se ve en vivo`, await visible('STREAM-2'));
    await page.waitForFunction((m) => document.body.innerText.includes(m) || [...document.querySelectorAll('textarea')].some((ta) => ta.value.includes(m)), 'MARK2', { timeout: 6000 });
    check(`${tag} 2c. la 2a generacion termina y se pinta`, true);

    // 3. Limpiar a mitad de stream
    if (t.image) { /* el Limpiar del Validador tambien quita la imagen; se vuelve a subir en el paso 4 no aplica */ }
    await generar();
    await page.waitForTimeout(400);
    await limpiar();
    await page.waitForTimeout(2300);
    check(`${tag} 3. Limpiar a mitad de stream: nada resucita`, !(await visible('MARK3')));

    // 4. Confidencial con renombrado
    if (t.conf) {
      await page.evaluate((v) => localStorage.setItem(`acgen_confidential_${v}`, JSON.stringify(true)), t.view);
      await page.reload({ waitUntil: 'networkidle' });
      await setup(PII);
      await generar();
      const dialog = page.getByRole('dialog');
      await dialog.waitFor({ timeout: 3000 });
      const box = dialog.getByRole('textbox').first();
      await box.fill('[PERSONA]');
      await dialog.getByRole('button', { name: /confirmar y enviar/i }).click();
      await page.waitForFunction((m) => document.body.innerText.includes(m) || [...document.querySelectorAll('textarea')].some((ta) => ta.value.includes(m)), 'MARK4', { timeout: 6000 });
      const sent = await page.evaluate(() => JSON.parse(sessionStorage.getItem('sse_sent') ?? '[]'));
      const last = sent[sent.length - 1] ?? '';
      check(`${tag} 4a. la red recibe [PERSONA] y no el email`, last.includes('[PERSONA]') && !last.includes('jorge@example.com'), last.slice(0, 60));
      check(`${tag} 4b. el resultado vuelve deanonimizado (email restaurado)`, await visible('jorge@example.com'));
    }
  } catch (e) {
    fail.push(`${tag} EXCEPCION: ${String(e).split('\n')[0]}`);
    await page.screenshot({ path: shotPath(`generator-${t.view}`) }).catch(() => {});
  }
}

console.log('\n=== OK ===');
ok.forEach((o) => console.log('  ✓', o));
if (fail.length) { console.log('\n=== FALLOS ==='); fail.forEach((f) => console.log('  ✗', f)); }
console.log('\nerrores de consola:', errors.length ? errors : 'ninguno');
console.log(`\nRESULTADO: ${ok.length} ok / ${fail.length} fallos`);
await browser.close();
process.exit(fail.length ? 1 : 0);
