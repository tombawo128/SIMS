# Phase 2 production parity — backup and migration preflight

**Scope:** SIMS PR #19, branch `fix/phase-two-completion`. This is a preflight plan only. It does not authorize production changes.

## Observed production state
- Project status observed as healthy; PostgreSQL 17.
- Production migration history does not include `20261119000000_phase_two_integration_services`.
- Phase 2 migration creates webhook, webhook-delivery, SSO, embed and API-rate-limit tables; triggers on existing application/reporting tables; privileged queue/rate-limit functions; and access controls.
- Production backup/recovery readiness has not been independently demonstrated in this audit.

## Gate A — backup/recovery evidence (must be recorded before rollout)
- [ ] Identify the latest successful automated backup/PITR window and retention policy in Supabase Dashboard.
- [ ] Confirm backup/PITR coverage includes the database state required for this change.
- [ ] Document recovery target (RPO/RTO), authorized operator, and rollback/escalation contact.
- [ ] Demonstrate restoration to a separate recovery environment or branch, not to production; verify schema and synthetic records, then document evidence.
- [ ] Confirm Storage recovery separately; database restoration alone is not proof of object recovery.
- [ ] Record backup timestamp, restore test timestamp, operator, result and evidence link. Do not expose credentials.

## Gate B — migration review
- [ ] Rebuild the migration on a clean local/preview database using the repository migrations.
- [ ] Compare the migration's assumptions against production schema, constraints, triggers, existing functions and privileges.
- [ ] Review trigger coverage and payload minimization; avoid sending student or sensitive data in webhook payloads.
- [ ] Review every SECURITY DEFINER function, owner, fixed search_path, execution grants and caller validation.
- [ ] Confirm RLS enabled and direct access revoked for new service tables; verify service-role-only RPC execution.
- [ ] Validate indexes, FK constraints and potential lock/latency impact; plan a low-traffic execution window.
- [ ] Define post-migration verification queries and rollback/forward-fix strategy. Dropping tables or reverting trigger changes is not an automatic rollback; preserve queued delivery records and audit evidence.
- [ ] Confirm no secrets or production data are copied into test environments.

## Read-only preflight SQL (run only after operator confirms target project)
```sql
-- Confirm project/database context
select current_database(), current_user, now();

-- Review existing integration table inventory
select schemaname, tablename
from pg_tables
where schemaname = 'public' and tablename like 'integration_%'
order by tablename;

-- Inspect relevant trigger inventory before migration
select event_object_table, trigger_name, action_timing, event_manipulation
from information_schema.triggers
where event_object_schema = 'public'
  and event_object_table in ('applications','placements','weekly_logs','daily_reports','evaluations')
order by event_object_table, trigger_name;

-- Review migration history (Supabase migration history)
select version, name
from supabase_migrations.schema_migrations
order by version;
```

## Rollout sequence (blocked until gates and explicit approval)
1. Obtain and record backup/recovery evidence; restoration test in isolated environment.
2. Review and rehearse migration on a production-like preview populated only with synthetic data.
3. Check CI and migration diffs; obtain release approval.
4. Apply migration in the agreed window only with explicit authorization.
5. Verify schema, grants, triggers, queue RPCs and rate-limit RPC using synthetic tests.
6. Deploy Edge Functions in controlled order; test each deployment, monitor and retain rollback options.
7. Do not close production parity until verification evidence is recorded.

**Current disposition:** blocked at Gate A. No production migration, deployment, Auth change or data modification performed.
