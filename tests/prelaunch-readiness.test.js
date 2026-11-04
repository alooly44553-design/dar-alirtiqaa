import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const requiredFiles = [
  "index.html", "businesses.html", "education-packages.html", "admin.html", "international-education.html",
  "portal.html", "student.html", "teacher.html", "parent.html", "reports.html",
  "brochure.html", "privacy.html", "terms.html", "operations-templates.html",
  "zoom-operations.html", "app.webmanifest", "sw.js", "capacitor.config.ts",
  "supabase/migrations/20261021_guardian_portal_read_only_access.sql",
  ".github/workflows/android-official-release.yml", "docs/OFFICIAL_RELEASE_CHECKLIST.md",
  "docs/DAILY_ROLLOUT_AND_TEACHING_OPERATIONS_2026_2027.md",
  "database/migrations/20261103_curriculum_and_payment_tracks.sql",
  "supabase/migrations/20261021_guardian_portal_read_only_access.sql"
];
for (const file of requiredFiles) assert(fs.existsSync(path.join(root, file)), "Missing required platform file: " + file);

const packageJson = JSON.parse(read("package.json"));
const manifest = JSON.parse(read("app.webmanifest"));
const appName = "منظومة مدارس ومراكز دار الإرتقاء الفكري التعليمية";
assert.equal(packageJson.version, "1.1.7", "Package version must match intended release");
assert.equal(manifest.version, packageJson.version, "Manifest and package versions differ");
assert.equal(manifest.name, appName, "PWA display name mismatch");
assert.equal(manifest.short_name, appName, "PWA short name mismatch");
assert.match(read("capacitor.config.ts"), /appName:\s*'منظومة مدارس ومراكز دار الإرتقاء الفكري التعليمية'/u, "Capacitor appName mismatch");
const cacheName = read("sw.js").split('const CACHE_NAME = "dar-alirtiqaa-v')[1]?.split('"')[0];
assert.equal(cacheName, packageJson.version, "Service worker cache version must match the app version and force stale caches to refresh");
const android = read(".github/workflows/android-apk.yml");
assert(android.includes("Upload Debug APK (testing only)"), "Debug builds must be labeled as test-only");
assert.match(android, /VERSION_CODE=\$\(\(10#\$MAJOR \* 1000000 \+ 10#\$MINOR \* 1000 \+ 10#\$PATCH\)\)/u, "Android versionCode must use the shared monotonic semantic-version formula");
assert.match(android, /versionName/u, "Android versionName must follow package.json");
assert(android.includes("Upload Debug APK (testing only)"), "Debug builds must be labeled as test-only");
assert.match(android, /name: dar-alirtiqaa-android-debug-v\$\{\{ env\.APP_VERSION \}\}/u, "Unsigned builds must be versioned and labeled as test-only");
assert.match(android, /Upload signed Android release APK/u, "Signed APK artifact must be labeled separately");
const officialAndroid = read(".github/workflows/android-official-release.yml");
for (const secretName of ["ANDROID_KEYSTORE_BASE64", "ANDROID_KEYSTORE_PASSWORD", "ANDROID_KEY_ALIAS", "ANDROID_KEY_PASSWORD"]) {
  assert(officialAndroid.includes(secretName), "Official release workflow must require signing secret " + secretName);
}
assert.match(officialAndroid, /assembleRelease bundleRelease/u, "Official release must build both APK and AAB");
assert.match(officialAndroid, /apksigner" sign/u, "Official APK must be signed");
assert.match(officialAndroid, /jarsigner -verify/u, "Official AAB signature must be verified");
assert.match(officialAndroid, /gh release upload/u, "Official signed artifacts must be attached to a GitHub release");
assert.match(officialAndroid, /VERSION_CODE=\$\(\(10#\$MAJOR \* 1000000 \+ 10#\$MINOR \* 1000 \+ 10#\$PATCH\)\)/u, "Official and debug releases must share the same Android versionCode formula");
const rollout = read("docs/DAILY_ROLLOUT_AND_TEACHING_OPERATIONS_2026_2027.md");
for (const operationalTerm of ["تُفتح البرامج تدريجيًا", "لا يعني الاستلام القبول النهائي", "Zoom", "الخطط الدراسية", "مساعد الذكاء الاصطناعي"]) {
  assert(rollout.includes(operationalTerm), "Daily rollout playbook missing: " + operationalTerm);
}
assert.match(read("docs/OFFICIAL_RELEASE_CHECKLIST.md"), /لا توجد روابط حسابات/u, "Launch checklist must document the real-account prerequisite");


const index = read("index.html");
const projectHub = read("health-centers/businesses.html");
for (const canonicalUrl of [
  "https://alirtiqaa-government-public-service.vercel.app/?utm_source=chatgpt.com",
  "https://btaqat-alirtiqaa-alfikri-alnamothaj.vercel.app/?utm_source=chatgpt.com",
  "https://dar-alirtiqaa-management.vercel.app/"
]) assert(projectHub.includes(canonicalUrl), "Project hub must use the canonical public URL: " + canonicalUrl);
const aiPortalApi = read("api/education/portal.js");
const schoolPortal = read("portal.html");
assert.match(aiPortalApi, /"ai-draft":\s*\["POST"\]/u, "AI lesson drafting must be a POST-only role API");
assert.match(aiPortalApi, /identity\.staff\.is_active !== true/u, "AI lesson drafting must require an active staff account");
assert.match(aiPortalApi, /AI_DRAFT_RATE_LIMITED/u, "AI lesson drafting must enforce a rate limit");
assert.match(aiPortalApi, /requires_teacher_review:\s*true/u, "AI lesson output must require teacher review");
assert.match(aiPortalApi, /auto_published:\s*false/u, "AI lesson output must never auto-publish");
assert.match(schoolPortal, /resource=ai-draft/u, "Teacher portal must be wired to the AI draft API");
assert.match(schoolPortal, /لم تُحفظ ولم تُنشر تلقائيًا/u, "AI lesson page must clearly disclose that drafts aren't saved or published automatically");
assert.match(schoolPortal, /إدراج المسودة في شرح الدرس للتحرير/u, "Teacher must explicitly choose to insert the draft for editing");
const admin = read("admin.html");
const portalApi = read("api/education/portal.js");
const portalAuth = read("lib/education-portal-auth.js");
const guardianRls = read("supabase/migrations/20261021_guardian_portal_read_only_access.sql");
const teacherPage = read("teacher.html");
const studentPage = read("student.html");
const parentPage = read("parent.html");
assert.match(portalApi, /parent:\s*\["GET"\]/u, "Parent API must be read-only");
assert.match(portalApi, /case "parent":\s*return await handleParent/u, "Parent API must dispatch to the linked-family handler");
assert.match(portalApi, /PARENT_PROFILE_REQUIRED/u, "Parent access must require an active guardian profile");
assert.match(portalAuth, /guardianLearners/u, "Auth identity must resolve explicitly linked learners for the guardian");
assert.match(parentPage, /signInWithPassword/u, "Parent portal must require interactive authenticated sign-in");
for (const [page, source] of [["teacher.html", teacherPage], ["student.html", studentPage], ["parent.html", parentPage]]) {
  assert.match(source, /getSession\(\)/u, page + " must check the authenticated session before protected reads");
}
for (const [page, source] of [["teacher.html", teacherPage], ["student.html", studentPage], ["parent.html", parentPage]]) {
  assert.match(source, /Authorization:\s*"Bearer "\s*\+\s*token/u, page + " must forward a signed-in bearer token for protected API requests");
}
assert.match(guardianRls, /guardian_read_linked_learners/u, "Guardian RLS migration must restrict learners to explicit guardian links");
assert.match(guardianRls, /guardian_read_linked_school_submissions/u, "Guardian RLS migration must restrict results to linked children");
assert.match(guardianRls, /teacher_read_own_schedule_assignments/u, "Teacher RLS migration must restrict schedule reads to assigned teachers");
assert.doesNotMatch(guardianRls, /FOR\s+(INSERT|UPDATE|DELETE|ALL)\s+TO\s+authenticated/iu, "Guardian/teacher migration must not grant write access");
for (const [page, source] of [["teacher.html", teacherPage], ["student.html", studentPage], ["parent.html", parentPage]]) {
  assert(!source.includes('order("scheduled_start"'), page + " must use the actual starts_at field for sessions");
}
assert.match(teacherPage, /Authorization:\s*"Bearer "\s*\+\s*token/u, "Teacher API reads must forward the signed-in bearer token");
assert.match(studentPage, /Authorization:\s*"Bearer "\s*\+\s*token/u, "Student API reads must forward the signed-in bearer token");
assert.match(parentPage, /Authorization:\s*"Bearer "\s*\+\s*token/u, "Parent API reads must forward the signed-in bearer token");
assert.match(guardianRls, /guardian_read_linked_learners/u, "Guardian RLS migration must restrict learners to explicit guardian links");
assert.match(guardianRls, /guardian_read_linked_school_submissions/u, "Guardian RLS migration must restrict assignment results to linked children");
assert.match(guardianRls, /teacher_read_own_schedule_assignments/u, "Teacher RLS migration must restrict schedule reads to the assigned teacher");
assert.doesNotMatch(guardianRls, /FOR\s+(INSERT|UPDATE|DELETE|ALL)\s+TO\s+authenticated/iu, "Guardian/teacher role migration must not grant write access through these policies");
assert(!teacherPage.includes('order("scheduled_start"'), "Teacher session query must use the actual starts_at column");
assert(!studentPage.includes('order("scheduled_start"'), "Student session query must use the actual starts_at column");
assert(!parentPage.includes('order("scheduled_start"'), "Parent session query must use the actual starts_at column");
assert.match(admin, /setInterval\(\(\)=>\{/u, "Education request dashboard must poll for new submissions");
assert.match(admin, /document\.visibilityState!=="visible"/u, "Dashboard polling must pause in hidden tabs");
assert.match(admin, /التحديث التلقائي كل 30 ثانية/u, "Dashboard must disclose its refresh cadence");
assert.match(admin, /const registrationRefreshWait=setInterval\(/u, "Student registrations must load after the admin session is ready");
assert.match(admin, /option value="early_childhood">مرحلة الطفولة المبكرة/u, "Admin registration must support early-childhood stage");
assert.match(admin, /early_childhood:\["الحضانة","تمهيدي 1 KG1","تمهيدي 2 KG2","تمهيدي 3 KG3"\]/u, "Admin registration must include all early-childhood grade choices");
assert.match(admin, /loadRegistrations\(\{silent:true\}\)/u, "Student registration list must receive read-only refreshes");

const feeApi = read("api/education/service-fees.js");
assert.match(feeApi, /approvedFees/u, "Fee API must return the approved fee catalog only");
assert.doesNotMatch(feeApi, /FROM education\.service_fee_items/u, "Public fee API must not expose unapproved legacy fee rows");
assert.match(index, /لا تُعرض أو تُحصّل أي رسوم أخرى غير البنود المعتمدة/u, "Forms must disclose that only approved fees apply");
assert.match(index, /<html lang="ar" dir="rtl">/u, "Homepage must remain Arabic RTL");
const manifestCacheVersion = index.match(/app\.webmanifest\?v=([\w-]+)/u)?.[1];
const serviceWorkerCacheVersion = index.match(/sw\.js\?v=([\w-]+)/u)?.[1];
assert(manifestCacheVersion, "Manifest must have a cache-busting version");
assert(serviceWorkerCacheVersion, "Service worker must have a cache-busting version");
assert.equal(manifestCacheVersion, serviceWorkerCacheVersion, "Manifest and service-worker cache-busters must stay aligned");

for (const label of ["الطفولة والتأسيس","التعليم الأساسي والعام","التعليم الجامعي والعالي","التدريب المهني والتقني","القرآن والإسلامية","التقوية والعربية والتأهيل","الإرشاد الأكاديمي"]) {
  assert(index.includes(label), "Missing educational scope: " + label);
}
const templates = read("operations-templates.html");
const ids = [...templates.matchAll(/\{id:"([^"]+)",g:/gu)].map(match => match[1]);
assert.equal(ids.length, 39, "Expected 39 operational templates");
assert.equal(new Set(ids).size, ids.length, "Operational template IDs must be unique");
assert.match(templates, /30 حصة أسبوعيًا لكل فرد/u, "Weekly teaching-load invariant missing");
for (const branch of ["القوزين","النزلة الشرقية","صبيا","أبو عريش","المناطق الحدودية"]) assert(templates.includes(branch), "Missing branch: " + branch);

const sitemap = read("sitemap.xml");
assert(!sitemap.includes("/privacy.html"), "Draft privacy policy must not be listed in sitemap");
assert(!sitemap.includes("/terms.html"), "Draft terms must not be listed in sitemap");
const sitemapUrls = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/gu)].map(match => match[1]);
assert.equal(sitemapUrls.length, new Set(sitemapUrls).size, "Sitemap URLs must be unique");
for (const file of ["privacy.html", "terms.html"]) {
  const html = read(file);
  assert.match(html, /<meta name="robots" content="noindex,follow">/u, file + " must stay out of search while draft");
  assert.match(html, /مسودة/u, file + " must clearly identify itself as a draft");
}
const zoom = read("lib/zoom-meetings.js");
assert.match(zoom, /is_center_management_admin/u, "Zoom route must enforce administrator role");
assert.match(zoom, /ADMIN_AUTH_REQUIRED/u, "Zoom route must fail closed without admin authorization");
assert(!zoom.includes("start_url"), "Meeting handler must not expose host start_url");
assert.match(read("vercel.json"), /\/api\/zoom\/meetings/u, "Zoom route rewrite missing");
for (const file of ["student.html","teacher.html","parent.html","admin.html"]) assert(read(file).includes("noindex"), "Role page should stay excluded from indexing: " + file);
const earlyLearning = read("early-learning.html");
const generalEducation = read("general-education.html");
const higherEducation = read("higher-education.html");
const internationalEducation = read("international-education.html");
const registrationApi = read("api/education/registrations.js");
const adminRegistrationApi = read("api/education/admin-registrations.js");
const serviceRequestsApi = read("api/education/service-requests.js");
const curriculumMigration = read("database/migrations/20261103_curriculum_and_payment_tracks.sql");
assert.match(index, /id="curriculum-model"/u, "Homepage must provide curriculum reference selection");
assert.match(index, /مرجع تعليمي واحد داخل منظومة موحدة/u, "Homepage must describe one unified education system");
assert.match(index, /curriculum_reference/u, "Homepage forms must collect the curriculum reference");
assert.match(index, /curriculum_country/u, "Homepage forms must collect the curriculum country where applicable");
for (const [label, source] of [["early learning", earlyLearning], ["general education", generalEducation], ["higher education", higherEducation]]) {
  assert.match(source, /خيارات التعليم الإلكتروني/u, label + " must include the e-learning modes");
  assert.match(source, /شهادات/u, label + " must include semester certificate/assessment information");
}
assert.match(index, /رسوم الزي والكتب/u, "Early learning must show the approved uniform and books fee");
assert.match(index, /1050:1050|1050/u, "Early learning term fee must be available");
assert.match(index, /2100:2100|2100/u, "Nursery and KG1 annual fee must be available");
assert.match(index, /1800:1800|1800/u, "KG2 and KG3 annual fee must be available");
assert.match(generalEducation, /المنهج السعودي/u, "General education must reference Saudi curriculum plans and records");
assert.doesNotMatch(higherEducation, /التوجيه/u, "Higher education page must not use the guidance wording");
assert.match(higherEducation, /مباشر/u, "Higher education must describe direct teaching");
assert.match(higherEducation, /مسجل/u, "Higher education must describe recorded teaching");
assert.match(higherEducation, /تفاعلي/u, "Higher education must describe interactive teaching");
assert.match(higherEducation, /عملي/u, "Higher education must describe practical teaching");
assert.match(registrationApi, /curriculum_track, curriculum_country, curriculum_reference, tuition_period, installment_count, payment_plan/u, "Student registration must persist curriculum reference and approved fee period selections");
assert.match(serviceRequestsApi, /payload\.curriculum_country = curriculumTrack === "saudi_curriculum"/u, "University requests must persist a normalized curriculum country");
assert.match(index, /requestedCurriculum=new URLSearchParams/u, "Registration links must preselect the requested curriculum track");
assert.match(adminRegistrationApi, /curriculum_track, curriculum_country, payment_plan/u, "Admin registration must expose curriculum and payment selections");
assert.match(curriculumMigration, /education_student_registrations_curriculum_idx/u, "Curriculum migration must index the selected curriculum reference");
assert.match(index, /data-key="tuition_period"/u, "Student registration form must capture term or annual tuition period");
assert.match(index, /data-key="installment_count"/u, "Student registration form must capture two or three installments");
assert.doesNotMatch(index, /data-key="payment_plan"/u, "Legacy early-childhood-only monthly payment field must be removed");
const earlyFeesMigration = read("database/migrations/20261103_early_childhood_fee_items.sql");
assert.match(index, /has_existing_file/u, "Student registration must declare whether a prior file exists");
assert.match(index, /rule\.applies_when==="no_existing_file"/u, "File-opening fee must be hidden when a prior file exists");
assert.match(registrationApi, /has_existing_file/u, "Registration API must persist prior-file status");
assert.match(adminRegistrationApi, /has_existing_file/u, "Admin registration API must expose prior-file status");
assert.match(admin, /x\.has_existing_file===true/u, "Admin registration list must display prior-file status");
const approvedFeeMigration = read("database/migrations/20261104_unified_curriculum_and_approved_fees.sql");
assert.match(approvedFeeMigration, /SET is_active = false/u, "Unapproved legacy fees must be disabled by the approved fee migration");
assert.match(approvedFeeMigration, /150\.00/u, "Approved monthly educational subscription must be 150 SAR");
assert.match(approvedFeeMigration, /100\.00/u, "Approved new-file opening fee must be 100 SAR");
assert.match(approvedFeeMigration, /200\.00/u, "Approved conditional assessment/equivalency fee must be 200 SAR");
assert.match(approvedFeeMigration, /2700\.00/u, "Approved annual diploma/bachelor fee must be 2700 SAR");
assert.match(approvedFeeMigration, /3000\.00/u, "Approved annual graduate fee must be 3000 SAR");
assert.match(approvedFeeMigration, /التعليم الجامعي والدراسات العليا/u, "University service must use the approved package name");
assert.match(index, /التعليم الجامعي والدراسات العليا/u, "Homepage must use the approved higher education package name");
assert.doesNotMatch(index + packages, /التوجيه والقبول الجامعي|القبول الجامعي والعالي|فتح مجال التعليم الجامعي/u, "Old higher education labels must be removed");
assert.match(internationalEducation, /id="early-childhood"/u, "Multi-country curriculum page must include early-childhood pathway");
assert.match(internationalEducation, /id="general"/u, "Multi-country curriculum page must include general-education pathway");
assert.match(internationalEducation, /id="higher"/u, "Multi-country curriculum page must include higher-education pathway");
assert.match(internationalEducation, /خيارات التعليم الإلكتروني/u, "Multi-country curriculum page must include all online learning modes");

console.log("Readiness source checks passed: required pages, Arabic RTL, seven scopes, 39 templates, branches, fixed weekly load, sitemap, draft-policy indexing, Zoom authorization, and coordinated versions.");
