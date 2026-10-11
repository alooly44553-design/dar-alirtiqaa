import { getDatabase, sendJson } from "../../lib/neon-db.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return sendJson(res, 405, { error: "METHOD_NOT_ALLOWED" });
  }
  try {
    const serviceId = typeof req.query?.service_id === "string" ? req.query.service_id : "";
    if (!/^[0-9a-f-]{36}$/i.test(serviceId)) {
      return sendJson(res, 400, { error: "INVALID_SERVICE_ID" });
    }
    const sql = getDatabase("education");
    const fees = await sql`
      SELECT fee_name, description, amount, currency, is_required
      FROM education.service_fee_items
      WHERE service_id = ${serviceId}::uuid
        AND is_active = true
        AND effective_from <= CURRENT_DATE
        AND (effective_to IS NULL OR effective_to >= CURRENT_DATE)
      ORDER BY display_order ASC, fee_code ASC
    `;
    return sendJson(res, 200, { ok: true, fees });
  } catch (error) {
    const status = error.statusCode || 500;
    return sendJson(res, status, {
      error: status === 503 ? error.message : "SERVICE_FEES_FAILED"
    });
  }
}
