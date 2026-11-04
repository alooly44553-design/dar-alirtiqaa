import assert from "node:assert/strict";
import fs from "node:fs";

const pages = [
  "early-learning.html", "general-education.html", "higher-education.html",
  "vocational-training.html", "quran-islamic-studies.html", "academic-support.html",
  "academic-career-guidance.html", "international-education.html",
  "agriculture-environment-sustainability.html", "arts-design-media.html",
  "business-management-finance.html", "digital-technology.html",
  "engineering-applied-sciences.html", "health-medical-sciences.html",
  "humanities-social-sciences.html", "languages-communication.html",
  "law-governance.html", "lifelong-learning.html", "natural-sciences-mathematics.html",
  "research-postgraduate.html", "tourism-hospitality-services.html", "teacher-development.html"
];

for (const page of pages) {
  assert.ok(fs.existsSync(page), page + " must exist");
  const html = fs.readFileSync(page, "utf8");
  assert.match(html, /مرجع المنهج والمحتوى التعليمي|مرجع المنهج التعليمي|مرجع المناهج متعددة الدول/, page + " must describe curriculum reference selection");
  assert.match(html, /ملف المتعلم الموحد|استمارة المجال|استمارة التسجيل/, page + " must connect curriculum selection to the unified learner record or registration");
  assert.doesNotMatch(html, /حزمة تعليمية مستقلة/, page + " must not imply an independently branched package");
  assert.doesNotMatch(html, /التوجيه الجامعي والقبول|فتح مجال التعليم الجامعي/, page + " must use the approved higher-education naming");
  assert.doesNotMatch(html, /دار الارتقاء الفكري العالمية|دار الإرتقاء الفكري العالمية/, page + " must use the education identity");
  assert.doesNotMatch(html, /رسوم إضافية غير معتمدة|رسوم قبول إضافية|رسوم عمومية غير معتمدة/, page + " must not advertise unapproved fees");
}

const packages = fs.readFileSync("education-packages.html", "utf8");
assert.match(packages, /id="approved-fees"/, "the packages hub must show the approved fee schedule");
assert.match(packages, /id="curriculum-reference"/, "the packages hub must expose curriculum selection before registration");
assert.match(packages, /مرجع المنهج وإصداره والمرحلة والمستوى/, "the packages hub must describe the curriculum metadata");
assert.doesNotMatch(packages, /<h3>🌐 التعليم الدولي<\/h3>/, "international curricula must remain a reference choice, not a separate track");
assert.match(packages, /service=student_registration[^"]*الطفولة|service=student_registration/, "early and general education packages must use student registration");
assert.match(packages, /service=university_guidance/, "higher education must retain its supported registration service");
assert.match(packages, /لا توجد رسوم إضافية أو عمومية/, "the packages hub must prohibit unapproved fees");

const index = fs.readFileSync("index.html", "utf8");
assert.match(index, /label:"مرجع المنهج التعليمي"/, "the unified registration form must include curriculum reference selection");
assert.match(index, /label:"الدولة أو النظام التعليمي"/, "the unified registration form must capture the country or education system");
assert.match(index, /label:"اسم المنهج أو مرجعه التعليمي"/, "the unified registration form must capture the curriculum reference");

console.log("PASS: " + pages.length + " education and professional sector pages, unified package fees, and curriculum fields.");
