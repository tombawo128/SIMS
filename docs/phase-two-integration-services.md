# SIMS Phase Two Integration Services

This document describes the Phase Two integration services and the required release sequence. The migration and Edge Function changes are source-only until the production backup and recovery gate is completed.

## Implemented in the Phase Two branch

- **API management:** tenant-bound connections, one-time API secrets stored as SHA-256 hashes, scopes, expiry and revocation.
- **API activity:** successful scoped API reads and denied scope attempts are written to the platform-admin audit stream without recording response bodies. Valid API keys are limited to 60 requests per fixed 60-second window, with a `429` response and `Retry-After` header when exceeded; the counter is atomic and service-role-only.
- **Webhooks:** endpoint configuration, event subscriptions, encrypted one-time signing secrets, a durable database outbox, HMAC-SHA256 signatures, delivery history and bounded exponential retries. Shared IPv4/IPv6 screening rejects common special-use, private, reserved, documentation and transition ranges; unit tests are added to CI.
- **Event capture:** application, placement, daily/weekly-report and evaluation state changes enqueue tenant-specific webhook deliveries.
- **Embeds:** public, unguessable embed tokens; tenant-scoped published opportunities; HTTPS origin allowlists enforced by CSP `frame-ancestors`.
- **SSO configuration:** tenant-specific OIDC/SAML configuration can be stored encrypted and remains in draft/pending-verification states until the actual identity provider and account-linking flow are verified.

## Required Edge Function secrets

Before registering webhooks or SSO providers, configure these Edge Function secrets. Generate them locally; never commit or paste them into GitHub issues or chat.

- `INTEGRATION_SECRET_ENCRYPTION_KEY`: base64-encoded 32 random bytes. Used for AES-256-GCM encryption of webhook and IdP configuration secrets.
- `INTEGRATION_WEBHOOK_WORKER_SECRET`: a separate high-entropy random value used to authenticate the scheduled delivery worker.
- `INTEGRATION_WEBHOOK_ALLOWED_HOSTS`: comma-separated exact DNS hostnames permitted for outbound webhook delivery (no wildcards). The worker fails closed when this is unset and rejects destinations outside this list.

The worker also uses Supabase's built-in `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` environment values internally. These are never exposed to the browser.

Webhook receivers get `x-sims-event`, `x-sims-delivery` and `x-sims-signature: sha256=<hex>` headers. Verify the HMAC-SHA256 signature against the exact raw request body with the one-time signing secret before processing the event. Supported event names are `application.submitted`, `application.status_changed`, `placement.created`, `placement.status_changed`, `placement.completed`, `daily_report.submitted`, `daily_report.reviewed`, `weekly_report.submitted`, `weekly_report.reviewed` and `evaluation.completed`.

Example generation commands:

```bash
openssl rand -base64 32
openssl rand -hex 32
```

Configure the outbound host allowlist only for trusted webhook receiver hostnames. This is defense-in-depth and is not a complete DNS-rebinding mitigation: production must also enforce egress restrictions against private/reserved IPs and DNS rebinding at connection time. Until this egress control is verified, webhook delivery is not production-approved.

Set the resulting values with the Supabase CLI after the backup gate:

```bash
supabase secrets set INTEGRATION_SECRET_ENCRYPTION_KEY=<base64-value> INTEGRATION_WEBHOOK_WORKER_SECRET=<random-value> --project-ref <project-ref>
```

## Scheduled webhook delivery

The webhook worker is intentionally configured with `verify_jwt = false`; it rejects requests unless the separate `x-sims-worker-secret` header matches the server-side secret. The platform administrator can also request a manual queue-processing run from the Integration Centre.

For automatic delivery, enable `pg_cron`, `pg_net` and Supabase Vault, then store the project URL, publishable key and worker secret in Vault. Schedule a one-minute job using the following pattern, replacing the secret names with the names stored in Vault:

```sql
select cron.schedule(
  'sims-webhook-delivery-worker',
  '* * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'sims_project_url')
      || '/functions/v1/integration-webhook-worker',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'sims_publishable_key'),
      'x-sims-worker-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'sims_webhook_worker_secret')
    ),
    body := '{"limit":10}'::jsonb,
    timeout_milliseconds := 15000
  );
  $$
);
```

Check the Supabase Cron job history and `net._http_response` after enabling the schedule. Do not create the schedule until the Edge Function secrets and deployed worker are present.

## SSO release boundary

The branch adds encrypted per-tenant OIDC/SAML configuration storage and an administrative workflow. It does **not** activate a sign-in protocol by itself. The connected SIMS Supabase project is currently on the Free plan; Supabase's SAML 2.0 Auth support requires Pro or above. An upgrade is therefore a hard prerequisite for SAML sign-in. Actual SSO activation still requires:

1. A real IdP issuer, metadata, client ID and provider secret/certificate from the organisation.
2. Verified email-domain ownership and a tested account-to-tenant mapping.
3. A configured Supabase Auth SSO provider, its provider UUID saved against the tenant connection, and callback URLs supported by the project's Auth plan.
4. Successful tests for new users, existing-user linking, wrong-tenant rejection, disabled provider rejection and sign-out/session expiry.

Supabase SAML SSO does not link a new SSO identity to an existing password account, so do not automatically link accounts by email. Use the Auth provider UUID as the tenant boundary. Until these checks pass, configurations must remain draft or pending verification. Do not advertise SSO as live merely because provider settings were saved.

## Public embed security

The embed endpoint accepts only an unguessable per-embed token and returns only published opportunities visible to the connected tenant. The response applies a Content Security Policy with the configured `frame-ancestors` allowlist. Use HTTPS origins only. Suspend the embed immediately if its token is exposed outside the approved integration.

## Production release sequence

1. Create and verify the database backup and separate Storage backup.
2. Review the migration and run the full local Supabase rebuild and pgTAP suite.
3. Configure the two Edge Function secrets.
4. Deploy the updated `integration-admin`, `integration-api`, `integration-webhook-worker` and `integration-embed` functions.
5. Apply the migration and verify the new tables, triggers and service-role-only access.
6. Create the Vault entries and scheduled worker job.
7. Run end-to-end tests with dedicated test tenants and webhook receiver endpoints.
8. Test the Integration Centre using a platform-admin account and test analytics using real coordinator/company accounts.

No production schema, function or deployment change is authorized by this branch alone.


## Security verification boundaries and outstanding tests

The CI run on the Phase Two PR validates a local full migration rebuild, pgTAP, seeded Storage API checks, coordinator/company analytics API isolation smoke checks, web app type-check/build, and Edge Function type-check. It does not constitute a live external-provider or production security test.

Before treating integrations as production-ready, complete these separate checks:

- **Webhook SSRF / network controls:** the exact hostname allowlist and DNS public-address checks are defense-in-depth, not DNS pinning. DNS may change between resolution and connection. Configure and verify connection-time outbound egress controls that block loopback, private, link-local, reserved and metadata-service destinations, including IPv4/IPv6 and DNS-rebinding cases. Until this is proven, keep delivery disabled for production.
- **Webhook regression tests:** the new CI unit tests exercise conservative IPv4/IPv6 public-address screening. Still add automated tests for hostname allowlist enforcement, redirect rejection, DNS resolution of mixed public/private answers, malformed URLs, signature verification by receiver, retries, terminal failure, worker authorization and concurrent claiming. Existing database tests cover queue capture/claim and payload minimization, not a full HTTP worker attack suite.
- **Embed tests:** test token invalidation/suspension, connection suspension, tenant isolation, visibility rules, malformed/absent Origin behavior, CSP frame-ancestor behavior in browsers, response escaping, and query limits against seeded tenants.
- **API tests:** CI now checks the rate-limit table and RPC permissions, two requests allowed and the third denied in a synthetic fixed window. Still test invalid/revoked/expired credentials, scope denial, unknown routes, malformed query values, pagination limits, tenant-bound application/placement access, inactive tenant/connection, audit logging on success and denial, and throttling under abusive request patterns. Per-key throttling is not an infrastructure/IP-level control and does not address invalid-key brute force.
- **SSO:** no live IdP flow has been verified; configuration storage alone is not sign-in. Verify provider/domain/account linking, wrong-tenant rejection, disabled provider, callback and session expiry before activation.
- **Release operations:** verify backups and restore, deployed function version parity, secret rotation and secure cron/Vault scheduling, monitoring/alerting and incident response.

These are release gates, not claims that the branch has already completed them.
