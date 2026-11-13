# SIMS — Student Internship Management System

<p align="center">
  <strong>A centralized platform for managing the university-to-workplace internship lifecycle.</strong>
  <br />
  Connect universities, students, and companies through structured applications, placements, supervision, evaluations, and grading.
</p>

<p align="center">
  <img alt="React" src="https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white" />
  <img alt="Vite" src="https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white" />
  <img alt="Supabase" src="https://img.shields.io/badge/Supabase-PostgreSQL%20%7C%20Auth%20%7C%20RLS-3FCF8E?logo=supabase&logoColor=white" />
  <img alt="License" src="https://img.shields.io/badge/License-Not%20specified-lightgrey" />
</p>

---

## Contents

- [Overview](#overview)
- [Core capabilities](#core-capabilities)
- [Technology](#technology)
- [Architecture](#architecture)
- [User roles](#user-roles)
- [Internship lifecycle](#internship-lifecycle)
- [Analytics and reporting](#analytics-and-reporting)
- [Security](#security)
- [Getting started](#getting-started)
- [Environment configuration](#environment-configuration)
- [Demo data](#demo-data)
- [Database tests and verification](#database-tests-and-verification)
- [Deployment](#deployment)
- [Project structure](#project-structure)
- [Roadmap](#roadmap)

## Overview

SIMS is a multi-tenant Student Internship Management System built to coordinate internship activities between universities and companies.

The platform supports the process from opportunity publication and student applications to placement supervision, weekly activity logs, evaluations, and final academic grading. Universities and companies operate within their own tenant boundaries, with access controlled by PostgreSQL Row Level Security (RLS).

**Current delivery:** React web application backed by Supabase.  
**Planned next phase:** Expo / React Native mobile application reusing the shared domain package.

## Core capabilities

| Area | Capabilities |
| --- | --- |
| Opportunities | Company-managed internship and graduate-role postings, including university-specific visibility |
| Applications | Student applications, withdrawal, review, shortlisting, acceptance, and rejection |
| Placements | Placement creation and lifecycle management after an application is accepted |
| Supervision | Daily activity reports, weekly roll-ups, assigned faculty review, check-ins, and supervisor workload visibility |
| Evaluation | Midterm and final evaluations by the relevant supervisors |
| Academic results | Official final grades recorded by the assigned university faculty supervisor; company grade access is read-only |
| Administration | Tenant management, account approval, user moderation, and platform administration |
| Analytics | University and company dashboards with date, department, and programme filters; application pipeline, reporting compliance, workload, evaluations, grade bands, and CSV export |
| Notifications | In-app notifications with Supabase Realtime |
| Documents | CV and report storage with access controlled by storage policies |

## Technology

| Layer | Technology |
| --- | --- |
| Frontend | React 18, TypeScript, Vite 6 |
| Routing | React Router 6 |
| Server state | TanStack Query 5 |
| Styling | CSS with a design-token system |
| Backend platform | Supabase |
| Database | PostgreSQL 17 |
| Authentication | Supabase Auth |
| Authorization | PostgreSQL Row Level Security and role-aware database functions |
| Server-side workflows | Supabase Edge Functions and SQL RPCs |
| Shared domain | `@sims/shared` |
| Database testing | pgTAP |

## Architecture

SIMS is organized as a workspace with a web application, a shared domain package, and Supabase backend resources.

```text
SIMS
├── apps/
│   └── web/                 React + TypeScript web application
├── packages/
│   └── shared/              Shared types, roles, constants, and utilities
└── supabase/
    ├── migrations/          Database schema, RPCs, RLS, storage, and realtime
    ├── functions/           Server-side Edge Functions
    ├── tests/               pgTAP database tests
    └── seed.sql             Local development sample data
```

Privileged and multi-step operations are handled by database functions or Edge Functions rather than trusting client-side role or tenant values.

## User roles

SIMS supports six application roles:

| Role | Main responsibilities |
| --- | --- |
| `student` | Browse eligible opportunities, apply, manage placement activity, submit daily reports, and roll them into weekly submissions |
| `faculty_supervisor` | Review weekly submissions for assigned students, request revisions, complete faculty evaluations, and record official final grades |
| `coordinator` | Assign faculty supervisors by student department and oversee university placements, reports, and analytics |
| `site_supervisor` | Supervise workplace placements, review logs, and complete site evaluations |
| `company_admin` | Manage company opportunities, review applicants, hire students, and invite site supervisors |
| `platform_admin` | Manage tenants, oversee users, approve accounts, and administer the platform |

Platform administration is separate from university and company tenant access. The platform supports a maximum of **two** platform-admin accounts, with the limit enforced server-side.

## Internship lifecycle

The main workflow follows this progression:

```text
Opportunity
  draft → published → closed
      │
      ▼
Application
  draft → submitted → under_review → shortlisted
                                      │
                         ┌────────────┴────────────┐
                         ▼                         ▼
                     accepted                  rejected
                         │
                         ▼
Placement
  active → completed / cancelled
      │
      ├── Daily activity reports → weekly roll-up → assigned faculty review / revision
      ├── Supervisor check-ins
      ├── Midterm and final evaluations
      ├── CVs and reports
      └── Official final grade (recorded by assigned university faculty supervisor)
```

Posting visibility can be open to all universities or restricted to selected universities. Students only receive published opportunities available to their university.

## Analytics and reporting

The analytics workspace is available to university coordinators and company administrators. Results are limited to records visible to the authenticated user's university or company.

### University coordinator analytics

- University-wide student and faculty counts, active and completed placements, pending applications, weekly reports awaiting review, and placements without an assigned faculty supervisor.
- Placement breakdowns by student department and programme.
- Faculty supervisor workload based on assigned placements.
- Application pipeline by status.
- Daily report volume and weekly submission states: approved, awaiting review, and returned for revision.
- Official final-grade average and grade bands.
- Date, department, and programme filters for placement and application reports.
- CSV export of the filtered placement register.

### Company administrator analytics

- Students hosted, active and completed placements, company opportunities, and application activity.
- Placement portfolio by department and application pipeline.
- Daily and weekly reporting activity for company placements.
- Midterm and final evaluation score summaries.
- University-issued final grades displayed as read-only information; company administrators cannot change official grades.
- Date, department, and programme filters and filtered placement-register CSV export.

### Reporting workflow and grade ownership

Students record daily work reports against an active placement. Daily reports are rolled up into a weekly submission. The assigned university faculty supervisor reviews the weekly submission and either approves it or requests a revision. The university coordinator assigns supervisors, with department matching used to guide assignment. Only the assigned faculty supervisor can record the official final internship grade after weekly reports have been approved. Company administrators may view the official grade but cannot edit it.

Analytics are derived from tenant-visible records. Empty states indicate that no matching records are available; dashboards do not use fabricated sample metrics.

## Security

Security is enforced at the database and server boundaries, not only through frontend route visibility.

- **Tenant isolation:** RLS policies scope access to the authenticated user's university or company.
- **Role protection:** Users cannot grant themselves a role or change their tenant assignment.
- **Account approval:** Student registrations begin in a pending state and must be approved by a platform administrator before application access is granted. Pending, suspended, and blocked accounts are denied tenant data access by database authorization helpers.
- **Email confirmation:** SIMS separates email verification from administrator approval. The repository's local Supabase configuration sets `auth.email.enable_confirmations = false`, so local users can sign in without confirming an email address. For the hosted project, configure the equivalent **Authentication → Sign In / Providers → Email → Confirm email** setting to OFF if password sign-in should not require email verification. This does not approve an account or bypass the SIMS administrator-approval checks.
- **Trusted provisioning:** Privileged account creation is performed by server-side functions using trusted application metadata.
- **Admin authorization:** User directory, moderation, tenant deletion, and platform-admin management are restricted to authorized platform administrators.
- **Private documents:** CVs and reports use private storage buckets and policy-controlled access. Company logos use a public bucket.
- **Audit and notifications:** Sensitive changes are recorded, and relevant user notifications are generated by backend workflows.
- **Secret handling:** The Supabase service-role key must remain server-side and must never be exposed through a `VITE_*` variable.

### Edge Functions

The repository includes these functions:

| Function | Purpose |
| --- | --- |
| `invite-user` | Validates and provisions invited staff accounts |
| `manage-admins` | Creates and removes platform-admin accounts within the two-admin limit |
| `signup-admin` | Handles the public, capped initial administrator signup flow |
| `manage-users` | Handles privileged user and tenant deletion workflows |

## Getting started

### Prerequisites

- Node.js 18 or later (Node.js 20 or 22 recommended)
- npm
- Docker Desktop, for running the local Supabase stack
- Supabase CLI, invoked through `npx`

### 1. Install dependencies

```bash
npm install
```

### 2. Start local Supabase

```bash
npx supabase start
```

The first run downloads the required Docker images. The CLI prints the local API URL and anon key when the services start.

### 3. Apply migrations and seed data

```bash
npx supabase db reset
```

This recreates the local database, applies migrations, and loads the configured seed data.

### 4. Configure the web application

Copy the example environment file:

```bash
cp .env.example .env
```

Add the local Supabase URL and anon key as described below.

### 5. Start the development server

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

### Local Supabase services

| Service | Local address |
| --- | --- |
| API | `http://127.0.0.1:54321` |
| Supabase Studio | `http://127.0.0.1:54323` |
| Database | `127.0.0.1:54322` |
| Inbucket email testing | `http://127.0.0.1:54324` |

## Environment configuration

The web app reads the root `.env` file.

```dotenv
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<your-local-anon-key>
```

Only the Supabase project URL and public anon key belong in the browser environment.

> **Important:** Never place `SUPABASE_SERVICE_ROLE_KEY` in a frontend environment variable or expose it to the browser. Keep it in the server-side environment used by Supabase Edge Functions.

For local function development, Supabase CLI injects `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` when serving functions through the local stack.


## Database tests and verification

Run the database test suite against the local Supabase database:

```bash
npx supabase db reset
npx supabase test db
```

The pgTAP suite is located at `supabase/tests/rls.test.sql` and contains 25 assertions covering tenant isolation, posting visibility, company scoping, workflow permissions, and privilege-escalation protections.

Run frontend checks with:

```bash
npm run typecheck
npm run build
```

### Verification notes

The repository's recorded verification status reports successful dependency installation, TypeScript checks, and production build. Several UI flows have also been exercised against a mocked Supabase backend.

The local Supabase database reset and pgTAP suite were **not run in the recorded environment because Docker was unavailable**. Mocked frontend checks do not prove live database RLS behavior. Run the database tests in a Docker-capable environment or against an appropriately configured test project before treating database security as fully verified.

## Deployment

1. Create a Supabase project and link the repository:
   ```bash
   npx supabase link --project-ref <project-ref>
   ```
2. Apply database migrations:
   ```bash
   npx supabase db push
   ```
   Do not deploy `supabase/seed.sql` to production.
3. Set the required server-side function secrets. Keep the service-role key out of the frontend.
4. Deploy all four Edge Functions:
   ```bash
   npx supabase functions deploy invite-user
   npx supabase functions deploy manage-admins
   npx supabase functions deploy signup-admin
   npx supabase functions deploy manage-users
   ```
5. In Supabase Auth settings, configure the production Site URL and the allowed redirect URLs, including the password-reset route. Under **Authentication → Sign In / Providers → Email**, turn **Confirm email** OFF if the intended SIMS login flow does not require email verification. This hosted dashboard setting is separate from the local `auth.email.enable_confirmations = false` setting in `supabase/config.toml`. Keep SIMS administrator approval and database authorization checks enabled.
6. Configure the web host with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
7. Build and deploy the static web output from `apps/web/dist`. Configure the host to serve `index.html` as the SPA fallback.

Storage buckets, RLS policies, and realtime publication are created by the database migrations.

## Project structure

```text
apps/web/                 Frontend application
packages/shared/          Shared domain package
supabase/migrations/      Database migrations
supabase/functions/       Edge Functions
supabase/tests/           pgTAP tests
supabase/seed.sql         Local sample data
```

## Roadmap

- [x] React web application foundation
- [x] Multi-role and multi-tenant application model
- [x] Supabase authentication and database authorization model
- [x] Internship application and placement workflows
- [x] Daily-to-weekly internship reporting and assigned faculty approval workflow
- [x] Supervisor logs, evaluations, and official faculty grading workflow
- [x] University and company analytics with filters, performance breakdowns, and CSV export
- [x] Platform-admin and account-moderation workflows
- [ ] Execute the full pgTAP suite against a running database
- [ ] Complete live end-to-end verification of privileged Edge Functions
- [ ] Build the Expo / React Native mobile application using `@sims/shared`

---

<p align="center">
  <strong>SIMS — bringing internship coordination into one structured platform.</strong>
</p>
