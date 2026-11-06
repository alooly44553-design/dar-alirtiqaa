import assert from "node:assert/strict";
import { resolvePortalIdentity } from "../lib/education-portal-auth.js";
import adminRegistrations from "../api/education/admin-registrations.js";

const IDS = {
  teacher: "11111111-1111-4111-8111-111111111111",
  student: "22222222-2222-4222-8222-222222222222",
  guardian: "33333333-3333-4333-8333-333333333333",
  child: "44444444-4444-4444-8444-444444444444",
  otherChild: "55555555-5555-4555-8555-555555555555",
  program: "66666666-6666-4666-8666-666666666666",
  classroom: "77777777-7777-4777-8777-777777777777"
};

const originalFetch = globalThis.fetch;
const originalEnv = {
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY: process.env.SUPABASE_PUBLISHABLE_KEY,
  DAR_ALIRTIQAA_APP: process.env.DAR_ALIRTIQAA_APP,
  DATABASE_URL: process.env.DATABASE_URL
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

async function identityFor(role) {
  const userId = IDS[role];
  const enrollmentQueries = [];
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    if (url.pathname === "/auth/v1/user") return json({ id: userId, email: role + "@example.test" });
    const table = url.pathname.split("/").pop();
    const select = url.searchParams.get("select") || "";
    if (table === "staff") return json(role === "teacher" ? [{
      id: IDS.teacher, full_name: "اختبار معلم", job_title: "معلم",
      auth_user_id: userId, is_active: true, center_id: null
    }] : []);
    if (table === "learners") {
      if (url.searchParams.has("auth_user_id")) return json(role === "student" ? [{
        id: IDS.student, full_name: "اختبار طالب", auth_user_id: userId,
        is_active: true, center_id: null
      }] : []);
      if (url.searchParams.has("guardian_user_id")) return json([]);
      if (url.searchParams.has("id")) return json([{
        id: IDS.child, full_name: "طفل مرتبط", auth_user_id: null,
        guardian_user_id: userId, is_active: true, center_id: null
      }]);
    }
    if (table === "edu_guardians") return json(role === "guardian" ? [{
      id: IDS.guardian, full_name: "ولي أمر اختباري", auth_user_id: userId, is_active: true
    }] : []);
    if (table === "edu_guardian_learners") return json(role === "guardian" ? [{
      learner_id: IDS.child, relationship: "ولي أمر", is_primary: true
    }] : []);
    if (table === "enrollments") {
      enrollmentQueries.push(url.searchParams.get("learner_id"));
      const filter = url.searchParams.get("learner_id") || "";
      const allowed = filter.startsWith("in.(")
        ? filter.slice(4, -1).split(",")
        : [];
      const rows = [
        { learner_id: IDS.student, program_id: IDS.program, classroom_id: IDS.classroom, status: "active" },
        { learner_id: IDS.child, program_id: IDS.program, classroom_id: IDS.classroom, status: "active" },
        { learner_id: IDS.otherChild, program_id: IDS.program, classroom_id: IDS.classroom, status: "active" }
      ];
      return json(rows.filter(row => allowed.includes(row.learner_id)));
    }
    if (["programs", "subjects", "classrooms"].includes(table)) return json([]);
    throw new Error("Unexpected mocked Supabase request: " + url.pathname + "?" + url.search);
  };
  const identity = await resolvePortalIdentity({
    headers: { authorization: "Bearer synthetic-" + role }
  });
  return { identity, enrollmentQueries };
}

try {
  process.env.SUPABASE_URL = "https://synthetic.supabase.test";
  process.env.SUPABASE_PUBLISHABLE_KEY = "synthetic-publishable-key";

  const noToken = await resolvePortalIdentity({ headers: {} });
  assert.equal(noToken, null, "Unauthenticated requests must not resolve an identity.");

  const teacher = await identityFor("teacher");
  assert.equal(teacher.identity.staff.id, IDS.teacher);
  assert.deepEqual(teacher.identity.enrollments, []);
  assert.equal(teacher.enrollmentQueries.length, 0, "Teacher identity must not load the school-wide enrollment list.");

  const student = await identityFor("student");
  assert.equal(student.identity.learner.id, IDS.student);
  assert.deepEqual(student.identity.enrollments.map(row => row.learner_id), [IDS.student]);
  assert.equal(student.enrollmentQueries[0], "in.(" + IDS.student + ")");

  const guardian = await identityFor("guardian");
  assert.equal(guardian.identity.guardian.id, IDS.guardian);
  assert.deepEqual(guardian.identity.guardianLearners.map(row => row.id), [IDS.child]);
  assert.deepEqual(guardian.identity.enrollments.map(row => row.learner_id), [IDS.child]);
  assert.equal(guardian.enrollmentQueries[0], "in.(" + IDS.child + ")");

  process.env.DAR_ALIRTIQAA_APP = "education";
  process.env.DATABASE_URL = "postgres://synthetic:synthetic@127.0.0.1:5432/synthetic";
  const adminHandler = async (isAdmin) => {
    globalThis.fetch = async (input) => {
      const url = new URL(String(input));
      if (url.pathname === "/auth/v1/user") return json({ id: IDS.teacher, email: "admin@example.test" });
      if (url.pathname === "/rest/v1/rpc/is_center_management_admin") return json(isAdmin);
      throw new Error("Unexpected admin auth request: " + url.pathname);
    };
    let status = 0, payload = null;
    const res = {
      setHeader() {},
      status(value) { status = value; return this; },
      json(value) { payload = value; return this; }
    };
    await adminRegistrations({
      method: "POST",
      headers: { authorization: "Bearer synthetic-admin" },
      body: {}
    }, res);
    return { status, payload };
  };

  const deniedAdmin = await adminHandler(false);
  assert.equal(deniedAdmin.status, 401, "Non-admin staff must not pass the admin gate.");
  assert.equal(deniedAdmin.payload.error, "ADMIN_AUTH_REQUIRED");

  const allowedAdmin = await adminHandler(true);
  assert.equal(allowedAdmin.status, 400, "Authorized admin reaches input validation without writing any database row.");
  assert.equal(allowedAdmin.payload.error, "INVALID_CURRICULUM_TRACK");

  console.log("Education role isolation tests passed: unauthenticated, teacher, student, guardian, administrator.");
} finally {
  globalThis.fetch = originalFetch;
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}
