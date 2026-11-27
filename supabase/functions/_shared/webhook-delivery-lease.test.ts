import { updateClaimedWebhookDelivery } from './webhook-delivery-lease.ts';

function fakeClient(result: { data: unknown; error: unknown }, filters: unknown[], patches: unknown[]) {
  return {
    from(table: string) {
      if (table !== 'integration_webhook_deliveries') throw new Error('unexpected table');
      return {
        update(patch: unknown) { patches.push(patch); return this; },
        eq(column: string, value: unknown) { filters.push([column, value]); return this; },
        select(columns: string) { if (columns !== 'id') throw new Error('unexpected select'); return this; },
        maybeSingle: async () => result,
      };
    },
  };
}

Deno.test('claimed delivery update uses status and attempt count as lease guards', async () => {
  const filters: unknown[] = [];
  const patches: unknown[] = [];
  const result = await updateClaimedWebhookDelivery(fakeClient({ data: { id: 'delivery-1' }, error: null }, filters, patches), 'delivery-1', 4, { status: 'delivered' });
  if (!result.ok) throw new Error('Expected guarded update to succeed');
  if (JSON.stringify(filters) !== JSON.stringify([['id', 'delivery-1'], ['status', 'processing'], ['attempts', 4]])) throw new Error('Lease guard filters were not applied');
  if (JSON.stringify(patches) !== JSON.stringify([{ status: 'delivered' }])) throw new Error('Unexpected update patch');
});

Deno.test('claimed delivery update reports lost lease when row no longer matches', async () => {
  const filters: unknown[] = [];
  const patches: unknown[] = [];
  const result = await updateClaimedWebhookDelivery(fakeClient({ data: null, error: null }, filters, patches), 'delivery-1', 4, { status: 'delivered' });
  if (result.ok || result.reason !== 'claim_lost') throw new Error('Expected reclaimed lease to be rejected');
});

Deno.test('claimed delivery update surfaces database errors', async () => {
  const filters: unknown[] = [];
  const patches: unknown[] = [];
  const result = await updateClaimedWebhookDelivery(fakeClient({ data: null, error: { code: 'XX001' } }, filters, patches), 'delivery-1', 4, { status: 'failed' });
  if (result.ok || result.reason !== 'database_error' || result.code !== 'XX001') throw new Error('Expected database error to be surfaced');
});
