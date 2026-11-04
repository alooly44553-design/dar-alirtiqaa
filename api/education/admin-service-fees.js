import { getDatabase, sendJson } from "../../lib/neon-db.js";

async function adminUser(req) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token || !process.env.SUPABASE_URL || !process.env.SUPABASE_PUBLISHABLE_KEY) return null;
  const headers = {
    apikey: process.env.SUPABASE_PUBLISHABLE_KEY,
    Authorization: "Bearer " + token,
    "Content-Type": "application/json"
  };
  try {
    // Validate the bearer token and the administrative role concurrently.
    // Sequential Supabase round-trips could exhaust Vercel's 10-second runtime.
    const [userRes, roleRes] = await Promise.all([
      fetch(process.env.SUPABASE_URL + "/auth/v1/user", { headers }),
      fetch(process.env.SUPABASE_URL + "/rest/v1/rpc/is_center_management_admin", {
        method: "POST", headers, body: "{}"
      })
    ]);
    if (!userRes.ok || !roleRes.ok) return null;
    const [user, isAdmin] = await Promise.all([userRes.json(), roleRes.json()]);
    if (isAdmin !== true) return null;
    return user;
  } catch (error) {
    console.error("ADMIN_AUTH_CHECK_FAILED", error?.name || "unknown");
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return sendJson(res, 405, { error: "METHOD_NOT_ALLOWED" });
  }
  try {
    const user = await adminUser(req);
    if (!user) return sendJson(res, 401, { error: "ADMIN_AUTH_REQUIRED" });

    const sql = getDatabase("education");
    const [services, fees] = await Promise.all([
      sql`
        SELECT id, service_code, service_name, registration_method_label, display_order
        FROM education.service_catalog
        WHERE is_active = true
        ORDER BY display_order ASC, service_name ASC
      `,
      sql`
        SELECT id, service_id, fee_code, fee_name, description, amount, currency,
               calculation_method, is_required, payment_stage, is_active, display_order, condition_rule
        FROM education.service_fee_items
        WHERE is_active = true
          AND service_id IN (
            SELECT id FROM education.service_catalog WHERE is_active = true
          )
        ORDER BY display_order ASC, fee_code ASC
      `
    ]);
    return sendJson(res, 200, { ok: true, services, fees });
  } catch (error) {
    const status = error.statusCode || 500;
    return sendJson(res, status, {
      error: status === 503 ? error.message : "SERVICE_FEES_ADMIN_FAILED"
    });
  }
}
