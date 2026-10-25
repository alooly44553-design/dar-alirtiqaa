'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

// These tests deliberately exercise fail-closed paths only. They do not contact
// Neon, fetch signing keys, or claim to verify real JWTs or center isolation.
const originalLoad = Module._load;
Module._load = function loadWithNeonMock(request, parent, isMain) {
  if (request === '@neondatabase/serverless') {
    return { neon() { throw new Error('Unexpected database access in fail-closed test'); } };
  }
  return originalLoad.call(this, request, parent, isMain);
};

const meHandler = require('../api/health/admin/me.js');
const dataHandler = require('../api/health/admin/data.js');

Module._load = originalLoad;

function responseSink() {
  return {
    statusCode: 200,
    headers: {},
    raw: '',
    status(code) { this.statusCode = code; return this; },
    setHeader(name, value) { this.headers[name.toLowerCase()] = String(value); return this; },
    end(value) { this.raw = String(value ?? ''); return this; },
    get body() { try { return JSON.parse(this.raw); } catch { return null; } }
  };
}

async function call(handler, overrides = {}) {
  const req = {
    method: 'GET',
    headers: {},
    ...overrides,
    headers: { ...(overrides.headers || {}) }
  };
  const res = responseSink();
  await handler(req, res);
  return res;
}

function withoutDatabase(t) {
  const previous = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  t.after(() => {
    if (previous === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previous;
  });
}

test('admin/me rejects non-GET methods before authentication or database access', async t => {
  withoutDatabase(t);
  const res = await call(meHandler, { method: 'POST', headers: { authorization: 'Bearer synthetic.token' } });
  assert.equal(res.statusCode, 405);
  assert.equal(res.headers.allow, 'GET');
  assert.equal(res.body.ok, false);
});

test('admin/me rejects a missing bearer token without database access', async t => {
  withoutDatabase(t);
  const res = await call(meHandler);
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.ok, false);
  assert.doesNotMatch(res.raw, /DATABASE_URL|synthetic/u);
});

test('admin/me fails closed when database configuration is absent', async t => {
  withoutDatabase(t);
  const res = await call(meHandler, { headers: { authorization: 'Bearer synthetic.token' } });
  assert.equal(res.statusCode, 503);
  assert.equal(res.body.ok, false);
});

test('admin/data rejects unsupported methods before authentication or database access', async t => {
  withoutDatabase(t);
  const res = await call(dataHandler, { method: 'DELETE', headers: { authorization: 'Bearer synthetic.token' } });
  assert.equal(res.statusCode, 405);
  assert.match(res.headers.allow, /GET/u);
  assert.equal(res.body.ok, false);
});

test('admin/data rejects a missing bearer token without database access', async t => {
  withoutDatabase(t);
  const res = await call(dataHandler);
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.ok, false);
  assert.doesNotMatch(res.raw, /DATABASE_URL|synthetic/u);
});

test('admin/data fails closed when database configuration is absent', async t => {
  withoutDatabase(t);
  const res = await call(dataHandler, { headers: { authorization: 'Bearer synthetic.token' } });
  assert.equal(res.statusCode, 503);
  assert.equal(res.body.ok, false);
});
