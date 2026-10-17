/*
 * Pre-Flow Check — PVT-B runner (Basner, Mollicone & Dinges, 2011 parameters).
 *
 * Timing notes:
 * - All times are on the performance.now() timeline. Responses use event.timeStamp, which is
 *   on the same high-resolution timeline in modern browsers (with a fallback if it isn't).
 * - The stimulus is made visible inside a requestAnimationFrame callback; its onset is the
 *   timestamp of the NEXT frame — the first frame in which it has actually been painted.
 * - The inter-stimulus interval (2–5 s) runs from the previous response; the ~1 s RT display
 *   happens inside it. A false start restarts the interval.
 */
(function (root) {
  'use strict';

  function eventTime(e) {
    const now = performance.now();
    const ts = e && e.timeStamp;
    // Some engines report epoch-based or coarse timestamps; fall back to now().
    if (typeof ts !== 'number' || ts <= 0 || ts > now + 50 || now - ts > 1000) return now;
    return ts;
  }

  /*
   * opts: {
   *   surface, stimulusEl, counterEl, messageEl, progressEl,
   *   cfg (PFC.config.pvt), durationMs, text: { tooEarly, noResponse },
   *   onEnd({ trials, durationMs, startedAt }), onInterrupt(reason)
   * }
   */
  function PvtRunner(opts) {
    this.o = opts;
    this.cfg = opts.cfg;
    this.durationMs = opts.durationMs || this.cfg.durationMs;
    this.running = false;
    this.trials = [];
    this.wakeLock = null;
    this._bound = {
      frame: this._frame.bind(this),
      pointer: this._onPointer.bind(this),
      key: this._onKey.bind(this),
      visibility: this._onVisibility.bind(this),
      prevent: (e) => { if (e.cancelable) e.preventDefault(); }
    };
  }

  PvtRunner.prototype.randomIsi = function () {
    const c = this.cfg;
    return c.isiMinMs + Math.random() * (c.isiMaxMs - c.isiMinMs);
  };

  PvtRunner.prototype.start = function () {
    const o = this.o;
    const b = this._bound;
    this.running = true;
    this.trials = [];
    this.startAt = performance.now();
    this.state = 'isi';
    this.isiMs = this.randomIsi();
    this.nextAt = this.startAt + this.isiMs;
    this.messageUntil = 0;

    o.surface.addEventListener('pointerdown', b.pointer);
    o.surface.addEventListener('contextmenu', b.prevent);
    o.surface.addEventListener('touchmove', b.prevent, { passive: false });
    o.surface.addEventListener('gesturestart', b.prevent);
    o.surface.addEventListener('dblclick', b.prevent);
    window.addEventListener('keydown', b.key, true);
    document.addEventListener('visibilitychange', b.visibility);
    window.addEventListener('pagehide', b.visibility);

    this._requestWakeLock();
    this._hideStimulus();
    this._raf = requestAnimationFrame(b.frame);
  };

  PvtRunner.prototype._requestWakeLock = function () {
    try {
      if (navigator.wakeLock && navigator.wakeLock.request) {
        navigator.wakeLock.request('screen').then((lock) => {
          if (!this.running) { lock.release().catch(() => {}); return; }
          this.wakeLock = lock;
        }).catch(() => {});
      }
    } catch (e) { /* unsupported — fine */ }
  };

  PvtRunner.prototype._cleanup = function () {
    const o = this.o;
    const b = this._bound;
    this.running = false;
    cancelAnimationFrame(this._raf);
    o.surface.removeEventListener('pointerdown', b.pointer);
    o.surface.removeEventListener('contextmenu', b.prevent);
    o.surface.removeEventListener('touchmove', b.prevent);
    o.surface.removeEventListener('gesturestart', b.prevent);
    o.surface.removeEventListener('dblclick', b.prevent);
    window.removeEventListener('keydown', b.key, true);
    document.removeEventListener('visibilitychange', b.visibility);
    window.removeEventListener('pagehide', b.visibility);
    if (this.wakeLock) { this.wakeLock.release().catch(() => {}); this.wakeLock = null; }
  };

  // Stop without reporting (e.g. user navigated away).
  PvtRunner.prototype.abort = function () {
    if (this.running) this._cleanup();
  };

  PvtRunner.prototype._showStimulus = function () {
    const o = this.o;
    o.counterEl.textContent = '0';
    o.stimulusEl.classList.add('is-on');
    o.stimulusEl.classList.remove('is-frozen');
  };

  PvtRunner.prototype._hideStimulus = function () {
    this.o.stimulusEl.classList.remove('is-on', 'is-frozen');
  };

  PvtRunner.prototype._message = function (text, ms) {
    const el = this.o.messageEl;
    el.textContent = text;
    el.classList.add('is-on');
    this.messageUntil = performance.now() + ms;
  };

  PvtRunner.prototype._record = function (trial) {
    trial.t = Math.round(trial.at - this.startAt);
    delete trial.at;
    this.trials.push(trial);
  };

  PvtRunner.prototype._frame = function (ts) {
    if (!this.running) return;
    const o = this.o;
    const now = performance.now();
    const elapsed = now - this.startAt;
    o.progressEl.style.transform = `scaleX(${Math.min(1, elapsed / this.durationMs).toFixed(4)})`;

    if (this.messageUntil && now >= this.messageUntil) {
      o.messageEl.classList.remove('is-on');
      this.messageUntil = 0;
    }

    switch (this.state) {
      case 'isi':
        if (elapsed >= this.durationMs) { this._finish(); return; }
        if (now >= this.nextAt) {
          this._showStimulus();
          this.state = 'pending';
        }
        break;
      case 'pending':
        // This frame is the first one after the stimulus was committed to paint.
        this.onset = Math.min(ts, now);
        this.state = 'stimulus';
        if (this.pendingResponse) {
          const r = this.pendingResponse;
          this.pendingResponse = null;
          this._respond(r.at, r.input);
        }
        break;
      case 'stimulus': {
        const rt = now - this.onset;
        if (rt >= this.cfg.timeoutMs) {
          this._record({ at: now, isiMs: Math.round(this.isiMs), rtMs: this.cfg.timeoutMs, kind: 'timeout', input: null });
          this._hideStimulus();
          this._message(o.text.noResponse, this.cfg.feedbackMs);
          this._scheduleNext(now);
        } else {
          o.counterEl.textContent = String(Math.floor(rt));
        }
        break;
      }
      case 'feedback':
        if (now >= this.feedbackUntil) { this._hideStimulus(); this.state = 'isi'; }
        break;
    }
    this._raf = requestAnimationFrame(this._bound.frame);
  };

  PvtRunner.prototype._scheduleNext = function (from) {
    this.isiMs = this.randomIsi();
    this.nextAt = from + this.isiMs;
    this.state = 'isi';
  };

  PvtRunner.prototype._respond = function (at, input) {
    const o = this.o;
    const c = this.cfg;
    if (this.state === 'pending') {
      // Onset not known until the next frame — resolve it then.
      this.pendingResponse = { at, input };
      return;
    }
    if (this.state === 'stimulus') {
      const rt = at - this.onset;
      if (rt < c.falseStartMs) {
        this._record({ at, isiMs: Math.round(this.isiMs), rtMs: Math.max(0, Math.round(rt)), kind: 'falseStart', input });
        this._hideStimulus();
        this._message(o.text.tooEarly, c.falseStartFeedbackMs);
        this._scheduleNext(at);
        return;
      }
      const rtMs = Math.round(rt);
      const kind = rtMs >= c.lapseMs ? 'lapse' : 'ok';
      this._record({ at, isiMs: Math.round(this.isiMs), rtMs, kind, input });
      o.counterEl.textContent = String(rtMs);
      o.stimulusEl.classList.add('is-frozen');
      this._scheduleNext(at);
      this.state = 'feedback';
      this.feedbackUntil = at + c.feedbackMs;
      return;
    }
    // Response during the interval (including the RT display) = false start; restart the ISI.
    this._record({ at, isiMs: null, rtMs: null, kind: 'falseStart', input });
    this._hideStimulus();
    this._message(o.text.tooEarly, c.falseStartFeedbackMs);
    this._scheduleNext(at);
  };

  PvtRunner.prototype._onPointer = function (e) {
    if (!this.running) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (e.cancelable) e.preventDefault();
    this._respond(eventTime(e), e.pointerType === 'mouse' ? 'mouse' : 'touch');
  };

  PvtRunner.prototype._onKey = function (e) {
    if (!this.running) return;
    if (e.key === 'Escape') { e.preventDefault(); this._interrupt('aborted'); return; }
    if (e.code === 'Space' || e.key === ' ' || e.key === 'Spacebar') {
      e.preventDefault();
      if (e.repeat) return;
      this._respond(eventTime(e), 'keyboard');
    }
  };

  PvtRunner.prototype._onVisibility = function (e) {
    if (!this.running) return;
    if (e.type === 'pagehide' || document.visibilityState === 'hidden') this._interrupt('interrupted');
  };

  PvtRunner.prototype._interrupt = function (reason) {
    this._cleanup();
    this._hideStimulus();
    if (this.o.onInterrupt) this.o.onInterrupt(reason, this.trials.slice());
  };

  PvtRunner.prototype._finish = function () {
    const durationMs = Math.round(performance.now() - this.startAt);
    this._cleanup();
    this._hideStimulus();
    this.o.onEnd({ trials: this.trials.slice(), durationMs });
  };

  root.PFC = root.PFC || {};
  root.PFC.PvtRunner = PvtRunner;
})(typeof globalThis !== 'undefined' ? globalThis : this);
