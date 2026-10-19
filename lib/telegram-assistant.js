import { createHash, randomUUID } from "node:crypto";
import { getDatabase } from "./neon-db.js";

const MODEL = process.env.TELEGRAM_AI_MODEL || "openai/gpt-5.6-luna";
const GATEWAY = "https://ai-gateway.vercel.sh/v1/chat/completions";

const SYSTEM = `أنت المساعد الرقمي الرسمي لدار الارتقاء الفكري. ساعد الناس بودّ وطبيعية وذكاء في التعليم والتربية والكتابة والقراءة والإملاء والتصحيح والابتكار والأنشطة والفعاليات وصياغة الإعلانات والمنشورات والخطط التعليمية والتسويقية.
افهم العربية الفصحى والعربية العامة واللهجات العربية المختلفة والإنجليزية وغيرها. أجب بلغة المستخدم، وبأسلوب طبيعي متجدد ومباشر، وتجنب القوالب الجامدة والردود المطولة بلا حاجة. لا تطلب نموذجًا أو صيغة خاصة إذا أمكن فهم كلام المستخدم الطبيعي. إذا لزمت معلومة واحدة، اسأل سؤالًا واحدًا واضحًا.
المجالات التعليمية: الطفولة والتأسيس؛ التعليم الأساسي والعام؛ التعليم الجامعي والعالي؛ التدريب المهني والتقني؛ القرآن والإسلامية؛ التقوية والعربية والتأهيل؛ الإرشاد الأكاديمي.
المنصة: https://alirtiqaa-educational-platform.vercel.app/
القناة: https://t.me/DarAlIrtiqaAlFikri
اتصال البنين: 0538216050. اتصال البنات: 0538838891.
لا تختلق رسومًا أو مواعيد أو سياسات أو معلومات حديثة. إذا لم تكن متأكدًا، قل ذلك بوضوح وقدّم ما تعرفه.
أنت مساعد رقمي للمؤسسة، ولست علي سليمان الأهدل أو أمل محمد برديني. لا تدّعِ أنك شخص بعينه، ولا تقل إنك نشرت أو حجزت أو قبلت أو اعتمدت شيئًا ما لم تؤكده أداة فعلية. يمكنك صياغة المحتوى والخطط، لكن لا تزعم إنشاء ملف بصري أو نشر منشور إن لم تكن الميزة متاحة.
لا تجمع بيانات شخصية غير لازمة ولا تنشرها علنًا. عند طلب قرار إداري أو قبول رسمي، ساعد المستخدم في الفهم والصياغة لكن لا تدّعِ صدور قرار من الإدارة.
اجعل الرد دافئًا ومفيدًا وغير ممل، من دون وعود لا يمكن تنفيذها.`;

function cleanHistory(value) {
  if (typeof value === "string") {
    try { value = JSON.parse(value); } catch { value = []; }
  }
  if (!Array.isArray(value)) return [];
  return value.filter(x => x && ["user", "assistant"].includes(x.role) && typeof x.content === "string")
    .map(x => ({ role: x.role, content: x.content.slice(0, 3000) })).slice(-10);
}

export async function clearTelegramHistory(chatId) {
  const sql = getDatabase("education");
  await sql`DELETE FROM education.telegram_conversations WHERE chat_id = ${String(chatId)}`;
}

export async function generateAssistantReply(chatId, text, oidcToken = "", imageDataUrl = "") {
  const userText = String(text || "").trim();
  if (!userText) return "أنا معك 🌿 اكتب لي ما تحتاجه وسأساعدك.";
  if (userText.length > 3000) return "وصلتني رسالتك، لكنها طويلة جدًا. أرسل الجزء الأهم وسأتابع معك.";
  const token = process.env.AI_GATEWAY_API_KEY || oidcToken || process.env.VERCEL_OIDC_TOKEN;
  if (!token) return "أهلًا بك 🌿 خدمة المحادثة الذكية غير متاحة مؤقتًا. للمعلومات الأساسية استخدم /services أو /contact.";

  let sql = null, history = [], rateCount = 0;
  const key = String(chatId);
  try {
    sql = getDatabase("education");
    await sql`DELETE FROM education.telegram_conversations WHERE updated_at < now() - interval '30 days'`;
    const rows = await sql`
      INSERT INTO education.telegram_conversations (chat_id, history, rate_window_started_at, rate_count, updated_at)
      VALUES (${key}, '[]'::jsonb, now(), 1, now())
      ON CONFLICT (chat_id) DO UPDATE SET
        history = CASE WHEN education.telegram_conversations.updated_at < now() - interval '30 days'
          THEN '[]'::jsonb ELSE education.telegram_conversations.history END,
        rate_count = CASE WHEN education.telegram_conversations.rate_window_started_at < now() - interval '1 minute'
          THEN 1 ELSE education.telegram_conversations.rate_count + 1 END,
        rate_window_started_at = CASE WHEN education.telegram_conversations.rate_window_started_at < now() - interval '1 minute'
          THEN now() ELSE education.telegram_conversations.rate_window_started_at END,
        updated_at = now()
      RETURNING history, rate_count
    `;
    history = cleanHistory(rows?.[0]?.history);
    rateCount = Number(rows?.[0]?.rate_count || 1);
  } catch (error) {
    sql = null;
    console.error("TELEGRAM_CONVERSATION_STORAGE_UNAVAILABLE", error?.code || "unknown");
  }
  if (rateCount > 12) return "وصلتني عدة رسائل متتابعة منك 🌿 خذ لحظة قصيرة ثم واصل الحديث هنا.";

  try {
    const response = await fetch(GATEWAY, {
      method: "POST",
      headers: { "Authorization": "Bearer " + token, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "system", content: SYSTEM }, ...history, { role: "user", content: imageDataUrl ? [{ type: "text", text: userText }, { type: "image_url", image_url: { url: imageDataUrl, detail: "auto" } }] : userText }],
        max_tokens: 650
      }),
      signal: AbortSignal.timeout(16000)
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      console.error("TELEGRAM_AI_GATEWAY_FAILED", { status: response.status, model: MODEL });
      return "أهلًا بك 🌿 أواجه تعثرًا فنيًا مؤقتًا في الرد. يمكنك مواصلة الحديث بعد قليل، أو استخدام /services و/contact للمعلومات الأساسية.";
    }
    const value = data?.choices?.[0]?.message?.content;
    const reply = (typeof value === "string" ? value : Array.isArray(value) ? value.map(p => p?.text || "").join("") : "").trim();
    if (!reply) return "أهلًا بك 🌿 لم يصلني رد واضح هذه المرة؛ اكتب لي ما تحتاجه مرة أخرى.";
    const safeReply = reply.slice(0, 3900);
    if (sql) {
      try {
        const nextHistory = [...history, { role: "user", content: userText }, { role: "assistant", content: safeReply }].slice(-10);
        await sql`UPDATE education.telegram_conversations SET history = ${JSON.stringify(nextHistory)}::jsonb, updated_at = now() WHERE chat_id = ${key}`;
      } catch (error) {
        console.error("TELEGRAM_CONVERSATION_SAVE_FAILED", error?.code || "unknown");
      }
    }
    return safeReply;
  } catch (error) {
    console.error("TELEGRAM_AI_REQUEST_FAILED", error?.name || "unknown");
    return "أهلًا بك 🌿 أواجه تعثرًا فنيًا مؤقتًا في الرد. يمكنك مواصلة الحديث بعد قليل، أو استخدام /services و/contact للمعلومات الأساسية.";
  }
}


export async function transcribeTelegramAudio(buffer, filename, mimeType, oidcToken = "") {
  const token = process.env.AI_GATEWAY_API_KEY || oidcToken || process.env.VERCEL_OIDC_TOKEN;
  if (!token) throw new Error("AI_GATEWAY_AUTH_UNAVAILABLE");
  if (!Buffer.isBuffer(buffer) || buffer.length === 0 || buffer.length > 8 * 1024 * 1024) {
    throw new Error("AUDIO_FILE_SIZE_UNSUPPORTED");
  }

  const form = new FormData();
  form.append("file", new Blob([buffer], { type: mimeType || "application/octet-stream" }), filename || "voice.ogg");
  form.append("model", "openai/gpt-4o-mini-transcribe");
  form.append("response_format", "json");
  const response = await fetch("https://ai-gateway.vercel.sh/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: "Bearer " + token },
    body: form,
    signal: AbortSignal.timeout(18000)
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    console.error("TELEGRAM_TRANSCRIPTION_FAILED", { status: response.status });
    throw new Error("AUDIO_TRANSCRIPTION_FAILED");
  }
  const transcript = typeof result?.text === "string" ? result.text.trim() : "";
  if (!transcript) throw new Error("AUDIO_TRANSCRIPTION_EMPTY");
  return transcript.slice(0, 3000);
}

export async function generateTelegramImage(prompt, oidcToken = "", chatId = "") {
  const token = process.env.AI_GATEWAY_API_KEY || oidcToken || process.env.VERCEL_OIDC_TOKEN;
  if (!token) throw new Error("AI_GATEWAY_AUTH_UNAVAILABLE");
  const safePrompt = String(prompt || "").trim().slice(0, 2500);
  if (safePrompt.length < 4) throw new Error("IMAGE_PROMPT_REQUIRED");
  const fullPrompt = [
    "Create a polished educational marketing visual for Dar Al-Irtiqaa Al-Fikri, an Arabic education organization.",
    "Use a contemporary, warm, professional design with strong composition and culturally respectful educational motifs.",
    "If text is requested, render it in correct Arabic script with right-to-left layout; avoid gibberish text. Do not invent official logos or seals and do not depict named real staff.",
    "Requested creative brief:",
    safePrompt
  ].join("\n\n");
  const response = await fetch("https://ai-gateway.vercel.sh/v1/images/generations", {
    method: "POST",
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "openai/gpt-image-1.5",
      prompt: fullPrompt,
      size: "1024x1024",
      quality: "medium",
      n: 1,
      safety_identifier: createHash("sha256").update(String(chatId || "telegram-user")).digest("hex").slice(0, 64)
    }),
    signal: AbortSignal.timeout(38000)
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    console.error("TELEGRAM_IMAGE_GENERATION_FAILED", { status: response.status });
    throw new Error("IMAGE_GENERATION_FAILED");
  }
  const base64 = result?.data?.[0]?.b64_json;
  if (typeof base64 !== "string" || !base64) throw new Error("IMAGE_GENERATION_EMPTY");
  const image = Buffer.from(base64, "base64");
  if (!image.length || image.length > 10 * 1024 * 1024) throw new Error("IMAGE_OUTPUT_SIZE_UNSUPPORTED");
  return image;
}

export async function synthesizeTelegramSpeech(text, oidcToken = "", voice = "coral") {
  const token = process.env.AI_GATEWAY_API_KEY || oidcToken || process.env.VERCEL_OIDC_TOKEN;
  if (!token) throw new Error("AI_GATEWAY_AUTH_UNAVAILABLE");
  const input = String(text || "").trim().slice(0, 3500);
  if (!input) throw new Error("SPEECH_TEXT_REQUIRED");
  const allowedVoices = new Set(["alloy", "ash", "ballad", "coral", "echo", "fable", "onyx", "nova", "sage", "shimmer", "verse", "marin", "cedar"]);
  const selectedVoice = allowedVoices.has(voice) ? voice : "coral";
  const response = await fetch("https://ai-gateway.vercel.sh/v1/audio/speech", {
    method: "POST",
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "openai/gpt-4o-mini-tts",
      voice: selectedVoice,
      input,
      instructions: "Speak clear, warm, natural Arabic. Use a friendly, broadly understandable Arabic accent, steady pacing, expressive but professional school-assistant delivery. Do not imitate a named real person."
    }),
    signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) {
    console.error("TELEGRAM_SPEECH_GENERATION_FAILED", { status: response.status });
    throw new Error("SPEECH_GENERATION_FAILED");
  }
  const audio = Buffer.from(await response.arrayBuffer());
  if (!audio.length || audio.length > 8 * 1024 * 1024) throw new Error("SPEECH_OUTPUT_SIZE_UNSUPPORTED");
  return audio;
}


const TASK_INTENT_PATTERN = /(?:ذكرني|ذكّرني|أضف\s*مهمة|اضف\s*مهمة|إضافة\s*مهمة|اضافة\s*مهمة|جدول(?:\s+لي)?\s+مهمة|جدولة\s+مهمة|رتب\s+لي\s+مهمة|حط(?:\s+لي)?\s+(?:في\s+)?(?:التقويم|الجدول)|موعد\s+تذكير|remind\s+me|set\s+(?:a\s+)?reminder|add\s+(?:a\s+)?task|schedule\s+(?:a\s+)?task)/iu;

export function looksLikeTelegramTaskIntent(text) {
  return TASK_INTENT_PATTERN.test(String(text || ""));
}

export async function scheduleTelegramTask(chatId, text, oidcToken = "") {
  const userText = String(text || "").trim();
  if (!looksLikeTelegramTaskIntent(userText)) return { handled: false };
  const token = process.env.AI_GATEWAY_API_KEY || oidcToken || process.env.VERCEL_OIDC_TOKEN;
  if (!token) {
    return {
      handled: true,
      reply: "أفهم أنك تريد ترتيب مهمة أو تذكير 🌿 خدمة الجدولة غير متاحة فنيًا الآن، لكن اكتب لي المهمة وموعدها وسأرتبها لك نصيًا."
    };
  }

  const now = new Date();
  const prompt = [
    "Extract a task scheduling request from an Arabic or multilingual Telegram message.",
    "Return only a JSON object with: isTaskRequest(boolean), title(string), details(string), dueAt(string|null), needsClarification(boolean), clarificationQuestion(string).",
    "Current timestamp: " + now.toISOString(),
    "Interpret local date and time in Asia/Riyadh. ISO output must include an explicit timezone offset.",
    "Never invent a date or time. If the user did not state a reasonably unambiguous future date/time, use dueAt=null, needsClarification=true and ask one short natural question in the user's language.",
    "If the message is only asking for a study timetable, ideas, drafting, or general discussion and not a single date-bound task/reminder, set isTaskRequest=false.",
    "Do not schedule repetitive/recurring tasks because this personal task list currently supports one-time tasks only; ask for one specific occurrence.",
    "title must be a compact actionable title of at most 200 characters; details may be an empty string or concise context.",
    "User message: " + userText
  ].join("\n\n");

  try {
    const response = await fetch(GATEWAY, {
      method: "POST",
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: "You are a careful task-intent extractor. Output valid JSON only. Do not execute any action or infer a date that was not stated." },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" },
        max_tokens: 280
      }),
      signal: AbortSignal.timeout(12000)
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      console.error("TELEGRAM_TASK_EXTRACTION_FAILED", { status: response.status });
      return { handled: true, reply: "وصلتني فكرة الجدولة، لكن تعذّر تجهيز الموعد الآن. اكتب لي المهمة وموعدها بعبارة واضحة وسأتابع معك." };
    }
    const raw = data?.choices?.[0]?.message?.content;
    const parsed = typeof raw === "string" ? JSON.parse(raw) : null;
    if (!parsed || parsed.isTaskRequest !== true) return { handled: false };
    const title = String(parsed.title || "").trim().slice(0, 200);
    const details = String(parsed.details || "").trim().slice(0, 1000);
    if (parsed.needsClarification || !parsed.dueAt || !title) {
      return {
        handled: true,
        reply: String(parsed.clarificationQuestion || "أكيد، ما الموعد الذي يناسبك لهذه المهمة؟").slice(0, 800)
      };
    }
    const dueAt = new Date(parsed.dueAt);
    if (!Number.isFinite(dueAt.getTime()) || dueAt.getTime() <= Date.now() + 30000) {
      return {
        handled: true,
        reply: "أرتبها لك بكل سرور 🌿 ما التاريخ والوقت القادم الذي تريد تحديده للمهمة؟"
      };
    }

    const sql = getDatabase("education");
    const rows = await sql`
      INSERT INTO education.telegram_tasks (chat_id, title, details, due_at, timezone, status)
      VALUES (${String(chatId)}, ${title}, NULLIF(${details}, ''), ${dueAt.toISOString()}, 'Asia/Riyadh', 'scheduled')
      RETURNING id, title, details, due_at, status
    `;
    const saved = rows?.[0];
    if (!saved) throw new Error("TASK_INSERT_RETURNED_NO_ROW");
    const dueLabel = new Intl.DateTimeFormat("ar-SA", {
      dateStyle: "full", timeStyle: "short", timeZone: "Asia/Riyadh"
    }).format(new Date(saved.due_at));
    return {
      handled: true,
      created: true,
      task: saved,
      reply: "تم ترتيب المهمة في قائمة مهامك 🌿\n**" + saved.title + "**\nالموعد: " + dueLabel +
        (saved.details ? "\nالتفاصيل: " + saved.details : "") +
        "\n\nستجدها في /tasks. حفظ الموعد في القائمة لا يرسل تنبيهًا تلقائيًا عند حلوله بعدُ."
    };
  } catch (error) {
    console.error("TELEGRAM_TASK_SCHEDULE_FAILED", error?.message || "unknown error");
    return {
      handled: true,
      reply: "حاولت ترتيب المهمة لكن تعذّر حفظها الآن. اكتب لي المهمة وموعدها بوضوح مرة أخرى."
    };
  }
}

export async function listTelegramTasks(chatId) {
  const sql = getDatabase("education");
  return await sql`
    SELECT id, title, details, due_at, status
    FROM education.telegram_tasks
    WHERE chat_id = ${String(chatId)} AND status = 'scheduled' AND due_at >= now()
    ORDER BY due_at ASC
    LIMIT 15
  `;
}

export async function updateTelegramTaskStatus(chatId, partialId, status) {
  const idPrefix = String(partialId || "").trim().replace(/[^a-f0-9-]/gi, "").slice(0, 36);
  if (idPrefix.replace(/-/g, "").length < 6) {
    return { ok: false, message: "أرسل /tasks أولًا وخذ بداية معرّف المهمة، ثم استخدم /done أو /cancel_task متبوعًا به." };
  }
  if (!["completed", "cancelled"].includes(status)) {
    return { ok: false, message: "حالة المهمة غير مدعومة." };
  }
  const sql = getDatabase("education");
  const rows = await sql`
    UPDATE education.telegram_tasks
    SET status = ${status}, updated_at = now()
    WHERE chat_id = ${String(chatId)}
      AND id::text LIKE ${idPrefix + "%"}
      AND status = 'scheduled'
    RETURNING id, title, status
  `;
  if (!rows?.length) return { ok: false, message: "لم أجد مهمة مطابقة ضمن مهام هذه المحادثة. استخدم /tasks لعرض المهام الحالية." };
  return { ok: true, task: rows[0], message: status === "completed" ? "تم تحديد المهمة كمكتملة ✅" : "تم إلغاء المهمة من قائمتك." };
}


const VIDEO_MODEL = process.env.TELEGRAM_VIDEO_MODEL || "klingai/kling-v2.6-t2v";
const VIDEO_START_URL = "https://ai-gateway.vercel.sh/v1/video/start";
const VIDEO_STATUS_URL = "https://ai-gateway.vercel.sh/v1/video/status";

export function looksLikeTelegramVideoIntent(text) {
  const value = String(text || "");
  const mentionsVideo = /(?:видео|فيديو|مقطع(?:\\s+مرئي)?|ريلز|ريل|برومو|clip|video|reel)/iu.test(value);
  const asksToCreate = /(?:أنشئ|انشئ|اصنع|صنّع|ابتكر|جهّز|جهز|سوّ|اعمل(?:\\s+لي)?|صمّم|صمم|ولّد|ولد|create|generate|make|produce)/iu.test(value);
  const isPosterOnly = /(?:بوستر|برشور|ملصق|صورة|poster|flyer|brochure|image|photo)/iu.test(value) &&
    !/(?:مقطع|فيديو|ريلز|ريل|video|clip|reel)/iu.test(value);
  return mentionsVideo && asksToCreate && !isPosterOnly;
}

export async function startTelegramVideo(chatId, promptText, oidcToken = "") {
  const prompt = String(promptText || "").trim().slice(0, 2200);
  if (prompt.length < 5) return { ok: false, message: "صف لي فكرة المقطع بجملة واحدة على الأقل." };
  const token = process.env.AI_GATEWAY_API_KEY || oidcToken || process.env.VERCEL_OIDC_TOKEN;
  if (!token) return { ok: false, message: "خدمة الفيديو غير متاحة فنيًا الآن؛ سأساعدك في صياغة الفكرة إلى أن يتوفر الاتصال." };

  const sql = getDatabase("education");
  const idempotencyKey = randomUUID();
  const title = "فيديو تعليمي — " + prompt.slice(0, 160);
  const pendingRows = await sql`
    INSERT INTO education.telegram_video_jobs
      (chat_id, prompt, model, operation, status, idempotency_key)
    VALUES
      (${String(chatId)}, ${prompt}, ${VIDEO_MODEL}, NULL, 'pending', ${idempotencyKey})
    RETURNING id
  `;
  const localJob = pendingRows?.[0];
  if (!localJob?.id) return { ok: false, message: "تعذّر فتح مهمة الفيديو الآن." };

  try {
    const response = await fetch(VIDEO_START_URL, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + token,
        "Content-Type": "application/json",
        "idempotency-key": idempotencyKey
      },
      body: JSON.stringify({
        model: VIDEO_MODEL,
        prompt: [
          "Create a short, polished educational promotional video for Dar Al-Irtiqaa Al-Fikri.",
          "Use clear visual storytelling, respectful and inclusive school imagery, tasteful modern composition, and smooth cinematic movement.",
          "Vertical 9:16 framing for mobile social media. Avoid presenting fake logos, official seals, contact details, or complex text overlays; Arabic text can be added separately in editing.",
          "Creative brief from the user: " + prompt
        ].join("\n\n"),
        duration: 5,
        aspectRatio: "9:16"
      }),
      signal: AbortSignal.timeout(18000)
    });
    const result = await response.json().catch(() => null);
    if (!response.ok) {
      console.error("TELEGRAM_VIDEO_START_FAILED", { status: response.status, model: VIDEO_MODEL });
      await sql`
        UPDATE education.telegram_video_jobs SET status = 'failed',
          error = ${"VIDEO_START_HTTP_" + response.status}, updated_at = now()
        WHERE id = ${localJob.id}
      `;
      return {
        ok: false,
        message: "تعذّر بدء توليد الفيديو الآن. سأبقي فكرتك واضحة، ويمكنك المحاولة مرة أخرى لاحقًا."
      };
    }
    const operation = result?.operation;
    const operationRef = typeof operation === "string"
      ? operation
      : typeof operation?.id === "string"
        ? operation.id
        : typeof operation?.operationId === "string"
          ? operation.operationId
          : "";
    if (!operationRef) {
      console.error("TELEGRAM_VIDEO_START_NO_OPERATION", { model: VIDEO_MODEL });
      await sql`
        UPDATE education.telegram_video_jobs SET status = 'failed',
          error = 'VIDEO_START_NO_OPERATION', updated_at = now()
        WHERE id = ${localJob.id}
      `;
      return { ok: false, message: "لم يرجع مزود الفيديو معرّف المهمة، لذلك لم أعتبرها مجدولة." };
    }
    await sql`
      UPDATE education.telegram_video_jobs SET operation = ${operationRef}, updated_at = now()
      WHERE id = ${localJob.id}
    `;
    return {
      ok: true,
      jobId: localJob.id,
      prompt,
      message: "بدأت مهمة الفيديو 🎬\\n" + prompt.slice(0, 500) +
        "\\nمعرّف المهمة: " + String(localJob.id).slice(0, 8) +
        "\\nيمكنك الرجوع لاحقًا باستخدام /video_status ثم معرّف المهمة. قد يستغرق التوليد بعض الوقت، وقد تُحتسب تكلفة من مزوّد النموذج عند إنشاء الفيديو."
    };
  } catch (error) {
    console.error("TELEGRAM_VIDEO_START_ERROR", error?.message || "unknown error");
    try {
      await sql`
        UPDATE education.telegram_video_jobs SET status = 'failed',
          error = 'VIDEO_START_EXCEPTION', updated_at = now()
        WHERE id = ${localJob.id}
      `;
    } catch {}
    return { ok: false, message: "تعذّر بدء مهمة الفيديو بسبب مشكلة اتصال. لم أؤكد إنشاء المقطع." };
  }
}

export async function checkTelegramVideoJob(chatId, idPrefix, oidcToken = "") {
  const prefix = String(idPrefix || "").trim().replace(/[^a-f0-9-]/gi, "").slice(0, 36);
  if (prefix.replace(/-/g, "").length < 6) {
    return { ok: false, message: "استخدم /video_status مع أول 8 أحرف من معرّف مهمة الفيديو." };
  }
  const sql = getDatabase("education");
  const rows = await sql`
    SELECT id, prompt, model, operation, status, output_url, error
    FROM education.telegram_video_jobs
    WHERE chat_id = ${String(chatId)} AND id::text LIKE ${prefix + "%"}
    ORDER BY created_at DESC
    LIMIT 1
  `;
  const job = rows?.[0];
  if (!job) return { ok: false, message: "لم أجد مهمة فيديو بهذا المعرّف ضمن هذه المحادثة." };
  if (job.status === "completed" && job.output_url) {
    return { ok: true, status: "completed", jobId: job.id, videoUrl: job.output_url, message: "الفيديو جاهز 🎬" };
  }
  if (job.status === "failed") return { ok: false, status: "failed", message: "لم تكتمل مهمة الفيديو. يمكنك إرسال وصف جديد للمحاولة من البداية." };
  if (!job.operation) return { ok: false, status: "pending", message: "المهمة سُجّلت، لكن لم يصلنا بعد تأكيد بدء المعالجة من مزوّد الفيديو." };

  const token = process.env.AI_GATEWAY_API_KEY || oidcToken || process.env.VERCEL_OIDC_TOKEN;
  if (!token) return { ok: false, status: "pending", message: "لا يتوفر اتصال التحقق من حالة الفيديو الآن. جرّب لاحقًا." };
  const url = new URL(VIDEO_STATUS_URL);
  url.searchParams.set("model", job.model);
  url.searchParams.set("operation", job.operation);
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { Authorization: "Bearer " + token },
      signal: AbortSignal.timeout(12000)
    });
    const result = await response.json().catch(() => null);
    if (!response.ok) {
      console.error("TELEGRAM_VIDEO_STATUS_FAILED", { status: response.status, model: job.model });
      return { ok: false, status: "pending", message: "لم أستطع التحقق من الحالة الآن. جرّب بعد قليل." };
    }
    if (result?.status === "pending") {
      await sql`UPDATE education.telegram_video_jobs SET updated_at = now() WHERE id = ${job.id}`;
      return { ok: true, status: "pending", jobId: job.id, message: "الفيديو ما زال قيد التوليد 🎬 أعد /video_status مع معرّف المهمة لاحقًا." };
    }
    if (result?.status === "error" || result?.status === "failed") {
      await sql`
        UPDATE education.telegram_video_jobs SET status = 'failed',
          error = ${String(result?.message || "VIDEO_PROVIDER_ERROR").slice(0, 500)}, updated_at = now()
        WHERE id = ${job.id}
      `;
      return { ok: false, status: "failed", message: "لم يكتمل الفيديو هذه المرة. يمكنك تجربة وصف أقصر أو فكرة أخرى." };
    }
    const video = Array.isArray(result?.videos) ? result.videos[0] : null;
    const videoUrl = video?.type === "url" && typeof video.url === "string" ? video.url : "";
    if (result?.status === "completed" && videoUrl && /^https:\/\//i.test(videoUrl)) {
      await sql`
        UPDATE education.telegram_video_jobs SET status = 'completed',
          output_url = ${videoUrl}, updated_at = now()
        WHERE id = ${job.id}
      `;
      return { ok: true, status: "completed", jobId: job.id, videoUrl, message: "الفيديو جاهز 🎬" };
    }
    if (result?.status === "completed") {
      await sql`
        UPDATE education.telegram_video_jobs SET status = 'failed',
          error = 'VIDEO_RESULT_NOT_HOSTED_URL', updated_at = now()
        WHERE id = ${job.id}
      `;
      return { ok: false, status: "failed", message: "اكتمل التوليد لكن لم يرجع رابط فيديو قابلًا للإرسال إلى تيليجرام." };
    }
    return { ok: false, status: "pending", message: "حالة الفيديو غير واضحة حاليًا. جرّب الاستعلام مرة أخرى." };
  } catch (error) {
    console.error("TELEGRAM_VIDEO_STATUS_EXCEPTION", error?.message || "unknown error");
    return { ok: false, status: "pending", message: "تعذّر التحقق من حالة الفيديو الآن. جرّب لاحقًا." };
  }
}
