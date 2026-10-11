import { getDatabase, sendJson, methodNotAllowed, cleanText, validPhone } from "../../lib/neon-db.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return methodNotAllowed(req, res);
  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const fullName = cleanText(body.full_name, 120);
    const phone = cleanText(body.phone, 30);
    const specialty = cleanText(body.specialty, 80);
    const preferredDate = cleanText(body.preferred_date, 10);
    const preferredTime = cleanText(body.preferred_time, 8);
    if (fullName.length < 2 || !validPhone(phone) || specialty.length < 2 ||
        !/^\d{4}-\d{2}-\d{2}$/.test(preferredDate) ||
        !/^\d{2}:\d{2}(:\d{2})?$/.test(preferredTime) ||
        body.privacy_consent !== true) {
      return sendJson(res, 400, { error: "INVALID_APPOINTMENT_FIELDS" });
    }
    const sql = getDatabase("health");
    const rows = await sql`
      INSERT INTO health.appointment_requests
        (full_name, phone, specialty, preferred_date, preferred_time, privacy_consent)
      VALUES
        (${fullName}, ${phone}, ${specialty}, ${preferredDate}::date, ${preferredTime}::time, true)
      RETURNING id, status, created_at
    `;
    return sendJson(res, 201, { ok: true, appointment: rows[0] });
  } catch (error) {
    const status = error.statusCode || 500;
    return sendJson(res, status, { error: status === 503 ? error.message : "APPOINTMENT_REQUEST_FAILED" });
  }
}
