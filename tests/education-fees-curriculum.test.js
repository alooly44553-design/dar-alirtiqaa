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
const early = read("early-learning.html");
const general = read("general-education.html");
const packagePages = [
  "early-learning.html","general-education.html","higher-education.html",
  "vocational-training.html","quran-islamic-studies.html","academic-support.html",
  "academic-career-guidance.html","international-education.html","languages-communication.html",
  "digital-technology.html","teacher-development.html","lifelong-learning.html",
  "health-medical-sciences.html","engineering-applied-sciences.html",
  "business-management-finance.html","law-governance.html",
  "natural-sciences-mathematics.html","humanities-social-sciences.html",
  "arts-design-media.html","agriculture-environment-sustainability.html",
  "tourism-hospitality-services.html","research-postgraduate.html"
];

assert(home.includes("curriculum_track") && home.includes("curriculum_reference"),
  "All public education forms must retain curriculum selection and reference.");
assert(serviceRequests.includes("curriculum_reference") && serviceRequests.includes("curriculumCountry"),
  "Service requests must validate and store the curriculum reference.");
assert.match(registrations, /LEGACY_REGISTRATION_DISABLED/u,
  "The retired unified registration endpoint must reject new submissions while preserving historical records.");
assert.match(higher, /فتح حزمة التعليم الجامعي والدراسات العليا/u,
  "Higher education CTA must use the approved package wording.");
assert.doesNotMatch(home + packages + higher,
  /التوجيه والقبول الجامعي|القبول الجامعي والعالي|فتح مجال التعليم الجامعي/u,
  "Obsolete higher education wording must be removed from visible education pages.");

assert.match(home, /خصم 50% للأيتام/u, "Early-childhood concession must be visible without publishing a fee amount.");
assert.match(home, /خصم 50% للأيتام دون 15 عامًا/u, "General-education concession must retain the approved age condition.");
assert.match(early, /رسوم دراسية ميسرة/u);
assert.match(early, /السداد على دفعات/u);
assert.match(general, /رسوم دراسية ميسرة/u);
assert.match(general, /السداد على دفعات/u);

assert.match(serviceFees, /fees:\s*\[\]/u,
  "Public fee API must not expose numeric fee rows before a fresh management approval.");
assert.match(serviceFees, /تُحدد الرسوم والتيسيرات بعد مراجعة الإدارة/u,
  "Public fee API must refer pricing questions to management.");
assert.doesNotMatch(serviceFees, /amount:\s*\d|fee_code:\s*["']/u,
  "Public fee API must not contain hard-coded monetary values or fee codes.");
assert.doesNotMatch(home, /ثلاثة مسارات\s*[—-]\s*\d|خمسة مسارات\s*[—-]\s*\d|money\(x\[1\]\)/u,
  "The main form must not publish unconfirmed pathway prices.");

for (const page of packagePages) {
  const source = read(page);
  assert.match(source, /الرسوم/u, "Every education package must explain that fees are reviewed: " + page);
  assert.doesNotMatch(source, /(?:\d[\d,]*(?:\.\d+)?\s*ريال|(?:ريال|SAR)\s*\d)/u,
    "Unconfirmed numeric fee amounts must not be published: " + page);
  assert.doesNotMatch(source, /رسوم إضافية|رسوم إدارية إضافية|رسوم قبول إضافية/u,
    "Unapproved extra-fee labels must not appear: " + page);
}
assert.doesNotMatch(home, /(?:\d[\d,]*(?:\.\d+)?\s*ريال|(?:ريال|SAR)\s*\d)/u,
  "Main page must not publish numeric fee amounts.");
assert.doesNotMatch(packages, /(?:\\d[\\d,]*(?:\\.\\d+)?\\s*ريال|(?:ريال|SAR)\\s*\\d)/u,\n  "Education packages overview must not publish numeric fee amounts.");\nassert.doesNotMatch(read("early-learning.html"), /أقساط شهرية/u,
  "Early-childhood fees must not be described as monthly installments.");
assert.match(migration, /DO \$\$/u);
assert.match(migration, /ADD COLUMN IF NOT EXISTS has_existing_file boolean/u);
assert.match(admin, /curriculum_reference/u);
assert.match(admin, /installment_count/u);
assert.match(admin, /يعرض هذا القسم جدول الرسوم المعتمد فقط/u);
assert.doesNotMatch(admin, /data-fee-save|data-fee-amount|data-fee-required/u,
  "Admin fee schedule must remain read-only.");
const adminFeesApi = read("api/education/admin-service-fees.js");
assert.match(adminFeesApi, /if \(req\.method !== "GET"\)/u);
assert.doesNotMatch(adminFeesApi, /UPDATE education\.service_fee_items/u);
assert.match(admin, /إنشاء رسوم يدوية أو وصفية إضافية متوقف/u);
assert.doesNotMatch(admin, /id="addFee"|id="feeAmount"|id="feeDesc"/u);

console.log("Education curriculum references, management-controlled fee disclosure, approved concessions, and legacy registration retirement checks passed.");
