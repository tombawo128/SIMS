import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

// Keep in sync with MAX_PLATFORM_ADMINS in @sims/shared.
const MAX_PLATFORM_ADMINS = 2;

interface ManageBody {
  action?: 'create' | 'delete';
  email?: string;
  full_name?: string;
  id?: string;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

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
    return json({ error: 'Only a general administrator can manage administrator accounts' }, 403);
  }

  let body: ManageBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const countAdmins = async () => {
    const { count, error } = await admin
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'platform_admin');
    if (error) throw error;
    return count ?? 0;
  };

  if (body.action === 'create') {
    const email = body.email?.trim().toLowerCase();
    const fullName = body.full_name?.trim();
    if (!email || !fullName) {
      return json({ error: 'Email and full name are required' }, 400);
    }

    let current: number;
    try {
      current = await countAdmins();
    } catch {
      return json({ error: 'Could not verify the administrator limit' }, 500);
    }
    if (current >= MAX_PLATFORM_ADMINS) {
      return json(
        { error: `Maximum of ${MAX_PLATFORM_ADMINS} general administrators reached. Delete one to add another.` },
        409,
      );
    }

    const temporaryPassword = `${crypto.randomUUID().slice(0, 8)}Aa1!`;
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password: temporaryPassword,
      email_confirm: true,
      app_metadata: {
        sims_provisioned: true,
        role: 'platform_admin',
      },
      user_metadata: {
        full_name: fullName,
      },
    });

    if (createError || !created.user) {
      const message = createError?.message?.toLowerCase().includes('already')
        ? 'An account with this email already exists'
        : 'Could not create the account';
      return json({ error: message }, 409);
    }

    return json({
      id: created.user.id,
      email,
      temporary_password: temporaryPassword,
    });
  }

  if (body.action === 'delete') {
    const id = body.id?.trim();
    if (!id) {
      return json({ error: 'An administrator id is required' }, 400);
    }
    if (id === caller.id) {
      return json({ error: 'You cannot delete your own administrator account' }, 400);
    }

    const { data: target, error: targetError } = await admin
      .from('profiles')
      .select('id, role')
      .eq('id', id)
      .single();

    if (targetError || !target) {
      return json({ error: 'Administrator not found' }, 404);
    }
    if (target.role !== 'platform_admin') {
      return json({ error: 'That account is not a general administrator' }, 400);
    }

    const { error: deleteError } = await admin.auth.admin.deleteUser(id);
    if (deleteError) {
      return json({ error: 'Could not delete the account' }, 500);
    }
    return json({ id });
  }

  return json({ error: 'Unknown action' }, 400);
});