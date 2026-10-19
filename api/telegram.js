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
          ...(webhookConfiguration === null ? {} : { webhookConfigured: webhookConfiguration })
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
    if (chatId && incomingText) {
      const command = incomingText.split(/\s+/)[0].split("@")[0].toLowerCase();
      let reply = null;
      if (command === "/start") {
        reply = "مرحبًا بك في بوت دار الارتقاء الفكري التعليمي 🎓\n\nأنا مساعد لتنظيم الفعاليات والأنشطة وإعداد المحتوى والتنسيق الإعلامي.\n\nاستخدم /help لمعرفة الأوامر المتاحة.\n\nقناة تيليجرام الرسمية: https://t.me/DarAlIrtiqaAlFikri\nالمنصة التعليمية: https://alirtiqaa-educational-platform.vercel.app/";
      } else if (command === "/help") {
        reply = "الأوامر المتاحة:\n/start — بدء استخدام البوت والتعريف بالخدمات\n/help — عرض هذه المساعدة\n/services — المجالات والخدمات التعليمية\n/events — معلومات متابعة الفعاليات\n/contact — روابط التواصل الرسمية\n/request — تقديم طلب خدمة تعليمي\n/event_request — إرسال مقترح فعالية للمراجعة\n\nملاحظة: طلبات الخدمة ومقترحات الفعاليات تُحفظ للمراجعة؛ لا تتم جدولة الفعاليات آليًا.";
      } else if (command === "/services") {
        reply = "المجالات التعليمية في دار الارتقاء الفكري:\n1. الطفولة والتأسيس\n2. التعليم الأساسي والعام\n3. التعليم الجامعي والعالي\n4. التدريب المهني والتقني\n5. القرآن والإسلامية\n6. التقوية والعربية والتأهيل\n7. الإرشاد الأكاديمي\n\nللاطلاع على المنصة وبدء طلب خدمة:\nhttps://alirtiqaa-educational-platform.vercel.app/";
      } else if (command === "/events") {
        reply = "لمتابعة خدمات وفعاليات دار الارتقاء الفكري التعليمية، يرجى متابعة القناة الرسمية.\n\nالقناة الرسمية: https://t.me/DarAlIrtiqaAlFikri\nالمنصة التعليمية: https://alirtiqaa-educational-platform.vercel.app/\n\nتنبيه: إدارة الفعاليات وجدولتها آليًا من داخل البوت ليست مفعّلة بعد.";
      } else if (command === "/contact") {
        reply = "روابط التواصل الرسمية:\nقناة تيليجرام: https://t.me/DarAlIrtiqaAlFikri\nالمنصة التعليمية: https://alirtiqaa-educational-platform.vercel.app/\n\nاتصال مدارس البنين: 0538216050\nاتصال مدارس البنات: 0538838891";
      } else if (command === "/request") {
        reply = "لتقديم طلب خدمة تعليمي، أرسل رسالة واحدة بهذا التنسيق:\n\nطلب | أوافق | الاسم الكامل | رقم الهاتف | رقم المجال (1-7) | وصف الخدمة\n\nالمجالات:\n" +
          EDUCATIONAL_FIELDS.map((field, index) => (index + 1) + ". " + field).join("\n") +
          "\n\nمثال توضيحي: طلب | أوافق | أحمد محمد | 777123456 | 2 | أحتاج إلى دروس تقوية في الرياضيات\n\nبإرسال الطلب فأنت توافق على مراجعة الطلب واستخدام بياناتك بالقدر اللازم لتنفيذ الخدمة. لن يُنشر رقم هاتفك في القناة العامة.";
      } else if (command === "/event_request") {
        reply = "لإرسال مقترح فعالية للمراجعة، أرسل رسالة واحدة بهذا التنسيق:\n\nفعالية | أوافق | الاسم الكامل | رقم الهاتف | التاريخ والوقت المقترح | وصف الفعالية\n\nمثال توضيحي: فعالية | أوافق | أحمد محمد | 777123456 | 2026-11-10 17:00 | ورشة تعريفية بالبرامج التعليمية\n\nبإرسال الطلب فأنت توافق على مراجعة الطلب واستخدام بياناتك بالقدر اللازم لتنفيذ الخدمة. يُحفظ المقترح للمراجعة فقط؛ لا يعني ذلك اعتماد الفعالية أو جدولتها آليًا.";
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
                reply = (isEvent ? "تم استلام مقترح الفعالية وحفظه في نظام الطلبات للمراجعة. رقم الطلب: " : "تم استلام طلب الخدمة وحفظه في نظام الطلبات للمراجعة. رقم الطلب: ") +
                  submitted.request.request_number +
                  (isEvent ? "\n\nهذا تأكيد استلام للمراجعة وليس اعتمادًا أو جدولة للفعالية." : "\n\nستراجع الإدارة الطلب؛ الاستلام لا يعني القبول النهائي.");
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
