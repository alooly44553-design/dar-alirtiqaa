# Independent Neon databases

Three independent Neon PostgreSQL projects are provisioned on the Free plan:

- Education: `dar-alirtiqaa-education` (project ID `still-term-43673824`)
- Health: `dar-alirtiqaa-health` (project ID `raspy-meadow-49316965`)
- Public services: `dar-alirtiqaa-public-services` (project ID `falling-snow-49265822`)

Each has a separate default branch and its own schema. Bootstrap SQL files in this directory document the starting schema. Public grants on the initial application tables were checked and are zero.

## Education project: current integration status

The education Vercel project has these server-side routes. Its latest production deployment is READY, and a live GET to `/api/education/status` returned HTTP 200 with `database: connected`. The private `DATABASE_URL` is stored as a sensitive Vercel environment variable; the admin-validation publishable key was also retrieved from the linked Supabase project and stored as sensitive. A rollback-only SQL smoke test confirmed that the registration insert shape matches the current Neon table without leaving test rows.

- `GET /api/education/status` — non-sensitive database connectivity check.
- `POST /api/education/registrations` — validates and saves public student registrations in Neon.
- `GET/POST/PATCH /api/education/admin-registrations` — requires a valid Supabase Auth session and a positive result from `is_center_management_admin`; then lists, adds, approves, rejects, or documents registration records in Neon.

The public education form routes student registration submissions to Neon. The education admin registration panel uses the authenticated API. Supabase Auth is retained only for identity/admin verification in this vertical slice.

## Remaining work and limits

- Other education services (catalog, fees, and general service requests) still use the existing Supabase backend.
- Attachments are temporarily disabled on the student-registration form until an isolated storage path is connected. Do not re-enable them until the file bytes are stored outside the shared backend.
- Health and public-services databases have initial schemas, but their live frontends and APIs have not yet been switched to them.
- No production data has been copied from the shared Supabase project. Do not delete or deactivate the old backend while any service still uses it.
- End-to-end HTTP submission and admin review still require a live test using a permitted admin session. Vercel Authentication prevented the external fetch tool from accessing the admin route, so that workflow is not yet confirmed. A successful deployment and database status check do not prove the full workflow.
- Never expose a privileged Neon connection string in browser JavaScript. Each deployment must have its own secret `DATABASE_URL` and matching `DAR_ALIRTIQAA_APP` value.
- Keep health appointment requests limited to non-clinical scheduling information; do not store diagnoses or medical reports in this schema.
