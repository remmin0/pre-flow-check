/*
 * Pre-Flow Check — pure scoring functions.
 * No DOM, no storage, no clock reads: everything is passed in, so it can be unit-tested
 * in Node (`node --test tests/unit`) and reused in the browser as PFC.scoring.
 */
(function (root) {
  'use strict';

  const defaultConfig = (root.PFC && root.PFC.config) ||
    (typeof require === 'function' ? require('./config.js') : null);

  // ---------- small statistics helpers ----------

  const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

  function mean(xs) {
    if (!xs.length) return null;
    let s = 0;
    for (const x of xs) s += x;
    return s / xs.length;
  }

  // Sample standard deviation (n - 1).
  function sd(xs) {
    if (xs.length < 2) return 0;
    const m = mean(xs);
    let s = 0;
    for (const x of xs) s += (x - m) * (x - m);
    return Math.sqrt(s / (xs.length - 1));
  }

  function median(xs) {
    if (!xs.length) return null;
    const a = xs.slice().sort((p, q) => p - q);
    const mid = a.length >> 1;
    return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
  }

  const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
  const round1 = (x) => Math.round(x * 10) / 10;

  // ---------- PVT ----------

  function classifyRt(rtMs, cfg = defaultConfig) {
    if (!isNum(rtMs) || rtMs < cfg.pvt.falseStartMs) return 'falseStart';
    if (rtMs >= cfg.pvt.timeoutMs) return 'timeout';
    if (rtMs >= cfg.pvt.lapseMs) return 'lapse';
    return 'ok';
  }

  /*
   * trials: [{ rtMs, kind }] where kind is 'ok' | 'lapse' | 'timeout' | 'falseStart'.
   * Timeouts count as lapses with RT = timeoutMs. False starts are excluded from RT metrics.
   */
  function summarizePvt(trials, cfg = defaultConfig) {
    const rts = [];
    let falseStarts = 0;
    for (const t of trials || []) {
      if (t.kind === 'falseStart') { falseStarts++; continue; }
      rts.push(t.kind === 'timeout' ? cfg.pvt.timeoutMs : t.rtMs);
    }
    const n = rts.length;
    if (!n) {
      return { n: 0, medianRt: null, meanSpeed: null, fast10: null, slow10: null, lapses: 0, falseStarts };
    }
    const sorted = rts.slice().sort((a, b) => a - b);
    const k = Math.max(1, Math.ceil(n * 0.1));
    return {
      n,
      medianRt: Math.round(median(sorted)),
      meanSpeed: Math.round(mean(rts.map((rt) => 1000 / rt)) * 1000) / 1000,
      fast10: Math.round(mean(sorted.slice(0, k))),
      slow10: Math.round(mean(sorted.slice(n - k))),
      lapses: rts.filter((rt) => rt >= cfg.pvt.lapseMs).length,
      falseStarts
    };
  }

  // Majority input device among responses; ties prefer the more precise device.
  function majorityDevice(trials, fallback = 'touch') {
    const counts = { keyboard: 0, mouse: 0, touch: 0 };
    for (const t of trials || []) if (t.input && counts[t.input] !== undefined) counts[t.input]++;
    let best = null;
    for (const d of ['keyboard', 'mouse', 'touch']) if (counts[d] > 0 && (!best || counts[d] > counts[best])) best = d;
    return best || fallback;
  }

  // ---------- session metrics ----------

  const PVT_METRICS = ['speed', 'lapses', 'medianRt', 'fast10', 'slow10', 'falseStarts'];
  const POOLED_METRICS = ['kss', 'energy', 'tension', 'sleepHours', 'hrv', 'deviceReadiness'];

  function hasValidPvt(s) {
    return !!(s && s.valid && s.pvt && s.pvt.summary && s.pvt.summary.n > 0);
  }

  function extractMetrics(s) {
    const sub = s.subjective || {};
    const ctx = s.context || {};
    const sum = hasValidPvt(s) ? s.pvt.summary : null;
    const v = (x) => (isNum(x) ? x : null);
    return {
      speed: sum ? v(sum.meanSpeed) : null,
      lapses: sum ? v(sum.lapses) : null,
      medianRt: sum ? v(sum.medianRt) : null,
      fast10: sum ? v(sum.fast10) : null,
      slow10: sum ? v(sum.slow10) : null,
      falseStarts: sum ? v(sum.falseStarts) : null,
      kss: v(sub.kss),
      energy: v(sub.energy),
      tension: v(sub.tension),
      sleepHours: v(ctx.sleepHours),
      hrv: v(ctx.hrv),
      deviceReadiness: v(ctx.deviceReadiness)
    };
  }

  const byNewest = (a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0);

  /*
   * Personal baseline for a session on `device`, using only sessions created before `before`.
   * - PVT metrics: most recent windowSize valid sessions on the same device.
   * - Subjective/context metrics: most recent windowSize sessions on any device
   *   (they don't depend on input latency, so pooling gives more data).
   * Returns { enabled, n, device, stats: { metric: { mean, sd, n } | null } }.
   */
  function buildBaseline(sessions, { device, before, excludeId } = {}, cfg = defaultConfig) {
    const prior = (sessions || []).filter((s) =>
      s && s.id !== excludeId && (!before || s.createdAt < before)
    ).sort(byNewest);

    const pvtPool = prior.filter((s) => hasValidPvt(s) && s.device === device).slice(0, cfg.baseline.windowSize);
    // Self-ratings stay meaningful even when the PVT run was interrupted.
    const pooled = prior.slice(0, cfg.baseline.windowSize);

    const stats = {};
    const statFor = (metric, pool) => {
      const vals = pool.map((s) => extractMetrics(s)[metric]).filter(isNum);
      if (vals.length < cfg.baseline.minMetricValues) return null;
      return { mean: mean(vals), sd: Math.max(sd(vals), cfg.sdFloor[metric] || 0), n: vals.length };
    };
    for (const m of PVT_METRICS) stats[m] = statFor(m, pvtPool);
    for (const m of POOLED_METRICS) stats[m] = statFor(m, pooled);

    return {
      enabled: pvtPool.length >= cfg.baseline.minSessions,
      n: pvtPool.length,
      device,
      stats
    };
  }

  function zScore(x, stat, invert, cfg = defaultConfig) {
    if (!isNum(x) || !stat) return null;
    const z = (x - stat.mean) / stat.sd;
    return clamp(invert ? -z : z, -cfg.zClamp, cfg.zClamp);
  }

  // ---------- Readiness Index ----------

  function provisionalIndex(kss, energy, cfg = defaultConfig) {
    const w = cfg.provisionalWeights;
    const parts = [];
    if (isNum(kss)) parts.push([w.kss, (9 - kss) / 8]);
    if (isNum(energy)) parts.push([w.energy, (energy - 1) / 9]);
    if (!parts.length) return null;
    const wsum = parts.reduce((s, p) => s + p[0], 0);
    const val = parts.reduce((s, p) => s + p[0] * p[1], 0) / wsum;
    return Math.round(clamp(val * 100, 0, 100));
  }

  /*
   * Returns { index, provisional, z, weights, wz }.
   * Full index = clamp(center + scale * Σ(w·z)/Σw, 0, 100), used when the baseline is
   * enabled and today's PVT is valid; otherwise a provisional subjective-only index.
   */
  function computeIndex(metrics, baseline, cfg = defaultConfig) {
    const st = (baseline && baseline.stats) || {};
    const canScore = baseline && baseline.enabled && isNum(metrics.speed) && st.speed && st.lapses;
    if (!canScore) {
      return {
        index: provisionalIndex(metrics.kss, metrics.energy, cfg),
        provisional: true, z: {}, weights: {}, wz: null
      };
    }

    const W = cfg.weights;
    const z = {
      speed: zScore(metrics.speed, st.speed, false, cfg),
      lapses: zScore(metrics.lapses, st.lapses, true, cfg),
      kss: zScore(metrics.kss, st.kss, true, cfg),
      energy: zScore(metrics.energy, st.energy, false, cfg)
    };
    const weights = {};
    for (const k of ['speed', 'lapses', 'kss', 'energy']) if (z[k] !== null) weights[k] = W[k];

    const ctxPresent = [];
    for (const m of cfg.contextMetrics) {
      const zz = zScore(metrics[m], st[m], false, cfg);
      if (zz !== null) { z[m] = zz; ctxPresent.push(m); }
    }
    for (const m of ctxPresent) weights[m] = W.context / ctxPresent.length;

    let num = 0;
    let den = 0;
    for (const k of Object.keys(weights)) { num += weights[k] * z[k]; den += weights[k]; }
    const wz = den ? num / den : 0;
    // Report the effective (normalized) weights so the UI can show what counted.
    const eff = {};
    for (const k of Object.keys(weights)) eff[k] = Math.round((weights[k] / den) * 1000) / 1000;
    for (const k of Object.keys(z)) if (z[k] !== null) z[k] = Math.round(z[k] * 100) / 100;

    return {
      index: Math.round(clamp(cfg.indexCenter + cfg.indexScale * wz, 0, 100)),
      provisional: false,
      z,
      weights: eff,
      wz: Math.round(wz * 1000) / 1000
    };
  }

  // ---------- archetype & recommendation ----------

  /*
   * Thayer's energy × tension quadrants. With a personal baseline, energy is "high" when at
   * or above your mean and tension is "high" when above your mean; otherwise a fixed threshold.
   */
  function classifyArchetype(energy, tension, baseline, cfg = defaultConfig) {
    const st = (baseline && baseline.stats) || {};
    const thr = cfg.archetypeThreshold;
    const highEnergy = st.energy ? energy >= st.energy.mean : energy >= thr;
    const highTension = st.tension ? tension > st.tension.mean : tension >= thr;
    if (highEnergy && !highTension) return 'calmFire';
    if (highEnergy && highTension) return 'storm';
    if (!highEnergy && !highTension) return 'stillLake';
    return 'fog';
  }

  function isLapsesHigh(lapses, baseline, cfg = defaultConfig) {
    if (!isNum(lapses)) return false;
    const st = baseline && baseline.enabled && baseline.stats && baseline.stats.lapses;
    const a = cfg.lapseAlert;
    if (!st) return lapses >= a.absoluteWithoutBaseline;
    return lapses >= st.mean + Math.max(a.minAboveMean, a.sdMultiplier * st.sd);
  }

  function recommend(ctx, cfg = defaultConfig) {
    const rule = cfg.recommendationRules.find((r) => r.when(ctx)) ||
      cfg.recommendationRules[cfg.recommendationRules.length - 1];
    const notes = cfg.recommendationNotes.filter((n) => n.when(ctx)).map((n) => n.id);
    return { id: rule.id, breathing: !!rule.breathing, notes };
  }

  // Percent difference of today's PVT speed vs. baseline mean (negative = slower).
  function speedVsBaselinePct(speed, baseline) {
    const st = baseline && baseline.enabled && baseline.stats && baseline.stats.speed;
    if (!isNum(speed) || !st || !st.mean) return null;
    return Math.round((speed / st.mean - 1) * 100);
  }

  /*
   * Score a session against the sessions that came before it.
   * Returns the `score` object stored on the session.
   */
  function scoreSession(session, allSessions, cfg = defaultConfig) {
    const baseline = buildBaseline(allSessions, {
      device: session.device, before: session.createdAt, excludeId: session.id
    }, cfg);
    const metrics = extractMetrics(session);
    const idx = computeIndex(metrics, baseline, cfg);
    const lapsesHigh = isLapsesHigh(metrics.lapses, baseline, cfg);
    const rec = recommend({
      index: idx.index, tension: metrics.tension, lapsesHigh, hour: session.localHour
    }, cfg);
    return {
      index: idx.index,
      provisional: idx.provisional,
      z: idx.z,
      weights: idx.weights,
      wz: idx.wz,
      baselineN: baseline.n,
      baselineEnabled: baseline.enabled,
      speedVsBaselinePct: speedVsBaselinePct(metrics.speed, baseline),
      lapsesHigh,
      archetype: classifyArchetype(metrics.energy, metrics.tension, baseline, cfg),
      recommendationId: rec.id,
      breathing: rec.breathing,
      notes: rec.notes
    };
  }

  // ---------- correlation & insights ----------

  // Average ranks (1-based), ties share the mean rank.
  function ranks(xs) {
    const idx = xs.map((x, i) => [x, i]).sort((a, b) => a[0] - b[0]);
    const r = new Array(xs.length);
    let i = 0;
    while (i < idx.length) {
      let j = i;
      while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
      const avg = (i + j) / 2 + 1;
      for (let k = i; k <= j; k++) r[idx[k][1]] = avg;
      i = j + 1;
    }
    return r;
  }

  function pearson(xs, ys) {
    const n = xs.length;
    if (n < 2 || ys.length !== n) return null;
    const mx = mean(xs);
    const my = mean(ys);
    let sxy = 0, sxx = 0, syy = 0;
    for (let i = 0; i < n; i++) {
      const dx = xs[i] - mx;
      const dy = ys[i] - my;
      sxy += dx * dy; sxx += dx * dx; syy += dy * dy;
    }
    if (sxx === 0 || syy === 0) return null;
    return sxy / Math.sqrt(sxx * syy);
  }

  // Spearman rank correlation = Pearson on average ranks (handles ties correctly).
  function spearman(xs, ys) {
    if (xs.length !== ys.length || xs.length < 2) return null;
    return pearson(ranks(xs), ranks(ys));
  }

  function strengthOf(r) {
    const a = Math.abs(r);
    if (a < 0.1) return 'negligible';
    if (a < 0.3) return 'weak';
    if (a < 0.5) return 'moderate';
    return 'strong';
  }

  const INSIGHT_METRICS = ['kss', 'energy', 'tension', 'speed', 'lapses', 'sleepHours', 'hrv', 'hour', 'index'];

  /*
   * Within-device z-scores for PVT metrics, so touch vs. keyboard latency doesn't masquerade
   * as a real difference when more than one device has been used.
   */
  function pvtValuesNormalized(sessions, metric) {
    const devices = new Set(sessions.filter(hasValidPvt).map((s) => s.device));
    const out = new Map();
    if (devices.size <= 1) {
      for (const s of sessions) out.set(s.id, extractMetrics(s)[metric]);
      return out;
    }
    for (const d of devices) {
      const group = sessions.filter((s) => s.device === d);
      const vals = group.map((s) => extractMetrics(s)[metric]).filter(isNum);
      const m = mean(vals);
      const sdev = sd(vals) || 1;
      for (const s of group) {
        const v = extractMetrics(s)[metric];
        out.set(s.id, isNum(v) && vals.length >= 2 ? (v - m) / sdev : null);
      }
    }
    return out;
  }

  /*
   * Correlations between each metric and flow rating. Returns
   * { ready, nFlow, needed, factors: [{ metric, r, n, strength }] } sorted by |r|.
   */
  function flowInsights(sessions, cfg = defaultConfig) {
    const logged = (sessions || []).filter((s) => s.valid !== false && s.flow && isNum(s.flow.rating));
    const needed = cfg.insights.minSessions;
    if (logged.length < needed) return { ready: false, nFlow: logged.length, needed, factors: [] };

    const speedMap = pvtValuesNormalized(logged, 'speed');
    const lapseMap = pvtValuesNormalized(logged, 'lapses');
    const valueOf = (s, metric) => {
      if (metric === 'speed') return speedMap.get(s.id);
      if (metric === 'lapses') return lapseMap.get(s.id);
      if (metric === 'hour') return isNum(s.localHour) ? s.localHour : null;
      if (metric === 'index') return s.score && isNum(s.score.index) ? s.score.index : null;
      return extractMetrics(s)[metric];
    };

    const factors = [];
    for (const metric of INSIGHT_METRICS) {
      const xs = [];
      const ys = [];
      for (const s of logged) {
        const x = valueOf(s, metric);
        if (isNum(x)) { xs.push(x); ys.push(s.flow.rating); }
      }
      if (xs.length < cfg.insights.minPairs) continue;
      const r = spearman(xs, ys);
      if (r === null) continue;
      factors.push({ metric, r: Math.round(r * 100) / 100, n: xs.length, strength: strengthOf(r) });
    }
    factors.sort((a, b) => Math.abs(b.r) - Math.abs(a.r));
    return { ready: true, nFlow: logged.length, needed, factors };
  }

  function bucketForHour(hour, cfg = defaultConfig) {
    const h = hour < 5 ? hour + 24 : hour;
    const b = cfg.timeBuckets.find((x) => h >= x.start && h < x.end);
    return b ? b.id : null;
  }

  /*
   * Mean Readiness Index per time-of-day bucket. Once any full (non-provisional) scores exist,
   * provisional ones are left out because they're on a different scale.
   */
  function timeOfDay(sessions, cfg = defaultConfig) {
    let pool = (sessions || []).filter((s) => s.valid !== false && s.score && isNum(s.score.index) && isNum(s.localHour));
    const full = pool.filter((s) => !s.score.provisional);
    if (full.length >= cfg.baseline.minSessions) pool = full;
    const buckets = cfg.timeBuckets.map((b) => {
      const vals = pool.filter((s) => bucketForHour(s.localHour, cfg) === b.id).map((s) => s.score.index);
      return { id: b.id, n: vals.length, mean: vals.length ? Math.round(mean(vals)) : null };
    });
    let best = null;
    for (const b of buckets) if (b.n >= 2 && (!best || b.mean > best.mean)) best = b;
    return { buckets, best: best ? best.id : null, n: pool.length };
  }

  // ---------- context helpers ----------

  // Hours between "HH:MM" today (or yesterday, if that's in the future) and `now`.
  function hoursSince(hhmm, now) {
    if (typeof hhmm !== 'string' || !/^\d{1,2}:\d{2}$/.test(hhmm)) return null;
    const [h, m] = hhmm.split(':').map(Number);
    const then = new Date(now.getTime());
    then.setHours(h, m, 0, 0);
    let diff = (now - then) / 3600000;
    if (diff < 0) diff += 24;
    return round1(diff);
  }

  const api = {
    mean, sd, median, clamp, ranks, pearson, spearman, strengthOf,
    classifyRt, summarizePvt, majorityDevice,
    extractMetrics, hasValidPvt, buildBaseline, zScore,
    provisionalIndex, computeIndex, classifyArchetype, isLapsesHigh, recommend,
    speedVsBaselinePct, scoreSession,
    flowInsights, bucketForHour, timeOfDay, hoursSince,
    INSIGHT_METRICS, PVT_METRICS, POOLED_METRICS
  };

  root.PFC = root.PFC || {};
  root.PFC.scoring = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
