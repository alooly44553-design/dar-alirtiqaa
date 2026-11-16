import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const api = readFileSync(new URL("../api/education/service-requests.js", import.meta.url), "utf8");
const insertStart = api.indexOf("await sql`\n      INSERT INTO education.service_requests");
assert.notEqual(insertStart, -1, "public service request insert must exist");
const insertEnd = api.indexOf("`;", insertStart);
assert.notEqual(insertEnd, -1, "public service request insert must terminate");
const insertSql = api.slice(insertStart, insertEnd);

assert.match(api, /app_role: "public_service_request"/u,
  "public intake must use the restricted public-service role");
assert.doesNotMatch(insertSql, /RETURNING\b/iu,
  "public intake must not use INSERT RETURNING because SELECT is admin-only under RLS");
assert.match(api, /request: \{ request_number: requestNumber, status: "new", created_at: submittedAt \}/u,
  "public response must use the server-generated receipt fields without selecting protected rows");
assert.doesNotMatch(api, /request: rows\[0\]/u,
  "public response must not depend on a row returned through the admin-only SELECT policy");

console.log("Education public request RLS compatibility checks passed.");
