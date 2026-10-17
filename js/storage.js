/*
 * Pre-Flow Check — persistence.
 * localStorage access is wrapped in try/catch everywhere; if storage is unavailable the app
 * keeps working from memory and `available` is false so the UI can warn the user.
 * The pure helpers (migrate, parseImport, mergeSessions, toCsv) are exported for tests.
 */
(function (root) {
  'use strict';

  const SCHEMA_VERSION = 1;
  const KEY = 'pfc.data';

  function emptyData() {
    return { schemaVersion: SCHEMA_VERSION, settings: {}, timer: null, sessions: [] };
  }

  // Upgrade older data shapes in place. Add a case per schemaVersion bump.
  function migrate(raw) {
    if (!raw || typeof raw !== 'object') return emptyData();
    const data = Object.assign(emptyData(), raw);
    if (!Array.isArray(data.sessions)) data.sessions = [];
    if (!data.settings || typeof data.settings !== 'object') data.settings = {};
    // (schemaVersion 1 is current — future migrations go here.)
    data.schemaVersion = SCHEMA_VERSION;
    return data;
  }

  function isSessionLike(s) {
    return s && typeof s === 'object' && typeof s.id === 'string' && typeof s.createdAt === 'string' &&
      s.subjective && typeof s.subjective === 'object';
  }

  /*
   * Parse an exported JSON backup. Returns { ok: true, data } or { ok: false, error }.
   * error is a key: 'parse' | 'shape' | 'version'.
   */
  function parseImport(text) {
    let raw;
    try { raw = JSON.parse(text); } catch (e) { return { ok: false, error: 'parse' }; }
    if (!raw || typeof raw !== 'object' || !Array.isArray(raw.sessions)) return { ok: false, error: 'shape' };
    if (typeof raw.schemaVersion === 'number' && raw.schemaVersion > SCHEMA_VERSION) return { ok: false, error: 'version' };
    const sessions = raw.sessions.filter(isSessionLike);
    if (raw.sessions.length && !sessions.length) return { ok: false, error: 'shape' };
    return { ok: true, data: migrate(Object.assign({}, raw, { sessions })) };
  }

  // Merge by session id; the imported copy wins. Result is sorted oldest first.
  function mergeSessions(existing, incoming) {
    const map = new Map();
    for (const s of existing || []) map.set(s.id, s);
    let added = 0;
    for (const s of incoming || []) { if (!map.has(s.id)) added++; map.set(s.id, s); }
    const sessions = Array.from(map.values()).sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
    return { sessions, added, total: sessions.length };
  }

  const CSV_COLUMNS = [
    ['id', (s) => s.id],
    ['created_at', (s) => s.createdAt],
    ['local_hour', (s) => s.localHour],
    ['device', (s) => s.device],
    ['valid', (s) => s.valid],
    ['invalid_reason', (s) => s.invalidReason],
    ['kss', (s) => s.subjective && s.subjective.kss],
    ['energy', (s) => s.subjective && s.subjective.energy],
    ['tension', (s) => s.subjective && s.subjective.tension],
    ['sleep_hours', (s) => s.context && s.context.sleepHours],
    ['wake_time', (s) => s.context && s.context.wakeTime],
    ['hours_awake', (s) => s.context && s.context.hoursAwake],
    ['caffeine_cups', (s) => s.context && s.context.caffeineCups],
    ['last_caffeine_time', (s) => s.context && s.context.lastCaffeineTime],
    ['hrv_ms', (s) => s.context && s.context.hrv],
    ['resting_hr_bpm', (s) => s.context && s.context.restingHr],
    ['device_readiness', (s) => s.context && s.context.deviceReadiness],
    ['task_type', (s) => s.context && s.context.taskType],
    ['pvt_n', (s) => s.pvt && s.pvt.summary && s.pvt.summary.n],
    ['pvt_median_rt_ms', (s) => s.pvt && s.pvt.summary && s.pvt.summary.medianRt],
    ['pvt_mean_speed', (s) => s.pvt && s.pvt.summary && s.pvt.summary.meanSpeed],
    ['pvt_fastest10_ms', (s) => s.pvt && s.pvt.summary && s.pvt.summary.fast10],
    ['pvt_slowest10_ms', (s) => s.pvt && s.pvt.summary && s.pvt.summary.slow10],
    ['pvt_lapses', (s) => s.pvt && s.pvt.summary && s.pvt.summary.lapses],
    ['pvt_false_starts', (s) => s.pvt && s.pvt.summary && s.pvt.summary.falseStarts],
    ['readiness_index', (s) => s.score && s.score.index],
    ['provisional', (s) => s.score && s.score.provisional],
    ['archetype', (s) => s.score && s.score.archetype],
    ['recommendation', (s) => s.score && s.score.recommendationId],
    ['flow_rating', (s) => s.flow && s.flow.rating],
    ['flow_duration_min', (s) => s.flow && s.flow.durationMin],
    ['flow_task_type', (s) => s.flow && s.flow.taskType],
    ['flow_interruptions', (s) => s.flow && s.flow.interruptions],
    ['flow_notes', (s) => s.flow && s.flow.notes],
    ['pvt_rts_ms', (s) => s.pvt && Array.isArray(s.pvt.trials)
      ? s.pvt.trials.filter((t) => t.kind !== 'falseStart').map((t) => t.rtMs).join(';') : '']
  ];

  function csvCell(v) {
    if (v === null || v === undefined) return '';
    const str = String(v);
    return /[",\n\r]/.test(str) ? '"' + str.replace(/"/g, '""') + '"' : str;
  }

  // CSV with a UTF-8 BOM so spreadsheet apps detect the encoding of Chinese notes.
  function toCsv(sessions) {
    const lines = [CSV_COLUMNS.map((c) => c[0]).join(',')];
    for (const s of sessions || []) lines.push(CSV_COLUMNS.map((c) => csvCell(c[1](s))).join(','));
    return '﻿' + lines.join('\r\n') + '\r\n';
  }

  // ---------- browser storage ----------

  const store = {
    available: true,
    lastError: null,
    data: emptyData(),

    load() {
      try {
        const ls = root.localStorage;
        const probe = '__pfc_probe__';
        ls.setItem(probe, '1');
        ls.removeItem(probe);
        const text = ls.getItem(KEY);
        this.data = text ? migrate(JSON.parse(text)) : emptyData();
        this.available = true;
      } catch (e) {
        this.available = false;
        this.lastError = e;
        this.data = this.data || emptyData();
      }
      return this.data;
    },

    save() {
      try {
        root.localStorage.setItem(KEY, JSON.stringify(this.data));
        this.available = true;
        return true;
      } catch (e) {
        this.available = false;
        this.lastError = e;
        return false;
      }
    },

    clear() {
      this.data = emptyData();
      try { root.localStorage.removeItem(KEY); } catch (e) { this.available = false; }
    },

    // Small per-device preferences (language) stored separately from session data.
    getPref(key, fallback) {
      try {
        const v = root.localStorage.getItem('pfc.pref.' + key);
        return v === null ? fallback : v;
      } catch (e) { return fallback; }
    },
    setPref(key, value) {
      try { root.localStorage.setItem('pfc.pref.' + key, value); } catch (e) { /* ignore */ }
    }
  };

  const api = { SCHEMA_VERSION, KEY, emptyData, migrate, parseImport, mergeSessions, toCsv, CSV_COLUMNS, store };

  root.PFC = root.PFC || {};
  root.PFC.storage = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
