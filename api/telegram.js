import { timingSafeEqual } from "node:crypto";

const CHANNEL_ID = "@DarAlIrtiqaAlFikri";
const TELEGRAM_API = "https://api.telegram.org";

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
          canPostMessages: Boolean(canPost)
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
      const command = incomingText.split(/\\s+/)[0].split("@")[0].toLowerCase();
      let reply = null;
      if (command === "/start") {
        reply = "مرحبًا بك في بوت دار الارتقاء الفكري التعليمي 🎓\\n\\nأنا مساعد لتنظيم الفعاليات والأنشطة وإعداد المحتوى والتنسيق الإعلامي.\\n\\nاستخدم /help لمعرفة الأوامر المتاحة.\\n\\nقناة تيليجرام الرسمية: https://t.me/DarAlIrtiqaAlFikri\\nالمنصة التعليمية: https://alirtiqaa-educational-platform.vercel.app/";
      } else if (command === "/help") {
        reply = "الأوامر المتاحة:\\n/start — بدء استخدام البوت والتعريف بالخدمات\\n/help — عرض هذه المساعدة\\n\\nيمكنك استخدام البوت لمتابعة خدمات وفعاليات دار الارتقاء الفكري التعليمية.";
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
