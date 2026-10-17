'use strict';
/*
 * Deterministic demo history for screenshots and tests (not shipped with the app).
 * Sessions are scored with the real scoring code, oldest first.
 */
const S = require('../../js/scoring.js');
const cfg = require('../../js/config.js');

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeTrials(r, meanRt, n) {
  const trials = [];
  for (let i = 0; i < n; i++) {
    let rt = Math.round(meanRt + (r() - 0.4) * 80 + (r() < 0.04 ? 200 : 0));
    rt = Math.max(140, rt);
    trials.push({ t: i * 3200, isiMs: 2000 + Math.round(r() * 3000), rtMs: rt, kind: S.classifyRt(rt), input: 'touch' });
  }
  if (r() < 0.4) trials.push({ t: n * 3200, isiMs: null, rtMs: null, kind: 'falseStart', input: 'touch' });
  return trials;
}

function seed(count = 18, { now = new Date('2026-10-17T10:00:00+08:00'), withFlow = true } = {}) {
  const r = rng(42);
  const sessions = [];
  const hours = [8.5, 10, 14, 9, 16.5, 11, 20, 13.5, 9.5, 10.5, 15, 8, 19, 10, 14.5, 9, 11.5, 10];
  for (let i = 0; i < count; i++) {
    const day = new Date(now.getTime() - (count - i) * 86400000);
    const hour = hours[i % hours.length];
    day.setHours(Math.floor(hour), Math.round((hour % 1) * 60), 0, 0);
    const last = i === count - 1;                           // make the newest day a good one
    const sleep = last ? 8 : 5.5 + Math.round(r() * 6) / 2; // 5.5–8.5 h
    const sleepy = 8 - sleep;                               // -0.5 … 2.5
    const kss = Math.max(1, Math.min(9, Math.round(3 + sleepy + (r() - 0.5) * 2)));
    const energy = Math.max(1, Math.min(10, Math.round(8 - sleepy * 1.4 + (r() - 0.5) * 2)));
    const tension = last ? 3 : Math.max(1, Math.min(10, Math.round(3 + r() * 5)));
    const trials = makeTrials(r, 238 + sleepy * 16, 42 + Math.round(r() * 8));
    const s = {
      id: 'demo-' + String(i + 1).padStart(2, '0'),
      createdAt: day.toISOString(),
      tzOffsetMin: -480,
      localHour: hour,
      device: 'touch',
      subjective: { kss, energy, tension },
      context: {
        sleepHours: sleep, wakeTime: '07:00', hoursAwake: Math.round((hour - 7) * 10) / 10,
        caffeineCups: i % 3, lastCaffeineTime: i % 3 ? '08:30' : null, hoursSinceCaffeine: null,
        hrv: i % 2 ? Math.round(38 + (8 - sleepy * 3) + r() * 10) : null, restingHr: null,
        deviceReadiness: null, taskType: ['deep', 'creative', 'learning', 'admin'][i % 4]
      },
      pvt: { protocol: 'PVT-B', plannedMs: 180000, durationMs: 180400, trials, summary: S.summarizePvt(trials) },
      valid: true,
      invalidReason: null,
      score: null,
      flow: null
    };
    s.score = S.scoreSession(s, sessions.concat([s]), cfg);
    if (withFlow && i < count - 1) {
      const rating = Math.max(1, Math.min(10, Math.round(s.score.index / 10 + (sleep - 6.5) + (r() - 0.5) * 2)));
      s.flow = {
        loggedAt: new Date(day.getTime() + 3 * 3600000).toISOString(),
        durationMin: [25, 50, 90][i % 3], rating, taskType: s.context.taskType,
        interruptions: Math.round(r() * 3), notes: null
      };
    }
    sessions.push(s);
  }
  return { schemaVersion: 1, settings: {}, timer: null, sessions };
}

module.exports = { seed };
