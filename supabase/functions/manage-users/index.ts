import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

interface ManageBody {
  action?: 'delete_user' | 'delete_tenant';
  id?: string;
  kind?: 'university' | 'company';
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Privileged moderation for general administrators: hard-delete a user account or
// an entire tenant. Status changes (approve/suspend/block) go through the
// set_user_status RPC instead. The caller is verified here and every database
// operation re-checks is_platform_admin() inside SECURITY DEFINER functions.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ error: 'Function is not configured' }, 500);
  }

  const authorization = req.headers.get('Authorization');
  if (!authorization) {
    return json({ error: 'Missing authorization header' }, 401);
  }

  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
  });

  const { data: userData, error: userError } = await callerClient.auth.getUser();
  if (userError || !userData.user) {
    return json({ error: 'Invalid session' }, 401);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: caller, error: profileError } = await admin
    .from('profiles')
    .select('id, role')
    .eq('id', userData.user.id)
    .single();

  if (profileError || !caller) {
    return json({ error: 'Profile not found' }, 403);
  }
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
    if (!id) {
      return json({ error: 'A user id is required' }, 400);
    }
    if (id === caller.id) {
      return json({ error: 'You cannot delete your own account' }, 400);
    }

    const { data: target, error: targetError } = await admin
      .from('profiles')
      .select('id, role')
      .eq('id', id)
      .single();
    if (targetError || !target) {
      return json({ error: 'User not found' }, 404);
    }
    if (target.role === 'platform_admin') {
      return json({ error: 'Manage administrator accounts from General admins' }, 400);
    }

    // placements.site_supervisor_id is the only RESTRICT reference to a profile;
    // remove those placements (cascading their logs/evaluations) before the account
    // so auth.admin.deleteUser can cascade the rest of the user's data cleanly.
    const { error: placementError } = await admin
      .from('placements')
      .delete()
      .eq('site_supervisor_id', id);
    if (placementError) {
      return json({ error: 'Could not delete the account' }, 500);
    }

    const { error: deleteError } = await admin.auth.admin.deleteUser(id);
    if (deleteError) {
      return json({ error: 'Could not delete the account' }, 500);
    }
    return json({ id });
  }

  if (body.action === 'delete_tenant') {
    const id = body.id?.trim();
    const kind = body.kind;
    if (!id || (kind !== 'university' && kind !== 'company')) {
      return json({ error: 'A tenant id and kind are required' }, 400);
    }

    // Run as the caller so auth.uid() resolves inside the SECURITY DEFINER RPC,
    // which re-checks is_platform_admin() and deletes everything in one transaction.
    const { error } = await callerClient.rpc('delete_tenant', { p_kind: kind, p_id: id });
    if (error) {
      const notFound = error.message?.toLowerCase().includes('not found');
      return json(
        { error: notFound ? 'That tenant no longer exists' : 'Could not delete the tenant' },
        notFound ? 404 : 500,
      );
    }
    return json({ id });
  }

  return json({ error: 'Unknown action' }, 400);
});