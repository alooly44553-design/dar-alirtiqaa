import { getDatabase, sendJson, cleanText } from "./neon-db.js";

const CONFIG_KEYS = ["ZOOM_ACCOUNT_ID", "ZOOM_CLIENT_ID", "ZOOM_CLIENT_SECRET", "ZOOM_HOST_USER_ID"];

async function adminUser(req) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token || !process.env.SUPABASE_URL || !process.env.SUPABASE_PUBLISHABLE_KEY) return null;

  const headers = {
    apikey: process.env.SUPABASE_PUBLISHABLE_KEY,
    Authorization: "Bearer " + token,
    "Content-Type": "application/json"
  };

  try {
    const [userRes, roleRes] = await Promise.all([
      fetch(process.env.SUPABASE_URL + "/auth/v1/user", { headers, signal: AbortSignal.timeout(7000) }),
      fetch(process.env.SUPABASE_URL + "/rest/v1/rpc/is_center_management_admin", {
        method: "POST",
        headers,
        body: "{}",
        signal: AbortSignal.timeout(7000)
      })
    ]);
    if (!userRes.ok || !roleRes.ok) return null;
    const [user, isAdmin] = await Promise.all([userRes.json(), roleRes.json()]);
    return isAdmin === true ? user : null;
  } catch (error) {
    console.error("ZOOM_ADMIN_AUTH_CHECK_FAILED", error?.name || "unknown");
    return null;
  }
}

function missingZoomKeys() {
  return CONFIG_KEYS.filter(key => !String(process.env[key] || "").trim());
}

function parseLocalDateTime(value) {
  if (typeof value !== "string") return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return null;
  const [, yy, mm, dd, hh, min, ss = "00"] = match;
  const parts = { year: Number(yy), month: Number(mm), day: Number(dd), hour: Number(hh), minute: Number(min), second: Number(ss) };
  if (parts.month < 1 || parts.month > 12 || parts.day < 1 || parts.day > 31 ||
      parts.hour > 23 || parts.minute > 59 || parts.second > 59) return null;
  const calendar = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  if (calendar.getUTCFullYear() !== parts.year || calendar.getUTCMonth() !== parts.month - 1 ||
      calendar.getUTCDate() !== parts.day) return null;
  return { parts, normalized: `${yy}-${mm}-${dd}T${hh}:${min}:${ss}` };
}

function zonedLocalToUtc(localValue, timeZone) {
  const parsed = parseLocalDateTime(localValue);
  if (!parsed) return null;
  let target = Date.UTC(
    parsed.parts.year, parsed.parts.month - 1, parsed.parts.day,
    parsed.parts.hour, parsed.parts.minute, parsed.parts.second
  );
  let guess = target;
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23"
  });

  try {
    for (let i = 0; i < 4; i++) {
      const fields = Object.fromEntries(formatter.formatToParts(new Date(guess)).map(part => [part.type, part.value]));
      const shownAsUtc = Date.UTC(
        Number(fields.year), Number(fields.month) - 1, Number(fields.day),
        Number(fields.hour), Number(fields.minute), Number(fields.second)
      );
      const offset = shownAsUtc - guess;
      guess = target - offset;
    }
    const check = Object.fromEntries(formatter.formatToParts(new Date(guess)).map(part => [part.type, part.value]));
    const validWallClock = Number(check.year) === parsed.parts.year &&
      Number(check.month) === parsed.parts.month && Number(check.day) === parsed.parts.day &&
      Number(check.hour) === parsed.parts.hour && Number(check.minute) === parsed.parts.minute &&
      Number(check.second) === parsed.parts.second;
    if (!validWallClock) return null;
    return { local: parsed.normalized, utc: new Date(guess).toISOString() };
  } catch {
    return null;
  }
}

async function zoomAccessToken() {
  const accountId = process.env.ZOOM_ACCOUNT_ID;
  const clientId = process.env.ZOOM_CLIENT_ID;
  const clientSecret = process.env.ZOOM_CLIENT_SECRET;
  const credentials = Buffer.from(clientId + ":" + clientSecret).toString("base64");
  const url = new URL("https://zoom.us/oauth/token");
  url.searchParams.set("grant_type", "account_credentials");
  url.searchParams.set("account_id", accountId);
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: "Basic " + credentials,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: "",
    signal: AbortSignal.timeout(8000)
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.access_token) {
    console.error("ZOOM_OAUTH_FAILED", response.status);
    const error = new Error("ZOOM_AUTH_FAILED");
    error.publicCode = "ZOOM_AUTH_FAILED";
    throw error;
  }
  return data.access_token;
}

export async function handleZoomMeetings(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (!["GET", "POST"].includes(req.method)) {
    res.setHeader("Allow", "GET, POST");
    return sendJson(res, 405, { error: "METHOD_NOT_ALLOWED" });
  }

  try {
    const user = await adminUser(req);
    if (!user) return sendJson(res, 401, { error: "ADMIN_AUTH_REQUIRED" });

    if (req.method === "GET") {
      const missing = missingZoomKeys();
      let meetings;
      try {
        const sql = getDatabase("education");
        meetings = await sql`
          SELECT id, zoom_meeting_id, topic, agenda, start_time, timezone,
                 duration_minutes, join_url, passcode, status, created_at
          FROM education.zoom_meetings
          ORDER BY start_time DESC
          LIMIT 50
        `;
      } catch (error) {
        console.error("ZOOM_MEETINGS_LIST_FAILED", error?.code || error?.name || "unknown");
        return sendJson(res, 503, { error: "ZOOM_MEETING_STORE_UNAVAILABLE" });
      }
      return sendJson(res, 200, {
        ok: true,
        service: "zoom-meetings",
        configured: missing.length === 0,
        missing,
        meetings
      });
    }

    const missing = missingZoomKeys();
    if (missing.length) {
      return sendJson(res, 503, { error: "ZOOM_NOT_CONFIGURED", missing });
    }

    const body = req.body && typeof req.body === "object" ? req.body : {};
    const topic = cleanText(body.topic, 200);
    const agenda = cleanText(body.agenda, 2000);
    const timezone = cleanText(body.timezone, 80);
    const duration = Number(body.duration);
    const validTimeZone = (() => {
      try { new Intl.DateTimeFormat("en-US", { timeZone: timezone }); return true; }
      catch { return false; }
    })();
    if (topic.length < 4 || !validTimeZone || !Number.isInteger(duration) || duration < 15 || duration > 480) {
      return sendJson(res, 400, { error: "INVALID_MEETING_FIELDS" });
    }

    const schedule = zonedLocalToUtc(body.start_time, timezone);
    if (!schedule || new Date(schedule.utc).getTime() < Date.now() + 120000) {
      return sendJson(res, 400, { error: "INVALID_OR_PAST_START_TIME" });
    }

    const accessToken = await zoomAccessToken();
    const hostUserId = String(process.env.ZOOM_HOST_USER_ID || "").trim();
    const response = await fetch("https://api.zoom.us/v2/users/" + encodeURIComponent(hostUserId) + "/meetings", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + accessToken,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        topic,
        type: 2,
        start_time: schedule.local,
        duration,
        timezone,
        agenda,
        settings: {
          waiting_room: true,
          join_before_host: false,
          mute_upon_entry: true,
          auto_recording: "none"
        }
      }),
      signal: AbortSignal.timeout(8000)
    });
    const meeting = await response.json().catch(() => null);
    if (!response.ok || !meeting?.join_url || !meeting?.id) {
      console.error("ZOOM_MEETING_CREATE_FAILED", response.status);
      return sendJson(res, 502, { error: "ZOOM_MEETING_CREATE_FAILED" });
    }

    let savedRecord = null;
    try {
      const sql = getDatabase("education");
      const saved = await sql`
        INSERT INTO education.zoom_meetings
          (zoom_meeting_id, topic, agenda, start_time, timezone, duration_minutes,
           join_url, passcode, created_by, status)
        VALUES
          (${String(meeting.id)}, ${meeting.topic || topic}, ${agenda},
           ${schedule.utc}::timestamptz, ${timezone}, ${duration},
           ${meeting.join_url}, NULLIF(${meeting.password || ""}, ''),
           ${user.id}::uuid, 'scheduled')
        RETURNING id, created_at
      `;
      savedRecord = saved[0] || null;
    } catch (error) {
      console.error("ZOOM_MEETING_RECORD_SAVE_FAILED", error?.code || error?.name || "unknown");
    }

    // Return only participant-facing details; the privileged host launch URL is never sent to the browser.
    return sendJson(res, 201, {
      ok: true,
      meeting: {
        id: String(meeting.id),
        topic: meeting.topic || topic,
        join_url: meeting.join_url,
        passcode: meeting.password || "",
        start_time: meeting.start_time || schedule.local,
        timezone,
        duration,
        saved: Boolean(savedRecord),
        record_id: savedRecord?.id || null,
        saved_at: savedRecord?.created_at || null
      }
    });
  } catch (error) {
    if (error?.publicCode) return sendJson(res, 502, { error: error.publicCode });
    console.error("ZOOM_MEETINGS_API_FAILED", error?.name || "unknown");
    return sendJson(res, 502, { error: "ZOOM_UPSTREAM_UNAVAILABLE" });
  }
}
