import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}
async function sha256(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'GET') return json({ error: 'Only GET requests are supported in this API release' }, 405);
  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) return json({ error: 'Integration API is not configured' }, 500);
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!token.startsWith('sims_live_')) return json({ error: 'A valid SIMS integration API key is required' }, 401);

  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const hash = await sha256(token);
  const { data: key, error: keyError } = await admin.from('integration_api_keys')
    .select('id,integration_id,scopes,expires_at,revoked_at').eq('key_hash', hash).maybeSingle();
  if (keyError || !key || key.revoked_at || (key.expires_at && new Date(key.expires_at).getTime() <= Date.now())) {
    return json({ error: 'Invalid, expired or revoked API key' }, 401);
  }
  const { data: connection } = await admin.from('integration_connections')
    .select('id,name,organization_type,university_id,company_id,status')
    .eq('id', key.integration_id).maybeSingle();
  if (!connection || connection.status !== 'active') return json({ error: 'Integration connection is suspended' }, 403);

  const isUniversity = connection.organization_type === 'university';
  const tenantId = isUniversity ? connection.university_id : connection.company_id;
  if (!tenantId) return json({ error: 'Integration tenant configuration is invalid' }, 403);
  const tenantTable = isUniversity ? 'universities' : 'companies';
  const { data: tenant } = await admin.from(tenantTable).select('id,name,status')
    .eq('id', tenantId).maybeSingle();
  if (!tenant || tenant.status !== 'active') return json({ error: 'Organisation is not active' }, 403);

  await admin.from('integration_api_keys').update({ last_used_at: new Date().toISOString() }).eq('id', key.id);

  const path = new URL(req.url).pathname.replace(/^\/functions\/v1\/integration-api/, '').replace(/\/$/, '') || '/';
  const scopeByPath: Record<string, string> = {
    '/v1/organisation': 'organisation:read',
    '/v1/opportunities': 'opportunities:read',
    '/v1/applications': 'applications:read',
    '/v1/placements': 'placements:read',
  };
  const requiredScope = scopeByPath[path];
  if (!requiredScope) return json({ error: 'Endpoint not found' }, 404);
  if (!key.scopes.includes(requiredScope)) return json({ error: 'API key does not have the required permission scope' }, 403);

  if (path === '/v1/organisation') {
    return json({ data: { id: tenant.id, name: tenant.name, type: connection.organization_type, connection: connection.name } });
  }

  const limitParam = Number(new URL(req.url).searchParams.get('limit') ?? '50');
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(Math.floor(limitParam), 1), 100) : 50;
  if (path === '/v1/opportunities') {
    let query = admin.from('job_postings')
      .select('id,title,type,description,requirements,location,is_remote,duration_months,stipend,deadline,status,created_at')
      .eq('status', 'published').order('created_at', { ascending: false }).limit(limit);
    if (!isUniversity) query = query.eq('company_id', tenantId);
    const { data, error } = await query;
    if (error) return json({ error: 'Could not load opportunities' }, 500);
    return json({ data: data ?? [], pagination: { limit, returned: data?.length ?? 0 } });
  }
  if (path === '/v1/applications') {
    let query = admin.from('applications')
      .select('id,posting_id,status,reviewed_at,created_at,updated_at')
      .order('created_at', { ascending: false }).limit(limit);
    query = isUniversity ? query.eq('university_id', tenantId) : query.eq('company_id', tenantId);
    const { data, error } = await query;
    if (error) return json({ error: 'Could not load applications' }, 500);
    return json({ data: data ?? [], pagination: { limit, returned: data?.length ?? 0 } });
  }
  let query = admin.from('placements')
    .select('id,application_id,posting_id,status,start_date,end_date,final_grade,graded_at,created_at,updated_at')
    .order('created_at', { ascending: false }).limit(limit);
  query = isUniversity ? query.eq('university_id', tenantId) : query.eq('company_id', tenantId);
  const { data, error } = await query;
  if (error) return json({ error: 'Could not load placements' }, 500);
  return json({ data: data ?? [], pagination: { limit, returned: data?.length ?? 0 } });
});
