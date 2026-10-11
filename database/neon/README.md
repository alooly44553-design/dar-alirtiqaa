# Independent Neon databases

Three independent Neon PostgreSQL projects are provisioned on the Free plan:

- Education: `dar-alirtiqaa-education` (project ID `still-term-43673824`)
- Health: `dar-alirtiqaa-health` (project ID `raspy-meadow-49316965`)
- Public services: `dar-alirtiqaa-public-services` (project ID `falling-snow-49265822`)

Each has a separate default branch and its own schema. Bootstrap SQL files document the intended starting schema. Public grants on the initial application tables were checked and are zero.

## Education project: current integration status

The education Vercel production deployment is READY. Live checks on 2026-10-11 returned HTTP 200 for the public homepage and `GET /api/education/status`; the status endpoint returned `database: connected`. The private `DATABASE_URL` is stored as a sensitive Vercel environment variable. The Supabase publishable key used for admin-session validation is also stored as sensitive. A rollback-only SQL smoke test confirmed that the registration insert shape matches the live Neon table without leaving test rows.

- `GET /api/education/status` — non-sensitive database connectivity check.
- `POST /api/education/registrations` — validates and saves public student registrations in Neon.
- `GET/POST/PATCH /api/education/admin-registrations` — requires a valid Supabase Auth session and a positive result from `is_center_management_admin`; then lists, adds, approves, rejects, or documents registration records in Neon.

The public education form routes student registration submissions to Neon. The education admin registration panel uses the authenticated API. Supabase Auth is retained for identity/admin verification in this integration slice.

## Schema consistency note

The live `education.student_registrations` table contains registration and review fields added after the initial bootstrap SQL. `education.sql` has now been updated to document those columns and the relevant checks/indexes for a fresh database. This was a repository documentation/schema-bootstrap correction only; no live database schema migration or production data change was made by that edit. Reapplying `CREATE TABLE IF NOT EXISTS` does not retrofit an already-existing table.

## Remaining work and limits

- Other education services (catalog, fees, and general service requests) still use the existing Supabase backend.
- File attachments are not considered complete until actual file bytes are stored in an isolated storage path. Do not treat attachment metadata alone as an uploaded document.
- Health and public-services databases have initial schemas, but their live frontends and APIs have not yet been switched to them.
- No production data has been copied from the shared Supabase project. Do not delete or deactivate the old backend while any service still uses it.
- End-to-end HTTP submission and admin review still require a live test using a permitted admin session. The external fetch tool was blocked by Vercel Authentication when attempting to access the admin route, so that workflow is not yet confirmed. A successful deployment and database status check do not prove the full workflow.
- Never expose a privileged Neon connection string in browser JavaScript. Each deployment must have its own secret `DATABASE_URL` and matching `DAR_ALIRTIQAA_APP` value.
- Keep health appointment requests limited to non-clinical scheduling information; do not store diagnoses or medical reports in that schema.
