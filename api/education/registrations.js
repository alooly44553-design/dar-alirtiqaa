import { sendJson } from "../../lib/neon-db.js";

export default function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { error: "METHOD_NOT_ALLOWED" });
  }
  // The former unified registration form is retired. Its historical records
  // remain available to authorized administrators through admin-registrations.
  return sendJson(res, 410, { error: "LEGACY_REGISTRATION_DISABLED" });
}
