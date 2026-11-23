import { createClient } from 'npm:@supabase/supabase-js@2';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface ManageBody {
  action?: 'delete_user' | 'delete_tenant' | 'restore_entity';
  id?: string;
  kind?: 'user' | 'university' | 'company';
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ error: 'Function is not configured' }, 500);
  }

  const authorization = req.headers.get('Authorization');
  if (!authorization) return json({ error: 'Missing authorization header' }, 401);

  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
  });

  // The service-role client is created before it is used to validate the session.
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Verify the bearer token inside the function. The gateway JWT check is disabled
  // for this deployment so asymmetric project signing keys are handled consistently;
  // no request proceeds unless Supabase Auth validates the token below.
  const bearerToken = authorization.replace(/^Bearer\s+/i, '').trim();
  if (!bearerToken) return json({ error: 'Invalid authorization header' }, 401);
  const { data: userData, error: userError } = await admin.auth.getUser(bearerToken);
  if (userError || !userData.user) return json({ error: 'Invalid or expired session' }, 401);

  const { data: caller, error: profileError } = await admin
    .from('profiles')
    .select('id, role, account_status, deleted_at')
    .eq('id', userData.user.id)
    .single();

  if (profileError || !caller) return json({ error: 'Profile not found' }, 403);
<<<<<<< HEAD
=======
  if (caller.account_status !== 'active' || caller.deleted_at) return json({ error: 'Your account is not active' }, 403);
>>>>>>> 531fd9bebf7bc36fd1285eab65e77096e28c7670
  if (caller.role !== 'platform_admin') {
    return json({ error: 'Only a general administrator can manage accounts' }, 403);
  }

  let body: ManageBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  if (body.action === 'delete_user') {
    const id = body.id?.trim();
    if (!id) return json({ error: 'A user id is required' }, 400);
    if (id === caller.id) return json({ error: 'You cannot archive your own account' }, 400);

    const { data: target, error: targetError } = await admin
      .from('profiles')
      .select('id, role, deleted_at')
      .eq('id', id)
      .maybeSingle();

    if (targetError || !target) return json({ error: 'User not found' }, 404);
    if (target.role === 'platform_admin') {
      return json({ error: 'Manage administrator accounts from General admins' }, 400);
    }
    if (target.deleted_at) return json({ error: 'User is already archived' }, 409);

    const { error: archiveError } = await callerClient.rpc('archive_user', { p_id: id });
    if (archiveError) {
      return json({ error: archiveError.message || 'Could not archive the user' }, 500);
    }

    const { error: banError } = await admin.auth.admin.updateUserById(id, {
      ban_duration: '876000h',
    });
    if (banError) {
      // The profile remains safely archived. Surface the access-control failure
      // so an administrator knows the account may still have an active session.
      return json({ error: 'User archived, but sign-in blocking failed. Contact support.' }, 500);
    }
    return json({ id, archived: true });
  }

  if (body.action === 'delete_tenant') {
    const id = body.id?.trim();
    const kind = body.kind;
    if (!id || (kind !== 'university' && kind !== 'company')) {
      return json({ error: 'A tenant id and kind are required' }, 400);
    }

    const { error } = await callerClient.rpc('delete_tenant', { p_kind: kind, p_id: id });
    if (error) {
      const notFound = error.message?.toLowerCase().includes('not found');
      return json(
        { error: notFound ? 'That tenant no longer exists or is already archived' : 'Could not archive the tenant' },
        notFound ? 404 : 500,
      );
    }
    return json({ id, archived: true });
  }

  if (body.action === 'restore_entity') {
    const id = body.id?.trim();
    const kind = body.kind;
    if (!id || !kind || !['user', 'university', 'company'].includes(kind)) {
      return json({ error: 'An archive id and valid entity type are required' }, 400);
    }

    const { error } = await callerClient.rpc('restore_deleted_entity', {
      p_kind: kind,
      p_id: id,
    });
    if (error) {
      const notFound = error.message?.toLowerCase().includes('not found');
      return json(
        { error: notFound ? 'Archived record not found' : 'Could not restore the record' },
        notFound ? 404 : 500,
      );
    }

    if (kind === 'user') {
      const { error: unbanError } = await admin.auth.admin.updateUserById(id, {
        ban_duration: 'none',
      });
      if (unbanError) {
        return json({ error: 'Record restored, but sign-in access could not be re-enabled.' }, 500);
      }
    }
    return json({ id, restored: true });
  }

  return json({ error: 'Unknown action' }, 400);
});
