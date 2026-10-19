import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const hubUrl = "https://dar-alirtiqaa-business-portal.vercel.app/";
const workspaceFiles = [
  { file: "business-health-app/index.html", key: "alirtiqaa_business_health_local_v1", url: "https://dar-alirtiqaa-health-operations.vercel.app/" },
  { file: "business-public-services-app/index.html", key: "alirtiqaa_business_public_services_local_v1", url: "https://dar-alirtiqaa-public-services-operations.vercel.app/" },
  { file: "business-cards-app/index.html", key: "alirtiqaa_business_cards_local_v1", url: "https://dar-alirtiqaa-cards-operations.vercel.app/" }
];
const hub = read("business-portal/index.html");
const home = read("index.html");
const eduTemplates = read("operations-templates.html");
const serviceWorker = read("sw.js");
const sitemap = read("sitemap.xml");
const telegram = read("api/telegram.js");

assert.match(hub, /<meta name="robots" content="noindex,nofollow">/u);
assert.equal((hub.match(/<a\b[^>]*href="/gu) || []).length, 3, "Business hub must link only to the three isolated workspaces");
for (const workspace of workspaceFiles) {
  assert(hub.includes('href="' + workspace.url + '"'), "Business hub missing independent origin for " + workspace.file);
  assert(fs.existsSync(path.join(root, workspace.file)), "Missing isolated workspace root: " + workspace.file);
  const html = read(workspace.file);
  assert.match(html, /<meta name="robots" content="noindex,nofollow">/u, "Workspace must not be indexed: " + workspace.file);
  assert.match(html, /__NEVER__/, "placeholder guard");
  const storageKey = html.match(/const STORAGE_KEY = "([^"]+)"/u)?.[1];
  assert.equal(storageKey, workspace.key, "Storage key mismatch: " + workspace.file);
  assert.equal((html.match(/<a\b[^>]*href="/gu) || []).length, 1, "Workspace must have one navigation link only: " + workspace.file);
  assert(html.includes('href="' + hubUrl + '"'), "Workspace return link must go only to business hub: " + workspace.file);
  assert.doesNotMatch(html, /\bfetch\s*\(|XMLHttpRequest|\/api\/|api\/education/iu, "Workspace must not call API endpoints: " + workspace.file);
  assert.doesNotMatch(html, /t\.me\/|whatsapp|facebook\.com|instagram\.com|mailto:|tel:|zoom\.us/iu, "Workspace must not reuse shared communication channels or integrations: " + workspace.file);
}
assert.equal(new Set(workspaceFiles.map(item => item.key)).size, workspaceFiles.length, "Workspace browser storage keys must be distinct");
assert.equal((home.match(/href="businesses\.html"/gu) || []).length, 1, "Education homepage must provide exactly one entry point to the business portal");
assert.doesNotMatch(home, /href="business-(?:health|public-services|cards)(?:-app)?(?:\.html|\/)/u, "Education homepage must not link to individual business activities");
assert.doesNotMatch(eduTemplates, /businesses\.html|id="business"|id:"health"|id:"public-services"|id:"cards"/u, "Education template library must not link to or include business records");
assert.doesNotMatch(serviceWorker, /businesses\.html|business-health-app|business-public-services-app|business-cards-app/u, "Education offline shell must not cache business workspaces");
assert.doesNotMatch(sitemap, /businesses\.html|business-health-app|business-public-services-app|business-cards-app/u, "Business portal/workspaces must not be included in education sitemap");
assert.doesNotMatch(telegram, /CHANNEL_ID|@DarAlIrtiqaAlFikri|t\.me\/DarAlIrtiqaAlFikri|whatsapp\.com|facebook\.com|canPostMessages|sendVideo.*CHANNEL/u, "Education bot must not reuse the institutional broadcast channel");
assert.match(telegram, /scope: "education-only"/u, "Telegram diagnostic must identify its educational-only scope");
assert.doesNotMatch(telegram, /chat_id:\s*CHANNEL_ID/u, "Telegram webhook must not broadcast to a shared institutional channel");
console.log("Business isolation checks passed: separate origin targets, independent local storage keys, no cross-activity links, no education template/PWA/sitemap links, and an education-only Telegram bot.");
