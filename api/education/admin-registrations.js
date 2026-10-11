import { getDatabase, sendJson } from "../../lib/neon-db.js";

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
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return sendJson(res, 405, { error: "METHOD_NOT_ALLOWED" });
  }
  try {
    if (!await adminUser(req)) return sendJson(res, 401, { error: "ADMIN_AUTH_REQUIRED" });
    const sql = getDatabase("education");
    const registrations = await sql`
      SELECT id, registration_number, student_name, gender, date_of_birth, nationality,
             phone, guardian_name, guardian_phone, approval_status, approved_at,
             approval_note, documented, documented_at, document_reference, created_at
      FROM education.student_registrations
      ORDER BY created_at DESC
      LIMIT 50
    `;
    return sendJson(res, 200, { ok: true, registrations });
  } catch (error) {
    const status = error.statusCode || 500;
    return sendJson(res, status, { error: status === 503 ? error.message : "REGISTRATION_ADMIN_FAILED" });
  }
}
