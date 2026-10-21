'use strict';

const { neon } = require('@neondatabase/serverless');

const AUTH_BASE_URL = 'https://ep-dark-frost-b3sqm6rz.neonauth.c-4.ap-southeast-1.aws.neon.tech/neondb/auth';
const JWKS_URL = new URL(AUTH_BASE_URL + '/.well-known/jwks.json');

function send(res, status, payload) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Vary', 'Authorization');
  return res.end(JSON.stringify(payload));
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return send(res, 405, { ok: false, message: 'طريقة الطلب غير مسموحة.' });
  }

  const authorization = req.headers.authorization || '';
  const match = /^Bearer ([A-Za-z0-9._~-]+)$/.exec(authorization);
  if (!match) {
    return send(res, 401, { ok: false, message: 'سجّل الدخول أولًا.' });
  }

  if (!process.env.DATABASE_URL) {
    return send(res, 503, { ok: false, message: 'خدمة الإدارة غير مهيأة حاليًا.' });
  }

  try {
    const { createRemoteJWKSet, jwtVerify } = await import('jose');
    const JWKS = createRemoteJWKSet(JWKS_URL);
    const { payload } = await jwtVerify(match[1], JWKS, {
      issuer: AUTH_BASE_URL,
      algorithms: ['EdDSA']
    });

    const subject = typeof payload.sub === 'string' ? payload.sub : '';
    if (!subject || subject.length > 200) {
      return send(res, 401, { ok: false, message: 'جلسة الدخول غير صالحة.' });
    }

    const sql = neon(process.env.DATABASE_URL);
    const platformAdmins = await sql`SELECT display_name, role
      FROM public.health_platform_admins
      WHERE auth_subject = ${subject} AND active = true
      LIMIT 1`;

    if (platformAdmins.length) {
      return send(res, 200, {
        ok: true,
        account: {
          type: 'platform_admin',
          displayName: platformAdmins[0].display_name,
          role: platformAdmins[0].role,
          permissions: platformAdmins[0].role === 'owner'
            ? ['centers:read', 'centers:manage', 'staff:manage', 'requests:read', 'requests:manage', 'audit:read', 'settings:manage']
            : platformAdmins[0].role === 'admin'
              ? ['centers:read', 'centers:manage', 'staff:manage', 'requests:read', 'requests:manage', 'audit:read']
              : ['centers:read', 'requests:read', 'audit:read']
        }
      });
    }

    const staff = await sql`SELECT s.display_name, s.role, c.id AS center_id, c.name AS center_name, c.status AS center_status
      FROM public.health_center_staff s
      JOIN public.health_centers c ON c.id = s.center_id
      WHERE s.auth_subject = ${subject} AND s.active = true AND c.status = 'active'
      LIMIT 1`;

    if (!staff.length) {
      return send(res, 403, { ok: false, message: 'هذا الحساب غير مخوّل لدخول إدارة المراكز. تواصل مع المسؤول المعتمد.' });
    }

    const role = staff[0].role;
    const permissions = role === 'owner' || role === 'admin'
      ? ['center:read', 'center:manage', 'staff:manage', 'requests:read', 'requests:manage', 'audit:read']
      : role === 'manager'
        ? ['center:read', 'center:manage', 'staff:read', 'requests:read', 'requests:manage']
        : role === 'staff'
          ? ['center:read', 'requests:read', 'requests:update']
          : ['center:read', 'requests:read'];

    return send(res, 200, {
      ok: true,
      account: {
        type: 'center_staff',
        displayName: staff[0].display_name,
        role,
        centerId: staff[0].center_id,
        centerName: staff[0].center_name,
        permissions
      }
    });
  } catch (_) {
    // Never return tokens, identity claims, database errors, or personal data.
    return send(res, 401, { ok: false, message: 'تعذر التحقق من جلسة الدخول. أعد تسجيل الدخول.' });
  }
};
