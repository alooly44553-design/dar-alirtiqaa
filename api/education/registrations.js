import { getDatabase, sendJson, methodNotAllowed, cleanText, validPhone } from "../../lib/neon-db.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return methodNotAllowed(req, res);
  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const fullName = cleanText(body.full_name, 120);
    const guardianName = cleanText(body.guardian_name, 120);
    const phone = cleanText(body.phone, 30);
    const email = cleanText(body.email, 254);
    const requestedProgram = cleanText(body.requested_program, 120);
    if (fullName.length < 2 || !validPhone(phone)) {
      return sendJson(res, 400, { error: "INVALID_REGISTRATION_FIELDS" });
    }
    const sql = getDatabase("education");
    const rows = await sql`
      INSERT INTO education.student_registrations
        (full_name, guardian_name, phone, email, requested_program)
      VALUES
        (${fullName}, ${guardianName || null}, ${phone}, ${email || null}, ${requestedProgram || null})
      RETURNING id, status, created_at
    `;
    return sendJson(res, 201, { ok: true, registration: rows[0] });
  } catch (error) {
    const status = error.statusCode || 500;
    return sendJson(res, status, { error: status === 503 ? error.message : "REGISTRATION_FAILED" });
  }
}
