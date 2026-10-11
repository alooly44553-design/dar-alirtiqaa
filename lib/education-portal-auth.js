const ALLOWED_SUPABASE_TABLES = new Set([
  "staff", "learners", "programs", "subjects", "classrooms", "enrollments"
]);

function config() {
  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!base || !key) throw new Error("SUPABASE_AUTH_NOT_CONFIGURED");
  return { base, key };
}

export async function supabaseRows(table, token, query = {}) {
  if (!ALLOWED_SUPABASE_TABLES.has(table)) throw new Error("SUPABASE_TABLE_NOT_ALLOWED");
  const { base, key } = config();
  const url = new URL("/rest/v1/" + table, base);
  for (const [name, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue;
    url.searchParams.set(name, String(value));
  }
  const response = await fetch(url, {
    headers: {
      apikey: key,
      Authorization: "Bearer " + token,
      Accept: "application/json"
    }
  });
  if (!response.ok) throw new Error("SUPABASE_PROFILE_LOOKUP_FAILED");
  const rows = await response.json();
  if (!Array.isArray(rows)) throw new Error("SUPABASE_PROFILE_RESPONSE_INVALID");
  return rows;
}

export async function resolvePortalIdentity(req) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return null;
  const { base, key } = config();
  const response = await fetch(new URL("/auth/v1/user", base), {
    headers: {
      apikey: key,
      Authorization: "Bearer " + token,
      Accept: "application/json"
    }
  });
  if (!response.ok) return null;
  const user = await response.json();
  if (!user || typeof user.id !== "string" || !/^[0-9a-f-]{36}$/i.test(user.id)) return null;

  const [staffRows, learnerRows] = await Promise.all([
    supabaseRows("staff", token, {
      select: "id,full_name,job_title,auth_user_id,is_active",
      auth_user_id: "eq." + user.id,
      is_active: "eq.true",
      limit: "1"
    }),
    supabaseRows("learners", token, {
      select: "id,full_name,auth_user_id,is_active",
      auth_user_id: "eq." + user.id,
      is_active: "eq.true",
      limit: "1"
    })
  ]);
  return {
    token,
    user: { id: user.id, email: typeof user.email === "string" ? user.email : "" },
    staff: staffRows[0] || null,
    learner: learnerRows[0] || null
  };
}
