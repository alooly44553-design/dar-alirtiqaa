import { getDatabase, sendJson } from "../../lib/neon-db.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return sendJson(res, 405, { error: "METHOD_NOT_ALLOWED" });
  }
  try {
    const sql = getDatabase("education");
    await sql`SELECT 1 AS ok`;
    return sendJson(res, 200, { ok: true, service: "education-api", database: "connected" });
  } catch (error) {
    const status = error.statusCode || 503;
    return sendJson(res, status, { ok: false, error: status === 503 ? error.message : "DATABASE_CHECK_FAILED" });
  }
}
