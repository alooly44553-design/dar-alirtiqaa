import assert from "node:assert/strict";
import handler from "../api/telegram.js";
import { looksLikeTelegramVideoIntent } from "../lib/telegram-assistant.js";

process.env.DAR_ALIRTIQAA_APP = "education";
process.env.TELEGRAM_BOT_TOKEN = "test-bot-token";
process.env.TELEGRAM_WEBHOOK_SECRET = "test-webhook-secret";
delete process.env.DATABASE_URL;
delete process.env.AI_GATEWAY_API_KEY;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

function requestFor(update, secret = "test-webhook-secret") {
  return {
    method: "POST",
    headers: {
      "x-telegram-bot-api-secret-token": secret,
      "x-vercel-oidc-token": "test-oidc-token"
    },
    body: update,
    query: {}
  };
}

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

function message(text, extra = {}) {
  return {
    message: {
      chat: { id: 120045, type: "private" },
      text,
      ...extra
    }
  };
}

function installFetchMock() {
  const calls = [];
  globalThis.fetch = async (input, init = {}) => {
    const url = String(input);
    calls.push({ url, init });
    if (url.includes("/v1/chat/completions")) {
      return json({ choices: [{ message: { content: "أهلًا بك! يسعدني مساعدتك." } }] });
    }
    if (url.includes("/v1/images/generations")) {
      return json({ data: [{ b64_json: Buffer.from("fake-png-data").toString("base64") }] });
    }
    if (url.includes("/v1/audio/transcriptions")) {
      return json({ text: "أريد أفكارًا لنشاط قراءة ممتع للأطفال." });
    }
    if (url.includes("/v1/audio/speech")) {
      return new Response(Buffer.from("fake-audio"), {
        status: 200,
        headers: { "content-type": "audio/mpeg" }
      });
    }
    if (url.includes("/getFile")) {
      return json({ ok: true, result: { file_path: "files/test-attachment.ogg" } });
    }
    if (url.includes("/file/bot")) {
      return new Response(Buffer.from("fake-attachment"));
    }
    if (url.endsWith("/sendMessage") || url.endsWith("/sendPhoto") || url.endsWith("/sendAudio")) {
      return json({ ok: true, result: { message_id: calls.length } });
    }
    throw new Error("Unexpected request in test: " + url);
  };
  return calls;
}

{
  const calls = installFetchMock();
  const res = responseSink();
  await handler(requestFor(message("مرحبًا، أحتاج فكرة نشاط للقراءة للأطفال")), res);
  assert.equal(res.code, 200);
  assert.equal(res.payload?.ok, true);
  assert(calls.some(call => call.url.includes("/v1/chat/completions")));
  assert(calls.some(call => call.url.endsWith("/sendMessage")));
}

{
  const calls = [];
  globalThis.fetch = async (input, init = {}) => {
    const url = String(input);
    calls.push({ url, init });
    if (url.includes("/v1/chat/completions")) {
      if (calls.filter(call => call.url.includes("/v1/chat/completions")).length === 1) {
        return json({ error: { message: "credential rejected" } }, 403);
      }
      return json({ choices: [{ message: { content: "نجح الرد باستخدام بيانات الاعتماد البديلة." } }] });
    }
    if (url.endsWith("/sendMessage")) return json({ ok: true, result: { message_id: calls.length } });
    throw new Error("Unexpected request in auth fallback test: " + url);
  };
  process.env.AI_GATEWAY_API_KEY = "invalid-test-key";
  const res = responseSink();
  await handler(requestFor(message("مرحبًا")), res);
  delete process.env.AI_GATEWAY_API_KEY;
  assert.equal(res.code, 200);
  const gatewayCalls = calls.filter(call => call.url.includes("/v1/chat/completions"));
  assert.equal(gatewayCalls.length, 2);
  assert.equal(gatewayCalls[0].init.headers.Authorization, "Bearer invalid-test-key");
  assert.equal(gatewayCalls[1].init.headers.Authorization, "Bearer test-oidc-token");
  assert(calls.some(call => call.url.endsWith("/sendMessage")));
}

{
  const calls = installFetchMock();
  const res = responseSink();
  await handler(requestFor(message("طلب | أوافق | أحمد محمد | 777123456 | 2 | أحتاج إلى دروس تقوية في الرياضيات")), res);
  assert.equal(res.code, 200);
  assert(calls.some(call => call.url.includes("/v1/chat/completions")));
  assert(!calls.some(call => call.url.includes("/api/education/service-requests")));
}

{
  const calls = installFetchMock();
  const res = responseSink();
  await handler(requestFor(message("صمّم بوستر تعليمي عن حب القراءة للأطفال")), res);
  assert.equal(res.code, 200);
  assert(calls.some(call => call.url.includes("/v1/images/generations")));
  assert(calls.some(call => call.url.endsWith("/sendPhoto")));
}

{
  const calls = installFetchMock();
  const res = responseSink();
  await handler(requestFor({
    message: {
      chat: { id: 120045, type: "private" },
      photo: [{ file_id: "small-photo" }, { file_id: "best-photo" }]
    }
  }), res);
  assert.equal(res.code, 200);
  assert(calls.some(call => call.url.includes("/getFile")));
  const completionCall = calls.find(call => call.url.includes("/v1/chat/completions"));
  assert(completionCall);
  const body = JSON.parse(completionCall.init.body);
  assert(Array.isArray(body.messages.at(-1).content));
  assert(body.messages.at(-1).content.some(part => part.type === "image_url"));
  assert(calls.some(call => call.url.endsWith("/sendMessage")));
}

{
  const calls = installFetchMock();
  const res = responseSink();
  await handler(requestFor(message(undefined, { voice: { file_id: "voice-note", mime_type: "audio/ogg" } })), res);
  assert.equal(res.code, 200);
  assert(calls.some(call => call.url.includes("/v1/audio/transcriptions")));
  assert(calls.some(call => call.url.includes("/v1/audio/speech")));
  assert(calls.some(call => call.url.endsWith("/sendAudio")));
}

{
  const calls = installFetchMock();
  const res = responseSink();
  await handler(requestFor(message("سلام"), "wrong-secret"), res);
  assert.equal(res.code, 401);
  assert.equal(calls.length, 0);
}

{
  const calls = installFetchMock();
  const res = responseSink();
  await handler(requestFor(message("أرسل لي ردًا بصوت هادئ")), res);
  assert.equal(res.code, 200);
  assert(calls.some(call => call.url.includes("/v1/chat/completions")));
  assert(calls.some(call => call.url.includes("/v1/audio/speech")));
  assert(calls.some(call => call.url.endsWith("/sendAudio")));
  assert(calls.filter(call => call.url.endsWith("/sendMessage")).length >= 1);
}

{
  const calls = [];
  globalThis.fetch = async (input, init = {}) => {
    const url = String(input);
    calls.push({ url, init });
    if (url.includes("/v1/chat/completions")) {
      return json({ choices: [{ message: { content: JSON.stringify({
        isTaskRequest: true,
        title: "مراجعة الدروس",
        details: "مراجعة ملفات القراءة",
        dueAt: null,
        needsClarification: true,
        clarificationQuestion: "أكيد، متى تحب أرتّب لك مراجعة الدروس؟"
      }) } }] });
    }
    if (url.endsWith("/sendMessage")) return json({ ok: true, result: { message_id: calls.length } });
    throw new Error("Unexpected request in task test: " + url);
  };
  const res = responseSink();
  await handler(requestFor(message("ذكّرني بمراجعة الدروس")), res);
  assert.equal(res.code, 200);
  assert(calls.some(call => call.url.includes("/v1/chat/completions")));
  assert(!calls.some(call => call.url.includes("/api/education/service-requests")));
  const sent = calls.find(call => call.url.endsWith("/sendMessage"));
  assert(sent);
  assert(String(JSON.parse(sent.init.body).text).includes("متى تحب أرتّب لك"));
}

assert.equal(looksLikeTelegramVideoIntent("أنشئ مقطعًا تعليميًا عن أهمية القراءة"), true);
assert.equal(looksLikeTelegramVideoIntent("أحتاج بوستر تعليمي عن حب القراءة"), false);
assert.equal(looksLikeTelegramVideoIntent("Can you create a short video about reading?"), true);

console.log("Telegram assistant smoke tests passed: text, natural-form requests, image generation, photo understanding, voice input/output, and webhook authentication.");
