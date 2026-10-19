'use strict';
/*
 * End-to-end checks with Playwright (no test framework needed):
 *   node tests/e2e/run.js [--shots docs/screenshots] [--all-shots dir]
 *
 * - Visits every screen at 390×844 and 1440×900 (both languages for the key ones) and asserts
 *   no horizontal scrolling and ≥44px tap targets.
 * - Runs the full guided check with automated PVT responses (?pvt=fast), deals and flips the
 *   cards, runs the focus timer with an idea dropped in the jar, logs flow, then
 *   export → clear → import and verifies the data is restored.
 * - Interrupts a PVT run (visibilitychange) and checks the retest dialog.
 * - Keyboard-only pass (Tab, Enter, number keys, arrows) with visible focus.
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
const DRAFT = { subjective: { kss: 3, energy: 7, tension: 3 }, context: { sleepHours: 7.5, wakeTime: '', caffeineCups: null, lastCaffeineTime: '', hrv: null, restingHr: null, deviceReadiness: null, taskType: 'deep' } };

async function layoutChecks(page, label) {
  const res = await page.evaluate(() => {
    const doc = document.documentElement;
    const overflow = doc.scrollWidth - doc.clientWidth;
    const small = [];
    const sel = 'button, a[href], input:not([type="hidden"]), select, textarea, summary, [role="radio"], [role="tab"]';
    document.querySelectorAll(sel).forEach((el) => {
      if (el.closest('[hidden]') || el.closest('.is-hidden') || el.closest('dialog:not([open])') || el.closest('details:not([open]) > :not(summary)')) return;
      if (el.classList.contains('inline-link')) return; // inline text links are exempt (WCAG 2.5.8)
      const r = el.getBoundingClientRect();
      const st = getComputedStyle(el);
      if (r.width === 0 || r.height === 0 || st.visibility === 'hidden' || st.display === 'none') return;
      if (el.type === 'file') return;
      if (r.width < 43.5 || r.height < 43.5) small.push(`${el.tagName.toLowerCase()}.${(el.className && el.className.baseVal === undefined ? el.className : '') || ''} "${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 20)}" ${Math.round(r.width)}×${Math.round(r.height)}`);
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

async function newPage(browser, vp, { data = null, lang = 'zh-TW', reduced = false } = {}) {
  const ctx = await browser.newContext(Object.assign({}, VIEWPORTS[vp], {
    viewport: { width: VIEWPORTS[vp].width, height: VIEWPORTS[vp].height },
    reducedMotion: reduced ? 'reduce' : 'no-preference',
    acceptDownloads: true
  }));
  if (data) data.settings = Object.assign({}, data.settings, { onboarded: true });
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

const hashOf = (page) => page.evaluate(() => location.hash);
const setDraft = (page) => page.evaluate((d) => { window.__pfc.app.draft = JSON.parse(JSON.stringify(d)); }, DRAFT);
const goHash = (page, h) => page.evaluate((x) => { location.hash = x; }, h);

async function pagesTour(browser, base, vp, lang) {
  const data = seed(18);
  const last = data.sessions[data.sessions.length - 1];
  last.ideas = [{ text: lang === 'en' ? 'reply to Ken' : '回信給 Ken', at: last.createdAt }];
  const page = await newPage(browser, vp, { data, reduced: true, lang });
  const tag = `${vp} ${lang}`;
  await page.goto(base + '/?nosw#/');
  const visit = async (name, hash, before) => {
    if (before) await before();
    if (hash) await goHash(page, hash);
    await settle(page, 450);
    await layoutChecks(page, `${tag} ${name}`);
    await shot(page, `${lang}-${name}`, vp);
  };
  await visit('home', '#/');
  await visit('check-kss', null, async () => { await setDraft(page); await goHash(page, '#/check/kss'); });
  await visit('check-energy', '#/check/energy');
  await visit('check-tension', '#/check/tension');
  await visit('check-context', '#/check/context', async () => { await goHash(page, '#/check/context'); await settle(page, 200); await page.click('.more summary'); });
  await visit('check-pvt', '#/check/pvt');
  await visit('result', `#/result/${last.id}`);
  await visit('result-details', null, async () => { await page.click('.details summary'); });
  await visit('breathe', `#/breathe/${last.id}`);
  await visit('flow', `#/flow/${last.id}`);
  await visit('history', '#/history');
  await visit('insights', null, async () => { await page.click('[data-tab="insights"]'); });
  await visit('time', null, async () => { await page.click('[data-tab="time"]'); });
  await visit('settings', '#/settings');
  await visit('about', '#/about');
  await visit('timer', null, async () => {
    await page.evaluate((id) => { const d = window.__pfc.store.data; d.timer = { sessionId: id, startedAt: Date.now() - 600000, endsAt: Date.now() + 900000, minutes: 25, ideas: [{ text: 'x', at: '' }] }; window.__pfc.store.save(); location.hash = '#/timer'; }, last.id);
  });
  await visit('jar', null, async () => { await page.click('[data-action="jar"]'); });
  await page.keyboard.press('Escape');
  await visit('welcome', '#/welcome');
  check(`${tag} tour: no JS errors`, page.__errors.length === 0, page.__errors.slice(0, 3).join(' | '));
  await page.context().close();
}

async function onboarding(browser, base) {
  const page = await newPage(browser, 'mobile');
  await page.goto(base + '/?nosw#/');
  await settle(page, 400);
  check('onboarding: first launch shows the intro', (await hashOf(page)) === '#/welcome');
  for (let i = 0; i < 2; i++) { await page.click('[data-action="welcome-next"]'); await settle(page, 500); }
  check('onboarding: third slide shows the card fan', !!(await page.$('.mini-fan')));
  await page.click('[data-action="welcome-next"]');
  await page.waitForFunction(() => location.hash === '#/check/kss', null, { timeout: 5000 });
  check('onboarding: finishing starts the first check', true);
  const onboarded = await page.evaluate(() => JSON.parse(localStorage.getItem('pfc.data')).settings.onboarded);
  check('onboarding: remembered', onboarded === true);
  check('onboarding: no JS errors', page.__errors.length === 0, page.__errors.join(' | '));
  await page.context().close();
}

async function fullFlow(browser, base, vp) {
  // 6 prior touch sessions: on mobile the full index is used; on desktop (keyboard) it is provisional.
  const data = seed(6, { withFlow: false });
  const page = await newPage(browser, vp, { data });
  await page.goto(base + '/?nosw&pvt=fast#/');
  await settle(page, 400);
  await page.click('[data-action="start"]');
  await page.waitForFunction(() => location.hash === '#/check/kss');
  await settle(page, 500);
  // Next is blocked until a value is picked.
  await page.click('[data-action="step-next"]', { force: true });
  await page.waitForTimeout(300);
  check(`${vp} flow: rating required before next`, (await hashOf(page)) === '#/check/kss');
  const useKeyboard = vp === 'desktop';
  for (const [step, val, next] of [['kss', 2, 'energy'], ['energy', 8, 'tension'], ['tension', 3, 'context']]) {
    if (useKeyboard) await page.keyboard.press(String(val));
    else await page.click(`.choice[data-value="${val}"]`);
    await page.waitForFunction((n) => location.hash === '#/check/' + n, next, { timeout: 4000 });
    check(`${vp} flow: ${step} auto-advances`, true);
    await settle(page, 450);
  }
  await page.fill('#f-sleepHours', '7.5');
  await page.click('.more summary');
  await page.fill('#f-wakeTime', '07:00');
  await page.click('.task[data-value="deep"]');
  await page.click('.guide-nav .pill');
  await page.waitForFunction(() => location.hash === '#/check/pvt');
  await settle(page, 450);
  await page.click('#pvt-start');

  // Respond ~250–320 ms after each stimulus appears, until the run finishes.
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
  await settle(page, 2200); // let the deal finish
  const saved = await page.evaluate(() => { const d = JSON.parse(localStorage.getItem('pfc.data')); return d.sessions[d.sessions.length - 1]; });
  check(`${vp} flow: session saved`, !!saved && saved.valid === true, saved ? `n=${saved.pvt.summary.n}` : 'missing');
  check(`${vp} flow: PVT responses recorded`, saved && saved.pvt.summary.n >= 3 && saved.pvt.summary.n <= responses + 1, `responses=${responses}, n=${saved && saved.pvt.summary.n}`);
  check(`${vp} flow: RTs plausible`, saved && saved.pvt.trials.filter((t) => t.kind !== 'falseStart').every((t) => t.rtMs >= 150 && t.rtMs < 1500),
    saved ? saved.pvt.trials.map((t) => t.rtMs).join(',') : '');
  check(`${vp} flow: device recorded`, saved && saved.device === (useKeyboard ? 'keyboard' : 'touch'), saved && saved.device);
  check(`${vp} flow: ratings saved`, saved && saved.subjective.kss === 2 && saved.subjective.energy === 8 && saved.subjective.tension === 3);
  check(`${vp} flow: context saved`, saved && saved.context.sleepHours === 7.5 && saved.context.taskType === 'deep' && saved.context.hoursAwake !== null);
  check(`${vp} flow: score present`, saved && typeof saved.score.index === 'number' && !!saved.score.archetype);
  check(`${vp} flow: provisional only without same-device baseline`, saved && saved.score.provisional === useKeyboard, `provisional=${saved && saved.score.provisional}`);
  await shot(page, 'flow-cards-down', vp);
  await layoutChecks(page, `${vp} cards-down`);

  // Cards flip in order: tapping card III first does nothing.
  await page.click('.tcard[data-card="2"]', { force: true });
  await page.waitForTimeout(300);
  check(`${vp} flow: cards flip in order`, !(await page.$eval('.tcard[data-card="2"]', (e) => e.classList.contains('is-flipped'))));
  for (let i = 0; i < 3; i++) { await page.click(`.tcard[data-card="${i}"]`); await page.waitForTimeout(1300); }
  check(`${vp} flow: three cards revealed`, (await page.$$eval('.tcard.is-flipped', (els) => els.length)) === 3);
  check(`${vp} flow: card art comes alive`, (await page.$$eval('.tcard-front.alive', (els) => els.length)) === 3);
  const reading = await page.$eval('.reading-panel', (e) => e.textContent);
  check(`${vp} flow: guidance reading shown`, reading.length > 10);
  await settle(page, 600);
  await layoutChecks(page, `${vp} cards-up`);
  await shot(page, 'flow-cards-up', vp);

  // Focus timer (test mode: minutes run as seconds), with an idea dropped in the jar.
  await page.click('[data-action="timer-start"][data-min="25"]');
  await page.waitForFunction(() => location.hash === '#/timer');
  await settle(page, 600);
  await page.fill('#idea-in', '查一下那篇論文');
  await page.press('#idea-in', 'Enter');
  await page.waitForTimeout(1200);
  const jarCount = await page.$$eval('.jar-slips .slip', (els) => els.length);
  check(`${vp} focus: idea lands in the jar`, jarCount === 1, String(jarCount));
  await layoutChecks(page, `${vp} focus`);
  await page.waitForFunction(() => location.hash.startsWith('#/flow/'), null, { timeout: 40000 });
  await settle(page, 600);
  const dur = await page.inputValue('#f-durationMin');
  check(`${vp} focus: timer pre-fills duration`, dur === '25', dur);
  const slipText = await page.$eval('.slips', (e) => e.textContent).catch(() => '');
  check(`${vp} focus: jar ideas shown in the log`, slipText.includes('查一下那篇論文'), slipText);
  await page.click('.rate .choice[data-value="8"]');
  await page.fill('#f-notes', '專注測試, "quoted"');
  await page.click('#flow-save');
  await page.waitForFunction(() => location.hash === '#/history', null, { timeout: 5000 });
  const sess = await page.evaluate(() => { const d = JSON.parse(localStorage.getItem('pfc.data')); return d.sessions[d.sessions.length - 1]; });
  check(`${vp} flow: flow log saved`, sess.flow && sess.flow.rating === 8 && sess.flow.durationMin === 25 && sess.flow.taskType === 'deep', JSON.stringify(sess.flow));
  check(`${vp} flow: ideas kept on the session`, Array.isArray(sess.ideas) && sess.ideas.length === 1 && sess.ideas[0].text === '查一下那篇論文');

  // Export → clear → import.
  await goHash(page, '#/settings');
  await settle(page, 500);
  const before = await page.evaluate(() => localStorage.getItem('pfc.data'));
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-action="export-json"]')]);
  const exportPath = await dl.path();
  const exported = fs.readFileSync(exportPath, 'utf8');
  check(`${vp} export: JSON matches storage`, JSON.stringify(JSON.parse(exported)) === JSON.stringify(JSON.parse(before)));
  const [csvDl] = await Promise.all([page.waitForEvent('download'), page.click('[data-action="export-csv"]')]);
  const csv = fs.readFileSync(await csvDl.path(), 'utf8');
  check(`${vp} export: CSV rows`, csv.trim().split('\r\n').length === JSON.parse(before).sessions.length + 1);
  check(`${vp} export: CSV has ideas`, csv.includes('查一下那篇論文'));

  await page.click('[data-action="clear-data"]');
  await page.click('#clear-go');
  await page.click('#clear-go'); // empty confirmation word: must not delete
  const still = await page.evaluate(() => JSON.parse(localStorage.getItem('pfc.data')).sessions.length);
  check(`${vp} clear: needs typed confirmation`, still > 0);
  await page.fill('#clear-word', '刪除');
  await page.click('#clear-go');
  await settle(page, 300);
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
  const page = await newPage(browser, 'mobile', { data: seed(1, { withFlow: false }) });
  await page.goto(base + '/?nosw&pvt=fast#/');
  await setDraft(page);
  await goHash(page, '#/check/pvt');
  await settle(page, 600);
  await page.click('#pvt-start');
  await page.waitForFunction(() => document.querySelector('.pvt') && document.querySelector('.pvt').dataset.state === 'running', null, { timeout: 8000 });
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForSelector('.pvt-dialog');
  check('interrupt: retest dialog shown', true);
  await shot(page, 'pvt-interrupted', 'mobile');
  await layoutChecks(page, 'mobile pvt-interrupted');
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
    const page = await newPage(browser, vp, { data: seed(1, { withFlow: false }) });
    await page.goto(base + '/?nosw&pvt=fast#/');
    await setDraft(page);
    await goHash(page, '#/check/pvt');
    await settle(page, 600);
    await page.click('#pvt-start');
    await page.waitForSelector('.pvt-stimulus.is-on', { timeout: 12000 });
    await page.waitForTimeout(260);
    await shot(page, 'pvt-stimulus', vp);
    await layoutChecks(page, `${vp} pvt-running`);
    await page.context().close();
  }
}

async function keyboardPass(browser, base) {
  const page = await newPage(browser, 'desktop', { data: seed(3) });
  await page.goto(base + '/?nosw#/');
  await settle(page, 500);
  let found = false;
  for (let i = 0; i < 12 && !found; i++) {
    await page.keyboard.press('Tab');
    found = await page.evaluate(() => document.activeElement && document.activeElement.dataset.action === 'start');
  }
  check('keyboard: primary action reachable by Tab', found);
  const outline = await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle);
  check('keyboard: visible focus style', outline !== 'none', outline);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => location.hash === '#/check/kss');
  await settle(page, 500);
  await page.keyboard.press('3');
  await page.waitForTimeout(100);
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(100);
  const kss = await page.evaluate(() => window.__pfc.app.draft.subjective.kss);
  check('keyboard: number key + arrow select a rating', kss === 4, String(kss));
  await page.waitForFunction(() => location.hash === '#/check/energy', null, { timeout: 4000 });
  check('keyboard: rating auto-advances', true);
  await settle(page, 500);
  await page.keyboard.press('ArrowLeft');
  await page.waitForFunction(() => location.hash === '#/check/kss', null, { timeout: 4000 });
  check('keyboard: ← goes back a step', true);
  check('keyboard pass: no JS errors', page.__errors.length === 0, page.__errors.join(' | '));
  await page.context().close();
}

async function readmeShots(browser, base) {
  if (!README_SHOTS) return;
  fs.mkdirSync(README_SHOTS, { recursive: true });
  const data = seed(18);
  const last = data.sessions[data.sessions.length - 1];
  last.ideas = [{ text: '回信給 Ken', at: last.createdAt }];
  const grab = async (vp, hash, file, opts = {}) => {
    const d = JSON.parse(JSON.stringify(data));
    if (opts.timer) d.timer = { sessionId: last.id, startedAt: Date.now() - 9 * 60000, endsAt: Date.now() + 16 * 60000, minutes: 25, ideas: [{ text: '回信', at: '' }, { text: '買牛奶', at: '' }] };
    const page = await newPage(browser, vp, { data: d, lang: opts.lang || 'zh-TW' });
    await page.goto(base + '/?nosw#/');
    if (opts.draft) await setDraft(page);
    await goHash(page, hash);
    await settle(page, 2600);
    if (opts.before) await opts.before(page);
    await page.screenshot({ path: path.join(README_SHOTS, file) });
    await page.context().close();
  };
  await grab('mobile', '#/', 'mobile-home.png');
  await grab('mobile', '#/check/kss', 'mobile-check.png', { draft: true, before: async (p) => { await p.click('.choice[data-value="6"]'); await p.waitForTimeout(500); } });
  await grab('mobile', `#/result/${last.id}`, 'mobile-cards.png');
  await grab('mobile', '#/timer', 'mobile-focus.png', { timer: true });
  await grab('desktop', `#/result/${last.id}`, 'desktop-cards.png');
  await grab('desktop', '#/history', 'desktop-history.png', { lang: 'en' });
}

(async () => {
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch();
  try {
    await onboarding(browser, base);
    for (const vp of ['mobile', 'desktop']) {
      await pagesTour(browser, base, vp, 'zh-TW');
      await pagesTour(browser, base, vp, 'en');
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
