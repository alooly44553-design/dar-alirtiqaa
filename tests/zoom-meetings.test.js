import assert from "node:assert/strict";
import { handleZoomMeetings } from "../lib/zoom-meetings.js";

const requiredKeys = [
  "ZOOM_ACCOUNT_ID",
  "ZOOM_CLIENT_ID",
  "ZOOM_CLIENT_SECRET",
  "ZOOM_HOST_USER_ID"
];
for (const [index, key] of requiredKeys.entries()) {
  process.env[key] = ["test-account-id", "test-client-id", "test-client-secret", "host@example.test"][index];
}
process.env.SUPABASE_URL = "https://supabase.example.test";
process.env.SUPABASE_PUBLISHABLE_KEY = "test-publishable-key";

function responseSink() {
  return {
    code: 200,
    payload: null,
    headers: {},
    setHeader(key, value) { this.headers[key] = value; },
    status(code) { this.code = code; return this; },
    json(payload) { this.payload = payload; return this; }
  };
}

function request({ token = "admin-session", url = "/api/zoom/meetings?check_connection=1" } = {}) {
  return {
    method: "GET",
    url,
    headers: token ? { authorization: "Bearer " + token } : {},
    body: undefined
  };
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

function installFetchMock({ isAdmin = true, tokenStatus = 200, scope = "meeting:write:meeting:admin" } = {}) {
  const calls = [];
  globalThis.fetch = async (input, init = {}) => {
    const url = String(input);
    calls.push({ url, init });
    if (url.endsWith("/auth/v1/user")) {
      return jsonResponse({ id: "00000000-0000-4000-8000-000000000001", email: "admin@example.test" });
    }
    if (url.endsWith("/rest/v1/rpc/is_center_management_admin")) return jsonResponse(isAdmin);
    if (url.startsWith("https://zoom.us/oauth/token")) {
      if (tokenStatus !== 200) return jsonResponse({ reason: "invalid_client" }, tokenStatus);
      return jsonResponse({ access_token: "fake-access-token-not-for-production", token_type: "bearer", expires_in: 3600, scope });
    }
    throw new Error("Unexpected outbound request in test: " + url);
  };
  return calls;
}

// No session must be rejected before any external request is made.
{
  const calls = [];
  globalThis.fetch = async input => {
    calls.push(String(input));
    throw new Error("Unauthenticated request must not make network calls");
  };
  const res = responseSink();
  await handleZoomMeetings(request({ token: "" }), res);
  assert.equal(res.code, 401);
  assert.equal(res.payload.error, "ADMIN_AUTH_REQUIRED");
  assert.equal(calls.length, 0);
}

// A valid Supabase session without the administrator role must not request a Zoom token.
{
  const calls = installFetchMock({ isAdmin: false });
  const res = responseSink();
  await handleZoomMeetings(request(), res);
  assert.equal(res.code, 401);
  assert.equal(res.payload.error, "ADMIN_AUTH_REQUIRED");
  assert.equal(calls.some(call => call.url.startsWith("https://zoom.us/oauth/token")), false);
}

// Missing production configuration is reported without attempting OAuth.
{
  const calls = installFetchMock();
  const previous = process.env.ZOOM_CLIENT_SECRET;
  process.env.ZOOM_CLIENT_SECRET = "";
  try {
    const res = responseSink();
    await handleZoomMeetings(request(), res);
    assert.equal(res.code, 503);
    assert.equal(res.payload.error, "ZOOM_NOT_CONFIGURED");
    assert.deepEqual(res.payload.missing, ["ZOOM_CLIENT_SECRET"]);
    assert.equal(calls.some(call => call.url.startsWith("https://zoom.us/oauth/token")), false);
  } finally {
    process.env.ZOOM_CLIENT_SECRET = previous;
  }
}

// OAuth verification must return only a connection/scope result, never tokens or credentials.
{
  const calls = installFetchMock({ scope: "meeting:write:meeting:admin,meeting:read:meeting:admin" });
  const res = responseSink();
  await handleZoomMeetings(request(), res);
  assert.equal(res.code, 200);
  assert.equal(res.payload.ok, true);
  assert.equal(res.payload.connection.oauth, "connected");
  assert.equal(res.payload.connection.required_scope, "meeting:write:meeting:admin");
  assert.equal(res.payload.connection.scope_verified, true);
  assert(!JSON.stringify(res.payload).includes("fake-access-token-not-for-production"));
  assert(!JSON.stringify(res.payload).includes("test-client-secret"));
  const oauth = calls.find(call => call.url.startsWith("https://zoom.us/oauth/token"));
  assert(oauth, "OAuth token endpoint should be called for the connection check");
  assert.equal(oauth.init.method, "POST");
  assert.equal(oauth.init.headers.Authorization, "Basic " + Buffer.from("test-client-id:test-client-secret").toString("base64"));
  assert.equal(calls.some(call => call.url.startsWith("https://api.zoom.us/")), false, "connection check must not create or edit a meeting");
}

// If the OAuth response reports no meeting-creation scope, the UI must be able to disable creation.
{
  installFetchMock({ scope: "user:read:user:admin" });
  const res = responseSink();
  await handleZoomMeetings(request(), res);
  assert.equal(res.code, 200);
  assert.equal(res.payload.connection.scope_verified, false);
}

// Invalid OAuth credentials must fail closed with a stable, non-sensitive error.
{
  installFetchMock({ tokenStatus: 401 });
  const previousError = console.error;
  console.error = () => {};
  try {
    const res = responseSink();
    await handleZoomMeetings(request(), res);
    assert.equal(res.code, 502);
    assert.equal(res.payload.error, "ZOOM_AUTH_FAILED");
    assert(!JSON.stringify(res.payload).includes("test-client-secret"));
  } finally {
    console.error = previousError;
  }
}

console.log("Zoom OAuth connection tests passed: unauthenticated and non-admin rejection, missing-key guard, token verification, required-scope detection, and no meeting creation.");
