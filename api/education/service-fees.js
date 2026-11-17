import { getDatabase, sendJson } from "../../lib/neon-db.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return sendJson(res, 405, { error: "METHOD_NOT_ALLOWED" });
  }
  try {
    const requestUrl = new URL(req.url || "/", "https://education.local");
    const serviceId = requestUrl.searchParams.get("service_id") || "";
    if (!/^[0-9a-f-]{36}$/i.test(serviceId)) {
      return sendJson(res, 400, { error: "INVALID_SERVICE_ID" });
    }
    const sql = getDatabase("education", { app_role: "public_catalog" });
    const found = await sql`SELECT service_code FROM education.service_catalog WHERE id = ${serviceId}::uuid AND is_active = true LIMIT 1`;
    if (!found.length) return sendJson(res, 404, { error: "SERVICE_NOT_FOUND" });
    return sendJson(res, 200, { ok: true, fees: [], pricing_notice: "تُحدد الرسوم والتيسيرات بعد مراجعة الإدارة، ويُبلّغ بها المستفيد قبل تأكيد أي التزام مالي." });
  } catch (error) {
    const status = error.statusCode || 500;
    return sendJson(res, status, { error: status === 503 ? error.message : "SERVICE_FEES_FAILED" });
  }
}
