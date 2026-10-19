import { generateAssistantReply, clearTelegramHistory, transcribeTelegramAudio, generateTelegramImage, synthesizeTelegramSpeech } from "../lib/telegram-assistant.js";
import { timingSafeEqual } from "node:crypto";

const CHANNEL_ID = "@DarAlIrtiqaAlFikri";
const TELEGRAM_API = "https://api.telegram.org";
const EDUCATION_REQUESTS_URL = "https://alirtiqaa-educational-platform.vercel.app/api/education/service-requests";
const EDUCATIONAL_FIELDS = ["الطفولة والتأسيس", "التعليم الأساسي والعام", "التعليم الجامعي والعالي", "التدريب المهني والتقني", "القرآن والإسلامية", "التقوية والعربية والتأهيل", "الإرشاد الأكاديمي"];

function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || !a || !b) return false;
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "GET") {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;

    if (!token || !expectedSecret) {
      return res.status(200).json({
        ok: true,
        service: "telegram-channel",
        configured: false,
        destination: CHANNEL_ID
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
            destination: CHANNEL_ID
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
                  { command: "events", description: "التخطيط للفعاليات" },
                  { command: "contact", description: "التواصل مع المؤسسة" },
                  { command: "request", description: "التحدث عن خدمة تعليمية" },
                  { command: "event_request", description: "تطوير فكرة فعالية" },
                  { command: "forget", description: "مسح سياق المحادثة" }
                ]
              })
            });
            const menuResult = await menuResponse.json().catch(() => null);
            commandMenuConfigured = Boolean(menuResponse.ok && menuResult?.ok);
          } catch {
            commandMenuConfigured = false;
          }
        }
        const memberUrl = new URL(`${TELEGRAM_API}/bot${token}/getChatMember`);
        memberUrl.searchParams.set("chat_id", CHANNEL_ID);
        memberUrl.searchParams.set("user_id", String(me.result.id));
        const memberResponse = await fetch(memberUrl);
        const member = await memberResponse.json().catch(() => null);
        const status = member?.ok ? member.result?.status : null;
        const isAdmin = status === "administrator" || status === "creator";
        const canPost = status === "creator" ||
          (status === "administrator" && member.result?.can_post_messages !== false);

        return res.status(200).json({
          ok: true,
          configured: true,
          botTokenValid: true,
          botUsername: me.result.username ?? null,
          destination: CHANNEL_ID,
          channelMembershipChecked: Boolean(member?.ok),
          botIsAdmin: isAdmin,
          canPostMessages: Boolean(canPost),
          ...(webhookConfiguration === null ? {} : { webhookConfigured: webhookConfiguration }),
          ...(commandMenuConfigured === null ? {} : { commandMenuConfigured })
        });
      } catch {
        return res.status(200).json({
          ok: true,
          configured: true,
          diagnosticUnavailable: true,
          destination: CHANNEL_ID
        });
      }
    }

    return res.status(200).json({
      ok: true,
      service: "telegram-channel",
      configured: true,
      destination: CHANNEL_ID
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
    const incomingText = typeof message?.text === "string" ? message.text.trim() : "";
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
      if (command === "/start") {
        reply = "يا هلا بك في دار الارتقاء الفكري 🌱\n\nأنا المساعد الرقمي للمؤسسة. لا تحتاج إلى صيغة خاصة؛ اكتب لي مباشرة ما تريد، سواء كان سؤالًا تعليميًا أو فكرة نشاط أو كتابة أو تصحيحًا أو محتوى إعلاميًا.\n\nقناة المؤسسة: https://t.me/DarAlIrtiqaAlFikri\nالمنصة: https://alirtiqaa-educational-platform.vercel.app/\n\nأرسل /help للخدمات الأساسية، أو /forget لمسح سياق محادثتك المحفوظ مؤقتًا.";
      } else if (command === "/help") {
        reply = "أنا هنا لمساعدتك مباشرة، وليس عليك الالتزام بقوالب أو قوائم طويلة 😊\n\nاكتب بطريقتك المعتادة عن التعليم أو التسجيل أو الأنشطة أو الخطط أو الكتابة والإملاء والتصحيح أو إعداد الإعلانات والمنشورات.\n\n/services — المجالات التعليمية\n/events — المساعدة في تخطيط الفعاليات\n/contact — قنوات وأرقام التواصل\n/request — بدء حديث عن خدمة تحتاجها\n/event_request — ترتيب فكرة فعالية\n/forget — مسح سياق المحادثة المحفوظ مؤقتًا\n\nقناة المؤسسة: https://t.me/DarAlIrtiqaAlFikri";
      } else if (command === "/services") {
        reply = "المجالات التعليمية في دار الارتقاء الفكري:\n1. الطفولة والتأسيس\n2. التعليم الأساسي والعام\n3. التعليم الجامعي والعالي\n4. التدريب المهني والتقني\n5. القرآن والإسلامية\n6. التقوية والعربية والتأهيل\n7. الإرشاد الأكاديمي\n\nاكتب لي بشكل طبيعي ما تحتاجه، وسأساعدك في توضيحه أو ترتيبه.\nالمنصة التعليمية: https://alirtiqaa-educational-platform.vercel.app/";
      } else if (command === "/events") {
        reply = "أكيد 🌿 أقدر أساعدك في ابتكار فكرة فعالية، وترتيب أهدافها وفقراتها وكتابة إعلانها وخطتها. أما تثبيت الموعد واعتماد الفعالية رسميًا فلا أؤكده من داخل المحادثة.\n\nتابع أخبار المؤسسة هنا: https://t.me/DarAlIrtiqaAlFikri\nوالمنصة: https://alirtiqaa-educational-platform.vercel.app/";
      } else if (command === "/contact") {
        reply = "روابط التواصل الرسمية:\nقناة تيليجرام: https://t.me/DarAlIrtiqaAlFikri\nالمنصة التعليمية: https://alirtiqaa-educational-platform.vercel.app/\n\nاتصال مدارس البنين: 0538216050\nاتصال مدارس البنات: 0538838891";
      } else if (command === "/forget" || command === "/clear") {
        try {
          await clearTelegramHistory(chatId);
          reply = "تم مسح سياق المحادثة المحفوظ لهذا الحساب 🌿 نبدأ من جديد.";
        } catch {
          reply = "تعذّر مسح سياق المحادثة الآن. حاول مرة أخرى لاحقًا.";
        }
      } else if (command === "/request") {
        reply = "أبشر، ما يحتاج تكتب بصيغة معينة 🌱 احكِ لي ببساطة ما الخدمة التعليمية التي تبحث عنها، وسأساعدك في تحديد المجال وترتيب الخطوة الأنسب. لا ترسل بيانات شخصية إلا إذا كانت ضرورية لإتمام طلبك.";
      } else if (command === "/event_request") {
        reply = "هات فكرة الفعالية بطريقتك، حتى لو كانت مجرد فكرة أولية 😊 أساعدك في تطويرها وتحديد الهدف والجمهور والفقرات وكتابة الإعلان. ولن أقول إن الفعالية اعتمدت أو حُجز لها موعد قبل تأكيد رسمي.";
      } else if (!incomingText.startsWith("/")) {
        const parts = incomingText.split("|").map(part => part.trim());
        if (parts.length >= 6 && (parts[0] === "طلب" || parts[0] === "فعالية")) {
          const isEvent = parts[0] === "فعالية";
          const consentText = "أوافق على مراجعة الطلب واستخدام بياناتي بالقدر اللازم لتنفيذ الخدمة.";
          const applicantName = parts[2];
          const phone = parts[3];
          const categoryNumber = Number(parts[4]);
          const eventDate = parts[4];
          const description = parts.slice(5).join(" | ").slice(0, 2000);
          const validPhone = /^[+0-9 ()-]{7,30}$/.test(phone);
          const validConsent = parts[1] === "أوافق";
          if (!validConsent || applicantName.length < 2 || !validPhone || description.length < 5 ||
              (!isEvent && (!Number.isInteger(categoryNumber) || categoryNumber < 1 || categoryNumber > EDUCATIONAL_FIELDS.length)) ||
              (isEvent && eventDate.length < 4)) {
            reply = isEvent
              ? "تعذر فهم مقترح الفعالية أو لم يتم تأكيد الموافقة. أرسل /event_request لعرض الصيغة الصحيحة."
              : "تعذر فهم طلب الخدمة أو لم يتم تأكيد الموافقة. أرسل /request لعرض الصيغة الصحيحة.";
          } else {
            try {
              const fieldName = isEvent ? "مقترح فعالية" : EDUCATIONAL_FIELDS[categoryNumber - 1];
              const details = isEvent
                ? "التاريخ والوقت المقترح: " + eventDate.slice(0, 120) + "\nتفاصيل الفعالية: " + description
                : "المجال التعليمي: " + fieldName + "\nتفاصيل الطلب: " + description;
              const submission = await fetch(EDUCATION_REQUESTS_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  service_code: "general_service",
                  consent_given: validConsent,
                  consent_text: consentText,
                  applicant_name: applicantName,
                  applicant_phone: phone,
                  service_name: fieldName,
                  details,
                  notes: "مصدر الطلب: بوت تيليجرام. " + (isEvent ? "مقترح فعالية للمراجعة، دون اعتماد أو جدولة تلقائية." : "طلب خدمة تعليمية للمراجعة.")
                })
              });
              const submitted = await submission.json().catch(() => null);
              if (submission.ok && submitted?.ok && submitted?.request?.request_number) {
                reply = (isEvent ? "وصلني مقترح الفعالية وسجلته للمراجعة 🌿\nرقم المتابعة: " : "تمام، وصلني طلبك وسجلته للمراجعة 🌿\nرقم المتابعة: ") +
                  submitted.request.request_number +
                  (isEvent ? "\nستراجعه الإدارة، ويظل الموعد مقترحًا حتى تأكيده رسميًا." : "\nستراجعه الإدارة، والتسجيل هنا تأكيد استلام وليس موافقة نهائية.");
              } else {
                console.error("Telegram request submission failed", { status: submission.status, error: submitted?.error });
                reply = "لم أتمكن من حفظ الطلب الآن. يرجى المحاولة لاحقًا أو تقديم الطلب عبر المنصة:\nhttps://alirtiqaa-educational-platform.vercel.app/";
              }
            } catch (error) {
              console.error("Telegram request submission request failed", error?.message || "unknown error");
              reply = "تعذر الاتصال بنظام الطلبات الآن. يرجى المحاولة لاحقًا أو استخدام المنصة التعليمية:\nhttps://alirtiqaa-educational-platform.vercel.app/";
            }
          }
        }
      }


      if (!reply && !incomingText.startsWith("/")) {
        const wantsImage = /(?:صمم|صمّم|أنشئ|انشئ|اصنع|ابتكر|جهّز|جهز|ارسم|تصميم|بوستر|برشور|ملصق|صورة دعائية|صورة تعليمية|generate an image|create an image|design a poster)/iu.test(incomingText);
        if (wantsImage) {
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

  const authorization = req.headers.authorization || "";
  const suppliedSecret = authorization.startsWith("Bearer ")
    ? authorization.slice(7)
    : "";

  if (!safeEqual(suppliedSecret, expectedSecret)) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }

  const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
  if (!text || text.length > 4096) {
    return res.status(400).json({ ok: false, error: "Provide text between 1 and 4096 characters" });
  }

  try {
    const response = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: CHANNEL_ID,
        text,
        disable_web_page_preview: true
      })
    });

    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.ok) {
      console.error("Telegram sendMessage failed", {
        status: response.status,
        error_code: result?.error_code
      });
      return res.status(502).json({ ok: false, error: "Telegram rejected the message" });
    }

    return res.status(200).json({
      ok: true,
      message_id: result.result?.message_id ?? null,
      destination: CHANNEL_ID
    });
  } catch (error) {
    console.error("Telegram request failed", error?.message || "unknown error");
    return res.status(502).json({ ok: false, error: "Unable to reach Telegram" });
  }
}
