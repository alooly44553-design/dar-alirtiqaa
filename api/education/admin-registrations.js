import { getDatabase, sendJson, cleanText, validPhone } from "../../lib/neon-db.js";

async function adminUser(req) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token || !process.env.SUPABASE_URL || !process.env.SUPABASE_PUBLISHABLE_KEY) return null;
  const headers = { apikey: process.env.SUPABASE_PUBLISHABLE_KEY, Authorization: "Bearer " + token, "Content-Type": "application/json" };
  const userRes = await fetch(process.env.SUPABASE_URL + "/auth/v1/user", { headers });
  if (!userRes.ok) return null;
  const user = await userRes.json();
  const roleRes = await fetch(process.env.SUPABASE_URL + "/rest/v1/rpc/is_center_management_admin", { method: "POST", headers, body: "{}" });
  if (!roleRes.ok || await roleRes.json() !== true) return null;
  return user;
}

export default async function handler(req, res) {
  if (!["GET", "POST", "PATCH"].includes(req.method)) {
    res.setHeader("Allow", "GET, POST, PATCH");
    return sendJson(res, 405, { error: "METHOD_NOT_ALLOWED" });
  }
  try {
    const user = await adminUser(req);
    if (!user) return sendJson(res, 401, { error: "ADMIN_AUTH_REQUIRED" });
    const sql = getDatabase("education");

    if (req.method === "GET") {
      const registrations = await sql`
        SELECT id, registration_number, student_name, gender, date_of_birth, nationality,
               requested_program, phone, guardian_name, guardian_phone, approval_status, approved_at,
               approval_note, documented, documented_at, document_reference, created_at,
               followup.status AS follow_up_status,
               followup.due_at AS follow_up_due_at,
               followup.assigned_to AS follow_up_assigned_to
        FROM education.student_registrations r
        LEFT JOIN LATERAL (
          SELECT t.status, t.due_at, t.assigned_to
          FROM education.tasks t
          WHERE POSITION(r.registration_number IN COALESCE(t.description, '')) > 0
          ORDER BY t.created_at DESC
          LIMIT 1
        ) AS followup ON true
        ORDER BY r.created_at DESC
        LIMIT 50
      `;
      return sendJson(res, 200, { ok: true, registrations });
    }

    const body = req.body && typeof req.body === "object" ? req.body : {};
    if (req.method === "POST") {
      const name = cleanText(body.student_name, 120);
      const gender = body.gender === "male" || body.gender === "female" ? body.gender : null;
      const phone = cleanText(body.phone, 30);
      const guardianPhone = cleanText(body.guardian_phone, 30);
      const email = cleanText(body.email, 254);
      const dateOfBirth = cleanText(body.date_of_birth, 10);
      const educationStage = cleanText(body.education_stage, 20);
      const educationGrade = cleanText(body.education_grade, 40);
      const gradesByStage = {
        early_childhood: ["الحضانة", "تمهيدي 1 KG1", "تمهيدي 2 KG2", "تمهيدي 3 KG3"],
        primary: ["الأول الابتدائي", "الثاني الابتدائي", "الثالث الابتدائي", "الرابع الابتدائي", "الخامس الابتدائي", "السادس الابتدائي"],
        middle: ["الأول المتوسط", "الثاني المتوسط", "الثالث المتوسط"],
        secondary: ["الأول الثانوي", "الثاني الثانوي", "الثالث الثانوي"]
      };
      const stageLabels = { early_childhood: "مرحلة الطفولة المبكرة", primary: "المرحلة الابتدائية", middle: "المرحلة المتوسطة", secondary: "المرحلة الثانوية" };
      const requestedProgram = stageLabels[educationStage] && gradesByStage[educationStage]?.includes(educationGrade)
        ? stageLabels[educationStage] + " — " + educationGrade
        : "";
      const validDate = (value) => {
        if (!value) return true;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
        const [year, month, day] = value.split("-").map(Number);
        const parsed = new Date(Date.UTC(year, month - 1, day));
        return parsed.getUTCFullYear() === year &&
          parsed.getUTCMonth() === month - 1 &&
          parsed.getUTCDate() === day &&
          parsed.getTime() <= Date.now();
      };
      const validEmail = (value) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
      if (!requestedProgram) return sendJson(res, 400, { error: "INVALID_EDUCATION_GRADE" });
      if (name.length < 2 || !gender || (phone && !validPhone(phone)) ||
          (guardianPhone && !validPhone(guardianPhone)) || !validEmail(email) ||
          !validDate(dateOfBirth) || (!phone && !guardianPhone && !email)) {
        return sendJson(res, 400, { error: "INVALID_REGISTRATION_FIELDS" });
      }
      const number = "EDU-" + Date.now().toString(36).toUpperCase() + "-" + crypto.randomUUID().slice(0, 6).toUpperCase();
      const saved = await sql`
        INSERT INTO education.student_registrations
          (registration_number, student_name, full_name, gender, date_of_birth, nationality,
           requested_program, phone, email, guardian_name, guardian_phone, notes, status, approval_status)
        VALUES
          (${number}, ${name}, ${name}, ${gender},
           NULLIF(${dateOfBirth}, '')::date,
           NULLIF(${cleanText(body.nationality, 80)}, ''),
           NULLIF(${requestedProgram}, ''),
           NULLIF(${phone}, ''), NULLIF(${email}, ''),
           NULLIF(${cleanText(body.guardian_name, 120)}, ''),
           NULLIF(${guardianPhone}, ''),
           NULLIF(${cleanText(body.notes, 1000)}, ''),
           'pending', 'pending')
        RETURNING id, registration_number, approval_status, created_at
      `;
      return sendJson(res, 201, { ok: true, registration: saved[0] });
    }

    const id = cleanText(body.id, 64);
    const action = cleanText(body.action, 20);
    if (!/^[0-9a-f-]{36}$/i.test(id)) return sendJson(res, 400, { error: "INVALID_REGISTRATION_ID" });
    let changed;
    if (action === "approve") {
      changed = await sql`UPDATE education.student_registrations SET approval_status='approved', status='approved', approved_at=now(), approved_by=${user.id}::uuid WHERE id=${id}::uuid RETURNING id, registration_number, approval_status`;
    } else if (action === "reject") {
      changed = await sql`UPDATE education.student_registrations SET approval_status='rejected', status='rejected', approved_at=NULL, approved_by=${user.id}::uuid WHERE id=${id}::uuid RETURNING id, registration_number, approval_status`;
    } else if (action === "document") {
      changed = await sql`UPDATE education.student_registrations SET documented=true, documented_at=now(), documented_by=${user.id}::uuid, document_reference=NULLIF(${cleanText(body.document_reference, 200)}, '') WHERE id=${id}::uuid RETURNING id, documented, documented_at, document_reference`;
    } else {
      return sendJson(res, 400, { error: "INVALID_ACTION" });
    }
    if (!changed.length) return sendJson(res, 404, { error: "REGISTRATION_NOT_FOUND" });
    if ((action === "approve" || action === "reject") && changed[0].registration_number) {
      try {
        await sql`
          UPDATE education.tasks
          SET status = 'completed', updated_at = now()
          WHERE status IN ('open', 'in_progress')
            AND POSITION(${changed[0].registration_number} IN COALESCE(description, '')) > 0
        `;
      } catch (taskError) {
        console.error("STUDENT_REGISTRATION_FOLLOWUP_CLOSE_FAILED", taskError?.code || "unknown");
      }
    }
    return sendJson(res, 200, { ok: true, registration: changed[0] });
  } catch (error) {
    const status = error.statusCode || 500;
    return sendJson(res, status, { error: status === 503 ? error.message : "REGISTRATION_ADMIN_FAILED" });
  }
}
