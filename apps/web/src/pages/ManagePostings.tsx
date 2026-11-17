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
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
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
    <section className="manage-opportunities-page">
      <section className="page-hero page-hero--manage">
        <div><span className="page-hero__eyebrow">EMPLOYER WORKSPACE</span><h1>Manage your opportunities.</h1><p>Create, publish and maintain the roles your organisation shares with students.</p></div>
        <div className="page-hero__aside"><strong>{items.length}</strong><span>opportunities in your workspace</span><small>Drafts, published and closed roles</small><Link to="/manage/postings/new"><Button><Plus size={16}/> Create opportunity</Button></Link></div>
      </section>

      <div className='manage-postings-mb-4-1'>
        <Tabs
          options={TABS.map((option) => ({ key: option.key, label: option.label, count: counts[option.key] ?? 0 }))}
          value={tab}
          onChange={(key) => setTab(key as PostingStatus | 'all')}
        />
        <div className='manage-postings-relative-1'>
          <Search className='manage-postings-pointer-events-none-1' />
          <Input
            className='manage-postings-pl-9-1'
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search postings"
          />
        </div>
      </div>

      {postings.isLoading ? (
        <div className='manage-postings-flex-1'>
          <Spinner className='manage-postings-h-6-1' />
        </div>
      ) : postings.isError ? (
        <EmptyState
          title="Could not load postings"
          description="Your company postings could not be retrieved. Try again."
          action={<Button size="sm" variant="secondary" onClick={() => void postings.refetch()} loading={postings.isFetching}>Retry</Button>}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Briefcase className='manage-postings-h-5-1' />}
          title="No postings in this view"
          description="Create a posting to start receiving applications."
          action={
            <Link to="/manage/postings/new">
              <Button size="sm">Create posting</Button>
            </Link>
          }
        />
      ) : (
        <>
        {applications.isError ? (
          <Alert tone="warning" title="Applicant counts are unavailable">
            Postings loaded, but applicant totals could not be retrieved. <Button size="sm" variant="ghost" onClick={() => void applications.refetch()}>Retry counts</Button>
          </Alert>
        ) : null}
        <Card className='manage-postings-overflow-hidden-1'>
          <Table className='manage-postings-border-0-1'>
            <thead>
              <tr>
                <Th>Posting</Th>
                <Th>Visibility</Th>
                <Th>Deadline</Th>
                <Th>Applicants</Th>
                <Th>Status</Th>
                <Th className='manage-postings-text-right-1'>Actions</Th>
              </tr>
            </thead>
            <tbody className='manage-postings-divide-y-1'>
              {filtered.map((posting) => {
                const closed = isDeadlinePassed(posting.deadline);
                const targeted = posting.posting_universities?.length ?? 0;
                return (
                  <tr key={posting.id} className='manage-postings-bg-slate-5070-1'>
                    <Td>
                      <p className='manage-postings-text-sm-1'>{posting.title}</p>
                      <p className='manage-postings-text-xs-1'>{POSTING_TYPE_LABELS[posting.type]}</p>
                    </Td>
                    <Td>
                      <Badge tone={posting.visibility === 'all_universities' ? 'blue' : 'violet'}>
                        {posting.visibility === 'all_universities'
                          ? 'All universities'
                          : `${targeted} universit${targeted === 1 ? 'y' : 'ies'}`}
                      </Badge>
                    </Td>
                    <Td className='manage-postings-text-xs-2'>
                      <span className={closed ? 'manage-postings-text-rose-600-1' : 'manage-postings-text-slate-600-1'}>
                        {posting.deadline ? formatDate(posting.deadline) : 'Rolling'}
                      </span>
                      {closed && posting.status === 'published' ? (
                        <p className='manage-postings-text-11px-1'>Deadline passed</p>
                      ) : null}
                    </Td>
                    <Td>
                      <span className='manage-postings-text-sm-2'>
                        {applications.isLoading ? '…' : applications.isError ? 'Unavailable' : applicationCounts[posting.id] ?? 0}
                      </span>
                    </Td>
                    <Td>
                      <StatusBadge status={posting.status} label={POSTING_STATUS_LABELS[posting.status]} />
                    </Td>
                    <Td>
                      <div className='manage-postings-flex-2'>
                        <Link to={`/postings/${posting.id}`}>
                          <Button size="sm" variant="ghost">
                            <Eye className='manage-postings-h-35-1' /> View
                          </Button>
                        </Link>
                        <Link to={`/manage/postings/${posting.id}/edit`}>
                          <Button size="sm" variant="secondary">
                            <Pencil className='manage-postings-h-35-1' /> Edit
                          </Button>
                        </Link>
                        {posting.status !== 'published' ? (
                          <Button
                            size="sm"
                            onClick={() => changeStatus(posting.id, 'published')}
                            loading={updateStatus.isPending}
                            disabled={updateStatus.isPending}
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
                          disabled={removePosting.isPending}
                        >
                          <Trash2 className='manage-postings-h-35-1' />
                        </Button>
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </Card>
        </>
      )}
    </section>
  );
}
