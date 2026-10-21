import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const requiredFiles = [
  "index.html", "businesses.html", "education-packages.html", "admin.html",
  "portal.html", "student.html", "teacher.html", "parent.html", "reports.html",
  "brochure.html", "privacy.html", "terms.html", "operations-templates.html",
  "zoom-operations.html", "app.webmanifest", "sw.js", "capacitor.config.ts",
  "supabase/migrations/20261021_guardian_portal_read_only_access.sql",
  ".github/workflows/android-official-release.yml", "docs/OFFICIAL_RELEASE_CHECKLIST.md"
  ".github/workflows/android-official-release.yml", "docs/OFFICIAL_RELEASE_CHECKLIST.md",
  "docs/DAILY_ROLLOUT_AND_TEACHING_OPERATIONS_2026_2027.md"
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
assert.match(read("sw.js"), /const CACHE_NAME\s*=\s*"dar-alirtiqaa-v\d+\.\d+\.\d+"/u, "Service worker cache key must have a valid independent semantic version");
const android = read(".github/workflows/android-apk.yml");
assert.match(android, /versionCode 11/u, "Android versionCode mismatch");
assert.match(android, /versionName "1\.1\.7"/u, "Android versionName mismatch");
assert(android.includes("Upload Debug APK (testing only)"), "Debug builds must be labeled as test-only");
assert(android.includes("name: dar-alirtiqaa-android-debug-v1.1.7"), "Debug builds must be clearly labeled as test artifacts");
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
assert.match(feeApi, /calculation_method/u, "Fee API must expose pricing method metadata");
assert.match(index, /const displayFees=\[\.\.\.fees,\.\.\.unpricedFees\]/u, "Unpriced quote and conditional fee items must remain visible");
assert.match(index, /يُحدد بعرض سعر عند الحاجة/u, "Quoted fees must be shown without inventing an amount");
assert.match(index, /غير محدد — يتطلب تأكيد الإدارة/u, "Unconfigured fee amounts must be flagged for management review");
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
console.log("Readiness source checks passed: required pages, Arabic RTL, seven scopes, 39 templates, branches, fixed weekly load, sitemap, draft-policy indexing, Zoom authorization, and coordinated versions.");
