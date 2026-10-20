import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";

const baseUrl = (process.env.BASE_URL || "https://alirtiqaa-educational-platform.vercel.app").replace(/\/+$/u, "");
const targetName = "منظومة مدارس ومراكز دار الإرتقاء الفكري التعليمية";
let manifest = null;
let lastObservation = "no response";

for (let attempt = 1; attempt <= 18; attempt++) {
  try {
    const response = await fetch(baseUrl + "/app.webmanifest?v=20261019-5", {
      cache: "no-store",
      signal: AbortSignal.timeout(6000)
    });
    if (response.ok) {
      const candidate = await response.json();
      if (candidate.version === "1.1.3" && candidate.name === targetName && candidate.short_name === targetName) {
        manifest = candidate;
        break;
      }
      lastObservation = "manifest served, but release metadata has not propagated yet";
    } else {
      lastObservation = "manifest HTTP " + response.status;
    }
  } catch (error) {
    lastObservation = error?.name || "network error";
  }
  await delay(7000);
}
assert(manifest, "New production manifest did not become available in time: " + lastObservation);

async function getText(route) {
  const response = await fetch(baseUrl + route, {
    cache: "no-store",
    signal: AbortSignal.timeout(10000)
  });
  assert.equal(response.status, 200, route + " must return HTTP 200");
  return await response.text();
}
async function getJson(route) {
  const response = await fetch(baseUrl + route, {
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(15000)
  });
  assert.equal(response.status, 200, route + " must return HTTP 200");
  return await response.json();
}

const home = await getText("/");
assert.match(home, /<html lang="ar" dir="rtl">/u, "Homepage must remain Arabic RTL");
assert.match(home, /app\.webmanifest\?v=20261019-5/u, "Homepage must reference the current PWA manifest");
assert.match(home, /sw\.js\?v=20261019-5/u, "Homepage must reference the current service worker");
await getText("/businesses.html");
await getText("/operations-templates.html");

const sitemapText = await getText("/sitemap.xml");
assert(!sitemapText.includes("/privacy.html"), "Draft privacy policy must not be listed in the sitemap");
assert(!sitemapText.includes("/terms.html"), "Draft terms must not be listed in the sitemap");
const sitemapUrls = [...sitemapText.matchAll(/<loc>(.*?)<\/loc>/gu)].map(match => match[1]);
assert(sitemapUrls.length > 0, "Sitemap must contain public URLs");
assert.equal(sitemapUrls.length, new Set(sitemapUrls).size, "Sitemap URLs must be unique");

const catalog = await getJson("/api/education/services");
assert.equal(catalog.ok, true, "Education service catalog must report ok=true");
assert(Array.isArray(catalog.services) && catalog.services.length > 0, "Education service catalog must be nonempty");

const telegram = await getJson("/api/telegram?diagnose=1");
assert.equal(telegram.ok, true, "Telegram diagnostic must report ok=true");
assert.equal(telegram.configured, true, "Telegram bot must be configured");
assert(telegram.botUsername, "Telegram diagnostic must identify the validated bot without revealing its token");
assert.equal(telegram.aiGatewayAuthAvailable, true, "AI Gateway authentication must be available in the runtime");
console.log("Production smoke test passed: v1.1.3 manifest, Arabic RTL homepage, public pages, unique sitemap without draft policies, service catalog, and Telegram/AI Gateway readiness signal.");
