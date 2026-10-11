import { getDatabase, sendJson, cleanText } from "../../lib/neon-db.js";
import { resolvePortalIdentity } from "../../lib/education-portal-auth.js";

const UUID = /^[0-9a-f-]{36}$/i;

function activeReference(catalogRows, id) {
  if (!id) return true;
  if (!UUID.test(id)) return false;
  return catalogRows.some(row => row.id.toLowerCase() === id.toLowerCase());
}

export default async function handler(req, res) {
  if (!["GET", "POST"].includes(req.method)) {
    res.setHeader("Allow", "GET, POST");
    return sendJson(res, 405, { error: "METHOD_NOT_ALLOWED" });
  }
  try {
    const identity = await resolvePortalIdentity(req);
    if (!identity) return sendJson(res, 401, { error: "AUTH_REQUIRED" });
    if (!identity.staff) return sendJson(res, 403, { error: "TEACHER_PROFILE_REQUIRED" });
    const sql = getDatabase("education");

    if (req.method === "GET") {
      const [lessons, submissions] = await Promise.all([
        sql`
          SELECT id, title, status, created_at
          FROM education.school_lessons
          WHERE teacher_id = ${identity.staff.id}::uuid
          ORDER BY created_at DESC
          LIMIT 100
        `,
        sql`
          SELECT s.id, s.learner_id, s.assignment_id, s.status, s.score,
                 s.feedback, s.submitted_at, s.learner_name,
                 a.title AS assignment_title, a.lesson_id
          FROM education.school_submissions s
          JOIN education.school_assignments a ON a.id = s.assignment_id
          JOIN education.school_lessons l ON l.id = a.lesson_id
          WHERE l.teacher_id = ${identity.staff.id}::uuid
          ORDER BY s.submitted_at DESC NULLS LAST, s.created_at DESC
          LIMIT 100
        `
      ]);
      return sendJson(res, 200, {
        ok: true,
        programs: identity.catalog.programs,
        subjects: identity.catalog.subjects,
        classrooms: identity.catalog.classrooms,
        lessons,
        submissions: submissions.map(x => ({
          ...x,
          learners: { full_name: x.learner_name || "طالب" },
          school_assignments: { title: x.assignment_title, lesson_id: x.lesson_id }
        }))
      });
    }

    const body = req.body && typeof req.body === "object" ? req.body : {};
    const title = cleanText(body.title, 200);
    const explanation = cleanText(body.explanation, 6000);
    const objectives = cleanText(body.objectives, 1500);
    const status = body.status === "published" ? "published" : body.status === "draft" ? "draft" : "";
    const programId = body.program_id ? cleanText(body.program_id, 36) : null;
    const subjectId = body.subject_id ? cleanText(body.subject_id, 36) : null;
    const classroomId = body.classroom_id ? cleanText(body.classroom_id, 36) : null;
    if (title.length < 2 || !status) return sendJson(res, 400, { error: "INVALID_LESSON_FIELDS" });
    if ((programId && !UUID.test(programId)) || (subjectId && !UUID.test(subjectId)) ||
        (classroomId && !UUID.test(classroomId))) {
      return sendJson(res, 400, { error: "INVALID_LESSON_REFERENCE" });
    }
    const refs = await Promise.all([
      activeReference(identity.catalog.programs, programId),
      activeReference(identity.catalog.subjects, subjectId),
      activeReference(identity.catalog.classrooms, classroomId)
    ]);
    if (refs.some(x => !x)) return sendJson(res, 400, { error: "INVALID_LESSON_REFERENCE" });

    const saved = await sql`
      INSERT INTO education.school_lessons
        (program_id, subject_id, teacher_id, classroom_id, title,
         explanation, objectives, status, created_by)
      VALUES
        (${programId}::uuid, ${subjectId}::uuid, ${identity.staff.id}::uuid,
         ${classroomId}::uuid, ${title}, NULLIF(${explanation}, ''),
         NULLIF(${objectives}, ''), ${status}, ${identity.staff.id}::uuid)
      RETURNING id, title, status, created_at
    `;
    return sendJson(res, 201, { ok: true, lesson: saved[0] });
  } catch {
    return sendJson(res, 503, { error: "SCHOOL_PORTAL_SERVICE_UNAVAILABLE" });
  }
}
