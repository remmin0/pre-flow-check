'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const St = require('../../js/storage.js');

const s1 = { id: 'a', createdAt: '2026-01-01T09:00:00Z', subjective: { kss: 3, energy: 7, tension: 2 }, flow: null };
const s2 = { id: 'b', createdAt: '2026-01-02T09:00:00Z', subjective: { kss: 5, energy: 5, tension: 5 },
  flow: { rating: 7, notes: 'focus, "deep"\nline 2' } };

test('migrate fills defaults', () => {
  const d = St.migrate({ sessions: 'nope' });
  assert.deepEqual(d.sessions, []);
  assert.equal(d.schemaVersion, St.SCHEMA_VERSION);
  assert.deepEqual(St.migrate(null).sessions, []);
});

test('parseImport accepts an exported backup', () => {
  const text = JSON.stringify({ schemaVersion: 1, sessions: [s1, s2], settings: {} });
  const r = St.parseImport(text);
  assert.equal(r.ok, true);
  assert.equal(r.data.sessions.length, 2);
});

test('parseImport rejects bad input', () => {
  assert.equal(St.parseImport('{oops').error, 'parse');
  assert.equal(St.parseImport('{"foo":1}').error, 'shape');
  assert.equal(St.parseImport('{"sessions":[{"x":1}]}').error, 'shape');
  assert.equal(St.parseImport('{"schemaVersion":99,"sessions":[]}').error, 'version');
});

test('mergeSessions dedupes by id, imported copy wins, sorted oldest first', () => {
  const updated = Object.assign({}, s1, { flow: { rating: 9 } });
  const r = St.mergeSessions([s2, s1], [updated]);
  assert.equal(r.total, 2);
  assert.equal(r.added, 0);
  assert.equal(r.sessions[0].id, 'a');
  assert.equal(r.sessions[0].flow.rating, 9);
});

test('JSON export → import round trip restores sessions', () => {
  const data = St.migrate({ sessions: [s1, s2] });
  const r = St.parseImport(JSON.stringify(data));
  assert.deepEqual(r.data.sessions, data.sessions);
});

test('toCsv escapes quotes, commas and newlines, with BOM', () => {
  const csv = St.toCsv([s1, s2]);
  assert.ok(csv.startsWith('﻿id,created_at'));
  const lines = csv.slice(1).split('\r\n');
  assert.equal(lines[0].split(',').length, St.CSV_COLUMNS.length);
  assert.ok(csv.includes('"focus, ""deep""\nline 2"'));
});
