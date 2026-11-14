# Production migration reconciliation — SIMS

## Status

**Do not run `supabase db push` against production until this reconciliation is signed off.** No production DDL or migration-history changes were made during this audit.

Project: `bdndnacbasmfndzylwpb` (SIMS, eu-central-1).

## Observed production state (2026-11-14)

- Supabase reports 19 application migration-history entries after five hardening migrations were applied and recorded.
- The `backend-hardening` branch contains 23 SQL migration files after the storage/RPC hardening migration was added.
- Production currently exposes 21 public application tables. All 21 have RLS enabled.
- The production schema already contains the application areas represented by the repository baseline and later migrations: tenant directories, profiles, applications, placements, reports, integrations, deleted entities, broadcasts and system alerts.
- Production has four profile rows, five notifications, five audit log rows, and three deleted-entity rows at the time of inspection. Do not use these counts as a data migration target; they are only an audit snapshot.
- The migration ledger and repository filenames/versions are not a one-to-one match. Several migration names correspond to different version identifiers, and some repository baseline files are not represented by the same names in the production ledger.

## Production ledger snapshot

```text
20261110191021 add_provision_tickets_for_privileged_signups
20261113205548 restore_admin_user_directory_rpc
20261113211056 restore_student_account_approval_rpc
20261113214348 add_admin_broadcasts_alerts_analytics
20261113215010 add_system_alert_admin_actions
20261113224348 restrict_coordinator_rpc_execution
20261113224710 restrict_company_workflow_rpc_execution
20261113225148 add_withdrawn_application_status
20261113225157 record_student_application_withdrawals_distinctly
20261113230121 daily_reports_and_faculty_approval
20261113230512 assign_faculty_by_department
20261113230740 enforce_daily_to_weekly_submission
20261113234110 add_integration_connections_and_api_credentials
20261114084822 create_post_images_storage_bucket
20261114220336 disable_public_admin_signup
20261114220440 harden_profile_lifecycle_and_notifications
20261114220457 harden_storage_and_rpc_grants
20261114220630 enforce_platform_admin_limit
20261114220726 restrict_platform_admin_slot_trigger_rpc
```

## Required reconciliation procedure

1. Take a verified Supabase backup/snapshot and retain the backup identifier.
2. Export the production schema (including functions, triggers, policies, grants, indexes, enums, storage policies and bucket configuration) without exporting secrets.
3. Compare the export against the exact `backend-hardening` commit being considered for release. Compare object definitions, not only table names or row counts.
4. For every repository migration, classify it as:
   - already represented by an equivalent production schema change;
   - safely pending;
   - partially represented and requiring a bespoke idempotent migration; or
   - obsolete/conflicting and requiring a reviewed replacement.
5. Only after the comparison is complete, prepare a migration-ledger repair plan. Use `supabase migration repair --status applied` only for migrations whose effects are proven to exist in production. Never mark a migration applied merely to silence a version mismatch.
6. Apply only the reviewed pending migrations in a maintenance window, one at a time, verifying constraints, policies, function grants and application smoke tests after each group.
7. Re-run Supabase security/performance advisors and the application's SQL tests.

## Branch fixes prepared

- `20261114220000_harden_storage_and_rpc_grants.sql` adds a scoped authenticated DELETE policy for `reports/{placement_id}/{student_id}/{file}`, retains metadata ownership enforcement, revokes anonymous execution from internal authorization/statistics helpers, and pins utility function search paths.
- `supabase/tests/rls.test.sql` now asserts that the report deletion policy exists and is assigned only to authenticated users.

These changes are branch-only until reviewed and released. The storage policy deliberately does not grant company supervisors or arbitrary authenticated users deletion access to student report files.

## Emergency Edge Function changes already deployed

- `signup-admin` is now production version 3 with JWT verification enabled; POST requests return HTTP 410 and public administrator registration is disabled.
- Production RPC `admin_signup_available()` now returns `false`; the migration is recorded as `20261114220336_disable_public_admin_signup` and mirrored in this branch.
- Active-account role helpers and profile self-update protection were hardened; `notify_user()` is service-role-only; internal trigger functions are no longer callable as RPCs.
- Report-storage deletion is now restricted to authenticated students deleting their own placement-scoped report path.
- Anonymous execution was revoked from internal authorization and administrative helper RPCs; authenticated/service-role grants were explicitly restored where needed.
- Mutable search paths were fixed for `set_updated_at()` and `try_uuid()`.
- A database trigger and unique slot constraint now enforce the two-platform-admin maximum. Production currently has one platform admin, assigned slot 1. The trigger function itself has no API-client EXECUTE permission.
- `manage-users` is now production version 5; it verifies the caller's Supabase Auth token and rejects suspended or archived profiles before privileged account-management actions.
- `invite-user` and `integration-admin` are now production version 4; both reject suspended or archived callers. Failed invitation creation also cleans up its provisioning ticket.

These two function deployments do not apply database migrations or alter production rows.

## Release blockers still requiring operational verification

- Validate the new migration by a clean local database rebuild and the full pgTAP suite.
- Validate real storage upload/download/delete using separate student accounts and a non-owner account in a non-production environment.
- Finish reconciling the original 14-entry production ledger against the repository's pre-existing baseline and older migrations. The four new hardening migrations now have matching production and repository versions.
- Complete live smoke tests for the four updated Edge Functions, especially invite creation, admin-only integration management, and the disabled signup endpoint.
- Resolve the Vercel deployment quota before preview deployment and browser smoke testing.

## Safety

Five additive/hardening migrations were applied and recorded in production. They changed authorization functions, grants, storage policy, utility function search paths, and the platform-admin slot invariant; one existing platform-admin row was assigned slot 1. No application records were deleted or rewritten, no migration history was repaired or rewritten, no paid Supabase branch was created, and no Vercel deployment was triggered.
