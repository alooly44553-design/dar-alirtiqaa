import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const home = read("index.html");
const packages = read("education-packages.html");
const higher = read("higher-education.html");
const serviceFees = read("api/education/service-fees.js");
const serviceRequests = read("api/education/service-requests.js");
const registrations = read("api/education/registrations.js");
const migration = read("database/migrations/20261104_unified_curriculum_and_approved_fees.sql");
const admin = read("admin.html");
const packagePages = ["early-learning.html","general-education.html","higher-education.html","vocational-training.html","quran-islamic-studies.html","academic-support.html","academic-career-guidance.html","international-education.html","languages-communication.html","digital-technology.html","teacher-development.html","lifelong-learning.html","health-medical-sciences.html","engineering-applied-sciences.html","business-management-finance.html","law-governance.html","natural-sciences-mathematics.html","humanities-social-sciences.html","arts-design-media.html","agriculture-environment-sustainability.html","tourism-hospitality-services.html","research-postgraduate.html"];

for (const amount of [
  "1050:1050", "900:900", "2100:2100", "1800:1800",
  "term:750", "annual:1500", "term:900", "annual:1800",
  "term:1050", "annual:2100", "term:1500", "annual:3000",
  "term:900", "annual:2700", "term:1000", "annual:3000",
  "150", "50", "100", "200"
]) assert(home.includes(amount.split(":")[0]) || serviceFees.includes(amount.split(":")[0]), "Missing approved fee amount " + amount);

for (const text of [
  "مرجع المنهج التعليمي", "curriculum_reference", "curriculum_country",
  "الفصل الدراسي", "السنة الدراسية", "عدد دفعات الفصل الدراسي",
  "فتح الملف والتسجيل", "الاشتراك التعليمي أو التدريبي",
  "فتح حزمة التعليم الجامعي والدراسات العليا"
]) assert(home.includes(text) || higher.includes(text), "Missing unified form requirement: " + text);

assert(home.includes("curriculum_track") && home.includes("curriculum_reference"), "All education service forms must offer curriculum selection and reference.");
assert(home.includes("tuition_period") && home.includes("installment_count"), "Student registration must capture term/annual period and installment count.");
assert(serviceRequests.includes("curriculum_reference") && serviceRequests.includes("curriculumCountry"), "Service requests must validate and store the curriculum reference.");
assert(registrations.includes("curriculum_reference, tuition_period, installment_count"), "Student registration must persist curriculum and fee period fields.");
assert(registrations.includes("curriculumReference") && registrations.includes("installmentCount"), "Student registration API must validate the new fields.");
assert(serviceFees.includes('serviceCode === "student_registration"') && serviceFees.includes('serviceCode === "university_guidance"') && serviceFees.includes('serviceCode === "activity_join"'), "Public fee API must return the approved schedule for school, university, program, course, and center subscriptions.");
assert(serviceFees.includes('الاشتراك في المركز التعليمي') && serviceFees.includes('amount: 150'), "Educational center subscription must be 150 SAR monthly.");
assert(serviceFees.includes('amount: 50') && serviceFees.includes('applies_when: "no_existing_file"'), "Educational center file-opening fee must be 50 SAR once for new beneficiaries.");
assert(migration.includes("'activity_join','REGISTRATION','subscription','الاشتراك في المركز التعليمي'"), "Migration must preserve the approved monthly center subscription.");
assert(migration.includes("DO $$") && migration.includes("END $$;"), "Migration must use valid PostgreSQL dollar-quoted block syntax.");
assert(migration.includes("ADD COLUMN IF NOT EXISTS has_existing_file boolean"), "Migration must add the existing-file flag used by registration APIs.");
assert(!serviceFees.includes("FROM education.service_fee_items"), "Public fee API must not expose unapproved legacy rows.");
assert(migration.includes("DELETE FROM education.service_fee_items"), "Migration must delete all legacy unapproved fee rows before restoring the approved list.");
assert(migration.includes("'program_application','REGISTRATION','subscription','الاشتراك في البرنامج التعليمي'"), "Program subscriptions must be 150 SAR monthly.");
assert(migration.includes("'course_registration','REGISTRATION','subscription','الاشتراك في الدورة التعليمية'"), "Course subscriptions must be 150 SAR monthly.");
assert(packages.includes("ضمن المنظومة الموحدة"), "Package page must describe one unified education system.");
assert(!/مسارات مستقلة|خيارات مستقلة|حزم مستقلة|صفحة مستقلة لكل مجال/u.test(packages), "Package page must not imply separate curriculum branches.");
assert(higher.includes("فتح حزمة التعليم الجامعي والدراسات العليا"), "Higher education CTA must use the approved package wording.");
assert(!/التوجيه والقبول الجامعي|القبول الجامعي والعالي|فتح مجال التعليم الجامعي/u.test(home + packages + higher), "Obsolete higher education wording must be removed from all visible education pages.");
for (const page of packagePages) {
  const source = read(page);
  assert.match(source, /الرسوم المعتمدة|الرسوم الدراسية المعتمدة/u, "Every education package must display its approved fee schedule: " + page);
  assert.doesNotMatch(source, /رسوم إضافية|رسوم إدارية إضافية|رسوم قبول إضافية/u, "Unapproved extra-fee labels must not appear: " + page);
}
assert.doesNotMatch(read("early-learning.html"), /أقساط شهرية/u, "Early-childhood fees must use semester installment selection, not monthly installments.");
assert.doesNotMatch(registrations, /educationStage === "early_childhood".*monthly_installments/u, "Early-childhood registration must validate the selected term/annual period, not a monthly payment option.");
assert.match(registrations, /const paymentPlan = tuitionPeriod === "annual" \? "annual" : "monthly_installments"/u, "Legacy payment storage must be derived from the selected tuition period.");
assert.match(admin, /curriculum_reference/u, "Admin registration records must expose the curriculum reference.");
assert.match(admin, /installment_count/u, "Admin registration records must expose the installment count.");

console.log("Unified education curriculum, approved fee display, and registration validation checks passed.");
