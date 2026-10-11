import { getDatabase, sendJson, cleanText } from "../../lib/neon-db.js";
import { resolvePortalIdentity } from "../../lib/education-portal-auth.js";

const UUID = /^[0-9a-f-]{36}$/i;

export default async function handler(req, res) {
  if (!["POST", "PATCH"].includes(req.method)) {
    res.setHeader("Allow", "POST, PATCH");
    return sendJson(res, 405, { error: "METHOD_NOT_ALLOWED" });
  }
  try {
    const identity = await resolvePortalIdentity(req);
    if (!identity) return sendJson(res, 401, { error: "AUTH_REQUIRED" });
    const sql = getDatabase("education");
    const body = req.body && typeof req.body === "object" ? req.body : {};

    if (req.method === "POST") {
      if (!identity.learner) return sendJson(res, 403, { error: "LEARNER_PROFILE_REQUIRED" });
      const assignmentId = cleanText(body.assignment_id, 36);
      const answerText = cleanText(typeof body.answer_text === "string" ? body.answer_text : "", 20000);
      if (!UUID.test(assignmentId) || answerText.length < 1) {
        return sendJson(res, 400, { error: "INVALID_SUBMISSION_FIELDS" });
      }

      const enrollments = identity.enrollments;
      const programs = new Set(enrollments.map(x => x.program_id).filter(Boolean));
      const classrooms = new Set(enrollments.map(x => x.classroom_id).filter(Boolean));

      const records = await sql`
        SELECT a.id, a.status AS assignment_status, l.status AS lesson_status,
               l.program_id, l.classroom_id
        FROM education.school_assignments a
        JOIN education.school_lessons l ON l.id = a.lesson_id
        WHERE a.id = ${assignmentId}::uuid
        LIMIT 1
      `;
      if (!records.length) return sendJson(res, 404, { error: "ASSIGNMENT_NOT_FOUND" });
      const record = records[0];
      if (record.assignment_status !== "published" || record.lesson_status !== "published") {
        return sendJson(res, 400, { error: "ASSIGNMENT_NOT_AVAILABLE" });
      }
      if ((record.program_id && !programs.has(record.program_id)) ||
          (record.classroom_id && !classrooms.has(record.classroom_id))) {
        return sendJson(res, 403, { error: "ASSIGNMENT_NOT_ASSIGNED_TO_LEARNER" });
      }

      const saved = await sql`
        INSERT INTO education.school_submissions
          (assignment_id, learner_id, learner_name, answer_text, attachments, submitted_at, status)
        VALUES
          (${assignmentId}::uuid, ${identity.learner.id}::uuid,
           ${cleanText(identity.learner.full_name, 160)}, ${answerText},
           '[]'::jsonb, now(), 'submitted')
        ON CONFLICT (assignment_id, learner_id) DO UPDATE
          SET learner_name = EXCLUDED.learner_name,
              answer_text = EXCLUDED.answer_text,
              attachments = '[]'::jsonb,
              submitted_at = now(),
              status = 'submitted',
              updated_at = now()
        RETURNING id, status, submitted_at
      `;
      return sendJson(res, 201, { ok: true, submission: saved[0] });
    }

    if (!identity.staff) return sendJson(res, 403, { error: "TEACHER_PROFILE_REQUIRED" });
    const submissionId = cleanText(body.id, 36);
    const feedback = cleanText(typeof body.feedback === "string" ? body.feedback : "", 4000);
    if (!UUID.test(submissionId)) return sendJson(res, 400, { error: "INVALID_SUBMISSION_ID" });

    let score = null;
    if (body.score !== null && body.score !== undefined && body.score !== "") {
      score = Number(body.score);
      if (!Number.isFinite(score) || score < 0 || score > 10000) {
        return sendJson(res, 400, { error: "INVALID_SCORE" });
      }
    }

    const owned = await sql`
      SELECT s.id, a.max_score
      FROM education.school_submissions s
      JOIN education.school_assignments a ON a.id = s.assignment_id
      JOIN education.school_lessons l ON l.id = a.lesson_id
      WHERE s.id = ${submissionId}::uuid
        AND l.teacher_id = ${identity.staff.id}::uuid
      LIMIT 1
    `;
    if (!owned.length) return sendJson(res, 404, { error: "SUBMISSION_NOT_FOUND" });
    if (score !== null && score > Number(owned[0].max_score)) {
      return sendJson(res, 400, { error: "SCORE_EXCEEDS_MAXIMUM" });
    }
    const changed = await sql`
      UPDATE education.school_submissions
      SET score = ${score}::numeric,
          feedback = NULLIF(${feedback}, ''),
          status = 'reviewed',
          reviewed_by = ${identity.staff.id}::uuid,
          reviewed_at = now(),
          updated_at = now()
      WHERE id = ${submissionId}::uuid
      RETURNING id, status, score, feedback, reviewed_at
    `;
    return sendJson(res, 200, { ok: true, submission: changed[0] });
  } catch {
    return sendJson(res, 503, { error: "SCHOOL_SUBMISSION_SERVICE_UNAVAILABLE" });
  }
}
