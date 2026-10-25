'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');

const mock = { factoryCalls: 0, queryCalls: 0, mode: 'success', failAt: 0 };
const originalLoad = Module._load;
Module._load = function loadWithNeonMock(request, parent, isMain) {
  if (request === '@neondatabase/serverless') {
    return {
      neon() {
        mock.factoryCalls += 1;
        return async function mockedSql(strings, ...values) {
          mock.queryCalls += 1;
          if (mock.failAt === mock.queryCalls) throw new Error('SENSITIVE_TEST_DATABASE_ERROR');
          if (mock.queryCalls === 1 && mock.mode === 'rate-limited') return [];
          return [{ request_count: 1 }];
        };
      }
    };
  }
  return originalLoad.call(this, request, parent, isMain);
};

const handler = require('../api/health/appointments.js');
Module._load = originalLoad;

function resetMock() {
  mock.factoryCalls = 0;
  mock.queryCalls = 0;
  mock.mode = 'success';
  mock.failAt = 0;
}

function configureEnvironment(t, { intake = 'false', database = true } = {}) {
  const keys = ['HEALTH_INTAKE_ENABLED', 'DATABASE_URL', 'RATE_LIMIT_SALT'];
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  process.env.HEALTH_INTAKE_ENABLED = intake;
  if (database) process.env.DATABASE_URL = 'postgres://synthetic.invalid/health_test';
  else delete process.env.DATABASE_URL;
  process.env.RATE_LIMIT_SALT = 'test-only-salt';
  t.after(() => {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  });
  resetMock();
}

function validBody(overrides = {}) {
  return {
    full_name: 'Synthetic Test User',
    phone: '5550101234',
    specialty: 'General care',
    preferred_date: new Date().toISOString().slice(0, 10),
    preferred_time: '09:30',
    privacy_consent: true,
    ...overrides
  };
}

function request(overrides = {}) {
  return {
    method: 'POST',
    url: '/api/health/appointments',
    headers: {
      origin: 'https://health.example.test',
      host: 'health.example.test',
      'content-length': '0',
      'x-real-ip': '203.0.113.25',
      ...(overrides.headers || {})
    },
    body: validBody(),
    socket: { remoteAddress: '203.0.113.25' },
    ...overrides,
    headers: {
      origin: 'https://health.example.test',
      host: 'health.example.test',
      'content-length': '0',
      'x-real-ip': '203.0.113.25',
      ...(overrides.headers || {})
    }
  };
}

function responseSink() {
  return {
    statusCode: 200,
    headers: {},
    raw: '',
    status(code) { this.statusCode = code; return this; },
    setHeader(name, value) { this.headers[name.toLowerCase()] = String(value); return this; },
    end(value) { this.raw = String(value ?? ''); return this; },
    json(value) { this.raw = JSON.stringify(value); return this; },
    get body() { try { return JSON.parse(this.raw); } catch { return null; } }
  };
}

async function call(overrides = {}) {
  const res = responseSink();
  await handler(request(overrides), res);
  return res;
}

test('rejects methods other than POST before touching the database', async t => {
  configureEnvironment(t, { intake: 'true' });
  const res = await call({ method: 'GET' });
  assert.equal(res.statusCode, 405);
  assert.equal(res.headers.allow, 'POST');
  assert.equal(mock.factoryCalls, 0);
});

test('rejects missing or cross-origin browser requests', async t => {
  configureEnvironment(t, { intake: 'true' });
  const missing = await call({ headers: { origin: undefined } });
  assert.equal(missing.statusCode, 403);
  const crossOrigin = await call({ headers: { origin: 'https://attacker.example.test' } });
  assert.equal(crossOrigin.statusCode, 403);
  assert.equal(mock.factoryCalls, 0);
});

test('rejects oversized and malformed request bodies', async t => {
  configureEnvironment(t, { intake: 'true' });
  const oversized = await call({ headers: { 'content-length': '9000' } });
  assert.equal(oversized.statusCode, 413);
  const malformed = await call({ body: '{' });
  assert.equal(malformed.statusCode, 400);
  assert.equal(mock.factoryCalls, 0);
});

test('requires valid fields and explicit privacy consent', async t => {
  configureEnvironment(t, { intake: 'true' });
  const res = await call({ body: validBody({ privacy_consent: false, preferred_date: '2000-01-01' }) });
  assert.equal(res.statusCode, 400);
  assert.equal(mock.factoryCalls, 0);
  assert.doesNotMatch(res.raw, /Synthetic Test User/u);
});

test('honeypot requests are not persisted', async t => {
  configureEnvironment(t, { intake: 'true' });
  const res = await call({ body: validBody({ website: 'https://spam.example.test' }) });
  assert.equal(res.statusCode, 201);
  assert.equal(mock.factoryCalls, 0);
  assert.equal(mock.queryCalls, 0);
});

test('keeps online intake disabled unless explicitly enabled', async t => {
  configureEnvironment(t, { intake: 'false' });
  const res = await call();
  assert.equal(res.statusCode, 503);
  assert.equal(mock.factoryCalls, 0);
  assert.match(res.body.message, /غير مفعّل/u);
});

test('fails closed when database configuration or client IP is missing', async t => {
  configureEnvironment(t, { intake: 'true', database: false });
  const missingDatabase = await call();
  assert.equal(missingDatabase.statusCode, 503);
  assert.equal(mock.factoryCalls, 0);

  process.env.DATABASE_URL = 'postgres://synthetic.invalid/health_test';
  const missingIp = await call({ headers: { 'x-real-ip': undefined }, socket: {} });
  assert.equal(missingIp.statusCode, 503);
  assert.equal(mock.factoryCalls, 0);
});

test('returns 429 and Retry-After when the shared rate-limit query denies a request', async t => {
  configureEnvironment(t, { intake: 'true' });
  mock.mode = 'rate-limited';
  const res = await call();
  assert.equal(res.statusCode, 429);
  assert.equal(res.headers['retry-after'], '900');
  assert.equal(mock.queryCalls, 1);
});

test('persists a synthetic request only after passing validation and rate limiting', async t => {
  configureEnvironment(t, { intake: 'true' });
  const res = await call();
  assert.equal(res.statusCode, 201);
  assert.equal(mock.queryCalls, 2);
  assert.equal(res.body.ok, true);
  assert.match(res.body.message, /ليس تأكيدًا لموعد/u);
  assert.doesNotMatch(res.raw, /Synthetic Test User|5550101234|SENSITIVE_TEST_DATABASE_ERROR/u);
});

test('returns a generic error without exposing database failures or request details', async t => {
  configureEnvironment(t, { intake: 'true' });
  mock.failAt = 1;
  const res = await call();
  assert.equal(res.statusCode, 503);
  assert.doesNotMatch(res.raw, /SENSITIVE_TEST_DATABASE_ERROR|Synthetic Test User|5550101234/u);
});

test('the migration creates the required rate-limit table without destructive SQL', () => {
  const migration = fs.readFileSync(path.join(__dirname, '../migrations/20261025_appointment_request_rate_limits.sql'), 'utf8');
  for (const token of [
    'health.appointment_request_rate_limits',
    'ip_hash',
    'window_started_at',
    'request_count'
  ]) assert.ok(migration.includes(token), 'Migration is missing required contract: ' + token);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS/u);
  assert.doesNotMatch(migration, /\bDROP\s+(TABLE|SCHEMA)\b|\bTRUNCATE\b|\bDELETE\s+FROM\b/iu);
});
