# Production migration reconciliation — SIMS

## Current status

**Do not run `supabase db push` against production until the remaining historical migration reconciliation is signed off.**

Project: `bdndnacbasmfndzylwpb` (SIMS, eu-central-1).

- Production now records **21 migrations**.
- The `backend-hardening` branch contains **29 migration files**.
- Seven reviewed migrations were applied to production and mirrored in the branch with their exact production versions.
- The remaining eight-file difference is the seven initial repository baseline migrations plus `20261113000001_archive_entities.sql`. Their expected objects appear in the live schema, but the exact object-by-object equivalence and migration-ledger repair plan still need sign-off.
- Several older migration names are represented by different version identifiers in production and GitHub. Do not assume same-name files are safe to mark applied without comparing their SQL effects.
- Production currently exposes 21 public application tables, all with RLS enabled.
- At the time of the original audit, production had four profile rows, five notifications, five audit log rows, and three deleted-entity rows. These are audit observations, not migration targets.

## Production migration ledger (latest verified)

```text
20261110191021 add_provision_tickets_for_privileged_signups
20261113205548 restore_admin_user_directory_rpc
20261113211056 restore_student_account_approval_rpc
20261113214348 add_admin_broadcasts_alerts_analytics
20261113215010 add_system_alert_admin_actions
20261113224343 restrict_coordinator_rpc_execution
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
20261114220926 optimize_rls_policies_and_fk_indexes
20261114220954 optimize_tenant_directory_policies_and_fk_indexes
```

## Production fixes applied

### Authorization and account lifecycle
- Public administrator registration is disabled; `admin_signup_available()` returns `false`.
- `signup-admin` is production version 3 with JWT verification enabled and returns HTTP 410 for POST.
- `manage-users` is production version 5 and rejects suspended or archived callers.
- `invite-user` and `integration-admin` are production version 4 and reject suspended or archived callers.
- `auth_role()`, `auth_company_id()`, `auth_university_id()`, and `is_platform_admin()` now treat suspended and archived accounts as inactive.
- Self-service profile updates cannot alter role, tenant ownership, account status, or archive attribution.
- `notify_user()` is callable only by `service_role`.
- Trigger-only functions are not directly executable by API clients.
- The platform-admin maximum is enforced by a unique slot constraint and transaction-scoped trigger lock. Production currently has one platform administrator in slot 1; the trigger function itself is not executable by anon/authenticated.

### Storage and privileged provisioning
- `reports_owner_delete` allows only an authenticated student to delete a report object inside their own placement-scoped folder. Document metadata ownership remains separately enforced.
- The `post-images` bucket is public for image delivery, while uploads, reads through the authenticated API, and deletes are scoped to the uploader's folder.
- `provision_tickets` is RLS-enabled and service-role-only. The auth-user trigger consumes a one-time ticket for privileged account provisioning.
- `invite-user` cleans up a provisioning ticket if Auth user creation fails.

### Performance and policy structure
- Eleven RLS policies were updated to cache auth/role lookups per statement.
- All previously reported unindexed foreign keys now have covering indexes.
- Overlapping authenticated tenant-directory SELECT policies were split so public active reads and platform-admin reads/writes no longer create duplicate permissive SELECT policies.
- Mutable search paths were fixed for `set_updated_at()` and `try_uuid()`.

## Latest Supabase advisor findings

- **No anonymous SECURITY DEFINER RPC warnings remain.**
- Three RLS-enabled tables have no direct policies: `integration_api_keys`, `integration_connections`, and `provision_tickets`. This is intentional: they are accessed only by trusted service-role Edge Functions.
- The advisor still reports 35 SECURITY DEFINER functions executable by authenticated users. These are application RPCs and identity helpers; they must retain their in-function role/tenant authorization checks. Do not revoke them indiscriminately, because normal SIMS workflows depend on them.
- The Auth advisor reports leaked-password protection is disabled. This setting is not exposed by the connected management actions; enable it in Supabase Dashboard → Authentication → Security and Password Protection.
- The performance advisor no longer reports unindexed foreign keys, RLS auth-initplan warnings, or multiple permissive tenant-directory policies.
- The advisor reports unused indexes because production traffic is still very low. Do not remove them based on this early usage sample.

## Remaining migration reconciliation

1. Take a verified Supabase backup/snapshot and retain the backup identifier.
2. Export production schema definitions for tables, columns, constraints, indexes, enums, functions, triggers, RLS policies, grants, storage buckets and storage policies. Do not export secrets.
3. Compare the export against the exact branch commit. Compare definitions and behavior, not just object names or row counts.
4. Classify each of the seven baseline files and `archive_entities` as already represented, partially represented, pending, or obsolete/conflicting.
5. Map each older same-name/different-version migration to its production equivalent by comparing SQL and resulting objects.
6. Only after review, prepare a `supabase migration repair --status applied` plan for migrations whose effects are proven to exist. Never repair the ledger merely to silence a mismatch.
7. Apply only genuinely pending migrations, one at a time, and run database tests plus application smoke tests after each group.

## Verification and deployment blockers

- The branch now contains matching migration files for the seven newly applied production hardening migrations, plus the previously missing provisioning-ticket and post-image migration sources.
- The latest local database rebuild and pgTAP suite must pass after these final migration additions.
- Test real storage upload/download/delete with separate student and non-owner accounts in a non-production environment. Production currently has no report objects to safely use for a live delete test.
- Complete live smoke tests for the four updated Edge Functions, especially invitation creation, admin-only integration management, and the disabled signup endpoint.
- Vercel has rate-limited deployment attempts for 24 hours. A preview deployment and browser smoke test remain outstanding.
- PR #4 remains open and unmerged. No production frontend deployment has been performed.

## Safety record

Seven reviewed additive/hardening migrations were applied to production and recorded. They changed authorization functions, grants, storage policies, indexes, RLS predicates, tenant-directory policies, utility function search paths, and the platform-admin slot invariant. One existing platform-admin profile received slot 1. No application records were deleted or rewritten. The historical migration ledger was not repaired or rewritten. No paid Supabase branch was created.
