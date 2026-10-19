/*
 * Pre-Flow Check — tunable constants.
 * Everything that controls scoring, baselines and recommendations lives here so it
 * can be edited without touching the logic in scoring.js.
 */
(function (root) {
  'use strict';

  const config = {
    schemaVersion: 1,

    // PVT-B parameters (Basner, Mollicone & Dinges, 2011).
    pvt: {
      durationMs: 180000,
      isiMinMs: 2000,
      isiMaxMs: 5000,
      lapseMs: 355,
      falseStartMs: 100,
      timeoutMs: 30000,
      feedbackMs: 1000,
      falseStartFeedbackMs: 800,
      countdownSec: 3
    },

    baseline: {
      windowSize: 14,      // most recent N valid sessions
      minSessions: 5,      // baseline is enabled at this many same-device sessions
      minMetricValues: 5   // an optional metric needs this many values to get a z-score
    },

    // Minimum SD per metric, so a very consistent history doesn't explode z-scores.
    sdFloor: {
      speed: 0.2, lapses: 1, medianRt: 15, fast10: 10, slow10: 30, falseStarts: 1,
      kss: 1, energy: 1, tension: 1,
      sleepHours: 0.5, hrv: 5, deviceReadiness: 5
    },

    zClamp: 3,

    // Readiness Index weights. Context weight is shared equally by whichever of
    // contextMetrics are present today AND have a baseline; anything missing is
    // redistributed proportionally (by dividing by the sum of weights used).
    weights: { speed: 0.35, lapses: 0.20, kss: 0.20, energy: 0.15, context: 0.10 },
    contextMetrics: ['sleepHours', 'hrv', 'deviceReadiness'],
    indexCenter: 50,
    indexScale: 15,

    // Provisional index (before a baseline exists): subjective ratings only.
    provisionalWeights: { kss: 0.20, energy: 0.15 },

    // Archetype: fixed threshold when no personal baseline is available.
    archetypeThreshold: 6,

    // "Lapses clearly above baseline": lapses >= mean + max(minAboveMean, sdMultiplier * SD).
    // Without a baseline an absolute heuristic is used instead.
    lapseAlert: { minAboveMean: 2, sdMultiplier: 1.5, absoluteWithoutBaseline: 5 },

    // Recommendation rules — evaluated top to bottom, first match wins.
    // `ctx` = { index, tension, lapsesHigh, hour }. Copy for each id lives in strings.js
    // under rec.<id>.main and rec.<id>.actions.
    recommendationRules: [
      { id: 'recover', when: (ctx) => ctx.index < 40 || ctx.lapsesHigh },
      { id: 'deep', when: (ctx) => ctx.index >= 60 && ctx.tension <= 5 },
      { id: 'breathe', when: (ctx) => ctx.index >= 60 && ctx.tension > 5, breathing: true },
      { id: 'steady', when: () => true }
    ],

    // Extra notes appended to the recommendation (copy in strings.js under note.<id>).
    recommendationNotes: [
      { id: 'postLunchDip', when: (ctx) => ctx.hour >= 13 && ctx.hour < 15 }
    ],

    breathing: { inhaleSec: 4, exhaleSec: 6, totalSec: 120 },

    focusTimerMinutes: [25, 50, 90],

    insights: { minSessions: 10, minPairs: 10, topFactors: 3 },

    // Time-of-day buckets: [startHour, endHour) in local time.
    timeBuckets: [
      { id: 'early', start: 5, end: 9 },
      { id: 'morning', start: 9, end: 12 },
      { id: 'midday', start: 12, end: 14 },
      { id: 'afternoon', start: 14, end: 18 },
      { id: 'evening', start: 18, end: 21 },
      { id: 'night', start: 21, end: 29 } // wraps past midnight to 05:00
    ],

    taskTypes: ['deep', 'creative', 'learning', 'admin', 'other']
  };

  root.PFC = root.PFC || {};
  root.PFC.config = config;
  if (typeof module === 'object' && module.exports) module.exports = config;
})(typeof globalThis !== 'undefined' ? globalThis : this);
