# SIMS Batch 1 — Database and Backend Integrity Audit

**Audit date:** 2026-11-19  
**Repository baseline:** `main` at `e1038a43214989271485b7711d1cd3810420fdbd`  
**Supabase project:** `bdndnacbasmfndzylwpb` (SIMS, eu-central-1)  
**Database:** PostgreSQL 17.11  
**Scope:** Read-only production catalogue and migration inspection, plus repository source review.

## Executive status

**Batch 1 is not complete. Production schema changes remain blocked.**

The live database is healthy, but the production schema and the currently deployed frontend are out of sync. The migration reconciliation document is also stale. The Supabase organization is on the Free plan, so a verified manual database export is required before any production DDL work. Storage objects must be backed up separately because database backups do not include Storage API objects.

No production schema, data, migration history, Auth configuration, or deployment was changed during this audit.

## 1. Live database baseline

- Project status: `ACTIVE_HEALTHY`.
- 21 public application tables; all 21 have RLS enabled.
- Three RLS-enabled tables have no direct policies: `integration_api_keys`, `integration_connections`, and `provision_tickets`. The existing reconciliation document describes these as service-role-only tables used by trusted Edge Functions. This is intentional only while those access paths remain service-role-only.
- No unvalidated public-schema constraints were found.
- No unindexed foreign-key columns were found in the catalogue audit.
- 28 public-table triggers were found.
- 46 public-schema functions were found, 42 marked `SECURITY DEFINER`.
- No public `SECURITY DEFINER` function was executable by `anon`.
- 35 `SECURITY DEFINER` functions were executable by `authenticated`. Supabase reports these as warnings; do not revoke them indiscriminately. Their role, tenant, and caller checks require a separate authorization review.
- Trigger-only functions inspected (`assign_platform_admin_slot`, `audit_row_change`, `guard_application`, `guard_profile_update`, and `set_updated_at`) were not executable by `anon` or `authenticated`.
- The inspected security-definer functions without a conventional `search_path=public` setting use an empty search path or `pg_catalog`, with schema-qualified object references; this is not itself evidence of a search-path vulnerability.
- No health-advisor findings were returned.

## 2. Migration reconciliation

The live Supabase migration ledger contains **24 entries**.

The current `main` branch contains **34 migration files**. The older `backend-hardening` branch contains 30 files and is not the current repository baseline.

The 34 files on `main` comprise:
- Seven original baseline migrations.
- One archive-entities migration.
- 24 migration effects represented in the live production ledger.
- Two additional migrations whose effects are not present in production.

Two production ledger entries have logical counterparts in `main` under different version identifiers:
- Production `20261117200053_add_profile_notification_preferences` corresponds to the repository migration `20261117000001_add_profile_notification_preferences.sql`.
- Production `20261117213215_fix_job_postings_select_policy_for_insert_returning` corresponds to `20261116000001_fix_job_postings_select_policy_for_insert_returning.sql`.

The live schema contains the notification-preferences column and the direct company/published-posting SELECT policy expected from those changes. This confirms the expected effects, not byte-for-byte identity of the original SQL that was applied.

The two additional `main` migrations not represented in the live ledger are:
1. `20261116000002_complete_supervisor_and_weekly_assessment_workflow.sql`
2. `20261116000003_weekly_coverage_settings_and_company_evaluation.sql`

Production catalogue checks confirm that the following effects are absent:
- `public.faculty_supervisor_requests`.
- Weekly-log rating columns `rating_scores`, `rating_overall`, `rating_comment`, `rated_by`, and `rated_at`.
- RPCs `request_faculty_supervisor` and `rate_weekly_log`.
- The automatic-grade RPC signature `record_grade(uuid,text)`.

Production still has the older `record_grade(uuid,numeric,text)` signature.

**Do not run `supabase db push` or migration repair yet.** The eight historical baseline/archive files still require their documented source-effect sign-off, and the two pending workflow migrations must be tested as a pair before production rollout.

## 3. Frontend/database contract mismatch

The latest Vercel production deployment is READY and is built from `main` commit `e1038a43214989271485b7711d1cd3810420fdbd`.

The current frontend source calls:
- `request_faculty_supervisor(p_placement_id)`
- `rate_weekly_log(p_log_id, p_rubric, p_comment)`
- `record_grade(p_placement_id, p_notes)`

The live production database does not expose the first two functions and only exposes the older manual-grade signature. Therefore, the corresponding supervisor-request, weekly-rating, and automatic-grade actions are not backed by the current production schema. This is a production-readiness blocker.

The two pending migrations are intended to supply these database contracts. The current repository test file `supabase/tests/rls.test.sql` includes assertions for these workflows, but a successful run against the current `main` migration set has not been established by this audit.

## 4. Constraint and integrity observations

- The live `profiles.notification_preferences` values currently pass a read-only check for the four expected boolean keys.
- The live database constraint only enforces that `notification_preferences` is a JSON object. It does not enforce the presence and boolean type of each expected preference key.
- The pending workflow migration adds stronger preference validation. It should be reviewed for compatibility with existing profile values before rollout.
- Foreign-key indexes and constraint validation showed no current catalogue gaps.
- Several foreign keys intentionally use cascading deletes. Hard deletion of an Auth user can cascade through their profile and related student/application/placement records. The normal account lifecycle should continue to use the platform's archive/suspend flows; hard deletion must be treated as a destructive operation and tested separately.

## 5. Advisor findings

### Security
- Three RLS-enabled tables have no direct policies, as described above.
- 35 authenticated-executable `SECURITY DEFINER` functions are reported. Their permissions are required by current application RPCs in several cases; review their in-function authorization rather than blanket-revoking execution.
- Leaked-password protection is reported disabled. This is an Auth dashboard setting and remains outstanding.

### Performance
- 36 indexes are reported unused. Given the project's very small live data volume, do not drop these indexes solely on this advisor output.
- No missing foreign-key indexes were found in the direct catalogue check.

### Health
- No health-advisor findings were returned.

## 6. Backup and recovery gate

The Supabase organization is on the Free plan. Supabase's backup guidance recommends regular off-site logical exports for Free projects; daily managed backups are described for Pro, Team, and Enterprise plans.

Before production DDL:
1. Create a manual logical database export using the supported Supabase CLI backup/dump workflow.
2. Store the export outside the project and verify that it can be read/restored in a safe local environment.
3. Export Storage objects separately; a database dump does not include the underlying Storage API files.
4. Record the backup timestamp, file location, and verification result.

The connected project-management actions do not provide a way to create and verify that backup from this audit. No verified backup is currently recorded here.

## 7. Batch 1 disposition

| Check | Current result | Disposition |
|---|---|---|
| Production project identity/health | Confirmed | Pass |
| Tables and RLS coverage | 21/21 RLS enabled | Pass, with three intentional service-role-only tables |
| Migration ledger reconciliation | 24 live entries vs 34 `main` files | Blocked pending sign-off |
| Missing schema objects | Two workflow migrations absent | Blocker |
| Foreign keys/index coverage | No unindexed FK columns found | Pass |
| Constraint validation | No unvalidated constraints found | Pass |
| Notification preference validation | Existing data valid; DB constraint is weaker than desired | Follow-up |
| Triggers/functions/grants | Inventory completed; 35 authenticated definer RPC warnings | Requires authorization review |
| Transaction safety | Static workflow review and current-main migration test still required | Incomplete |
| Backup/recovery | Free plan; no verified off-site export recorded | Blocker |

## 8. Safe next sequence

1. Update the stale reconciliation record to reflect the 24-entry production ledger and 34-file `main` branch.
2. Obtain and verify the manual database export and separate Storage backup.
3. Review the two pending migrations together, including their function signatures, authorization checks, constraints, and migration ordering.
4. Run a complete local Supabase rebuild from the current `main` migration set and the repository's pgTAP suite. Do not use the production database for write tests.
5. Add explicit tests for frontend/RPC contract compatibility and the final-grade formula.
6. Prepare a reviewed production migration plan. Apply nothing until the backup, test evidence, and migration reconciliation are signed off.

## References

- [SIMS repository](https://github.com/tombawo128/SIMS)
- [Production migration reconciliation document](https://github.com/tombawo128/SIMS/blob/main/docs/production-migration-reconciliation.md)
- [Supabase database backup guidance](https://supabase.com/docs/guides/platform/backups)
- [Supabase database linter guidance](https://supabase.com/docs/guides/database/database-linter)
