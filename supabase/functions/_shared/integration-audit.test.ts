import { writeIntegrationAudit } from './integration-audit.ts';

Deno.test('integration audit helper returns success for a successful insert', async () => {
  const client = {
    from: (table: string) => {
      if (table !== 'audit_logs') throw new Error('unexpected table');
      return { insert: async (_record: Record<string, unknown>) => ({ error: null }) };
    },
  };
  const result = await writeIntegrationAudit(client, { actor_id: 'test', action: 'test' });
  if (!result.ok) throw new Error('Expected audit insert to succeed');
});

Deno.test('integration audit helper surfaces database insert errors', async () => {
  const client = {
    from: (table: string) => {
      if (table !== 'audit_logs') throw new Error('unexpected table');
      return { insert: async (_record: Record<string, unknown>) => ({ error: { code: 'XX001' } }) };
    },
  };
  const result = await writeIntegrationAudit(client, { actor_id: 'test', action: 'test' });
  if (result.ok || result.code !== 'XX001') throw new Error('Expected audit insert error to be surfaced');
});

Deno.test('integration audit helper handles thrown insert failures', async () => {
  const client = { from: (_table: string) => ({ insert: async (_record: Record<string, unknown>) => { throw new Error('failed'); } }) };
  const result = await writeIntegrationAudit(client, { actor_id: 'test', action: 'test' });
  if (result.ok) throw new Error('Expected thrown audit insert failure to be reported');
});
