import { getDatabase, sendJson, methodNotAllowed, cleanText, validPhone } from "../../lib/neon-db.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return methodNotAllowed(req, res);
  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    if (body.consent_given !== true) {
      return sendJson(res, 400, { error: "CONSENT_REQUIRED" });
    }
    const studentName = cleanText(body.student_name || body.full_name, 120);
    const gender = body.gender === "male" || body.gender === "female" ? body.gender : null;
    const phone = cleanText(body.phone, 30);
    const guardianPhone = cleanText(body.guardian_phone, 30);
    const email = cleanText(body.email, 254);
    if (studentName.length < 2 || !gender ||
        (phone && !validPhone(phone)) || (guardianPhone && !validPhone(guardianPhone)) ||
        (!phone && !guardianPhone && !email)) {
      return sendJson(res, 400, { error: "INVALID_REGISTRATION_FIELDS" });
    }
    const registrationNumber = "EDU-" + Date.now().toString(36).toUpperCase() + "-" + crypto.randomUUID().slice(0, 6).toUpperCase();
    const sql = getDatabase("education");
    const rows = await sql`
      INSERT INTO education.student_registrations
        (registration_number, student_name, full_name, gender, date_of_birth, nationality,
         identity_type, identity_number, phone, email, guardian_name, guardian_relationship,
         guardian_phone, address, previous_education, requested_program, notes, status, approval_status)
      VALUES
        (${registrationNumber}, ${studentName}, ${studentName}, ${gender},
         NULLIF(${cleanText(body.date_of_birth, 10)}, '')::date,
         NULLIF(${cleanText(body.nationality, 80)}, ''),
         NULLIF(${cleanText(body.identity_type, 80)}, ''),
         NULLIF(${cleanText(body.identity_number, 80)}, ''),
         NULLIF(${phone}, ''), NULLIF(${email}, ''),
         NULLIF(${cleanText(body.guardian_name, 120)}, ''),
         NULLIF(${cleanText(body.guardian_relationship, 80)}, ''),
         NULLIF(${guardianPhone}, ''),
         NULLIF(${cleanText(body.address, 250)}, ''),
         NULLIF(${cleanText(body.previous_education, 200)}, ''),
         NULLIF(${cleanText(body.requested_program, 120)}, ''),
         NULLIF(${cleanText(body.notes, 1000)}, ''),
         'pending', 'pending')
      RETURNING id, registration_number, approval_status, created_at
    `;
    return sendJson(res, 201, { ok: true, registration: rows[0] });
  } catch (error) {
    const status = error.statusCode || 500;
    return sendJson(res, status, { error: status === 503 ? error.message : "REGISTRATION_FAILED" });
  }
}
