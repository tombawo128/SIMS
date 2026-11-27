// Protect webhook delivery updates from stale workers whose claim lease was reclaimed.
// A claim increments attempts; status + attempts together identify the current lease.
export async function updateClaimedWebhookDelivery(
  client: any,
  deliveryId: string,
  attempts: number,
  patch: Record<string, unknown>,
) {
  try {
    const { data, error } = await client.from('integration_webhook_deliveries')
      .update(patch)
      .eq('id', deliveryId)
      .eq('status', 'processing')
      .eq('attempts', attempts)
      .select('id')
      .maybeSingle();
    if (error) return { ok: false, reason: 'database_error' as const, code: error.code };
    if (!data) return { ok: false, reason: 'claim_lost' as const };
    return { ok: true as const };
  } catch (error) {
    return { ok: false, reason: 'database_error' as const, code: error instanceof Error ? error.message : undefined };
  }
}
