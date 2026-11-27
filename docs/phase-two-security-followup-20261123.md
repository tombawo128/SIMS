# Phase Two security follow-up — 23 November 2026

This follow-up is source-only. No production migration, function deployment, Auth setting, secret, merge, or production data mutation was performed.

## CI baseline

- PR #19 is merged; this work is on a separate follow-up branch because the original PR is closed.
- The latest main-branch database rebuild applied the complete migration history successfully.
- The existing integration-services and RLS tests passed in that run.
- The role-negative suite failed before completion: malformed dollar-quote syntax stopped the file after the early assertions. Earlier CI also showed two incorrect expectations and a direct-table-read test that aborted on privilege denial.
- The follow-up PR's first frontend build failed with TS2339 because App.tsx expected a named `Login` export while Login.tsx contained a legacy landing-page module. The follow-up restores a functional named Login page; frontend CI and Vercel preview must be rerun.
- The follow-up corrects the test syntax, tests a foreign draft posting rather than a publicly published posting, uses privilege checks instead of direct SELECTs on service-only tables, and keeps the intended authenticated grant for the guarded account-status RPC.

## Source fixes and regression coverage

1. **Suspended faculty statistics:** the old `faculty_stats()` guard used `auth_role() <> 'faculty_supervisor'`. A suspended user's NULL role could bypass that condition. A new migration uses a NULL-safe role check and rejects missing user IDs. The negative suite tests suspended faculty.
2. **Webhook payload minimization:** application events omit redundant tenant IDs; placement events omit final grades; evaluation events omit rubric, comment and overall score. Synthetic pgTAP assertions cover placement and evaluation payloads.
3. **Role regression:** the expanded role-negative suite plans 21 assertions, including suspended coordinator and faculty checks for assignment, stats, weekly review and final grading.
4. **Build gate:** the named Login module mismatch is corrected to restore sign-in form routing; build verification remains pending.

## Live production parity (read-only checks)

- The repository has 35 migration versions; production has 24 recorded versions. **13 repository migration versions are absent from production history**: `20261109000001` through `20261109000007`, `20261113000001`, `20261116000001` through `20261116000003`, `20261117000001`, and `20261119000000`.
- Production also records two versions not present in main (`20261117200053` and `20261117213215`); their names match repository migrations under different version IDs (`add_profile_notification_preferences` and `fix_job_postings_select_policy_for_insert_returning`). This is migration-ledger drift, not a reason to blindly replay files. Reconcile the actual schema and history first.
- Live definitions of `assign_faculty_supervisor`, `review_weekly_log`, `record_grade`, and `faculty_stats` use NULL-unsafe `auth_role() <> ...` guards. Production `record_grade` is still the three-argument form; main has the newer two-argument form. The repository's 20261116 workflow migrations contain NULL-safe guards for assignment, weekly review and grading, but those migration versions are absent from production history. These live definitions are a potential suspended-account authorization bypass; they have not been exercised against production.
- Production has 42 public SECURITY DEFINER functions: zero with unpinned `search_path`, zero executable by anon, and 35 executable by authenticated users. A body-pattern triage of those 35 identified four NULL-unsafe role guards: `assign_faculty_supervisor`, `review_weekly_log`, `record_grade`, and `faculty_stats`. `accept_application` and `review_application` also use `NOT IN` role checks, but their tenant comparisons are NULL-safe; they still need suspended-user regression coverage. The 35 advisor warnings are not automatically defects; intended grants must be retained where function-body authorization is sound.
- Migration `20261119000000_phase_two_integration_services` is not present in production migration history.
- Production `integration-admin` is version 4 and contains only the earlier connection/API-key controls; webhook, SSO and embed administration in the repository is not deployed.
- Production `integration-api` is version 2 and lacks the repository's per-key rate-limit and request-audit implementation.
- `integration-embed` and `integration-webhook-worker` are absent from the live Edge Function inventory.
- The three advisor tables with RLS enabled but no policies (`integration_api_keys`, `integration_connections`, `provision_tickets`) were checked for direct grants: anon and authenticated have no SELECT/INSERT/UPDATE/DELETE privileges; service_role has SELECT. These are service-only tables, not an authorization finding to resolve by blindly adding policies.
- Leaked-password protection remains disabled. No Auth setting was changed.

## Remaining deployment blockers

- **Outbound SSRF/DNS rebinding:** the worker validates DNS answers and uses a configured hostname allowlist, but the actual fetch connection is not pinned to the screened DNS result. A network-level egress restriction or transport-level pinning solution and verification are still required. The worker is not deployed.
- **Delivery reliability:** the outbox supports retry and stale-processing recovery, but delivery is at-least-once; duplicates can occur after a remote success and local status-update failure. Idempotency and operational monitoring still need review.
- **SSO:** configurations are draft/pending-verification only; provider metadata and domain ownership are not verified and no production SSO flow is enabled.
- **Operational readiness:** worker scheduling/monitoring and production migration/function parity remain unverified.
- **Backup and recovery:** deliberately deferred; production migration and deployment remain gated on backup/PITR and recovery verification plus explicit authorization.

## Safe next step

Run the follow-up PR's full database rebuild, SQL regression, frontend and Edge checks; resolve only evidence-backed failures. Then complete the per-function permission review and SSRF transport/egress design. Production rollout remains a separate approved, backed-up, reversible step.


## 25 November CI diagnosis and fixture correction

- The backend run on commit `918ad313ca7adc59cef39a5affefdba4bccdc5ba` applied the complete migration history and passed the existing RLS test, but the expanded role-negative suite stopped at assertion 18 of 21 during the synthetic profile-status restore. The profile guard rejected a test-fixture update because the helper left the test JWT subject set to the same coordinator profile being restored; this was a harness failure, not evidence that the coordinator authorization assertion failed.
- Commit `c7e4a7e4ad456511e67afd83b379274e626e8b6f` changes the fixture setup to set the JWT subject to the synthetic platform-admin identity before profile-status setup/restore mutations, avoiding self-protection while preserving the suspended-role assertions.
- The new commit has a successful Vercel preview status, but no backend workflow run or backend CI status is currently associated with this SHA. Therefore the fixture correction and all 21 role-negative assertions remain **unverified by CI** until a run is available.


## Verification trigger update — 25 November 2026

- Added `fix/phase-two-security-followup` to the backend-verification workflow's push branch filter so branch pushes can request the full database and Edge verification directly as well as via PR events.
- The latest commit at this note's time, `bd01fe22b1f8729d007345a06a4133a0d947e5cf`, still has no GitHub Actions backend run associated with it. The Vercel check is pending. The GitHub connector's commit operation did not produce an observable Actions run, so manual CI dispatch or an equivalent push from an Actions-triggering credential is still needed to verify the 21-test suite.


## Fresh read-only production verification — 26 November 2026

- Rechecked the connected Supabase production project with SELECT-only queries. The live definitions of `assign_faculty_supervisor`, `review_weekly_log`, `record_grade`, and `faculty_stats` still use `auth_role() <> ...` role guards, which are NULL-unsafe for suspended accounts. All four are SECURITY DEFINER with `search_path=public`; the database ACL check shows EXECUTE for authenticated and service_role, and none for anon. This confirms a potential authorization bypass in the live schema; no production RPC was invoked to test it.
- Rechecked webhook event capture trigger attachments: **no live triggers** are attached to the production tables for `capture_integration_webhook_event()`. The integration-services migration remains absent, so production event capture/outbox functionality is not active.
- Production migration inventory remains 24 versions. Production Edge Function inventory contains `integration-admin` v4 and `integration-api` v2, but no `integration-embed` or `integration-webhook-worker`.
- Security advisor remains at 35 authenticated SECURITY DEFINER warnings, three RLS-enabled/no-policy informational findings for service-only tables, and leaked-password protection disabled. The no-policy tables still have no direct anon/authenticated grants; no ACL change was made.
- The follow-up branch ref was missing and has been recreated at PR #24's last recorded head commit `f2d7049ee3b22a22e6f393bbc66526221f99d671`. This is branch recovery only; no PR merge or production change.
- PR #24 still has no observable backend Actions run on its latest recorded commit. The Vercel status is successful, but it does not verify the SQL regression suite.

### Confirmed blockers

1. Production migration-ledger/schema reconciliation and backup/recovery verification are required before deployment.
2. The four live NULL-unsafe workflow guards require an approved, reconciled migration and suspended-account regression; do not apply it directly in production.
3. Webhook event capture is not installed in production; outbound DNS screening remains vulnerable to resolution/fetch mismatch unless transport pinning or network egress controls are verified.
4. The 21-assertion role-negative suite and the payload-minimization tests remain unverified by a fresh CI run.


## Fresh read-only audit — 27 November 2026

- Production Supabase security advisor was refreshed at 12:18 UTC: **35** authenticated SECURITY DEFINER warnings, **3** RLS-enabled/no-policy informational findings on service-only tables, and **1** leaked-password-protection warning. This is a function review queue, not a blanket-revoke instruction.
- Read-only ACL verification again showed the three service-only tables `integration_api_keys`, `integration_connections`, and `provision_tickets` have no direct SELECT privilege for `anon` or `authenticated`; `service_role` has SELECT. No grants or policies were changed.
- A separate read-only trigger query returned no trigger attached to a public table for `capture_integration_webhook_event()`; production webhook event capture remains inactive.
- The four live workflow functions `assign_faculty_supervisor`, `review_weekly_log`, `record_grade`, and `faculty_stats` still contain NULL-unsafe `auth_role() <> ...` guards. Their `search_path=public` is pinned, and the ACL check remains EXECUTE for authenticated/service_role but not anon. This is a potential suspended-account authorization bypass; no function was invoked to test it and no production change was made.
- Production still records 24 migrations; the Phase Two integration-services migration remains absent. The live Edge Function inventory still lacks `integration-embed` and `integration-webhook-worker`; `integration-admin` remains v4 and `integration-api` v2.
- The old backend run 390 log is not current-head verification: it failed while parsing an earlier 17-test snapshot (8 tests executed; 0 assertion failures before a malformed dollar-quote error). The branch's current `role_negative.test.sql` file has a 21-test plan and corrected dollar-quoting, but **no fresh backend Actions run is observable for the PR's current head**. The current head's combined status only exposes a successful Vercel check. Do not treat the stale run as either a current failure or a pass.

## Current gate

Production remains untouched. Reconcile migration history/schema and verify backups/recovery before any migration or deployment. The current branch's full database tests, payload-minimization tests, Storage/analytics API smoke tests and controlled outbound transport/egress verification remain unverified.
