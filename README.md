# SIMS — Student Internship Management System

A multi-tenant internship platform for universities and companies: companies post internships and graduate roles, students apply, companies hire, placements run week by week with logs and evaluations, and universities grade the result. Every tenant boundary is enforced by PostgreSQL Row Level Security.

**Phase 1 (this repo): Supabase + React web app.**
**Phase 2 (next): Expo mobile app reusing `@sims/shared`.**

---

## Stack

| Layer | Choice |
| --- | --- |
| Backend | Supabase — Postgres 17, Auth, RLS, Storage, Realtime, Edge Functions |
| Web | React 18, TypeScript, Vite 6, React Router 6, TanStack Query 5, plain CSS (design-token system) |
| Shared domain | `@sims/shared` — types, role constants, formatting/CSV helpers |
| Tests | pgTAP cross-tenant RLS suite (`supabase/tests/rls.test.sql`, 25 assertions) |

## Repository layout

```
apps/web                 React SPA (Phase 1)
packages/shared          Shared types, constants, utils (used by web now, mobile later)
supabase/migrations      Schema, functions/RPCs, RLS, storage buckets, realtime
supabase/functions       invite-user, manage-admins, signup-admin, manage-users Edge Functions
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
| platform_admin | `admin@sims.dev` | — (full platform oversight) |
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

Public signup (`/signup`) offers two modes: **Student** (the default — university chosen on the form) and **Administrator** (a capped bootstrap, described below). New student accounts start as **pending** and cannot use SIMS until a general administrator approves them. Students self-serve their academic details and CV after approval.

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
| Delete universities / companies | — | — | — | — | — | ✓ |
| Manage general admins (max 2) | — | — | — | — | — | ✓ |
| See & approve all users | — | — | — | — | — | ✓ |
| Suspend / block / delete users | — | — | — | — | — | ✓ |

Platform admins have **full platform oversight**: they see the complete user directory (`list_all_users()`), approve pending accounts, and moderate (suspend, block, delete) any non-admin user, plus delete entire universities or companies. This explicitly replaces the earlier aggregate-only restriction — admins now have directory and moderation access to every account on the platform.

---

## General administrators (platform admins)

General administrators are platform-wide `platform_admin` accounts. **At most two can exist at once** (`MAX_PLATFORM_ADMINS = 2` in `@sims/shared`, enforced again server-side). There are two ways to create one:

1. **Public signup bootstrap** — `/signup` offers an **Administrator** mode whenever fewer than two admins exist. It calls the public, session-less `signup-admin` Edge Function, which enforces the cap entirely server-side (including a post-create race guard that rolls back an over-cap account). The new admin is provisioned **active** immediately, so the platform always has a working approver from the first account. The Administrator option **disappears the instant the second account is created** — the page polls `admin_signup_available()` every 10 s and falls back to Student mode if the cap was reached while the page was left open.
2. **In-app management** — an existing admin can create/delete peers from **Tenants → General admins**, visible only to platform admins.

Both paths share the same live-count behavior:

- **0 or 1 admins** → the **Create general admin** button is shown, with a slot meter (`X / 2`).
- **2 admins** → the create button is **removed** and replaced by a "Both slots filled" notice plus a hint to delete one to free a slot.
- **Delete one** → the count drops to 1 and the create button **returns** automatically (the list query is invalidated after every mutation).
- **Create back up to 2** → the button is removed again.

Supporting pieces:

| Piece | Location | Purpose |
| --- | --- | --- |
| `MAX_PLATFORM_ADMINS` | `packages/shared/src/constants.ts` | Single source of truth for the cap |
| `PlatformAdmin` type | `packages/shared/src/types.ts` | Shape returned by the list RPC |
| `list_platform_admins()` | `supabase/migrations/20261109000006_platform_admins.sql` | `SECURITY DEFINER` RPC; returns admins only when the caller `is_platform_admin()` |
| `manage-admins` function | `supabase/functions/manage-admins/index.ts` | Service-role create/delete with the cap enforced server-side |
| `usePlatformAdmins` hooks | `apps/web/src/hooks/usePlatformAdmins.ts` | List query + create/delete mutations, invalidating the list on success |
| `GeneralAdmins` component | `apps/web/src/components/GeneralAdmins.tsx` | Quota meter, admin rows, create modal (temporary password), delete confirmation |
| `admin_signup_available()` | `supabase/migrations/20261109000007_admin_console.sql` | Public boolean RPC (no identities) driving the signup-page Administrator option |
| `signup-admin` function | `supabase/functions/signup-admin/index.ts` | Public, session-less bootstrap; server-side cap + race-guard rollback |
| `useAdminSignupAvailable` | `apps/web/src/hooks/useAdminConsole.ts` | Polls availability every 10 s; refetches on window focus |
| `Signup` administrator mode | `apps/web/src/pages/Signup.tsx` | Student/Administrator toggle; hides the admin option at the cap |

The list RPC exists because `profiles` RLS lets a user read only their own row or rows they are allowed to supervise — it has no platform-admin peer branch — so admins cannot enumerate each other through the table directly. `list_platform_admins()` is gated by `is_platform_admin()` and returns nothing for any other caller.

Server-side rules in `manage-admins` (the UI cap is convenience; these are the authority):

- Caller must present a valid JWT **and** be a `platform_admin` (otherwise 401/403).
- **create**: rejects with 409 when the count is already 2; creates the auth user with `app_metadata.sims_provisioned = true` and `role = platform_admin` (null university/company), generates a one-time temporary password shown once, and rejects an existing email with 409.
- **delete**: refuses to delete the caller's own account (400), verifies the target is a `platform_admin` (404/400 otherwise), then removes the auth user — which frees a slot.

---

## Account approval & user moderation

Every account carries an `account_status` (`pending`, `active`, `suspended`, `blocked`). Public student sign-ups start **pending**; service-role-provisioned accounts (invites, admin bootstrap, seed) are **active** immediately.

### The approval gate is enforced in the database

`auth_role()`, `auth_university_id()`, and `auth_company_id()` return nothing unless the account is `active`. Because every RLS policy resolves the caller through these functions, **pending, suspended, and blocked accounts are denied all tenant data at the database boundary** — not merely hidden by the UI. A user can still read their own `profiles` row (the self branch) so the app can render the correct gate screen. `guard_profile_update()` rejects any attempt to change your own role, tenant, email, or `account_status`, so a user cannot approve or unblock themselves.

On the client, `ProtectedRoute` shows `<AccountGate>` for any non-active profile: a pending account sees "Your account is awaiting approval" with a **Check again** button (re-fetches the profile); suspended/blocked accounts see the matching notice and a sign-out option. Once an admin approves the account, **Check again** clears the gate and the dashboard loads normally.

### The Users console (`/users`, platform admins only)

A full directory of **every** account on the platform via the `list_all_users()` `SECURITY DEFINER` RPC (returns nothing for non-admins). It supports:

- **Search** by name, email, or organization; **filter** by role and status; **sort** the list.
- **Approve** pending accounts (single, or **bulk approve** all selected pending users).
- **Suspend / block / reactivate** any non-admin user, with an inline **undo** bar (reverts to the previous status) after each change.
- A **detail drawer** per user (identity, role, tenant, status, joined date).
- **Delete** a user account permanently (confirmation modal), via the `manage-users` Edge Function.

Platform admins and the caller's own account are excluded from moderation targets. Status changes go through `set_user_status()`, which writes an audit log entry and sends the affected user a notification.

### Deleting universities and companies

From **Tenants**, each university/company card has a **Delete** action opening a confirmation modal that lists the destructive impact (members, postings, placements) and suggests suspending instead. Confirmation calls the `manage-users` function's `delete_tenant` action, which runs the `delete_tenant()` RPC **as the caller** so `is_platform_admin()` is re-checked inside a single transaction. The RPC removes dependent placements/applications first (they hold RESTRICT foreign keys), then the member `auth.users` rows (cascading profiles, logs, evaluations, documents, notifications), then the tenant row — so a failure never leaves a half-deleted tenant.

### Supporting pieces

| Piece | Location | Purpose |
| --- | --- | --- |
| `account_status` enum + gate | `supabase/migrations/20261109000007_admin_console.sql` | Status column, gated `auth_*()` helpers, self-status guard |
| `list_all_users()` | same migration | Admin-only full directory |
| `set_user_status()` | same migration | Approve/suspend/block/reactivate + audit + notification |
| `delete_tenant()` | same migration | Transactional tenant + member deletion |
| `manage-users` function | `supabase/functions/manage-users/index.ts` | Service-role `delete_user`; caller-scoped `delete_tenant` |
| `useAdminConsole` hooks | `apps/web/src/hooks/useAdminConsole.ts` | Directory query + optimistic status/delete mutations |
| `Users` page | `apps/web/src/pages/Users.tsx` | Directory, filters, bulk approve, drawer, undo, delete |
| `AccountGate` | `apps/web/src/components/AccountGate.tsx` | Pending/suspended/blocked screen + Check again |

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

`accept_application`, `review_application`, `withdraw_application`, `assign_faculty_supervisor`, `upsert_weekly_log`, `submit_weekly_log`, `review_weekly_log`, `submit_evaluation`, `add_check_in`, `record_grade`, `search_postings`, `university_stats`, `faculty_stats`, `company_stats`, `platform_stats`, `list_platform_admins`, `admin_signup_available`, `list_all_users`, `set_user_status`, `delete_tenant`.

## Posting visibility

Postings are `all_universities` or `selected`. The join table `posting_universities` restricts `selected` postings to listed universities. Students only see published postings visible to their university; company staff only see their own company's postings.

---

## Security model

- **RLS on every table.** Policies resolve the caller through `auth_role()`, `auth_university_id()`, and `auth_company_id()`, which read `profiles` server-side **and return nothing unless the account is `active`** — so pending, suspended, and blocked accounts are denied all tenant data at the database boundary. No policy trusts client-supplied tenant IDs.
- **Role/tenant cannot be self-assigned.** `handle_new_user()` reads trusted role and tenant from `raw_app_meta_data` **only when `sims_provisioned = true`**, a flag writable only by the service role. Public signups (user-controlled `raw_user_meta_data`) are forced to `student` plus the chosen university.
- **Staff provisioning** goes through the `invite-user` Edge Function: it validates the caller's role against `ALLOWED_BY_CALLER`, constrains the tenant to the caller's own where applicable, verifies the target tenant is active, and creates the account with `app_metadata.sims_provisioned = true`. The returned temporary password is displayed once to the inviter.
- **General-admin provisioning** goes through the `manage-admins` Edge Function, restricted to existing platform admins and capped at two accounts server-side. It never trusts a client-supplied count and refuses self-deletion.
- **Guard triggers** reject direct privilege/tenant/status changes on `profiles` (a user cannot approve or unblock themselves), illegal application status jumps, and invalid placement/log transitions.
- **Admin moderation is RPC-gated.** The full user directory, status changes, and tenant deletion run through `SECURITY DEFINER` functions that re-check `is_platform_admin()`. `set_user_status()` refuses the caller's own account and routes admin-peer management to General admins; `delete_tenant()` runs in one transaction. Hard deletes of users and tenants go through the `manage-users` function with the service role key kept server-side.
- **Storage** uses three buckets: `cvs` and `reports` are private and read through RLS-backed access plus signed URLs; `company-logos` is public for branding. Buckets enforce size and MIME type limits.
- **Audit logging** captures sensitive table changes; **notifications** are inserted by RPCs and streamed with Realtime.
- **Errors returned to the UI are generic**; policy text and constraint internals are not surfaced.

### Provisioning paths compared

| Path | Actor | Role source | Allowed roles |
| --- | --- | --- | --- |
| `/signup` (Student) | Public | Forced `student`, status `pending` | student |
| `/signup` (Administrator) → `signup-admin` | Public (capped bootstrap) | Trusted `app_metadata` set by service role | platform_admin (max 2 total, active) |
| `invite-user` function | coordinator / company_admin / platform_admin | Trusted `app_metadata` set by service role | per `ALLOWED_BY_CALLER` |
| `manage-admins` function | platform_admin only | Trusted `app_metadata` set by service role | platform_admin (max 2 total) |
| `seed.sql` | Local reset | Trusted `raw_app_meta_data.sims_provisioned` | all six |

---

## Edge Functions

```bash
# Local
npx supabase functions serve invite-user
npx supabase functions serve manage-admins
npx supabase functions serve signup-admin
npx supabase functions serve manage-users

# Deploy
npx supabase functions deploy invite-user
npx supabase functions deploy manage-admins
npx supabase functions deploy signup-admin
npx supabase functions deploy manage-users
```

All four functions require these server-side secrets (set with `npx supabase secrets set` in hosted projects; injected automatically locally):

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Caller checks per function:

- **`invite-user`** — missing/invalid JWT → 401, disallowed role → 403; also rejects inactive/mismatched tenants (400/403) and existing emails (409).
- **`manage-admins`** — platform_admin only (403 otherwise); rejects a full quota of two (409 on create), self-deletion (400), and unknown targets (404).
- **`signup-admin`** — **public, no session required** (the bootstrap path). Validates email/name/password, enforces the two-admin cap server-side with a post-create race guard that rolls back an over-cap account (409), and rejects existing emails (409). It never trusts a client-supplied count.
- **`manage-users`** — platform_admin only (401/403 otherwise). `delete_user` refuses self-deletion (400) and admin peers (400, routed to General admins), 404 for unknown targets; `delete_tenant` runs the `delete_tenant()` RPC as the caller so `is_platform_admin()` is re-checked in-transaction (404 if the tenant is gone).

---

## Tests

```bash
npx supabase db reset     # required before tests
npx supabase test db      # runs supabase/tests/*.test.sql (pgTAP)
```

`rls.test.sql` covers 25 assertions: cross-university student isolation, posting visibility, company scoping, application/placement/document access, weekly-log review permissions, evaluation and grade restrictions, platform-admin access to aggregate tenant counts, and prevention of role/tenant self-escalation.

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

> The `functions:*` scripts target `invite-user`. Serve/deploy `manage-admins`, `signup-admin`, and `manage-users` with the explicit `npx supabase functions … <name>` commands shown in [Edge Functions](#edge-functions).

---

## Deployment notes

1. Create a Supabase project and link it: `npx supabase link --project-ref <ref>`.
2. Push schema: `npx supabase db push` (migrations) — do **not** push `seed.sql` to production. This includes `20261109000006_platform_admins.sql` (`list_platform_admins()`) and `20261109000007_admin_console.sql` (the `account_status` approval gate, `admin_signup_available()`, `list_all_users()`, `set_user_status()`, and `delete_tenant()`). On a hosted project you can instead paste those migrations, or `supabase/setup.sql`, into the SQL editor and run it.
3. Deploy all four functions: `invite-user`, `manage-admins`, `signup-admin`, and `manage-users` (`npx supabase functions deploy <name>`). Set `SUPABASE_SERVICE_ROLE_KEY` as a function secret only; it never reaches the browser. `signup-admin` must be deployed for the public Administrator signup option to work.
4. In Auth settings set Site URL to the deployed web origin and add `https://<web-origin>` and `https://<web-origin>/reset-password` to redirect URLs.
5. Copy the project URL and **anon** key into the web host's environment as `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`, then build.
6. Host `apps/web/dist` on any static host with SPA fallback to `index.html` (Vercel/Netlify/Cloudflare Pages). Set cache headers for hashed assets and no-cache for `index.html`.
7. Demo seed accounts are local-only. Bootstrap the **first** platform admin from the public `/signup` page's **Administrator** mode (no existing session needed), or through the Supabase dashboard (Authentication → add user, then set the user's `raw_app_meta_data` to `{"sims_provisioned": true, "role": "platform_admin"}`). The signup Administrator option disappears once two admins exist and returns whenever one is deleted. After signing in, approve pending users from **Users** and manage admin peers from **Tenants → General admins**.

Storage buckets, RLS policies, and realtime publication are created by migrations — no manual dashboard setup is required.

---

## Verification status

| Item | Status |
| --- | --- |
| `npm install` | Pass |
| `npm run typecheck` | Pass (clean) |
| `npm run build` | Pass (only Vite's >500 kB chunk-size warning) |
| General-admin cap toggle (UI) | Verified on the real `GeneralAdmins` component: create button shown at 0–1, removed at 2, returns after a delete frees a slot |
| Admin signup option + live cap (UI) | Verified in-browser: Administrator mode shown below the cap, hidden at two, falls back to Student when the cap is reached while the page is open |
| Users console (UI) | Verified in-browser: directory render, search/filter/sort, approve, suspend, reactivate, undo, detail drawer, delete-user, bulk approve |
| Tenant deletion (UI) | Verified in-browser: delete-university and delete-company confirmation modals and optimistic removal |
| Approval gate (UI) | Verified in-browser: a pending account is blocked by `AccountGate`; after approval, **Check again** clears the gate and the dashboard renders normally |
| Realtime notification channels | Fixed a channel-name collision that crashed the dashboard when two subscribers shared a topic; verified the dashboard and header bell now coexist with no console errors |
| `manage-admins` / `signup-admin` / `manage-users` live | Not exercised end-to-end here — require the deployed functions + valid sessions; server logic verified by inspection |
| `supabase start` / `db reset` | Not run — Docker unavailable in this environment |
| pgTAP suite | Not run — same reason |

The web app was built against the migration-defined schema. The UI flows above were exercised in a real browser against a **mocked Supabase backend** (fetch interception), because Docker and a deployed project were unavailable in this environment — they confirm client behavior, not live RLS. Until the database is started on a Docker-capable machine (or the migrations + Edge Functions are deployed to the hosted project), the RLS suite, seed flow, and live admin/moderation loops remain unexecuted; run the commands above to validate them.

---

## Phase 2 — mobile

The mobile app will live in `apps/mobile` (Expo, React Native) inside the same npm workspace and consume `@sims/shared` for types, roles, and formatting. It will use the same Supabase project and RLS model; no backend changes are expected. Web is intentionally completed first.
