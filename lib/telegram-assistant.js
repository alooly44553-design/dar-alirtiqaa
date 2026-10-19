import { getDatabase } from "./neon-db.js";

const MODEL = process.env.TELEGRAM_AI_MODEL || "openai/gpt-6-luna";
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

export async function generateAssistantReply(chatId, text) {
  const userText = String(text || "").trim();
  if (!userText) return "أنا معك 🌿 اكتب لي ما تحتاجه وسأساعدك.";
  if (userText.length > 3000) return "وصلتني رسالتك، لكنها طويلة جدًا. أرسل الجزء الأهم وسأتابع معك.";
  const token = process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN;
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
        messages: [{ role: "system", content: SYSTEM }, ...history, { role: "user", content: userText }],
        max_completion_tokens: 650
      }),
      signal: AbortSignal.timeout(22000)
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
