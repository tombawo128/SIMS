import { createClient } from 'npm:@supabase/supabase-js@2';
import { isPublicIpv4, isPublicIpv6 } from '../_shared/webhook-ip.ts';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
  return Uint8Array.from(atob(padded), char => char.charCodeAt(0));
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer { const copy = new Uint8Array(bytes.byteLength); copy.set(bytes); return copy.buffer; }

async function decryptSecret(ciphertext: string, encodedKey: string) {
  const [ivPart, dataPart] = ciphertext.split('.');
  if (!ivPart || !dataPart) throw new Error('Stored webhook secret has an invalid format');
  const rawKey = Uint8Array.from(atob(encodedKey), char => char.charCodeAt(0));
  if (rawKey.length !== 32) throw new Error('Integration encryption key must decode to 32 bytes');
  const key = await crypto.subtle.importKey('raw', toArrayBuffer(rawKey), 'AES-GCM', false, ['decrypt']);
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: toArrayBuffer(decodeBase64Url(ivPart)) },
    key,
    toArrayBuffer(decodeBase64Url(dataPart)),
  );
  return new TextDecoder().decode(plaintext);
}

function hex(bytes: Uint8Array) {
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

async function signPayload(secret: string, payload: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    toArrayBuffer(new TextEncoder().encode(secret)),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, toArrayBuffer(new TextEncoder().encode(payload)));
  return `sha256=${hex(new Uint8Array(signature))}`;
}

async function assertSafeTarget(value: string, allowedHosts: Set<string>) {
  const url = new URL(value);
  const host = url.hostname.toLowerCase();
  if (!allowedHosts.has(host)) throw new Error('Webhook host is not included in the worker outbound host allowlist');
  if (url.protocol !== 'https:' || (url.port && url.port !== '443')
    || url.username || url.password || !host.includes('.')
    || host === 'localhost' || host.endsWith('.localhost')
    || host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.test')
    || /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.startsWith('[')) {
    throw new Error('Webhook target is not an allowed public HTTPS host');
  }
  const ipv4 = await Deno.resolveDns(host, 'A').catch(() => [] as string[]);
  const ipv6 = await Deno.resolveDns(host, 'AAAA').catch(() => [] as string[]);
  if ((!ipv4.length && !ipv6.length)
    || ipv4.some(address => !isPublicIpv4(address))
    || ipv6.some(address => !isPublicIpv6(address))) {
    throw new Error('Webhook target resolves to a private or reserved address');
  }
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let result = 0;
  for (let index = 0; index < left.length; index += 1) {
    result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return result === 0;
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const expectedSecret = Deno.env.get('INTEGRATION_WEBHOOK_WORKER_SECRET');
  const encryptionKey = Deno.env.get('INTEGRATION_SECRET_ENCRYPTION_KEY');
  const suppliedSecret = req.headers.get('x-sims-worker-secret') ?? '';
  if (!expectedSecret || !constantTimeEqual(suppliedSecret, expectedSecret)) {
    return json({ error: 'Unauthorized' }, 401);
  }
  if (!encryptionKey) return json({ error: 'Webhook encryption is not configured' }, 503);
  const configuredHosts = Deno.env.get('INTEGRATION_WEBHOOK_ALLOWED_HOSTS') ?? '';
  const allowedHosts = new Set(configuredHosts.split(',').map(host => host.trim().toLowerCase()).filter(Boolean));
  if (allowedHosts.size === 0) return json({ error: 'Webhook outbound host allowlist is not configured' }, 503);

  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) return json({ error: 'Webhook worker is not configured' }, 500);
  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  const body = await req.json().catch(() => ({})) as { limit?: number };
  const limit = Number.isFinite(body.limit) ? Math.max(1, Math.min(25, Math.floor(body.limit!))) : 10;
  const { data: deliveries, error } = await admin.rpc('claim_integration_webhook_deliveries', { p_limit: limit });
  if (error) return json({ error: 'Could not claim webhook deliveries' }, 500);

  let delivered = 0;
  let retrying = 0;
  let failed = 0;
  for (const delivery of deliveries ?? []) {
    let statusCode: number | null = null;
    let errorMessage: string | null = null;
    try {
      await assertSafeTarget(delivery.endpoint_url, allowedHosts);
      const secret = await decryptSecret(delivery.secret_ciphertext, encryptionKey);
      const payload = JSON.stringify({
        id: delivery.id,
        event: delivery.event_type,
        data: delivery.payload,
        sent_at: new Date().toISOString(),
      });
      const signature = await signPayload(secret, payload);
      const response = await fetch(delivery.endpoint_url, {
        method: 'POST',
        redirect: 'manual',
        signal: AbortSignal.timeout(10000),
        headers: {
          'content-type': 'application/json',
          'user-agent': 'SIMS-Webhooks/1.0',
          'x-sims-event': delivery.event_type,
          'x-sims-delivery': delivery.id,
          'x-sims-signature': signature,
        },
        body: payload,
      });
      statusCode = response.status;
      await response.body?.cancel().catch(() => undefined);
      if (!response.ok) throw new Error(`Webhook endpoint returned HTTP ${response.status}`);
    } catch (error) {
      errorMessage = error instanceof Error ? error.message.slice(0, 1000) : 'Webhook delivery failed';
    }

    if (!errorMessage) {
      const { error: updateError } = await admin.from('integration_webhook_deliveries')
        .update({ status: 'delivered', delivered_at: new Date().toISOString(), last_status_code: statusCode, last_error: null })
        .eq('id', delivery.id);
      if (updateError) {
        console.error('Could not mark webhook delivery as delivered', delivery.id, updateError.message);
        retrying += 1;
      } else delivered += 1;
      continue;
    }

    const terminal = delivery.attempts >= 8;
    const delaySeconds = Math.min(3600, 15 * (2 ** Math.max(0, delivery.attempts - 1)));
    const { error: updateError } = await admin.from('integration_webhook_deliveries')
      .update({
        status: terminal ? 'failed' : 'pending',
        next_attempt_at: new Date(Date.now() + delaySeconds * 1000).toISOString(),
        last_status_code: statusCode,
        last_error: errorMessage,
      })
      .eq('id', delivery.id);
    if (updateError) {
      console.error('Could not update failed webhook delivery', delivery.id, updateError.message);
      retrying += 1;
    } else if (terminal) failed += 1;
    else retrying += 1;
  }

  return json({ processed: (deliveries ?? []).length, delivered, retrying, failed });
});
