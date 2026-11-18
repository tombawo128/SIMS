const apiUrl = process.env.API_URL;
const anonKey = process.env.ANON_KEY;
if (!apiUrl || !anonKey) throw new Error('API_URL and ANON_KEY are required');

const tenants = [
  {
    label: 'university coordinator',
    email: 'coordinator@baystate.edu',
    password: 'Password123!',
    tenantField: 'university_id',
    tenantId: '11111111-1111-4111-8111-111111111101',
    statsRpc: 'university_stats',
  },
  {
    label: 'company administrator',
    email: 'admin@acme.com',
    password: 'Password123!',
    tenantField: 'company_id',
    tenantId: '22222222-2222-4222-8222-222222222201',
    statsRpc: 'company_stats',
  },
];

async function request(path, token, options = {}) {
  const response = await fetch(new URL(path, apiUrl), {
    ...options,
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${token}`,
      ...(options.headers ?? {}),
    },
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`${path} returned HTTP ${response.status}: ${body}`);
  if (!body) return null;
  try { return JSON.parse(body); } catch { return body; }
}

async function signIn(email, password) {
  const response = await fetch(new URL('/auth/v1/token?grant_type=password', apiUrl), {
    method: 'POST',
    headers: { apikey: anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.access_token) {
    throw new Error(`Seed account ${email} could not sign in: HTTP ${response.status} ${JSON.stringify(body)}`);
  }
  return body.access_token;
}

function assertTenantRows(label, rows, tenantField, tenantId) {
  const unexpected = rows.filter(row => row[tenantField] !== tenantId);
  if (unexpected.length) {
    throw new Error(`${label} leaked ${unexpected.length} cross-tenant row(s)`);
  }
}

for (const tenant of tenants) {
  const token = await signIn(tenant.email, tenant.password);
  const query = async path => request(`/rest/v1/${path}`, token);

  const placements = await query(
    'placements?select=id,university_id,company_id,student:profiles!placements_student_id_fkey(id,department,student_profile:student_profiles(program)),site_supervisor:profiles!placements_site_supervisor_id_fkey(id,full_name),faculty_supervisor:profiles!placements_faculty_supervisor_id_fkey(id,full_name),posting:job_postings(id,title,type)&order=created_at.desc&limit=1000',
  );
  if (!Array.isArray(placements) || placements.length === 0) {
    throw new Error(`${tenant.label} analytics query returned no seeded placements`);
  }
  assertTenantRows(`${tenant.label} placements`, placements, tenant.tenantField, tenant.tenantId);
  const visiblePlacementIds = new Set(placements.map(row => row.id));

  const applications = await query(
    'applications?select=id,university_id,company_id,status,student:profiles!applications_student_id_fkey(id,department,student_profile:student_profiles(program)),posting:job_postings(id,title,type,status)&order=created_at.desc&limit=1000',
  );
  assertTenantRows(`${tenant.label} applications`, applications, tenant.tenantField, tenant.tenantId);

  const weekly = await query('weekly_logs?select=id,placement_id,week_number,status,submitted_at&limit=1000');
  const daily = await query('daily_reports?select=id,placement_id,report_date,week_number,status&limit=1000');
  const evaluations = await query('evaluations?select=id,placement_id,type,overall_score&limit=1000');
  for (const [name, rows] of [['weekly reports', weekly], ['daily reports', daily], ['evaluations', evaluations]]) {
    const foreign = rows.filter(row => !visiblePlacementIds.has(row.placement_id));
    if (foreign.length) throw new Error(`${tenant.label} can see ${foreign.length} ${name} linked to an inaccessible placement`);
  }

  const stats = await request(`/rest/v1/rpc/${tenant.statsRpc}`, token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  if (stats == null) throw new Error(`${tenant.label} stats RPC returned an empty response`);

  console.log(`PASS: ${tenant.label} can load dashboard analytics; ${placements.length} placements, ${applications.length} applications, ${weekly.length} weekly reports, ${daily.length} daily reports, ${evaluations.length} evaluations; tenant isolation holds.`);
}

console.log('PASS: coordinator and company analytics API smoke tests completed');

const studentToken = await signIn('student1@baystate.edu', 'Password123!');
const studentStatsResponse = await fetch(new URL('/rest/v1/rpc/university_stats', apiUrl), {
  method: 'POST',
  headers: { apikey: anonKey, Authorization: `Bearer ${studentToken}`, 'Content-Type': 'application/json' },
  body: '{}',
});
if (studentStatsResponse.ok) {
  throw new Error('Student account unexpectedly accessed coordinator-only university analytics');
}
console.log('PASS: student account is denied coordinator-only analytics RPC access');

