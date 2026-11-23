export async function writeIntegrationAudit(client: any, record: Record<string, unknown>) {
  try {
    const { error } = await client.from('audit_logs').insert(record);
    if (error) return { ok: false, code: typeof error.code === 'string' ? error.code : undefined };
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
