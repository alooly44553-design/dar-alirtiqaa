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
  "business-portal/index.html", "business-health-app/index.html",
  "business-public-services-app/index.html", "business-cards-app/index.html",
  "lib/telegram-scope.js", "tests/business-isolation.test.js"
];
for (const file of requiredFiles) assert(fs.existsSync(path.join(root, file)), "Missing required platform file: " + file);

const packageJson = JSON.parse(read("package.json"));
const manifest = JSON.parse(read("app.webmanifest"));
const appName = "منظومة مدارس ومراكز دار الإرتقاء الفكري التعليمية";
assert.equal(packageJson.version, "1.1.3", "Package version must match intended release");
assert.equal(manifest.version, packageJson.version, "Manifest and package versions differ");
assert.equal(manifest.name, appName, "PWA display name mismatch");
assert.equal(manifest.short_name, appName, "PWA short name mismatch");
assert.match(read("capacitor.config.ts"), /appName:\s*'منظومة مدارس ومراكز دار الإرتقاء الفكري التعليمية'/u, "Capacitor appName mismatch");
assert.match(read("sw.js"), /dar-alirtiqaa-v1\.1\.3/u, "Service worker cache key was not bumped");
const android = read(".github/workflows/android-apk.yml");
assert.match(android, /versionCode 7/u, "Android versionCode mismatch");
assert.match(android, /versionName "1\.1\.3"/u, "Android versionName mismatch");

const index = read("index.html");
assert.match(index, /<html lang="ar" dir="rtl">/u, "Homepage must remain Arabic RTL");
assert.match(index, /app\.webmanifest\?v=20261019-5/u, "Manifest cache version mismatch");
assert.match(index, /sw\.js\?v=20261019-5/u, "Service worker cache version mismatch");
for (const label of ["الطفولة والتأسيس","التعليم الأساسي والعام","التعليم الجامعي والعالي","التدريب المهني والتقني","القرآن والإسلامية","التقوية والعربية والتأهيل","الإرشاد الأكاديمي"]) {
  assert(index.includes(label), "Missing educational scope: " + label);
}
const templates = read("operations-templates.html");
const ids = [...templates.matchAll(/\{id:"([^"]+)",g:/gu)].map(match => match[1]);
assert.equal(ids.length, 36, "Expected 36 education-only operational templates");
assert.equal(new Set(ids).size, ids.length, "Operational template IDs must be unique");
assert(!templates.includes('id="business"'), "Education template library must not include a business group");
for (const id of ["health", "public-services", "cards"]) assert(!ids.includes(id), "Business-only template remained in education library: " + id);
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
assert.equal((index.match(/href="businesses\.html"/gu) || []).length, 1, "Homepage must expose one business-portal entry only");
assert(!read("sw.js").includes("businesses.html"), "Business pages must not be cached in the education app shell");
assert(!sitemap.includes("businesses.html"), "Business portal must not be in education sitemap");
assert(!templates.includes("businesses.html"), "Education template navigation must not point into business areas");
const scope = read("lib/telegram-scope.js");
assert.match(scope, /isBusinessOperationsRequest/u, "Telegram must include a business-scope guard");
assert.match(scope, /isEducationPlatformRequest/u, "Telegram must include an educational-context guard");
const telegram = read("api/telegram.js");
assert.match(telegram, /scope: "education-only"/u, "Telegram API must identify an education-only scope");
assert(!telegram.includes("CHANNEL_ID"), "Telegram assistant must not use a shared public channel destination");
const telegramAssistant = read("lib/telegram-assistant.js");
assert.match(telegramAssistant, /scope = 'education'/u, "Telegram conversation/task/video access must be scope-filtered");
const scopeMigration = read("database/neon/migrations/20261019_telegram_education_scope.sql");
assert.match(scopeMigration, /DEFAULT 'unclassified'/u, "Legacy Telegram rows must be left unclassified");
assert.match(scopeMigration, /telegram_video_jobs/u, "Video-job scope migration missing");
const zoom = read("lib/zoom-meetings.js");
assert.match(zoom, /is_center_management_admin/u, "Zoom route must enforce administrator role");
assert.match(zoom, /ADMIN_AUTH_REQUIRED/u, "Zoom route must fail closed without admin authorization");
assert(!zoom.includes("start_url"), "Meeting handler must not expose host start_url");
assert.match(read("vercel.json"), /\/api\/zoom\/meetings/u, "Zoom route rewrite missing");
for (const file of ["student.html","teacher.html","parent.html","admin.html"]) assert(read(file).includes("noindex"), "Role page should stay excluded from indexing: " + file);
console.log("Readiness source checks passed: education pages, Arabic RTL, seven scopes, 36 education templates, business separation, fixed weekly load, sitemap, draft-policy indexing, Zoom authorization, and version consistency.");
