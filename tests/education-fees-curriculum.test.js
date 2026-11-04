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
assert(serviceFees.includes('serviceCode === "student_registration"') && serviceFees.includes('serviceCode === "university_guidance"'), "Public fee API must return the approved schedule only.");
assert(!serviceFees.includes("FROM education.service_fee_items"), "Public fee API must not expose unapproved legacy rows.");
assert(migration.includes("SET is_active = false"), "Migration must deactivate all legacy unapproved fee rows before restoring the approved list.");
assert(migration.includes("'program_application','REGISTRATION','subscription','الاشتراك في البرنامج التعليمي'"), "Program subscriptions must be 150 SAR monthly.");
assert(migration.includes("'course_registration','REGISTRATION','subscription','الاشتراك في الدورة التعليمية'"), "Course subscriptions must be 150 SAR monthly.");
assert(packages.includes("ضمن المنظومة الموحدة"), "Package page must describe one unified education system.");
assert(!/مسارات مستقلة|خيارات مستقلة|حزم مستقلة|صفحة مستقلة لكل مجال/u.test(packages), "Package page must not imply separate curriculum branches.");
assert(higher.includes("فتح حزمة التعليم الجامعي والدراسات العليا"), "Higher education CTA must use the approved package wording.");
assert(!/التوجيه والقبول الجامعي|القبول الجامعي والعالي|فتح مجال التعليم الجامعي/u.test(home + packages + higher), "Obsolete higher education wording must be removed from all visible education pages.");

console.log("Unified education curriculum, approved fee display, and registration validation checks passed.");
