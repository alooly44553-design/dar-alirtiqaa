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
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return send(res, 405, { ok: false, message: 'طريقة الطلب غير مسموحة.' });
  }

  const authorization = req.headers.authorization || '';
  const match = /^Bearer ([A-Za-z0-9._~-]+)$/.exec(authorization);
  if (!match) return send(res, 401, { ok: false, message: 'سجّل الدخول أولًا.' });
  if (!process.env.DATABASE_URL) {
    return send(res, 503, { ok: false, message: 'خدمة الإدارة غير مهيأة حاليًا.' });
  }

  try {
    const { createRemoteJWKSet, jwtVerify } = await import('jose');
    const JWKS = createRemoteJWKSet(JWKS_URL);
    const { payload } = await jwtVerify(match[1], JWKS, {
      issuer: new URL(AUTH_BASE_URL).origin,
      algorithms: ['EdDSA']
    });

    const subject = typeof payload.sub === 'string' ? payload.sub : '';
    const tokenEmail = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : '';
    const verified = payload.email_verified === true || payload.emailVerified === true;
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const requestedEmail = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';

    if (!subject || subject.length > 200 || !requestedEmail || requestedEmail.length > 254) {
      return send(res, 400, { ok: false, message: 'بيانات التحقق غير مكتملة.' });
    }
    if (!verified || !tokenEmail || tokenEmail !== requestedEmail) {
      return send(res, 403, { ok: false, message: 'لم تؤكد جلسة المصادقة ملكية هذا البريد بعد. أعد التحقق ثم سجّل الدخول مجددًا.' });
    }

    const sql = neon(process.env.DATABASE_URL);
    const linked = await sql`UPDATE public.health_platform_admins
      SET auth_subject = ${subject}
      WHERE lower(trim(email)) = ${requestedEmail}
        AND role = 'owner'
        AND active = false
        AND (auth_subject IS NULL OR auth_subject = ${subject})
      RETURNING active, role`;

    if (!linked.length) {
      return send(res, 403, { ok: false, message: 'لا يوجد سجل مالك غير مفعّل يطابق البريد الموثق، أو أن الهوية مرتبطة بحساب آخر. لم تتغير الصلاحيات.' });
    }

    return send(res, 200, {
      ok: true,
      active: linked[0].active === true,
      message: 'تم التحقق من البريد وربط الهوية. تظل صلاحيات الإدارة غير مفعّلة إلى حين الاعتماد الرسمي.'
    });
  } catch (_) {
    return send(res, 401, { ok: false, message: 'تعذر التحقق من جلسة الدخول. أعد تسجيل الدخول بعد توثيق البريد.' });
  }
};
