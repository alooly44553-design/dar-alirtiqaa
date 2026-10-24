'use strict';

const { neon } = require('@neondatabase/serverless');

function sendJson(res, status, payload) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("X-Content-Type-Options", "nosniff");
  return res.status(status).json(payload);
}

/**
 * Non-sensitive deployment diagnostic only.
 * This endpoint verifies that the health-center deployment can reach its
 * dedicated database. It does not authenticate staff or make workflows
 * production-ready.
 */
module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return sendJson(res, 405, { ok: false, code: "METHOD_NOT_ALLOWED" });
  }

  if (process.env.DAR_ALIRTIQAA_APP !== "health") {
    return sendJson(res, 503, {
      ok: false,
      service: "health-centers",
      database: "not_configured",
      code: "APP_DATABASE_SCOPE_MISMATCH"
    });
  }

  if (!process.env.DATABASE_URL) {
    return sendJson(res, 503, {
      ok: false,
      service: "health-centers",
      database: "not_configured",
      code: "DATABASE_NOT_CONFIGURED"
    });
  }

  try {
    const sql = neon(process.env.DATABASE_URL);
    const rows = await sql`SELECT 1::int AS ready`;

    if (rows[0]?.ready !== 1) {
      throw new Error("DATABASE_PING_FAILED");
    }

    return sendJson(res, 200, {
      ok: true,
      service: "health-centers",
      database: "connected",
      operationalReadiness: "not_verified"
    });
  } catch {
    return sendJson(res, 503, {
      ok: false,
      service: "health-centers",
      database: "unavailable",
      code: "HEALTH_DATABASE_UNAVAILABLE"
    });
  }
};
