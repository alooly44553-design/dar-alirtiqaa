import { getDatabase, sendJson, cleanText } from "../../lib/neon-db.js";
import { resolvePortalIdentity } from "../../lib/education-portal-auth.js";

const UUID = /^[0-9a-f-]{36}$/i;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { error: "METHOD_NOT_ALLOWED" });
  }
  try {
    const identity = await resolvePortalIdentity(req);
    if (!identity) return sendJson(res, 401, { error: "AUTH_REQUIRED" });
    if (!identity.staff) return sendJson(res, 403, { error: "TEACHER_PROFILE_REQUIRED" });

    const body = req.body && typeof req.body === "object" ? req.body : {};
    const lessonId = cleanText(body.lesson_id, 36);
    const title = cleanText(body.title, 200);
    const instructions = cleanText(body.instructions, 6000);
    const dueInput = typeof body.due_at === "string" ? body.due_at.trim() : "";
    const maxScore = body.max_score === undefined || body.max_score === "" ? 100 : Number(body.max_score);
    if (!UUID.test(lessonId) || title.length < 2 ||
        !Number.isFinite(maxScore) || maxScore <= 0 || maxScore > 10000) {
      return sendJson(res, 400, { error: "INVALID_ASSIGNMENT_FIELDS" });
    }
    let dueAt = null;
    if (dueInput) {
      const parsed = new Date(dueInput);
      if (!Number.isFinite(parsed.getTime())) return sendJson(res, 400, { error: "INVALID_ASSIGNMENT_DUE_DATE" });
      dueAt = parsed.toISOString();
    }

    const sql = getDatabase("education");
    const lessons = await sql`
      SELECT id, classroom_id, subject_id, status
      FROM education.school_lessons
      WHERE id = ${lessonId}::uuid
        AND teacher_id = ${identity.staff.id}::uuid
      LIMIT 1
    `;
    if (!lessons.length) return sendJson(res, 404, { error: "LESSON_NOT_FOUND" });
    if (lessons[0].status === "archived") return sendJson(res, 400, { error: "LESSON_ARCHIVED" });

    const lesson = lessons[0];
    const saved = await sql`
      INSERT INTO education.school_assignments
        (lesson_id, classroom_id, subject_id, title, instructions,
         due_at, max_score, status, created_by)
      VALUES
        (${lesson.id}::uuid, ${lesson.classroom_id}::uuid, ${lesson.subject_id}::uuid,
         ${title}, NULLIF(${instructions}, ''), ${dueAt}::timestamptz,
         ${maxScore}, 'published', ${identity.staff.id}::uuid)
      RETURNING id, title, status, due_at, max_score, created_at
    `;
    return sendJson(res, 201, { ok: true, assignment: saved[0] });
  } catch {
    return sendJson(res, 503, { error: "SCHOOL_ASSIGNMENT_SERVICE_UNAVAILABLE" });
  }
}
