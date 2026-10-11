import { sendJson } from "../../lib/neon-db.js";
import { resolvePortalIdentity } from "../../lib/education-portal-auth.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return sendJson(res, 405, { error: "METHOD_NOT_ALLOWED" });
  }
  try {
    const identity = await resolvePortalIdentity(req);
    if (!identity) return sendJson(res, 401, { error: "AUTH_REQUIRED" });
    if (!identity.staff && !identity.learner) {
      return sendJson(res, 403, { error: "SCHOOL_PROFILE_NOT_FOUND" });
    }
    return sendJson(res, 200, {
      ok: true,
      profile: {
        user: identity.user,
        staff: identity.staff,
        learner: identity.learner,
        role: identity.staff ? "teacher" : "student"
      }
    });
  } catch {
    return sendJson(res, 503, { error: "SCHOOL_PROFILE_LOOKUP_FAILED" });
  }
}
