import { getDatabase, sendJson, cleanText, validPhone } from "../../lib/neon-db.js";

async function adminUser(req) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token || !process.env.SUPABASE_URL || !process.env.SUPABASE_PUBLISHABLE_KEY) return null;
  const headers = { apikey: process.env.SUPABASE_PUBLISHABLE_KEY, Authorization: "Bearer " + token, "Content-Type": "application/json" };
  const userRes = await fetch(process.env.SUPABASE_URL + "/auth/v1/user", { headers });
  if (!userRes.ok) return null;
  const user = await userRes.json();
  const roleRes = await fetch(process.env.SUPABASE_URL + "/rest/v1/rpc/is_center_management_admin", { method: "POST", headers, body: "{}" });
  if (!roleRes.ok || await roleRes.json() !== true) return null;
  return user;
}

export default async function handler(req, res) {
  if (!["GET", "POST", "PATCH"].includes(req.method)) {
    res.setHeader("Allow", "GET, POST, PATCH");
    return sendJson(res, 405, { error: "METHOD_NOT_ALLOWED" });
  }
  try {
    const user = await adminUser(req);
    if (!user) return sendJson(res, 401, { error: "ADMIN_AUTH_REQUIRED" });
    const sql = getDatabase("education");

    if (req.method === "GET") {
      const registrations = await sql`
        SELECT id, registration_number, student_name, gender, date_of_birth, nationality,
               phone, guardian_name, guardian_phone, approval_status, approved_at,
               approval_note, documented, documented_at, document_reference, created_at
        FROM education.student_registrations
        ORDER BY created_at DESC
        LIMIT 50
      `;
      return sendJson(res, 200, { ok: true, registrations });
    }

    const body = req.body && typeof req.body === "object" ? req.body : {};
    if (req.method === "POST") {
      const name = cleanText(body.student_name, 120);
      const gender = body.gender === "male" || body.gender === "female" ? body.gender : null;
      const phone = cleanText(body.phone, 30);
      const guardianPhone = cleanText(body.guardian_phone, 30);
      const email = cleanText(body.email, 254);
      if (name.length < 2 || !gender || (phone && !validPhone(phone)) ||
          (guardianPhone && !validPhone(guardianPhone)) || (!phone && !guardianPhone && !email)) {
        return sendJson(res, 400, { error: "INVALID_REGISTRATION_FIELDS" });
      }
      const number = "EDU-" + Date.now().toString(36).toUpperCase() + "-" + crypto.randomUUID().slice(0, 6).toUpperCase();
      const saved = await sql`
        INSERT INTO education.student_registrations
          (registration_number, student_name, full_name, gender, date_of_birth, nationality,
           phone, email, guardian_name, guardian_phone, notes, status, approval_status)
        VALUES
          (${number}, ${name}, ${name}, ${gender},
           NULLIF(${cleanText(body.date_of_birth, 10)}, '')::date,
           NULLIF(${cleanText(body.nationality, 80)}, ''),
           NULLIF(${phone}, ''), NULLIF(${email}, ''),
           NULLIF(${cleanText(body.guardian_name, 120)}, ''),
           NULLIF(${guardianPhone}, ''),
           NULLIF(${cleanText(body.notes, 1000)}, ''),
           'pending', 'pending')
        RETURNING id, registration_number, approval_status, created_at
      `;
      return sendJson(res, 201, { ok: true, registration: saved[0] });
    }

    const id = cleanText(body.id, 64);
    const action = cleanText(body.action, 20);
    if (!/^[0-9a-f-]{36}$/i.test(id)) return sendJson(res, 400, { error: "INVALID_REGISTRATION_ID" });
    let changed;
    if (action === "approve") {
      changed = await sql`UPDATE education.student_registrations SET approval_status='approved', status='approved', approved_at=now(), approved_by=${user.id}::uuid WHERE id=${id}::uuid RETURNING id, approval_status`;
    } else if (action === "reject") {
      changed = await sql`UPDATE education.student_registrations SET approval_status='rejected', status='rejected', approved_at=NULL, approved_by=${user.id}::uuid WHERE id=${id}::uuid RETURNING id, approval_status`;
    } else if (action === "document") {
      changed = await sql`UPDATE education.student_registrations SET documented=true, documented_at=now(), documented_by=${user.id}::uuid, document_reference=NULLIF(${cleanText(body.document_reference, 200)}, '') WHERE id=${id}::uuid RETURNING id, documented, documented_at, document_reference`;
    } else {
      return sendJson(res, 400, { error: "INVALID_ACTION" });
    }
    if (!changed.length) return sendJson(res, 404, { error: "REGISTRATION_NOT_FOUND" });
    return sendJson(res, 200, { ok: true, registration: changed[0] });
  } catch (error) {
    const status = error.statusCode || 500;
    return sendJson(res, status, { error: status === 503 ? error.message : "REGISTRATION_ADMIN_FAILED" });
  }
}
