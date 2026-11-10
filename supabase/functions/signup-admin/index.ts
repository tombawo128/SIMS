
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': 'http://localhost:5173',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      status: 200,
      headers: corsHeaders,
    });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse(
        { error: 'Server configuration is incomplete.' },
        500,
      );
    }

    const adminClient = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );

    const { email, password, full_name } = await req.json();

    if (
      typeof email !== 'string' ||
      typeof password !== 'string' ||
      typeof full_name !== 'string' ||
      !email.trim() ||
      !full_name.trim() ||
      password.length < 8
    ) {
      return jsonResponse(
        { error: 'Valid name, email and password are required.' },
        400,
      );
    }

    // Recheck the limit on the server before creating an administrator.
    const { data: available, error: availabilityError } =
      await adminClient.rpc('admin_signup_available');

    if (availabilityError) {
      return jsonResponse(
        { error: 'Could not verify administrator availability.' },
        500,
      );
    }

    if (!available) {
      return jsonResponse(
        { error: 'The maximum number of platform administrators has been reached.' },
        403,
      );
    }

    const { data, error } = await adminClient.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password,
      email_confirm: true,
      user_metadata: {
        full_name: full_name.trim(),
      },
    });

    if (error) {
      return jsonResponse({ error: error.message }, 400);
    }

    // The profile should be created by your existing database trigger.
    // Verify that it exists rather than creating a duplicate.
    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('id, role')
      .eq('id', data.user.id)
      .maybeSingle();

    if (profileError || !profile) {
      // Do not leave an Auth account without its expected profile.
      await adminClient.auth.admin.deleteUser(data.user.id);

      return jsonResponse(
        { error: 'Administrator profile could not be created.' },
        500,
      );
    }

    if (profile.role !== 'platform_admin') {
      await adminClient.auth.admin.deleteUser(data.user.id);

      return jsonResponse(
        { error: 'The profile was not assigned the platform administrator role.' },
        500,
      );
    }

    return jsonResponse({
      success: true,
      userId: data.user.id,
    });
  } catch (error) {
    console.error('signup-admin error:', error);

    return jsonResponse(
      { error: 'An unexpected error occurred during administrator registration.' },
      500,
    );
  }
});
