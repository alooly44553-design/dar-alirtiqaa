'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { platformPermissions, centerPermissions } = require('../api/health/admin/permissions');

test('platform owner receives only the documented platform permissions', () => {
  assert.deepEqual(platformPermissions('owner'), [
    'centers:read', 'centers:manage', 'staff:manage',
    'requests:read', 'requests:manage', 'audit:read', 'settings:manage'
  ]);
});

test('platform admin cannot manage settings', () => {
  assert.deepEqual(platformPermissions('admin'), [
    'centers:read', 'centers:manage', 'staff:manage',
    'requests:read', 'requests:manage', 'audit:read'
  ]);
});

test('unknown platform role fails closed', () => {
  assert.deepEqual(platformPermissions('unexpected-role'), []);
  assert.deepEqual(platformPermissions(undefined), []);
});

test('center owner and admin receive only center-scoped permissions', () => {
  for (const role of ['owner', 'admin']) {
    const permissions = centerPermissions(role);
    assert.deepEqual(permissions, ['center:read', 'center:manage', 'staff:manage']);
    assert.equal(permissions.some(p => p.startsWith('requests:') || p === 'audit:read'), false);
  }
});

test('center manager cannot manage staff or platform requests', () => {
  assert.deepEqual(centerPermissions('manager'), ['center:read', 'center:manage', 'staff:read']);
});

test('center staff and viewer have read-only center permissions', () => {
  assert.deepEqual(centerPermissions('staff'), ['center:read']);
  assert.deepEqual(centerPermissions('viewer'), ['center:read']);
});

test('unknown center role fails closed', () => {
  assert.deepEqual(centerPermissions('unexpected-role'), []);
  assert.deepEqual(centerPermissions(undefined), []);
});
