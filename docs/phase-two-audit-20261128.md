# SIMS Phase 2 — read-only audit, 28 November 2026

## Repository/PR consistency

- PR #19 is merged; Phase 2 work continues in the draft follow-up PR #24.
- The GitHub PR metadata snapshot reports head `f2d7049ee3b22a22e6f393bbc66526221f99d671`.
- Resolving the follow-up branch ref separately returned commit `8b300fa98aaec3cafb01e4def50cdaf0cf7397e4`. The PR snapshot and branch-ref resolution are inconsistent; this audit does not assume that the branch commit is included in the PR's current diff.
- The branch's workflow includes a push trigger for `fix/phase-two-securityfollowup`, but the available commit run/status APIs do not show a fresh backend Actions run.

## Production checks

- Production migration inventory returned 24 versions. `20261119000000_phase_two_integration_services` remains absent. This is migration-ledger evidence, not a schema diff; do not replay missing migrations without reconciliation.
- Live Edge Function inventory: `integration-admin` v4 and `integration-api` v2; `integration-embed` and `integration-webhook-worker` are absent.
- Read-only `pg_get_functiondef` inspection confirms NULL-unsafe role checks in `assign_faculty_supervisor`, `review_weekly_log`, `record_grade` (three-argument signature) and `faculty_stats`. Their EXECUTE ACL is present for authenticated and service_role, absent for anon; `search_path=public` is pinned. These are potential suspended-account authorization bypasses; no RPC was invoked.
- The three policy-less integration/provision tables have direct table privileges only for service_role. No grants/policies were added.
- Security Advisor: 35 authenticated SECURITY DEFINER warnings; 3 RLS/no-policy informational findings; leaked-password protection disabled.
- Health Advisor returned no findings. Performance Advisor returned 35 unused-index informational findings; no index was removed.

## Regression review

- `supabase/tests/role_negative.test.sql` is configured for 21 assertions and uses seeded synthetic identities, with a rollback.
- The current file includes suspended coordinator and faculty checks. The database rebuild and the full 21-test suite are still unverified by a fresh backend run.
- Payload-minimization pgTAP checks and other CI checks are also not freshly verified.

## Release gates

- Reconcile the production schema/migration ledger and complete backup/recovery verification.
- Verify outbound webhook DNS screening against connection-time resolution or network egress enforcement.
- Verify worker scheduling, monitoring, retry recovery/idempotency, embed origin/tenant isolation, SSO, API-key scope/revocation and logging.
- Plan a reversible deployment and rollback only after gates and explicit approval.

No production migration, deployment, RPC execution, Auth setting change, grant change, data mutation or merge was performed.
