import { getDatabase, sendJson, cleanText, validPhone } from "../../lib/neon-db.js";

const validEmail = (value) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { error: "METHOD_NOT_ALLOWED" });
  }

  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    if (body.consent_given !== true) {
      return sendJson(res, 400, { error: "CONSENT_REQUIRED" });
    }

    const serviceCode = cleanText(body.service_code, 80);
    if (!serviceCode || serviceCode === "student_registration") {
      return sendJson(res, 400, { error: "INVALID_SERVICE" });
    }

    const sql = getDatabase("education");
    const found = await sql`
      SELECT id, service_code, service_name, form_fields, consent_text
      FROM education.service_catalog
      WHERE service_code = ${serviceCode} AND is_active = true
      LIMIT 1
    `;
    if (!found.length) return sendJson(res, 404, { error: "SERVICE_NOT_FOUND" });

    const service = found[0];
    if (!service.consent_text || body.consent_text !== service.consent_text) {
      return sendJson(res, 400, { error: "CONSENT_TEXT_MISMATCH" });
    }

    const configuredFields = Array.isArray(service.form_fields) ? service.form_fields : [];
    const fieldsByKey = new Map();
    for (const field of configuredFields) {
      if (field && typeof field.key === "string" && /^[a-z][a-z0-9_]{0,79}$/.test(field.key)) {
        fieldsByKey.set(field.key, field);
      }
    }

    const allowedKeys = new Set(["applicant_name", "applicant_phone", "applicant_email", ...fieldsByKey.keys()]);
    const payload = {};
    for (const key of allowedKeys) {
      if (!(key in body)) continue;
      const value = body[key];
      const field = fieldsByKey.get(key);
      if (value === null || value === undefined || value === "") continue;

      if (key === "applicant_phone") {
        const v = cleanText(typeof value === "string" ? value : "", 30);
        if (v && !validPhone(v)) return sendJson(res, 400, { error: "INVALID_PHONE" });
        if (v) payload[key] = v;
        continue;
      }
      if (key === "applicant_email") {
        const v = cleanText(typeof value === "string" ? value : "", 254);
        if (!validEmail(v)) return sendJson(res, 400, { error: "INVALID_EMAIL" });
        if (v) payload[key] = v;
        continue;
      }
      if (field?.type === "number") {
        const n = typeof value === "number" ? value : Number(value);
        if (!Number.isFinite(n) || n < 0 || n > 10000000) {
          return sendJson(res, 400, { error: "INVALID_SERVICE_FIELDS" });
        }
        payload[key] = n;
        continue;
      }
      const v = cleanText(typeof value === "string" ? value : "", key === "notes" ? 1000 : 500);
      if (!v) continue;
      if (field?.type === "email" && !validEmail(v)) {
        return sendJson(res, 400, { error: "INVALID_EMAIL" });
      }
      if (field?.type === "tel" && !validPhone(v)) {
        return sendJson(res, 400, { error: "INVALID_PHONE" });
      }
      if (field?.type === "select" && Array.isArray(field.options) &&
          !field.options.some(option => option && option.value === v)) {
        return sendJson(res, 400, { error: "INVALID_SERVICE_FIELDS" });
      }
      payload[key] = v;
    }

    for (const field of configuredFields) {
      if (!field?.required || typeof field.key !== "string") continue;
      const value = payload[field.key];
      if (value === undefined || value === null || value === "") {
        return sendJson(res, 400, { error: "INVALID_SERVICE_FIELDS" });
      }
    }

    const applicantName = cleanText(payload.applicant_name, 120);
    const phone = cleanText(payload.applicant_phone, 30);
    const email = cleanText(payload.applicant_email, 254);
    if (applicantName.length < 2) {
      return sendJson(res, 400, { error: "INVALID_SERVICE_FIELDS" });
    }
    if (!phone && !email) {
      return sendJson(res, 400, { error: "INVALID_CONTACT" });
    }

    // Files remain disabled until a private education-only storage path is available.
    // Ignore every client-supplied attachment path or metadata field.
    const requestNumber = "EDU-SVC-" + Date.now().toString(36).toUpperCase() + "-" +
      crypto.randomUUID().slice(0, 6).toUpperCase();
    const rows = await sql`
      INSERT INTO education.service_requests
        (request_number, applicant_name, phone, applicant_email, service_code,
         payload, status, consent_given, consent_recorded_at, consent_text)
      VALUES
        (${requestNumber}, ${applicantName}, NULLIF(${phone}, ''),
         NULLIF(${email}, ''), ${serviceCode}, ${JSON.stringify(payload)}::jsonb,
         'new', true, now(), ${service.consent_text})
      RETURNING id, request_number, status, created_at
    `;
    return sendJson(res, 201, { ok: true, request: rows[0] });
  } catch (error) {
    const status = error.statusCode || 500;
    return sendJson(res, status, {
      error: status === 503 ? error.message : "SERVICE_REQUEST_FAILED"
    });
  }
}
