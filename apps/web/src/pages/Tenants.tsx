import { useMemo, useState } from 'react';
import {
  Building2,
  GraduationCap,
  Pencil,
  Plus,
  Power,
  Trash2,
  UserPlus,
} from 'lucide-react';
import { formatDate } from '@sims/shared';
import type { Company, InviteResult, University } from '@sims/shared';
import { useCompanies, useInviteUser, useSaveTenant, useUniversities } from '@/hooks/useLookups';
import { useDeleteTenant } from '@/hooks/useAdminConsole';
import { usePlatformAdmins } from '@/hooks/usePlatformAdmins';
import { usePlatformStats } from '@/hooks/useDashboardStats';
import { GeneralAdmins } from '@/components/GeneralAdmins';
import { errorMessage } from '@/lib/utils';
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Modal,
  Spinner,
  StatCard,
  Tabs,
  useToast,
} from '@/components/ui';
import { StatusBadge } from '@/components/StatusBadge';

type Kind = 'university' | 'company' | 'admins';

interface TenantFormState {
  name: string;
  slug: string;
  domain: string;
  industry: string;
  website: string;
  logoUrl: string;
}

const EMPTY_FORM: TenantFormState = {
  name: '',
  slug: '',
  domain: '',
  industry: '',
  website: '',
  logoUrl: '',
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export function Tenants() {
  const { toast } = useToast();
  const universities = useUniversities(true);
  const companies = useCompanies();
  const platformStats = usePlatformStats(true);
  const platformAdmins = usePlatformAdmins();
  const saveUniversity = useSaveTenant('university');
  const saveCompany = useSaveTenant('company');
  const invite = useInviteUser();
  const deleteTenant = useDeleteTenant();

  const [tab, setTab] = useState<Kind>('university');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<University | Company | null>(null);
  const [form, setForm] = useState<TenantFormState>(EMPTY_FORM);
  const [error, setError] = useState('');

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteTenant, setInviteTenant] = useState<University | Company | null>(null);
  const [inviteForm, setInviteForm] = useState({ fullName: '', email: '' });
  const [inviteResult, setInviteResult] = useState<InviteResult | null>(null);
  const [inviteError, setInviteError] = useState('');

  const [deleteTarget, setDeleteTarget] = useState<{ tenant: University | Company; kind: 'university' | 'company' } | null>(null);
  const [deleteError, setDeleteError] = useState('');

  const universityList = universities.data ?? [];
  const companyList = companies.data ?? [];
  const adminCount = platformAdmins.data?.length ?? 0;

  const activeCounts = useMemo(
    () => ({
      universities: universityList.filter((item) => item.status === 'active').length,
      companies: companyList.filter((item) => item.status === 'active').length,
    }),
    [universityList, companyList],
  );

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setError('');
    setEditorOpen(true);
  };

  const openEdit = (tenant: University | Company) => {
    setEditing(tenant);
    setForm({
      name: tenant.name,
      slug: tenant.slug,
      domain: 'domain' in tenant ? tenant.domain ?? '' : '',
      industry: 'industry' in tenant ? tenant.industry ?? '' : '',
      website: 'website' in tenant ? tenant.website ?? '' : '',
      logoUrl: tenant.logo_url ?? '',
    });
    setError('');
    setEditorOpen(true);
  };

  const submitTenant = async () => {
    setError('');
    const name = form.name.trim();
    const slug = slugify(form.slug || form.name);
    if (!name || !slug) {
      setError('Enter a name and slug.');
      return;
    }

    const values: Record<string, unknown> =
      tab === 'university'
        ? {
            name,
            slug,
            domain: form.domain.trim() || null,
            logo_url: form.logoUrl.trim() || null,
          }
        : {
            name,
            slug,
            industry: form.industry.trim() || null,
            website: form.website.trim() || null,
            logo_url: form.logoUrl.trim() || null,
          };

    try {
      await (tab === 'university' ? saveUniversity : saveCompany).mutateAsync({
        id: editing?.id,
        values,
      });
      toast({ title: editing ? 'Tenant updated' : 'Tenant created', tone: 'success' });
      setEditorOpen(false);
    } catch (caught) {
      setError(errorMessage(caught));
    }
  };

  const toggleStatus = async (tenant: University | Company) => {
    const next = tenant.status === 'active' ? 'suspended' : 'active';
    try {
      await (tab === 'university' ? saveUniversity : saveCompany).mutateAsync({
        id: tenant.id,
        values: { status: next },
      });
      toast({ title: `${tenant.name} ${next === 'active' ? 'reactivated' : 'suspended'}`, tone: 'info' });
    } catch (caught) {
      toast({ title: 'Could not update tenant', description: errorMessage(caught), tone: 'error' });
    }
  };

  const openInvite = (tenant: University | Company) => {
    setInviteTenant(tenant);
    setInviteForm({ fullName: '', email: '' });
    setInviteResult(null);
    setInviteError('');
    setInviteOpen(true);
  };

  const openDelete = (tenant: University | Company, kind: 'university' | 'company') => {
    setDeleteTarget({ tenant, kind });
    setDeleteError('');
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteError('');
    try {
      await deleteTenant.mutateAsync({ id: deleteTarget.tenant.id, kind: deleteTarget.kind });
      toast({
        title: `${deleteTarget.tenant.name} archived`,
        description: 'The tenant was moved to the Recycle Bin. Its related records are preserved.',
        tone: 'success',
      });
      setDeleteTarget(null);
    } catch (caught) {
      setDeleteError(errorMessage(caught));
    }
  };

  const submitInvite = async () => {
    if (!inviteTenant) return;
    setInviteError('');
    if (!inviteForm.fullName.trim() || !inviteForm.email.trim()) {
      setInviteError('Enter a name and email.');
      return;
    }
    try {
      const result = await invite.mutateAsync({
        email: inviteForm.email.trim(),
        full_name: inviteForm.fullName.trim(),
        role: tab === 'university' ? 'coordinator' : 'company_admin',
        university_id: tab === 'university' ? inviteTenant.id : undefined,
        company_id: tab === 'company' ? inviteTenant.id : undefined,
      });
      setInviteResult(result);
      toast({ title: tab === 'company' ? 'Company account created' : 'Coordinator account created', description: `Share the temporary password securely with ${result.email}.`, tone: 'success' });
    } catch (caught) {
      setInviteError(errorMessage(caught));
    }
  };

  const list = tab === 'university' ? universityList : companyList;
  const loading = tab === 'university' ? universities.isLoading : companies.isLoading;

  return (
    <main className="tenants-page">
      <section className="page-hero">
        <div><span className="page-hero__eyebrow">PLATFORM ADMINISTRATION</span><h1>Organisations and tenants.</h1><p>{tab === 'admins' ? 'Manage platform administrators and privileged access.' : 'Create and manage university and company workspaces across SIMS.'}</p></div>
        <div className="page-hero__aside"><strong>{list.length}</strong><span>{tab === 'admins' ? 'administrators' : tab === 'university' ? 'university workspaces' : 'company workspaces'}</span><small>Currently selected category</small>{tab !== 'admins' ? <Button onClick={openCreate}><Plus size={15}/> {tab === 'university' ? 'Add university' : 'Add company'}</Button> : null}</div>
      </section>

      <div className='tenants-mb-6-1'>
        <StatCard
          label="Universities"
          value={platformStats.data?.universities ?? '—'}
          hint={`${activeCounts.universities} active`}
          icon={<GraduationCap className='tenants-h-5-1' />}
        />
        <StatCard
          label="Companies"
          value={platformStats.data?.companies ?? '—'}
          hint={`${activeCounts.companies} active`}
          icon={<Building2 className='tenants-h-5-1' />}
        />
        <StatCard
          label="Students"
          value={platformStats.data?.students ?? '—'}
          hint="Across all universities"
          icon={<GraduationCap className='tenants-h-5-1' />}
        />
        <StatCard
          label="Active placements"
          value={platformStats.data?.active_placements ?? '—'}
          hint={`${platformStats.data?.completed_placements ?? 0} completed`}
          icon={<Building2 className='tenants-h-5-1' />}
        />
      </div>

      <Tabs
        className='tenants-mb-4-1'
        options={[
          { key: 'university', label: 'Universities', count: universityList.length },
          { key: 'company', label: 'Companies', count: companyList.length },
          { key: 'admins', label: 'General admins', count: adminCount },
        ]}
        value={tab}
        onChange={(key) => setTab(key as Kind)}
      />

      {tab === 'admins' ? (
        <GeneralAdmins />
      ) : loading ? (
        <div className='tenants-flex-1'>
          <Spinner className='tenants-h-6-1' />
        </div>
      ) : (tab === 'university' ? universities.isError : companies.isError) ? (
        <Alert tone="danger" title={`Could not load ${tab === 'university' ? 'universities' : 'companies'}`}>
          {errorMessage(tab === 'university' ? universities.error : companies.error)}{' '}
          <Button size="sm" variant="secondary" onClick={() => void (tab === 'university' ? universities.refetch() : companies.refetch())}>
            Retry
          </Button>
        </Alert>
      ) : list.length === 0 ? (
        <EmptyState
          title={tab === 'university' ? 'No universities yet' : 'No companies yet'}
          description="Create the first tenant to get started."
          action={
            <Button size="sm" onClick={openCreate}>
              {tab === 'company' ? 'Add new company' : 'Add new university'}
            </Button>
          }
        />
      ) : (
        <div className='tenants-grid-1'>
          {list.map((tenant) => (
            <Card key={tenant.id} className='tenants-flex-2'>
              <div className='tenants-flex-3'>
                <div className='tenants-flex-4'>
                  <span className='tenants-flex-5'>
                    {tab === 'university' ? <GraduationCap className='tenants-h-5-1' /> : <Building2 className='tenants-h-5-1' />}
                  </span>
                  <div className='tenants-min-w-0-1'>
                    <p className='tenants-truncate-1'>{tenant.name}</p>
                    <p className='tenants-truncate-2'>
                      {'domain' in tenant ? tenant.domain || tenant.slug : tenant.industry || tenant.slug}
                    </p>
                  </div>
                </div>
                <StatusBadge status={tenant.status} />
              </div>

              <div className='tenants-mt-3-1'>
                <p>
                  Slug: <span className='tenants-font-mono-1'>{tenant.slug}</span>
                </p>
                {'website' in tenant && tenant.website ? <p>Website: {tenant.website}</p> : null}
                <p>Created {formatDate(tenant.created_at)}</p>
              </div>

              <div className='tenants-mt-4-1'>
                <Button size="sm" variant="secondary" onClick={() => openEdit(tenant)}>
                  <Pencil className='tenants-h-35-1' /> Edit
                </Button>
                <Button size="sm" variant="secondary" onClick={() => openInvite(tenant)}>
                  <UserPlus className='tenants-h-35-1' /> {tab === 'company' ? 'Create company account' : 'Create coordinator account'}
                </Button>
                <Button
                  size="sm"
                  variant={tenant.status === 'active' ? 'danger' : 'outline'}
                  onClick={() => toggleStatus(tenant)}
                  loading={saveUniversity.isPending || saveCompany.isPending}
                >
                  <Power className='tenants-h-35-1' />
                  {tenant.status === 'active' ? 'Suspend' : 'Activate'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="tenants-delete"
                  onClick={() => openDelete(tenant, tab === 'university' ? 'university' : 'company')}
                >
                  <Trash2 className='tenants-h-35-1' /> Delete
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        title={
          editing
            ? `Edit ${tab === 'university' ? 'university' : 'company'}`
            : `New ${tab === 'university' ? 'university' : 'company'}`
        }
        description={
          tab === 'university'
            ? 'Universities own their students, faculty supervisors, and coordinators.'
            : 'Companies own their postings, site supervisors, and applicants.'
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditorOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitTenant} loading={saveUniversity.isPending || saveCompany.isPending}>
              {editing ? 'Save changes' : 'Create tenant'}
            </Button>
          </>
        }
      >
        <div className='tenants-space-y-4-1'>
          {error ? <Alert tone="danger">{error}</Alert> : null}
          <div className='tenants-grid-2'>
            <Field label="Name" htmlFor="tenant-name" required className='tenants-col-span-2-1'>
              <Input
                id="tenant-name"
                value={form.name}
                onChange={(event) => {
                  const name = event.target.value;
                  setForm((current) => ({
                    ...current,
                    name,
                    slug: editing ? current.slug : slugify(name),
                  }));
                }}
                placeholder={tab === 'university' ? 'Bay State University' : 'Acme Software'}
              />
            </Field>
            <Field label="Slug" htmlFor="tenant-slug" required hint="Used in URLs and imports.">
              <Input
                id="tenant-slug"
                value={form.slug}
                onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))}
                placeholder="bay-state"
              />
            </Field>
            {tab === 'university' ? (
              <Field label="Email domain" htmlFor="tenant-domain" hint="e.g. baystate.edu">
                <Input
                  id="tenant-domain"
                  value={form.domain}
                  onChange={(event) => setForm((current) => ({ ...current, domain: event.target.value }))}
                  placeholder="baystate.edu"
                />
              </Field>
            ) : (
              <Field label="Industry" htmlFor="tenant-industry">
                <Input
                  id="tenant-industry"
                  value={form.industry}
                  onChange={(event) => setForm((current) => ({ ...current, industry: event.target.value }))}
                  placeholder="Software"
                />
              </Field>
            )}
            {tab === 'company' ? (
              <Field label="Website" htmlFor="tenant-website" className='tenants-col-span-2-1'>
                <Input
                  id="tenant-website"
                  value={form.website}
                  onChange={(event) => setForm((current) => ({ ...current, website: event.target.value }))}
                  placeholder="https://acme.com"
                />
              </Field>
            ) : null}
            <Field label="Logo URL" htmlFor="tenant-logo" hint="Optional public image URL." className='tenants-col-span-2-1'>
              <Input
                id="tenant-logo"
                value={form.logoUrl}
                onChange={(event) => setForm((current) => ({ ...current, logoUrl: event.target.value }))}
                placeholder="https://…/logo.png"
              />
            </Field>
          </div>
        </div>
      </Modal>

      <Modal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        title={tab === 'company' ? 'Create company account' : 'Create coordinator account'}
        description={inviteTenant ? (tab === 'company' ? `Create a company administrator login for ${inviteTenant.name}.` : `Create a coordinator login for ${inviteTenant.name}.`) : undefined}
        footer={
          inviteResult ? (
            <Button onClick={() => setInviteOpen(false)}>Done</Button>
          ) : (
            <>
              <Button variant="secondary" onClick={() => setInviteOpen(false)}>
                Cancel
              </Button>
              <Button onClick={submitInvite} loading={invite.isPending}>
                {tab === 'company' ? 'Create company account' : 'Create coordinator account'}
              </Button>
            </>
          )
        }
      >
        <div className='tenants-space-y-4-1'>
          {inviteError ? <Alert tone="danger">{inviteError}</Alert> : null}
          {inviteResult ? (
            <Alert tone="success" title={tab === 'company' ? 'Company account created' : 'Coordinator account created'}>
              <div className='tenants-space-y-1-1'>
                <p>Email: <strong>{inviteResult.email}</strong></p>
                <p>
                  Temporary password:{' '}
                  <code className='tenants-rounded-1'>{inviteResult.temporary_password}</code>
                </p>
                <p className='tenants-text-xs-1'>Share these credentials over a secure channel.</p>
              </div>
            </Alert>
          ) : (
            <>
              <Field label={tab === 'company' ? 'Company representative name' : 'Coordinator full name'} htmlFor="invite-admin-name" required>
                <Input
                  id="invite-admin-name"
                  value={inviteForm.fullName}
                  onChange={(event) => setInviteForm((current) => ({ ...current, fullName: event.target.value }))}
                  placeholder="Dana Whitfield"
                />
              </Field>
              <Field label="Login email" htmlFor="invite-admin-email" required>
                <Input
                  id="invite-admin-email"
                  type="email"
                  value={inviteForm.email}
                  onChange={(event) => setInviteForm((current) => ({ ...current, email: event.target.value }))}
                  placeholder={tab === 'university' ? 'coordinator@university.edu' : 'admin@company.com'}
                />
              </Field>
              <div className='tenants-rounded-xl-1'>
                <Badge tone="violet">{tab === 'university' ? 'University coordinator' : 'Company administrator'}</Badge>
                <span className='tenants-ml-2-1'>This login is linked to {inviteTenant?.name} and receives access for that organization only.</span>
              </div>
            </>
          )}
        </div>
      </Modal>

      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title={`Archive ${deleteTarget?.kind === 'university' ? 'university' : 'company'}?`}
        description={deleteTarget ? `Move ${deleteTarget.tenant.name} to the Recycle Bin.` : undefined}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={confirmDelete} loading={deleteTenant.isPending}>
              <Trash2 className='tenants-h-35-1' /> Archive tenant
            </Button>
          </>
        }
      >
        <div className='tenants-space-y-4-1'>
          {deleteError ? <Alert tone="danger">{deleteError}</Alert> : null}
          <Alert tone="warning" title="The tenant will be archived">
            <strong>{deleteTarget?.tenant.name}</strong> will be hidden from active tenant lists and moved to the Recycle Bin.
            Its member accounts, applications, placements, and history will be preserved. You can restore the tenant later.
          </Alert>
        </div>
      </Modal>
    </main>
  );
}
