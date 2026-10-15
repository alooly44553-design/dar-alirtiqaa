import { getDatabase, sendJson, cleanText } from "../../lib/neon-db.js";

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
    // Validate the bearer token and the administrative role concurrently.
    // Sequential Supabase round-trips could exhaust Vercel's 10-second runtime.
    const [userRes, roleRes] = await Promise.all([
      fetch(process.env.SUPABASE_URL + "/auth/v1/user", { headers }),
      fetch(process.env.SUPABASE_URL + "/rest/v1/rpc/is_center_management_admin", {
        method: "POST", headers, body: "{}"
      })
    ]);
    if (!userRes.ok || !roleRes.ok) return null;
    const [user, isAdmin] = await Promise.all([userRes.json(), roleRes.json()]);
    if (isAdmin !== true) return null;
    return user;
  } catch (error) {
    console.error("ADMIN_AUTH_CHECK_FAILED", error?.name || "unknown");
    return null;
  }
}

export default async function handler(req, res) {
  if (!["GET", "PATCH"].includes(req.method)) {
    res.setHeader("Allow", "GET, PATCH");
    return sendJson(res, 405, { error: "METHOD_NOT_ALLOWED" });
  }
  try {
    const user = await adminUser(req);
    if (!user) return sendJson(res, 401, { error: "ADMIN_AUTH_REQUIRED" });
    const sql = getDatabase("education");

    if (req.method === "GET") {
      const requests = await sql`
        SELECT r.id, r.request_number AS submission_number,
               r.applicant_name, r.phone AS applicant_phone, r.applicant_email,
               r.payload AS submission_data, r.consent_given, r.status,
               r.management_note, r.documented, r.document_reference, r.created_at,
               followup.status AS follow_up_status,
               followup.due_at AS follow_up_due_at,
               followup.assigned_to AS follow_up_assigned_to,
               json_build_object(
                 'service_name', s.service_name,
                 'service_category', s.service_category,
                 'registration_method_label', s.registration_method_label
               ) AS service_catalog
        FROM education.service_requests r
        JOIN education.service_catalog s ON s.service_code = r.service_code
        LEFT JOIN LATERAL (
          SELECT t.status, t.due_at, t.assigned_to
          FROM education.tasks t
          WHERE POSITION(r.request_number IN COALESCE(t.description, '')) > 0
          ORDER BY t.created_at DESC
          LIMIT 1
        ) AS followup ON true
        ORDER BY r.created_at DESC
        LIMIT 100
      `;
      return sendJson(res, 200, { ok: true, requests });
    }

    const body = req.body && typeof req.body === "object" ? req.body : {};
    const id = cleanText(body.id, 64);
    const action = cleanText(body.action, 20);
    const note = cleanText(typeof body.management_note === "string" ? body.management_note : "", 1000);
    const documentReference = cleanText(typeof body.document_reference === "string" ? body.document_reference : "", 200);
    if (!/^[0-9a-f-]{36}$/i.test(id)) {
      return sendJson(res, 400, { error: "INVALID_REQUEST_ID" });
    }

    let changed;
    if (action === "accept") {
      changed = await sql`
        UPDATE education.service_requests
        SET status = 'approved', management_note = NULLIF(${note}, ''), updated_at = now()
        WHERE id = ${id}::uuid
        RETURNING id, request_number, status, management_note, documented, document_reference
      `;
    } else if (action === "reject") {
      changed = await sql`
        UPDATE education.service_requests
        SET status = 'rejected', management_note = NULLIF(${note}, ''), updated_at = now()
        WHERE id = ${id}::uuid
        RETURNING id, request_number, status, management_note, documented, document_reference
      `;
    } else if (action === "document") {
      changed = await sql`
        UPDATE education.service_requests
        SET documented = true, documented_at = now(),
            document_reference = NULLIF(${documentReference}, ''),
            management_note = NULLIF(${note}, ''), updated_at = now()
        WHERE id = ${id}::uuid
        RETURNING id, request_number, status, management_note, documented, documented_at, document_reference
      `;
    } else {
      return sendJson(res, 400, { error: "INVALID_ACTION" });
    }
    if (!changed.length) return sendJson(res, 404, { error: "SERVICE_REQUEST_NOT_FOUND" });
    if (action === "accept" || action === "reject") {
      try {
        await sql`
          UPDATE education.tasks
          SET status = 'completed', updated_at = now()
          WHERE status IN ('open', 'in_progress')
            AND POSITION(${changed[0].request_number} IN COALESCE(description, '')) > 0
        `;
      } catch (taskError) {
        console.error("SERVICE_REQUEST_FOLLOWUP_CLOSE_FAILED", taskError?.code || "unknown");
      }
    }
    return sendJson(res, 200, { ok: true, request: changed[0] });
  } catch (error) {
    const status = error.statusCode || 500;
    return sendJson(res, status, {
      error: status === 503 ? error.message : "SERVICE_REQUEST_ADMIN_FAILED"
    });
  }
}
