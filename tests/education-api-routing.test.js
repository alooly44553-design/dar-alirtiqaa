import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const config = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));
const services = readFileSync(new URL("../api/education/services.js", import.meta.url), "utf8");
const statusPath = new URL("../api/education/status.js", import.meta.url);

assert.ok(config.rewrites.some(route => route.source === "/api/education/status" && route.destination === "/api/education/services?health=1"), "legacy education status URL must route to the consolidated education API");
assert.match(services, /req\.query\?\.health === "1"/u, "education services API must expose the health-check mode");
assert.match(services, /SELECT 1 AS ok/u, "health-check mode must verify the database connection");
assert.equal(existsSync(statusPath), false, "duplicate education status serverless function must be removed");

console.log("Education API route consolidation checks passed.");
