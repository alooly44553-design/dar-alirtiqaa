import { neon } from "@neondatabase/serverless";

export function getDatabase(expectedApp, requestClaims = {}) {
  if (process.env.DAR_ALIRTIQAA_APP !== expectedApp) {
    const error = new Error("APP_DATABASE_SCOPE_MISMATCH");
    error.statusCode = 503;
    throw error;
  }
  if (!process.env.DATABASE_URL) {
    const error = new Error("DATABASE_NOT_CONFIGURED");
    error.statusCode = 503;
    throw error;
  }
  const client = neon(process.env.DATABASE_URL);
  // Neon HTTP queries are stateless between requests. Keep verified application
  // claims in the same transaction as each query so PostgreSQL RLS evaluates
  // the authenticated scope rather than an empty/default session.
  if (expectedApp !== "education") return client;
  const claims = requestClaims && typeof requestClaims === "object" ? requestClaims : {};
  const claimsJson = JSON.stringify(claims);
  const scopedQuery = async (strings, ...values) => {
    const query = client(strings, ...values);
    const result = await client.transaction([
      client`SELECT set_config('request.jwt.claims', ${claimsJson}, true)`,
      query
    ]);
    return result[1];
  };
  return scopedQuery;
}

export function sendJson(res, status, payload) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.status(status).json(payload);
}

export function methodNotAllowed(req, res) {
  res.setHeader("Allow", "POST");
  return sendJson(res, 405, { error: "METHOD_NOT_ALLOWED" });
}

export function cleanText(value, max = 200) {
  if (typeof value !== "string") return "";
  return value.trim().replace(/[<>]/g, "").slice(0, max);
}

export function validPhone(value) {
  return typeof value === "string" && /^[+0-9 ()-]{7,30}$/.test(value.trim());
}
