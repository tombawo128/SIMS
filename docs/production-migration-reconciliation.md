# Production migration reconciliation — SIMS

## Current status

**Do not run `supabase db push` against production until the remaining historical migration reconciliation is signed off.**

Project: `bdndnacbasmfndzylwpb` (SIMS, eu-central-1).

- Production now records **22 migrations**.
- The `backend-hardening` branch contains **30 migration files**.
- Twelve branch migration filenames match production migration versions exactly. Ten logical counterparts have different version identifiers between the production ledger and `backend-hardening`; these need careful filename/history alignment before any future `db push`.
- The eight branch-only migration files are the seven initial repository baseline migrations plus `20261113000001_archive_entities.sql`. A read-only production catalogue comparison on 2026-11-16 confirmed their expected core objects are present. Two original tenant-wide RLS policies have been superseded by narrower policies; see the audit section below.
- Do not run `supabase db push` or repair migration history until the version mappings, source effects, and backup are signed off.
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
20261115152114 enforce_active_account_for_sensitive_workflows
```

## Production fixes applied

### Active-account workflow enforcement (2026-11-15)
- Applied `20261115152114_enforce_active_account_for_sensitive_workflows` to production.
- Updated sensitive student and supervisor RPCs to require an active role resolved from the caller's profile, not only a still-valid `auth.uid()`.
- Updated CV and placement access helpers to deny suspended or archived callers.
- Updated the application guard to reject writes by inactive or archived users.
- Mirrored the exact production migration version in `supabase/migrations/` on `backend-hardening`; the earlier un-applied `20261115140055` filename was removed to prevent ledger drift.


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

## Read-only schema reconciliation (2026-11-16)

The following checks were read-only against production. They establish that the expected object families exist; they do not prove that every historical migration file is byte-for-byte identical to the SQL originally executed in production.

- `20261109000001_schema.sql`: all 14 original core tables, all 12 original enum types, the original named indexes, and the original timestamp triggers are present. The original auth-user trigger is also present on `auth.users`.
- `20261109000002_functions.sql`: every function identity declared by the baseline file is present. Later migrations have deliberately replaced several function bodies with hardened versions.
- `20261109000003_rls.sql`: the core table policies are present. The original `universities_platform_all` and `companies_platform_all` policies are no longer present by those names; they were replaced by separate public active-read, authenticated active/admin-read, and platform-admin insert/update/delete policies. This is an intentional policy split, not a missing access-control layer.
- `20261109000004_storage.sql`: all six baseline storage policy names are present. Current bucket configuration was also checked: `cvs` and `reports` are private; `company-logos` and `post-images` are public.
- `20261109000005_realtime.sql`: `public.notifications` is included in `supabase_realtime`.
- `20261109000006_platform_admins.sql`: `list_platform_admins()` is present.
- `20261109000007_admin_console.sql`: `account_status`, the `profiles.account_status` column, and the admin directory/status-management RPCs are present.
- `20261113000001_archive_entities.sql`: `deleted_entities`, the archive columns on profiles/universities/companies, the partial archive index, the platform-admin read policy, and the archive/restore RPCs are present. The live archive RPC definitions were inspected and match the intended archive workflow.
- The `admin_broadcasts`, `system_alerts`, `daily_reports`, and `deleted_entities` tables all have RLS enabled. Their expected policies and indexes are present. The `withdrawn` application status is present.
- The six company/student workflow RPCs covered by `restrict_company_workflow_rpc_execution` are not executable by `anon`; they remain executable by `authenticated` and `service_role` as intended.
- Production still records 22 migrations while the branch has 30 files. The ten logical counterparts with different version identifiers are:

| Production ledger version/name | Branch migration file |
|---|---|
| `20261113205548_restore_admin_user_directory_rpc` | `20261113000002_restore_admin_user_directory_rpc.sql` |
| `20261113211056_restore_student_account_approval_rpc` | `20261113000003_restore_student_account_approval_rpc.sql` |
| `20261113214348_add_admin_broadcasts_alerts_analytics` | `20261113230000_add_admin_broadcasts_alerts_analytics.sql` |
| `20261113215010_add_system_alert_admin_actions` | `20261113233900_add_system_alert_admin_actions.sql` |
| `20261113224710_restrict_company_workflow_rpc_execution` | `20261114000001_restrict_company_workflow_rpc_execution.sql` |
| `20261113225148_add_withdrawn_application_status` | `20261114000002_add_withdrawn_application_status.sql` |
| `20261113225157_record_student_application_withdrawals_distinctly` | `20261114000003_record_student_application_withdrawals.sql` |
| `20261113230121_daily_reports_and_faculty_approval` | `20261114000004_daily_reports_and_faculty_approval.sql` |
| `20261113230512_assign_faculty_by_department` | `20261114000005_assign_faculty_by_department.sql` |
| `20261113230740_enforce_daily_to_weekly_submission` | `20261114000006_enforce_daily_to_weekly_submission.sql` |

The production function bodies inspected for these workflows contain the expected current behavior, including later active-account guards. The branch files must still be reviewed and aligned to production version identifiers before treating the repository migration history as release-ready.

## Remaining migration reconciliation

1. Take a verified Supabase backup/snapshot and retain the backup identifier. The connected Supabase management actions do not expose a backup/snapshot creation or verification operation, so this step has not been completed from ChatGPT.
2. Finish source-to-production comparison for the ten version-mismatched logical migrations, including function bodies, grants, policy expressions, constraints, and any data effects.
3. Align the ten branch migration filenames with the already-recorded production versions only after their SQL effects are confirmed; do not create duplicate migration-ledger entries for the same logical change.
4. Confirm the seven baseline files and `archive_entities` are fully represented, including grants and function definitions, not just object names.
5. After backup and review, prepare a `supabase migration repair --status applied` plan for only the eight branch-only migration versions whose effects are proven to exist. Never repair the ledger merely to silence a mismatch.
6. Apply only genuinely pending migrations, one at a time, and run database tests plus application smoke tests after each group.

## Verification and deployment blockers

- The branch now contains matching migration files for the eight reviewed production hardening migrations, plus the previously missing provisioning-ticket and post-image migration sources.
- **Passed on `backend-hardening` commit `87d812e77f6bb78a2b6596d354e0903826e42360`:** local Supabase startup, full rebuild of all 30 migrations, and all 61 pgTAP assertions.
- **Passed on the same commit:** Deno type-check for every Edge Function and the frontend verification workflow.
- The CI database port collision was resolved by overriding only the workflow's local database and shadow-database ports; developer defaults and production settings were not changed.
- Read-only production catalogue reconciliation completed for the eight branch-only historical migrations; migration version alignment and repair remain pending a verified backup and full source review.
- Test real storage upload/download/delete with separate student and non-owner accounts in a non-production environment. Production currently has no report objects to safely use for a live delete test.
- Complete authenticated live smoke tests for invitation creation, admin-only integration management, account lifecycle actions, and the disabled signup endpoint. Do not use the Vercel preview for write tests because it shares production Supabase credentials.
- Vercel's previous deployment rate limit has cleared and a SIMS Preview deployment is Ready. A full browser workflow smoke test is still outstanding.
- PR #4 remains open and unmerged. No production frontend deployment has been performed.

## Safety record

Eight reviewed additive/hardening migrations were applied to production and recorded. They changed authorization functions, grants, storage policies, indexes, RLS predicates, tenant-directory policies, utility function search paths, and the platform-admin slot invariant. One existing platform-admin profile received slot 1. No application records were deleted or rewritten. The historical migration ledger was not repaired or rewritten. No paid Supabase branch was created.
