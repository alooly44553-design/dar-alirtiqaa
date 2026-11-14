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
  const serviceByPage = { "early-learning.html":"early_childhood_registration", "general-education.html":"general_education_registration", "higher-education.html":"university_guidance", "vocational-training.html":"course_registration", "international-education.html":"general_education_registration" };
  const expectedService = serviceByPage[page] || "activity_join";
  assert.match(html, new RegExp("service=" + expectedService), page + " must route to its approved registration service");
}

const homepage = fs.readFileSync("index.html", "utf8");
const pathwaysStart = homepage.indexOf('<section id="pathways" class="section">');
const pathwaysEnd = homepage.indexOf('<section id="curriculum-model"', pathwaysStart);
assert.ok(pathwaysStart >= 0 && pathwaysEnd > pathwaysStart, "homepage must contain the approved pathways section");
const pathways = homepage.slice(pathwaysStart, pathwaysEnd);
assert.equal((pathways.match(/<div class="path">/g) || []).length, 5, "homepage must show only the four core domains and the fifth advancement-pathways domain");
assert.match(pathways, /مسارات الإرتقاء التعليمية والتربوية والمهارية/, "homepage must include the approved fifth domain");
assert.doesNotMatch(pathways, /القرآن والإسلامية|التقوية والعربية والتأهيل|الإرشاد الأكاديمي|التعليم الدولي/, "additional services and curriculum choices must not appear as separately numbered or standalone homepage domains");
assert.doesNotMatch(pathways, /(?:^|[>\\s])(?:[0-9]+|[٠-٩]+)[.)、-]\\s*/m, "homepage domain cards must not be numbered");
assert.match(homepage, /منظومة دار الإرتقاء الفكري التعليمية/, "homepage must use the approved education identity");
assert.doesNotMatch(homepage, /منظومة مدارس(?:\\s*\/\\s*مراكز| ومراكز) دار الإرتقاء الفكري التعليمية/, "old education identity must not remain on the homepage");

const packages = fs.readFileSync("education-packages.html", "utf8");
assert.match(packages, /id="approved-fees"/, "the packages hub must show the approved fee schedule");
assert.match(packages, /id="curriculum-reference"/, "the packages hub must expose curriculum selection before registration");
assert.match(packages, /مرجع المنهج وإصداره والمرحلة والمستوى/, "the packages hub must describe the curriculum metadata");
assert.doesNotMatch(packages, /<h3>🌐 التعليم الدولي<\/h3>/, "international curricula must remain a reference choice, not a separate track");
assert.match(packages, /service=early_childhood_registration/, "early-childhood package must use its dedicated form");
assert.match(packages, /service=general_education_registration/, "general education package must use its dedicated form");
assert.match(packages, /service=university_guidance/, "higher-education package must use the university application service");
assert.match(packages, /service=course_registration/, "vocational package must use the vocational course service");
assert.match(packages, /service=activity_join/, "the fifth-field pathways must use pathway registration");
assert.doesNotMatch(packages, /service=program_application/, "package pathways must not use the generic application form");
assert.match(packages, /لا توجد رسوم إضافية أو عمومية/, "the packages hub must prohibit unapproved fees");

const index = fs.readFileSync("index.html", "utf8");
assert.match(index, /label:"مرجع المنهج التعليمي"/, "the unified registration form must include curriculum reference selection");
assert.match(index, /label:"الدولة أو النظام التعليمي"/, "the unified registration form must capture the country or education system");
assert.match(index, /key:"curriculum_reference",type:"select",label:"مرجع المنهج أو الإطار التعليمي"/, "each registration form must present a domain-specific curriculum reference selector");
assert.match(index, /curriculumReferenceOptions/, "registration forms must provide appropriate curriculum references for the five fields");

console.log("PASS: " + pages.length + " education and professional sector pages, unified package fees, and curriculum fields.");
