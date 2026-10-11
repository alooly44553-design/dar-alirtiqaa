import { getDatabase, sendJson } from "../../lib/neon-db.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return sendJson(res, 405, { error: "METHOD_NOT_ALLOWED" });
  }
  try {
    const sql = getDatabase("education");
    const services = await sql`
      SELECT id, service_code, service_name, service_category, description,
             registration_method, registration_method_label, form_fields,
             consent_text, requires_management_review, is_active, display_order
      FROM education.service_catalog
      WHERE is_active = true
      ORDER BY display_order ASC, service_name ASC
    `;
    return sendJson(res, 200, { ok: true, services });
  } catch (error) {
    const status = error.statusCode || 500;
    return sendJson(res, status, {
      error: status === 503 ? error.message : "SERVICE_CATALOG_FAILED"
    });
  }
}
