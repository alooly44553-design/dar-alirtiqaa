import assert from "node:assert/strict";

const base = (process.env.PRODUCTION_BASE_URL || "https://alirtiqaa-educational-platform.vercel.app").replace(/\/+$/, "");
const results = [];

async function get(path) {
  const response = await fetch(base + path, {
    method: "GET",
    redirect: "follow",
    signal: AbortSignal.timeout(20000),
    headers: { "accept": "application/json, text/html, application/xml, text/plain, */*" }
  });
  const body = await response.text();
  return { response, body };
}

async function check(name, operation) {
  const start = Date.now();
  try {
    const detail = await operation();
    results.push({ name, ok: true, ms: Date.now() - start, detail: detail || "" });
    console.log("PASS", name, detail ? "— " + detail : "");
  } catch (error) {
    results.push({ name, ok: false, ms: Date.now() - start, error: error?.message || String(error) });
    console.error("FAIL", name, "—", error?.message || error);
  }
}

const htmlPages = [
  "/", "/brochure.html", "/education-packages.html", "/businesses.html",
  "/early-learning.html", "/general-education.html", "/higher-education.html",
  "/international-education.html", "/languages-communication.html",
  "/quran-islamic-studies.html", "/academic-support.html",
  "/digital-technology.html", "/vocational-training.html",
  "/teacher-development.html", "/academic-career-guidance.html",
  "/lifelong-learning.html", "/operations-templates.html", "/zoom-operations.html",
  "/admin.html", "/portal.html", "/student.html", "/teacher.html", "/parent.html",
  "/reports.html", "/privacy.html", "/terms.html"
];

for (const path of htmlPages) {
  await check("page " + path, async () => {
    const { response, body } = await get(path);
    assert.equal(response.status, 200, "expected HTTP 200, got " + response.status);
    assert.match(body, /<html\b/i, "response did not contain an HTML document");
    return "HTTP 200";
  });
}

for (const path of ["/app.webmanifest", "/sw.js", "/robots.txt", "/sitemap.xml", "/logo.svg", "/icon.svg"]) {
  await check("asset " + path, async () => {
    const { response, body } = await get(path);
    assert.equal(response.status, 200, "expected HTTP 200, got " + response.status);
    assert.ok(body.length > 0, "empty response body");
    if (path === "/app.webmanifest") {
      const manifest = JSON.parse(body);
      assert.match(String(manifest.name || ""), /دار الإرتقاء|دار الارتقاء/);
      assert.ok(manifest.start_url, "manifest missing start_url");
    }
    if (path === "/sitemap.xml") assert.match(body, /<urlset\b/i);
    if (path === "/robots.txt") assert.match(body, /Sitemap:/i);
    return "HTTP 200";
  });
}

await check("education database health", async () => {
  const { response, body } = await get("/api/education/status");
  assert.equal(response.status, 200);
  const data = JSON.parse(body);
  assert.equal(data.ok, true);
  assert.equal(data.database, "connected");
  return "Neon connected";
});

await check("education service catalog", async () => {
  const { response, body } = await get("/api/education/services");
  assert.equal(response.status, 200);
  const data = JSON.parse(body);
  assert.equal(data.ok, true);
  assert.ok(Array.isArray(data.services) && data.services.length >= 7);
  const codes = new Set(data.services.map(item => item.service_code));
  assert.ok(codes.has("student_registration"), "student_registration missing");
  assert.ok(codes.has("general_service"), "general_service missing");
  return data.services.length + " services";
});

for (const path of ["/api/education/registrations", "/api/education/service-requests"]) {
  await check("write API rejects GET " + path, async () => {
    const { response } = await get(path);
    assert.equal(response.status, 405, "expected GET to be rejected with 405");
    assert.match(response.headers.get("allow") || "", /POST/i, "expected Allow: POST");
    return "405; POST only";
  });
}

await check("Telegram webhook configuration", async () => {
  const { response, body } = await get("/api/telegram");
  assert.equal(response.status, 200);
  const data = JSON.parse(body);
  assert.equal(data.ok, true);
  assert.equal(data.configured, true);
  assert.equal(data.destination, "@DarAlIrtiqaAlFikri");
  return "webhook endpoint configured";
});

await check("Telegram bot and AI runtime diagnostics", async () => {
  const { response, body } = await get("/api/telegram?diagnose=1");
  assert.equal(response.status, 200);
  const data = JSON.parse(body);
  assert.equal(data.botTokenValid, true);
  assert.equal(data.botIsAdmin, true);
  assert.equal(data.canPostMessages, true);
  assert.equal(data.aiGatewayAuthAvailable, true);
  return "bot valid; channel posting enabled; AI Gateway auth available";
});

const failed = results.filter(result => !result.ok);
console.log(JSON.stringify({
  base,
  checkedAt: new Date().toISOString(),
  total: results.length,
  passed: results.length - failed.length,
  failed: failed.length
}, null, 2));

if (failed.length) process.exitCode = 1;
