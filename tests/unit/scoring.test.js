'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const cfg = require('../../js/config.js');
const S = require('../../js/scoring.js');

// ---------- fixtures ----------

let seq = 0;
function session(over = {}) {
  seq++;
  const day = String(seq).padStart(2, '0');
  const base = {
    id: 's' + seq,
    createdAt: `2026-01-${day}T09:00:00.000Z`,
    localHour: 9,
    device: 'keyboard',
    valid: true,
    subjective: { kss: 3, energy: 7, tension: 3 },
    context: {},
    pvt: { summary: { n: 60, meanSpeed: 3.5, lapses: 1, medianRt: 280, fast10: 220, slow10: 380, falseStarts: 0 } },
    flow: null
  };
  const s = Object.assign(base, over);
  if (over.summary) s.pvt = { summary: Object.assign({}, base.pvt.summary, over.summary) };
  return s;
}

// Five sessions with varied values around known means.
function history(device = 'keyboard', extra = {}) {
  const speeds = [3.3, 3.4, 3.5, 3.6, 3.7];        // mean 3.5, sd ≈ 0.158 → floored to 0.2
  const lapses = [0, 1, 1, 2, 1];                  // mean 1, sd ≈ 0.707 → floored to 1
  const kss = [3, 4, 3, 2, 3];                     // mean 3
  const energy = [6, 7, 7, 8, 7];                  // mean 7
  const tension = [3, 3, 4, 2, 3];                 // mean 3
  return speeds.map((sp, i) => session(Object.assign({
    device,
    subjective: { kss: kss[i], energy: energy[i], tension: tension[i] },
    summary: { meanSpeed: sp, lapses: lapses[i] }
  }, extra)));
}

// ---------- statistics ----------

test('mean, sample sd and median', () => {
  assert.equal(S.mean([1, 2, 3, 4]), 2.5);
  assert.equal(S.mean([]), null);
  assert.ok(Math.abs(S.sd([2, 4, 4, 4, 5, 5, 7, 9]) - 2.138) < 0.001);
  assert.equal(S.sd([5]), 0);
  assert.equal(S.median([3, 1, 2]), 2);
  assert.equal(S.median([4, 1, 2, 3]), 2.5);
});

// ---------- PVT ----------

test('classifyRt applies PVT-B thresholds', () => {
  assert.equal(S.classifyRt(99), 'falseStart');
  assert.equal(S.classifyRt(100), 'ok');
  assert.equal(S.classifyRt(354), 'ok');
  assert.equal(S.classifyRt(355), 'lapse');
  assert.equal(S.classifyRt(30000), 'timeout');
  assert.equal(S.classifyRt(null), 'falseStart');
});

test('summarizePvt computes median, reciprocal speed, 10% tails, lapses, false starts', () => {
  const rts = [200, 210, 220, 230, 240, 250, 260, 270, 400, 500];
  const trials = rts.map((rt) => ({ rtMs: rt, kind: S.classifyRt(rt) }));
  trials.push({ rtMs: null, kind: 'falseStart' }, { rtMs: 60, kind: 'falseStart' });
  const sum = S.summarizePvt(trials);
  assert.equal(sum.n, 10);
  assert.equal(sum.medianRt, 245);
  const expectedSpeed = rts.reduce((s, rt) => s + 1000 / rt, 0) / rts.length;
  assert.ok(Math.abs(sum.meanSpeed - expectedSpeed) < 0.001);
  assert.equal(sum.fast10, 200);   // ceil(10% of 10) = 1 fastest
  assert.equal(sum.slow10, 500);
  assert.equal(sum.lapses, 2);
  assert.equal(sum.falseStarts, 2);
});

test('summarizePvt counts timeouts as lapses at 30 s', () => {
  const sum = S.summarizePvt([{ rtMs: 250, kind: 'ok' }, { rtMs: null, kind: 'timeout' }]);
  assert.equal(sum.lapses, 1);
  assert.equal(sum.slow10, 30000);
  assert.ok(Math.abs(sum.meanSpeed - (4 + 1000 / 30000) / 2) < 0.001);
});

test('summarizePvt with no responses', () => {
  const sum = S.summarizePvt([{ kind: 'falseStart', rtMs: null }]);
  assert.equal(sum.n, 0);
  assert.equal(sum.meanSpeed, null);
  assert.equal(sum.falseStarts, 1);
});

test('majorityDevice', () => {
  assert.equal(S.majorityDevice([{ input: 'touch' }, { input: 'touch' }, { input: 'keyboard' }]), 'touch');
  assert.equal(S.majorityDevice([{ input: 'mouse' }, { input: 'keyboard' }]), 'keyboard');
  assert.equal(S.majorityDevice([], 'mouse'), 'mouse');
});

// ---------- baseline ----------

test('baseline enables at 5 same-device sessions and applies SD floors', () => {
  const four = history().slice(0, 4);
  assert.equal(S.buildBaseline(four, { device: 'keyboard' }).enabled, false);
  const five = history();
  const b = S.buildBaseline(five, { device: 'keyboard' });
  assert.equal(b.enabled, true);
  assert.equal(b.n, 5);
  assert.ok(Math.abs(b.stats.speed.mean - 3.5) < 1e-9);
  assert.equal(b.stats.speed.sd, cfg.sdFloor.speed);
  assert.equal(b.stats.lapses.sd, cfg.sdFloor.lapses);
  assert.equal(b.stats.kss.mean, 3);
});

test('baseline filters PVT metrics by device but pools self-ratings', () => {
  const sessions = history('touch');
  const b = S.buildBaseline(sessions, { device: 'keyboard' });
  assert.equal(b.enabled, false);
  assert.equal(b.stats.speed, null);
  assert.equal(b.stats.energy.mean, 7);
});

test('baseline uses only the 14 most recent prior valid sessions', () => {
  const old = Array.from({ length: 10 }, () => session({ summary: { meanSpeed: 2.0 } }));
  const recent = Array.from({ length: 14 }, () => session({ summary: { meanSpeed: 4.0 } }));
  const invalid = session({ valid: false, summary: { meanSpeed: 1.0 } });
  const b = S.buildBaseline(old.concat(recent, [invalid]), { device: 'keyboard' });
  assert.equal(b.n, 14);
  assert.ok(Math.abs(b.stats.speed.mean - 4.0) < 1e-9);
});

test('baseline excludes the session itself and anything after it', () => {
  const h = history();
  const b = S.buildBaseline(h, { device: 'keyboard', before: h[4].createdAt });
  assert.equal(b.n, 4);
  assert.equal(b.enabled, false);
});

// ---------- index ----------

test('provisional index from subjective ratings only', () => {
  assert.equal(S.provisionalIndex(1, 10), 100);
  assert.equal(S.provisionalIndex(9, 1), 0);
  assert.equal(S.provisionalIndex(5, 5.5), 50);
  assert.equal(S.provisionalIndex(null, null), null);
});

test('computeIndex is provisional without a baseline', () => {
  const r = S.computeIndex({ kss: 5, energy: 5.5, speed: 3.5, lapses: 1 }, { enabled: false, stats: {} });
  assert.equal(r.provisional, true);
  assert.equal(r.index, 50);
});

test('computeIndex is provisional when today\'s PVT is invalid', () => {
  const b = S.buildBaseline(history(), { device: 'keyboard' });
  const r = S.computeIndex({ kss: 3, energy: 7, speed: null, lapses: null }, b);
  assert.equal(r.provisional, true);
});

test('computeIndex: at-baseline values give 50', () => {
  const b = S.buildBaseline(history(), { device: 'keyboard' });
  const r = S.computeIndex({ speed: 3.5, lapses: 1, kss: 3, energy: 7 }, b);
  assert.equal(r.provisional, false);
  assert.equal(r.index, 50);
});

test('computeIndex orients z so higher = better and weights are normalized', () => {
  const b = S.buildBaseline(history(), { device: 'keyboard' });
  // speed +1 SD, lapses -1 SD (better), KSS -1 SD (better), energy +1 SD → wz = +1
  const st = b.stats;
  const r = S.computeIndex({
    speed: 3.5 + st.speed.sd, lapses: 1 - st.lapses.sd, kss: 3 - st.kss.sd, energy: 7 + st.energy.sd
  }, b);
  assert.equal(r.z.speed, 1);
  assert.equal(r.z.lapses, 1);
  assert.equal(r.z.kss, 1);
  assert.equal(r.index, 65);
  // Without context, the four core weights are scaled up proportionally to sum to 1.
  assert.ok(Math.abs(r.weights.speed - 0.35 / 0.9) < 0.001);
  const total = Object.values(r.weights).reduce((a, w) => a + w, 0);
  assert.ok(Math.abs(total - 1) < 0.01);
});

test('computeIndex clamps z and the index', () => {
  const b = S.buildBaseline(history(), { device: 'keyboard' });
  const r = S.computeIndex({ speed: 99, lapses: -50, kss: -50, energy: 99 }, b);
  assert.equal(r.z.speed, cfg.zClamp);
  assert.equal(r.index, Math.min(100, 50 + 15 * 3));
  const low = S.computeIndex({ speed: 0, lapses: 99, kss: 99, energy: -99 }, b);
  assert.equal(low.index, 5);
});

test('context metrics share 0.10 only when present with a baseline', () => {
  const sessions = history('keyboard', { context: { sleepHours: 7, hrv: 50 } });
  sessions.forEach((s, i) => { s.context = { sleepHours: 6 + i * 0.5, hrv: 40 + i * 5 }; });
  const b = S.buildBaseline(sessions, { device: 'keyboard' });
  const r = S.computeIndex({ speed: 3.5, lapses: 1, kss: 3, energy: 7, sleepHours: 8, hrv: null, deviceReadiness: 80 }, b);
  assert.ok('sleepHours' in r.weights);
  assert.ok(!('hrv' in r.weights));            // not provided today
  assert.ok(!('deviceReadiness' in r.weights)); // no baseline
  assert.ok(Math.abs(r.weights.sleepHours - 0.10) < 0.001);
  assert.ok(Math.abs(r.weights.speed - 0.35) < 0.001);
});

// ---------- archetype ----------

test('archetype uses threshold 6 without a baseline', () => {
  const none = { stats: {} };
  assert.equal(S.classifyArchetype(6, 5, none), 'calmFire');
  assert.equal(S.classifyArchetype(8, 6, none), 'storm');
  assert.equal(S.classifyArchetype(5, 2, none), 'stillLake');
  assert.equal(S.classifyArchetype(3, 8, none), 'fog');
});

test('archetype uses personal means when available', () => {
  const b = { stats: { energy: { mean: 4, sd: 1 }, tension: { mean: 7, sd: 1 } } };
  assert.equal(S.classifyArchetype(4, 7, b), 'calmFire');  // at mean energy, not above mean tension
  assert.equal(S.classifyArchetype(5, 8, b), 'storm');
  assert.equal(S.classifyArchetype(3, 6, b), 'stillLake');
  assert.equal(S.classifyArchetype(3, 8, b), 'fog');
});

// ---------- recommendation ----------

test('recommendation rules in order', () => {
  assert.equal(S.recommend({ index: 70, tension: 5, lapsesHigh: false, hour: 9 }).id, 'deep');
  const b = S.recommend({ index: 70, tension: 6, lapsesHigh: false, hour: 9 });
  assert.equal(b.id, 'breathe');
  assert.equal(b.breathing, true);
  assert.equal(S.recommend({ index: 59, tension: 2, lapsesHigh: false, hour: 9 }).id, 'steady');
  assert.equal(S.recommend({ index: 40, tension: 2, lapsesHigh: false, hour: 9 }).id, 'steady');
  assert.equal(S.recommend({ index: 39, tension: 2, lapsesHigh: false, hour: 9 }).id, 'recover');
  assert.equal(S.recommend({ index: 80, tension: 2, lapsesHigh: true, hour: 9 }).id, 'recover');
});

test('post-lunch dip note between 13:00 and 15:00', () => {
  assert.deepEqual(S.recommend({ index: 50, tension: 3, hour: 13 }).notes, ['postLunchDip']);
  assert.deepEqual(S.recommend({ index: 50, tension: 3, hour: 14 }).notes, ['postLunchDip']);
  assert.deepEqual(S.recommend({ index: 50, tension: 3, hour: 15 }).notes, []);
  assert.deepEqual(S.recommend({ index: 50, tension: 3, hour: 12 }).notes, []);
});

test('lapses clearly above baseline', () => {
  const b = S.buildBaseline(history(), { device: 'keyboard' }); // mean 1, sd 1 → threshold 1 + max(2, 1.5) = 3
  assert.equal(S.isLapsesHigh(2, b), false);
  assert.equal(S.isLapsesHigh(3, b), true);
  assert.equal(S.isLapsesHigh(4, { enabled: false, stats: {} }), false);
  assert.equal(S.isLapsesHigh(5, { enabled: false, stats: {} }), true);
});

test('speedVsBaselinePct', () => {
  const b = S.buildBaseline(history(), { device: 'keyboard' });
  assert.equal(S.speedVsBaselinePct(3.5 * 0.92, b), -8);
  assert.equal(S.speedVsBaselinePct(3.5, { enabled: false, stats: {} }), null);
});

test('scoreSession end to end', () => {
  const h = history();
  const today = session({ localHour: 14, subjective: { kss: 3, energy: 7, tension: 3 }, summary: { meanSpeed: 3.5, lapses: 1 } });
  const score = S.scoreSession(today, h.concat([today]));
  assert.equal(score.provisional, false);
  assert.equal(score.index, 50);
  assert.equal(score.baselineN, 5);
  assert.equal(score.archetype, 'calmFire');
  assert.equal(score.recommendationId, 'steady');
  assert.deepEqual(score.notes, ['postLunchDip']);
  assert.equal(score.speedVsBaselinePct, 0);
});

// ---------- correlation ----------

test('ranks average ties', () => {
  assert.deepEqual(S.ranks([10, 20, 20, 30]), [1, 2.5, 2.5, 4]);
});

test('pearson and spearman', () => {
  assert.ok(Math.abs(S.pearson([1, 2, 3, 4], [2, 4, 6, 8]) - 1) < 1e-12);
  assert.ok(Math.abs(S.pearson([1, 2, 3, 4], [8, 6, 4, 2]) + 1) < 1e-12);
  assert.equal(S.pearson([1, 1, 1], [1, 2, 3]), null);
  // Monotonic but non-linear → Spearman 1.
  assert.ok(Math.abs(S.spearman([1, 2, 3, 4, 5], [1, 4, 9, 16, 100]) - 1) < 1e-12);
  // Known value with ties: x=[1,2,3,4,5], y=[2,1,4,3,5] → rho = 0.8
  assert.ok(Math.abs(S.spearman([1, 2, 3, 4, 5], [2, 1, 4, 3, 5]) - 0.8) < 1e-12);
});

test('strengthOf bins', () => {
  assert.equal(S.strengthOf(0.05), 'negligible');
  assert.equal(S.strengthOf(-0.2), 'weak');
  assert.equal(S.strengthOf(0.45), 'moderate');
  assert.equal(S.strengthOf(-0.7), 'strong');
});

test('flowInsights requires 10 flow-logged sessions', () => {
  const few = Array.from({ length: 9 }, (_, i) => session({ flow: { rating: i + 1 } }));
  const r = S.flowInsights(few);
  assert.equal(r.ready, false);
  assert.equal(r.nFlow, 9);
});

test('flowInsights ranks factors by |r|', () => {
  const sessions = Array.from({ length: 12 }, (_, i) => session({
    localHour: 8 + (i % 3),
    subjective: { kss: 9 - (i % 9), energy: 1 + (i % 10), tension: 5 },
    context: { sleepHours: 5 + i * 0.25 },
    summary: { meanSpeed: 3 + ((i * 7) % 5) * 0.1, lapses: i % 2 },
    score: { index: 40 + i },
    flow: { rating: 1 + Math.floor(i * 0.8) }
  }));
  const r = S.flowInsights(sessions);
  assert.equal(r.ready, true);
  assert.equal(r.factors[0].metric === 'sleepHours' || r.factors[0].metric === 'index', true);
  assert.ok(r.factors[0].r > 0.95);
  assert.ok(!r.factors.some((f) => f.metric === 'tension')); // zero variance → no r
  assert.ok(!r.factors.some((f) => f.metric === 'hrv'));     // never provided
  for (let i = 1; i < r.factors.length; i++) {
    assert.ok(Math.abs(r.factors[i - 1].r) >= Math.abs(r.factors[i].r));
  }
});

// ---------- time of day ----------

test('bucketForHour wraps night past midnight', () => {
  assert.equal(S.bucketForHour(6), 'early');
  assert.equal(S.bucketForHour(10), 'morning');
  assert.equal(S.bucketForHour(13), 'midday');
  assert.equal(S.bucketForHour(15), 'afternoon');
  assert.equal(S.bucketForHour(19), 'evening');
  assert.equal(S.bucketForHour(23), 'night');
  assert.equal(S.bucketForHour(2), 'night');
});

test('timeOfDay picks the best bucket with n >= 2', () => {
  const mk = (h, idx) => session({ localHour: h, score: { index: idx, provisional: false } });
  const r = S.timeOfDay([mk(10, 70), mk(10, 60), mk(15, 50), mk(15, 52), mk(20, 99)]);
  assert.equal(r.best, 'morning');
  assert.equal(r.buckets.find((b) => b.id === 'morning').mean, 65);
  assert.equal(r.buckets.find((b) => b.id === 'evening').n, 1);
});

test('hoursSince handles yesterday wrap', () => {
  const now = new Date(2026, 0, 2, 9, 30);
  assert.equal(S.hoursSince('07:00', now), 2.5);
  assert.equal(S.hoursSince('22:00', now), 11.5);
  assert.equal(S.hoursSince('bad', now), null);
});
