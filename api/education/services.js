import { getDatabase, sendJson } from "../../lib/neon-db.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return sendJson(res, 405, { error: "METHOD_NOT_ALLOWED" });
  }
  try {
    const sql = getDatabase("education");
    if (req.query?.health === "1") {
      const [databaseIdentity] = await sql`
        SELECT current_database() AS database_name,
               current_user AS role_name,
               has_schema_privilege(current_user, 'education', 'USAGE') AS education_schema_usage
      `;
      const expectedBranch = process.env.EDUCATION_QA_NEON_BRANCH_ID;
      const expectedDatabase = process.env.EDUCATION_QA_NEON_DATABASE;
      const expectedRole = process.env.EDUCATION_QA_NEON_ROLE;
      const expectedHost = process.env.EDUCATION_QA_NEON_ENDPOINT_HOST;
      if (expectedBranch || expectedDatabase || expectedRole || expectedHost) {
        let configuredHost = "";
        try {
          configuredHost = new URL(process.env.DATABASE_URL || "").hostname;
        } catch {
          configuredHost = "";
        }
        const verified =
          Boolean(expectedBranch && expectedDatabase && expectedRole && expectedHost) &&
          databaseIdentity.database_name === expectedDatabase &&
          databaseIdentity.role_name === expectedRole &&
          databaseIdentity.education_schema_usage === true &&
          configuredHost === expectedHost;
        if (!verified) {
          return sendJson(res, 503, {
            ok: false,
            service: "education-api",
            error: "DATABASE_IDENTITY_MISMATCH"
          });
        }
        return sendJson(res, 200, {
          ok: true,
          service: "education-api",
          database: "connected",
          database_identity: {
            verified: true,
            database_name: databaseIdentity.database_name,
            role_name: databaseIdentity.role_name,
            schema: "education",
            neon_branch_id: expectedBranch
          }
        });
      }
      await sql`SELECT 1 AS ok`;
      return sendJson(res, 200, { ok: true, service: "education-api", database: "connected" });
    }
    const services = await sql`
      SELECT id, service_code, service_name, service_category, description,
             registration_method, registration_method_label, form_fields,
             consent_text, requires_management_review, is_active, display_order
      FROM education.service_catalog
      WHERE is_active = true
      ORDER BY display_order ASC, service_name ASC
    `;
    return sendJson(res, 200, { ok: true, services });
  } catch (error) {
    const status = error.statusCode || 500;
    return sendJson(res, status, {
      error: status === 503 ? error.message : "SERVICE_CATALOG_FAILED"
    });
  }
}
