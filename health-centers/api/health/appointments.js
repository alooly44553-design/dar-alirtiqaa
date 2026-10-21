'use strict';

const crypto = require('node:crypto');
const { neon } = require('@neondatabase/serverless');

const MAX_BODY_BYTES = 8192;
const WINDOW_MINUTES = 15;
const MAX_REQUESTS_PER_WINDOW = 5;

function send(res, status, payload) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  return res.end(JSON.stringify(payload));
}

function cleanText(value, max) {
  return typeof value === 'string' ? value.trim().replace(/[\u0000-\u001f\u007f]/g, '').slice(0, max) : '';
}

function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const ms = Date.parse(value + 'T00:00:00Z');
  if (!Number.isFinite(ms)) return false;
  const day = 24 * 60 * 60 * 1000;
  const today = new Date();
  const utcToday = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return ms >= utcToday && ms <= utcToday + 180 * day && new Date(ms).toISOString().slice(0, 10) === value;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return send(res, 405, { ok: false, message: 'هذه الواجهة تستقبل إرسال الطلبات فقط.' });
  }

  // Restrict browser submissions to the same origin; no cross-origin access is enabled.
  const origin = req.headers.origin;
  const host = req.headers.host;
  try {
    if (!origin || !host || new URL(origin).host.toLowerCase() !== String(host).toLowerCase()) {
      return send(res, 403, { ok: false, message: 'تعذر التحقق من مصدر الطلب.' });
    }
  } catch (_) {
    return send(res, 403, { ok: false, message: 'تعذر التحقق من مصدر الطلب.' });
  }

  const length = Number(req.headers['content-length'] || 0);
  if (length > MAX_BODY_BYTES) {
    return send(res, 413, { ok: false, message: 'حجم الطلب أكبر من المسموح.' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    if (Buffer.byteLength(body, 'utf8') > MAX_BODY_BYTES) {
      return send(res, 413, { ok: false, message: 'حجم الطلب أكبر من المسموح.' });
    }
    try { body = JSON.parse(body); } catch (_) {
      return send(res, 400, { ok: false, message: 'صيغة الطلب غير صحيحة.' });
    }
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return send(res, 400, { ok: false, message: 'بيانات الطلب غير صحيحة.' });
  }

  // Honeypot: silently accept automated form fills without storing their content.
  if (cleanText(body.website, 200)) {
    return send(res, 201, { ok: true, message: 'تم استلام الطلب.' });
  }

  const fullName = cleanText(body.full_name, 100);
  const phone = cleanText(body.phone, 24);
  const specialty = cleanText(body.specialty, 100);
  const preferredDate = cleanText(body.preferred_date, 10);
  const preferredTime = cleanText(body.preferred_time, 5);
  const consent = body.privacy_consent === true;

  if (fullName.length < 2 || !/^[+0-9()\s.-]{6,24}$/.test(phone) ||
      specialty.length < 2 || !validDate(preferredDate) ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(preferredTime) || !consent) {
    return send(res, 400, {
      ok: false,
      message: 'يرجى مراجعة الاسم ورقم التواصل والتخصص والتاريخ والوقت والموافقة على إشعار الخصوصية.'
    });
  }

  if (!process.env.DATABASE_URL) {
    return send(res, 503, { ok: false, message: 'خدمة استقبال الطلبات غير مهيأة حاليًا.' });
  }

  const ip = cleanText(req.headers['x-real-ip'] || req.socket?.remoteAddress || '', 100);
  if (!ip) return send(res, 503, { ok: false, message: 'تعذر التحقق من الطلب. حاول لاحقًا.' });

  const salt = process.env.RATE_LIMIT_SALT || process.env.DATABASE_URL;
  const ipHash = crypto.createHash('sha256').update(salt + ':' + ip).digest('hex');

  try {
    const sql = neon(process.env.DATABASE_URL);

    const rate = await sql`INSERT INTO health.appointment_request_rate_limits (ip_hash, window_started_at, request_count)
      VALUES (${ipHash}, now(), 1)
      ON CONFLICT (ip_hash) DO UPDATE
      SET request_count = CASE
            WHEN health.appointment_request_rate_limits.window_started_at < now() - interval '15 minutes' THEN 1
            ELSE health.appointment_request_rate_limits.request_count + 1
          END,
          window_started_at = CASE
            WHEN health.appointment_request_rate_limits.window_started_at < now() - interval '15 minutes' THEN now()
            ELSE health.appointment_request_rate_limits.window_started_at
          END
      WHERE health.appointment_request_rate_limits.window_started_at < now() - interval '15 minutes'
         OR health.appointment_request_rate_limits.request_count < 5
      RETURNING request_count`;

    if (!rate.length) {
      res.setHeader('Retry-After', String(WINDOW_MINUTES * 60));
      return send(res, 429, { ok: false, message: 'وصلت إلى الحد المؤقت للطلبات. يرجى المحاولة لاحقًا.' });
    }

    await sql`INSERT INTO health.appointment_requests
      (full_name, phone, specialty, preferred_date, preferred_time, privacy_consent, status, source)
      VALUES (${fullName}, ${phone}, ${specialty}, ${preferredDate}, ${preferredTime}, true, 'new', 'website')`;

    return send(res, 201, {
      ok: true,
      message: 'تم استلام طلب الاهتمام بنجاح. هذا ليس تأكيدًا لموعد؛ يجب أن يتواصل فريق المركز بعد تفعيل إجراءات الاستقبال والتحقق من توفر الخدمة.'
    });
  } catch (_) {
    // Do not log personal information, request bodies, IP addresses, or database errors.
    return send(res, 503, { ok: false, message: 'تعذر حفظ الطلب الآن. لم يتم تأكيد إرساله؛ يرجى المحاولة لاحقًا.' });
  }
};
