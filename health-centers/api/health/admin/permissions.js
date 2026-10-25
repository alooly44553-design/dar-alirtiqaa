'use strict';

// These are the permissions the UI may advertise. The API remains the
// enforcement boundary; this map intentionally does not grant center staff
// access to platform-wide service requests or audit logs.
function platformPermissions(role) {
  const roles = {
    owner: ['centers:read', 'centers:manage', 'staff:manage', 'requests:read', 'requests:manage', 'audit:read', 'settings:manage'],
    admin: ['centers:read', 'centers:manage', 'staff:manage', 'requests:read', 'requests:manage', 'audit:read'],
    auditor: ['centers:read', 'requests:read', 'audit:read']
  };
  return roles[role] ? [...roles[role]] : [];
}

function centerPermissions(role) {
  const roles = {
    owner: ['center:read', 'center:manage', 'staff:manage'],
    admin: ['center:read', 'center:manage', 'staff:manage'],
    manager: ['center:read', 'center:manage', 'staff:read'],
    staff: ['center:read'],
    viewer: ['center:read']
  };
  return roles[role] ? [...roles[role]] : [];
}

module.exports = { platformPermissions, centerPermissions };
