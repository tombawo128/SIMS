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
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
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

  const hasActiveFilters = Boolean(search.trim() || type || location.trim() || remoteOnly);
  const filters = useMemo(
    () => ({ search, type, location, remoteOnly }),
    [search, type, location, remoteOnly],
  );
  const postings = usePostings(filters);
  const items = postings.data ?? [];

  return (
    <section className="opportunities-page">
      <section className="page-hero page-hero--opportunities">
        <div><span className="page-hero__eyebrow">CAREER OPPORTUNITIES</span><h1>Find your next opportunity.</h1><p>{profile?.role === 'student' ? 'Explore internships, graduate roles and part-time work from partner companies.' : 'Explore published opportunities available to your workspace.'}</p></div>
        <div className="page-hero__aside"><strong>{items.length}</strong><span>matching opportunities</span><small>Updated from your workspace filters</small></div>
      </section>

      {profile?.role === 'student' && !profile.university_id ? <Alert tone="warning" title="University not linked">Your student account is not linked to a university, so university-restricted opportunities cannot be shown. Contact your platform administrator to correct your account.</Alert> : null}
      <Card className='postings-mb-6-1 opportunities-filters'>
        <div className='postings-mb-3-1'>
          <SlidersHorizontal className='postings-h-4-1' />
          Filter opportunities
        </div>
        <div className='postings-grid-1'>
          <Field label="Search" htmlFor="posting-search" className='postings-col-span-2-1'>
            <div className='postings-relative-1'>
              <Search className='postings-pointer-events-none-1' />
              <Input
                id="posting-search"
                className='postings-pl-9-1'
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
        <label className='postings-mt-3-1'>
          <input
            type="checkbox"
            className='postings-h-4-2'
            checked={remoteOnly}
            onChange={(event) => setRemoteOnly(event.target.checked)}
          />
          Remote only
        </label>
      </Card>

      {postings.isLoading ? (
        <div className='postings-flex-1'>
          <Spinner className='postings-h-6-1' />
        </div>
      ) : postings.isError ? (
        <EmptyState
          title="Could not load opportunities"
          description="Opportunities could not be retrieved. Try again."
          action={<Button size="sm" variant="secondary" onClick={() => void postings.refetch()} loading={postings.isFetching}>Retry</Button>}
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Briefcase className='postings-h-5-1' />}
          title={profile?.role === 'student' && !hasActiveFilters ? 'No published opportunities for your university yet' : 'No opportunities match those filters'}
          description={profile?.role === 'student' && !hasActiveFilters ? 'Company opportunities appear here after a company publishes a posting and makes it available to your university. Check back when new internships are published.' : 'Try clearing the search or widening the filters.'}
        />
      ) : (
        <>
          <p className='postings-mb-3-2'>
            {items.length} opportunit{items.length === 1 ? 'y' : 'ies'}
          </p>
          <div className='postings-grid-2 opportunities-grid'>
            {items.map((posting) => {
              const closed = isDeadlinePassed(posting.deadline);
              return (
                <Link
                  key={posting.id}
                  to={`/postings/${posting.id}`}
                  className='group postings-flex-2'
                >
                  <div className='postings-flex-3'>
                    <div>
                      <p className='postings-text-xs-1'>
                        {posting.company?.name ?? 'Company'}
                      </p>
                      <h2 className='postings-mt-1-1'>
                        {posting.title}
                      </h2>
                    </div>
                    <Badge tone="blue">{POSTING_TYPE_LABELS[posting.type]}</Badge>
                  </div>

                  <p className='postings-mt-2-1'>{posting.description}</p>

                  <div className='postings-mt-4-1'>
                    <span className='postings-inline-flex-1'>
                      <MapPin className='postings-h-35-1' />
                      {posting.is_remote ? 'Remote' : posting.location || 'Location flexible'}
                    </span>
                    {posting.is_remote ? (
                      <span className='postings-inline-flex-1'>
                        <Wifi className='postings-h-35-1' /> Remote friendly
                      </span>
                    ) : null}
                    {posting.duration_months ? (
                      <span className='postings-inline-flex-1'>
                        <CalendarClock className='postings-h-35-1' />
                        {posting.duration_months} month{posting.duration_months === 1 ? '' : 's'}
                      </span>
                    ) : null}
                    {posting.stipend ? (
                      <span className='postings-inline-flex-1'>
                        <Banknote className='postings-h-35-1' />
                        {posting.stipend}
                      </span>
                    ) : null}
                  </div>

                  <div className='postings-mt-auto-1'>
                    <span className='postings-text-xs-2'>
                      {posting.deadline
                        ? closed
                          ? 'Applications closed'
                          : `Apply by ${formatDate(posting.deadline)}`
                        : 'Rolling applications'}
                    </span>
                    <span className='postings-inline-flex-2'>
                      View <ArrowRight className='postings-h-35-1' />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </>
      )}

      {profile?.role === 'company_admin' || profile?.role === 'site_supervisor' ? (
        <div className='postings-mt-8-1'>
          <p className='postings-text-sm-1'>Publishing on behalf of your company?</p>
          <p className='postings-mt-1-2'>
            Manage drafts, visibility, and deadlines from your company workspace.
          </p>
          <Link to="/manage/postings" className='postings-mt-3-2'>
            <Button size="sm" variant="outline">
              Manage postings <ArrowRight className='postings-h-35-1' />
            </Button>
          </Link>
        </div>
      ) : null}
    </section>
  );
}
