import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Check,
  Download,
  Eye,
  FileText,
  Mail,
  UserRound,
  X,
} from 'lucide-react';
import {
  APPLICATION_STATUS_LABELS,
  POSTING_TYPE_LABELS,
  formatDate,
  formatDateTime,
  toCsv,
} from '@sims/shared';
import type { Application, ApplicationStatus } from '@sims/shared';
import { useAuth } from '@/context/AuthContext';
import { useApplications, useAcceptApplication, useReviewApplication, useWithdrawApplication } from '@/hooks/useApplications';
import { useCompanyTeam } from '@/hooks/useLookups';
import { downloadCsv, errorMessage } from '@/lib/utils';
import { openDocument } from '@/lib/storage';
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  Select,
  Spinner,
  Table,
  Tabs,
  Td,
  Textarea,
  Th,
  useToast,
} from '@/components/ui';
import { StatusBadge } from '@/components/StatusBadge';

const STATUS_TABS: { key: ApplicationStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'submitted', label: 'Submitted' },
  { key: 'under_review', label: 'Under review' },
  { key: 'shortlisted', label: 'Shortlisted' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'withdrawn', label: 'Withdrawn' },
];

const ACTIVE_STATUSES: ApplicationStatus[] = ['submitted', 'under_review', 'shortlisted'];

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function defaultDates() {
  const start = new Date();
  const end = new Date();
  end.setMonth(end.getMonth() + 3);
  return { start: isoDate(start), end: isoDate(end) };
}

export function Applications() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const applications = useApplications();
  const review = useReviewApplication();
  const accept = useAcceptApplication();
  const withdraw = useWithdrawApplication();
  const team = useCompanyTeam(profile?.company_id);

  const [tab, setTab] = useState<ApplicationStatus | 'all'>('all');
  const [selected, setSelected] = useState<Application | null>(null);
  const [accepting, setAccepting] = useState<Application | null>(null);
  const [rejecting, setRejecting] = useState<Application | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [supervisorId, setSupervisorId] = useState('');
  const [dates, setDates] = useState(defaultDates);
  const [actionError, setActionError] = useState('');

  const isStudent = profile?.role === 'student';
  const isCompany = profile?.role === 'company_admin' || profile?.role === 'site_supervisor';
  const isCoordinator = profile?.role === 'coordinator';

  const items = applications.data ?? [];
  const counts = useMemo(() => {
    const result: Record<string, number> = { all: items.length };
    for (const application of items) {
      result[application.status] = (result[application.status] ?? 0) + 1;
    }
    return result;
  }, [items]);

  const filtered = tab === 'all' ? items : items.filter((application) => application.status === tab);

  const openAccept = (application: Application) => {
    const supervisors = (team.data ?? []).filter(
      (member) => member.role === 'site_supervisor' || member.role === 'company_admin',
    );
    setActionError('');
    setSupervisorId(supervisors[0]?.id ?? '');
    setDates(defaultDates());
    setAccepting(application);
  };

  const doReview = async (application: Application, status: 'under_review' | 'shortlisted') => {
    try {
      await review.mutateAsync({ applicationId: application.id, status });
      toast({
        title: status === 'shortlisted' ? 'Application shortlisted' : 'Moved to review',
        tone: 'success',
      });
    } catch (caught) {
      toast({ title: 'Could not update application', description: errorMessage(caught), tone: 'error' });
    }
  };

  const doReject = async () => {
    if (!rejecting) return;
    setActionError('');
    try {
      await review.mutateAsync({
        applicationId: rejecting.id,
        status: 'rejected',
        reason: rejectReason.trim() || undefined,
      });
      toast({ title: 'Application rejected', tone: 'info' });
      setRejecting(null);
      setRejectReason('');
    } catch (caught) {
      setActionError(errorMessage(caught));
    }
  };

  const doAccept = async () => {
    if (!accepting) return;
    setActionError('');
    if (!supervisorId) {
      setActionError('Select a site supervisor for the placement.');
      return;
    }
    if (!dates.start || !dates.end || dates.end <= dates.start) {
      setActionError('The end date must be after the start date.');
      return;
    }
    try {
      await accept.mutateAsync({
        applicationId: accepting.id,
        siteSupervisorId: supervisorId,
        startDate: dates.start,
        endDate: dates.end,
      });
      toast({
        title: 'Placement created',
        description: 'The student has been notified and the placement is active.',
        tone: 'success',
      });
      setAccepting(null);
    } catch (caught) {
      setActionError(errorMessage(caught));
    }
  };

  const exportCsv = () => {
    const csv = toCsv(
      ['Student', 'Email', 'Student ID', 'Program', 'Opportunity', 'Company', 'University', 'Status', 'Applied'],
      items.map((application) => [
        application.student?.full_name,
        application.student?.email,
        application.student?.student_profile?.student_id,
        application.student?.student_profile?.program,
        application.posting?.title,
        application.company?.name,
        application.university?.name,
        APPLICATION_STATUS_LABELS[application.status],
        application.created_at,
      ]),
    );
    downloadCsv(`applications-${isoDate(new Date())}.csv`, csv);
  };

  return (
    <div>
      <PageHeader
        title={isStudent ? 'My applications' : 'Applications'}
        description={
          isStudent
            ? 'Track every application from submission to decision.'
            : isCoordinator
              ? 'Applications submitted by students at your university.'
              : 'Review candidates who applied to your company.'
        }
        actions={
          isCoordinator ? (
            <Button variant="secondary" onClick={exportCsv} disabled={!items.length}>
              <Download className='applications-h-4-1' /> Export CSV
            </Button>
          ) : undefined
        }
      />

      <Tabs
        className='applications-mb-5-1'
        options={STATUS_TABS.map((option) => ({
          key: option.key,
          label: option.label,
          count: counts[option.key] ?? 0,
        }))}
        value={tab}
        onChange={(key) => setTab(key as ApplicationStatus | 'all')}
      />

      {applications.isLoading ? (
        <div className='applications-flex-1'>
          <Spinner className='applications-h-6-1' />
        </div>
      ) : applications.isError ? (
        <EmptyState title="Could not load applications" description="Refresh the page and try again." />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<FileText className='applications-h-5-1' />}
          title="No applications here"
          description={isStudent ? 'Browse opportunities and submit your first application.' : 'Applications will appear as students apply.'}
          action={
            isStudent ? (
              <Link to="/postings">
                <Button size="sm">Browse opportunities</Button>
              </Link>
            ) : undefined
          }
        />
      ) : (
        <Card className='applications-overflow-hidden-1'>
          <Table className='applications-border-0-1'>
            <thead>
              <tr>
                <Th>{isStudent ? 'Opportunity' : 'Applicant'}</Th>
                <Th>Context</Th>
                <Th>Status</Th>
                <Th>Applied</Th>
                <Th className='applications-text-right-1'>Actions</Th>
              </tr>
            </thead>
            <tbody className='applications-divide-y-1'>
              {filtered.map((application) => (
                <tr key={application.id} className='applications-bg-slate-5070-1'>
                  <Td>
                    <div className='applications-flex-2'>
                      <Avatar name={isStudent ? application.posting?.title ?? 'Role' : application.student?.full_name ?? 'Applicant'} />
                      <div className='applications-min-w-0-1'>
                        <p className='applications-truncate-1'>
                          {isStudent ? application.posting?.title ?? 'Opportunity' : application.student?.full_name ?? 'Applicant'}
                        </p>
                        <p className='applications-truncate-2'>
                          {isStudent ? application.company?.name : application.student?.email}
                        </p>
                      </div>
                    </div>
                  </Td>
                  <Td>
                    <p className='applications-text-xs-1'>
                      {isStudent ? application.university?.name : application.posting?.title}
                    </p>
                    <p className='applications-text-11px-1'>
                      {application.posting ? POSTING_TYPE_LABELS[application.posting.type] : ''}
                    </p>
                  </Td>
                  <Td>
                    <StatusBadge status={application.status} label={APPLICATION_STATUS_LABELS[application.status]} />
                  </Td>
                  <Td className='applications-text-xs-2'>{formatDate(application.created_at)}</Td>
                  <Td>
                    <div className='applications-flex-3'>
                      <Button size="sm" variant="ghost" onClick={() => setSelected(application)}>
                        <Eye className='applications-h-35-1' /> View
                      </Button>

                      {isStudent && ACTIVE_STATUSES.includes(application.status) ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          loading={withdraw.isPending}
                          onClick={async () => {
                            try {
                              await withdraw.mutateAsync(application.id);
                              toast({ title: 'Application withdrawn', tone: 'info' });
                            } catch (caught) {
                              toast({ title: 'Could not withdraw', description: errorMessage(caught), tone: 'error' });
                            }
                          }}
                        >
                          Withdraw
                        </Button>
                      ) : null}

                      {isCompany && ACTIVE_STATUSES.includes(application.status) ? (
                        <>
                          {application.status === 'submitted' ? (
                            <Button size="sm" variant="secondary" onClick={() => doReview(application, 'under_review')}>
                              Review
                            </Button>
                          ) : null}
                          {application.status !== 'shortlisted' ? (
                            <Button size="sm" variant="secondary" onClick={() => doReview(application, 'shortlisted')}>
                              Shortlist
                            </Button>
                          ) : null}
                          <Button size="sm" variant="outline" onClick={() => openAccept(application)}>
                            <Check className='applications-h-35-1' /> Accept
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => {
                              setRejecting(application);
                              setRejectReason('');
                              setActionError('');
                            }}
                          >
                            <X className='applications-h-35-1' /> Reject
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}

      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title="Application details"
        description={selected ? `${selected.posting?.title ?? 'Opportunity'} · ${selected.company?.name ?? ''}` : undefined}
        size="lg"
        footer={
          <Button variant="secondary" onClick={() => setSelected(null)}>
            Close
          </Button>
        }
      >
        {selected ? (
          <div className='applications-space-y-5-1'>
            <div className='applications-grid-1'>
              <Info label="Applicant" value={selected.student?.full_name ?? '—'} />
              <Info label="Email" value={selected.student?.email ?? '—'} />
              <Info label="Student ID" value={selected.student?.student_profile?.student_id ?? '—'} />
              <Info
                label="Program"
                value={
                  selected.student?.student_profile
                    ? `${selected.student.student_profile.program ?? 'Program'} · Year ${selected.student.student_profile.year ?? '—'}`
                    : '—'
                }
              />
              <Info label="University" value={selected.university?.name ?? '—'} />
              <Info label="Applied" value={formatDateTime(selected.created_at)} />
            </div>

            <div>
              <p className='applications-mb-15-1'>Cover letter</p>
              <div className='applications-max-h-64-1'>
                {selected.cover_letter || 'No cover letter provided.'}
              </div>
            </div>

            {selected.student?.student_profile?.skills?.length ? (
              <div>
                <p className='applications-mb-15-1'>Skills</p>
                <div className='applications-flex-4'>
                  {selected.student.student_profile.skills.map((skill) => (
                    <Badge key={skill} tone="blue">
                      {skill}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null}

            {selected.rejection_reason ? (
              <Alert tone="warning" title="Decision note">
                {selected.rejection_reason}
              </Alert>
            ) : null}

            <div className='applications-flex-5'>
              {selected.cv_path ? (
                <Button
                  variant="secondary"
                  onClick={async () => {
                    try {
                      await openDocument('cvs', selected.cv_path!);
                    } catch (caught) {
                      toast({ title: 'Could not open CV', description: errorMessage(caught), tone: 'error' });
                    }
                  }}
                >
                  <FileText className='applications-h-4-1' /> Open CV
                </Button>
              ) : (
                <p className='applications-text-xs-2'>No CV attached to this application.</p>
              )}
              <a href={`mailto:${selected.student?.email ?? ''}`}>
                <Button variant="ghost">
                  <Mail className='applications-h-4-1' /> Email applicant
                </Button>
              </a>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(accepting)}
        onClose={() => setAccepting(null)}
        title="Accept application"
        description={
          accepting
            ? `Create a placement for ${accepting.student?.full_name ?? 'this student'} at ${accepting.company?.name ?? 'your company'}.`
            : undefined
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setAccepting(null)}>
              Cancel
            </Button>
            <Button onClick={doAccept} loading={accept.isPending}>
              Accept & create placement
            </Button>
          </>
        }
      >
        <div className='applications-space-y-4-1'>
          {actionError ? <Alert tone="danger">{actionError}</Alert> : null}
          <Alert tone="info">
            Accepting this application closes the student's other open applications and notifies the student, site
            supervisor, and university coordinator.
          </Alert>

          <Field label="Site supervisor" htmlFor="site-supervisor" required>
            <Select
              id="site-supervisor"
              value={supervisorId}
              onChange={(event) => setSupervisorId(event.target.value)}
            >
              <option value="">Select a supervisor</option>
              {(team.data ?? [])
                .filter((member) => member.role === 'site_supervisor' || member.role === 'company_admin')
                .map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.full_name} ({member.role === 'company_admin' ? 'Company admin' : 'Site supervisor'})
                  </option>
                ))}
            </Select>
          </Field>

          <div className='applications-grid-2'>
            <Field label="Start date" htmlFor="start-date" required>
              <Input
                id="start-date"
                type="date"
                value={dates.start}
                onChange={(event) => setDates((current) => ({ ...current, start: event.target.value }))}
              />
            </Field>
            <Field label="End date" htmlFor="end-date" required>
              <Input
                id="end-date"
                type="date"
                value={dates.end}
                onChange={(event) => setDates((current) => ({ ...current, end: event.target.value }))}
              />
            </Field>
          </div>
        </div>
      </Modal>

      <Modal
        open={Boolean(rejecting)}
        onClose={() => setRejecting(null)}
        title="Reject application"
        description={rejecting ? `${rejecting.student?.full_name ?? 'Applicant'} · ${rejecting.posting?.title ?? ''}` : undefined}
        footer={
          <>
            <Button variant="secondary" onClick={() => setRejecting(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={doReject} loading={review.isPending}>
              Reject application
            </Button>
          </>
        }
      >
        <div className='applications-space-y-4-1'>
          {actionError ? <Alert tone="danger">{actionError}</Alert> : null}
          <Field
            label="Reason shared with the student"
            htmlFor="rejection-reason"
            hint="Optional, but helpful feedback."
          >
            <Textarea
              id="rejection-reason"
              rows={4}
              value={rejectReason}
              onChange={(event) => setRejectReason(event.target.value)}
              placeholder="We have filled this role with a candidate whose experience better matches…"
            />
          </Field>
        </div>
      </Modal>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className='applications-text-xs-3'>{label}</p>
      <p className='applications-mt-05-1'>
        <UserRound className='applications-h-35-2' />
        {value}
      </p>
    </div>
  );
}
