import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Briefcase, Eye, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import {
  POSTING_STATUS_LABELS,
  POSTING_TYPE_LABELS,
  formatDate,
  isDeadlinePassed,
} from '@sims/shared';
import type { PostingStatus } from '@sims/shared';
import { useAuth } from '@/context/AuthContext';
import {
  useDeletePosting,
  useManagePostings,
  useUpdatePostingStatus,
} from '@/hooks/usePostings';
import { useApplications } from '@/hooks/useApplications';
import { errorMessage } from '@/lib/utils';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  PageHeader,
  Spinner,
  Table,
  Tabs,
  Td,
  Th,
  useToast,
} from '@/components/ui';
import { StatusBadge } from '@/components/StatusBadge';

const TABS: { key: PostingStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'draft', label: 'Drafts' },
  { key: 'published', label: 'Published' },
  { key: 'closed', label: 'Closed' },
];

export function ManagePostings() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const postings = useManagePostings(profile?.company_id);
  const applications = useApplications();
  const updateStatus = useUpdatePostingStatus();
  const removePosting = useDeletePosting();

  const [tab, setTab] = useState<PostingStatus | 'all'>('all');
  const [search, setSearch] = useState('');

  const items = postings.data ?? [];
  const counts = useMemo(() => {
    const result: Record<string, number> = { all: items.length };
    for (const posting of items) {
      result[posting.status] = (result[posting.status] ?? 0) + 1;
    }
    return result;
  }, [items]);

  const applicationCounts = useMemo(() => {
    const result: Record<string, number> = {};
    for (const application of applications.data ?? []) {
      result[application.posting_id] = (result[application.posting_id] ?? 0) + 1;
    }
    return result;
  }, [applications.data]);

  const filtered = items.filter((posting) => {
    if (tab !== 'all' && posting.status !== tab) return false;
    const term = search.trim().toLowerCase();
    return !term || posting.title.toLowerCase().includes(term);
  });

  const changeStatus = async (id: string, status: PostingStatus) => {
    try {
      await updateStatus.mutateAsync({ id, status });
      toast({ title: `Posting marked ${POSTING_STATUS_LABELS[status].toLowerCase()}`, tone: 'success' });
    } catch (caught) {
      toast({ title: 'Could not update posting', description: errorMessage(caught), tone: 'error' });
    }
  };

  const deletePosting = async (id: string, title: string) => {
    if (!window.confirm(`Delete "${title}"? This also removes its applications. This cannot be undone.`)) return;
    try {
      await removePosting.mutateAsync(id);
      toast({ title: 'Posting deleted', tone: 'info' });
    } catch (caught) {
      toast({ title: 'Could not delete posting', description: errorMessage(caught), tone: 'error' });
    }
  };

  return (
    <div>
      <PageHeader
        title="Our postings"
        description="Create drafts, publish to universities, and close roles when hiring is complete."
        actions={
          <Link to="/manage/postings/new">
            <Button>
              <Plus className="h-4 w-4" /> New posting
            </Button>
          </Link>
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          options={TABS.map((option) => ({ key: option.key, label: option.label, count: counts[option.key] ?? 0 }))}
          value={tab}
          onChange={(key) => setTab(key as PostingStatus | 'all')}
        />
        <div className="relative sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            className="pl-9"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search postings"
          />
        </div>
      </div>

      {postings.isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Spinner className="h-6 w-6" />
        </div>
      ) : postings.isError ? (
        <EmptyState title="Could not load postings" description="Refresh the page and try again." />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Briefcase className="h-5 w-5" />}
          title="No postings in this view"
          description="Create a posting to start receiving applications."
          action={
            <Link to="/manage/postings/new">
              <Button size="sm">Create posting</Button>
            </Link>
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <Table className="border-0">
            <thead>
              <tr>
                <Th>Posting</Th>
                <Th>Visibility</Th>
                <Th>Deadline</Th>
                <Th>Applicants</Th>
                <Th>Status</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filtered.map((posting) => {
                const closed = isDeadlinePassed(posting.deadline);
                const targeted = posting.posting_universities?.length ?? 0;
                return (
                  <tr key={posting.id} className="hover:bg-slate-50/70">
                    <Td>
                      <p className="text-sm font-medium text-slate-900">{posting.title}</p>
                      <p className="text-xs text-slate-500">{POSTING_TYPE_LABELS[posting.type]}</p>
                    </Td>
                    <Td>
                      <Badge tone={posting.visibility === 'all_universities' ? 'blue' : 'violet'}>
                        {posting.visibility === 'all_universities'
                          ? 'All universities'
                          : `${targeted} universit${targeted === 1 ? 'y' : 'ies'}`}
                      </Badge>
                    </Td>
                    <Td className="text-xs">
                      <span className={closed ? 'text-rose-600' : 'text-slate-600'}>
                        {posting.deadline ? formatDate(posting.deadline) : 'Rolling'}
                      </span>
                      {closed && posting.status === 'published' ? (
                        <p className="text-[11px] text-rose-500">Deadline passed</p>
                      ) : null}
                    </Td>
                    <Td>
                      <span className="text-sm font-medium text-slate-800">
                        {applicationCounts[posting.id] ?? 0}
                      </span>
                    </Td>
                    <Td>
                      <StatusBadge status={posting.status} label={POSTING_STATUS_LABELS[posting.status]} />
                    </Td>
                    <Td>
                      <div className="flex justify-end gap-1.5">
                        <Link to={`/postings/${posting.id}`}>
                          <Button size="sm" variant="ghost">
                            <Eye className="h-3.5 w-3.5" /> View
                          </Button>
                        </Link>
                        <Link to={`/manage/postings/${posting.id}/edit`}>
                          <Button size="sm" variant="secondary">
                            <Pencil className="h-3.5 w-3.5" /> Edit
                          </Button>
                        </Link>
                        {posting.status !== 'published' ? (
                          <Button
                            size="sm"
                            onClick={() => changeStatus(posting.id, 'published')}
                            loading={updateStatus.isPending}
                          >
                            Publish
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => changeStatus(posting.id, 'closed')}
                            loading={updateStatus.isPending}
                          >
                            Close
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deletePosting(posting.id, posting.title)}
                          loading={removePosting.isPending}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </Card>
      )}
    </div>
  );
}
