const ALLOWED_SUPABASE_TABLES = new Set([
  "staff", "learners", "programs", "subjects", "classrooms", "enrollments",
  "edu_guardians", "edu_guardian_learners"
]);

function config() {
  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!base || !key) throw new Error("SUPABASE_AUTH_NOT_CONFIGURED");
  return { base, key };
}

const UUID = /^[0-9a-f-]{36}$/i;

async function supabaseRows(table, token, query = {}) {
  if (!ALLOWED_SUPABASE_TABLES.has(table)) throw new Error("SUPABASE_TABLE_NOT_ALLOWED");
  const { base, key } = config();
  const url = new URL("/rest/v1/" + table, base);
  for (const [name, value] of Object.entries(query)) {
    if (value !== undefined && value !== null) url.searchParams.set(name, String(value));
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
    headers: { apikey: key, Authorization: "Bearer " + token, Accept: "application/json" }
  });
  if (!response.ok) return null;
  const user = await response.json();
  if (!user || typeof user.id !== "string" || !UUID.test(user.id)) return null;

  const [staffRows, learnerRows, guardianRows, enrollments] = await Promise.all([
    supabaseRows("staff", token, {
      select: "id,full_name,job_title,auth_user_id,is_active,center_id",
      auth_user_id: "eq." + user.id,
      is_active: "eq.true",
      limit: "1"
    }),
    supabaseRows("learners", token, {
      select: "id,full_name,auth_user_id,is_active,center_id",
      auth_user_id: "eq." + user.id,
      is_active: "eq.true",
      limit: "1"
    }),
    supabaseRows("edu_guardians", token, {
      select: "id,full_name,auth_user_id,is_active",
      auth_user_id: "eq." + user.id,
      is_active: "eq.true",
      limit: "1"
    }),
    supabaseRows("enrollments", token, {
      select: "learner_id,program_id,classroom_id,status",
      status: "in.(active,enrolled)",
      limit: "500"
    })
  ]);
  const staff = staffRows[0] || null;
  const learner = learnerRows[0] || null;
  const guardian = guardianRows[0] || null;
  let guardianLearners = [];
  if (guardian) {
    const [links, legacyLearners] = await Promise.all([
      supabaseRows("edu_guardian_learners", token, {
        select: "learner_id,relationship,is_primary",
        guardian_id: "eq." + guardian.id,
        limit: "500"
      }),
      supabaseRows("learners", token, {
        select: "id,full_name,auth_user_id,guardian_user_id,is_active,center_id",
        guardian_user_id: "eq." + user.id,
        is_active: "eq.true",
        limit: "500"
      })
    ]);
    const linkMeta = new Map(links.map(link => [link.learner_id, link]));
    const linkedIds = [...new Set([
      ...links.map(link => link.learner_id),
      ...legacyLearners.map(row => row.id)
    ])];
    const linkedRows = linkedIds.length
      ? await supabaseRows("learners", token, {
          select: "id,full_name,auth_user_id,guardian_user_id,is_active,center_id",
          id: "in.(" + linkedIds.join(",") + ")",
          is_active: "eq.true",
          limit: "500"
        })
      : [];
    const childById = new Map([...legacyLearners, ...linkedRows].map(row => [row.id, row]));
    guardianLearners = [...childById.values()].map(row => {
      const link = linkMeta.get(row.id);
      return {
        ...row,
        relationship: link?.relationship || "ولي/وصي",
        is_primary: Boolean(link?.is_primary)
      };
    });
  }
  let catalog = { programs: [], subjects: [], classrooms: [] };
  if (staff) {
    const [programs, subjects, classrooms] = await Promise.all([
      supabaseRows("programs", token, { select: "id,name", is_active: "eq.true", order: "name.asc", limit: "500" }),
      supabaseRows("subjects", token, { select: "id,name", is_active: "eq.true", order: "name.asc", limit: "500" }),
      supabaseRows("classrooms", token, { select: "id,name", is_active: "eq.true", order: "name.asc", limit: "500" })
    ]);
    catalog = { programs, subjects, classrooms };
  }
  return {
    token,
    user: { id: user.id, email: typeof user.email === "string" ? user.email : "" },
    staff,
    learner,
    guardian,
    guardianLearners,
    enrollments,
    catalog
  };
}
