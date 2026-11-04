import { getDatabase, sendJson } from "../../lib/neon-db.js";

const approvedFees = (serviceCode) => {
  if (serviceCode === "student_registration") return [
    { fee_code: "FILE_OPENING", fee_name: "فتح الملف والتسجيل", amount: 100, currency: "SAR", calculation_method: "conditional", is_required: true, condition_rule: { applies_when: "no_existing_file" } },
    { fee_code: "EARLY_UNIFORM_BOOKS", fee_name: "رسوم الزي والكتب", amount: 100, currency: "SAR", calculation_method: "annual", is_required: true, condition_rule: { education_stage: "early_childhood", period: "annual" } },
    { fee_code: "TUITION_PRIMARY", fee_name: "الابتدائية — سنوي", amount: 1500, currency: "SAR", calculation_method: "annual", is_required: true, condition_rule: { education_stage: "primary", period: "annual" } },
    { fee_code: "TUITION_PRIMARY_TERM", fee_name: "الابتدائية — فصل دراسي", amount: 750, currency: "SAR", calculation_method: "term", is_required: true, condition_rule: { education_stage: "primary", period: "term" } },
    { fee_code: "TUITION_MIDDLE", fee_name: "المتوسطة — سنوي", amount: 1800, currency: "SAR", calculation_method: "annual", is_required: true, condition_rule: { education_stage: "middle", period: "annual" } },
    { fee_code: "TUITION_MIDDLE_TERM", fee_name: "المتوسطة — فصل دراسي", amount: 900, currency: "SAR", calculation_method: "term", is_required: true, condition_rule: { education_stage: "middle", period: "term" } },
    { fee_code: "TUITION_SECONDARY", fee_name: "الثانوية — سنوي", amount: 2100, currency: "SAR", calculation_method: "annual", is_required: true, condition_rule: { education_stage: "secondary", period: "annual", exclude_grade: "الثالث الثانوي" } },
    { fee_code: "TUITION_SECONDARY_TERM", fee_name: "الثانوية — فصل دراسي", amount: 1050, currency: "SAR", calculation_method: "term", is_required: true, condition_rule: { education_stage: "secondary", period: "term", exclude_grade: "الثالث الثانوي" } },
    { fee_code: "TUITION_GRADE_12", fee_name: "الثالث الثانوي — سنوي", amount: 3000, currency: "SAR", calculation_method: "annual", is_required: true, condition_rule: { education_stage: "secondary", grade: "الثالث الثانوي", period: "annual" } },
    { fee_code: "TUITION_GRADE_12_TERM", fee_name: "الثالث الثانوي — فصل دراسي", amount: 1500, currency: "SAR", calculation_method: "term", is_required: true, condition_rule: { education_stage: "secondary", grade: "الثالث الثانوي", period: "term" } },
    { fee_code: "LEVEL_ASSESSMENT", fee_name: "تحديد المستوى", amount: 200, currency: "SAR", calculation_method: "conditional", is_required: false, condition_rule: { applies_when: "level_assessment_required" } },
    { fee_code: "CERTIFICATE_EQUIVALENCY", fee_name: "معادلة الشهادة أو الأعمار", amount: 200, currency: "SAR", calculation_method: "conditional", is_required: false, condition_rule: { applies_when: "certificate_or_age_equivalency_required" } },
    { fee_code: "EARLY_NURSERY", fee_name: "الحضانة والتمهيدي 1 — سنوي", amount: 2100, currency: "SAR", calculation_method: "annual", is_required: true, condition_rule: { education_stage: "early_childhood", grade_group: "nursery_kg1", period: "annual" } },
    { fee_code: "EARLY_NURSERY_TERM", fee_name: "الحضانة والتمهيدي 1 — فصل دراسي", amount: 1050, currency: "SAR", calculation_method: "term", is_required: true, condition_rule: { education_stage: "early_childhood", grade_group: "nursery_kg1", period: "term" } },
    { fee_code: "EARLY_KG", fee_name: "رياض الأطفال والتمهيدي — سنوي", amount: 1800, currency: "SAR", calculation_method: "annual", is_required: true, condition_rule: { education_stage: "early_childhood", grade_group: "kg2_kg3", period: "annual" } },
    { fee_code: "EARLY_KG_TERM", fee_name: "رياض الأطفال والتمهيدي — فصل دراسي", amount: 900, currency: "SAR", calculation_method: "term", is_required: true, condition_rule: { education_stage: "early_childhood", grade_group: "kg2_kg3", period: "term" } }
  ];
  if (serviceCode === "university_guidance") return [
    { fee_code: "FILE_OPENING", fee_name: "فتح الملف", amount: 100, currency: "SAR", calculation_method: "conditional", is_required: true, condition_rule: { applies_when: "no_existing_file" } },
    { fee_code: "LEVEL_ASSESSMENT", fee_name: "تحديد المستوى", amount: 200, currency: "SAR", calculation_method: "conditional", is_required: false, condition_rule: { applies_when: "level_assessment_required" } },
    { fee_code: "CERTIFICATE_EQUIVALENCY", fee_name: "معادلة الشهادة أو الأعمار", amount: 200, currency: "SAR", calculation_method: "conditional", is_required: false, condition_rule: { applies_when: "certificate_or_age_equivalency_required" } },
    { fee_code: "TUITION_STANDARD_TERM", fee_name: "الدبلوم والدبلوم العالي والبكالوريوس — فصل دراسي", amount: 900, currency: "SAR", calculation_method: "term", is_required: true, condition_rule: { fee_scope: "tuition_only", applies_to: ["diploma", "bachelor", "higher_diploma"], period: "term" } },
    { fee_code: "TUITION_STANDARD", fee_name: "الدبلوم والدبلوم العالي والبكالوريوس — سنوي", amount: 2700, currency: "SAR", calculation_method: "annual", is_required: true, condition_rule: { fee_scope: "tuition_only", applies_to: ["diploma", "bachelor", "higher_diploma"], period: "annual" } },
    { fee_code: "TUITION_GRADUATE_TERM", fee_name: "الدراسات العليا والماجستير — فصل دراسي", amount: 1000, currency: "SAR", calculation_method: "term", is_required: true, condition_rule: { fee_scope: "tuition_only", applies_to: ["masters", "doctorate", "postgraduate_studies"], period: "term" } },
    { fee_code: "TUITION_GRADUATE", fee_name: "الدراسات العليا والماجستير — سنوي", amount: 3000, currency: "SAR", calculation_method: "annual", is_required: true, condition_rule: { fee_scope: "tuition_only", applies_to: ["masters", "doctorate", "postgraduate_studies"], period: "annual" } }
  ];
  if (["program_application", "course_registration", "activity_join"].includes(serviceCode)) return [
    { fee_code: "FILE_OPENING", fee_name: "فتح الملف", amount: 50, currency: "SAR", calculation_method: "once", is_required: true, condition_rule: { applies_when: "no_existing_file" } },
    { fee_code: "REGISTRATION", fee_name: "الاشتراك التعليمي أو التدريبي", amount: 150, currency: "SAR", calculation_method: "monthly", is_required: true, condition_rule: { period: "monthly" } }
  ];
  return [];
};

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return sendJson(res, 405, { error: "METHOD_NOT_ALLOWED" });
  }
  try {
    const requestUrl = new URL(req.url || "/", "https://education.local");
    const serviceId = requestUrl.searchParams.get("service_id") || "";
    if (!/^[0-9a-f-]{36}$/i.test(serviceId)) {
      return sendJson(res, 400, { error: "INVALID_SERVICE_ID" });
    }
    const sql = getDatabase("education");
    const found = await sql`SELECT service_code FROM education.service_catalog WHERE id = ${serviceId}::uuid AND is_active = true LIMIT 1`;
    if (!found.length) return sendJson(res, 404, { error: "SERVICE_NOT_FOUND" });
    return sendJson(res, 200, { ok: true, fees: approvedFees(found[0].service_code) });
  } catch (error) {
    const status = error.statusCode || 500;
    return sendJson(res, status, { error: status === 503 ? error.message : "SERVICE_FEES_FAILED" });
  }
}
