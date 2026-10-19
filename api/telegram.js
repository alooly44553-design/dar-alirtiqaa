import { generateAssistantReply, clearTelegramHistory, transcribeTelegramAudio, generateTelegramImage, synthesizeTelegramSpeech, looksLikeTelegramTaskIntent, scheduleTelegramTask, listTelegramTasks, updateTelegramTaskStatus, looksLikeTelegramVideoIntent, startTelegramVideo, checkTelegramVideoJob } from "../lib/telegram-assistant.js";
import { timingSafeEqual } from "node:crypto";
import { EDUCATION_SCOPE_REPLY, isBusinessOperationsRequest, isEducationPlatformRequest } from "../lib/telegram-scope.js";
const TELEGRAM_API = "https://api.telegram.org";

function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || !a || !b) return false;
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

async function sendPrivateReply(token, chatId, text) {
  try {
    const response = await fetch(TELEGRAM_API + "/bot" + token + "/sendMessage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true })
    });
    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.ok) console.error("TELEGRAM_SCOPE_REPLY_FAILED", { status: response.status });
  } catch {
    console.error("TELEGRAM_SCOPE_REPLY_FAILED", { status: "network" });
  }
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "GET") {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;

    if (!token || !expectedSecret) {
      return res.status(200).json({
        ok: true,
        service: "education-platform-assistant",
        scope: "education-only",
        configured: false
      });
    }

    // Optional read-only diagnostic. It never returns either secret.
    if (req.query?.diagnose === "1") {
      try {
        const meResponse = await fetch(`${TELEGRAM_API}/bot${token}/getMe`);
        const me = await meResponse.json().catch(() => null);
        if (!meResponse.ok || !me?.ok || !me.result?.id) {
          return res.status(200).json({
            ok: true,
            configured: true,
            botTokenValid: false,
            scope: "education-only"
          });
        }

        let webhookConfiguration = null;
        let commandMenuConfigured = null;
        if (req.query?.configureWebhook === "1") {
          try {
            const webhookResponse = await fetch(`${TELEGRAM_API}/bot${token}/setWebhook`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                url: "https://alirtiqaa-educational-platform.vercel.app/api/telegram",
                secret_token: expectedSecret,
                allowed_updates: ["message", "edited_message"],
                drop_pending_updates: false
              })
            });
            const webhookResult = await webhookResponse.json().catch(() => null);
            webhookConfiguration = Boolean(webhookResponse.ok && webhookResult?.ok);
          } catch {
            webhookConfiguration = false;
          }
          try {
            const menuResponse = await fetch(`${TELEGRAM_API}/bot${token}/setMyCommands`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                commands: [
                  { command: "start", description: "بدء المحادثة" },
                  { command: "help", description: "ماذا يمكنني أن أفعل لك؟" },
                  { command: "services", description: "المجالات التعليمية" },
                  { command: "events", description: "الفعاليات التعليمية" },
                  { command: "contact", description: "معلومات المنصة التعليمية" },
                  { command: "request", description: "الاستفسار عن خدمة تعليمية" },
                  { command: "event_request", description: "ترتيب فعالية تعليمية" },
                  { command: "forget", description: "مسح سياق المحادثة" },
                  { command: "tasks", description: "مهامي التعليمية المجدولة" },
                  { command: "done", description: "إكمال مهمة من قائمتي" },
                  { command: "cancel_task", description: "إلغاء مهمة من قائمتي" },
                  { command: "video_status", description: "التحقق من حالة مقطع الفيديو" }
                ]
              })
            });
            const menuResult = await menuResponse.json().catch(() => null);
            commandMenuConfigured = Boolean(menuResponse.ok && menuResult?.ok);
          } catch {
            commandMenuConfigured = false;
          }
        }
        return res.status(200).json({
          ok: true,
          service: "education-platform-assistant",
          scope: "education-only",
          configured: true,
          botTokenValid: true,
          botUsername: me.result.username ?? null,
          aiGatewayAuthAvailable: Boolean(
            process.env.AI_GATEWAY_API_KEY ||
            process.env.VERCEL_OIDC_TOKEN ||
            req.headers["x-vercel-oidc-token"]
          ),
          ...(webhookConfiguration === null ? {} : { webhookConfigured: webhookConfiguration }),
          ...(commandMenuConfigured === null ? {} : { commandMenuConfigured })
        });
      } catch {
        return res.status(200).json({
          ok: true,
          configured: true,
          service: "education-platform-assistant",
          scope: "education-only",
          diagnosticUnavailable: true
        });
      }
    }

    return res.status(200).json({
      ok: true,
      service: "education-platform-assistant",
      scope: "education-only",
      configured: true
    });
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!expectedSecret || !token) {
    return res.status(503).json({ ok: false, error: "Telegram service is not configured" });
  }

  // Telegram webhook updates are authenticated with Telegram's secret-token header.
  const telegramSecret = req.headers["x-telegram-bot-api-secret-token"];
  if (typeof telegramSecret === "string") {
    if (!safeEqual(telegramSecret, expectedSecret)) {
      return res.status(401).json({ ok: false, error: "Unauthorized webhook" });
    }

    const update = req.body || {};
    const message = update.message || update.edited_message;
    const chatId = message?.chat?.id;
    const incomingText = typeof message?.text === "string" ? message.text.trim() : typeof message?.caption === "string" ? message.caption.trim() : "";
    const photo = Array.isArray(message?.photo) && message.photo.length
      ? message.photo[message.photo.length - 1]
      : null;
    const imageDocument = message?.document?.mime_type?.startsWith("image/") ? message.document : null;
    const audioAttachment = message?.voice || message?.audio || null;
    const videoAttachment = message?.video || message?.video_note || null;
    const attachment = photo
      ? { kind: "image", fileId: photo.file_id, filename: "telegram-photo.jpg", mimeType: "image/jpeg" }
      : imageDocument
        ? { kind: "image", fileId: imageDocument.file_id, filename: String(imageDocument.file_name || "telegram-image").slice(0, 100), mimeType: imageDocument.mime_type || "image/jpeg" }
        : audioAttachment
          ? { kind: "audio", fileId: audioAttachment.file_id, filename: audioAttachment.file_unique_id ? "telegram-voice.ogg" : "telegram-audio", mimeType: audioAttachment.mime_type || (message?.voice ? "audio/ogg" : "audio/mpeg") }
          : videoAttachment
            ? { kind: "video", fileId: videoAttachment.file_id, filename: "telegram-video.mp4", mimeType: videoAttachment.mime_type || "video/mp4" }
            : null;

    if (chatId && attachment) {
      if (isBusinessOperationsRequest(incomingText)) {
        await sendPrivateReply(token, chatId, EDUCATION_SCOPE_REPLY);
        return res.status(200).json({ ok: true });
      }
      if (attachment.kind === "image" && !isEducationPlatformRequest(incomingText)) {
        await sendPrivateReply(token, chatId, "أرفق الصورة مع سؤال واضح يخص التعليم أو إحدى خدمات المنصة التعليمية حتى أبقي المعالجة ضمن هذا النطاق.");
        return res.status(200).json({ ok: true });
      }
      const oidcToken = req.headers["x-vercel-oidc-token"] || "";
      try {
        const fileInfoResponse = await fetch(`${TELEGRAM_API}/bot${token}/getFile?file_id=${encodeURIComponent(attachment.fileId)}`);
        const fileInfo = await fileInfoResponse.json().catch(() => null);
        if (!fileInfoResponse.ok || !fileInfo?.ok || !fileInfo.result?.file_path) {
          throw new Error("TELEGRAM_FILE_LOOKUP_FAILED");
        }
        const fileResponse = await fetch(`${TELEGRAM_API}/file/bot${token}/${fileInfo.result.file_path}`);
        if (!fileResponse.ok) throw new Error("TELEGRAM_FILE_DOWNLOAD_FAILED");
        const rawFile = Buffer.from(await fileResponse.arrayBuffer());
        if (!rawFile.length || rawFile.length > 8 * 1024 * 1024) {
          throw new Error("TELEGRAM_ATTACHMENT_TOO_LARGE");
        }

        let prompt = incomingText;
        let imageDataUrl = "";
        if (attachment.kind === "image") {
          prompt = prompt || "حلّل هذه الصورة واشرح ما يظهر فيها، وساعدني في القراءة أو التعليم أو التصميم بحسب محتواها.";
          imageDataUrl = `data:${attachment.mimeType};base64,${rawFile.toString("base64")}`;
        } else {
          const transcript = await transcribeTelegramAudio(rawFile, attachment.filename, attachment.mimeType, oidcToken);
          prompt = (prompt ? prompt + "\n\n" : "") +
            (attachment.kind === "video"
              ? "هذا تفريغ الكلام المسموع في فيديو، وليس تحليلًا بصريًا لإطارات الفيديو:\n"
              : "هذا تفريغ رسالتك الصوتية:\n") + transcript;
          if (!isEducationPlatformRequest(prompt)) {
            await sendPrivateReply(token, chatId, EDUCATION_SCOPE_REPLY);
            return res.status(200).json({ ok: true });
          }
        }

        const replyText = await generateAssistantReply(chatId, prompt, oidcToken, imageDataUrl);
        const sendReplyResponse = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, text: replyText, disable_web_page_preview: true })
        });
        const sendReplyResult = await sendReplyResponse.json().catch(() => null);
        if (!sendReplyResponse.ok || !sendReplyResult?.ok) {
          throw new Error("TELEGRAM_MEDIA_REPLY_FAILED");
        }

        if (attachment.kind === "audio") {
          try {
            const voices = ["coral", "nova", "shimmer", "alloy", "sage"];
            const voice = voices[Math.abs(Number(chatId) + Math.floor(Date.now() / 60000)) % voices.length];
            const speech = await synthesizeTelegramSpeech(replyText, oidcToken, voice);
            const audioForm = new FormData();
            audioForm.append("chat_id", String(chatId));
            audioForm.append("audio", new Blob([speech], { type: "audio/mpeg" }), "dar-alirtiqaa-reply.mp3");
            audioForm.append("caption", "رد صوتي مولّد آليًا للمساعدة في المتابعة.");
            const speechResponse = await fetch(`${TELEGRAM_API}/bot${token}/sendAudio`, { method: "POST", body: audioForm });
            const speechResult = await speechResponse.json().catch(() => null);
            if (!speechResponse.ok || !speechResult?.ok) {
              console.error("TELEGRAM_TTS_DELIVERY_FAILED", { status: speechResponse.status });
            }
          } catch (speechError) {
            console.error("TELEGRAM_TTS_FAILED", speechError?.message || "unknown error");
          }
        }
      } catch (mediaError) {
        console.error("TELEGRAM_MEDIA_PROCESSING_FAILED", mediaError?.message || "unknown error");
        let fallback = "حاولت معالجة المرفق لكن تعذّر إكماله الآن. أعد إرساله بحجم أصغر أو اكتب لي ما تريد معرفته عنه.";
        if (mediaError?.message === "TELEGRAM_ATTACHMENT_TOO_LARGE") {
          fallback = "المرفق كبير على المعالجة الآمنة داخل البوت. أرسل صورة أو مقطعًا صوتيًا أقصر أو أقل من 8 ميغابايت.";
        }
        try {
          await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: chatId, text: fallback, disable_web_page_preview: true })
          });
        } catch {}
      }
      return res.status(200).json({ ok: true });
    }

    if (chatId && incomingText) {
      const command = incomingText.split(/\s+/)[0].split("@")[0].toLowerCase();
      let reply = null;
      if (isBusinessOperationsRequest(incomingText)) {
        reply = EDUCATION_SCOPE_REPLY;
      } else if (command === "/start") {
        reply = "مرحبًا بك في المساعد التعليمي 🌱\n\nهذه الخدمة مخصصة حصريًا لمهام المنصة التعليمية: التعلم، القبول والتسجيل، الدروس والواجبات، شؤون المتعلمين والمعلمين، والإرشاد والفعاليات التعليمية.\n\nالمنصة التعليمية: https://alirtiqaa-educational-platform.vercel.app/\n\nأرسل /help للخدمات التعليمية، أو /forget لمسح سياق محادثتك.";
      } else if (command === "/help") {
        reply = "أساعدك في مهام المنصة التعليمية فقط 😊 اكتب بطريقتك عن القبول والتسجيل أو الدروس والواجبات والمناهج والتقييم أو شؤون المتعلمين والمعلمين أو الإرشاد والفعاليات التعليمية.\n\n/services — المجالات التعليمية\n/events — الفعاليات التعليمية\n/contact — معلومات المنصة التعليمية\n/request — الاستفسار عن خدمة تعليمية\n/event_request — ترتيب فعالية تعليمية\n/forget — مسح سياق المحادثة المحفوظ مؤقتًا\n/tasks — مهام المنصة التعليمية المجدولة\n/done معرف_المهمة — إكمال مهمة تعليمية\n/cancel_task معرف_المهمة — إلغاء مهمة تعليمية\n/video_status معرف_المهمة — التحقق من مهمة فيديو تعليمية\n\nأي طلب خارج نطاق المنصة التعليمية لن تتم معالجته.";
      } else if (command === "/services") {
        reply = "المجالات التعليمية في دار الارتقاء الفكري:\n1. الطفولة والتأسيس\n2. التعليم الأساسي والعام\n3. التعليم الجامعي والعالي\n4. التدريب المهني والتقني\n5. القرآن والإسلامية\n6. التقوية والعربية والتأهيل\n7. الإرشاد الأكاديمي\n\nاكتب لي بشكل طبيعي ما تحتاجه، وسأساعدك في توضيحه أو ترتيبه.\nالمنصة التعليمية: https://alirtiqaa-educational-platform.vercel.app/";
      } else if (command === "/events") {
        reply = "أساعدك في تصميم خطة فعالية تعليمية فقط: الهدف، الفئة التعليمية، الفقرات، والمواد التحضيرية. لا أؤكد موعدًا أو اعتمادًا رسميًا قبل قرار الإدارة.\n\nالمنصة التعليمية: https://alirtiqaa-educational-platform.vercel.app/";
      } else if (command === "/contact") {
        reply = "للاستفسارات المتعلقة بالمنصة التعليمية استخدم صفحة الخدمات التعليمية فقط: https://alirtiqaa-educational-platform.vercel.app/\n\nلا يشارك هذا البوت قنوات تواصل أو سجلات أو مهام مع أي نشاط آخر.";
      } else if (command === "/video_status") {
        const partialId = incomingText.split(/\s+/)[1] || "";
        try {
          const result = await checkTelegramVideoJob(chatId, partialId, req.headers["x-vercel-oidc-token"] || "");
          if (result.status === "completed" && result.videoUrl) {
            const videoResponse = await fetch(`${TELEGRAM_API}/bot${token}/sendVideo`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: chatId,
                video: result.videoUrl,
                caption: "اكتمل المقطع المولّد آليًا لدار الارتقاء الفكري. يمكنك مراجعة النص المرافق قبل إعادة النشر."
              })
            });
            const videoResult = await videoResponse.json().catch(() => null);
            if (!videoResponse.ok || !videoResult?.ok) {
              console.error("TELEGRAM_VIDEO_DELIVERY_FAILED", { status: videoResponse.status });
              reply = "الفيديو جاهز، لكن تيليجرام تعذّر عليه تحميله من رابط المزوّد. حاول التحقق مرة أخرى لاحقًا.";
            } else {
              reply = null;
            }
          } else {
            reply = result.message || "لم تكتمل مهمة الفيديو بعد.";
          }
        } catch (error) {
          console.error("TELEGRAM_VIDEO_STATUS_HANDLER_FAILED", error?.message || "unknown error");
          reply = "تعذّر التحقق من حالة المقطع الآن. جرّب بعد قليل.";
        }
      } else if (command === "/tasks") {
        try {
          const tasks = await listTelegramTasks(chatId);
          if (!tasks.length) {
            reply = "قائمة مهامك هادئة الآن 🌿 عندما تطلب مني جدولة مهمة بتاريخ ووقت واضحين، سأضيفها هنا.";
          } else {
            const formatter = new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Riyadh" });
            reply = "هذه مهامك القادمة 📅\n\n" + tasks.map((task, index) =>
              (index + 1) + ". " + task.title + "\nالموعد: " + formatter.format(new Date(task.due_at)) +
              "\nالمعرّف: " + String(task.id).slice(0, 8) + (task.details ? "\n" + task.details : "")
            ).join("\n\n") + "\n\nلإكمال مهمة: /done ثم معرّفها. ولإلغائها: /cancel_task ثم معرّفها.";
          }
        } catch (error) {
          console.error("TELEGRAM_TASK_LIST_FAILED", error?.message || "unknown error");
          reply = "تعذّر فتح قائمة المهام الآن. حاول مرة أخرى لاحقًا.";
        }
      } else if (command === "/done" || command === "/cancel_task") {
        const partialId = incomingText.split(/\s+/)[1] || "";
        try {
          const result = await updateTelegramTaskStatus(chatId, partialId, command === "/done" ? "completed" : "cancelled");
          reply = result.ok
            ? result.message + "\n" + result.task.title
            : result.message;
        } catch (error) {
          console.error("TELEGRAM_TASK_STATUS_UPDATE_FAILED", error?.message || "unknown error");
          reply = "تعذّر تحديث المهمة الآن. جرّب مرة أخرى من فضلك.";
        }
      } else if (command === "/forget" || command === "/clear") {
        try {
          await clearTelegramHistory(chatId);
          reply = "تم مسح سياق المحادثة المحفوظ لهذا الحساب 🌿 نبدأ من جديد.";
        } catch {
          reply = "تعذّر مسح سياق المحادثة الآن. حاول مرة أخرى لاحقًا.";
        }
      } else if (command === "/request") {
        reply = "اكتب وصف الخدمة التعليمية التي تحتاجها، وسأساعدك في تحديد المجال والخطوة التالية. لا ترسل بيانات شخصية غير لازمة.";
      } else if (command === "/event_request") {
        reply = "اكتب فكرة الفعالية التعليمية، وسأساعدك في صياغة الهدف والفقرات والمواد التعليمية. لن أؤكد اعتمادًا أو موعدًا من دون قرار رسمي.";
      } else if (!incomingText.startsWith("/")) {
        // Free-form text goes directly to the assistant; no fixed-form intake.
      }

            if (!reply) {
        let taskIntentHandled = false;
        if (looksLikeTelegramTaskIntent(incomingText)) {
          const taskResult = await scheduleTelegramTask(chatId, incomingText, req.headers["x-vercel-oidc-token"] || "");
          if (taskResult.handled) {
            reply = taskResult.reply;
            taskIntentHandled = true;
          }
        }
        const wantsVideo = looksLikeTelegramVideoIntent(incomingText);
        const wantsImage = /(?:صمم|صمّم|أنشئ|انشئ|اصنع|ابتكر|جهّز|جهز|ارسم|تصميم|بوستر|برشور|ملصق|صورة دعائية|صورة تعليمية|generate an image|create an image|design a poster)/iu.test(incomingText);
        const wantsVoice = /(?:اقرأ(?:\s+لي)?\s+(?:بصوت|هذا|النص)|اقرا(?:\s+لي)?\s+(?:بصوت|هذا|النص)|حوّل\s+(?:هذا\s+)?النص\s+إلى\s+صوت|حول\s+(?:هذا\s+)?النص\s+إلى\s+صوت|رد\s+بصوت|ارسِل\s+صوت|أرسل\s+صوت|خلّيني\s+أسمع|خليني\s+اسمع|speak aloud|read aloud|voice reply|audio response|voice response|بصوت|صوتي)/iu.test(incomingText);
        if (taskIntentHandled) {
          // The scheduling helper already produced the task confirmation or one clarification question.
        } else if ((wantsVideo || wantsImage || wantsVoice) && !isEducationPlatformRequest(incomingText)) {
          reply = EDUCATION_SCOPE_REPLY;
        } else if (wantsVideo) {
          try {
            const result = await startTelegramVideo(chatId, incomingText, req.headers["x-vercel-oidc-token"] || "");
            reply = result.message || (result.ok ? "بدأت مهمة الفيديو." : "تعذّر بدء مهمة الفيديو.");
          } catch (error) {
            console.error("TELEGRAM_VIDEO_START_HANDLER_FAILED", error?.message || "unknown error");
            reply = "تعذّر بدء توليد الفيديو الآن. جرّب وصفًا أقصر أو عد لاحقًا.";
          }
        } else if (wantsImage) {
          try {
            const imageBytes = await generateTelegramImage(incomingText, req.headers["x-vercel-oidc-token"] || "", chatId);
            const photoForm = new FormData();
            photoForm.append("chat_id", String(chatId));
            photoForm.append("photo", new Blob([imageBytes], { type: "image/png" }), "dar-alirtiqaa-design.png");
            photoForm.append("caption", "تم إنشاء هذا التصور البصري باستخدام مولّد صور آلي. يمكنني أيضًا إعداد نص الإعلان المرافق له.");
            const photoResponse = await fetch(`${TELEGRAM_API}/bot${token}/sendPhoto`, { method: "POST", body: photoForm });
            const photoResult = await photoResponse.json().catch(() => null);
            if (!photoResponse.ok || !photoResult?.ok) {
              throw new Error("TELEGRAM_IMAGE_DELIVERY_FAILED");
            }
            reply = null;
          } catch (imageError) {
            console.error("TELEGRAM_IMAGE_REQUEST_FAILED", imageError?.message || "unknown error");
            reply = "أستطيع مساعدتك في إعداد التصميم، لكن إنشاء الصورة تعذّر فنيًا الآن. صف لي الفكرة وسأجهز لك وصفًا تصميميًا واضحًا إلى أن تعود الخدمة.";
          }
        } else if (wantsVoice) {
          try {
            reply = await generateAssistantReply(chatId, incomingText, req.headers["x-vercel-oidc-token"] || "");
            const textSend = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chat_id: chatId, text: reply, disable_web_page_preview: true })
            });
            const textResult = await textSend.json().catch(() => null);
            if (!textSend.ok || !textResult?.ok) throw new Error("TELEGRAM_VOICE_TEXT_DELIVERY_FAILED");

            const voice = /(?:صوت\s*رجالي|صوت\s*ذكوري|بصوت\s*رجل)/iu.test(incomingText)
              ? "onyx"
              : /(?:صوت\s*نسائي|صوت\s*أنثوي|بصوت\s*امرأة)/iu.test(incomingText)
                ? "nova"
                : /(?:بهدوء|صوت\s*هادئ)/iu.test(incomingText)
                  ? "coral"
                  : "shimmer";
            try {
              const speech = await synthesizeTelegramSpeech(reply, req.headers["x-vercel-oidc-token"] || "", voice);
              const audioForm = new FormData();
              audioForm.append("chat_id", String(chatId));
              audioForm.append("audio", new Blob([speech], { type: "audio/mpeg" }), "dar-alirtiqaa-reply.mp3");
              audioForm.append("caption", "رد صوتي مولّد آليًا.");
              const audioSend = await fetch(`${TELEGRAM_API}/bot${token}/sendAudio`, { method: "POST", body: audioForm });
              const audioResult = await audioSend.json().catch(() => null);
              if (!audioSend.ok || !audioResult?.ok) {
                throw new Error("TELEGRAM_VOICE_AUDIO_DELIVERY_FAILED");
              }
            } catch (speechError) {
              console.error("TELEGRAM_REQUESTED_TTS_FAILED", speechError?.message || "unknown error");
              await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ chat_id: chatId, text: "وصلتك الإجابة النصية، لكن تعذّر إنشاء الصوت الآن.", disable_web_page_preview: true })
              });
            }
            reply = null;
          } catch (error) {
            console.error("Telegram voice response failed", error?.message || "unknown error");
            reply = "أواجه تعثرًا مؤقتًا في إعداد الرد الصوتي. اكتب لي ما تريد وسأجيبك نصيًا الآن.";
          }
        } else {
          try {
            reply = await generateAssistantReply(chatId, incomingText, req.headers["x-vercel-oidc-token"] || "");
          } catch (error) {
            console.error("Telegram assistant reply failed", error?.message || "unknown error");
            reply = "أهلًا بك 🌿 أواجه تعثرًا مؤقتًا في الرد الآن. أرسل رسالتك مرة أخرى بعد قليل، أو استخدم /services و/contact للمعلومات الأساسية.";
          }
        }
      }

      if (reply) {
        try {
          const sendResponse = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: chatId, text: reply, disable_web_page_preview: true })
          });
          const sent = await sendResponse.json().catch(() => null);
          if (!sendResponse.ok || !sent?.ok) {
            console.error("Telegram command reply failed", { status: sendResponse.status, error_code: sent?.error_code });
          }
        } catch (error) {
          console.error("Telegram command reply request failed", error?.message || "unknown error");
        }
      }
    }
    return res.status(200).json({ ok: true });
  }

  return res.status(401).json({ ok: false, error: "Unauthorized webhook" });
}
