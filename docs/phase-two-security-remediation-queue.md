# Phase 2 security review — next remediation queue

**Repository:** tombawo128/SIMS  
**PR:** #19 — `fix/phase-two-completion`  
**Scope:** Source review only; production remains untouched. Backup/recovery is deferred by project decision, but remains recorded as outstanding.

## Review findings (source-level; verify with tests before marking resolved)

### P1 — Webhook worker outbound DNS/transport enforcement
- The worker checks DNS A/AAAA records before fetch, but fetch performs its own resolution. The checked IPs are not pinned to the connection; the DNS validation and actual connection can therefore differ.
- Host allowlisting materially reduces the attack surface but does not itself prove the connection is made to a checked public address. Confirm runtime/proxy support for address pinning or an outbound proxy that validates and pins destinations.
- Ensure any redirects remain disabled (currently `redirect: 'manual'`) and regression-test redirect responses, DNS changes, mixed public/private answers, IPv4-mapped IPv6 and unusual URL forms.

### P1 — Webhook delivery durability and failure states
- Verify queue reclaim behavior for stale `processing` records, worker crashes between claim/send/update, duplicate delivery semantics, retry/backoff and terminal failure behavior.
- Test concurrent workers, response timeout, network error, non-2xx, database update failure and the maximum attempts. Delivery must be documented as at-least-once, not exactly-once.

### P1 — Webhook payload minimization
- Trigger payloads currently include application/placement identifiers and statuses; evaluation events include `overall_score`. Review event-by-event payloads and remove any field not strictly needed by recipients, especially sensitive student data.
- Verify enqueue function ownership/search path and execution privileges, trigger behavior and tenant binding.

### P1 — Embed security and data boundaries
- Review embed response CSP `frame-ancestors`, stored origin validation, missing/forged Origin handling, and the fact that origin checks are not authorization for public content.
- Validate university visibility filtering and company posting ownership/status. Confirm selected-university mappings cannot leak other tenants' postings and test display options against missing/malformed values.
- Verify token rotation/revocation and ensure embeds expose only published fields and records.

### P1 — Integration API observability and robustness
- Confirm all failure paths produce consistent status codes and audit events; the API request audit helper is best-effort and logs failures to console, so establish whether this is acceptable or requires durable monitoring.
- Check key revocation/expiry, scopes, tenant isolation, rate limit concurrency, limits and pagination semantics. Test that error paths (including DB errors) don't leak sensitive details.

### P1 — Privileged functions and grants
- Inventory all SECURITY DEFINER functions introduced/changed, owner, fixed search_path, callers, argument validation, and EXECUTE grants (including PUBLIC/default grants).
- Verify trigger functions and nested function invocation work with restricted grants, and that no untrusted role can invoke them directly.

### P2 — SSO lifecycle and configuration validation
- Validate OIDC/SAML configuration and metadata safely; review issuer/metadata URL SSRF, domain ownership/verification, disabled/draft state enforcement, provider secret handling, and lifecycle cleanup.
- Confirm status transitions are explicit and audited, and provider IDs cannot be cross-tenant reused.

### P2 — Audit/logging privacy
- Review API request audit metadata (tenant identifiers, path, status, returned count) and endpoint errors. Avoid secret/token/payload logging and limit access/retention.

### P2 — Regression and integration tests
- Add/expand synthetic role/tenant regression tests covering API scopes, revoked/expired keys, rate-limit concurrency, webhook retries/duplicates, embed visibility/origin behavior, SSO state transitions, audit events and unauthorized function execution.

## Recommended order
1. Webhook worker outbound safety + reliability.
2. Payload minimization and function privilege review.
3. Embed tenant isolation and CSP/origin tests.
4. API auditing/error-path/rate-limit regression.
5. SSO validation and lifecycle.
6. Advisor findings, regression suite and final parity evidence.

## Safety status
- No production migration, deployment, merge, auth setting or data modification performed.
- Backup/recovery gate is deferred at the user's request, not cleared.
- Use synthetic data for testing.
