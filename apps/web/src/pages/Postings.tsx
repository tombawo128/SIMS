import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Banknote,
  Briefcase,
  CalendarClock,
  MapPin,
  Search,
  SlidersHorizontal,
  Wifi,
} from 'lucide-react';
import {
  POSTING_TYPE_LABELS,
  formatDate,
  isDeadlinePassed,
} from '@sims/shared';
import type { PostingType } from '@sims/shared';
import { usePostings } from '@/hooks/usePostings';
import { useAuth } from '@/context/AuthContext';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Select,
  Spinner,
} from '@/components/ui';

const TYPE_OPTIONS: { value: PostingType | ''; label: string }[] = [
  { value: '', label: 'All types' },
  { value: 'internship', label: 'Internships' },
  { value: 'graduate_job', label: 'Graduate jobs' },
  { value: 'part_time', label: 'Part-time' },
];

export function Postings() {
  const { profile } = useAuth();
  const [search, setSearch] = useState('');
  const [type, setType] = useState<PostingType | ''>('');
  const [location, setLocation] = useState('');
  const [remoteOnly, setRemoteOnly] = useState(false);

  const filters = useMemo(
    () => ({ search, type, location, remoteOnly }),
    [search, type, location, remoteOnly],
  );
  const postings = usePostings(filters);
  const items = postings.data ?? [];

  return (
    <div>
      <PageHeader
        title="Opportunities"
        description={
          profile?.role === 'student'
            ? 'Internships, graduate roles, and part-time work from partner companies.'
            : 'Published opportunities visible to your workspace.'
        }
      />

      <Card className="mb-6 p-4 sm:p-5">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-700">
          <SlidersHorizontal className="h-4 w-4 text-slate-400" />
          Filter opportunities
        </div>
        <div className="grid gap-3 md:grid-cols-4">
          <Field label="Search" htmlFor="posting-search" className="md:col-span-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                id="posting-search"
                className="pl-9"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Title, keywords, or description"
              />
            </div>
          </Field>
          <Field label="Type" htmlFor="posting-type">
            <Select
              id="posting-type"
              value={type}
              onChange={(event) => setType(event.target.value as PostingType | '')}
            >
              {TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Location" htmlFor="posting-location">
            <Input
              id="posting-location"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder="City or region"
            />
          </Field>
        </div>
        <label className="mt-3 inline-flex cursor-pointer items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            checked={remoteOnly}
            onChange={(event) => setRemoteOnly(event.target.checked)}
          />
          Remote only
        </label>
      </Card>

      {postings.isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Spinner className="h-6 w-6" />
        </div>
      ) : postings.isError ? (
        <EmptyState title="Could not load opportunities" description="Please refresh the page and try again." />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Briefcase className="h-5 w-5" />}
          title="No opportunities match those filters"
          description="Try clearing the search or widening the filters."
        />
      ) : (
        <>
          <p className="mb-3 text-sm text-slate-500">
            {items.length} opportunit{items.length === 1 ? 'y' : 'ies'}
          </p>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {items.map((posting) => {
              const closed = isDeadlinePassed(posting.deadline);
              return (
                <Link
                  key={posting.id}
                  to={`/postings/${posting.id}`}
                  className="group flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                        {posting.company?.name ?? 'Company'}
                      </p>
                      <h2 className="mt-1 line-clamp-2 text-base font-semibold text-slate-900 group-hover:text-indigo-700">
                        {posting.title}
                      </h2>
                    </div>
                    <Badge tone="blue">{POSTING_TYPE_LABELS[posting.type]}</Badge>
                  </div>

                  <p className="mt-2 line-clamp-2 text-sm text-slate-500">{posting.description}</p>

                  <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5" />
                      {posting.is_remote ? 'Remote' : posting.location || 'Location flexible'}
                    </span>
                    {posting.is_remote ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Wifi className="h-3.5 w-3.5" /> Remote friendly
                      </span>
                    ) : null}
                    {posting.duration_months ? (
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarClock className="h-3.5 w-3.5" />
                        {posting.duration_months} month{posting.duration_months === 1 ? '' : 's'}
                      </span>
                    ) : null}
                    {posting.stipend ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Banknote className="h-3.5 w-3.5" />
                        {posting.stipend}
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-auto flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
                    <span className="text-xs text-slate-500">
                      {posting.deadline
                        ? closed
                          ? 'Applications closed'
                          : `Apply by ${formatDate(posting.deadline)}`
                        : 'Rolling applications'}
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600">
                      View <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </>
      )}

      {profile?.role === 'company_admin' || profile?.role === 'site_supervisor' ? (
        <div className="mt-8 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-5">
          <p className="text-sm font-semibold text-indigo-950">Publishing on behalf of your company?</p>
          <p className="mt-1 text-sm text-indigo-900/70">
            Manage drafts, visibility, and deadlines from your company workspace.
          </p>
          <Link to="/manage/postings" className="mt-3 inline-block">
            <Button size="sm" variant="outline">
              Manage postings <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      ) : null}
    </div>
  );
}
