# Phase 1 live audit — preliminary evidence (2026-11-22)

Scope: connected Supabase production project audit using read-only SQL and advisor queries. This is a triage record, not a clearance certificate.

## Findings

- Supabase security advisor reports 35 SECURITY DEFINER functions callable by authenticated users. This is not proof of a vulnerability: each function's caller authorization, tenant boundary, argument validation, and privilege need review. Live SQL confirms examples use `search_path=public` and authenticated EXECUTE grants (e.g. `accept_application`, `archive_user`, `assign_faculty_supervisor`). A broad revoke is unsafe without call-path analysis.
- Three RLS-enabled tables without policies are flagged informationally: `integration_api_keys`, `integration_connections`, `provision_tickets`. Verify intended access is service-role-only and that exposed grants are denied; do not add permissive policies simply to silence the lint.
- Auth leaked-password protection is reported disabled.
- A live `pg_policies` inventory returned policies on 17 public tables. Policy presence alone is not proof of tenant isolation or completeness. Core entities needing function/RLS cross-check include applications, placements, weekly_logs, daily_reports, evaluations, documents, student_profiles, profiles, job_postings, posting_universities, universities, companies, notifications and audit_logs.
- A Phase 1 workflow/security regression audit remains incomplete: cross-tenant negative tests, role permissions, upload/document authorization, grade integrity, workflow transitions, audit-log privacy/coverage, and function-grant analysis must be evidenced before clearance.

## Safe next actions

1. Review all 35 flagged functions individually: owner, fixed search_path, grants, auth checks, tenant ownership, state validation, side effects, and negative tests.
2. Confirm direct table grants and RLS behavior for the three policy-less tables using anon/authenticated test contexts (not administrator SQL alone).
3. Enable leaked-password protection only through an approved settings change after confirming rollout impact.
4. Build role/tenant matrix regression tests and run them against test fixtures.
5. No production changes were made during this audit. Backup/recovery verification remains deferred as requested.
