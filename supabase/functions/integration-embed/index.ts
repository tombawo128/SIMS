import { createClient } from 'npm:@supabase/supabase-js@2';
import { buildEmbedContentSecurityPolicy, isEmbedRequestOriginAllowed, isPostingVisibleToEmbed, normalizeAllowedEmbedOrigins } from '../_shared/embed-security.ts';

function escapeHtml(value: unknown) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character] ?? character);
}

function html(body: string, status: number, frameOrigins: string[] = []) {
  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Security-Policy': buildEmbedContentSecurityPolicy(frameOrigins),
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Cache-Control': 'no-store',
    },
  });
}

function page(title: string, rows: Array<Record<string, unknown>>, options: Record<string, boolean>) {
  const cards = rows.map(row => {
    const company = options.show_company ? `<span class="meta">${escapeHtml(row.company_name)}</span>` : '';
    const location = options.show_location ? `<span class="meta">${escapeHtml(row.location || (row.is_remote ? 'Remote' : 'Location not specified'))}</span>` : '';
    const deadline = options.show_deadline && row.deadline
      ? `<span class="meta">Apply by ${escapeHtml(new Date(String(row.deadline)).toLocaleDateString())}</span>`
      : '';
    return `<article><h2>${escapeHtml(row.title)}</h2><div class="meta-row">${company}${location}${deadline}</div><p>${escapeHtml(row.description)}</p></article>`;
  }).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>
    *{box-sizing:border-box}body{margin:0;padding:20px;font:14px/1.5 Inter,system-ui,sans-serif;color:#1f2937;background:#f8fafc}
    header{margin-bottom:18px}h1{font-size:20px;line-height:1.25;margin:0;color:#18352a}article{padding:16px;margin:0 0 12px;background:#fff;border:1px solid #e5e7eb;border-radius:12px}
    h2{font-size:16px;margin:0 0 8px;color:#1f2937}.meta-row{display:flex;flex-wrap:wrap;gap:6px 12px}.meta{font-size:12px;color:#64748b}p{margin:10px 0 0;color:#475569;white-space:pre-wrap}
    .empty{padding:24px;border:1px dashed #cbd5e1;border-radius:12px;background:#fff;color:#64748b;text-align:center}
  </style></head><body><header><h1>${escapeHtml(title)}</h1></header>${cards || '<div class="empty">There are no published opportunities to display right now.</div>'}</body></html>`;
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'GET') return html('Method not allowed', 405);
  const token = new URL(req.url).searchParams.get('token') ?? '';
  if (!/^[A-Za-z0-9_-]{40,80}$/.test(token)) return html('Embed not found', 404);

  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) return html('Embed service is not configured', 503);
  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: embed, error: embedError } = await admin.from('integration_embeds')
    .select('id,integration_id,title,allowed_origins,display_options,status')
    .eq('public_token', token).maybeSingle();
  if (embedError || !embed || embed.status !== 'active') return html('Embed not found', 404);

  const { data: connection, error: connectionError } = await admin.from('integration_connections')
    .select('id,organization_type,university_id,company_id,status')
    .eq('id', embed.integration_id).maybeSingle();
  if (connectionError || !connection || connection.status !== 'active') return html('Embed unavailable', 404);

  const allowedOrigins = normalizeAllowedEmbedOrigins(embed.allowed_origins);
  const requestOrigin = req.headers.get('origin');
  if (!isEmbedRequestOriginAllowed(requestOrigin, allowedOrigins)) return html('Origin not allowed', 403);
  const tenantId = connection.organization_type === 'university' ? connection.university_id : connection.company_id;
  if (!tenantId) return html('Embed tenant is invalid', 403);

  const fields = 'id,title,description,location,is_remote,deadline,created_at,status,company_id,visibility,company:companies(name)';
  let rows: Array<Record<string, unknown>> = [];
  if (connection.organization_type === 'company') {
    const { data, error } = await admin.from('job_postings').select(fields)
      .eq('company_id', tenantId).eq('status', 'published')
      .order('created_at', { ascending: false }).limit(25);
    if (error) return html('Opportunities could not be loaded', 503, allowedOrigins);
    rows = (data ?? []).filter(item => isPostingVisibleToEmbed(item, 'company', tenantId)).map(item => ({
      ...item,
      company_name: (item.company as { name?: string } | null)?.name ?? '',
    }));
  } else {
    const [{ data: publicPosts, error: publicError }, { data: mappings, error: mappingError }] = await Promise.all([
      admin.from('job_postings').select(fields).eq('status', 'published')
        .eq('visibility', 'all_universities').order('created_at', { ascending: false }).limit(25),
      admin.from('posting_universities').select('posting_id').eq('university_id', tenantId),
    ]);
    if (publicError || mappingError) return html('Opportunities could not be loaded', 503, allowedOrigins);
    const selectedIds = new Set((mappings ?? []).map(item => item.posting_id));
    let selectedPosts: typeof publicPosts = [];
    if (selectedIds.size) {
      const { data, error } = await admin.from('job_postings').select(fields)
        .in('id', [...selectedIds]).eq('status', 'published').eq('visibility', 'selected_universities')
        .order('created_at', { ascending: false }).limit(25);
      if (error) return html('Opportunities could not be loaded', 503, allowedOrigins);
      selectedPosts = data ?? [];
    }
    rows = [...(publicPosts ?? []), ...selectedPosts]
      .filter(item => isPostingVisibleToEmbed(item, 'university', tenantId, selectedIds))
      .sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 25)
      .map(item => ({
        ...item,
        company_name: (item.company as { name?: string } | null)?.name ?? '',
      }));
  }

  return html(page(embed.title, rows, embed.display_options ?? {}), 200, allowedOrigins);
});
