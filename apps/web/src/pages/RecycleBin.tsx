import { useMemo, useState } from 'react';
import { Archive, RotateCcw, Users, Building2, GraduationCap } from 'lucide-react';
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

export function RecycleBin() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const archive = useDeletedEntities();
  const restore = useRestoreDeletedEntity();
  const [tab, setTab] = useState<ArchiveTab>('all');
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const items = useMemo(() => {
    const rows = archive.data ?? [];
    return tab === 'all' ? rows : rows.filter((row) => row.entity_type === tab);
  }, [archive.data, tab]);

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

  const counts = {
    all: archive.data?.length ?? 0,
    user: archive.data?.filter((item) => item.entity_type === 'user').length ?? 0,
    university: archive.data?.filter((item) => item.entity_type === 'university').length ?? 0,
    company: archive.data?.filter((item) => item.entity_type === 'company').length ?? 0,
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Recycle Bin" description="Archived users, universities, and companies. Restore a record to return it to the platform." />
      <div className="grid gap-4 sm:grid-cols-3">
        <Card><div className="flex items-center gap-3 p-4"><Users /><div><p className="text-sm text-slate-500">Users</p><strong>{counts.user}</strong></div></div></Card>
        <Card><div className="flex items-center gap-3 p-4"><GraduationCap /><div><p className="text-sm text-slate-500">Universities</p><strong>{counts.university}</strong></div></div></Card>
        <Card><div className="flex items-center gap-3 p-4"><Building2 /><div><p className="text-sm text-slate-500">Companies</p><strong>{counts.company}</strong></div></div></Card>
      </div>
      <Card className="p-4">
        <Tabs value={tab} onChange={(value) => setTab(value as ArchiveTab)} options={[
          { key: 'all', label: 'All', count: counts.all },
          { key: 'user', label: 'Users', count: counts.user },
          { key: 'university', label: 'Universities', count: counts.university },
          { key: 'company', label: 'Companies', count: counts.company },
        ]} />
        {archive.isLoading ? <div className="flex justify-center p-10"><Spinner /></div> : archive.isError ? (
          <Alert tone="danger" title="Could not load archived records">{errorMessage(archive.error)}</Alert>
        ) : items.length === 0 ? (
          <EmptyState icon={<Archive />} title="Recycle Bin is empty" description="Archived records will appear here." />
        ) : (
          <div className="mt-4 divide-y divide-slate-100">
            {items.map((item) => (
              <div key={item.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="truncate">{item.display_name}</strong>
                    <Badge tone={item.entity_type === 'user' ? 'blue' : item.entity_type === 'university' ? 'violet' : 'emerald'}>{labels[item.entity_type]}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">Archived {new Date(item.deleted_at).toLocaleString()}</p>
                </div>
                <Button size="sm" variant="secondary" onClick={() => void restoreItem(item)} loading={restoringId === item.id}>
                  <RotateCcw className="h-4 w-4" /> Restore
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
