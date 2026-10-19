import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const requiredFiles = [
  "index.html", "businesses.html", "education-packages.html", "admin.html",
  "portal.html", "student.html", "teacher.html", "parent.html", "reports.html",
  "brochure.html", "privacy.html", "terms.html", "operations-templates.html",
  "zoom-operations.html", "app.webmanifest", "sw.js", "capacitor.config.ts"
];
for (const file of requiredFiles) {
  assert(fs.existsSync(path.join(root, file)), "Missing required platform file: " + file);
}

const packageJson = JSON.parse(read("package.json"));
const manifest = JSON.parse(read("app.webmanifest"));
const appName = "منظومة مدارس ومراكز دار الإرتقاء الفكري التعليمية";
assert.equal(packageJson.version, "1.1.3", "Package version must match intended release");
assert.equal(manifest.version, packageJson.version, "Web manifest and package versions differ");
assert.equal(manifest.name, appName, "PWA display name mismatch");
assert.equal(manifest.short_name, appName, "PWA short name mismatch");
assert.match(read("capacitor.config.ts"), /appName:\s*'منظومة مدارس ومراكز دار الإرتقاء الفكري التعليمية'/u, "Capacitor appName mismatch");
assert.match(read("sw.js"), /dar-alirtiqaa-v1\.1\.3/u, "Service worker cache key was not bumped");
const android = read(".github/workflows/android-apk.yml");
assert.match(android, /versionCode 7/u, "Android versionCode mismatch");
assert.match(android, /versionName "1\.1\.3"/u, "Android versionName mismatch");

const index = read("index.html");
assert.match(index, /<html lang="ar" dir="rtl">/u, "Homepage must remain Arabic RTL");
assert.match(index, /app\.webmanifest\?v=20261019-5/u, "Homepage manifest cache version mismatch");
assert.match(index, /sw\.js\?v=20261019-5/u, "Homepage service worker cache version mismatch");
const scopeLabels = [
  "الطفولة والتأسيس", "التعليم الأساسي والعام", "التعليم الجامعي والعالي",
  "التدريب المهني والتقني", "القرآن والإسلامية", "التقوية والعربية والتأهيل",
  "الإرشاد الأكاديمي"
];
for (const label of scopeLabels) assert(index.includes(label), "Missing educational scope: " + label);

const templates = read("operations-templates.html");
const ids = [...templates.matchAll(/\{id:"([^"]+)",g:/gu)].map(match => match[1]);
assert.equal(ids.length, 39, "Expected 39 operational templates");
assert.equal(new Set(ids).size, ids.length, "Operational template IDs must be unique");
assert.match(templates, /30 حصة أسبوعيًا لكل فرد/u, "Weekly teaching-load invariant must remain visible");
for (const branch of ["القوزين", "النزلة الشرقية", "صبيا", "أبو عريش", "المناطق الحدودية"]) {
  assert(templates.includes(branch), "Missing in-person branch: " + branch);
}

const sitemap = read("sitemap.xml");
assert(!sitemap.includes("/privacy.html"), "Draft privacy policy must not be listed in sitemap");
assert(!sitemap.includes("/terms.html"), "Draft terms must not be listed in sitemap");
assert.equal([...sitemap.matchAll(/<loc>/gu)].length, new Set([...sitemap.matchAll(/<loc>(.*?)<\/loc>/gu)].map(match => match[1])).size, "Sitemap URLs must be unique");
for (const file of ["privacy.html", "terms.html"]) {
  const html = read(file);
  assert.match(html, /<meta name="robots" content="noindex,follow">/u, file + " must stay out of search results while draft");
  assert.match(html, /مسودة/u, file + " must clearly identify itself as a draft");
}
const zoom = read("lib/zoom-meetings.js");
assert.match(zoom, /is_center_management_admin/u, "Zoom route must enforce the administrator role");
assert.match(zoom, /ADMIN_AUTH_REQUIRED/u, "Zoom route must fail closed when administrator authorization is missing");
assert(!zoom.includes("start_url"), "Participant-facing meeting handler must not expose host start_url");
assert.match(read("vercel.json"), /\/api\/zoom\/meetings/u, "Zoom public route rewrite is missing");
for (const name of ["student.html", "teacher.html", "parent.html", "admin.html"]) {
  assert(read(name).includes("noindex"), "Role page should remain excluded from indexing: " + name);
}
console.log("Readiness source checks passed: required pages, Arabic RTL, seven scopes, 39 templates, branches, fixed weekly load, draft-policy indexing, Zoom authorization, and version consistency.");
