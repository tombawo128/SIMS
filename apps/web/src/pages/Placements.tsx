import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CalendarDays, Download, GraduationCap, Search } from 'lucide-react';
import {
  PLACEMENT_STATUS_LABELS,
  formatDate,
  toCsv,
} from '@sims/shared';
import type { PlacementStatus } from '@sims/shared';
import { useAuth } from '@/context/AuthContext';
import { usePlacements } from '@/hooks/usePlacements';
import { downloadCsv } from '@/lib/utils';
import {
  Avatar,
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
} from '@/components/ui';
import { StatusBadge } from '@/components/StatusBadge';

const TABS: { key: PlacementStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
];

export function Placements() {
  const { profile } = useAuth();
  const placements = usePlacements();
  const [tab, setTab] = useState<PlacementStatus | 'all'>('all');
  const [search, setSearch] = useState('');

  const items = placements.data ?? [];
  const isCoordinator = profile?.role === 'coordinator';
  const isStudent = profile?.role === 'student';

  const counts = useMemo(() => {
    const result: Record<string, number> = { all: items.length };
    for (const placement of items) {
      result[placement.status] = (result[placement.status] ?? 0) + 1;
    }
    return result;
  }, [items]);

  const filtered = items.filter((placement) => {
    if (tab !== 'all' && placement.status !== tab) return false;
    const term = search.trim().toLowerCase();
    if (!term) return true;
    return [placement.student?.full_name, placement.posting?.title, placement.company?.name]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(term));
  });

  const exportCsv = () => {
    const csv = toCsv(
      ['Student', 'Student ID', 'University', 'Company', 'Posting', 'Site supervisor', 'Faculty supervisor', 'Start', 'End', 'Status', 'Final grade'],
      items.map((placement) => [
        placement.student?.full_name,
        placement.student?.student_profile?.student_id,
        placement.university?.name,
        placement.company?.name,
        placement.posting?.title,
        placement.site_supervisor?.full_name,
        placement.faculty_supervisor?.full_name,
        placement.start_date,
        placement.end_date,
        PLACEMENT_STATUS_LABELS[placement.status],
        placement.final_grade,
      ]),
    );
    const today = new Date();
    const dateStamp = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    downloadCsv(`placements-${dateStamp}.csv`, csv);
  };

  return (
    <div>
      <PageHeader
        title={isStudent ? 'My placement' : 'Placements'}
        description={
          isStudent
            ? 'Your internship details, supervisors, logs, and evaluations.'
            : 'Every placement you can access, with supervisors and grades.'
        }
        actions={
          isCoordinator ? (
            <Button variant="secondary" onClick={exportCsv} disabled={!items.length}>
              <Download className='placements-h-4-1' /> Export CSV
            </Button>
          ) : undefined
        }
      />

      <div className='placements-mb-4-1'>
        <Tabs
          options={TABS.map((option) => ({ key: option.key, label: option.label, count: counts[option.key] ?? 0 }))}
          value={tab}
          onChange={(key) => setTab(key as PlacementStatus | 'all')}
        />
        <div className='placements-relative-1'>
          <Search className='placements-pointer-events-none-1' />
          <Input
            className='placements-pl-9-1'
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search placements"
          />
        </div>
      </div>

      {placements.isLoading ? (
        <div className='placements-flex-1'>
          <Spinner className='placements-h-6-1' />
        </div>
      ) : placements.isError ? (
        <EmptyState
          title="Could not load placements"
          description="Your placement records could not be retrieved. Try again."
          action={<Button size="sm" variant="secondary" onClick={() => void placements.refetch()} loading={placements.isFetching}>Retry</Button>}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<GraduationCap className='placements-h-5-1' />}
          title="No placements found"
          description={
            isStudent
              ? 'Once a company accepts your application, your placement will appear here.'
              : 'Accepted applications create placements automatically.'
          }
        />
      ) : isStudent ? (
        <div className='placements-grid-1'>
          {filtered.map((placement) => (
            <Link
              key={placement.id}
              to={`/placements/${placement.id}`}
              className='group placements-rounded-2xl-1'
            >
              <div className='placements-flex-2'>
                <div>
                  <p className='placements-text-xs-1'>
                    {placement.company?.name}
                  </p>
                  <h2 className='placements-mt-1-1'>
                    {placement.posting?.title}
                  </h2>
                </div>
                <StatusBadge status={placement.status} label={PLACEMENT_STATUS_LABELS[placement.status]} />
              </div>
              <p className='placements-mt-3-1'>
                <CalendarDays className='placements-h-35-1' />
                {formatDate(placement.start_date)} – {formatDate(placement.end_date)}
              </p>
              <div className='placements-mt-4-1'>
                <div>
                  <p className='placements-text-slate-400-1'>Site supervisor</p>
                  <p className='placements-mt-05-1'>{placement.site_supervisor?.full_name ?? '—'}</p>
                </div>
                <div>
                  <p className='placements-text-slate-400-1'>Faculty supervisor</p>
                  <p className='placements-mt-05-1'>
                    {placement.faculty_supervisor?.full_name ?? 'Not assigned'}
                  </p>
                </div>
              </div>
              <p className='placements-mt-4-2'>
                Open placement <ArrowRight className='placements-h-35-1' />
              </p>
            </Link>
          ))}
        </div>
      ) : (
        <Card className='placements-overflow-hidden-1'>
          <Table className='placements-border-0-1'>
            <thead>
              <tr>
                <Th>Student</Th>
                <Th>Placement</Th>
                <Th>Dates</Th>
                <Th>Supervisors</Th>
                <Th>Status</Th>
                <Th>Grade</Th>
                <Th />
              </tr>
            </thead>
            <tbody className='placements-divide-y-1'>
              {filtered.map((placement) => (
                <tr key={placement.id} className='placements-bg-slate-5070-1'>
                  <Td>
                    <div className='placements-flex-3'>
                      <Avatar name={placement.student?.full_name ?? 'Student'} />
                      <div>
                        <p className='placements-text-sm-1'>{placement.student?.full_name ?? 'Student'}</p>
                        <p className='placements-text-xs-2'>{placement.university?.name}</p>
                      </div>
                    </div>
                  </Td>
                  <Td>
                    <p className='placements-text-sm-2'>{placement.posting?.title}</p>
                    <p className='placements-text-xs-2'>{placement.company?.name}</p>
                  </Td>
                  <Td className='placements-text-xs-2'>
                    {formatDate(placement.start_date)}
                    <br />
                    {formatDate(placement.end_date)}
                  </Td>
                  <Td className='placements-text-xs-3'>
                    <p className='placements-text-slate-700-1'>Site: {placement.site_supervisor?.full_name ?? '—'}</p>
                    <p className='placements-text-slate-500-1'>Faculty: {placement.faculty_supervisor?.full_name ?? 'Not assigned'}</p>
                  </Td>
                  <Td>
                    <StatusBadge status={placement.status} label={PLACEMENT_STATUS_LABELS[placement.status]} />
                  </Td>
                  <Td>
                    {placement.final_grade !== null ? (
                      <span className='placements-text-sm-3'>{Number(placement.final_grade)}</span>
                    ) : (
                      <span className='placements-text-xs-4'>—</span>
                    )}
                  </Td>
                  <Td className='placements-text-right-1'>
                    <Link to={`/placements/${placement.id}`}>
                      <Button size="sm" variant="secondary">
                        Open
                      </Button>
                    </Link>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}
    </div>
  );
}
