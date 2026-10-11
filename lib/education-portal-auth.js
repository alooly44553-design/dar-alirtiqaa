function config() {
  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!base || !key) throw new Error("SUPABASE_AUTH_NOT_CONFIGURED");
  return { base, key };
}

const UUID = /^[0-9a-f-]{36}$/i;

export async function resolvePortalIdentity(req) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return null;

  const { base, key } = config();
  const commonHeaders = {
    apikey: key,
    Authorization: "Bearer " + token,
    Accept: "application/json"
  };
  const userResponse = await fetch(new URL("/auth/v1/user", base), {
    headers: commonHeaders
  });
  if (!userResponse.ok) return null;
  const user = await userResponse.json();
  if (!user || typeof user.id !== "string" || !UUID.test(user.id)) return null;

  // This narrowly scoped RPC is required because current RLS intentionally hides
  // staff/catalog/enrollment rows from ordinary users on direct Data API queries.
  // Its SECURITY DEFINER body scopes every result to auth.uid() and the staff center.
  const contextResponse = await fetch(new URL("/rest/v1/rpc/get_school_portal_context", base), {
    method: "POST",
    headers: {
      ...commonHeaders,
      "Content-Type": "application/json"
    },
    body: "{}"
  });
  if (!contextResponse.ok) throw new Error("SCHOOL_PORTAL_CONTEXT_FAILED");
  const context = await contextResponse.json();
  if (!context || typeof context !== "object" || Array.isArray(context)) {
    throw new Error("SCHOOL_PORTAL_CONTEXT_INVALID");
  }

  const staff = context.staff && UUID.test(String(context.staff.id || "")) ? context.staff : null;
  const learner = context.learner && UUID.test(String(context.learner.id || "")) ? context.learner : null;
  const rawEnrollments = Array.isArray(context.enrollments) ? context.enrollments : [];
  const enrollments = rawEnrollments.filter(row =>
    row && (row.program_id == null || UUID.test(String(row.program_id))) &&
    (row.classroom_id == null || UUID.test(String(row.classroom_id)))
  );
  const rawCatalog = context.catalog && typeof context.catalog === "object" ? context.catalog : {};
  const safeCatalogRows = (rows) => Array.isArray(rows) ? rows.filter(row =>
    row && UUID.test(String(row.id || "")) && typeof row.name === "string"
  ) : [];
  const catalog = {
    programs: safeCatalogRows(rawCatalog.programs),
    subjects: safeCatalogRows(rawCatalog.subjects),
    classrooms: safeCatalogRows(rawCatalog.classrooms)
  };

  return {
    token,
    user: { id: user.id, email: typeof user.email === "string" ? user.email : "" },
    staff,
    learner,
    enrollments,
    catalog
  };
}
