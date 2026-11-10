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
    downloadCsv(`placements-${new Date().toISOString().slice(0, 10)}.csv`, csv);
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
              <Download className="h-4 w-4" /> Export CSV
            </Button>
          ) : undefined
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          options={TABS.map((option) => ({ key: option.key, label: option.label, count: counts[option.key] ?? 0 }))}
          value={tab}
          onChange={(key) => setTab(key as PlacementStatus | 'all')}
        />
        <div className="relative sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            className="pl-9"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search placements"
          />
        </div>
      </div>

      {placements.isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Spinner className="h-6 w-6" />
        </div>
      ) : placements.isError ? (
        <EmptyState title="Could not load placements" description="Refresh the page and try again." />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<GraduationCap className="h-5 w-5" />}
          title="No placements found"
          description={
            isStudent
              ? 'Once a company accepts your application, your placement will appear here.'
              : 'Accepted applications create placements automatically.'
          }
        />
      ) : isStudent ? (
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map((placement) => (
            <Link
              key={placement.id}
              to={`/placements/${placement.id}`}
              className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    {placement.company?.name}
                  </p>
                  <h2 className="mt-1 text-base font-semibold text-slate-900 group-hover:text-indigo-700">
                    {placement.posting?.title}
                  </h2>
                </div>
                <StatusBadge status={placement.status} label={PLACEMENT_STATUS_LABELS[placement.status]} />
              </div>
              <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-slate-500">
                <CalendarDays className="h-3.5 w-3.5" />
                {formatDate(placement.start_date)} – {formatDate(placement.end_date)}
              </p>
              <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-3 text-xs">
                <div>
                  <p className="text-slate-400">Site supervisor</p>
                  <p className="mt-0.5 font-medium text-slate-700">{placement.site_supervisor?.full_name ?? '—'}</p>
                </div>
                <div>
                  <p className="text-slate-400">Faculty supervisor</p>
                  <p className="mt-0.5 font-medium text-slate-700">
                    {placement.faculty_supervisor?.full_name ?? 'Not assigned'}
                  </p>
                </div>
              </div>
              <p className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-indigo-600">
                Open placement <ArrowRight className="h-3.5 w-3.5" />
              </p>
            </Link>
          ))}
        </div>
      ) : (
        <Card className="overflow-hidden">
          <Table className="border-0">
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
            <tbody className="divide-y divide-slate-100 bg-white">
              {filtered.map((placement) => (
                <tr key={placement.id} className="hover:bg-slate-50/70">
                  <Td>
                    <div className="flex items-center gap-3">
                      <Avatar name={placement.student?.full_name ?? 'Student'} />
                      <div>
                        <p className="text-sm font-medium text-slate-900">{placement.student?.full_name ?? 'Student'}</p>
                        <p className="text-xs text-slate-500">{placement.university?.name}</p>
                      </div>
                    </div>
                  </Td>
                  <Td>
                    <p className="text-sm text-slate-800">{placement.posting?.title}</p>
                    <p className="text-xs text-slate-500">{placement.company?.name}</p>
                  </Td>
                  <Td className="text-xs text-slate-500">
                    {formatDate(placement.start_date)}
                    <br />
                    {formatDate(placement.end_date)}
                  </Td>
                  <Td className="text-xs">
                    <p className="text-slate-700">Site: {placement.site_supervisor?.full_name ?? '—'}</p>
                    <p className="text-slate-500">Faculty: {placement.faculty_supervisor?.full_name ?? 'Not assigned'}</p>
                  </Td>
                  <Td>
                    <StatusBadge status={placement.status} label={PLACEMENT_STATUS_LABELS[placement.status]} />
                  </Td>
                  <Td>
                    {placement.final_grade !== null ? (
                      <span className="text-sm font-semibold text-slate-900">{Number(placement.final_grade)}</span>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </Td>
                  <Td className="text-right">
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
