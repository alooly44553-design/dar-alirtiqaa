import { getDatabase, sendJson, methodNotAllowed, cleanText, validPhone } from "../../lib/neon-db.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return methodNotAllowed(req, res);
  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const applicantName = cleanText(body.applicant_name, 120);
    const phone = cleanText(body.phone, 30);
    const email = cleanText(body.email, 254);
    const serviceCode = cleanText(body.service_code, 80);
    const payload = body.payload && typeof body.payload === "object" && !Array.isArray(body.payload) ? body.payload : {};
    if (applicantName.length < 2 || !serviceCode || (phone && !validPhone(phone))) {
      return sendJson(res, 400, { error: "INVALID_SERVICE_REQUEST_FIELDS" });
    }
    const requestNumber = "PS-" + Date.now().toString(36).toUpperCase() + "-" + crypto.randomUUID().slice(0, 8).toUpperCase();
    const sql = getDatabase("public-services");
    const rows = await sql`
      INSERT INTO public_services.service_requests
        (request_number, applicant_name, phone, email, service_code, payload)
      VALUES
        (${requestNumber}, ${applicantName}, ${phone || null}, ${email || null}, ${serviceCode}, ${JSON.stringify(payload)}::jsonb)
      RETURNING id, request_number, status, created_at
    `;
    return sendJson(res, 201, { ok: true, request: rows[0] });
  } catch (error) {
    const status = error.statusCode || 500;
    return sendJson(res, status, { error: status === 503 ? error.message : "SERVICE_REQUEST_FAILED" });
  }
}
