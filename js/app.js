/*
 * Pre-Flow Check — app shell: hash router, views, motion and interactions.
 * Views return { world, title, html, mount } and are rendered into #app.
 * Screen changes use the View Transitions API where available (crossfade, slide, or the
 * circular "reveal" into the card table); elsewhere the content simply swaps.
 */
(function () {
  'use strict';

  const PFC = window.PFC;
  const CFG = PFC.config;
  const S = PFC.scoring;
  const SK = PFC.sketch;
  const ART = PFC.art;
  const store = PFC.storage.store;

  const params = new URLSearchParams(location.search);
  const FAST_PVT = params.get('pvt') === 'fast';
  const FAST_PVT_MS = 20000;

  document.documentElement.classList.add('js');
  const appEl = document.getElementById('app');
  const reduceMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = () => window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  const STEPS = ['kss', 'energy', 'tension', 'context', 'pvt'];

  const app = {
    lang: 'zh-TW',
    draft: null,
    revealId: null,
    flipped: {},          // sessionId -> cards turned
    active: {},           // sessionId -> card being read
    dealt: {},            // sessionId -> deal animation already played
    welcome: 0,
    hist: { sel: null, tab: 'stars', select: null },
    flowPrefill: null,
    nextVt: null,
    cleanups: [],
    route: { name: 'home', arg: null },
    booted: false
  };

  // ---------------- i18n & formatting ----------------

  function lookup(obj, key) {
    return key.split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), obj);
  }
  function t(key, vars) {
    let v = lookup(PFC.STRINGS[app.lang], key);
    if (v === undefined) v = lookup(PFC.STRINGS['zh-TW'], key);
    if (v === undefined) return key;
    if (typeof v === 'string' && vars) v = v.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? vars[k] : m));
    return v;
  }
  PFC.t = t;

  const esc = (s) => String(s === null || s === undefined ? '' : s)
    .replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const locale = () => (app.lang === 'en' ? 'en' : 'zh-TW');
  const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
  const ROMAN = ['I', 'II', 'III'];

  function fmtWhen(iso) {
    const d = new Date(iso);
    const now = new Date();
    const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diff = Math.round((today - day) / 86400000);
    const time = d.toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit', hour12: false });
    if (diff === 0) return t('today') + ' ' + time;
    if (diff === 1) return t('yesterday') + ' ' + time;
    const opts = { month: 'numeric', day: 'numeric' };
    if (d.getFullYear() !== now.getFullYear()) opts.year = 'numeric';
    return d.toLocaleDateString(locale(), opts) + ' ' + time;
  }
  function fmtClock(ms) {
    const s = Math.max(0, Math.ceil(ms / 1000));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  // ---------------- data helpers ----------------

  const sessions = () => store.data.sessions;
  const byId = (id) => sessions().find((s) => s.id === id) || null;
  const scored = () => sessions().filter((s) => s.score && isNum(s.score.index));
  const ordinal = (s) => sessions().indexOf(s) + 1;

  function persist() {
    const ok = store.save();
    if (!ok) showBanner();
    return ok;
  }
  function guessDevice() {
    const last = sessions().filter((s) => S.hasValidPvt(s)).slice(-1)[0];
    if (last) return last.device;
    return window.matchMedia && window.matchMedia('(pointer: coarse)').matches ? 'touch' : 'keyboard';
  }
  function newId() {
    try { if (crypto && crypto.randomUUID) return crypto.randomUUID(); } catch (e) { /* fall through */ }
    return 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  // ---------------- atoms ----------------

  const ic = (d, extra = '') => `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" ${extra}>${d}</svg>`;
  const icons = {
    home: ic('<path d="M4 11.5 12 5l8 6.5"/><path d="M6.5 10v9h11v-9"/>'),
    history: ic('<path d="M4 18 9 11l4 4 7-9"/><circle cx="9" cy="11" r="1.4" fill="currentColor"/><circle cx="13" cy="15" r="1.4" fill="currentColor"/><circle cx="20" cy="6" r="1.4" fill="currentColor"/>'),
    log: ic('<path d="M4 15c3-6 5 4 8-2s5 2 8-3"/><path d="M4 20h16"/>'),
    settings: ic('<circle cx="12" cy="12" r="3"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8"/>'),
    back: ic('<path d="M15 5 8 12l7 7"/>'),
    close: ic('<path d="M6 6l12 12M18 6 6 18"/>'),
    arrow: ic('<path d="M5 12h13M13 6l6 6-6 6"/>', 'stroke-width="2.2"'),
    chev: ic('<path d="M6 9l6 6 6-6"/>'),
    next: ic('<path d="M9 5l7 7-7 7"/>'),
    jar: ic('<path d="M7 5h10M8 5v2c-1.5 1-2 2-2 4v7a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-7c0-2-.5-3-2-4V5"/><path d="M9 14h2M12 16h3"/>')
  };

  function langBtn() {
    return `<button type="button" class="lang-btn" data-action="lang" aria-label="${esc(t('langToggleLabel'))}" lang="${app.lang === 'en' ? 'zh-Hant' : 'en'}">${esc(t('langToggle'))}</button>`;
  }
  function banner() {
    return store.available ? '' : `<div class="banner" role="alert">${esc(t('storageWarning'))}</div>`;
  }
  function showBanner() {
    if (document.querySelector('.banner')) return;
    const scr = appEl.firstElementChild;
    if (scr) scr.insertAdjacentHTML('afterbegin', banner());
  }

  // Primary pill with the arrow nested in its own circle.
  function pill(label, attrs = '', cls = '', withIcon = true) {
    const tag = /^\s*href=/.test(attrs) ? 'a' : 'button';
    const type = tag === 'button' ? ' type="button"' : '';
    return `<${tag}${type} class="pill ${withIcon ? '' : 'pill--plain'} ${cls}" ${attrs}><span>${esc(label)}</span>${withIcon ? `<span class="pill-ic">${icons.arrow}</span>` : ''}</${tag}>`;
  }

  function wordmark() {
    const letters = Array.from('Pre-Flow Check').map((ch, i) => (ch === ' ' ? ' ' : `<span class="rl-${(i % 5) + 1}">${esc(ch)}</span>`)).join('');
    return `<span class="wordmark" aria-label="Pre-Flow Check 心流羅盤"><span aria-hidden="true">${letters}</span><span class="wm-zh" aria-hidden="true">心流羅盤</span></span>`;
  }

  function dock(active) {
    const item = (key, href) => `<a href="${href}" ${active === key ? 'aria-current="page"' : ''}>${icons[key]}<span>${esc(t('nav.' + key))}</span></a>`;
    return `<nav class="dock" aria-label="${esc(t('appShort'))}">${item('home', '#/')}${item('history', '#/history')}${item('log', '#/flow')}${item('settings', '#/settings')}</nav>`;
  }

  function corners(number) {
    return `<div class="corners" aria-hidden="true">
      <span class="corner corner-tl">${ART.cornerStar()}</span>
      <span class="corner corner-tr">${ART.cornerNumber()}<b>${esc(number)}</b></span>
      <span class="corner corner-bl">${ART.cornerEye()}</span>
      <span class="corner corner-br">${ART.cornerMoon()}</span>
    </div>`;
  }

  // Screen frame. `left`/`center`/`right` fill the top bar; `dockKey` shows the bottom navigation.
  function screen({ body, left = '', center = '', right = langBtn(), dockKey = null, cls = '', extra = '', footer = true }) {
    return `<div class="screen ${dockKey ? 'screen--dock' : ''} ${cls}">
      ${banner()}${extra}
      <header class="topbar">${left || '<span></span>'}${center || '<span></span>'}${right || '<span></span>'}</header>
      <main id="main" class="main">${body}</main>
      ${footer ? `<footer class="site-footer"><p>${esc(t('disclaimer'))}</p></footer>` : ''}
      ${dockKey ? dock(dockKey) : ''}
    </div>`;
  }
  const iconLink = (href, icon, label) => `<a class="icon-btn" href="${href}" aria-label="${esc(label)}">${icons[icon]}</a>`;

  let toastTimer = 0;
  function toast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('is-on'), 2800);
  }

  function later(fn, ms) {
    const id = setTimeout(fn, ms);
    app.cleanups.push(() => clearTimeout(id));
    return id;
  }

  // ---------------- living art controllers ----------------

  // Eye: open/close (0–1), look (−1…1), blink, and an idle loop of glances and blinks.
  function eyeCtl(g, { idle = true, blinkEvery = [2400, 6000], wander = true } = {}) {
    if (!g) return null;
    const w = Number(g.dataset.w) || 40;
    let timers = [];
    let pointer = false;
    const api = {
      setOpen(o) { g.style.setProperty('--open', Math.max(0, Math.min(1, o)).toFixed(3)); },
      look(x, y) {
        g.style.setProperty('--lx', (Math.max(-1, Math.min(1, x)) * w * 0.3).toFixed(1));
        g.style.setProperty('--ly', (Math.max(-1, Math.min(1, y)) * w * 0.16).toFixed(1));
      },
      blink() {
        if (reduceMotion()) return;
        g.classList.remove('blinking');
        void g.getBoundingClientRect();
        g.classList.add('blinking');
        timers.push(setTimeout(() => g.classList.remove('blinking'), 260));
      },
      follow(on) { pointer = on; },
      stop() { timers.forEach(clearTimeout); timers = []; }
    };
    if (idle && !reduceMotion()) {
      const [a, b] = blinkEvery;
      const blinkLoop = () => { api.blink(); timers.push(setTimeout(blinkLoop, a + Math.random() * (b - a))); };
      const lookLoop = () => {
        if (!pointer && wander) api.look((Math.random() - 0.5) * 1.8, (Math.random() - 0.5) * 1.4);
        timers.push(setTimeout(lookLoop, 1400 + Math.random() * 2600));
      };
      timers.push(setTimeout(blinkLoop, 800 + Math.random() * 1600));
      if (wander) timers.push(setTimeout(lookLoop, 600 + Math.random() * 1000));
    }
    app.cleanups.push(api.stop);
    return api;
  }

  // Tension ring: calm and round at 1, trembling and jagged at 10.
  function tensionCtl(svg) {
    const p1 = svg.querySelector('.tp-1');
    const p2 = svg.querySelector('.tp-2');
    const core = svg.querySelector('.calm-core');
    let v = 1;
    let shown = 1;
    let phase = 0;
    let raf = 0;
    const lav = [201, 182, 242];
    const org = [240, 90, 40];
    const mix = (k) => `rgb(${lav.map((c, i) => Math.round(c + (org[i] - c) * k)).join(',')})`;
    const draw = () => {
      shown += (v - shown) * 0.08;
      const k = (shown - 1) / 9;
      phase += reduceMotion() ? 0 : 0.015 + k * 0.11;
      const amp = 1.5 + k * 13;
      const freq = 3 + Math.round(k * 9);
      p1.setAttribute('d', ART.ringPath(120, 120, 74, amp, freq, phase));
      p2.setAttribute('d', ART.ringPath(120, 120, 92, amp * 0.7, freq + 2, -phase * 0.8));
      p1.setAttribute('stroke', mix(k));
      p2.setAttribute('stroke', mix(k));
      core.style.transform = `scale(${(1.15 - k * 0.45).toFixed(3)})`;
      if (!reduceMotion() || Math.abs(v - shown) > 0.01) raf = requestAnimationFrame(draw);
    };
    draw();
    app.cleanups.push(() => cancelAnimationFrame(raf));
    return {
      set(n) {
        v = n;
        if (reduceMotion()) { shown = n; cancelAnimationFrame(raf); draw(); }
      }
    };
  }

  function flameCtl(svg) {
    const embers = svg.querySelectorAll('.ember');
    return {
      set(v) {
        svg.style.setProperty('--e', v);
        embers.forEach((e, i) => e.classList.toggle('on', i < v - 1));
      }
    };
  }

  function sparkBurst(host, n = 12) {
    if (reduceMotion() || !host || !host.animate) return;
    const wrap = document.createElement('span');
    wrap.className = 'spark-burst';
    host.appendChild(wrap);
    const colors = ['#FDB22B', '#C9B6F2', '#F5F0E6', '#F05A28'];
    for (let i = 0; i < n; i++) {
      const s = document.createElement('i');
      s.style.background = colors[i % colors.length];
      wrap.appendChild(s);
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.4;
      const d = 70 + Math.random() * 70;
      s.animate([
        { transform: 'translate(0,0) scale(.4) rotate(0deg)', opacity: 1 },
        { transform: `translate(${Math.cos(a) * d}px, ${Math.sin(a) * d}px) scale(${0.6 + Math.random()}) rotate(${Math.random() * 180}deg)`, opacity: 0 }
      ], { duration: 700 + Math.random() * 400, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'forwards' });
    }
    setTimeout(() => wrap.remove(), 1300);
  }

  function countUp(el, to, ms = 1200) {
    if (!el) return;
    if (reduceMotion()) { el.textContent = String(to); return; }
    const t0 = performance.now();
    const step = (now) => {
      const p = Math.min(1, (now - t0) / ms);
      const e = 1 - Math.pow(1 - p, 3);
      el.textContent = String(Math.round(to * e));
      if (p < 1 && el.isConnected) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  // Swipe left/right on an element.
  function onSwipe(el, fn) {
    if (!el) return;
    let sx = 0;
    let sy = 0;
    let on = false;
    el.addEventListener('touchstart', (e) => { if (e.touches.length !== 1) return; on = true; sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
    el.addEventListener('touchend', (e) => {
      if (!on) return;
      on = false;
      const tch = e.changedTouches[0];
      const dx = tch.clientX - sx;
      const dy = tch.clientY - sy;
      if (Math.abs(dx) > 60 && Math.abs(dy) < 50) fn(dx < 0 ? 1 : -1);
    }, { passive: true });
  }

  // ---------------- onboarding ----------------

  function welcomeVisual(i) {
    if (i === 0) return ART.oracle();
    if (i === 1) return ART.orbitTrio();
    const card = (n, art) => `<div class="mini-card" style="--n:${n}"><div class="face back">${ART.cardBack()}</div><div class="face front" style="background:${art.bg}">${art.svg}</div></div>`;
    return `<div class="mini-fan">${card(0, { bg: ART.P.indigo, svg: ART.ARCHETYPE_ART.calmFire() })}${card(1, { bg: ART.P.cream, svg: ART.readiness(72) })}${card(2, { bg: ART.P.orange, svg: ART.guidance() })}</div>`;
  }

  function viewWelcome() {
    const slides = t('welcome.slides');
    const i = Math.min(app.welcome, slides.length - 1);
    const last = i === slides.length - 1;
    const body = `
      <section class="welcome">
        <div class="slide-visual" data-rise style="--i:0">${welcomeVisual(i)}</div>
        <div>
          <h1 class="slide-title" tabindex="-1" data-rise style="--i:1">${esc(slides[i].t)}</h1>
          <p class="slide-sub" data-rise style="--i:2">${esc(slides[i].s)}</p>
        </div>
        <div class="welcome-actions" data-rise style="--i:3">
          <div class="dots" aria-hidden="true">${slides.map((_, k) => `<span class="${k === i ? 'on' : ''}"></span>`).join('')}</div>
          ${pill(last ? t('welcome.start') : t('next'), 'data-action="welcome-next"')}
        </div>
      </section>`;
    return {
      world: 'night', title: t('appName'),
      html: screen({ body, left: wordmark(), right: `<span>${langBtn()}<button type="button" class="text-btn" data-action="welcome-skip">${esc(t('skip'))}</button></span>`, footer: false }),
      mount: () => {
        const e = appEl.querySelector('.eye');
        if (e) eyeCtl(e);
        onSwipe(appEl.querySelector('.welcome'), (dir) => welcomeGo(dir));
      }
    };
  }

  function welcomeGo(dir) {
    const n = t('welcome.slides').length;
    if (dir > 0 && app.welcome >= n - 1) { finishWelcome(true); return; }
    app.welcome = Math.max(0, Math.min(n - 1, app.welcome + dir));
    render(dir > 0 ? 'forward' : 'back');
  }

  function finishWelcome(startCheck) {
    store.data.settings.onboarded = true;
    persist();
    app.welcome = 0;
    if (startCheck) { app.draft = newDraft(); go('#/check/kss', 'forward'); } else go('#/', 'fade');
  }

  // ---------------- home ----------------

  function trendSvg(list) {
    const vals = list.slice(-10).map((s) => s.score.index);
    if (vals.length < 2) return '';
    const W = 300;
    const H = 54;
    const step = (W - 16) / (vals.length - 1);
    const pts = vals.map((v, i) => ({ x: 8 + i * step, y: H - 8 - (v / 100) * (H - 16) }));
    const d = SK.smoothPath(SK.catmull(pts, 4));
    return `<svg class="trend" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(t('history.title'))}"><path d="${d}"/>${pts.map((p, i) => `<circle class="${i === pts.length - 1 ? 'last' : ''}" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${i === pts.length - 1 ? 4.5 : 2.6}"/>`).join('')}</svg>`;
  }

  function viewHome() {
    if (!store.data.settings.onboarded && !sessions().length) { location.replace('#/welcome'); return null; }
    const list = scored();
    const device = guessDevice();
    const bl = S.buildBaseline(sessions(), { device });
    const latest = list[list.length - 1];
    const chips = [];
    chips.push(`<span class="chip-info"><span class="swatch" style="background:${bl.enabled ? 'var(--green)' : 'var(--mustard)'}"></span>${esc(bl.enabled ? t('homeView.baselineReady') : t('homeView.baselineBuilding', { n: Math.min(bl.n, CFG.baseline.minSessions), total: CFG.baseline.minSessions }))}</span>`);
    if (latest) chips.push(`<span class="chip-info">${esc(t('homeView.last', { index: '' }).trim())} <b>${latest.score.index}</b></span>`);

    let nudge = '';
    const timer = store.data.timer;
    if (timer) {
      const left = timer.endsAt - Date.now();
      nudge = left > 0
        ? `<a class="nudge-card" href="#/timer"><span data-timer-left>${esc(t('homeView.timerRunning', { time: fmtClock(left) }))}</span><span class="pill-ic">${icons.arrow}</span></a>`
        : `<button type="button" class="nudge-card" data-action="timer-log"><span>${esc(t('homeView.timerDone'))}</span><span class="pill-ic">${icons.arrow}</span></button>`;
    } else {
      const pending = sessions().slice().reverse().find((s) => !s.flow && Date.now() - new Date(s.createdAt) < 48 * 3600000);
      if (pending) nudge = `<a class="nudge-card" href="#/flow/${esc(pending.id)}"><span>${esc(t('homeView.reminder'))} · ${esc(fmtWhen(pending.createdAt))}</span><span class="pill-ic">${icons.arrow}</span></a>`;
    }

    const body = `
      <section class="home">
        <div class="home-visual" data-rise style="--i:0">${ART.oracle()}</div>
        <h1 class="home-ask" tabindex="-1" data-rise style="--i:1">${esc(t('homeView.ask'))}</h1>
        <div class="chips" data-rise style="--i:2">${chips.join('')}</div>
        ${list.length >= 2 ? `<div data-rise style="--i:3">${trendSvg(list)}</div>` : ''}
        <div data-rise style="--i:4">${pill(t('homeView.start'), 'href="#/check/kss" data-action="start"')}</div>
        ${nudge ? `<div data-rise style="--i:5">${nudge}</div>` : ''}
      </section>`;
    return {
      world: 'night', title: t('appName'),
      html: screen({ body, left: wordmark(), dockKey: 'home' }),
      mount: () => {
        const svg = appEl.querySelector('.art-oracle');
        const e = eyeCtl(svg.querySelector('.eye'), { wander: !finePointer() });
        // On desktop the eye follows the pointer.
        if (finePointer()) {
          const onMove = (ev) => {
            const r = svg.getBoundingClientRect();
            e.follow(true);
            e.look((ev.clientX - (r.left + r.width / 2)) / (window.innerWidth / 2), (ev.clientY - (r.top + r.height / 2)) / (window.innerHeight / 2));
          };
          window.addEventListener('pointermove', onMove);
          app.cleanups.push(() => window.removeEventListener('pointermove', onMove));
        }
        svg.addEventListener('click', () => { e.blink(); sparkBurst(appEl.querySelector('.home-visual'), 10); });
        if (timer && timer.endsAt > Date.now()) {
          const iv = setInterval(() => {
            const el = appEl.querySelector('[data-timer-left]');
            const left = timer.endsAt - Date.now();
            if (left <= 0) { clearInterval(iv); render(); return; }
            if (el) el.textContent = t('homeView.timerRunning', { time: fmtClock(left) });
          }, 1000);
          app.cleanups.push(() => clearInterval(iv));
        }
      }
    };
  }

  // ---------------- guided check ----------------

  function newDraft() {
    return {
      subjective: { kss: null, energy: null, tension: null },
      context: {
        sleepHours: null, wakeTime: '', caffeineCups: null, lastCaffeineTime: '',
        hrv: null, restingHr: null, deviceReadiness: null, taskType: null
      }
    };
  }

  function guideTop(step) {
    const idx = STEPS.indexOf(step);
    const prev = idx > 0 ? `#/check/${STEPS[idx - 1]}` : '#/';
    const segs = STEPS.map((s, i) => `<span class="${i < idx ? 'done' : i === idx ? 'now' : ''}"></span>`).join('');
    return `<header class="guide-top">
      <a class="icon-btn" href="${prev}" data-vt="back" aria-label="${esc(t('back'))}">${icons.back}</a>
      <div class="segments" role="progressbar" aria-valuemin="1" aria-valuemax="${STEPS.length}" aria-valuenow="${idx + 1}" aria-label="${esc(t('step.label', { n: idx + 1, total: STEPS.length }))}">${segs}</div>
      <a class="icon-btn" href="#/" aria-label="${esc(t('close'))}">${icons.close}</a>
    </header>`;
  }

  function guideScreen(step, body) {
    return `<div class="screen screen--guide">${banner()}${guideTop(step)}<main id="main" class="main">${body}</main><footer class="site-footer"><p>${esc(t('disclaimer'))}</p></footer></div>`;
  }

  function kssLabel(v) {
    const labels = t('step.kss');
    return isNum(v) && labels[v] ? labels[v] : '';
  }

  function viewCheck(r) {
    const step = STEPS.includes(r.arg) ? r.arg : 'kss';
    if (!app.draft) app.draft = newDraft();
    const d = app.draft.subjective;
    // Don't skip past an unanswered rating.
    const firstGap = ['kss', 'energy', 'tension'].find((k) => !isNum(d[k]));
    if (firstGap && STEPS.indexOf(step) > STEPS.indexOf(firstGap)) { location.replace('#/check/' + firstGap); return null; }
    if (step === 'context') return viewContext();
    if (step === 'pvt') return viewPvtIntro();
    return viewRating(step);
  }

  function viewRating(step) {
    const v = app.draft.subjective[step];
    const n = step === 'kss' ? 9 : 10;
    const q = t(`step.${step}Q`);
    const visual = step === 'kss' ? ART.oracle() : step === 'energy' ? ART.flame() : ART.tensionRing();
    let choices = '';
    for (let i = 1; i <= n; i++) {
      const on = v === i;
      choices += `<button type="button" role="radio" class="choice" data-value="${i}" aria-checked="${on}" tabindex="${on || (v === null && i === 1) ? 0 : -1}" aria-label="${i}${step === 'kss' && kssLabel(i) ? ' ' + esc(kssLabel(i)) : ''}">${i}</button>`;
    }
    const ends = step === 'kss' ? '' : `<p class="scale-ends" aria-hidden="true"><span>1 ${esc(t('step.low'))}</span><span>${esc(t('step.high'))} 10</span></p>`;
    const body = `
      <section class="guide">
        <div class="guide-visual" data-rise style="--i:0">${visual}</div>
        <h1 class="guide-q" id="q" tabindex="-1" data-rise style="--i:1">${esc(q)}</h1>
        <div class="guide-value" aria-live="polite" data-rise style="--i:2"><span class="num ${isNum(v) ? '' : 'empty'}">${isNum(v) ? v : '–'}</span><span class="lbl">${esc(step === 'kss' ? kssLabel(v) : '')}</span></div>
        <div data-rise style="--i:3">
          <div class="choices" role="radiogroup" aria-labelledby="q">${choices}</div>
          ${ends}
        </div>
      </section>
      <nav class="guide-nav">${pill(t('next'), `data-action="step-next" aria-disabled="${isNum(v) ? 'false' : 'true'}"`)}</nav>`;
    return {
      world: 'night', title: q,
      html: guideScreen(step, body),
      mount: () => {
        const svg = appEl.querySelector('.guide-visual .art');
        let ctl = null;
        if (step === 'kss') {
          const e = eyeCtl(svg.querySelector('.eye'), { blinkEvery: [2000, 4200] });
          ctl = { set: (x) => { e.setOpen(1 - ((x - 1) / 8) * 0.86); svg.classList.toggle('sleepy', x >= 7); } };
        } else if (step === 'energy') ctl = flameCtl(svg);
        else ctl = tensionCtl(svg);
        ctl.set(isNum(v) ? v : step === 'kss' ? 3 : 5);

        let advance = 0;
        const pick = (btn) => {
          const val = Number(btn.dataset.value);
          app.draft.subjective[step] = val;
          appEl.querySelectorAll('.choice').forEach((b) => {
            const on = b === btn;
            b.setAttribute('aria-checked', String(on));
            b.tabIndex = on ? 0 : -1;
          });
          const num = appEl.querySelector('.guide-value .num');
          num.textContent = String(val);
          num.classList.remove('empty');
          if (!reduceMotion() && num.animate) num.animate([{ transform: 'scale(.7)', opacity: 0.3 }, { transform: 'scale(1)', opacity: 1 }], { duration: 380, easing: 'cubic-bezier(0.2, 1.3, 0.35, 1)' });
          appEl.querySelector('.guide-value .lbl').textContent = step === 'kss' ? kssLabel(val) : '';
          appEl.querySelector('[data-action="step-next"]').setAttribute('aria-disabled', 'false');
          ctl.set(val);
          clearTimeout(advance);
          advance = later(() => stepGo(step, 1), 750);
        };
        appEl.querySelectorAll('.choice').forEach((b) => b.addEventListener('click', () => pick(b)));
        // Number keys pick directly (0 = 10).
        const onKey = (e) => {
          if (e.altKey || e.ctrlKey || e.metaKey || !/^[0-9]$/.test(e.key)) return;
          const btn = appEl.querySelector(`.choice[data-value="${e.key === '0' ? 10 : Number(e.key)}"]`);
          if (btn) { e.preventDefault(); btn.focus(); pick(btn); }
        };
        window.addEventListener('keydown', onKey);
        app.cleanups.push(() => window.removeEventListener('keydown', onKey));
        onSwipe(appEl.querySelector('.guide'), (dir) => stepGo(step, dir));
      }
    };
  }

  const FIELD_RULES = {
    sleepHours: { min: 0, max: 16, step: 0.5, start: 7 },
    caffeineCups: { min: 0, max: 15, step: 1, start: 0 },
    hrv: { min: 5, max: 300, step: 1, start: 50 },
    restingHr: { min: 25, max: 200, step: 1, start: 60 },
    deviceReadiness: { min: 0, max: 100, step: 1, start: 70 },
    durationMin: { min: 1, max: 600, step: 5, start: 25 },
    interruptions: { min: 0, max: 99, step: 1, start: 0 }
  };

  function stepper(name, value, unit = '') {
    const r = FIELD_RULES[name];
    return `<div class="stepper" data-stepper="${name}">
      <button type="button" class="step-btn" data-dir="-1" aria-label="${esc(t('step.decrease'))}">−</button>
      <input id="f-${name}" type="number" inputmode="decimal" min="${r.min}" max="${r.max}" step="${r.step}" value="${isNum(value) ? value : ''}" placeholder="–" autocomplete="off">
      <button type="button" class="step-btn" data-dir="1" aria-label="${esc(t('step.increase'))}">+</button>
      ${unit ? `<span class="unit">${esc(unit)}</span>` : ''}
    </div>`;
  }

  function bindSteppers(target, onChange) {
    appEl.querySelectorAll('[data-stepper]').forEach((wrap) => {
      const name = wrap.dataset.stepper;
      const input = wrap.querySelector('input');
      const rule = FIELD_RULES[name];
      const set = (raw) => {
        const err = appEl.querySelector('#err-' + name);
        if (raw === '' || raw === null) { target[name] = null; if (err) err.textContent = ''; if (onChange) onChange(name); return; }
        const v = Number(raw);
        if (!Number.isFinite(v) || v < rule.min || v > rule.max) { target[name] = null; if (err) err.textContent = t('step.outOfRange'); return; }
        target[name] = v;
        if (err) err.textContent = '';
        if (onChange) onChange(name);
      };
      input.addEventListener('input', () => set(input.value.trim()));
      wrap.querySelectorAll('.step-btn').forEach((b) => b.addEventListener('click', () => {
        const cur = input.value === '' ? null : Number(input.value);
        let next = cur === null || !Number.isFinite(cur) ? rule.start : cur + Number(b.dataset.dir) * rule.step;
        next = Math.min(rule.max, Math.max(rule.min, Math.round(next * 10) / 10));
        input.value = String(next);
        set(input.value);
      }));
    });
  }

  function taskChips(value) {
    return `<div class="tasks" role="radiogroup" aria-label="${esc(t('step.task'))}">${CFG.taskTypes.map((k, i) =>
      `<button type="button" role="radio" class="task" data-group="taskType" data-value="${k}" aria-checked="${value === k}" tabindex="${value === k || (!value && i === 0) ? 0 : -1}">${esc(t('task.' + k))}</button>`).join('')}</div>`;
  }

  // Task chips are optional: tapping the selected one clears it.
  function bindTaskChips(get, set) {
    const chips = Array.from(appEl.querySelectorAll('.task'));
    chips.forEach((b) => b.addEventListener('click', () => {
      const nowOn = get() !== b.dataset.value;
      set(nowOn ? b.dataset.value : null);
      chips.forEach((x, i) => {
        const on = nowOn && x === b;
        x.setAttribute('aria-checked', String(on));
        x.tabIndex = on || (!nowOn && i === 0) ? 0 : -1;
      });
    }));
  }

  function viewContext() {
    const c = app.draft.context;
    const awake = c.wakeTime ? S.hoursSince(c.wakeTime, new Date()) : null;
    const more = isNum(c.caffeineCups) || c.wakeTime || isNum(c.hrv) || isNum(c.restingHr) || isNum(c.deviceReadiness);
    const row = (name, label, unit) => `<div class="ctx-row"><label for="f-${name}">${esc(label)}</label>${stepper(name, c[name], unit)}</div><p class="field-err" id="err-${name}" aria-live="polite"></p>`;
    const body = `
      <section class="guide">
        <div class="guide-visual" style="width:min(40vw,170px,22vh)" data-rise>${ART.nightSky()}</div>
        <div data-rise style="--i:1"><h1 class="guide-q" tabindex="-1">${esc(t('step.ctxTitle'))}</h1><p class="muted">${esc(t('step.ctxHint'))}</p></div>
        <div class="ctx" data-rise style="--i:2">
          ${row('sleepHours', t('step.sleep'), t('step.hoursUnit'))}
          <div><p style="margin:0 0 8px 4px">${esc(t('step.task'))}</p>${taskChips(c.taskType)}</div>
          <details class="more" ${more ? 'open' : ''}>
            <summary>${esc(t('step.more'))}${icons.chev}</summary>
            <div class="ctx-row"><label for="f-wakeTime">${esc(t('step.wake'))}</label><span><input id="f-wakeTime" class="time-in" type="time" value="${esc(c.wakeTime)}"> <span class="derived" id="awake-out">${awake !== null ? esc(t('step.awake', { h: awake })) : ''}</span></span></div>
            ${row('caffeineCups', t('step.caffeine'), t('step.cupsUnit'))}
            <div class="ctx-row" id="last-cup" ${c.caffeineCups > 0 ? '' : 'hidden'}><label for="f-lastCaffeineTime">${esc(t('step.lastCup'))}</label><input id="f-lastCaffeineTime" class="time-in" type="time" value="${esc(c.lastCaffeineTime)}"></div>
            ${row('hrv', t('step.hrv'), '')}
            ${row('restingHr', t('step.rhr'), 'bpm')}
            ${row('deviceReadiness', t('step.readiness'), '')}
          </details>
        </div>
      </section>
      <nav class="guide-nav"><button type="button" class="text-btn" data-action="step-next">${esc(t('skip'))}</button>${pill(t('next'), 'data-action="step-next"')}</nav>`;
    return {
      world: 'night', title: t('step.ctxTitle'),
      html: guideScreen('context', body),
      mount: () => {
        bindSteppers(c, (name) => { if (name === 'caffeineCups') appEl.querySelector('#last-cup').hidden = !(c.caffeineCups > 0); });
        const wake = appEl.querySelector('#f-wakeTime');
        wake.addEventListener('input', () => {
          c.wakeTime = wake.value;
          const h = wake.value ? S.hoursSince(wake.value, new Date()) : null;
          appEl.querySelector('#awake-out').textContent = h !== null ? t('step.awake', { h }) : '';
        });
        const cup = appEl.querySelector('#f-lastCaffeineTime');
        cup.addEventListener('input', () => { c.lastCaffeineTime = cup.value; });
        bindTaskChips(() => c.taskType, (v) => { c.taskType = v; });
      }
    };
  }

  function viewPvtIntro() {
    const body = `
      <section class="guide">
        <div class="guide-visual" data-rise>${ART.pvtDemo()}</div>
        <h1 class="guide-q" tabindex="-1" data-rise style="--i:1">${esc(t('step.pvtTitle'))}</h1>
        <div data-rise style="--i:2"><p>${esc(t('step.pvtSub'))}</p><p class="muted small" style="margin-top:6px">${esc(t('step.pvtNote'))}${FAST_PVT ? ' · ' + esc(t('step.fast', { s: FAST_PVT_MS / 1000 })) : ''}</p></div>
      </section>
      <nav class="guide-nav">${pill(t('step.pvtStart'), 'data-action="pvt-start" id="pvt-start"')}</nav>`;
    return { world: 'night', title: t('step.pvtTitle'), html: guideScreen('pvt', body) };
  }

  function stepGo(step, dir) {
    const idx = STEPS.indexOf(step);
    if (dir > 0) {
      if (idx < 3 && !isNum(app.draft.subjective[step])) {
        const n = appEl.querySelector('.guide-value');
        if (n && n.animate) n.animate([{ transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'none' }], { duration: 300 });
        return;
      }
      if (idx < STEPS.length - 1) go('#/check/' + STEPS[idx + 1], 'forward');
    } else {
      go(idx > 0 ? '#/check/' + STEPS[idx - 1] : '#/', 'back');
    }
  }

  // ---------------- PVT ----------------

  function startPvt() {
    const layer = document.createElement('div');
    layer.className = 'pvt';
    layer.setAttribute('role', 'application');
    layer.setAttribute('aria-label', t('pvt.surfaceLabel'));
    layer.tabIndex = -1;
    layer.innerHTML = `
      <div class="pvt-progress" role="progressbar" aria-label="${esc(t('pvt.progress'))}"><div class="pvt-progress-bar"></div></div>
      <div class="pvt-countdown" aria-live="assertive"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" pathLength="1" stroke-dasharray="1 1"/></svg><b></b></div>
      <div class="pvt-stimulus"><span class="pvt-counter">0</span></div>
      <div class="pvt-message" aria-live="polite"></div>`;
    document.body.appendChild(layer);
    document.body.classList.add('pvt-lock');
    layer.focus();

    const cd = layer.querySelector('.pvt-countdown');
    let n = CFG.pvt.countdownSec;
    let cancelled = false;
    let runner = null;
    const onHide = () => { if (document.visibilityState === 'hidden' && !runner) { cancelled = true; teardown(); } };
    document.addEventListener('visibilitychange', onHide);
    const teardown = () => {
      document.removeEventListener('visibilitychange', onHide);
      if (runner) runner.abort();
      layer.remove();
      document.body.classList.remove('pvt-lock');
    };
    app.cleanups.push(teardown);

    const tick = () => {
      if (cancelled) return;
      if (n > 0) {
        cd.querySelector('b').textContent = String(n);
        cd.classList.remove('pop'); void cd.offsetWidth; cd.classList.add('pop');
        n--;
        setTimeout(tick, 1000);
        return;
      }
      cd.remove();
      document.removeEventListener('visibilitychange', onHide);
      runner = new PFC.PvtRunner({
        surface: layer,
        stimulusEl: layer.querySelector('.pvt-stimulus'),
        counterEl: layer.querySelector('.pvt-counter'),
        messageEl: layer.querySelector('.pvt-message'),
        progressEl: layer.querySelector('.pvt-progress-bar'),
        cfg: CFG.pvt,
        durationMs: FAST_PVT ? FAST_PVT_MS : CFG.pvt.durationMs,
        text: { tooEarly: t('pvt.tooEarly'), noResponse: t('pvt.noResponse') },
        onEnd: (result) => {
          layer.innerHTML = `<p class="pvt-saving">${esc(t('pvt.saving'))}</p>`;
          setTimeout(() => { teardown(); finishCheck(result, true, null); }, 250);
        },
        onInterrupt: (reason, trials) => showInterrupted(layer, teardown, trials, reason)
      });
      layer.dataset.state = 'running';
      runner.start();
    };
    tick();
  }

  function showInterrupted(layer, teardown, trials, reason) {
    layer.dataset.state = 'interrupted';
    layer.innerHTML = `<div class="pvt-dialog" role="alertdialog" aria-labelledby="pvt-int-h" aria-describedby="pvt-int-p">
      <h2 id="pvt-int-h">${esc(t('pvt.interruptedTitle'))}</h2>
      <p id="pvt-int-p" class="muted">${esc(t('pvt.interruptedBody'))}</p>
      <div class="pvt-dialog-actions">
        ${pill(t('pvt.retest'), 'data-int="retest"', '', false)}
        ${pill(t('pvt.skip'), 'data-int="skip"', 'pill--ghost', false)}
      </div>
    </div>`;
    layer.querySelector('[data-int="retest"]').addEventListener('click', () => { teardown(); startPvt(); });
    layer.querySelector('[data-int="skip"]').addEventListener('click', () => {
      teardown();
      finishCheck({ trials, durationMs: null }, false, reason || 'interrupted');
    });
    layer.querySelector('[data-int="retest"]').focus();
  }

  function finishCheck(result, valid, reason) {
    const now = new Date();
    const d = app.draft || newDraft();
    const trials = (result && result.trials) || [];
    const ctx = Object.assign({}, d.context);
    ctx.hoursAwake = ctx.wakeTime ? S.hoursSince(ctx.wakeTime, now) : null;
    ctx.hoursSinceCaffeine = ctx.lastCaffeineTime && ctx.caffeineCups > 0 ? S.hoursSince(ctx.lastCaffeineTime, now) : null;
    if (!ctx.wakeTime) ctx.wakeTime = null;
    if (!ctx.lastCaffeineTime) ctx.lastCaffeineTime = null;
    const session = {
      id: newId(),
      createdAt: now.toISOString(),
      tzOffsetMin: now.getTimezoneOffset(),
      localHour: Math.round((now.getHours() + now.getMinutes() / 60) * 100) / 100,
      device: S.majorityDevice(trials, guessDevice()),
      subjective: Object.assign({}, d.subjective),
      context: ctx,
      pvt: {
        protocol: 'PVT-B',
        plannedMs: FAST_PVT ? FAST_PVT_MS : CFG.pvt.durationMs,
        durationMs: result ? result.durationMs : null,
        trials,
        summary: S.summarizePvt(trials)
      },
      valid: !!valid,
      invalidReason: valid ? null : reason,
      score: null,
      flow: null,
      ideas: []
    };
    session.score = S.scoreSession(session, sessions().concat([session]));
    store.data.sessions.push(session);
    store.data.settings.onboarded = true;
    persist();
    app.draft = null;
    app.revealId = session.id;
    app.flipped[session.id] = 0;
    go('#/result/' + session.id, 'reveal');
  }

  // ---------------- the card table ----------------

  function cardDefs(s) {
    const sc = s.score;
    const a = sc.archetype;
    return [
      { theme: ART.CARD_THEME[a], inner: ART.ARCHETYPE_ART[a](), title: { zh: t('archetype.' + a + '.zh'), en: t('archetype.' + a + '.en') } },
      {
        theme: ART.CARD_THEME.readiness,
        inner: `${ART.readiness(sc.index)}<span class="tcard-big" data-count="${sc.index}">${sc.index}</span>${sc.provisional ? `<span class="tcard-prov">${esc(app.lang === 'en' ? 'PROVISIONAL' : '暫定')}</span>` : ''}`,
        title: t('cards.readiness')
      },
      { theme: ART.CARD_THEME.guidance, inner: ART.guidance(), title: t('cards.guidance') }
    ];
  }

  function cardHtml(i, c, flipped, isNext, isActive) {
    const label = flipped ? `${ROMAN[i]} · ${c.title.zh} ${c.title.en}` : (isNext ? t('result.cardBack', { n: i + 1 }) : t('result.cardLocked', { n: i + 1 }));
    return `<button type="button" class="tcard${flipped ? ' is-flipped' : ''}${isNext ? ' is-next' : ''}${isActive ? ' is-active' : ''}" data-card="${i}"
        style="--card-bg:${c.theme.bg};--card-fg:${c.theme.fg}" aria-label="${esc(label)}" ${!flipped && !isNext ? 'aria-disabled="true"' : ''} aria-pressed="${isActive}">
      <span class="tcard-inner">
        <span class="tcard-face tcard-back">${ART.cardBack()}</span>
        <span class="tcard-face tcard-front${flipped ? ' alive' : ''}">
          <span class="tcard-num">${ROMAN[i]}</span>
          <span class="tcard-art">${c.inner}</span>
          <span class="tcard-title"><span class="zh">${esc(c.title.zh)}</span><span class="en">${esc(c.title.en)}</span></span>
        </span>
      </span>
    </button>`;
  }

  function readingHtml(s, i) {
    const sc = s.score;
    const sub = s.subjective;
    if (i === 0) {
      const a = sc.archetype;
      return `<div class="kicker"><span class="sw" style="background:${ART.CARD_THEME[a].bg}"></span>${ROMAN[0]} · ${esc(t('result.energyTension', { e: sub.energy, t: sub.tension }))}</div>
        <h2>${esc(t('archetype.' + a + '.zh'))}<span class="en">${esc(t('archetype.' + a + '.en'))}</span></h2>
        <p class="tag">${esc(t('archetype.' + a + '.tag'))}</p>
        <p class="muted">${esc(t('archetype.' + a + '.desc'))}</p>`;
    }
    if (i === 1) {
      let lines = '';
      if (sc.provisional) {
        lines += `<span class="badge">${esc(t('result.provisional'))}</span>`;
        if (!s.valid) lines += `<p class="muted">${esc(t('result.invalidPvt'))}</p>`;
        const k = Math.max(0, CFG.baseline.minSessions - sc.baselineN);
        if (k > 0) lines += `<p class="muted">${esc(t('result.provisionalHint', { k, device: t('device.' + s.device) }))}</p>`;
      } else {
        const p = sc.speedVsBaselinePct;
        if (isNum(p)) lines += `<p>${esc(p <= -2 ? t('result.slower', { p: -p }) : p >= 2 ? t('result.faster', { p }) : t('result.same'))}</p>`;
        const bl = baselineFor(s);
        if (bl.stats.lapses) lines += `<p class="muted">${esc(t('result.lapsesLine', { n: s.pvt.summary.lapses, m: Math.round(bl.stats.lapses.mean * 10) / 10 }))}</p>`;
      }
      return `<div class="kicker"><span class="sw" style="background:var(--cream)"></span>${ROMAN[1]} · ${esc(t('cards.readiness.zh'))}</div>
        <p class="big">${sc.index}<small> / 100</small></p>${lines}`;
    }
    const rec = sc.recommendationId;
    const actions = t('rec.' + rec + '.actions');
    return `<div class="kicker"><span class="sw" style="background:var(--orange)"></span>${ROMAN[2]} · ${esc(t('cards.guidance.zh'))}</div>
      <p class="rec-main">${esc(t('rec.' + rec + '.main'))}</p>
      <ul class="rec-actions">${(Array.isArray(actions) ? actions : []).map((a) => `<li>${esc(a)}</li>`).join('')}</ul>
      ${(sc.notes || []).map((n) => `<p class="note">${esc(t('note.' + n))}</p>`).join('')}
      ${sc.breathing ? `<div>${pill(t('result.breatheBtn'), `href="#/breathe/${esc(s.id)}"`, 'pill--lav pill--small')}</div>` : ''}`;
  }

  function baselineFor(s) {
    return S.buildBaseline(sessions(), { device: s.device, before: s.createdAt, excludeId: s.id });
  }

  const LOWER_BETTER = new Set(['medianRt', 'fast10', 'slow10', 'lapses', 'falseStarts', 'kss']);
  const NEUTRAL = new Set(['tension']);

  function fmtMetric(m, v) {
    if (!isNum(v)) return '—';
    if (m === 'speed') return v.toFixed(2);
    if (m === 'medianRt' || m === 'fast10' || m === 'slow10' || m === 'hrv') return Math.round(v) + ' ms';
    if (m === 'sleepHours') return (Math.round(v * 10) / 10) + ' h';
    if (m === 'deviceReadiness') return String(Math.round(v));
    return String(Math.round(v * 10) / 10);
  }

  function detailsHtml(s) {
    const bl = baselineFor(s);
    const m = S.extractMetrics(s);
    const rows = ['speed', 'medianRt', 'fast10', 'slow10', 'lapses', 'falseStarts', 'kss', 'energy', 'tension', 'sleepHours', 'hrv', 'deviceReadiness']
      .filter((k) => isNum(m[k]))
      .map((k) => {
        const st = bl.stats[k];
        const usable = st && (!S.PVT_METRICS.includes(k) || bl.enabled);
        let diff = `<span class="muted">${esc(t('result.afterBaseline'))}</span>`;
        if (usable) {
          let z = (m[k] - st.mean) / st.sd;
          const zTxt = `${z >= 0 ? '+' : '−'}${Math.abs(z).toFixed(1)} SD`;
          if (NEUTRAL.has(k)) diff = zTxt;
          else {
            if (LOWER_BETTER.has(k)) z = -z;
            const word = Math.abs(z) < 0.5 ? t('result.similar') : z > 0 ? t('result.better') : t('result.worse');
            diff = `${zTxt}<span class="diff-word ${Math.abs(z) < 0.5 ? 'muted' : z > 0 ? 'good' : 'bad'}">${esc(word)}</span>`;
          }
        }
        const base = usable ? `${fmtMetric(k, st.mean)} ± ${fmtMetric(k, st.sd).replace(' ms', '').replace(' h', '')}` : '—';
        return `<tr><th scope="row">${esc(t('metric.' + k))}</th><td>${fmtMetric(k, m[k])}</td><td>${base}</td><td>${diff}</td></tr>`;
      }).join('');
    const weights = s.score && !s.score.provisional
      ? `<p class="muted small">${esc(t('result.weightsUsed'))}: ${Object.entries(s.score.weights).map(([k, w]) => `${esc(t('metric.' + k))} ${Math.round(w * 100)}%`).join(' · ')}</p>` : '';
    const sum = s.pvt && s.pvt.summary;
    return `<details class="details">
      <summary>${esc(t('result.details'))}${icons.chev}</summary>
      <div class="details-body">
        ${sum && sum.n ? `<figure style="margin:0"><figcaption class="muted small" style="margin-bottom:6px">${esc(t('result.rtChart'))} · ${esc(t('result.rtChartDesc'))}</figcaption>${rtHistogram(s.pvt.trials)}<p class="muted small">${esc(t('result.pvtSummary', { n: sum.n, f: sum.falseStarts }))}</p></figure>` : ''}
        <div class="table-wrap"><table class="metrics">
          <thead><tr><th scope="col">${esc(t('result.metric'))}</th><th scope="col">${esc(t('result.todayCol'))}</th><th scope="col">${esc(t('result.baselineCol'))}</th><th scope="col">${esc(t('result.diffCol'))}</th></tr></thead>
          <tbody>${rows}</tbody>
        </table></div>
        ${weights}
      </div>
    </details>`;
  }

  function rtHistogram(trials) {
    const edges = [100, 150, 200, 250, 300, 355, 400, 450, 500, Infinity];
    const counts = new Array(edges.length - 1).fill(0);
    for (const tr of trials || []) {
      if (tr.kind === 'falseStart') continue;
      const rt = tr.kind === 'timeout' ? CFG.pvt.timeoutMs : tr.rtMs;
      for (let i = 0; i < edges.length - 1; i++) if (rt >= edges[i] && rt < edges[i + 1]) { counts[i]++; break; }
    }
    const W = 340;
    const H = 150;
    const padL = 8;
    const padB = 26;
    const top = 18;
    const max = Math.max(1, ...counts);
    const bw = (W - padL * 2) / counts.length;
    let bars = '';
    counts.forEach((c, i) => {
      const h = (c / max) * (H - padB - top);
      const x = padL + i * bw + 1;
      const y = H - padB - h;
      const lapse = edges[i] >= CFG.pvt.lapseMs;
      const range = edges[i + 1] === Infinity ? `${edges[i]}+ ms` : `${edges[i]}–${edges[i + 1]} ms`;
      bars += `<g class="bar${lapse ? ' is-lapse' : ''}"><rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(bw - 3).toFixed(1)}" height="${Math.max(h, c ? 2 : 0).toFixed(1)}" rx="4"/>
        <rect class="bar-hit" x="${(x - 1).toFixed(1)}" y="${top}" width="${bw.toFixed(1)}" height="${H - padB - top}"><title>${esc(range)}: ${esc(t('result.count', { n: c }))}</title></rect></g>`;
      if (c === max) bars += `<text class="bar-val" x="${(x + (bw - 3) / 2).toFixed(1)}" y="${(y - 5).toFixed(1)}" text-anchor="middle">${c}</text>`;
    });
    const lx = padL + 5 * bw;
    const ticks = [[0, '100'], [2, '200'], [4, '300'], [5, '355'], [8, '500+']]
      .map(([i, l]) => `<text x="${(padL + i * bw).toFixed(1)}" y="${H - 8}" text-anchor="${i === 0 ? 'start' : 'middle'}">${l}</text>`).join('');
    return `<svg class="hist" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(t('result.rtChart'))}">
      <line class="axis" x1="${padL}" y1="${H - padB}" x2="${W - padL}" y2="${H - padB}"/>
      ${bars}
      <line class="threshold" x1="${lx}" y1="${top - 6}" x2="${lx}" y2="${H - padB}"/>
      <text class="threshold-lbl" x="${lx + 4}" y="${top - 2}">${esc(t('result.lapseZone'))}</text>
      ${ticks}
    </svg>`;
  }

  function viewResult(r) {
    const s = byId(r.arg) || scored().slice(-1)[0];
    if (!s) { location.replace('#/'); return null; }
    const fresh = app.revealId === s.id;
    const count = fresh ? (app.flipped[s.id] || 0) : 3;
    const active = app.active[s.id] !== undefined ? app.active[s.id] : (count > 0 ? count - 1 : -1);
    const cards = cardDefs(s);
    const all = count >= 3;
    const body = `
      <h1 class="sr-only" tabindex="-1">${esc(t('result.titleAria'))}</h1>
      <p class="reveal-prompt">${fresh && !all ? esc(t('result.prompt')) : esc(fmtWhen(s.createdAt))}</p>
      <div class="cards">${cards.map((c, i) => cardHtml(i, c, i < count, fresh && i === count, i === active)).join('')}</div>
      <section class="reading" aria-live="polite">${active >= 0 ? `<div class="reading-panel">${readingHtml(s, active)}</div>` : ''}</section>
      <section class="after${all ? '' : ' is-hidden'}">
        <div class="focus-pick">
          <h3>${esc(t('result.focusTimer'))}</h3>
          <div class="seg">${CFG.focusTimerMinutes.map((m) => `<button type="button" data-action="timer-start" data-min="${m}" data-session="${esc(s.id)}">${esc(t('minutes', { m }))}</button>`).join('')}</div>
        </div>
        <div class="btn-row">
          ${pill(t('result.logFlow'), `href="#/flow/${esc(s.id)}"`, 'pill--ghost pill--small', false)}
          ${fresh ? pill(t('result.backHome'), 'href="#/"', 'pill--ghost pill--small', false) : pill(t('result.backHistory'), 'href="#/history"', 'pill--ghost pill--small', false)}
        </div>
        ${detailsHtml(s)}
      </section>`;
    return {
      world: 'night', title: t('result.titleAria'),
      html: screen({ body, cls: 'screen--table', extra: corners(ordinal(s)), left: iconLink(fresh ? '#/' : '#/history', 'close', t('close')) }),
      mount: () => {
        const cardEls = Array.from(appEl.querySelectorAll('.tcard'));
        // Eyes on the cards and corner stamps look around and blink.
        appEl.querySelectorAll('.tcard .eye, .corner .eye').forEach((e) => eyeCtl(e, { blinkEvery: [2600, 7000] }));

        // Deal: the cards fly in from a deck below the table.
        if (fresh && count === 0 && !app.dealt[s.id]) {
          app.dealt[s.id] = true;
          if (!reduceMotion() && cardEls[0].animate) {
            cardEls.forEach((c, i) => {
              c.animate([
                { translate: `${(1 - i) * 40}px 70vh`, rotate: `${(i - 1) * -24}deg`, scale: '0.55', opacity: 0 },
                { opacity: 1, offset: 0.25 },
                { translate: '0 0', rotate: '0deg', scale: '1', opacity: 1 }
              ], { duration: 900, delay: 350 + i * 170, easing: 'cubic-bezier(0.2, 1.15, 0.35, 1)', fill: 'backwards' });
            });
          }
        }

        const showReading = (i) => {
          appEl.querySelector('.reading').innerHTML = `<div class="reading-panel swap">${readingHtml(s, i)}</div>`;
        };
        const setActive = (i) => {
          app.active[s.id] = i;
          cardEls.forEach((x, k) => { x.classList.toggle('is-active', k === i); x.setAttribute('aria-pressed', String(k === i)); });
        };
        const reveal = (i) => {
          const c = cardEls[i];
          app.flipped[s.id] = i + 1;
          setActive(i);
          c.classList.add('is-flipped');
          c.classList.remove('is-next');
          c.removeAttribute('aria-disabled');
          c.setAttribute('aria-label', `${ROMAN[i]} · ${cards[i].title.zh} ${cards[i].title.en}`);
          setTimeout(() => sparkBurst(c, 14), reduceMotion() ? 0 : 380);
          setTimeout(() => {
            c.querySelector('.tcard-front').classList.add('alive');
            if (i === 1) countUp(c.querySelector('[data-count]'), s.score.index);
          }, reduceMotion() ? 0 : 520);
          const next = cardEls[i + 1];
          if (next) {
            next.classList.add('is-next');
            next.removeAttribute('aria-disabled');
            next.setAttribute('aria-label', t('result.cardBack', { n: i + 2 }));
          }
          showReading(i);
          if (i === 2) {
            appEl.querySelector('.after').classList.remove('is-hidden');
            appEl.querySelector('.reveal-prompt').textContent = fmtWhen(s.createdAt);
          }
        };

        cardEls.forEach((c, i) => c.addEventListener('click', () => {
          const done = fresh ? (app.flipped[s.id] || 0) : 3;
          if (i < done) { setActive(i); showReading(i); return; }   // re-read a revealed card
          if (i === done) { reveal(i); return; }
          const nx = appEl.querySelector('.tcard.is-next');
          if (nx && nx.animate) nx.animate([{ translate: '0 0' }, { translate: '0 -14px' }, { translate: '0 0' }], { duration: 380, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' });
        }));
      }
    };
  }

  // ---------------- focus mode (paper) ----------------

  function viewTimer() {
    const timer = store.data.timer;
    if (!timer) { location.replace('#/'); return null; }
    timer.ideas = timer.ideas || [];
    const body = `
      <section class="paper-head">
        <p class="eyebrowless" data-rise>${esc(t('timer.title'))} · ${esc(t('minutes', { m: timer.minutes }))}</p>
        <h1 class="clock" role="timer" tabindex="-1" data-rise style="--i:1">--:--</h1>
      </section>
      <div class="scene">${ART.deskScene()}</div>
      <svg class="pencil-line" viewBox="0 0 600 14" preserveAspectRatio="none" aria-hidden="true">
        <path class="track" d="M6 7 H594"/>
        <path class="done" pathLength="1" stroke-dasharray="1 1" stroke-dashoffset="1" d="M6 7 H594"/>
      </svg>
      <form class="idea-form" autocomplete="off">
        <label class="sr-only" for="idea-in">${esc(t('timer.ideaPlaceholder'))}</label>
        <input id="idea-in" maxlength="140" placeholder="${esc(t('timer.ideaPlaceholder'))}">
        <button type="submit" class="pill pill--plain pill--ink pill--small"><span>${esc(t('timer.ideaDrop'))}</span></button>
      </form>
      <div class="btn-row" style="margin-top:8px"><button type="button" class="jar-btn" data-action="jar">${icons.jar}<span data-jar-count>${esc(t('timer.ideasCount', { n: timer.ideas.length }))}</span></button></div>
      <p class="center muted small" id="timer-hint" style="margin-top:4px">${esc(t('timer.hint'))}</p>
      <div class="focus-actions">
        ${pill(t('timer.finish'), 'data-action="timer-finish"', 'pill--ink')}
        <button type="button" class="text-btn" data-action="timer-cancel">${esc(t('timer.cancel'))}</button>
      </div>
      <dialog class="sheet" id="jar-sheet" aria-labelledby="jar-h"><div class="sheet-inner">
        <h2 id="jar-h">${esc(t('timer.ideasTitle'))}</h2>
        <ul class="idea-list"></ul>
        <div class="btn-row">${pill(t('close'), 'data-close-sheet', 'pill--paper pill--small', false)}</div>
      </div></dialog>`;
    return {
      world: 'paper', title: t('timer.title'),
      html: screen({ body, left: iconLink('#/', 'home', t('nav.home')) }),
      mount: () => {
        const clock = appEl.querySelector('.clock');
        const line = appEl.querySelector('.pencil-line .done');
        const slips = appEl.querySelector('.jar-slips');
        const jar = appEl.querySelector('[data-jar]');
        const counter = appEl.querySelector('[data-jar-count]');
        const total = timer.endsAt - timer.startedAt;
        const drawSlips = () => { slips.innerHTML = timer.ideas.map((_, k) => ART.jarSlip(k)).join(''); };
        drawSlips();
        let done = false;
        const update = () => {
          const left = timer.endsAt - Date.now();
          clock.textContent = left > 0 ? fmtClock(left) : t('timer.done');
          line.setAttribute('stroke-dashoffset', Math.max(0, left / total).toFixed(4));
          if (left <= 0 && !done) {
            done = true;
            clearInterval(iv);
            try { if (navigator.vibrate) navigator.vibrate([200, 100, 200]); } catch (e) { /* ignore */ }
            later(() => { if (app.route.name === 'timer') timerToFlow(false); }, 1600);
          }
        };
        const iv = setInterval(update, 500);
        app.cleanups.push(() => clearInterval(iv));
        update();

        const input = appEl.querySelector('#idea-in');
        appEl.querySelector('.idea-form').addEventListener('submit', (e) => {
          e.preventDefault();
          const text = input.value.trim();
          if (!text) { input.focus(); return; }
          timer.ideas.push({ text, at: new Date().toISOString() });
          persist();
          const k = timer.ideas.length - 1;
          const land = () => {
            slips.insertAdjacentHTML('beforeend', ART.jarSlip(k).replace('class="slip"', 'class="slip new"'));
            counter.textContent = t('timer.ideasCount', { n: timer.ideas.length });
          };
          // A paper slip flies from the input into the jar.
          const from = input.getBoundingClientRect();
          const to = jar.getBoundingClientRect();
          if (!reduceMotion() && document.body.animate) {
            const slip = document.createElement('div');
            slip.className = 'flying-slip';
            slip.textContent = text;
            document.body.appendChild(slip);
            const sx = from.left + 12;
            const sy = from.top + from.height / 2 - 14;
            const dx = to.left + to.width / 2 - sx - 40;
            const dy = to.top + to.height * 0.55 - sy;
            slip.style.left = sx + 'px';
            slip.style.top = sy + 'px';
            const a = slip.animate([
              { transform: 'translate(0,0) rotate(0deg) scale(1)', opacity: 1 },
              { transform: `translate(${dx * 0.5}px, ${Math.min(dy, 0) - 80}px) rotate(-12deg) scale(.8)`, opacity: 1, offset: 0.5 },
              { transform: `translate(${dx}px, ${dy}px) rotate(18deg) scale(.18)`, opacity: 0.2 }
            ], { duration: 820, easing: 'cubic-bezier(0.33, 1, 0.68, 1)' });
            a.onfinish = () => { slip.remove(); land(); };
          } else land();
          input.value = '';
          input.focus();
        });

        const sheet = appEl.querySelector('#jar-sheet');
        const fill = () => {
          const ul = sheet.querySelector('.idea-list');
          ul.innerHTML = timer.ideas.length
            ? timer.ideas.map((x, k) => `<li><span>${esc(x.text)}</span><button type="button" class="icon-btn" data-rm="${k}" aria-label="${esc(t('timer.remove'))}">${icons.close}</button></li>`).join('')
            : `<li class="empty">${esc(t('timer.ideasEmpty'))}</li>`;
          ul.querySelectorAll('[data-rm]').forEach((b) => b.addEventListener('click', () => {
            timer.ideas.splice(Number(b.dataset.rm), 1);
            persist();
            drawSlips();
            counter.textContent = t('timer.ideasCount', { n: timer.ideas.length });
            fill();
          }));
        };
        appEl.querySelector('[data-action="jar"]').addEventListener('click', () => {
          fill();
          if (sheet.showModal) sheet.showModal(); else sheet.setAttribute('open', '');
        });
        sheet.querySelector('[data-close-sheet]').addEventListener('click', () => sheet.close());
      }
    };
  }

  // Ideas dropped during a focus block are kept on the session they belong to.
  function keepIdeas(timer) {
    const s = timer && byId(timer.sessionId);
    if (s && timer.ideas && timer.ideas.length) s.ideas = (s.ideas || []).concat(timer.ideas);
  }

  function timerToFlow(early) {
    const timer = store.data.timer;
    if (!timer) return;
    const mins = early ? Math.max(1, Math.round((Date.now() - timer.startedAt) / 60000)) : timer.minutes;
    keepIdeas(timer);
    app.flowPrefill = { sessionId: timer.sessionId, durationMin: mins };
    store.data.timer = null;
    persist();
    go('#/flow/' + timer.sessionId, 'forward');
  }

  function viewBreathe(r) {
    const s = byId(r.arg);
    const B = CFG.breathing;
    const back = s ? '#/result/' + s.id : '#/';
    const body = `
      <h1 class="center" tabindex="-1" style="font-size:28px;margin-top:8px">${esc(t('breathe.title'))}</h1>
      <div class="breath"><div class="breath-orb"><span class="breath-word" aria-live="polite">${esc(t('breathe.inhale'))}</span></div></div>
      <p class="center muted" id="breath-left">${esc(t('breathe.remaining', { t: fmtClock(B.totalSec * 1000) }))}</p>
      <div class="btn-row" style="margin-top:14px">${pill(t('breathe.stop'), `href="${back}" id="breath-done"`, 'pill--ghost', false)}</div>`;
    return {
      world: 'night', title: t('breathe.title'),
      html: screen({ body, left: iconLink(back, 'close', t('close')) }),
      mount: () => {
        const orb = appEl.querySelector('.breath-orb');
        const word = appEl.querySelector('.breath-word');
        const left = appEl.querySelector('#breath-left');
        const t0 = Date.now();
        let phase = '';
        const cycle = (B.inhaleSec + B.exhaleSec) * 1000;
        orb.style.setProperty('--in', B.inhaleSec + 's');
        orb.style.setProperty('--out', B.exhaleSec + 's');
        const tick = () => {
          const el = Date.now() - t0;
          if (el >= B.totalSec * 1000) {
            clearInterval(iv);
            orb.className = 'breath-orb is-done';
            word.textContent = t('breathe.finish');
            left.textContent = t('breathe.done');
            appEl.querySelector('#breath-done span').textContent = t('breathe.finish');
            return;
          }
          const p = el % cycle < B.inhaleSec * 1000 ? 'inhale' : 'exhale';
          if (p !== phase) { phase = p; orb.className = 'breath-orb is-' + p; word.textContent = t('breathe.' + p); }
          left.textContent = t('breathe.remaining', { t: fmtClock(B.totalSec * 1000 - el) });
        };
        const iv = setInterval(tick, 200);
        app.cleanups.push(() => clearInterval(iv));
        requestAnimationFrame(tick);
      }
    };
  }

  // ---------------- flow log (paper) ----------------

  function viewFlow(r) {
    const list = sessions().slice().reverse();
    if (!list.length) {
      const body = `<section class="log"><h1 tabindex="-1">${esc(t('flow.title'))}</h1><p class="center">${esc(t('flow.noSessions'))}</p><div class="btn-row">${pill(t('homeView.start'), 'href="#/check/kss" data-action="start"', 'pill--ink')}</div></section>`;
      return { world: 'paper', title: t('flow.title'), html: screen({ body, left: iconLink('#/', 'home', t('nav.home')) }) };
    }
    const pre = app.flowPrefill;
    const s = byId(r.arg) || (pre && byId(pre.sessionId)) || list[0];
    const f = s.flow || {};
    const draft = {
      rating: isNum(f.rating) ? f.rating : null,
      taskType: f.taskType || (s.context && s.context.taskType) || null,
      durationMin: pre && pre.sessionId === s.id ? pre.durationMin : (isNum(f.durationMin) ? f.durationMin : null),
      interruptions: isNum(f.interruptions) ? f.interruptions : null
    };
    const opts = list.map((x) => `<option value="${esc(x.id)}" ${x.id === s.id ? 'selected' : ''}>${esc(t('flow.sessionOption', { when: fmtWhen(x.createdAt), index: x.score ? x.score.index : '—' }))}${x.flow ? esc(t('flow.logged')) : ''}</option>`).join('');
    let rates = '';
    for (let i = 1; i <= 10; i++) rates += `<button type="button" role="radio" class="choice" data-value="${i}" aria-checked="${draft.rating === i}" tabindex="${draft.rating === i || (draft.rating === null && i === 1) ? 0 : -1}">${i}</button>`;
    const ideas = s.ideas || [];
    const body = `
      <section class="log">
        <h1 tabindex="-1" data-rise>${esc(t('flow.title'))}</h1>
        <div class="lfield" data-rise style="--i:1">
          <label for="f-session" class="sr-only">${esc(t('flow.session'))}</label>
          <select id="f-session" class="paper-select">${opts}</select>
          ${s.flow ? `<p class="muted small">${esc(t('flow.overwrite'))}</p>` : ''}
        </div>
        <div class="wave-card" data-rise style="--i:2">
          <svg viewBox="0 0 320 90" preserveAspectRatio="none" aria-hidden="true"><path d="${ART.flowWave(draft.rating || 5)}"/></svg>
          <span class="big ${draft.rating ? '' : 'empty'}">${draft.rating || '–'}</span>
        </div>
        <div class="lfield" data-rise style="--i:3">
          <p class="center" id="q-flow">${esc(t('flow.rating'))}</p>
          <div class="rate" role="radiogroup" aria-labelledby="q-flow">${rates}</div>
          <p class="scale-ends" aria-hidden="true"><span>1 ${esc(t('flow.ratingLow'))}</span><span>${esc(t('flow.ratingHigh'))} 10</span></p>
        </div>
        <div class="prow" data-rise style="--i:4"><label for="f-durationMin">${esc(t('flow.duration'))}</label>${stepper('durationMin', draft.durationMin, app.lang === 'en' ? 'min' : '分')}</div>
        <div class="lfield"><p>${esc(t('flow.task'))}</p>${taskChips(draft.taskType)}</div>
        <div class="prow"><label for="f-interruptions">${esc(t('flow.interruptions'))}</label>${stepper('interruptions', draft.interruptions)}</div>
        ${ideas.length ? `<div class="lfield"><p>${esc(t('flow.ideas'))}</p><div class="slips">${ideas.map((x) => `<span>${esc(x.text)}</span>`).join('')}</div></div>` : ''}
        <div class="lfield"><label for="f-notes">${esc(t('flow.notes'))}</label><textarea id="f-notes" class="paper-input" rows="3">${esc(f.notes || '')}</textarea></div>
        <p class="hint" id="flow-msg" aria-live="polite"></p>
        <div class="btn-row">${pill(t('flow.save'), 'id="flow-save"', 'pill--ink')}</div>
      </section>`;
    return {
      world: 'paper', title: t('flow.title'),
      html: screen({ body, left: iconLink('#/', 'home', t('nav.home')) }),
      mount: () => {
        appEl.querySelector('#f-session').addEventListener('change', (e) => location.replace('#/flow/' + e.target.value));
        const wave = appEl.querySelector('.wave-card path');
        const big = appEl.querySelector('.wave-card .big');
        appEl.querySelectorAll('.rate .choice').forEach((b) => b.addEventListener('click', () => {
          draft.rating = Number(b.dataset.value);
          appEl.querySelectorAll('.rate .choice').forEach((x) => { x.setAttribute('aria-checked', String(x === b)); x.tabIndex = x === b ? 0 : -1; });
          wave.setAttribute('d', ART.flowWave(draft.rating));
          big.textContent = String(draft.rating);
          big.classList.remove('empty');
          if (!reduceMotion() && big.animate) big.animate([{ transform: 'scale(.7)' }, { transform: 'scale(1)' }], { duration: 380, easing: 'cubic-bezier(0.2, 1.3, 0.35, 1)' });
        }));
        bindSteppers(draft);
        bindTaskChips(() => draft.taskType, (v) => { draft.taskType = v; });
        appEl.querySelector('#flow-save').addEventListener('click', () => {
          const msg = appEl.querySelector('#flow-msg');
          if (!isNum(draft.rating)) {
            msg.textContent = t('flow.needRating');
            msg.classList.remove('shake'); void msg.offsetWidth; msg.classList.add('shake');
            return;
          }
          s.flow = {
            loggedAt: new Date().toISOString(),
            durationMin: draft.durationMin,
            rating: draft.rating,
            taskType: draft.taskType,
            interruptions: draft.interruptions,
            notes: appEl.querySelector('#f-notes').value.trim() || null
          };
          if (app.flowPrefill && app.flowPrefill.sessionId === s.id) app.flowPrefill = null;
          persist();
          toast(t('flow.saved'));
          app.hist.sel = s.id;
          app.hist.tab = 'stars';
          go('#/history', 'forward');
        });
      }
    };
  }

  // ---------------- history ----------------

  function viewHistory() {
    const list = scored();
    const tab = app.hist.tab;
    const tabs = ['stars', 'insights', 'time'].map((k) => {
      const label = t('history.tab' + k.charAt(0).toUpperCase() + k.slice(1));
      return `<button type="button" role="tab" id="tab-${k}" class="tab" data-tab="${k}" aria-selected="${tab === k}" aria-controls="panel" tabindex="${tab === k ? 0 : -1}">${esc(label)}</button>`;
    }).join('');
    let panel = '';
    if (tab === 'stars') panel = list.length ? starsPanel(list) : `<div class="need-more"><p>${esc(t('history.empty'))}</p></div>`;
    if (tab === 'insights') panel = insightsPanel();
    if (tab === 'time') panel = timePanel();
    const body = `
      <h1 class="page-title" tabindex="-1">${esc(t('history.title'))}</h1>
      <div><div class="tabs" role="tablist" aria-label="${esc(t('history.title'))}">${tabs}</div></div>
      <div id="panel" role="tabpanel" aria-labelledby="tab-${tab}">${panel}</div>`;
    return {
      world: 'night', title: t('history.title'),
      html: screen({ body, left: wordmark(), dockKey: 'history' }),
      mount: () => {
        const tabEls = Array.from(appEl.querySelectorAll('[role="tab"]'));
        const show = (k) => { app.hist.tab = k; render('fade'); focusLater(`[data-tab="${k}"]`); };
        tabEls.forEach((b, i) => {
          b.addEventListener('click', () => show(b.dataset.tab));
          b.addEventListener('keydown', (e) => {
            if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
            e.preventDefault();
            e.stopPropagation();
            show(tabEls[(i + (e.key === 'ArrowRight' ? 1 : tabEls.length - 1)) % tabEls.length].dataset.tab);
          });
        });
        if (tab === 'stars' && list.length) mountStars(list);
      }
    };
  }

  function focusLater(sel) {
    setTimeout(() => { const el = appEl.querySelector(sel); if (el) el.focus(); }, 60);
  }

  function starsPanel(list) {
    return `
      <p class="muted small" style="margin-bottom:6px">${esc(t('history.legend'))}</p>
      <div class="star-scroll" tabindex="0" aria-label="${esc(t('history.chartLabel', { n: list.length }))}"><div class="star-host"></div></div>
      <div class="hist-nav">
        <button type="button" class="icon-btn" data-hist="-1" aria-label="${esc(t('history.prev'))}">${icons.back}</button>
        <div class="hist-detail" aria-live="polite"></div>
        <button type="button" class="icon-btn" data-hist="1" aria-label="${esc(t('history.next'))}">${icons.next}</button>
      </div>`;
  }

  function drawStarmap(host, list, sel, width) {
    const height = host.clientHeight || 260;
    const top = 34;
    const bottom = height - 26;
    const pad = 44;
    const n = list.length;
    const step = n > 1 ? (width - pad * 2) / (n - 1) : 0;
    const pts = list.map((s, i) => ({ x: n > 1 ? pad + i * step : width / 2, y: bottom - (s.score.index / 100) * (bottom - top), s }));
    const d = n > 1 ? SK.smoothPath(SK.catmull(pts, 6)) : '';
    let grid = '';
    [25, 50, 75].forEach((v) => { const y = bottom - (v / 100) * (bottom - top); grid += `<line class="sm-grid" x1="0" x2="${width}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}"/>`; });
    let marks = '';
    pts.forEach((p, i) => {
      const flow = p.s.flow ? p.s.flow.rating : null;
      const r = flow ? 2.5 + flow * 0.55 : 2.6;
      const prov = p.s.score.provisional ? ' is-prov' : '';
      if (i === sel) marks += `<circle class="sm-glow" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="20"/>`;
      marks += flow
        ? `<path class="sm-pt${prov}" d="${SK.starPath(p.x, p.y, r * 1.5, r * 0.6, 4, -Math.PI / 2)}"/>`
        : `<circle class="sm-pt${prov}" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${r}"/>`;
      if (i === sel) marks += `<circle class="sm-sel" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="5"/>`;
      marks += `<circle class="sm-hit" data-pt="${i}" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="22"><title>${esc(t('history.pointLabel', { when: fmtWhen(p.s.createdAt), index: p.s.score.index }))}</title></circle>`;
    });
    host.innerHTML = `<svg class="starmap" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="${esc(t('history.chartLabel', { n }))}">${grid}${d ? `<path class="sm-line" pathLength="1" d="${d}"/>` : ''}${marks}</svg>`;
    return pts;
  }

  function mountStars(list) {
    const scroller = appEl.querySelector('.star-scroll');
    const host = appEl.querySelector('.star-host');
    let sel = list.findIndex((s) => s.id === app.hist.sel);
    if (sel < 0) sel = list.length - 1;
    let pts = [];
    let suppress = false;
    const spacing = () => (scroller.clientWidth >= 700 ? 92 : 58);
    const width = () => Math.round(Math.max(scroller.clientWidth, (list.length - 1) * spacing() + 88));
    const draw = () => {
      pts = drawStarmap(host, list, sel, width());
      host.querySelectorAll('.sm-hit').forEach((c) => c.addEventListener('click', () => select(Number(c.dataset.pt), true)));
    };
    const center = (smooth) => {
      suppress = true;
      scroller.scrollTo({ left: pts[sel].x - scroller.clientWidth / 2, behavior: smooth && !reduceMotion() ? 'smooth' : 'auto' });
      setTimeout(() => { suppress = false; }, smooth ? 900 : 80);
    };
    const detail = () => {
      const s = list[sel];
      const a = s.score.archetype;
      const th = ART.CARD_THEME[a];
      const nIdeas = (s.ideas || []).length;
      appEl.querySelector('.hist-detail').innerHTML = `<div class="hist-card">
        <span class="mini-face" style="background:${th.bg};color:${th.fg}">${s.score.index}</span>
        <div>
          <p class="when">${esc(fmtWhen(s.createdAt))}</p>
          <p class="name">${esc(t('archetype.' + a + '.zh'))}${app.lang === 'en' ? ' · ' + esc(t('archetype.' + a + '.en')) : ''} ${s.score.provisional ? `<span class="tag-prov">${esc(app.lang === 'en' ? 'provisional' : '暫定')}</span>` : ''}</p>
          <p class="meta">${s.flow ? '★ ' + esc(t('history.flowRating', { r: s.flow.rating })) : esc(t('history.noFlow'))}${nIdeas ? ' · ' + esc(t('history.ideas', { n: nIdeas })) : ''}</p>
          <p class="links"><a class="link" href="#/result/${esc(s.id)}">${esc(t('history.openCards'))}</a>${s.flow ? '' : `<a class="link" href="#/flow/${esc(s.id)}">${esc(t('history.logFlow'))}</a>`}</p>
        </div>
      </div>`;
    };
    const select = (i, scroll) => {
      if (i < 0 || i >= list.length || i === sel) return;
      sel = i;
      app.hist.sel = list[i].id;
      const left = scroller.scrollLeft;
      draw();
      scroller.scrollLeft = left;
      detail();
      if (scroll) center(true);
    };
    draw();
    detail();
    center(false);
    app.hist.select = (dir) => select(sel + dir, true);
    appEl.querySelectorAll('[data-hist]').forEach((b) => b.addEventListener('click', () => select(sel + Number(b.dataset.hist), true)));
    // Swiping the map walks the selection to the star nearest the centre.
    let st = 0;
    scroller.addEventListener('scroll', () => {
      if (suppress) return;
      clearTimeout(st);
      st = setTimeout(() => {
        const maxLeft = scroller.scrollWidth - scroller.clientWidth;
        const cx = scroller.scrollLeft + scroller.clientWidth / 2;
        let best = sel;
        let bd = Infinity;
        pts.forEach((p, i) => { const dd = Math.abs(p.x - cx); if (dd < bd) { bd = dd; best = i; } });
        if (maxLeft > 0 && scroller.scrollLeft >= maxLeft - 2) best = list.length - 1;
        if (maxLeft > 0 && scroller.scrollLeft <= 2) best = 0;
        if (best !== sel) select(best, false);
      }, 160);
    });
    let lastW = window.innerWidth;
    const onResize = () => { if (window.innerWidth === lastW) return; lastW = window.innerWidth; draw(); center(false); };
    window.addEventListener('resize', onResize);
    app.cleanups.push(() => { window.removeEventListener('resize', onResize); clearTimeout(st); app.hist.select = null; });
  }

  function insightsPanel() {
    const ins = S.flowInsights(sessions());
    if (!ins.ready) {
      const k = ins.needed - ins.nFlow;
      return `<div class="need-more"><p>${esc(t('insights.needMore', { k }))}</p>
        <div class="progress-dots" role="img" aria-label="${ins.nFlow} / ${ins.needed}">${Array.from({ length: ins.needed }, (_, i) => `<span class="${i < ins.nFlow ? 'on' : ''}"></span>`).join('')}</div></div>`;
    }
    const sentence = (f) => {
      if (f.metric === 'hour') return t(f.r >= 0 ? 'insights.hourUp' : 'insights.hourDown');
      return t(f.r >= 0 ? 'insights.up' : 'insights.down', { metric: t('metric.' + f.metric) });
    };
    const bar = (f) => {
      const w = Math.min(50, Math.abs(f.r) * 50);
      return `<span class="rbar" aria-hidden="true"><span class="rbar-axis"></span><span class="rbar-fill ${f.r >= 0 ? 'pos' : 'neg'}" style="${f.r >= 0 ? 'left:50%' : `left:${50 - w}%`};width:${w}%"></span></span>`;
    };
    const top = ins.factors.filter((f) => Math.abs(f.r) >= 0.1).slice(0, CFG.insights.topFactors);
    const topHtml = top.length ? `<ol class="factors">${top.map((f) => `<li>
        <p class="f-name">${esc(t('metric.' + f.metric))}</p>
        <p class="f-r ${f.r >= 0 ? 'pos' : 'neg'}">${f.r >= 0 ? '+' : '−'}${Math.abs(f.r).toFixed(2)}</p>
        <p>${esc(sentence(f))}</p>
        <p class="muted small">${esc(t('insights.strength.' + f.strength))} · ${esc(t('insights.n', { n: f.n }))}</p>
      </li>`).join('')}</ol>` : `<p>${esc(t('insights.none'))}</p>`;
    const rows = ins.factors.map((f) => `<tr><th scope="row">${esc(t('metric.' + f.metric))}</th><td>${bar(f)}</td><td class="num">${f.r >= 0 ? '+' : '−'}${Math.abs(f.r).toFixed(2)}</td><td class="num">${f.n}</td></tr>`).join('');
    return `
      <h2 style="font-size:22px;margin-bottom:12px">${esc(t('insights.title'))}</h2>
      ${topHtml}
      <p class="caveat">${esc(t('insights.caveat'))} ${esc(t('insights.method'))}</p>
      <details class="details"><summary>${esc(t('insights.allTitle'))}${icons.chev}</summary><div class="details-body"><div class="table-wrap"><table class="metrics ink-table">
        <thead><tr><th scope="col">${esc(t('result.metric'))}</th><th scope="col"><span class="axis-lbl"><span>${esc(t('insights.axisNeg'))}</span><span>${esc(t('insights.axisPos'))}</span></span></th><th scope="col">r</th><th scope="col">n</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div></div></details>`;
  }

  function timePanel() {
    const td = S.timeOfDay(sessions());
    const max = Math.max(1, ...td.buckets.map((b) => b.mean || 0));
    const bars = td.buckets.map((b, i) => `<li class="tod${td.best === b.id ? ' is-best' : ''}">
        <span class="tod-lbl">${esc(t('timeOfDay.bucket.' + b.id))}</span>
        <span class="tod-track"><span class="tod-fill" style="width:${b.mean ? (b.mean / max) * 100 : 0}%;--i:${i}"></span></span>
        <span class="tod-val">${b.mean !== null ? b.mean : '—'}</span>
      </li>`).join('');
    const best = td.buckets.find((b) => b.id === td.best);
    return `
      <h2 style="font-size:22px;margin-bottom:6px">${esc(t('timeOfDay.title'))}</h2>
      <p class="best-line">${best ? esc(t('timeOfDay.best', { bucket: t('timeOfDay.bucket.' + best.id), mean: best.mean, n: best.n })) : `<span class="muted">${esc(t('timeOfDay.needMore'))}</span>`}</p>
      <ul class="tod-list">${bars}</ul>`;
  }

  // ---------------- settings & about ----------------

  function viewSettings() {
    const n = sessions().length;
    const devices = ['touch', 'keyboard', 'mouse'].map((d) => {
      const b = S.buildBaseline(sessions(), { device: d });
      return `<div class="row"><span>${esc(t('device.' + d))}</span><span class="val">${Math.min(b.n, CFG.baseline.minSessions)} / ${CFG.baseline.minSessions}${b.enabled ? ' ✓' : ''}</span></div>`;
    }).join('');
    const body = `
      <h1 class="page-title" tabindex="-1">${esc(t('settings.title'))}</h1>
      <div class="group">
        <div class="row"><span>${esc(t('settings.language'))}</span>
          <span class="lang-seg" role="group" aria-label="${esc(t('settings.language'))}">
            <button type="button" data-action="set-lang" data-lang="zh-TW" aria-pressed="${app.lang === 'zh-TW'}" lang="zh-Hant">中文</button>
            <button type="button" data-action="set-lang" data-lang="en" aria-pressed="${app.lang === 'en'}" lang="en">EN</button>
          </span></div>
      </div>
      <div class="group">
        <h2>${esc(t('settings.data'))} · ${esc(t('settings.count', { n }))}</h2>
        <button type="button" class="row" data-action="export-json">${esc(t('settings.exportJson'))}${icons.next}</button>
        <button type="button" class="row" data-action="import-json">${esc(t('settings.importJson'))}${icons.next}</button>
        <button type="button" class="row" data-action="export-csv">${esc(t('settings.exportCsv'))}${icons.next}</button>
        <button type="button" class="row danger" data-action="clear-data">${esc(t('settings.clear'))}${icons.next}</button>
      </div>
      <input type="file" id="import-file" accept="application/json,.json" hidden>
      <p class="hint" id="settings-msg" aria-live="polite"></p>
      <div class="group"><h2>${esc(t('settings.baselines'))}</h2>${devices}</div>
      <div class="group">
        <a class="row" href="#/about">${esc(t('settings.about'))}${icons.next}</a>
        <button type="button" class="row" data-action="replay-tour">${esc(t('settings.tour'))}${icons.next}</button>
      </div>
      <p class="settings-note">${esc(t('settings.privacy'))} ${esc(store.available ? t('settings.storageOk') : t('settings.storageOff'))}</p>
      <dialog class="dialog" id="clear-dialog" aria-labelledby="clear-h">
        <form method="dialog">
          <h2 id="clear-h">${esc(t('settings.clear'))}</h2>
          <p class="muted" id="clear-text">${esc(t('settings.clearConfirm1'))}</p>
          <div class="clear-step2" hidden>
            <label for="clear-word" class="muted" style="display:block;margin-top:12px">${esc(t('settings.clearConfirm2', { word: t('settings.clearWord') }))}</label>
            <input id="clear-word" autocomplete="off">
          </div>
          <div class="btn-row">
            <button type="submit" value="cancel" class="text-btn">${esc(t('cancel'))}</button>
            <button type="button" class="pill pill--plain pill--small" id="clear-go" style="background:var(--warn)"><span>${esc(t('settings.clearContinue'))}</span></button>
          </div>
        </form>
      </dialog>`;
    return {
      world: 'night', title: t('settings.title'),
      html: screen({ body, left: wordmark(), dockKey: 'settings' }),
      mount: () => {
        const file = appEl.querySelector('#import-file');
        file.addEventListener('change', () => {
          const f = file.files && file.files[0];
          if (!f) return;
          const reader = new FileReader();
          reader.onload = () => {
            const msg = appEl.querySelector('#settings-msg');
            const res = PFC.storage.parseImport(String(reader.result));
            if (!res.ok) { msg.textContent = t('settings.importErr.' + res.error); return; }
            const merged = PFC.storage.mergeSessions(sessions(), res.data.sessions);
            store.data.sessions = merged.sessions;
            store.data.settings.onboarded = true;
            persist();
            render();
            toast(t('settings.importOk', { added: merged.added, total: merged.total }));
            const m2 = appEl.querySelector('#settings-msg');
            if (m2) m2.textContent = t('settings.importOk', { added: merged.added, total: merged.total });
          };
          reader.readAsText(f);
          file.value = '';
        });
      }
    };
  }

  function viewAbout() {
    const sections = t('about.sections');
    const refs = PFC.REFERENCES.map((r) => `<li>${esc(r.text)}${r.url ? ` <a class="inline-link" href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.url.replace('https://', ''))}</a>` : ''}</li>`).join('');
    const body = `
      <article class="about">
        <h1 class="page-title" tabindex="-1">${esc(t('about.title'))}</h1>
        ${sections.map((s) => `<section><h2>${esc(s.h)}</h2>${s.refs ? `<ol class="refs">${refs}</ol>` : s.p.map((p) => `<p>${esc(p)}</p>`).join('')}</section>`).join('')}
        <p class="disclaimer-box">${esc(t('disclaimer'))}</p>
      </article>`;
    return { world: 'night', title: t('about.title'), html: screen({ body, left: iconLink('#/settings', 'back', t('back')), dockKey: 'settings' }) };
  }

  // ---------------- actions ----------------

  function download(name, text, type) {
    try {
      const blob = new Blob([text], { type });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      toast(String(e));
    }
  }
  const stamp = () => new Date().toISOString().slice(0, 10);

  function setLang(lang) {
    app.lang = lang === 'en' ? 'en' : 'zh-TW';
    store.setPref('lang', app.lang);
    document.documentElement.lang = t('htmlLang');
    render('fade');
    focusLater('.lang-btn, .lang-seg button[aria-pressed="true"]');
  }

  const ACTIONS = {
    lang: () => setLang(app.lang === 'en' ? 'zh-TW' : 'en'),
    'set-lang': (el) => setLang(el.dataset.lang),
    start: (el, e) => { e.preventDefault(); app.draft = newDraft(); go('#/check/kss', 'forward'); },
    'welcome-next': () => welcomeGo(1),
    'welcome-skip': () => finishWelcome(false),
    'replay-tour': () => { app.welcome = 0; go('#/welcome', 'fade'); },
    'step-next': () => stepGo(STEPS.includes(app.route.arg) ? app.route.arg : 'kss', 1),
    'pvt-start': () => startPvt(),
    'timer-start': (el) => {
      const min = Number(el.dataset.min);
      const now = Date.now();
      const minutesMs = (FAST_PVT ? 1000 : 60000) * min; // test mode: minutes become seconds
      store.data.timer = { sessionId: el.dataset.session, startedAt: now, endsAt: now + minutesMs, minutes: min, ideas: [] };
      persist();
      go('#/timer', 'forward');
    },
    'timer-finish': () => timerToFlow(true),
    'timer-cancel': () => {
      keepIdeas(store.data.timer);
      store.data.timer = null;
      persist();
      go('#/', 'back');
    },
    'timer-log': () => timerToFlow(false),
    'export-json': () => download(`pre-flow-check-${stamp()}.json`, JSON.stringify(store.data, null, 2), 'application/json'),
    'export-csv': () => download(`pre-flow-check-${stamp()}.csv`, PFC.storage.toCsv(sessions()), 'text/csv;charset=utf-8'),
    'import-json': () => appEl.querySelector('#import-file').click(),
    'clear-data': () => {
      const dlg = appEl.querySelector('#clear-dialog');
      const step2 = dlg.querySelector('.clear-step2');
      const go2 = dlg.querySelector('#clear-go');
      const word = dlg.querySelector('#clear-word');
      step2.hidden = true;
      word.value = '';
      go2.querySelector('span').textContent = t('settings.clearContinue');
      go2.onclick = () => {
        if (step2.hidden) {
          step2.hidden = false;
          go2.querySelector('span').textContent = t('settings.clearConfirm');
          word.focus();
          return;
        }
        if (word.value.trim().toUpperCase() !== t('settings.clearWord').toUpperCase()) { word.focus(); word.select(); return; }
        store.clear();
        store.data.settings.onboarded = true;
        persist();
        dlg.close();
        app.hist.sel = null;
        render();
        toast(t('settings.clearDone'));
        const m = appEl.querySelector('#settings-msg');
        if (m) m.textContent = t('settings.clearDone');
      };
      if (typeof dlg.showModal === 'function') dlg.showModal();
      else if (window.confirm(t('settings.clearConfirm1')) && window.prompt(t('settings.clearConfirm2', { word: t('settings.clearWord') })) === t('settings.clearWord')) {
        store.clear(); persist(); render(); toast(t('settings.clearDone'));
      }
    }
  };

  document.addEventListener('click', (e) => {
    const vtLink = e.target.closest && e.target.closest('a[data-vt]');
    if (vtLink) app.nextVt = vtLink.dataset.vt;
    const el = e.target.closest && e.target.closest('[data-action]');
    if (!el) return;
    const fn = ACTIONS[el.dataset.action];
    if (fn) fn(el, e);
  });

  // Radio groups: arrow keys move and select. Elsewhere ← → move through the guide, intro and history.
  document.addEventListener('keydown', (e) => {
    const radio = e.target.closest && e.target.closest('[role="radio"]');
    if (radio) {
      const keys = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
      if (keys[e.key] || e.key === 'Home' || e.key === 'End') {
        e.preventDefault();
        const items = Array.from(radio.closest('[role="radiogroup"]').querySelectorAll('[role="radio"]'));
        const i = items.indexOf(radio);
        const n = e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1 : (i + keys[e.key] + items.length) % items.length;
        items[n].focus();
        items[n].click();
      }
      return;
    }
    if (document.body.classList.contains('pvt-lock')) return;
    const tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable) return;
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const dir = e.key === 'ArrowRight' ? 1 : -1;
    if (app.route.name === 'check') { e.preventDefault(); stepGo(STEPS.includes(app.route.arg) ? app.route.arg : 'kss', dir); }
    else if (app.route.name === 'welcome') { e.preventDefault(); welcomeGo(dir); }
    else if (app.route.name === 'history' && app.hist.select) { e.preventDefault(); app.hist.select(dir); }
  });

  // ---------------- router ----------------

  const VIEWS = {
    home: viewHome, welcome: viewWelcome, check: viewCheck, result: viewResult, flow: viewFlow, history: viewHistory,
    settings: viewSettings, about: viewAbout, timer: viewTimer, breathe: viewBreathe
  };

  function parseRoute() {
    const h = location.hash.replace(/^#\/?/, '').split('?')[0];
    const parts = h.split('/').filter(Boolean).map(decodeURIComponent);
    return { name: VIEWS[parts[0]] ? parts[0] : 'home', arg: parts[1] || null };
  }

  function go(hash, vt) {
    app.nextVt = vt || null;
    if (location.hash === hash) { const v = app.nextVt; app.nextVt = null; render(v); }
    else location.hash = hash;
  }

  function render(vt) {
    const prevKey = app.route.name + '/' + app.route.arg;
    const swap = () => {
      for (const fn of app.cleanups.splice(0)) { try { fn(); } catch (e) { /* ignore */ } }
      const route = parseRoute();
      app.route = route;
      const out = VIEWS[route.name](route);
      if (!out) return; // the view redirected
      document.body.dataset.world = out.world || 'night';
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', out.world === 'paper' ? '#F4EEE2' : '#0D0B12');
      document.title = out.title === t('appName') ? out.title : `${out.title} · ${t('appShort')}`;
      appEl.innerHTML = out.html;
      if (out.mount) out.mount();
      const changed = prevKey !== route.name + '/' + route.arg;
      if (changed) window.scrollTo(0, 0);
      // Move focus to the new heading so screen readers announce the change.
      const h1 = appEl.querySelector('h1');
      if (h1 && changed) h1.focus({ preventScroll: true });
    };
    const html = document.documentElement;
    if (vt && document.startViewTransition && app.booted && !reduceMotion()) {
      if (vt !== 'fade') html.dataset.vt = vt;
      const tr = document.startViewTransition(swap);
      tr.finished.finally(() => { delete html.dataset.vt; });
    } else {
      swap();
    }
  }

  function onHashChange() {
    const vt = app.nextVt || 'fade';
    app.nextVt = null;
    render(vt);
  }

  // If a focus timer ended while the app was closed, open the flow log (pre-filled).
  function checkTimer() {
    const timer = store.data.timer;
    if (timer && timer.endsAt <= Date.now() && app.route.name !== 'flow') timerToFlow(false);
  }

  // ---------------- boot ----------------

  store.load();
  app.lang = store.getPref('lang', 'zh-TW') === 'en' ? 'en' : 'zh-TW';
  document.documentElement.lang = t('htmlLang');
  window.addEventListener('hashchange', onHashChange);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') checkTimer(); });
  render();
  app.booted = true;
  checkTimer();

  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol) && !params.has('nosw')) {
    // When a new version takes over, reload once so the new files are used straight away —
    // but never in the middle of a reaction test or a focus block.
    const hadController = !!navigator.serviceWorker.controller;
    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController || reloading) return;
      if (document.body.classList.contains('pvt-lock') || app.route.name === 'timer') return;
      reloading = true;
      location.reload();
    });
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' })
        .then((reg) => {
          // Check for a new version whenever the app comes back to the foreground.
          document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); });
        })
        .catch(() => {});
    });
  }

  // Exposed for automated tests only.
  window.__pfc = { app, store, render };
})();
