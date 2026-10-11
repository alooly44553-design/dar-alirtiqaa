import { getDatabase, sendJson, cleanText } from "../../lib/neon-db.js";
import { resolvePortalIdentity } from "../../lib/education-portal-auth.js";

const UUID = /^[0-9a-f-]{36}$/i;

function methodNotAllowed(req, res, allowed) {
  res.setHeader("Allow", allowed.join(", "));
  return sendJson(res, 405, { error: "METHOD_NOT_ALLOWED" });
}

function requireUuid(value) {
  return typeof value === "string" && UUID.test(value);
}

async function handleTeacher(req, res, identity) {
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
  if ((programId && !requireUuid(programId)) || (subjectId && !requireUuid(subjectId)) ||
      (classroomId && !requireUuid(classroomId))) {
    return sendJson(res, 400, { error: "INVALID_LESSON_REFERENCE" });
  }
  const validInCatalog = (rows, id) => !id || rows.some(row => row.id.toLowerCase() === id.toLowerCase());
  if (!validInCatalog(identity.catalog.programs, programId) ||
      !validInCatalog(identity.catalog.subjects, subjectId) ||
      !validInCatalog(identity.catalog.classrooms, classroomId)) {
    return sendJson(res, 400, { error: "INVALID_LESSON_REFERENCE" });
  }
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
}

async function handleAssignments(req, res, identity) {
  if (!identity.staff) return sendJson(res, 403, { error: "TEACHER_PROFILE_REQUIRED" });
  const body = req.body && typeof req.body === "object" ? req.body : {};
  const lessonId = cleanText(body.lesson_id, 36);
  const title = cleanText(body.title, 200);
  const instructions = cleanText(body.instructions, 6000);
  const dueInput = typeof body.due_at === "string" ? body.due_at.trim() : "";
  const maxScore = body.max_score === undefined || body.max_score === "" ? 100 : Number(body.max_score);
  if (!requireUuid(lessonId) || title.length < 2 ||
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
}

async function handleStudent(req, res, identity) {
  if (!identity.learner || identity.staff) return sendJson(res, 403, { error: "LEARNER_PROFILE_REQUIRED" });
  const programs = new Set(identity.enrollments.map(x => x.program_id).filter(Boolean));
  const classrooms = new Set(identity.enrollments.map(x => x.classroom_id).filter(Boolean));
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
  return sendJson(res, 200, { ok: true, lessons: visibleLessons, assignments: visibleAssignments });
}

async function handleSubmissions(req, res, identity) {
  const sql = getDatabase("education");
  const body = req.body && typeof req.body === "object" ? req.body : {};

  if (req.method === "POST") {
    if (!identity.learner || identity.staff) return sendJson(res, 403, { error: "LEARNER_PROFILE_REQUIRED" });
    const assignmentId = cleanText(body.assignment_id, 36);
    const answerText = cleanText(typeof body.answer_text === "string" ? body.answer_text : "", 20000);
    if (!requireUuid(assignmentId) || answerText.length < 1) {
      return sendJson(res, 400, { error: "INVALID_SUBMISSION_FIELDS" });
    }

    const programs = new Set(identity.enrollments.map(x => x.program_id).filter(Boolean));
    const classrooms = new Set(identity.enrollments.map(x => x.classroom_id).filter(Boolean));
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
  if (!requireUuid(submissionId)) return sendJson(res, 400, { error: "INVALID_SUBMISSION_ID" });
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
}

export default async function handler(req, res) {
  const requestUrl = new URL(req.url || "/", "https://education.local");
  const resource = requestUrl.searchParams.get("resource") || "";
  const methods = {
    profile: ["GET"],
    teacher: ["GET", "POST"],
    assignments: ["POST"],
    student: ["GET"],
    submissions: ["POST", "PATCH"]
  };
  if (!methods[resource]) return sendJson(res, 404, { error: "PORTAL_RESOURCE_NOT_FOUND" });
  if (!methods[resource].includes(req.method)) return methodNotAllowed(req, res, methods[resource]);

  try {
    const identity = await resolvePortalIdentity(req);
    if (!identity) return sendJson(res, 401, { error: "AUTH_REQUIRED" });

    switch (resource) {
      case "profile":
        if (!identity.staff && !identity.learner) return sendJson(res, 403, { error: "SCHOOL_PROFILE_NOT_FOUND" });
        return sendJson(res, 200, {
          ok: true,
          profile: {
            user: identity.user,
            staff: identity.staff,
            learner: identity.learner,
            role: identity.staff ? "teacher" : "student"
          }
        });
      case "teacher":
        return await handleTeacher(req, res, identity);
      case "assignments":
        return await handleAssignments(req, res, identity);
      case "student":
        return await handleStudent(req, res, identity);
      case "submissions":
        return await handleSubmissions(req, res, identity);
      default:
        return sendJson(res, 404, { error: "PORTAL_RESOURCE_NOT_FOUND" });
    }
  } catch {
    const errorCode = resource === "profile" ? "SCHOOL_PROFILE_LOOKUP_FAILED" :
      resource === "teacher" ? "SCHOOL_PORTAL_SERVICE_UNAVAILABLE" :
      resource === "assignments" ? "SCHOOL_ASSIGNMENT_SERVICE_UNAVAILABLE" :
      resource === "student" ? "SCHOOL_STUDENT_SERVICE_UNAVAILABLE" :
      "SCHOOL_SUBMISSION_SERVICE_UNAVAILABLE";
    return sendJson(res, 503, { error: errorCode });
  }
}
