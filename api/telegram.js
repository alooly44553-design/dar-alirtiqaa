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
    return res.status(200).json({
      ok: true,
      service: "telegram-channel",
      configured: Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_WEBHOOK_SECRET),
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
