# Independent Neon databases

Three independent Neon PostgreSQL projects were provisioned on the Free plan:

- Education: `dar-alirtiqaa-education` (project ID `still-term-43673824`)
- Health: `dar-alirtiqaa-health` (project ID `raspy-meadow-49316965`)
- Public services: `dar-alirtiqaa-public-services` (project ID `falling-snow-49265822`)

Each database has its own default branch and a dedicated schema. Bootstrap SQL files in this directory reproduce the initial table structures. Public grants were checked and are zero for these schemas.

## Important status

This is the initial schema foundation, not a completed production migration. No data was copied from the existing shared Supabase project. The current frontend apps have not yet been switched to these databases. Before production use, each app needs a server-side API, its own secret `DATABASE_URL` in the correct hosting project, authentication/authorization, file-storage decisions, and end-to-end tests. Never put a privileged Neon connection string in browser JavaScript.

Keep the health appointment form limited to non-clinical scheduling information; do not store diagnoses or medical reports in this schema.
