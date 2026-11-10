# SIMS — Student Internship Management System

A multi-tenant internship platform for universities and companies: companies post internships and graduate roles, students apply, companies hire, placements run week by week with logs and evaluations, and universities grade the result. Every tenant boundary is enforced by PostgreSQL Row Level Security.

**Phase 1 (this repo): Supabase + React web app.**
**Phase 2 (next): Expo mobile app reusing `@sims/shared`.**

---

## Stack

| Layer | Choice |
| --- | --- |
| Backend | Supabase — Postgres 17, Auth, RLS, Storage, Realtime, Edge Functions |
| Web | React 18, TypeScript, Vite 6, React Router 6, TanStack Query 5, Tailwind CSS 4 |
| Shared domain | `@sims/shared` — types, role constants, formatting/CSV helpers |
| Tests | pgTAP cross-tenant RLS suite (`supabase/tests/rls.test.sql`, 25 assertions) |

## Repository layout

```
apps/web                 React SPA (Phase 1)
packages/shared          Shared types, constants, utils (used by web now, mobile later)
supabase/migrations      Schema, functions/RPCs, RLS, storage buckets, realtime
supabase/functions       invite-user Edge Function (service-role staff provisioning)
supabase/tests           pgTAP RLS/tenant-isolation tests
supabase/seed.sql        Demo universities, companies, users, postings, applications, placements
```

---

## Prerequisites

- Node.js 18+ (Node 20/22 recommended) and npm
- **Docker Desktop** — required by `supabase start`. The Supabase CLI itself runs through `npx`, no global install needed.
- Supabase CLI access to a project (or the local stack) for deployment

> Docker was **not available in the environment where this project was authored**, so `supabase start`, `supabase db reset`, and the pgTAP suite were not executed here. The web app was verified with `npm run typecheck` and `npm run build`. See [Verification status](#verification-status).

---

## Local setup

```bash
# 1. Install dependencies
npm install

# 2. Start local Supabase (first run pulls Docker images; prints API URL + anon key)
npx supabase start

# 3. Apply migrations, storage/realtime setup, and seed data
npx supabase db reset

# 4. Configure the web client
cp .env.example .env
#    then paste the anon key printed by `supabase start` into VITE_SUPABASE_ANON_KEY

# 5. Run the web app
npm run dev            # http://localhost:5173
```

Local services: API `http://127.0.0.1:54321`, Studio `http://127.0.0.1:54323`, DB `54322`, Inbucket (email) `54324`.

### Environment variables

`.env` at the repository root (Vite reads it for `apps/web`):

```dotenv
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<local anon key>
```

Only these two variables exist client-side. **The service role key must never be added to `.env` or any `VITE_*` variable** — it would be bundled into the browser. All privileged operations run inside SQL `SECURITY DEFINER` functions or the `invite-user` Edge Function, which reads the service role key from its own server-side environment.

`supabase functions serve` injects `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` automatically, so no extra file is needed locally.

---

## Demo accounts

All seeded accounts use the password **`Password123!`**.

| Role | Email | Tenant |
| --- | --- | --- |
| platform_admin | `admin@sims.dev` | — (aggregates only) |
| coordinator | `coordinator@baystate.edu` | Bay State University |
| coordinator | `coordinator@northbridge.edu` | Northbridge Tech |
| faculty_supervisor | `faculty1@baystate.edu`, `faculty2@baystate.edu` | Bay State University |
| faculty_supervisor | `faculty3@northbridge.edu` | Northbridge Tech |
| student | `student1@baystate.edu`, `student2@baystate.edu` | Bay State University |
| student | `student3@northbridge.edu`, `student4@northbridge.edu` | Northbridge Tech |
| company_admin | `admin@acme.com` | Acme Software |
| company_admin | `admin@globex.com` | Globex Data |
| site_supervisor | `supervisor1@acme.com`, `supervisor2@acme.com` | Acme Software |
| site_supervisor | `supervisor3@globex.com` | Globex Data |
| site_supervisor | `supervisor4@initech.com` | Initech Finance |

Public signup (`/signup`) creates **students only**, and the university is chosen from the signup form. Students self-serve their academic details and CV after signing in.

---

## Roles and what they can do

| Capability | student | faculty_supervisor | coordinator | site_supervisor | company_admin | platform_admin |
| --- | :-: | :-: | :-: | :-: | :-: | :-: |
| Browse eligible postings | ✓ | ✓ | ✓ | — | — | — |
| Apply / withdraw | ✓ | — | — | — | — | — |
| Create & manage postings | — | — | — | — | ✓ | — |
| Review applicants & hire | — | — | — | — | ✓ | — |
| Supervise weekly logs | ✓ (own) | — | — | ✓ (own placements) | ✓ (company) | — |
| Review weekly logs | — | ✓ | ✓ | ✓ | ✓ | — |
| Midterm/final evaluation | — | ✓ (faculty) | — | ✓ (site) | — | — |
| Assign faculty supervisor | — | — | ✓ | — | — | — |
| Record grade | — | — | ✓ | — | — | — |
| Invite staff | — | — | faculty | — | site supervisors | coordinators, company admins |
| Manage tenants | — | — | — | — | — | ✓ |

Platform admins see **aggregate counts only** (`platform_stats()`), never student PII, CVs, logs, or evaluations.

---

## Lifecycle

```
posting (draft → published → closed)
  └── application (draft → submitted → under_review → shortlisted → accepted | rejected)
        └── placement (active → completed | cancelled)        [created by accept_application]
              ├── weekly log (draft → submitted → approved | needs_revision)
              ├── evaluation (midterm | final)                 [site + faculty rubrics 1–5]
              ├── check-in
              └── document (CV, report)
                    └── grade (0–100) recorded by the coordinator
```

Multi-step and privileged transitions are RPCs, not client-side writes:

`accept_application`, `review_application`, `withdraw_application`, `assign_faculty_supervisor`, `upsert_weekly_log`, `submit_weekly_log`, `review_weekly_log`, `submit_evaluation`, `add_check_in`, `record_grade`, `search_postings`, `university_stats`, `faculty_stats`, `company_stats`, `platform_stats`.

## Posting visibility

Postings are `all_universities` or `selected`. The join table `posting_universities` restricts `selected` postings to listed universities. Students only see published postings visible to their university; company staff only see their own company's postings.

---

## Security model

- **RLS on every table.** Policies resolve the caller through `auth_role()`, `auth_university_id()`, and `auth_company_id()`, which read `profiles` server-side. No policy trusts client-supplied tenant IDs.
- **Role/tenant cannot be self-assigned.** `handle_new_user()` reads trusted role and tenant from `raw_app_meta_data` **only when `sims_provisioned = true`**, a flag writable only by the service role. Public signups (user-controlled `raw_user_meta_data`) are forced to `student` plus the chosen university.
- **Staff provisioning** goes through the `invite-user` Edge Function: it validates the caller's role against `ALLOWED_BY_CALLER`, constrains the tenant to the caller's own where applicable, verifies the target tenant is active, and creates the account with `app_metadata.sims_provisioned = true`. The returned temporary password is displayed once to the inviter.
- **Guard triggers** reject direct privilege/tenant changes on `profiles`, illegal application status jumps, and invalid placement/log transitions.
- **Storage** uses three buckets: `cvs` and `reports` are private and read through RLS-backed access plus signed URLs; `company-logos` is public for branding. Buckets enforce size and MIME type limits.
- **Audit logging** captures sensitive table changes; **notifications** are inserted by RPCs and streamed with Realtime.
- **Errors returned to the UI are generic**; policy text and constraint internals are not surfaced.

### Provisioning paths compared

| Path | Actor | Role source | Allowed roles |
| --- | --- | --- | --- |
| `/signup` | Public | Forced `student` | student |
| `invite-user` function | coordinator / company_admin / platform_admin | Trusted `app_metadata` set by service role | per `ALLOWED_BY_CALLER` |
| `seed.sql` | Local reset | Trusted `raw_app_meta_data.sims_provisioned` | all six |

---

## Edge Function

```bash
# Local
npx supabase functions serve invite-user

# Deploy
npx supabase functions deploy invite-user
```

The function requires these server-side secrets (set with `npx supabase secrets set` in hosted projects; injected automatically locally):

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Network access to the function is restricted by its own caller checks: missing/invalid JWT → 401, disallowed role → 403, inactive or mismatched tenant → 400/403, existing email → 409.

---

## Tests

```bash
npx supabase db reset     # required before tests
npx supabase test db      # runs supabase/tests/*.test.sql (pgTAP)
```

`rls.test.sql` covers 25 assertions: cross-university student isolation, posting visibility, company scoping, application/placement/document access, weekly-log review permissions, evaluation and grade restrictions, platform-admin aggregate-only access, and prevention of role/tenant self-escalation.

Typecheck and production build:

```bash
npm run typecheck
npm run build
```

---

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Vite dev server on `:5173` |
| `npm run build` | Typecheck + production build to `apps/web/dist` |
| `npm run preview` | Preview the production build |
| `npm run typecheck` | TypeScript only |
| `npm run db:start` / `db:stop` | Start/stop local Supabase |
| `npm run db:reset` | Re-run migrations + seed |
| `npm run db:test` | pgTAP suite |
| `npm run functions:serve` | Serve `invite-user` locally |
| `npm run functions:deploy` | Deploy `invite-user` |

---

## Deployment notes

1. Create a Supabase project and link it: `npx supabase link --project-ref <ref>`.
2. Push schema: `npx supabase db push` (migrations) — do **not** push `seed.sql` to production.
3. Deploy the function. Set `SUPABASE_SERVICE_ROLE_KEY` as a function secret only; it never reaches the browser.
4. In Auth settings set Site URL to the deployed web origin and add `https://<web-origin>` and `https://<web-origin>/reset-password` to redirect URLs.
5. Copy the project URL and **anon** key into the web host's environment as `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`, then build.
6. Host `apps/web/dist` on any static host with SPA fallback to `index.html` (Vercel/Netlify/Cloudflare Pages). Set cache headers for hashed assets and no-cache for `index.html`.
7. Demo seed accounts are local-only; create the first platform admin through the Supabase dashboard (set `raw_app_meta_data` to `{"sims_provisioned": true, "role": "platform_admin"}`) or a one-off service-role script.

Storage buckets, RLS policies, and realtime publication are created by migrations — no manual dashboard setup is required.

---

## Verification status

| Item | Status |
| --- | --- |
| `npm install` | Pass |
| `npm run typecheck` | Pass (clean) |
| `npm run build` | Pass (only Vite's >500 kB chunk-size warning) |
| `supabase start` / `db reset` | Not run — Docker unavailable in this environment |
| pgTAP suite | Not run — same reason |

The web app was built against the migration-defined schema. Until the database is started on a Docker-capable machine, the RLS suite and seed flow remain unexecuted; run the two commands above to validate them.

---

## Phase 2 — mobile

The mobile app will live in `apps/mobile` (Expo, React Native) inside the same npm workspace and consume `@sims/shared` for types, roles, and formatting. It will use the same Supabase project and RLS model; no backend changes are expected. Web is intentionally completed first.
