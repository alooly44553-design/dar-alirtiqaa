'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { platformPermissions, centerPermissions, canChangeCenterStatus } = require('../api/health/admin/permissions');

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


test('platform administrator can perform valid center status transitions', () => {
  assert.equal(canChangeCenterStatus('platform_admin', 'draft', 'active'), true);
  assert.equal(canChangeCenterStatus('platform_admin', 'active', 'suspended'), true);
  assert.equal(canChangeCenterStatus('platform_admin', 'suspended', 'active'), true);
});

test('center staff may preserve but cannot change the center approval state', () => {
  for (const status of ['draft', 'active', 'suspended']) {
    assert.equal(canChangeCenterStatus('center_staff', status, status), true);
  }
  assert.equal(canChangeCenterStatus('center_staff', 'active', 'suspended'), false);
  assert.equal(canChangeCenterStatus('center_staff', 'active', 'draft'), false);
  assert.equal(canChangeCenterStatus('center_staff', 'draft', 'active'), false);
});

test('unknown account types and invalid states cannot change center approval state', () => {
  assert.equal(canChangeCenterStatus('unknown', 'active', 'active'), false);
  assert.equal(canChangeCenterStatus('center_staff', 'invalid', 'invalid'), false);
  assert.equal(canChangeCenterStatus('platform_admin', 'draft', 'unknown'), false);
});
