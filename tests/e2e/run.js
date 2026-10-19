'use strict';
/*
 * End-to-end checks with Playwright (no test framework needed):
 *   node tests/e2e/run.js [--shots docs/screenshots] [--all-shots dir]
 *
 * - Screenshots every page at 390×844 and 1440×900.
 * - Asserts no horizontal scrolling and ≥44px tap targets on every page.
 * - Runs a full check-in with automated PVT responses (?pvt=fast), flips the cards,
 *   logs flow, then export → clear → import and verifies the data is restored.
 * - Interrupts a PVT run (visibilitychange) and checks the retest dialog.
 * - Keyboard-only pass with visible focus.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { seed } = require('./seed.js');

function loadPlaywright() {
  try { return require('playwright'); } catch (e) { /* fall through */ }
  const { execSync } = require('child_process');
  const globalRoot = execSync('npm root -g').toString().trim();
  return require(path.join(globalRoot, 'playwright'));
}
const { chromium } = loadPlaywright();

const ROOT = path.resolve(__dirname, '../..');
const args = process.argv.slice(2);
const argVal = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
const README_SHOTS = argVal('--shots');
const ALL_SHOTS = argVal('--all-shots');

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png'
};

function serve() {
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const file = path.join(ROOT, p);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

let failures = 0;
const results = [];
function check(name, ok, detail = '') {
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
  if (!ok) failures++;
}

const VIEWPORTS = { mobile: { width: 390, height: 844, isMobile: true, hasTouch: true }, desktop: { width: 1440, height: 900 } };

async function layoutChecks(page, label) {
  const res = await page.evaluate(() => {
    const doc = document.documentElement;
    const overflow = doc.scrollWidth - doc.clientWidth;
    const small = [];
    const sel = 'button, a[href], input:not([type="hidden"]), select, textarea, summary, [role="radio"], [role="tab"]';
    document.querySelectorAll(sel).forEach((el) => {
      if (el.closest('[hidden]') || el.closest('.is-hidden') || el.closest('dialog:not([open])')) return;
      if (el.classList.contains('inline-link')) return; // inline text links are exempt (WCAG 2.5.8)
      const r = el.getBoundingClientRect();
      const st = getComputedStyle(el);
      if (r.width === 0 || r.height === 0 || st.visibility === 'hidden' || st.display === 'none') return;
      if (el.type === 'file') return;
      if (r.width < 43.5 || r.height < 43.5) small.push(`${el.tagName.toLowerCase()}.${el.className || ''} "${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 20)}" ${Math.round(r.width)}×${Math.round(r.height)}`);
    });
    return { overflow, small };
  });
  check(`${label}: no horizontal scroll`, res.overflow <= 0, res.overflow > 0 ? `overflow ${res.overflow}px` : '');
  check(`${label}: tap targets ≥ 44px`, res.small.length === 0, res.small.slice(0, 5).join('; '));
}

async function shot(page, name, vp) {
  if (!ALL_SHOTS) return;
  fs.mkdirSync(ALL_SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(ALL_SHOTS, `${name}-${vp}.png`), fullPage: true });
}

async function settle(page, ms = 400) {
  await page.evaluate(() => document.fonts && document.fonts.ready);
  await page.waitForTimeout(ms);
}

async function newPage(browser, base, vp, { data = null, lang = 'zh-TW', reduced = false } = {}) {
  const ctx = await browser.newContext(Object.assign({}, VIEWPORTS[vp], {
    viewport: { width: VIEWPORTS[vp].width, height: VIEWPORTS[vp].height },
    reducedMotion: reduced ? 'reduce' : 'no-preference',
    acceptDownloads: true
  }));
  await ctx.addInitScript(([d, l]) => {
    if (!sessionStorage.getItem('__seeded')) {
      sessionStorage.setItem('__seeded', '1');
      if (d) localStorage.setItem('pfc.data', d); else localStorage.removeItem('pfc.data');
      localStorage.setItem('pfc.pref.lang', l);
    }
  }, [data ? JSON.stringify(data) : null, lang]);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g/.test(m.text())) errors.push(m.text()); });
  page.__errors = errors;
  return page;
}

async function pagesTour(browser, base, vp) {
  const data = seed(18);
  const page = await newPage(browser, base, vp, { data, reduced: true });
  const lastId = data.sessions[data.sessions.length - 1].id;
  const tour = [
    ['home', '#/'],
    ['check-1', '#/check/1'],
    ['check-2', null],
    ['check-3', null],
    ['result', `#/result/${lastId}`],
    ['flow', `#/flow/${lastId}`],
    ['history', '#/history'],
    ['insights', null],
    ['time', null],
    ['settings', '#/settings'],
    ['about', '#/about'],
    ['breathe', `#/breathe/${lastId}`]
  ];
  await page.goto(base + '/?nosw#/');
  for (const [name, hash] of tour) {
    if (name === 'check-1') {
      await page.evaluate(() => { location.hash = '#/check/1'; });
      await settle(page);
      await page.click('[data-group="kss"][data-value="3"]');
      await page.click('[data-group="energy"][data-value="7"]');
      await page.click('[data-group="tension"][data-value="4"]');
    } else if (name === 'check-2') {
      await page.click('[data-nav="next"]');
      await settle(page);
      await page.click('[data-stepper="sleepHours"] [data-dir="1"]');
      await page.fill('#f-wakeTime', '07:15');
      await page.click('.wearable summary');
    } else if (name === 'check-3') {
      await page.click('[data-nav="next"]');
    } else if (name === 'insights' || name === 'time') {
      await page.click(`[data-tab="${name === 'time' ? 'time' : 'insights'}"]`);
    } else {
      await page.evaluate((h) => { location.hash = h; }, hash);
    }
    await settle(page, name === 'result' ? 900 : 500);
    await layoutChecks(page, `${vp} ${name}`);
    await shot(page, name, vp);
  }
  // Timer page (needs a running timer).
  await page.evaluate((id) => { const d = window.__pfc.store.data; d.timer = { sessionId: id, startedAt: Date.now() - 600000, endsAt: Date.now() + 900000, minutes: 25 }; window.__pfc.store.save(); location.hash = '#/timer'; }, lastId);
  await settle(page, 700);
  await layoutChecks(page, `${vp} timer`);
  await shot(page, 'timer', vp);
  // Empty-state home.
  await page.evaluate(() => { window.__pfc.store.clear(); location.hash = '#/history'; });
  await settle(page);
  await page.evaluate(() => { location.hash = '#/'; });
  await settle(page);
  await layoutChecks(page, `${vp} home-empty`);
  await shot(page, 'home-empty', vp);
  check(`${vp} tour: no JS errors`, page.__errors.length === 0, page.__errors.slice(0, 3).join(' | '));
  await page.context().close();
}

async function englishTour(browser, base, vp) {
  const data = seed(18);
  const page = await newPage(browser, base, vp, { data, lang: 'en', reduced: true });
  const lastId = data.sessions[data.sessions.length - 1].id;
  for (const [name, hash] of [['home', '#/'], ['check-1', '#/check/1'], ['result', `#/result/${lastId}`], ['history', '#/history']]) {
    await page.goto(base + '/?nosw' + hash);
    await settle(page, 600);
    await layoutChecks(page, `${vp} en ${name}`);
    await shot(page, `en-${name}`, vp);
  }
  const lang = await page.evaluate(() => document.documentElement.lang);
  check(`${vp} en: html lang`, lang === 'en', lang);
  // Toggle back to Chinese via the top-right button.
  await page.click('.lang-btn');
  await settle(page, 200);
  const zh = await page.evaluate(() => document.documentElement.lang);
  check(`${vp} language toggle`, zh === 'zh-Hant-TW', zh);
  check(`${vp} en tour: no JS errors`, page.__errors.length === 0, page.__errors.slice(0, 3).join(' | '));
  await page.context().close();
}

async function fullFlow(browser, base, vp) {
  // Start with 5 prior sessions so the full (non-provisional) index is exercised on touch… and
  // on desktop, keyboard responses create a separate (provisional) baseline.
  const data = seed(6, { withFlow: false });
  const page = await newPage(browser, base, vp, { data });
  await page.goto(base + '/?nosw&pvt=fast#/');
  await settle(page);
  await page.click('[data-action="start"]');
  await settle(page, 300);
  // Next is blocked until all three are answered.
  await page.click('[data-nav="next"]', { force: true });
  check(`${vp} flow: step 1 requires answers`, (await page.evaluate(() => location.hash)) === '#/check/1');
  await page.click('[data-group="kss"][data-value="2"]');
  await page.click('[data-group="energy"][data-value="8"]');
  await page.click('[data-group="tension"][data-value="3"]');
  // Desktop: → goes to the next step (once focus is outside a radio group, where arrows pick values).
  if (vp === 'desktop') { await page.evaluate(() => document.activeElement.blur()); await page.keyboard.press('ArrowRight'); } else await page.click('[data-nav="next"]');
  await settle(page, 200);
  check(`${vp} flow: reached step 2`, (await page.evaluate(() => location.hash)) === '#/check/2');
  await page.fill('#f-sleepHours', '7.5');
  await page.fill('#f-wakeTime', '07:00');
  await page.click('[data-group="taskType"][data-value="deep"]');
  await page.click('[data-nav="next"]');
  await settle(page, 200);
  await page.click('#pvt-start');

  // Respond ~250–320 ms after each stimulus appears, until the run finishes.
  const useKeyboard = vp === 'desktop';
  const t0 = Date.now();
  let responses = 0;
  while (Date.now() - t0 < 40000) {
    const state = await page.evaluate(() => {
      const layer = document.querySelector('.pvt');
      if (!layer) return 'done';
      const st = layer.querySelector('.pvt-stimulus');
      return st && st.classList.contains('is-on') && !st.classList.contains('is-frozen') ? 'on' : 'wait';
    });
    if (state === 'done') break;
    if (state === 'on') {
      await page.waitForTimeout(220 + Math.random() * 80);
      if (useKeyboard) await page.keyboard.press('Space');
      else await page.tap('.pvt', { position: { x: 200, y: 600 } });
      responses++;
      await page.waitForTimeout(150);
    } else {
      await page.waitForTimeout(25);
    }
  }
  await page.waitForFunction(() => location.hash.startsWith('#/result/'), null, { timeout: 10000 });
  await settle(page, 1200);
  const saved = await page.evaluate(() => {
    const d = JSON.parse(localStorage.getItem('pfc.data'));
    return d.sessions[d.sessions.length - 1];
  });
  check(`${vp} flow: session saved`, !!saved && saved.valid === true, saved ? `n=${saved.pvt.summary.n}` : 'missing');
  check(`${vp} flow: PVT responses recorded`, saved && saved.pvt.summary.n >= 3 && saved.pvt.summary.n <= responses + 1, `responses=${responses}, n=${saved && saved.pvt.summary.n}`);
  check(`${vp} flow: RTs plausible`, saved && saved.pvt.trials.filter((t) => t.kind !== 'falseStart').every((t) => t.rtMs >= 150 && t.rtMs < 1500),
    saved ? saved.pvt.trials.map((t) => t.rtMs).join(',') : '');
  check(`${vp} flow: device recorded`, saved && saved.device === (useKeyboard ? 'keyboard' : 'touch'), saved && saved.device);
  check(`${vp} flow: context saved`, saved && saved.context.sleepHours === 7.5 && saved.context.taskType === 'deep' && saved.context.hoursAwake !== null);
  check(`${vp} flow: score present`, saved && typeof saved.score.index === 'number' && !!saved.score.archetype);
  check(`${vp} flow: provisional only without same-device baseline`, saved && saved.score.provisional === useKeyboard, `provisional=${saved && saved.score.provisional}`);
  await shot(page, 'flow-cards-down', vp);

  // Flip the cards in order (clicking card 3 first must not flip it).
  await page.click('.tcard[data-card="2"]', { force: true });
  check(`${vp} flow: cards flip in order`, !(await page.$eval('.tcard[data-card="2"]', (e) => e.classList.contains('is-flipped'))));
  for (let i = 0; i < 3; i++) { await page.click(`.tcard[data-card="${i}"]`); await page.waitForTimeout(1000); }
  const allFlipped = await page.$$eval('.tcard.is-flipped', (els) => els.length);
  check(`${vp} flow: three cards revealed`, allFlipped === 3);
  await settle(page, 700);
  await layoutChecks(page, `${vp} result-revealed`);
  await shot(page, 'flow-cards-up', vp);

  // Focus timer (test mode: minutes run as seconds) → flow log opens with duration pre-filled.
  await page.click('[data-action="timer-start"][data-min="25"]');
  await page.waitForFunction(() => location.hash.startsWith('#/flow/'), null, { timeout: 40000 });
  await settle(page, 300);
  const dur = await page.inputValue('#f-duration');
  check(`${vp} flow: timer pre-fills duration`, dur === '25', dur);
  await page.click('[data-group="rating"][data-value="8"]');
  await page.fill('#f-notes', '專注測試, "quoted"');
  await page.click('#flow-save');
  await settle(page, 400);
  const flow = await page.evaluate(() => { const d = JSON.parse(localStorage.getItem('pfc.data')); return d.sessions[d.sessions.length - 1].flow; });
  check(`${vp} flow: flow log saved`, flow && flow.rating === 8 && flow.durationMin === 25 && flow.taskType === 'deep', JSON.stringify(flow));

  // Export → clear → import.
  await page.evaluate(() => { location.hash = '#/settings'; });
  await settle(page, 300);
  const before = await page.evaluate(() => localStorage.getItem('pfc.data'));
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-action="export-json"]')]);
  const exportPath = await dl.path();
  const exported = fs.readFileSync(exportPath, 'utf8');
  check(`${vp} export: JSON matches storage`, JSON.stringify(JSON.parse(exported)) === JSON.stringify(JSON.parse(before)));
  const [csvDl] = await Promise.all([page.waitForEvent('download'), page.click('[data-action="export-csv"]')]);
  const csv = fs.readFileSync(await csvDl.path(), 'utf8');
  check(`${vp} export: CSV rows`, csv.trim().split('\r\n').length === JSON.parse(before).sessions.length + 1);

  await page.click('[data-action="clear-data"]');
  await page.click('#clear-go');
  await page.click('#clear-go'); // wrong (empty) word: must not delete
  const still = await page.evaluate(() => JSON.parse(localStorage.getItem('pfc.data')).sessions.length);
  check(`${vp} clear: needs typed confirmation`, still > 0);
  await page.fill('#clear-word', '刪除');
  await page.click('#clear-go');
  await settle(page, 200);
  const cleared = await page.evaluate(() => localStorage.getItem('pfc.data'));
  check(`${vp} clear: data removed`, !cleared || JSON.parse(cleared).sessions.length === 0);

  const fileChooser = page.waitForEvent('filechooser');
  await page.click('[data-action="import-json"]');
  await (await fileChooser).setFiles(exportPath);
  await page.waitForFunction(() => { const d = localStorage.getItem('pfc.data'); return d && JSON.parse(d).sessions.length > 0; });
  const after = await page.evaluate(() => localStorage.getItem('pfc.data'));
  check(`${vp} import: data restored`, JSON.stringify(JSON.parse(after).sessions) === JSON.stringify(JSON.parse(before).sessions));
  check(`${vp} full flow: no JS errors`, page.__errors.length === 0, page.__errors.slice(0, 3).join(' | '));
  await page.context().close();
}

async function interruptFlow(browser, base) {
  const page = await newPage(browser, base, 'mobile');
  await page.goto(base + '/?nosw&pvt=fast#/check/1');
  await settle(page, 200);
  for (const [g, v] of [['kss', 5], ['energy', 5], ['tension', 7]]) await page.click(`[data-group="${g}"][data-value="${v}"]`);
  await page.click('[data-nav="next"]');
  await page.click('[data-nav="next"]');
  await page.click('#pvt-start');
  await page.waitForFunction(() => document.querySelector('.pvt') && document.querySelector('.pvt').dataset.state === 'running', null, { timeout: 8000 });
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForSelector('.pvt-dialog');
  check('interrupt: retest dialog shown', true);
  await shot(page, 'pvt-interrupted', 'mobile');
  await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true }); });
  await page.click('[data-int="skip"]');
  await page.waitForFunction(() => location.hash.startsWith('#/result/'), null, { timeout: 5000 });
  const s = await page.evaluate(() => { const d = JSON.parse(localStorage.getItem('pfc.data')); return d.sessions[d.sessions.length - 1]; });
  check('interrupt: saved as invalid + provisional', s.valid === false && s.invalidReason === 'interrupted' && s.score.provisional === true);
  check('interrupt: no JS errors', page.__errors.length === 0, page.__errors.join(' | '));
  await page.context().close();
}

async function pvtStimulusShot(browser, base) {
  for (const vp of ['mobile', 'desktop']) {
    const page = await newPage(browser, base, vp);
    await page.goto(base + '/?nosw&pvt=fast#/check/1');
    await settle(page, 200);
    for (const [g, v] of [['kss', 3], ['energy', 7], ['tension', 3]]) await page.click(`[data-group="${g}"][data-value="${v}"]`);
    await page.click('[data-nav="next"]');
    await page.click('[data-nav="next"]');
    await page.click('#pvt-start');
    await page.waitForSelector('.pvt-stimulus.is-on', { timeout: 12000 });
    await page.waitForTimeout(260);
    await shot(page, 'pvt-stimulus', vp);
    await page.context().close();
  }
}

async function keyboardPass(browser, base) {
  const page = await newPage(browser, base, 'desktop', { data: seed(3) });
  await page.goto(base + '/?nosw#/');
  await settle(page, 300);
  // Tab to the primary button and check that focus is visible.
  let found = false;
  for (let i = 0; i < 12 && !found; i++) {
    await page.keyboard.press('Tab');
    found = await page.evaluate(() => document.activeElement && document.activeElement.dataset.action === 'start');
  }
  check('keyboard: primary action reachable by Tab', found);
  const outline = await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle);
  check('keyboard: visible focus style', outline !== 'none', outline);
  await page.keyboard.press('Enter');
  await settle(page, 300);
  // Radios: Tab into the KSS group and use arrow keys.
  await page.focus('[data-group="kss"][tabindex="0"]');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  const kss = await page.evaluate(() => window.__pfc.app.draft.subjective.kss);
  check('keyboard: arrow keys select radio', kss === 3, String(kss));
  check('keyboard pass: no JS errors', page.__errors.length === 0, page.__errors.join(' | '));
  await page.context().close();
}

async function readmeShots(browser, base) {
  if (!README_SHOTS) return;
  fs.mkdirSync(README_SHOTS, { recursive: true });
  const data = seed(18);
  const lastId = data.sessions[data.sessions.length - 1].id;
  const grab = async (vp, hash, file, opts = {}) => {
    const page = await newPage(browser, base, vp, { data, reduced: true, lang: opts.lang || 'zh-TW' });
    await page.goto(base + '/?nosw' + hash);
    await settle(page, 900);
    if (opts.before) await opts.before(page);
    await page.screenshot({ path: path.join(README_SHOTS, file), fullPage: !!opts.full });
    await page.context().close();
  };
  await grab('mobile', '#/', 'mobile-home.png');
  await grab('mobile', `#/result/${lastId}`, 'mobile-result.png');
  await grab('mobile', '#/check/1', 'mobile-step1.png');
  await grab('desktop', `#/result/${lastId}`, 'desktop-result.png');
  await grab('desktop', '#/history', 'desktop-history.png', { lang: 'en' });
}

(async () => {
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch();
  try {
    for (const vp of ['mobile', 'desktop']) {
      await pagesTour(browser, base, vp);
      await englishTour(browser, base, vp);
      await fullFlow(browser, base, vp);
    }
    await interruptFlow(browser, base);
    await pvtStimulusShot(browser, base);
    await keyboardPass(browser, base);
    await readmeShots(browser, base);
  } catch (e) {
    check('e2e run completed', false, e.stack);
  } finally {
    await browser.close();
    server.close();
  }
  console.log(results.join('\n'));
  console.log(`\n${results.length - failures} passed, ${failures} failed`);
  process.exit(failures ? 1 : 0);
})();
