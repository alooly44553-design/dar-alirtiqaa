import { getDatabase, sendJson } from "../../lib/neon-db.js";
import { resolvePortalIdentity } from "../../lib/education-portal-auth.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return sendJson(res, 405, { error: "METHOD_NOT_ALLOWED" });
  }
  try {
    const identity = await resolvePortalIdentity(req);
    if (!identity) return sendJson(res, 401, { error: "AUTH_REQUIRED" });
    if (!identity.learner || identity.staff) return sendJson(res, 403, { error: "LEARNER_PROFILE_REQUIRED" });

    const enrollments = identity.enrollments;
    const programs = new Set(enrollments.map(x => x.program_id).filter(Boolean));
    const classrooms = new Set(enrollments.map(x => x.classroom_id).filter(Boolean));
    const sql = getDatabase("education");
    const [allLessons, allAssignments] = await Promise.all([
      sql`
        SELECT id, title, explanation, objectives, scheduled_for, program_id, classroom_id
        FROM education.school_lessons
        WHERE status = 'published'
        ORDER BY scheduled_for ASC NULLS LAST, created_at DESC
        LIMIT 500
      `,
      sql`
        SELECT id, lesson_id, title, instructions, due_at, max_score
        FROM education.school_assignments
        WHERE status = 'published'
        ORDER BY due_at ASC NULLS LAST, created_at DESC
        LIMIT 1000
      `
    ]);
    const visibleLessons = allLessons.filter(lesson =>
      (!lesson.program_id || programs.has(lesson.program_id)) &&
      (!lesson.classroom_id || classrooms.has(lesson.classroom_id))
    );
    const visibleLessonIds = new Set(visibleLessons.map(x => x.id));
    const visibleAssignments = allAssignments.filter(x => visibleLessonIds.has(x.lesson_id));
    return sendJson(res, 200, {
      ok: true,
      lessons: visibleLessons,
      assignments: visibleAssignments
    });
  } catch {
    return sendJson(res, 503, { error: "SCHOOL_STUDENT_SERVICE_UNAVAILABLE" });
  }
}
