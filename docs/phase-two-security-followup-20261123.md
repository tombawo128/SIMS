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

- Migration `20261119000000_phase_two_integration_services` is not present in production migration history.
- Production `integration-admin` is version 4 and contains only the earlier connection/API-key controls; webhook, SSO and embed administration in the repository is not deployed.
- Production `integration-api` is version 2 and lacks the repository's per-key rate-limit and request-audit implementation.
- `integration-embed` and `integration-webhook-worker` are absent from the live Edge Function inventory.
- The three advisor tables with RLS enabled but no policies (`integration_api_keys`, `integration_connections`, `provision_tickets`) were checked for direct grants: anon and authenticated have no SELECT/INSERT/UPDATE/DELETE privileges; service_role has SELECT. These are service-only tables, not an authorization finding to resolve by blindly adding policies.
- The Security advisor reports 35 authenticated-executable SECURITY DEFINER functions. CI's RLS test verifies search-path hardening and anon execution restrictions, but the individual function-body/role/tenant audit is not complete.
- Leaked-password protection remains disabled. No Auth setting was changed.

## Remaining deployment blockers

- **Outbound SSRF/DNS rebinding:** the worker validates DNS answers and uses a configured hostname allowlist, but the actual fetch connection is not pinned to the screened DNS result. A network-level egress restriction or transport-level pinning solution and verification are still required. The worker is not deployed.
- **Delivery reliability:** the outbox supports retry and stale-processing recovery, but delivery is at-least-once; duplicates can occur after a remote success and local status-update failure. Idempotency and operational monitoring still need review.
- **SSO:** configurations are draft/pending-verification only; provider metadata and domain ownership are not verified and no production SSO flow is enabled.
- **Operational readiness:** worker scheduling/monitoring and production migration/function parity remain unverified.
- **Backup and recovery:** deliberately deferred; production migration and deployment remain gated on backup/PITR and recovery verification plus explicit authorization.

## Safe next step

Run the follow-up PR's full database rebuild, SQL regression, frontend and Edge checks; resolve only evidence-backed failures. Then complete the per-function permission review and SSRF transport/egress design. Production rollout remains a separate approved, backed-up, reversible step.
