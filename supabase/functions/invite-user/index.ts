import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

type Role = 'faculty_supervisor' | 'coordinator' | 'site_supervisor' | 'company_admin';
interface InviteBody { email?: string; full_name?: string; role?: Role; university_id?: string; company_id?: string; }

const ALLOWED_BY_CALLER: Record<string, Role[]> = {
  platform_admin: ['coordinator', 'company_admin'],
  coordinator: ['faculty_supervisor'],
  company_admin: ['site_supervisor'],
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceRoleKey) return json({ error: 'Function is not configured' }, 500);

  const authorization = req.headers.get('Authorization');
  if (!authorization) return json({ error: 'Missing authorization header' }, 401);
  const callerClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } });
  const { data: userData, error: userError } = await callerClient.auth.getUser();
  if (userError || !userData.user) return json({ error: 'Invalid session' }, 401);

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: caller, error: profileError } = await admin.from('profiles')
    .select('id, role, university_id, company_id, account_status, deleted_at').eq('id', userData.user.id).single();
  if (profileError || !caller) return json({ error: 'Profile not found' }, 403);

  let body: InviteBody;
  try { body = await req.json(); } catch { return json({ error: 'Invalid JSON body' }, 400); }
  const email = body.email?.trim().toLowerCase();
  const fullName = body.full_name?.trim();
  const role = body.role;
  if (!email || !fullName || !role) return json({ error: 'Email, full name, and role are required' }, 400);
  if (caller.account_status !== 'active' || caller.deleted_at) return json({ error: 'Your account is not active' }, 403);
  if (!(ALLOWED_BY_CALLER[caller.role] ?? []).includes(role)) return json({ error: 'You are not allowed to invite this role' }, 403);

  let universityId: string | null = null;
  let companyId: string | null = null;
  if (role === 'coordinator' || role === 'faculty_supervisor') {
    universityId = body.university_id ?? caller.university_id ?? null;
    if (!universityId) return json({ error: 'A university is required for this role' }, 400);
    if (caller.role === 'coordinator' && universityId !== caller.university_id) return json({ error: 'You can only invite staff to your own university' }, 403);
    const { data: university } = await admin.from('universities').select('id, status').eq('id', universityId).maybeSingle();
    if (!university || university.status !== 'active') return json({ error: 'University not found or suspended' }, 400);
  }

  if (role === 'company_admin' || role === 'site_supervisor') {
    companyId = body.company_id ?? caller.company_id ?? null;
    if (!companyId) return json({ error: 'A company is required for this role' }, 400);
    if (caller.role === 'company_admin' && companyId !== caller.company_id) return json({ error: 'You can only invite staff to your own company' }, 403);
    const { data: company } = await admin.from('companies').select('id, status').eq('id', companyId).maybeSingle();
    if (!company || company.status !== 'active') return json({ error: 'Company not found or suspended' }, 400);
  }

  // The auth.users trigger consumes this one-time ticket to create the scoped profile.
  // Upsert also replaces a leftover ticket when a previous Auth attempt failed.
  const { error: ticketError } = await admin.from('provision_tickets').upsert({
    email, role, university_id: universityId, company_id: companyId,
  }, { onConflict: 'email' });
  if (ticketError) {
    console.error('Provision ticket upsert failed', ticketError);
    return json({ error: 'Could not prepare account provisioning' }, 500);
  }

  const temporaryPassword = `${crypto.randomUUID().slice(0, 8)}Aa1!`;
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email, password: temporaryPassword, email_confirm: true,
    app_metadata: { sims_provisioned: true, role, university_id: universityId ?? undefined, company_id: companyId ?? undefined },
    user_metadata: { full_name: fullName },
  });

  if (createError || !created.user) {
    console.error('Auth user creation failed', createError);
    return json({
      error: createError?.message?.toLowerCase().includes('already')
        ? 'An account with this email already exists'
        : 'Could not create the account',
    }, 409);
  }
  return json({ id: created.user.id, email, temporary_password: temporaryPassword });
});
