import assert from "node:assert/strict";
import fs from "node:fs";
import { setTimeout as delay } from "node:timers/promises";

const baseUrl = (process.env.BASE_URL || "https://alirtiqaa-educational-platform.vercel.app").replace(/\/+$/u, "");
const targetName = "منظومة مدارس ومراكز دار الإرتقاء الفكري التعليمية";
const expectedVersion = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;
let manifest = null;
let home = null;
let manifestCacheBust = "";
let serviceWorkerCacheBust = "";
let lastObservation = "no response";

for (let attempt = 1; attempt <= 18; attempt++) {
  try {
    const homeResponse = await fetch(baseUrl + "/", {
      cache: "no-store",
      signal: AbortSignal.timeout(6000)
    });
    if (!homeResponse.ok) {
      lastObservation = "homepage HTTP " + homeResponse.status;
      await delay(7000);
      continue;
    }
    const candidateHome = await homeResponse.text();
    const manifestMatch = candidateHome.match(/app\.webmanifest\?v=([\w-]+)/u);
    const workerMatch = candidateHome.match(/sw\.js\?v=([\w-]+)/u);
    if (!manifestMatch || !workerMatch) {
      lastObservation = "homepage is missing a versioned manifest or service-worker URL";
      await delay(7000);
      continue;
    }
    manifestCacheBust = manifestMatch[1];
    serviceWorkerCacheBust = workerMatch[1];
    if (manifestCacheBust !== serviceWorkerCacheBust) {
      lastObservation = "homepage manifest and service-worker cache-busters do not match";
      await delay(7000);
      continue;
    }
    const response = await fetch(baseUrl + "/app.webmanifest?v=" + encodeURIComponent(manifestCacheBust), {
      cache: "no-store",
      signal: AbortSignal.timeout(6000)
    });
    if (response.ok) {
      const candidate = await response.json();
      if (candidate.version === expectedVersion && candidate.name === targetName && candidate.short_name === targetName) {
        manifest = candidate;
        home = candidateHome;
        break;
      }
      lastObservation = "manifest version did not match package.json release " + expectedVersion;
    } else {
      lastObservation = "manifest HTTP " + response.status;
    }
  } catch (error) {
    lastObservation = error?.name || "network error";
  }
  await delay(7000);
}
assert(manifest, "Expected production manifest " + expectedVersion + " did not become available in time: " + lastObservation);

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

assert.match(home, /<html lang="ar" dir="rtl">/u, "Homepage must remain Arabic RTL");
assert(home.includes("app.webmanifest?v=" + manifestCacheBust), "Homepage must reference the manifest cache-buster used by this smoke test");
assert(home.includes("sw.js?v=" + serviceWorkerCacheBust), "Homepage must reference the service-worker cache-buster used by this smoke test");
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
const registrationService = catalog.services.find(service => service.service_code === "student_registration");
assert(registrationService?.id, "Student registration service must remain available");
const feeCatalog = await getJson("/api/education/service-fees?service_id=" + encodeURIComponent(registrationService.id));
assert.equal(feeCatalog.ok, true, "Student registration fee catalog must load");
assert(Array.isArray(feeCatalog.fees), "Fee response must include an array");
assert(feeCatalog.fees.every(fee => typeof fee.calculation_method === "string"), "Fee API must expose its pricing method");
assert.match(home, /يُحدد بعرض سعر عند الحاجة/u, "Homepage must explain fees that require a quote");

const telegram = await getJson("/api/telegram?diagnose=1");
assert.equal(telegram.ok, true, "Telegram diagnostic must report ok=true");
assert.equal(telegram.configured, true, "Telegram bot must be configured");
assert(telegram.botUsername, "Telegram diagnostic must identify the validated bot without revealing its token");
assert.equal(telegram.aiGatewayAuthAvailable, true, "AI Gateway authentication must be available in the runtime");

const invalidWebhook = await fetch(baseUrl + "/api/telegram", {
  method: "POST",
  cache: "no-store",
  signal: AbortSignal.timeout(10000),
  headers: {
    "content-type": "application/json",
    "x-telegram-bot-api-secret-token": "invalid-production-smoke-token"
  },
  body: JSON.stringify({ update_id: 0 })
});
assert.equal(invalidWebhook.status, 401, "Production webhook must reject an invalid Telegram secret");
const invalidWebhookBody = await invalidWebhook.json().catch(() => ({}));
assert.equal(invalidWebhookBody.error, "Unauthorized webhook", "Webhook must return a stable, non-sensitive rejection");
console.log("Production smoke test passed: v" + expectedVersion + " manifest, aligned PWA caches, Arabic RTL homepage, public pages, unique sitemap without draft policies, service catalog, Telegram/AI Gateway readiness, and live invalid-webhook-secret rejection.");
