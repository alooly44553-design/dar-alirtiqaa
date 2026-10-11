import { getDatabase, sendJson, cleanText } from "../../lib/neon-db.js";

async function adminUser(req) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token || !process.env.SUPABASE_URL || !process.env.SUPABASE_PUBLISHABLE_KEY) return null;
  const headers = {
    apikey: process.env.SUPABASE_PUBLISHABLE_KEY,
    Authorization: "Bearer " + token,
    "Content-Type": "application/json"
  };
  const userRes = await fetch(process.env.SUPABASE_URL + "/auth/v1/user", { headers });
  if (!userRes.ok) return null;
  const user = await userRes.json();
  const roleRes = await fetch(process.env.SUPABASE_URL + "/rest/v1/rpc/is_center_management_admin", {
    method: "POST", headers, body: "{}"
  });
  if (!roleRes.ok || await roleRes.json() !== true) return null;
  return user;
}

export default async function handler(req, res) {
  if (!["GET", "PATCH"].includes(req.method)) {
    res.setHeader("Allow", "GET, PATCH");
    return sendJson(res, 405, { error: "METHOD_NOT_ALLOWED" });
  }
  try {
    const user = await adminUser(req);
    if (!user) return sendJson(res, 401, { error: "ADMIN_AUTH_REQUIRED" });

    const sql = getDatabase("education");
    if (req.method === "GET") {
      const [services, fees] = await Promise.all([
        sql`
          SELECT id, service_code, service_name, registration_method_label, display_order
          FROM education.service_catalog
          WHERE is_active = true
          ORDER BY display_order ASC, service_name ASC
        `,
        sql`
          SELECT id, service_id, fee_code, fee_name, description, amount, currency,
                 calculation_method, is_required, payment_stage, is_active, display_order
          FROM education.service_fee_items
          WHERE service_id IN (
            SELECT id FROM education.service_catalog WHERE is_active = true
          )
          ORDER BY display_order ASC, fee_code ASC
        `
      ]);
      return sendJson(res, 200, { ok: true, services, fees });
    }

    const body = req.body && typeof req.body === "object" ? req.body : {};
    const id = cleanText(body.id, 64);
    if (!/^[0-9a-f-]{36}$/i.test(id)) {
      return sendJson(res, 400, { error: "INVALID_FEE_ID" });
    }
    const amount = body.amount === null || body.amount === "" ? null : Number(body.amount);
    if (amount !== null && (!Number.isFinite(amount) || amount < 0 || amount > 1000000000)) {
      return sendJson(res, 400, { error: "INVALID_FEE_AMOUNT" });
    }
    const currency = cleanText(typeof body.currency === "string" ? body.currency : "", 10).toUpperCase() || "SAR";
    if (!/^[A-Z]{3,10}$/.test(currency)) {
      return sendJson(res, 400, { error: "INVALID_FEE_CURRENCY" });
    }
    if (typeof body.is_required !== "boolean") {
      return sendJson(res, 400, { error: "INVALID_FEE_REQUIREMENT" });
    }
    const changed = await sql`
      UPDATE education.service_fee_items
      SET amount = ${amount}, currency = ${currency},
          is_required = ${body.is_required}, updated_at = now()
      WHERE id = ${id}::uuid
      RETURNING id, amount, currency, is_required, updated_at
    `;
    if (!changed.length) return sendJson(res, 404, { error: "FEE_NOT_FOUND" });
    return sendJson(res, 200, { ok: true, fee: changed[0] });
  } catch (error) {
    const status = error.statusCode || 500;
    return sendJson(res, status, {
      error: status === 503 ? error.message : "SERVICE_FEES_ADMIN_FAILED"
    });
  }
}
