import { useMemo, useState } from 'react';
import {
  Archive, RotateCcw, Users, Building2, GraduationCap, Search,
  CalendarDays, ShieldCheck,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useDeletedEntities, useRestoreDeletedEntity, type DeletedEntity } from '@/hooks/useAdminConsole';
import { errorMessage } from '@/lib/utils';
import { Alert, Badge, Button, Card, EmptyState, PageHeader, Spinner, Tabs, useToast } from '@/components/ui';

type ArchiveTab = 'all' | DeletedEntity['entity_type'];

const labels: Record<DeletedEntity['entity_type'], string> = {
  user: 'User',
  university: 'University',
  company: 'Company',
};

const dateLabel = (value: string) =>
  new Date(value).toLocaleString(undefined, {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

export function RecycleBin() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const archive = useDeletedEntities();
  const restore = useRestoreDeletedEntity();
  const [tab, setTab] = useState<ArchiveTab>('all');
  const [query, setQuery] = useState('');
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const rows = archive.data ?? [];
  const counts = {
    all: rows.length,
    user: rows.filter((item) => item.entity_type === 'user').length,
    university: rows.filter((item) => item.entity_type === 'university').length,
    company: rows.filter((item) => item.entity_type === 'company').length,
  };

  const items = useMemo(() => {
    const term = query.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesTab = tab === 'all' || row.entity_type === tab;
      const matchesQuery = !term ||
        row.display_name.toLowerCase().includes(term) ||
        labels[row.entity_type].toLowerCase().includes(term);
      return matchesTab && matchesQuery;
    });
  }, [rows, tab, query]);

  if (profile?.role !== 'platform_admin') {
    return <EmptyState icon={<Archive />} title="Administrators only" description="The Recycle Bin is available to platform administrators." />;
  }

  const restoreItem = async (item: DeletedEntity) => {
    setRestoringId(item.id);
    try {
      await restore.mutateAsync({ id: item.entity_id, kind: item.entity_type });
      toast({ title: `${item.display_name} restored`, description: 'The record has been returned to its original area.', tone: 'success' });
    } catch (error) {
      toast({ title: 'Could not restore record', description: errorMessage(error), tone: 'error' });
    } finally {
      setRestoringId(null);
    }
  };

  const stats = [
    { label: 'Archived users', value: counts.user, icon: Users, tone: 'blue', note: 'User accounts' },
    { label: 'Archived universities', value: counts.university, icon: GraduationCap, tone: 'violet', note: 'University records' },
    { label: 'Archived companies', value: counts.company, icon: Building2, tone: 'emerald', note: 'Company records' },
  ];

  return (
    <div className="space-y-6 recycle-page">
      <PageHeader
        title="Recycle Bin"
        description="Manage archived platform records and safely restore them when needed."
      />

      <section className="recycle-page__hero">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-white/10 p-3"><Archive className="h-6 w-6" /></div>
            <div>
              <p className="text-sm font-medium text-slate-300">Archive overview</p>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-3xl font-semibold tracking-tight">{counts.all}</span>
                <span className="text-sm text-slate-300">total archived records</span>
              </div>
              <p className="mt-1 text-xs text-slate-400">Records remain here until an administrator restores them.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start rounded-full border border-white/15 bg-white/10 px-3 py-2 text-xs text-slate-200 sm:self-center">
            <ShieldCheck className="h-4 w-4" /> Platform administrator
          </div>
        </div>
      </section>

      <section className="recycle-page__stats">
        {stats.map(({ label, value, icon: Icon, tone, note }) => (
          <Card key={label} className="overflow-hidden">
            <div className="flex items-center justify-between gap-3 p-5">
              <div>
                <p className="text-sm font-medium text-slate-500">{label}</p>
                <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">{value}</p>
                <p className="mt-1 text-xs text-slate-400">{note}</p>
              </div>
              <div className={`rounded-xl p-3 ${tone === 'blue' ? 'bg-blue-50 text-blue-700' : tone === 'violet' ? 'bg-violet-50 text-violet-700' : 'bg-emerald-50 text-emerald-700'}`}>
                <Icon className="h-5 w-5" />
              </div>
            </div>
          </Card>
        ))}
      </section>

      <Card className="overflow-hidden recycle-page__records">
        <div className="border-b border-slate-200 p-4 sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Archived records</h2>
              <p className="mt-1 text-sm text-slate-500">Browse records by category or search by name.</p>
            </div>
            <label className="relative block w-full lg:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search archived records..."
                aria-label="Search archived records"
                className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </label>
          </div>
          <div className="mt-5 overflow-x-auto">
            <Tabs value={tab} onChange={(value) => setTab(value as ArchiveTab)} options={[
              { key: 'all', label: 'All records', count: counts.all },
              { key: 'user', label: 'Users', count: counts.user },
              { key: 'university', label: 'Universities', count: counts.university },
              { key: 'company', label: 'Companies', count: counts.company },
            ]} />
          </div>
        </div>

        {archive.isLoading ? (
          <div className="flex justify-center p-12"><Spinner /></div>
        ) : archive.isError ? (
          <div className="p-5"><Alert tone="danger" title="Could not load archived records">{errorMessage(archive.error)}</Alert></div>
        ) : items.length === 0 ? (
          <div className="p-8 sm:p-12">
            <EmptyState
              icon={<Archive />}
              title={query ? 'No matching records' : 'Recycle Bin is empty'}
              description={query ? 'Try another search term or select a different category.' : 'Archived users, universities and companies will appear here.'}
            />
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[680px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Record</th>
                    <th className="px-5 py-3 font-semibold">Category</th>
                    <th className="px-5 py-3 font-semibold">Date archived</th>
                    <th className="px-5 py-3 text-right font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((item) => (
                    <tr key={item.id} className="transition hover:bg-slate-50/80">
                      <td className="px-5 py-4">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="rounded-lg bg-slate-100 p-2 text-slate-600">
                            {item.entity_type === 'user' ? <Users className="h-4 w-4" /> : item.entity_type === 'university' ? <GraduationCap className="h-4 w-4" /> : <Building2 className="h-4 w-4" />}
                          </div>
                          <span className="truncate font-medium text-slate-900">{item.display_name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <Badge tone={item.entity_type === 'user' ? 'blue' : item.entity_type === 'university' ? 'violet' : 'emerald'}>{labels[item.entity_type]}</Badge>
                      </td>
                      <td className="px-5 py-4 text-slate-500">
                        <span className="inline-flex items-center gap-2"><CalendarDays className="h-4 w-4 text-slate-400" />{dateLabel(item.deleted_at)}</span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <Button size="sm" variant="secondary" onClick={() => void restoreItem(item)} loading={restoringId === item.id}>
                          <RotateCcw className="h-4 w-4" /> Restore
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="divide-y divide-slate-100 md:hidden">
              {items.map((item) => (
                <div key={item.id} className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="rounded-lg bg-slate-100 p-2 text-slate-600">
                        {item.entity_type === 'user' ? <Users className="h-4 w-4" /> : item.entity_type === 'university' ? <GraduationCap className="h-4 w-4" /> : <Building2 className="h-4 w-4" />}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">{item.display_name}</p>
                        <div className="mt-1"><Badge tone={item.entity_type === 'user' ? 'blue' : item.entity_type === 'university' ? 'violet' : 'emerald'}>{labels[item.entity_type]}</Badge></div>
                      </div>
                    </div>
                    <Button size="sm" variant="secondary" onClick={() => void restoreItem(item)} loading={restoringId === item.id}>
                      <RotateCcw className="h-4 w-4" /> Restore
                    </Button>
                  </div>
                  <p className="flex items-center gap-2 pl-11 text-xs text-slate-500"><CalendarDays className="h-3.5 w-3.5" /> Archived {dateLabel(item.deleted_at)}</p>
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-1 border-t border-slate-100 bg-slate-50/70 px-5 py-3 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
              <span>Showing {items.length} of {counts.all} archived records</span>
              <span className="inline-flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5" /> Restore returns a record to its original area</span>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
