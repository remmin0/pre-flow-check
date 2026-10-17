/*
 * Pre-Flow Check — app shell: hash router, views and interactions.
 * Views return { title, html, mount } and are rendered into #app.
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

  const appEl = document.getElementById('app');
  const reduceMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const app = {
    lang: 'zh-TW',
    draft: null,          // check-in in progress
    revealId: null,       // session whose cards are waiting to be flipped
    flipped: {},          // sessionId -> number of cards turned
    figureFrac: null,     // last stick-figure position on the step pages
    hist: { sel: null, tab: 'horizon' },
    flowPrefill: null,
    cleanups: [],
    route: { name: 'home', arg: null }
  };

  // ---------------- i18n ----------------

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

  // ---------------- small UI atoms ----------------

  const icons = {
    home: `<svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true" focusable="false"><path d="${SK.line(6, 15, 16, 6, 21)} ${SK.line(16, 6, 26, 15, 22)} ${SK.line(9, 13, 9, 26, 23)} ${SK.line(9, 26, 23, 26, 24)} ${SK.line(23, 26, 23, 13, 25)} ${SK.line(14, 26, 14, 19, 26)} ${SK.line(14, 19, 18, 19, 27)} ${SK.line(18, 19, 18, 26, 28)}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
    close: `<svg viewBox="0 0 32 32" width="26" height="26" aria-hidden="true" focusable="false"><path d="M9 9 L23 23 M23 9 L9 23" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>`
  };

  function langBtn() {
    return `<button type="button" class="lang-btn" data-action="lang" aria-label="${esc(t('langToggleLabel'))}" lang="${app.lang === 'en' ? 'zh-Hant' : 'en'}">${esc(t('langToggle'))}</button>`;
  }

  function banner() {
    return store.available ? '' : `<div class="banner" role="alert">${esc(t('storageWarning'))}</div>`;
  }
  function showBanner() {
    if (document.querySelector('.banner')) return;
    const page = appEl.firstElementChild;
    if (page) page.insertAdjacentHTML('afterbegin', banner());
  }

  // Hand-drawn outlined button; renders an <a> when attrs contain an href.
  function skBtn(label, attrs = '', cls = '', seed = 5) {
    const tag = attrs.startsWith('href') ? 'a' : 'button';
    const type = tag === 'button' ? ' type="button"' : '';
    return `<${tag}${type} class="sk-btn ${cls}" ${attrs}>${SK.frame(seed)}<span class="sk-btn-label">${esc(label)}</span></${tag}>`;
  }

  /*
   * The one page template. `corners` adds the four floating riso stamps (results pages),
   * with `corners` itself shown in the numbered stamp.
   */
  function page({ body, stepLabel = '', home = true, wide = false, corners = null, cls = '' }) {
    const stamps = corners === null ? '' : `<div class="corners" aria-hidden="true">
        <span class="corner corner-tl">${ART.cornerStar()}</span>
        <span class="corner corner-tr">${ART.cornerNumber()}<b>${esc(corners)}</b></span>
        <span class="corner corner-bl">${ART.cornerCompass()}</span>
        <span class="corner corner-br">${ART.cornerMoon()}</span>
      </div>`;
    return `<div class="page${wide ? ' page--wide' : ''}${corners !== null ? ' page--stamps' : ''} ${cls}">
      ${banner()}
      ${stamps}
      <header class="topbar">
        ${home ? `<a class="icon-btn" href="#/" aria-label="${esc(t('home'))}">${icons.home}</a>` : `<span class="brand">${brandInline()}</span>`}
        ${stepLabel ? `<span class="step-label">${esc(stepLabel)}</span>` : '<span></span>'}
        ${langBtn()}
      </header>
      <main id="main" class="main">${body}</main>
      <footer class="site-footer"><p>${esc(t('disclaimer'))}</p></footer>
    </div>`;
  }

  // "Pre-Flow Check" set in riso inks: each letter its own colour, printed slightly off-register.
  function risoWord(text) {
    const inks = ['indigo', 'orange', 'green', 'ink', 'indigo', 'orange', 'green'];
    let i = 0;
    return `<span class="riso-word">${Array.from(text).map((ch) =>
      (ch.trim() ? `<span class="rl rl-${inks[i++ % inks.length]}">${esc(ch)}</span>` : ' ')).join('')}</span>`;
  }

  function brandInline() {
    return `${risoWord('Pre-Flow Check')}<span class="brand-zh">心流羅盤</span>`;
  }

  let toastTimer = 0;
  function toast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('is-on'), 3200);
  }

  // ---------------- horizon drawing ----------------

  /*
   * Draw a horizon into `host`.
   * opts: { values, provisional[], stars[], seed, height, figureAt: index | null, figureFrac,
   *         fromFrac, width, padX, selected, interactive, label }
   */
  function drawHorizon(host, opts) {
    const width = opts.width || Math.max(280, host.clientWidth || 360);
    const height = opts.height || host.clientHeight || 180;
    const top = height * 0.18;
    const bottom = height * 0.86;
    const hz = SK.horizon(opts.values, { width, top, bottom, padX: opts.padX, seed: opts.seed, single: opts.single });

    let figX;
    if (opts.figureAt !== null && opts.figureAt !== undefined && hz.points[opts.figureAt]) figX = hz.points[opts.figureAt].x;
    else figX = width * (opts.figureFrac !== undefined ? opts.figureFrac : 0.3);
    const figY = hz.yAt(figX);
    const startX = opts.fromFrac !== undefined && opts.fromFrac !== null ? width * opts.fromFrac : figX;
    const scale = height > 200 ? 1.15 : 0.95;

    let marks = '';
    if (opts.values && opts.values.length) {
      hz.points.forEach((p, i) => {
        const prov = opts.provisional && opts.provisional[i];
        const sel = opts.selected === i;
        const star = opts.stars && isNum(opts.stars[i]) ? opts.stars[i] : null;
        if (star !== null) {
          const r = 4 + star * 0.7;
          marks += `<path class="hz-star" d="${SK.starPath(p.x, p.y - 30 - r, r, r * 0.45, 5)}"/>`;
        }
        marks += `<circle class="hz-pt${prov ? ' is-prov' : ''}${sel ? ' is-sel' : ''}" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${sel ? 6.5 : 4.5}"/>`;
        if (opts.interactive) {
          marks += `<circle class="hz-hit" data-pt="${i}" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="22"><title>${esc(opts.pointLabel ? opts.pointLabel(i) : '')}</title></circle>`;
        }
      });
    }
    const valueLabel = opts.showValue && hz.points[opts.figureAt]
      ? `<text class="hz-value" x="${(figX - 12).toFixed(1)}" y="${(figY - 46).toFixed(1)}" text-anchor="end">${esc(opts.values[opts.figureAt])}</text>` : '';

    host.innerHTML = `<svg class="horizon" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="${esc(opts.label || '')}">
      <path class="hz-line" d="${hz.d}"/>
      ${marks}
      ${valueLabel}
      <g class="figure" style="transform: translate(${startX.toFixed(1)}px, ${hz.yAt(startX).toFixed(1)}px) scale(${scale})">${SK.figure(4)}</g>
    </svg>`;

    const fig = host.querySelector('.figure');
    if (startX !== figX) {
      if (reduceMotion()) {
        fig.style.transform = `translate(${figX.toFixed(1)}px, ${figY.toFixed(1)}px) scale(${scale})`;
      } else {
        // Walk along the terrain: step through a few waypoints so the figure follows the hills.
        walkFigure(fig, hz, startX, figX, scale);
      }
    }
    return { hz, figX, figY, width, height, fig, scale };
  }

  function walkFigure(fig, hz, fromX, toX, scale) {
    const dur = Math.min(1400, 300 + Math.abs(toX - fromX) * 3);
    const t0 = performance.now();
    fig.classList.add('is-walking');
    if (toX < fromX) fig.classList.add('is-left');
    const step = (now) => {
      const p = Math.min(1, (now - t0) / dur);
      const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      const x = fromX + (toX - fromX) * e;
      fig.style.transform = `translate(${x.toFixed(1)}px, ${hz.yAt(x).toFixed(1)}px) scale(${scale})`;
      if (p < 1 && fig.isConnected) requestAnimationFrame(step);
      else fig.classList.remove('is-walking', 'is-left');
    };
    requestAnimationFrame(step);
  }

  function onResize(fn) {
    let timer = 0;
    let lastW = window.innerWidth;
    const h = () => {
      if (window.innerWidth === lastW) return;
      lastW = window.innerWidth;
      clearTimeout(timer);
      timer = setTimeout(fn, 150);
    };
    window.addEventListener('resize', h);
    app.cleanups.push(() => { window.removeEventListener('resize', h); clearTimeout(timer); });
  }

  // ---------------- views: home ----------------

  function viewHome() {
    const list = scored();
    const device = guessDevice();
    const bl = S.buildBaseline(sessions(), { device });
    const total = CFG.baseline.minSessions;
    const progress = bl.enabled
      ? t('homeView.baselineReady', { n: Math.min(bl.n, CFG.baseline.windowSize) })
      : t('homeView.baselineBuilding', { n: Math.min(bl.n, total), total });
    const latest = list[list.length - 1];

    let reminder = '';
    const timer = store.data.timer;
    if (timer) {
      const left = timer.endsAt - Date.now();
      reminder = left > 0
        ? `<div class="note-card"><p>${esc(t('homeView.timerRunning', { time: fmtClock(left) }))}</p>${skBtn(t('homeView.timerOpen'), 'href="#/timer"', 'sk-btn--small', 41)}</div>`
        : `<div class="note-card"><p>${esc(t('homeView.timerDone'))}</p>${skBtn(t('homeView.reminderBtn'), 'data-action="timer-log"', 'sk-btn--small', 42)}</div>`;
    } else {
      const pending = sessions().slice().reverse().find((s) => !s.flow && Date.now() - new Date(s.createdAt) < 48 * 3600000);
      if (pending) {
        reminder = `<div class="note-card"><p>${esc(t('homeView.reminder', { when: fmtWhen(pending.createdAt) }))}</p>${skBtn(t('homeView.reminderBtn'), `href="#/flow/${esc(pending.id)}"`, 'sk-btn--small', 43)}</div>`;
      }
    }

    const html = page({
      home: false,
      wide: true,
      body: `
        <section class="home-hero">
          <h1 tabindex="-1" class="home-title">
            ${app.lang === 'en'
              ? `<span class="h-main h-latin">${risoWord('Pre-Flow Check')}</span><span class="h-sub">心流羅盤</span>`
              : `<span class="h-main">心流羅盤</span><span class="h-sub h-latin">${risoWord('Pre-Flow Check')}</span>`}
          </h1>
          <p class="lead">${esc(t('homeView.intro'))}</p>
          <p class="meta">${esc(progress)}${esc(t('homeView.baselineDevice', { device: t('device.' + device) }))}</p>
          ${latest ? `<p class="meta">${esc(t('homeView.latest', { when: fmtWhen(latest.createdAt), index: latest.score.index }))}</p>` : `<p class="meta">${esc(t('homeView.empty'))}</p>`}
        </section>
        <div class="horizon-host home-horizon"></div>
        ${reminder}
        <nav class="home-actions" aria-label="${esc(t('appName'))}">
          ${skBtn(t('homeView.start'), 'href="#/check/1" data-action="start"', 'sk-btn--primary', 31)}
          <div class="home-secondary">
            ${skBtn(t('homeView.logFlow'), 'href="#/flow"', '', 32)}
            ${skBtn(t('homeView.history'), 'href="#/history"', '', 33)}
            ${skBtn(t('homeView.settings'), 'href="#/settings"', '', 34)}
          </div>
        </nav>`
    });

    const mount = () => {
      const host = appEl.querySelector('.home-horizon');
      const recent = list.slice(-14);
      const draw = () => drawHorizon(host, recent.length ? {
        values: recent.map((s) => s.score.index),
        provisional: recent.map((s) => s.score.provisional),
        figureAt: recent.length - 1,
        showValue: true,
        seed: 17,
        padX: recent.length === 1 ? 40 : 48,
        single: 0.62,
        label: t('homeView.horizonLabel')
      } : { values: null, seed: 17, figureFrac: 0.62, label: t('homeView.horizonLabel') });
      draw();
      onResize(draw);
      if (timer && timer.endsAt > Date.now()) {
        const iv = setInterval(() => {
          const p = appEl.querySelector('.note-card p');
          const left = timer.endsAt - Date.now();
          if (left <= 0) { clearInterval(iv); render(); return; }
          if (p) p.textContent = t('homeView.timerRunning', { time: fmtClock(left) });
        }, 1000);
        app.cleanups.push(() => clearInterval(iv));
      }
    };
    return { title: t('appName'), html, mount };
  }

  // ---------------- views: check-in steps ----------------

  function newDraft() {
    return {
      subjective: { kss: null, energy: null, tension: null },
      context: {
        sleepHours: null, wakeTime: '', caffeineCups: null, lastCaffeineTime: '',
        hrv: null, restingHr: null, deviceReadiness: null, taskType: null
      }
    };
  }
  const subjectiveDone = (d) => d && ['kss', 'energy', 'tension'].every((k) => isNum(d.subjective[k]));

  function stage() {
    return `<div class="stage"><div class="horizon-host stage-host"></div></div>`;
  }

  function storyNav(step, nextEnabled = true) {
    return `<nav class="story-nav" aria-label="${esc(t('step.label', { n: step }))}">
      ${step > 1 ? `<button type="button" class="story-btn story-back" data-nav="back">${SK.arrowButton('back', 61)}<span>${esc(t('back'))}</span></button>` : '<span class="story-spacer"></span>'}
      ${step < 3 ? `<button type="button" class="story-btn story-next" data-nav="next" aria-disabled="${nextEnabled ? 'false' : 'true'}">${SK.arrowButton('next', 62)}<span>${esc(t('next'))}</span></button>` : '<span class="story-spacer"></span>'}
    </nav>`;
  }

  function scaleGroup(name, n, value, labels, labelledBy, cls = '') {
    let html = `<div class="scale ${cls}" role="radiogroup" aria-labelledby="${labelledBy}">`;
    for (let i = 1; i <= n; i++) {
      const checked = value === i;
      const focusable = checked || (value === null && i === 1);
      const lbl = labels && labels[i] ? `<span class="lbl">${esc(labels[i])}</span>` : '';
      html += `<button type="button" role="radio" class="scale-btn${lbl ? ' has-lbl' : ''}" data-group="${name}" data-value="${i}" aria-checked="${checked}" tabindex="${focusable ? 0 : -1}"><span class="num">${i}</span>${lbl}</button>`;
    }
    return html + '</div>';
  }

  function chipGroup(name, options, value, labelledBy) {
    let html = `<div class="chips" role="radiogroup" aria-labelledby="${labelledBy}">`;
    options.forEach((opt, i) => {
      const checked = value === opt;
      const focusable = checked || (!value && i === 0);
      html += `<button type="button" role="radio" class="chip" data-group="${name}" data-value="${opt}" aria-checked="${checked}" tabindex="${focusable ? 0 : -1}">${esc(t('task.' + opt))}</button>`;
    });
    return html + '</div>';
  }

  function stepFigure(step) {
    const fracs = { 1: 0.14, 2: 0.34, 3: 0.52, 4: 0.7 };
    const host = appEl.querySelector('.stage-host');
    const draw = (from) => drawHorizon(host, { values: null, seed: 29, figureFrac: fracs[step], fromFrac: from, label: '' });
    draw(app.figureFrac !== null && app.figureFrac !== fracs[step] ? app.figureFrac : null);
    app.figureFrac = fracs[step];
    onResize(() => draw(null));
  }

  function drawStageStatic(frac) {
    const host = appEl.querySelector('.stage-host');
    const draw = () => drawHorizon(host, { values: null, seed: 29, figureFrac: frac, label: '' });
    draw();
    onResize(draw);
  }

  function viewCheck(r) {
    const step = Number(r.arg) || 1;
    if (step === 1 && !app.draft) app.draft = newDraft();
    if (step > 1 && !subjectiveDone(app.draft)) { location.replace('#/check/1'); return null; }
    if (step === 1) return viewStep1();
    if (step === 2) return viewStep2();
    return viewStep3();
  }

  function viewStep1() {
    const d = app.draft.subjective;
    const kssLabels = t('step.kss');
    const body = `
      ${stage()}
      <section class="step-body">
        <h1 tabindex="-1">${esc(t('step.s1Title'))}</h1>
        <div class="q">
          <h2 id="q-kss">${esc(t('step.kssQ'))}</h2>
          ${scaleGroup('kss', 9, d.kss, kssLabels, 'q-kss', 'scale--kss')}
        </div>
        <div class="q">
          <h2 id="q-energy">${esc(t('step.energyQ'))}</h2>
          ${scaleGroup('energy', 10, d.energy, null, 'q-energy', 'scale--ten')}
          <p class="scale-ends"><span>${esc(t('step.low'))}</span><span>${esc(t('step.high'))}</span></p>
        </div>
        <div class="q">
          <h2 id="q-tension">${esc(t('step.tensionQ'))}</h2>
          ${scaleGroup('tension', 10, d.tension, null, 'q-tension', 'scale--ten')}
          <p class="scale-ends"><span>${esc(t('step.low'))}</span><span>${esc(t('step.high'))}</span></p>
        </div>
        <p class="hint" id="need-all" aria-live="polite">${subjectiveDone(app.draft) ? '' : esc(t('step.needAll'))}</p>
      </section>
      ${storyNav(1, subjectiveDone(app.draft))}`;
    return {
      title: t('step.s1Title'),
      html: page({ body, stepLabel: t('step.label', { n: 1 }) }),
      mount: () => {
        stepFigure(1);
        appEl.querySelectorAll('[data-group]').forEach((b) => b.addEventListener('click', () => {
          selectRadio(b);
          app.draft.subjective[b.dataset.group] = Number(b.dataset.value);
          const done = subjectiveDone(app.draft);
          appEl.querySelector('.story-next').setAttribute('aria-disabled', String(!done));
          appEl.querySelector('#need-all').textContent = done ? '' : t('step.needAll');
        }));
        bindStoryNav(1);
      }
    };
  }

  function stepper(name, value, { min, max, step, start, unit }) {
    return `<div class="stepper" data-stepper="${name}">
      <button type="button" class="step-btn" data-dir="-1" aria-label="${esc(t('step.decrease'))}">−</button>
      <input id="f-${name}" name="${name}" type="number" inputmode="decimal" min="${min}" max="${max}" step="${step}" value="${isNum(value) ? value : ''}" data-start="${start}" autocomplete="off">
      <button type="button" class="step-btn" data-dir="1" aria-label="${esc(t('step.increase'))}">+</button>
      ${unit ? `<span class="unit">${esc(unit)}</span>` : ''}
    </div>`;
  }

  const FIELD_RULES = {
    sleepHours: { min: 0, max: 16, step: 0.5, start: 7 },
    caffeineCups: { min: 0, max: 15, step: 1, start: 0 },
    hrv: { min: 5, max: 300, step: 1, start: 50 },
    restingHr: { min: 25, max: 200, step: 1, start: 60 },
    deviceReadiness: { min: 0, max: 100, step: 1, start: 70 }
  };

  function viewStep2() {
    const c = app.draft.context;
    const awake = c.wakeTime ? S.hoursSince(c.wakeTime, new Date()) : null;
    const field = (name, label, unit) => `
      <div class="field">
        <label for="f-${name}">${esc(label)}</label>
        ${stepper(name, c[name], Object.assign({ unit }, FIELD_RULES[name]))}
        <p class="field-err" id="err-${name}" aria-live="polite"></p>
      </div>`;
    const wearableOpen = isNum(c.hrv) || isNum(c.restingHr) || isNum(c.deviceReadiness);
    const body = `
      ${stage()}
      <section class="step-body">
        <h1 tabindex="-1">${esc(t('step.s2Title'))}</h1>
        <p class="lead">${esc(t('step.s2Hint'))}</p>
        <div class="fields">
          ${field('sleepHours', t('step.sleep'), app.lang === 'en' ? 'h' : '小時')}
          <div class="field">
            <label for="f-wakeTime">${esc(t('step.wake'))}</label>
            <div class="time-row"><input id="f-wakeTime" type="time" value="${esc(c.wakeTime)}">
            <span class="derived" id="awake-out" aria-live="polite">${awake !== null ? esc(t('step.awake', { h: awake })) : ''}</span></div>
          </div>
          ${field('caffeineCups', t('step.caffeine'), app.lang === 'en' ? 'cups' : '杯')}
          <div class="field" id="last-cup-field" ${isNum(c.caffeineCups) && c.caffeineCups > 0 ? '' : 'hidden'}>
            <label for="f-lastCaffeineTime">${esc(t('step.lastCup'))}</label>
            <input id="f-lastCaffeineTime" type="time" value="${esc(c.lastCaffeineTime)}">
          </div>
          <details class="wearable" ${wearableOpen ? 'open' : ''}>
            <summary>${esc(t('step.wearable'))}</summary>
            ${field('hrv', t('step.hrv'), '')}
            ${field('restingHr', t('step.rhr'), '')}
            ${field('deviceReadiness', t('step.readiness'), '')}
          </details>
          <div class="field">
            <p class="label" id="q-task">${esc(t('step.task'))}</p>
            ${chipGroup('taskType', CFG.taskTypes, c.taskType, 'q-task')}
          </div>
        </div>
      </section>
      ${storyNav(2)}`;
    return {
      title: t('step.s2Title'),
      html: page({ body, stepLabel: t('step.label', { n: 2 }) }),
      mount: () => {
        stepFigure(2);
        const setField = (name, raw) => {
          const rule = FIELD_RULES[name];
          const err = appEl.querySelector('#err-' + name);
          if (raw === '' || raw === null) { c[name] = null; err.textContent = ''; return; }
          const v = Number(raw);
          if (!Number.isFinite(v) || v < rule.min || v > rule.max) { c[name] = null; err.textContent = t('step.outOfRange'); return; }
          c[name] = v; err.textContent = '';
          if (name === 'caffeineCups') appEl.querySelector('#last-cup-field').hidden = !(v > 0);
        };
        appEl.querySelectorAll('[data-stepper]').forEach((wrap) => {
          const name = wrap.dataset.stepper;
          const input = wrap.querySelector('input');
          const rule = FIELD_RULES[name];
          input.addEventListener('input', () => setField(name, input.value.trim()));
          wrap.querySelectorAll('.step-btn').forEach((b) => b.addEventListener('click', () => {
            const cur = input.value === '' ? null : Number(input.value);
            let next = cur === null || !Number.isFinite(cur) ? rule.start : cur + Number(b.dataset.dir) * rule.step;
            next = Math.min(rule.max, Math.max(rule.min, Math.round(next * 10) / 10));
            input.value = String(next);
            setField(name, input.value);
          }));
        });
        const wake = appEl.querySelector('#f-wakeTime');
        wake.addEventListener('input', () => {
          c.wakeTime = wake.value;
          const h = wake.value ? S.hoursSince(wake.value, new Date()) : null;
          appEl.querySelector('#awake-out').textContent = h !== null ? t('step.awake', { h }) : '';
        });
        const cup = appEl.querySelector('#f-lastCaffeineTime');
        cup.addEventListener('input', () => { c.lastCaffeineTime = cup.value; });
        appEl.querySelectorAll('[data-group="taskType"]').forEach((b) => b.addEventListener('click', () => {
          // Clicking the selected chip again clears it (the field is optional).
          if (c.taskType === b.dataset.value) {
            c.taskType = null;
            b.setAttribute('aria-checked', 'false');
          } else {
            selectRadio(b);
            c.taskType = b.dataset.value;
          }
        }));
        bindStoryNav(2);
      }
    };
  }

  function viewStep3() {
    const fastNote = FAST_PVT ? ` <small>${esc(t('step.s3Fast', { s: FAST_PVT_MS / 1000 }))}</small>` : '';
    const body = `
      ${stage()}
      <section class="step-body">
        <h1 tabindex="-1">${esc(t('step.s3Title'))}${fastNote}</h1>
        <div class="pvt-demo" aria-hidden="true"><span class="pvt-demo-dot">0</span></div>
        <p class="lead">${esc(t('step.s3Intro'))}</p>
        <p class="lead strong">${esc(t('step.s3How'))}</p>
        <ul class="tips">
          <li>${esc(t('step.s3Tip1'))}</li>
          <li>${esc(t('step.s3Tip2'))}</li>
          <li>${esc(t('step.s3Tip3'))}</li>
        </ul>
        <div class="center">${skBtn(t('step.s3Start'), 'data-action="pvt-start" id="pvt-start"', 'sk-btn--primary', 71)}</div>
      </section>
      ${storyNav(3)}`;
    return {
      title: t('step.s3Title'),
      html: page({ body, stepLabel: t('step.label', { n: 3 }) }),
      mount: () => {
        stepFigure(3);
        bindStoryNav(3);
      }
    };
  }

  function selectRadio(btn) {
    const group = btn.closest('[role="radiogroup"]');
    group.querySelectorAll('[role="radio"]').forEach((b) => {
      const on = b === btn;
      b.setAttribute('aria-checked', String(on));
      b.tabIndex = on ? 0 : -1;
    });
  }

  function bindStoryNav(step) {
    const next = appEl.querySelector('[data-nav="next"]');
    const back = appEl.querySelector('[data-nav="back"]');
    if (next) next.addEventListener('click', () => storyGo(step, 1));
    if (back) back.addEventListener('click', () => storyGo(step, -1));
    // Swipe left = next, right = back.
    const main = appEl.querySelector('main');
    let sx = 0;
    let sy = 0;
    let tracking = false;
    const ts = (e) => { if (e.touches.length !== 1) return; tracking = true; sx = e.touches[0].clientX; sy = e.touches[0].clientY; };
    const te = (e) => {
      if (!tracking) return;
      tracking = false;
      const tch = e.changedTouches[0];
      const dx = tch.clientX - sx;
      const dy = tch.clientY - sy;
      if (Math.abs(dx) > 70 && Math.abs(dy) < 50) storyGo(step, dx < 0 ? 1 : -1);
    };
    main.addEventListener('touchstart', ts, { passive: true });
    main.addEventListener('touchend', te, { passive: true });
  }

  function storyGo(step, dir) {
    if (dir > 0) {
      if (step === 1 && !subjectiveDone(app.draft)) {
        const hint = appEl.querySelector('#need-all');
        if (hint) { hint.textContent = t('step.needAll'); hint.classList.remove('shake'); void hint.offsetWidth; hint.classList.add('shake'); }
        return;
      }
      if (step < 3) go('#/check/' + (step + 1));
    } else if (step > 1) {
      go('#/check/' + (step - 1));
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
      <div class="pvt-countdown" aria-live="assertive"></div>
      <div class="pvt-stimulus"><span class="pvt-counter">0</span></div>
      <div class="pvt-message" aria-live="polite"></div>`;
    document.body.appendChild(layer);
    document.body.classList.add('pvt-lock');
    layer.focus();

    const cd = layer.querySelector('.pvt-countdown');
    let n = CFG.pvt.countdownSec;
    let cancelled = false;
    const onHide = () => {
      if (document.visibilityState === 'hidden' && !runner) { cancelled = true; teardown(); }
    };
    document.addEventListener('visibilitychange', onHide);
    let runner = null;

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
        cd.textContent = String(n);
        cd.classList.remove('pop'); void cd.offsetWidth; cd.classList.add('pop');
        n--;
        setTimeout(tick, 1000);
        return;
      }
      cd.textContent = '';
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
          setTimeout(() => { teardown(); finishCheck(result, true, null); }, 200);
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
      <p id="pvt-int-p">${esc(t('pvt.interruptedBody'))}</p>
      <div class="pvt-dialog-actions">
        <button type="button" class="ink-btn ink-btn--solid" data-int="retest">${esc(t('pvt.retest'))}</button>
        <button type="button" class="ink-btn" data-int="skip">${esc(t('pvt.skip'))}</button>
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
      flow: null
    };
    session.score = S.scoreSession(session, sessions().concat([session]));
    store.data.sessions.push(session);
    persist();
    app.draft = null;
    app.figureFrac = 0.52;
    app.revealId = session.id;
    app.flipped[session.id] = 0;
    wipeTo('#/result/' + session.id);
  }

  function wipeTo(hash) {
    const ov = document.createElement('div');
    ov.className = 'wipe' + (reduceMotion() ? ' wipe--fade' : '');
    document.body.appendChild(ov);
    requestAnimationFrame(() => requestAnimationFrame(() => ov.classList.add('is-on')));
    const dur = reduceMotion() ? 300 : 800;
    setTimeout(() => {
      go(hash);
      ov.classList.add('is-out');
      setTimeout(() => ov.remove(), 450);
    }, dur);
  }

  // ---------------- views: results ----------------

  function cardHtml(i, theme, inner, title, flipped, isNext) {
    const label = flipped ? `${ROMAN[i]} · ${title.zh} ${title.en}` : (isNext ? t('result.cardBack', { n: i + 1 }) : t('result.cardLocked', { n: i + 1 }));
    return `<button type="button" class="tcard${flipped ? ' is-flipped' : ''}${isNext ? ' is-next' : ''}" data-card="${i}"
        style="--card-bg:${theme.bg};--card-fg:${theme.fg}"
        aria-label="${esc(label)}" ${flipped || !isNext ? 'aria-disabled="true"' : ''}>
      <span class="tcard-inner">
        <span class="tcard-face tcard-back">${ART.cardBack()}</span>
        <span class="tcard-face tcard-front grain">
          <span class="tcard-num">${ROMAN[i]}</span>
          <span class="tcard-art">${inner}</span>
          <span class="tcard-title"><span class="zh">${esc(title.zh)}</span><span class="en">${esc(title.en)}</span></span>
        </span>
      </span>
    </button>`;
  }

  function readingHtml(s, i, shown) {
    const sc = s.score;
    const sub = s.subjective;
    let inner = '';
    if (i === 0) {
      const a = sc.archetype;
      inner = `<h2>${ROMAN[0]} · ${esc(t('archetype.' + a + '.zh'))} <span class="en-cap">${esc(t('archetype.' + a + '.en'))}</span></h2>
        <p class="tag">${esc(t('archetype.' + a + '.tag'))}</p>
        <p>${esc(t('archetype.' + a + '.desc'))}</p>
        <p class="muted">${esc(t('result.energyTension', { e: sub.energy, t: sub.tension }))}</p>`;
    } else if (i === 1) {
      let lines = '';
      if (sc.provisional) {
        lines += `<p class="badge">${esc(t('result.provisional'))}</p>`;
        if (!s.valid) lines += `<p>${esc(t('result.invalidPvt'))}</p>`;
        const k = Math.max(0, CFG.baseline.minSessions - sc.baselineN);
        if (k > 0) lines += `<p class="muted">${esc(t('result.provisionalHint', { k, device: t('device.' + s.device) }))}</p>`;
      } else {
        const p = sc.speedVsBaselinePct;
        if (isNum(p)) lines += `<p>${esc(p <= -2 ? t('result.slower', { p: -p }) : p >= 2 ? t('result.faster', { p }) : t('result.same'))}</p>`;
        const bl = baselineFor(s);
        if (bl.stats.lapses) lines += `<p class="muted">${esc(t('result.lapsesLine', { n: s.pvt.summary.lapses, m: Math.round(bl.stats.lapses.mean * 10) / 10 }))}</p>`;
      }
      inner = `<h2>${ROMAN[1]} · ${esc(t('result.readinessLabel'))} <span class="big-num">${sc.index}</span><span class="of">/100</span></h2>${lines}`;
    } else {
      const rec = sc.recommendationId;
      const actions = t('rec.' + rec + '.actions');
      inner = `<h2>${ROMAN[2]} · ${esc(t('result.guidanceLabel'))}</h2>
        <p class="rec-main">${esc(t('rec.' + rec + '.main'))}</p>
        <ul class="rec-actions">${(Array.isArray(actions) ? actions : []).map((a) => `<li>${esc(a)}</li>`).join('')}</ul>
        ${(sc.notes || []).map((n) => `<p class="note">${esc(t('note.' + n))}</p>`).join('')}
        ${sc.breathing ? skBtn(t('result.breatheBtn'), `href="#/breathe/${esc(s.id)}"`, 'sk-btn--fill', 201) : ''}`;
    }
    return `<article class="reading-item${shown ? '' : ' is-hidden'}" data-reading="${i}">${inner}</article>`;
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
        const pvtMetric = S.PVT_METRICS.includes(k);
        const usable = st && (!pvtMetric || bl.enabled);
        let diff = esc(t('result.afterBaseline'));
        if (usable) {
          let z = (m[k] - st.mean) / st.sd;
          const sign = z >= 0 ? '+' : '−';
          const zTxt = `${sign}${Math.abs(z).toFixed(1)} SD`;
          if (NEUTRAL.has(k)) diff = zTxt;
          else {
            if (LOWER_BETTER.has(k)) z = -z;
            const word = Math.abs(z) < 0.5 ? t('result.similar') : z > 0 ? t('result.better') : t('result.worse');
            diff = `${zTxt}<span class="diff-word ${Math.abs(z) < 0.5 ? '' : z > 0 ? 'good' : 'bad'}">${esc(word)}</span>`;
          }
        }
        const base = usable ? `${fmtMetric(k, st.mean)} ± ${fmtMetric(k, st.sd).replace(' ms', '').replace(' h', '')}` : '—';
        return `<tr><th scope="row">${esc(t('metric.' + k))}</th><td>${fmtMetric(k, m[k])}</td><td>${base}</td><td>${diff}</td></tr>`;
      }).join('');

    const weights = s.score && !s.score.provisional
      ? `<p class="muted small">${esc(t('result.weightsUsed'))}: ${Object.entries(s.score.weights).map(([k, w]) => `${esc(t('metric.' + k))} ${Math.round(w * 100)}%`).join(' · ')}</p>` : '';

    const sum = s.pvt && s.pvt.summary;
    return `<section class="details" aria-labelledby="details-h">
      <h2 id="details-h">${esc(t('result.details'))}</h2>
      ${sum && sum.n ? `<figure class="rt-chart">
        <figcaption><strong>${esc(t('result.rtChart'))}</strong><span class="muted small">${esc(t('result.rtChartDesc'))}</span></figcaption>
        ${rtHistogram(s.pvt.trials)}
        <p class="muted small">${esc(t('result.pvtSummary', { n: sum.n, f: sum.falseStarts }))}</p>
      </figure>` : ''}
      <div class="table-wrap"><table class="metrics">
        <thead><tr><th scope="col">${esc(t('result.metric'))}</th><th scope="col">${esc(t('result.todayCol'))}</th><th scope="col">${esc(t('result.baselineCol'))}</th><th scope="col">${esc(t('result.diffCol'))}</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
      ${weights}
    </section>`;
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
      bars += `<g class="bar${lapse ? ' is-lapse' : ''}"><rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(bw - 2).toFixed(1)}" height="${Math.max(h, c ? 2 : 0).toFixed(1)}" rx="3"/>
        <rect class="bar-hit" x="${(x - 1).toFixed(1)}" y="${top}" width="${bw.toFixed(1)}" height="${H - padB - top}"><title>${esc(range)}: ${esc(t('result.count', { n: c }))}</title></rect></g>`;
      if (c === max) bars += `<text class="bar-val" x="${(x + (bw - 2) / 2).toFixed(1)}" y="${(y - 5).toFixed(1)}" text-anchor="middle">${c}</text>`;
    });
    const lx = padL + 5 * bw;
    const ticks = [[0, '100'], [2, '200'], [4, '300'], [5, '355'], [8, '500+']]
      .map(([i, l]) => `<text class="tick" x="${(padL + i * bw).toFixed(1)}" y="${H - 8}" text-anchor="${i === 0 ? 'start' : 'middle'}">${l}</text>`).join('');
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
    const flippedCount = fresh ? (app.flipped[s.id] || 0) : 3;
    const sc = s.score;
    const a = sc.archetype;
    const cards = [
      { theme: ART.CARD_THEME[a], inner: ART.ARCHETYPE_ART[a](), title: { zh: t('archetype.' + a + '.zh'), en: t('archetype.' + a + '.en') } },
      {
        theme: ART.CARD_THEME.readiness,
        inner: `${ART.readiness(sc.index)}<span class="tcard-big">${sc.index}</span>${sc.provisional ? `<span class="tcard-prov">${esc(app.lang === 'en' ? 'PROVISIONAL' : '暫定')}</span>` : ''}`,
        title: t('cards.readiness')
      },
      { theme: ART.CARD_THEME.guidance, inner: ART.guidance(), title: t('cards.guidance') }
    ];
    const all = flippedCount >= 3;
    const minutes = CFG.focusTimerMinutes;
    const body = `
      <h1 class="sr-only" tabindex="-1">${esc(t('result.titleAria'))}</h1>
      ${stage()}
      <p class="reveal-prompt">${fresh && !all ? esc(t('result.prompt')) : esc(fmtWhen(s.createdAt))}</p>
      <div class="cards">${cards.map((c, i) => cardHtml(i, c.theme, c.inner, c.title, i < flippedCount, i === flippedCount)).join('')}</div>
      <section class="reading" aria-live="polite">${[0, 1, 2].map((i) => readingHtml(s, i, i < flippedCount)).join('')}</section>
      <section class="after${all ? '' : ' is-hidden'}">
        <div class="focus-box">
          <h2>${esc(t('result.focusTimer'))}</h2>
          <div class="btn-row">${minutes.map((m, i) => skBtn(t('minutes', { m }), `data-action="timer-start" data-min="${m}" data-session="${esc(s.id)}"`, 'sk-btn--chip', 210 + i)).join('')}</div>
        </div>
        <div class="btn-row">
          ${skBtn(t('result.logFlow'), `href="#/flow/${esc(s.id)}"`, '', 220)}
          ${fresh ? skBtn(t('result.backHome'), 'href="#/"', '', 221) : skBtn(t('result.backHistory'), 'href="#/history"', '', 222)}
        </div>
        ${detailsHtml(s)}
      </section>`;
    return {
      title: t('result.titleAria'),
      html: page({ body, corners: ordinal(s), stepLabel: fresh ? t('step.label', { n: 4 }) : '', cls: 'page--reveal' }),
      mount: () => {
        if (fresh) stepFigure(4); else drawStageStatic(0.7);
        appEl.querySelectorAll('.tcard').forEach((card) => card.addEventListener('click', () => {
          const i = Number(card.dataset.card);
          const count = app.flipped[s.id] || 0;
          if (!fresh || i !== count) {
            const nextCard = appEl.querySelector('.tcard.is-next');
            if (nextCard && i !== count) { nextCard.classList.remove('nudge'); void nextCard.offsetWidth; nextCard.classList.add('nudge'); }
            return;
          }
          app.flipped[s.id] = count + 1;
          card.classList.add('is-flipped');
          card.classList.remove('is-next');
          card.setAttribute('aria-disabled', 'true');
          card.setAttribute('aria-label', `${ROMAN[i]} · ${cards[i].title.zh} ${cards[i].title.en}`);
          const nextCard = appEl.querySelector(`.tcard[data-card="${i + 1}"]`);
          if (nextCard) {
            nextCard.classList.add('is-next');
            nextCard.removeAttribute('aria-disabled');
            nextCard.setAttribute('aria-label', t('result.cardBack', { n: i + 2 }));
          }
          const item = appEl.querySelector(`[data-reading="${i}"]`);
          if (item) item.classList.remove('is-hidden');
          if (i === 2) {
            const after = appEl.querySelector('.after');
            after.classList.remove('is-hidden');
            appEl.querySelector('.reveal-prompt').textContent = fmtWhen(s.createdAt);
            setTimeout(() => {
              const rd = appEl.querySelector('.reading');
              if (rd) rd.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start' });
            }, reduceMotion() ? 0 : 650);
          } else if (nextCard) {
            nextCard.focus({ preventScroll: true });
          }
        }));
      }
    };
  }

  // ---------------- views: focus timer & breathing ----------------

  function viewTimer() {
    const timer = store.data.timer;
    if (!timer) { location.replace('#/'); return null; }
    const s = byId(timer.sessionId);
    const R = 88;
    const C = 2 * Math.PI * R;
    const body = `
      <h1 tabindex="-1" class="center-h1">${esc(t('timer.title'))}</h1>
      <div class="ring-wrap">
        <svg class="ring" viewBox="0 0 200 200" aria-hidden="true">
          <circle cx="100" cy="100" r="${R}" class="ring-bg"/>
          <circle cx="100" cy="100" r="${R}" class="ring-fg" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="0" transform="rotate(-90 100 100)"/>
        </svg>
        <div class="ring-center"><span class="ring-time" role="timer" aria-label="${esc(t('timer.remaining'))}">--:--</span><span class="ring-sub">${esc(t('minutes', { m: timer.minutes }))}</span></div>
      </div>
      <p class="center muted" id="timer-hint">${esc(t('timer.hint'))}</p>
      <div class="btn-row">
        ${skBtn(t('timer.finish'), 'data-action="timer-finish"', 'sk-btn--fill', 231)}
        ${skBtn(t('timer.cancel'), 'data-action="timer-cancel"', '', 232)}
      </div>`;
    return {
      title: t('timer.title'),
      html: page({ body, corners: s ? ordinal(s) : '✦' }),
      mount: () => {
        const timeEl = appEl.querySelector('.ring-time');
        const fg = appEl.querySelector('.ring-fg');
        const total = timer.endsAt - timer.startedAt;
        const update = () => {
          const left = timer.endsAt - Date.now();
          timeEl.textContent = fmtClock(left);
          fg.setAttribute('stroke-dashoffset', (C * (1 - Math.max(0, left) / total)).toFixed(1));
          if (left <= 0) {
            clearInterval(iv);
            timeEl.textContent = t('timer.done');
            appEl.querySelector('#timer-hint').textContent = t('timer.doneHint');
            try { if (navigator.vibrate) navigator.vibrate([200, 100, 200]); } catch (e) { /* ignore */ }
            setTimeout(() => { if (app.route.name === 'timer') timerToFlow(false); }, 1600);
          }
        };
        const iv = setInterval(update, 500);
        app.cleanups.push(() => clearInterval(iv));
        update();
      }
    };
  }

  function timerToFlow(early) {
    const timer = store.data.timer;
    if (!timer) return;
    const mins = early ? Math.max(1, Math.round((Date.now() - timer.startedAt) / 60000)) : timer.minutes;
    app.flowPrefill = { sessionId: timer.sessionId, durationMin: mins };
    store.data.timer = null;
    persist();
    go('#/flow/' + timer.sessionId);
  }

  function viewBreathe(r) {
    const s = byId(r.arg);
    const B = CFG.breathing;
    const body = `
      <h1 tabindex="-1" class="center-h1">${esc(t('breathe.title'))}</h1>
      <div class="breath">
        <div class="breath-orb"><span class="breath-word" aria-live="polite">${esc(t('breathe.inhale'))}</span></div>
      </div>
      <p class="center lead" id="breath-left">${esc(t('breathe.remaining', { t: fmtClock(B.totalSec * 1000) }))}</p>
      <div class="btn-row">${skBtn(t('breathe.stop'), `href="${s ? '#/result/' + esc(s.id) : '#/'}" id="breath-done"`, '', 241)}</div>`;
    return {
      title: t('breathe.title'),
      html: page({ body, corners: s ? ordinal(s) : '✦' }),
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
            appEl.querySelector('#breath-done .sk-btn-label').textContent = t('breathe.finish');
            return;
          }
          const inCycle = el % cycle;
          const p = inCycle < B.inhaleSec * 1000 ? 'inhale' : 'exhale';
          if (p !== phase) {
            phase = p;
            orb.className = 'breath-orb is-' + p;
            word.textContent = t('breathe.' + p);
          }
          left.textContent = t('breathe.remaining', { t: fmtClock(B.totalSec * 1000 - el) });
        };
        const iv = setInterval(tick, 200);
        app.cleanups.push(() => clearInterval(iv));
        requestAnimationFrame(tick);
      }
    };
  }

  // ---------------- views: flow log ----------------

  function viewFlow(r) {
    const list = sessions().slice().reverse();
    if (!list.length) {
      return {
        title: t('flow.title'),
        html: page({ body: `<section class="page-body"><h1 tabindex="-1">${esc(t('flow.title'))}</h1><p class="lead">${esc(t('flow.noSessions'))}</p>${skBtn(t('homeView.start'), 'href="#/check/1"', 'sk-btn--primary', 81)}</section>` })
      };
    }
    const pre = app.flowPrefill;
    const s = byId(r.arg) || (pre && byId(pre.sessionId)) || list[0];
    const f = s.flow || {};
    const duration = pre && pre.sessionId === s.id ? pre.durationMin : (isNum(f.durationMin) ? f.durationMin : '');
    const task = f.taskType || (s.context && s.context.taskType) || null;
    const state = { rating: isNum(f.rating) ? f.rating : null, taskType: task };
    const opts = list.map((x) => `<option value="${esc(x.id)}" ${x.id === s.id ? 'selected' : ''}>${esc(t('flow.sessionOption', { when: fmtWhen(x.createdAt), index: x.score ? x.score.index : '—' }))}${x.flow ? esc(t('flow.logged')) : ''}</option>`).join('');
    const body = `
      <section class="page-body flow-form">
        <h1 tabindex="-1">${esc(t('flow.title'))}</h1>
        <div class="field">
          <label for="f-session">${esc(t('flow.session'))}</label>
          <select id="f-session" class="sk-select">${opts}</select>
          ${s.flow ? `<p class="hint">${esc(t('flow.overwrite'))}</p>` : ''}
        </div>
        <div class="field">
          <label for="f-duration">${esc(t('flow.duration'))}</label>
          <input id="f-duration" type="number" inputmode="numeric" min="1" max="600" step="1" value="${esc(duration)}" class="sk-input">
        </div>
        <div class="field">
          <p class="label" id="q-flow">${esc(t('flow.rating'))}</p>
          ${scaleGroup('rating', 10, state.rating, null, 'q-flow', 'scale--ten')}
          <p class="scale-ends"><span>${esc(t('flow.ratingLow'))}</span><span>${esc(t('flow.ratingHigh'))}</span></p>
        </div>
        <div class="field">
          <p class="label" id="q-ftask">${esc(t('flow.task'))}</p>
          ${chipGroup('taskType', CFG.taskTypes, state.taskType, 'q-ftask')}
        </div>
        <div class="field">
          <label for="f-interruptions">${esc(t('flow.interruptions'))}</label>
          <input id="f-interruptions" type="number" inputmode="numeric" min="0" max="99" step="1" value="${isNum(f.interruptions) ? f.interruptions : ''}" class="sk-input">
        </div>
        <div class="field">
          <label for="f-notes">${esc(t('flow.notes'))}</label>
          <textarea id="f-notes" rows="3" class="sk-input">${esc(f.notes || '')}</textarea>
        </div>
        <p class="hint" id="flow-msg" aria-live="polite"></p>
        <div class="center">${skBtn(t('flow.save'), 'data-action="flow-save" id="flow-save"', 'sk-btn--primary', 82)}</div>
      </section>`;
    return {
      title: t('flow.title'),
      html: page({ body }),
      mount: () => {
        appEl.querySelector('#f-session').addEventListener('change', (e) => {
          location.replace('#/flow/' + e.target.value);
        });
        appEl.querySelectorAll('[data-group="rating"]').forEach((b) => b.addEventListener('click', () => {
          selectRadio(b); state.rating = Number(b.dataset.value);
        }));
        appEl.querySelectorAll('[data-group="taskType"]').forEach((b) => b.addEventListener('click', () => {
          if (state.taskType === b.dataset.value) { state.taskType = null; b.setAttribute('aria-checked', 'false'); } else { selectRadio(b); state.taskType = b.dataset.value; }
        }));
        appEl.querySelector('#flow-save').addEventListener('click', () => {
          const msg = appEl.querySelector('#flow-msg');
          if (!isNum(state.rating)) { msg.textContent = t('flow.needRating'); return; }
          const num = (id, lo, hi) => {
            const v = appEl.querySelector(id).value.trim();
            if (v === '') return null;
            const n = Number(v);
            return Number.isFinite(n) && n >= lo && n <= hi ? n : null;
          };
          s.flow = {
            loggedAt: new Date().toISOString(),
            durationMin: num('#f-duration', 1, 600),
            rating: state.rating,
            taskType: state.taskType,
            interruptions: num('#f-interruptions', 0, 99),
            notes: appEl.querySelector('#f-notes').value.trim() || null
          };
          if (app.flowPrefill && app.flowPrefill.sessionId === s.id) app.flowPrefill = null;
          persist();
          toast(t('flow.saved'));
          app.hist.sel = s.id;
          app.hist.tab = 'horizon';
          go('#/history');
        });
      }
    };
  }

  // ---------------- views: history ----------------

  function viewHistory() {
    const list = scored();
    const tab = app.hist.tab;
    const tabs = ['horizon', 'insights', 'time'].map((k) => {
      const label = t('history.tab' + k.charAt(0).toUpperCase() + k.slice(1));
      return `<button type="button" role="tab" id="tab-${k}" class="tab" data-tab="${k}" aria-selected="${tab === k}" aria-controls="panel" tabindex="${tab === k ? 0 : -1}">${esc(label)}</button>`;
    }).join('');
    let panel = '';
    if (tab === 'horizon') panel = list.length ? horizonPanel(list) : `<p class="lead">${esc(t('history.empty'))}</p>`;
    if (tab === 'insights') panel = insightsPanel();
    if (tab === 'time') panel = timePanel();
    const body = `
      <section class="page-body history">
        <h1 tabindex="-1">${esc(t('history.title'))}</h1>
        <div class="tabs" role="tablist" aria-label="${esc(t('history.title'))}">${tabs}</div>
        <div id="panel" role="tabpanel" aria-labelledby="tab-${tab}">${panel}</div>
      </section>`;
    return {
      title: t('history.title'),
      html: page({ body }),
      mount: () => {
        const tabEls = Array.from(appEl.querySelectorAll('[role="tab"]'));
        tabEls.forEach((b, i) => {
          b.addEventListener('click', () => { app.hist.tab = b.dataset.tab; render(); focusSelector(`[data-tab="${b.dataset.tab}"]`); });
          b.addEventListener('keydown', (e) => {
            if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
            e.preventDefault();
            e.stopPropagation();
            const n = tabEls[(i + (e.key === 'ArrowRight' ? 1 : tabEls.length - 1)) % tabEls.length];
            app.hist.tab = n.dataset.tab; render(); focusSelector(`[data-tab="${n.dataset.tab}"]`);
          });
        });
        if (tab === 'horizon' && list.length) mountHorizon(list);
      }
    };
  }

  function focusSelector(sel) {
    const el = appEl.querySelector(sel);
    if (el) el.focus();
  }

  function horizonPanel(list) {
    return `
      <p class="muted small">${esc(t('history.legend'))}</p>
      <div class="hist-scroll" tabindex="0" aria-label="${esc(t('history.chartLabel', { n: list.length }))}">
        <div class="horizon-host hist-host"></div>
      </div>
      <div class="hist-nav">
        <button type="button" class="ink-btn ink-btn--icon" data-hist="-1" aria-label="${esc(t('history.prev'))}">${SK.arrowButton('back', 91)}</button>
        <div class="hist-detail" aria-live="polite"></div>
        <button type="button" class="ink-btn ink-btn--icon" data-hist="1" aria-label="${esc(t('history.next'))}">${SK.arrowButton('next', 92)}</button>
      </div>`;
  }

  function mountHorizon(list) {
    const scroller = appEl.querySelector('.hist-scroll');
    const host = appEl.querySelector('.hist-host');
    const spacing = scroller.clientWidth >= 700 ? 96 : 64;
    let selIdx = list.findIndex((s) => s.id === app.hist.sel);
    if (selIdx < 0) selIdx = list.length - 1;
    let drawn = null;
    let suppressScroll = false;

    const draw = (fromX) => {
      const vw = scroller.clientWidth || 360;
      const pad = 48;
      const width = Math.round(Math.max(vw, (list.length - 1) * spacing + pad * 2));
      drawn = drawHorizon(host, {
        values: list.map((s) => s.score.index),
        provisional: list.map((s) => s.score.provisional),
        stars: list.map((s) => (s.flow ? s.flow.rating : null)),
        figureAt: selIdx,
        selected: selIdx,
        width,
        height: 230,
        padX: list.length === 1 ? 0 : pad,
        single: 0.5,
        seed: 53,
        interactive: true,
        pointLabel: (i) => t('history.pointLabel', { when: fmtWhen(list[i].createdAt), index: list[i].score.index }),
        label: t('history.chartLabel', { n: list.length })
      });
      if (fromX !== undefined && fromX !== null && !reduceMotion()) walkFigure(drawn.fig, drawn.hz, fromX, drawn.figX, drawn.scale);
      host.querySelectorAll('.hz-hit').forEach((c) => c.addEventListener('click', () => select(Number(c.dataset.pt), true)));
    };

    const centerOn = (smooth) => {
      suppressScroll = true;
      scroller.scrollTo({ left: drawn.figX - scroller.clientWidth / 2, behavior: smooth && !reduceMotion() ? 'smooth' : 'auto' });
      setTimeout(() => { suppressScroll = false; }, smooth ? 900 : 80);
    };

    const detail = () => {
      const s = list[selIdx];
      const a = s.score.archetype;
      appEl.querySelector('.hist-detail').innerHTML = `
        <p class="hd-when">${esc(fmtWhen(s.createdAt))}</p>
        <p class="hd-main"><span class="arch-dot" style="background:${ART.CARD_THEME[a].bg}"></span>${esc(t('archetype.' + a + '.zh'))}${app.lang === 'en' ? ' · ' + esc(t('archetype.' + a + '.en')) : ''} · <strong>${s.score.index}</strong>${s.score.provisional ? ` <span class="tag-prov">${esc(t('result.provisional'))}</span>` : ''}</p>
        <p class="hd-flow">${s.flow ? '★ ' + esc(t('history.flowRating', { r: s.flow.rating })) : esc(t('history.noFlow'))}</p>
        <p class="hd-links"><a class="ink-link" href="#/result/${esc(s.id)}">${esc(t('history.openCards'))}</a>${s.flow ? '' : ` · <a class="ink-link" href="#/flow/${esc(s.id)}">${esc(t('history.logFlow'))}</a>`}</p>`;
    };

    const select = (i, scroll) => {
      if (i < 0 || i >= list.length || i === selIdx) return;
      const fromX = drawn.figX;
      selIdx = i;
      app.hist.sel = list[i].id;
      draw(fromX);
      detail();
      if (scroll) centerOn(true);
    };

    draw(null);
    detail();
    centerOn(false);
    app.hist.select = (dir) => select(selIdx + dir, true);

    appEl.querySelectorAll('[data-hist]').forEach((b) => b.addEventListener('click', () => select(selIdx + Number(b.dataset.hist), true)));

    // Swiping/scrolling the horizon walks the figure to the point nearest the centre.
    let st = 0;
    scroller.addEventListener('scroll', () => {
      if (suppressScroll) return;
      clearTimeout(st);
      st = setTimeout(() => {
        const maxLeft = scroller.scrollWidth - scroller.clientWidth;
        const cx = scroller.scrollLeft + scroller.clientWidth / 2;
        let best = selIdx;
        let bd = Infinity;
        drawn.hz.points.forEach((p, i) => { const dd = Math.abs(p.x - cx); if (dd < bd) { bd = dd; best = i; } });
        // At either end of the scroll range, the end points can't reach the centre — pick them directly.
        if (maxLeft > 0 && scroller.scrollLeft >= maxLeft - 2) best = list.length - 1;
        if (maxLeft > 0 && scroller.scrollLeft <= 2) best = 0;
        if (best !== selIdx) {
          const fromX = drawn.figX;
          selIdx = best;
          app.hist.sel = list[best].id;
          const left = scroller.scrollLeft;
          draw(fromX);
          scroller.scrollLeft = left;
          detail();
        }
      }, 160);
    });
    onResize(() => { draw(null); centerOn(false); });
    app.cleanups.push(() => { app.hist.select = null; clearTimeout(st); });
  }

  function insightsPanel() {
    const ins = S.flowInsights(sessions());
    if (!ins.ready) {
      const k = ins.needed - ins.nFlow;
      return `<p class="lead">${esc(t('insights.needMore', { k, n: ins.nFlow, total: ins.needed }))}</p>
        <div class="progress-dots" aria-hidden="true">${Array.from({ length: ins.needed }, (_, i) => `<span class="${i < ins.nFlow ? 'on' : ''}"></span>`).join('')}</div>`;
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
        <p>${esc(sentence(f))}</p>
        <p class="muted small">${esc(t('insights.r', { r: f.r.toFixed(2) }))} · ${esc(t('insights.strength.' + f.strength))} · ${esc(t('insights.n', { n: f.n }))}</p>
      </li>`).join('')}</ol>` : `<p>${esc(t('insights.none'))}</p>`;
    const rows = ins.factors.map((f) => `<tr><th scope="row">${esc(t('metric.' + f.metric))}</th><td>${bar(f)}</td><td class="num">${f.r >= 0 ? '+' : '−'}${Math.abs(f.r).toFixed(2)}</td><td>${esc(t('insights.strength.' + f.strength))}</td><td class="num">${f.n}</td></tr>`).join('');
    return `
      <h2>${esc(t('insights.title'))}</h2>
      ${topHtml}
      <p class="caveat">${esc(t('insights.caveat'))}</p>
      <h3>${esc(t('insights.allTitle'))}</h3>
      <div class="table-wrap"><table class="metrics ink-table">
        <thead><tr><th scope="col">${esc(t('result.metric'))}</th><th scope="col"><span class="axis-lbl"><span>${esc(t('insights.axisNeg'))}</span><span>${esc(t('insights.axisPos'))}</span></span></th><th scope="col">r</th><th scope="col"></th><th scope="col">n</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
      <p class="muted small">${esc(t('insights.method'))}</p>`;
  }

  function timePanel() {
    const td = S.timeOfDay(sessions());
    const max = Math.max(1, ...td.buckets.map((b) => b.mean || 0));
    const bars = td.buckets.map((b) => `<li class="tod${td.best === b.id ? ' is-best' : ''}">
        <span class="tod-lbl">${esc(t('timeOfDay.bucket.' + b.id))}</span>
        <span class="tod-track"><span class="tod-fill" style="width:${b.mean ? (b.mean / max) * 100 : 0}%"></span></span>
        <span class="tod-val">${b.mean !== null ? esc(t('timeOfDay.mean', { mean: b.mean })) : '—'} <span class="muted">n=${b.n}</span></span>
      </li>`).join('');
    const best = td.buckets.find((b) => b.id === td.best);
    return `
      <h2>${esc(t('timeOfDay.title'))}</h2>
      <p class="lead">${best ? esc(t('timeOfDay.best', { bucket: t('timeOfDay.bucket.' + best.id), mean: best.mean, n: best.n })) : esc(t('timeOfDay.needMore'))}</p>
      <ul class="tod-list">${bars}</ul>`;
  }

  // ---------------- views: settings & about ----------------

  function viewSettings() {
    const n = sessions().length;
    const devices = ['touch', 'keyboard', 'mouse'].map((d) => {
      const b = S.buildBaseline(sessions(), { device: d });
      return `<li>${esc(t('settings.baselineLine', { device: t('device.' + d), n: Math.min(b.n, CFG.baseline.minSessions), total: CFG.baseline.minSessions }))}${b.enabled ? ' ✓' : ''}</li>`;
    }).join('');
    const body = `
      <section class="page-body settings">
        <h1 tabindex="-1">${esc(t('settings.title'))}</h1>
        <h2>${esc(t('settings.language'))}</h2>
        <div class="chips" role="group" aria-label="${esc(t('settings.language'))}">
          <button type="button" class="chip" data-action="set-lang" data-lang="zh-TW" aria-pressed="${app.lang === 'zh-TW'}" lang="zh-Hant">繁體中文</button>
          <button type="button" class="chip" data-action="set-lang" data-lang="en" aria-pressed="${app.lang === 'en'}" lang="en">English</button>
        </div>
        <h2>${esc(t('settings.data'))}</h2>
        <p>${esc(t('settings.count', { n }))}</p>
        <p class="muted small">${esc(store.available ? t('settings.storageOk') : t('settings.storageOff'))}</p>
        <div class="btn-stack">
          ${skBtn(t('settings.exportJson'), 'data-action="export-json"', '', 101)}
          ${skBtn(t('settings.importJson'), 'data-action="import-json"', '', 102)}
          ${skBtn(t('settings.exportCsv'), 'data-action="export-csv"', '', 103)}
          ${skBtn(t('settings.clear'), 'data-action="clear-data"', 'sk-btn--danger', 104)}
        </div>
        <input type="file" id="import-file" accept="application/json,.json" hidden>
        <p class="hint" id="settings-msg" aria-live="polite"></p>
        <h2>${esc(t('settings.baselines'))}</h2>
        <ul class="plain">${devices}</ul>
        <p class="muted small">${esc(t('settings.privacy'))}</p>
        <p>${skBtn(t('settings.about'), 'href="#/about"', '', 105)}</p>
      </section>
      <dialog class="sk-dialog" id="clear-dialog" aria-labelledby="clear-h">
        <form method="dialog">
          <h2 id="clear-h">${esc(t('settings.clear'))}</h2>
          <p id="clear-text">${esc(t('settings.clearConfirm1'))}</p>
          <div class="clear-step2" hidden>
            <label for="clear-word">${esc(t('settings.clearConfirm2', { word: t('settings.clearWord') }))}</label>
            <input id="clear-word" class="sk-input" autocomplete="off">
          </div>
          <div class="btn-row">
            <button type="submit" value="cancel" class="ink-btn">${esc(t('cancel'))}</button>
            <button type="button" class="ink-btn ink-btn--danger" id="clear-go">${esc(t('settings.clearContinue'))}</button>
          </div>
        </form>
      </dialog>`;
    return {
      title: t('settings.title'),
      html: page({ body }),
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
      <article class="page-body about">
        <h1 tabindex="-1">${esc(t('about.title'))}</h1>
        ${sections.map((s) => `<section><h2>${esc(s.h)}</h2>${s.refs ? `<ol class="refs">${refs}</ol>` : s.p.map((p) => `<p>${esc(p)}</p>`).join('')}</section>`).join('')}
        <p class="disclaimer-box">${esc(t('disclaimer'))}</p>
      </article>`;
    return { title: t('about.title'), html: page({ body }) };
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
    render();
    focusSelector('.lang-btn');
  }

  const ACTIONS = {
    lang: () => setLang(app.lang === 'en' ? 'zh-TW' : 'en'),
    'set-lang': (el) => setLang(el.dataset.lang),
    start: (el, e) => { e.preventDefault(); app.draft = newDraft(); app.figureFrac = 0; go('#/check/1'); },
    'pvt-start': () => startPvt(),
    'timer-start': (el) => {
      const min = Number(el.dataset.min);
      const now = Date.now();
      const minutesMs = (FAST_PVT ? 1000 : 60000) * min; // test mode: minutes become seconds
      store.data.timer = { sessionId: el.dataset.session, startedAt: now, endsAt: now + minutesMs, minutes: min };
      persist();
      go('#/timer');
    },
    'timer-finish': () => timerToFlow(true),
    'timer-cancel': () => { store.data.timer = null; persist(); go('#/'); },
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
      go2.textContent = t('settings.clearContinue');
      go2.onclick = () => {
        if (step2.hidden) {
          step2.hidden = false;
          go2.textContent = t('settings.clearConfirm');
          word.focus();
          return;
        }
        if (word.value.trim().toUpperCase() !== t('settings.clearWord').toUpperCase()) { word.focus(); word.select(); return; }
        store.clear();
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
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const fn = ACTIONS[el.dataset.action];
    if (fn) fn(el, e);
  });

  // Roving focus inside radio groups (arrow keys move + select).
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
    if (app.route.name === 'check') {
      e.preventDefault();
      storyGo(Number(app.route.arg) || 1, dir);
    } else if (app.route.name === 'history' && app.hist.select) {
      e.preventDefault();
      app.hist.select(dir);
    }
  });

  // ---------------- router ----------------

  const VIEWS = {
    home: viewHome, check: viewCheck, result: viewResult, flow: viewFlow, history: viewHistory,
    settings: viewSettings, about: viewAbout, timer: viewTimer, breathe: viewBreathe
  };

  function parseRoute() {
    const h = location.hash.replace(/^#\/?/, '').split('?')[0];
    const parts = h.split('/').filter(Boolean).map(decodeURIComponent);
    return { name: VIEWS[parts[0]] ? parts[0] : 'home', arg: parts[1] || null };
  }

  function go(hash) {
    if (location.hash === hash) render();
    else location.hash = hash;
  }

  function render() {
    for (const fn of app.cleanups.splice(0)) { try { fn(); } catch (e) { /* ignore */ } }
    const prev = app.route.name;
    const prevKey = prev + '/' + app.route.arg;
    app.route = parseRoute();
    // The figure keeps walking from step to step, through to the results.
    if (app.route.name !== 'check' && app.route.name !== 'result' && prev === 'check') app.figureFrac = null;
    const out = VIEWS[app.route.name](app.route);
    if (!out) return; // view redirected
    document.title = out.title === t('appName') ? out.title : `${out.title} · ${t('appShort')}`;
    appEl.innerHTML = out.html;
    if (out.mount) out.mount();
    window.scrollTo(0, 0);
    // Move focus to the new page heading so screen readers announce the change.
    const h1 = appEl.querySelector('h1');
    if (h1 && prevKey !== app.route.name + '/' + app.route.arg) h1.focus({ preventScroll: true });
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
  window.addEventListener('hashchange', render);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') checkTimer(); });
  render();
  checkTimer();

  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol) && !params.has('nosw')) {
    window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
  }

  // Exposed for automated tests only.
  window.__pfc = { app, store, render };
})();
