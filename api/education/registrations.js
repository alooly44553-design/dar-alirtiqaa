import { getDatabase, sendJson, methodNotAllowed, cleanText, validPhone } from "../../lib/neon-db.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return methodNotAllowed(req, res);
  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    if (body.consent_given !== true) {
      return sendJson(res, 400, { error: "CONSENT_REQUIRED" });
    }
    const studentName = cleanText(body.student_name || body.full_name, 120);
    const gender = body.gender === "male" || body.gender === "female" ? body.gender : null;
    const phone = cleanText(body.phone, 30);
    const guardianPhone = cleanText(body.guardian_phone, 30);
    const email = cleanText(body.email, 254);
    const identityType = cleanText(body.identity_type, 80);
    const identityNumber = cleanText(body.identity_number, 80);
    const allowedIdentityTypes = [
      "national_id", "resident_id", "visitor_id", "family_visit",
      "hajj_umrah", "document", "official_letter", "other", "none"
    ];
    if (identityType && !allowedIdentityTypes.includes(identityType)) {
      return sendJson(res, 400, { error: "INVALID_IDENTITY_TYPE" });
    }
    const dateOfBirth = cleanText(body.date_of_birth, 10);
    const educationStage = cleanText(body.education_stage, 20);
    const educationGrade = cleanText(body.education_grade, 40);
    const gradesByStage = {
      primary: ["الأول الابتدائي", "الثاني الابتدائي", "الثالث الابتدائي", "الرابع الابتدائي", "الخامس الابتدائي", "السادس الابتدائي"],
      middle: ["الأول المتوسط", "الثاني المتوسط", "الثالث المتوسط"],
      secondary: ["الأول الثانوي", "الثاني الثانوي", "الثالث الثانوي"]
    };
    const stageLabels = { primary: "المرحلة الابتدائية", middle: "المرحلة المتوسطة", secondary: "المرحلة الثانوية" };
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
    // Student attachments are disabled in the UI until private, authenticated storage is implemented.
    // Never trust client-supplied attachment paths or metadata.
    const attachments = [];
    const consentText = "أوافق على صحة البيانات المدخلة وعلى مراجعتها وتوثيق قبول التسجيل من إدارة المنظومة.";
    if (body.consent_text !== consentText) {
      return sendJson(res, 400, { error: "CONSENT_TEXT_MISMATCH" });
    }
    if (!requestedProgram) {
      return sendJson(res, 400, { error: "INVALID_EDUCATION_GRADE" });
    }
    if (studentName.length < 2 || !gender ||
        (phone && !validPhone(phone)) || (guardianPhone && !validPhone(guardianPhone)) ||
        !validEmail(email) || !validDate(dateOfBirth) ||
        (!phone && !guardianPhone && !email)) {
      return sendJson(res, 400, { error: "INVALID_REGISTRATION_FIELDS" });
    }
    const registrationNumber = "EDU-" + Date.now().toString(36).toUpperCase() + "-" + crypto.randomUUID().slice(0, 6).toUpperCase();
    const sql = getDatabase("education");
    const rows = await sql`
      INSERT INTO education.student_registrations
        (registration_number, student_name, full_name, gender, date_of_birth, nationality,
         identity_type, identity_number, phone, email, guardian_name, guardian_relationship,
         guardian_phone, address, previous_education, requested_program, notes, attachments, status, approval_status, consent_given, consent_recorded_at, consent_text)
      VALUES
        (${registrationNumber}, ${studentName}, ${studentName}, ${gender},
         NULLIF(${dateOfBirth}, '')::date,
         NULLIF(${cleanText(body.nationality, 80)}, ''),
         NULLIF(${identityType}, ''),
         NULLIF(${identityNumber}, ''),
         NULLIF(${phone}, ''), NULLIF(${email}, ''),
         NULLIF(${cleanText(body.guardian_name, 120)}, ''),
         NULLIF(${cleanText(body.guardian_relationship, 80)}, ''),
         NULLIF(${guardianPhone}, ''),
         NULLIF(${cleanText(body.address, 250)}, ''),
         NULLIF(${cleanText(body.previous_education, 200)}, ''),
         NULLIF(${requestedProgram}, ''),
         NULLIF(${cleanText(body.notes, 1000)}, ''),
         ${JSON.stringify(attachments)}::jsonb, 'pending', 'pending', true, now(), ${consentText})
      RETURNING id, registration_number, approval_status, created_at
    `;
    return sendJson(res, 201, { ok: true, registration: rows[0] });
  } catch (error) {
    const status = error.statusCode || 500;
    return sendJson(res, status, { error: status === 503 ? error.message : "REGISTRATION_FAILED" });
  }
}
