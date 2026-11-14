import { useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarDays,
  ClipboardList,
  FileText,
  GraduationCap,
  MessageSquare,
  Paperclip,
  Plus,
  Send,
  Star,
  Trash2,
  Upload,
  UserCheck,
  UserRound,
} from 'lucide-react';
import {
  CHECK_IN_TYPE_LABELS,
  EVALUATION_TYPE_LABELS,
  LOG_STATUS_LABELS,
  PLACEMENT_STATUS_LABELS,
  POSTING_TYPE_LABELS,
  RUBRIC_CRITERIA,
  averageScore,
  formatDate,
  formatDateTime,
} from '@sims/shared';
import type {
  CheckInType,
  Evaluation,
  EvaluationRole,
  EvaluationType,
  WeeklyLog,
} from '@sims/shared';
import { useAuth } from '@/context/AuthContext';
import {
  useAddCheckIn,
  useAddDocument,
  useAssignFaculty,
  useDeleteDocument,
  usePlacement,
  useRecordGrade,
  useReviewWeeklyLog,
  useSubmitEvaluation,
  useSubmitWeeklyLog,
  useUpsertWeeklyLog,
} from '@/hooks/usePlacements';
import { useFacultyList } from '@/hooks/useLookups';
import { uploadReport, openDocument } from '@/lib/storage';
import { errorMessage, formatHours } from '@/lib/utils';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  Select,
  Spinner,
  Tabs,
  Textarea,
  useToast,
} from '@/components/ui';
import { StatusBadge } from '@/components/StatusBadge';
import { DailyReportsPanel } from '@/components/DailyReportsPanel';

type TabKey = 'overview' | 'daily' | 'logs' | 'evaluations' | 'checkins' | 'documents';

const DEFAULT_RUBRIC: Record<string, number> = {
  professionalism: 4,
  technical_skill: 4,
  communication: 4,
  initiative: 4,
};

function nowLocalInput() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

export function PlacementDetail() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const { toast } = useToast();
  const placementQuery = usePlacement(id);

  const upsertLog = useUpsertWeeklyLog();
  const submitLog = useSubmitWeeklyLog();
  const reviewLog = useReviewWeeklyLog();
  const submitEvaluation = useSubmitEvaluation();
  const addCheckIn = useAddCheckIn();
  const assignFaculty = useAssignFaculty();
  const recordGrade = useRecordGrade();
  const addDocument = useAddDocument();
  const deleteDocument = useDeleteDocument();
  const facultyList = useFacultyList(
    profile?.role === 'coordinator' ? profile.university_id : undefined,
  );

  const [tab, setTab] = useState<TabKey>('overview');
  const [actionError, setActionError] = useState('');

  const [logOpen, setLogOpen] = useState(false);
  const [editingLog, setEditingLog] = useState<WeeklyLog | null>(null);
  const [logForm, setLogForm] = useState({ weekNumber: '1', hours: '0', tasks: '', outcomes: '' });
  const [logSaving, setLogSaving] = useState(false);

  const [reviewingLog, setReviewingLog] = useState<WeeklyLog | null>(null);
  const [reviewDecision, setReviewDecision] = useState<'approved' | 'needs_revision'>('approved');
  const [reviewComment, setReviewComment] = useState('');

  const [evaluationOpen, setEvaluationOpen] = useState(false);
  const [evaluationType, setEvaluationType] = useState<EvaluationType>('final');
  const [rubric, setRubric] = useState<Record<string, number>>(DEFAULT_RUBRIC);
  const [evaluationComments, setEvaluationComments] = useState('');

  const [checkInOpen, setCheckInOpen] = useState(false);
  const [checkInForm, setCheckInForm] = useState<{ type: CheckInType; notes: string; occurredAt: string }>({
    type: 'call',
    notes: '',
    occurredAt: nowLocalInput(),
  });

  const [assignOpen, setAssignOpen] = useState(false);
  const [facultyId, setFacultyId] = useState('');

  const [gradeOpen, setGradeOpen] = useState(false);
  const [gradeValue, setGradeValue] = useState('');
  const [gradeNotes, setGradeNotes] = useState('');

  const [uploading, setUploading] = useState(false);
  const reportInput = useRef<HTMLInputElement>(null);

  const placement = placementQuery.data;

  const sortedLogs = useMemo(
    () => [...(placement?.weekly_logs ?? [])].sort((a, b) => a.week_number - b.week_number),
    [placement],
  );

  if (placementQuery.isLoading) {
    return (
      <div className='placement-detail-flex-1'>
        <Spinner className='placement-detail-h-6-1' />
      </div>
    );
  }

  if (placementQuery.isError || !placement) {
    return (
      <EmptyState
        title="Placement unavailable"
        description="This placement does not exist or is outside your workspace."
        action={
          <Link to="/placements">
            <Button variant="secondary">Back to placements</Button>
          </Link>
        }
      />
    );
  }

  const isStudent = placement.student_id === profile?.id;
  const isSiteSupervisor = placement.site_supervisor_id === profile?.id;
  const isFaculty = placement.faculty_supervisor_id === profile?.id;
  const isCompanyAdmin = profile?.role === 'company_admin' && profile.company_id === placement.company_id;
  const isCoordinator = profile?.role === 'coordinator' && profile.university_id === placement.university_id;

  const facultyOptions = (facultyList.data ?? []).filter((faculty) =>
    !placement.student?.department || faculty.department?.trim().toLowerCase() === placement.student.department.trim().toLowerCase(),
  );

  const canReviewLogs = isFaculty;
  const canEvaluateSite = isSiteSupervisor || isCompanyAdmin;
  const canEvaluateFaculty = isFaculty;
  const canSubmitEvaluation = canEvaluateSite || canEvaluateFaculty;
  const canGrade = isFaculty;
  const evaluatorRole: EvaluationRole = canEvaluateSite ? 'site_supervisor' : 'faculty_supervisor';

  const approvedLogs = sortedLogs.filter((log) => log.status === 'approved').length;
  const nextWeek = sortedLogs.length ? Math.max(...sortedLogs.map((log) => log.week_number)) + 1 : 1;

  const openLogModal = (log?: WeeklyLog) => {
    setActionError('');
    setEditingLog(log ?? null);
    setLogForm({
      weekNumber: String(log?.week_number ?? nextWeek),
      hours: log ? String(log.hours) : '0',
      tasks: log?.tasks ?? '',
      outcomes: log?.learning_outcomes ?? '',
    });
    setLogOpen(true);
  };

  const saveLog = async (andSubmit: boolean) => {
    setActionError('');
    const weekNumber = Number(logForm.weekNumber);
    const hours = Number(logForm.hours);
    if (!Number.isInteger(weekNumber) || weekNumber < 1) {
      setActionError('Enter a valid week number.');
      return;
    }
    if (!Number.isFinite(hours) || hours < 0) {
      setActionError('Enter the hours worked.');
      return;
    }
    if (andSubmit && (!hours || !logForm.tasks.trim())) {
      setActionError('Hours and tasks are required before submitting.');
      return;
    }

    setLogSaving(true);
    try {
      const logId = await upsertLog.mutateAsync({
        placementId: placement.id,
        weekNumber,
        hours,
        tasks: logForm.tasks.trim(),
        learningOutcomes: logForm.outcomes.trim(),
      });
      if (andSubmit) {
        await submitLog.mutateAsync({ logId, placementId: placement.id });
        toast({ title: `Week ${weekNumber} submitted`, tone: 'success' });
      } else {
        toast({ title: `Week ${weekNumber} saved as draft`, tone: 'info' });
      }
      setLogOpen(false);
    } catch (caught) {
      setActionError(errorMessage(caught));
    } finally {
      setLogSaving(false);
    }
  };

  const submitExistingLog = async (log: WeeklyLog) => {
    try {
      await submitLog.mutateAsync({ logId: log.id, placementId: placement.id });
      toast({ title: `Week ${log.week_number} submitted`, tone: 'success' });
    } catch (caught) {
      toast({ title: 'Could not submit log', description: errorMessage(caught), tone: 'error' });
    }
  };

  const doReviewLog = async () => {
    if (!reviewingLog) return;
    setActionError('');
    try {
      await reviewLog.mutateAsync({
        logId: reviewingLog.id,
        placementId: placement.id,
        decision: reviewDecision,
        comment: reviewComment.trim() || undefined,
      });
      toast({
        title: reviewDecision === 'approved' ? 'Log approved' : 'Revision requested',
        tone: reviewDecision === 'approved' ? 'success' : 'info',
      });
      setReviewingLog(null);
      setReviewComment('');
    } catch (caught) {
      setActionError(errorMessage(caught));
    }
  };

  const evaluationFor = (type: EvaluationType): Evaluation | undefined =>
    (placement.evaluations ?? []).find(
      (evaluation) => evaluation.evaluator_role === evaluatorRole && evaluation.type === type,
    );

  const openEvaluation = () => {
    setActionError('');
    const existing = evaluationFor(evaluationType);
    setRubric(existing?.rubric_scores ?? DEFAULT_RUBRIC);
    setEvaluationComments(existing?.comments ?? '');
    setEvaluationOpen(true);
  };

  const changeEvaluationType = (type: EvaluationType) => {
    setEvaluationType(type);
    const existing = evaluationFor(type);
    setRubric(existing?.rubric_scores ?? DEFAULT_RUBRIC);
    setEvaluationComments(existing?.comments ?? '');
  };

  const doSubmitEvaluation = async () => {
    setActionError('');
    try {
      await submitEvaluation.mutateAsync({
        placementId: placement.id,
        type: evaluationType,
        rubric,
        comments: evaluationComments.trim(),
        overall: averageScore(rubric),
      });
      toast({ title: `${EVALUATION_TYPE_LABELS[evaluationType]} evaluation saved`, tone: 'success' });
      setEvaluationOpen(false);
    } catch (caught) {
      setActionError(errorMessage(caught));
    }
  };

  const doAddCheckIn = async () => {
    setActionError('');
    if (!checkInForm.notes.trim()) {
      setActionError('Add notes for this check-in.');
      return;
    }
    try {
      await addCheckIn.mutateAsync({
        placementId: placement.id,
        type: checkInForm.type,
        notes: checkInForm.notes.trim(),
        occurredAt: new Date(checkInForm.occurredAt).toISOString(),
      });
      toast({ title: 'Check-in logged', tone: 'success' });
      setCheckInOpen(false);
      setCheckInForm({ type: 'call', notes: '', occurredAt: nowLocalInput() });
    } catch (caught) {
      setActionError(errorMessage(caught));
    }
  };

  const doAssignFaculty = async () => {
    setActionError('');
    if (!facultyId) {
      setActionError('Select a faculty supervisor.');
      return;
    }
    try {
      await assignFaculty.mutateAsync({ placementId: placement.id, facultyId });
      toast({ title: 'Faculty supervisor assigned', tone: 'success' });
      setAssignOpen(false);
    } catch (caught) {
      setActionError(errorMessage(caught));
    }
  };

  const doRecordGrade = async () => {
    setActionError('');
    const grade = Number(gradeValue);
    if (!Number.isFinite(grade) || grade < 0 || grade > 100) {
      setActionError('Enter a grade between 0 and 100.');
      return;
    }
    try {
      await recordGrade.mutateAsync({
        placementId: placement.id,
        grade,
        notes: gradeNotes.trim(),
      });
      toast({ title: 'Final grade recorded', tone: 'success' });
      setGradeOpen(false);
    } catch (caught) {
      setActionError(errorMessage(caught));
    }
  };

  const uploadReportFile = async (file: File) => {
    if (!profile) return;
    setUploading(true);
    try {
      const path = await uploadReport(file, placement.id, profile.id);
      await addDocument.mutateAsync({
        placementId: placement.id,
        ownerId: profile.id,
        storagePath: path,
        fileName: file.name,
        type: 'report',
      });
      toast({ title: 'Document uploaded', tone: 'success' });
      if (reportInput.current) reportInput.current.value = '';
    } catch (caught) {
      toast({ title: 'Could not upload document', description: errorMessage(caught), tone: 'error' });
    } finally {
      setUploading(false);
    }
  };

  const tabs: { key: TabKey; label: string; count?: number }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'daily', label: 'Daily reports' },
    { key: 'logs', label: 'Weekly approvals', count: sortedLogs.length },
    { key: 'evaluations', label: 'Evaluations', count: placement.evaluations?.length ?? 0 },
    { key: 'checkins', label: 'Check-ins', count: placement.check_ins?.length ?? 0 },
    { key: 'documents', label: 'Documents', count: placement.documents?.length ?? 0 },
  ];

  return (
    <div>
      <Link
        to="/placements"
        className='placement-detail-mb-4-1'
      >
        <ArrowLeft className='placement-detail-h-35-1' /> All placements
      </Link>

      <PageHeader
        title={placement.posting?.title ?? 'Placement'}
        description={`${placement.student?.full_name ?? 'Student'} · ${placement.company?.name ?? 'Company'}`}
        actions={
          <>
            <StatusBadge status={placement.status} label={PLACEMENT_STATUS_LABELS[placement.status]} />
            {isCoordinator ? (
              <Button variant="secondary" onClick={() => { setFacultyId(facultyOptions[0]?.id ?? ''); setActionError(''); setAssignOpen(true); }}>
                <UserCheck className='placement-detail-h-4-1' /> {placement.faculty_supervisor_id ? 'Change faculty supervisor' : 'Assign faculty'}
              </Button>
            ) : null}
            {canGrade ? (
              <Button
                variant="secondary"
                onClick={() => {
                  setGradeValue(placement.final_grade !== null ? String(placement.final_grade) : '');
                  setGradeNotes(placement.grade_notes ?? '');
                  setActionError('');
                  setGradeOpen(true);
                }}
              >
                <GraduationCap className='placement-detail-h-4-1' /> {placement.final_grade !== null ? 'Update grade' : 'Record grade'}
              </Button>
            ) : null}
          </>
        }
      />

      <div className='placement-detail-mb-6-1'>
        <SummaryCard
          icon={<CalendarDays className='placement-detail-h-4-1' />}
          label="Placement dates"
          value={`${formatDate(placement.start_date)} – ${formatDate(placement.end_date)}`}
        />
        <SummaryCard
          icon={<UserRound className='placement-detail-h-4-1' />}
          label="Site supervisor"
          value={placement.site_supervisor?.full_name ?? '—'}
        />
        <SummaryCard
          icon={<UserCheck className='placement-detail-h-4-1' />}
          label="Faculty supervisor"
          value={placement.faculty_supervisor?.full_name ?? 'Not assigned'}
        />
        <SummaryCard
          icon={<GraduationCap className='placement-detail-h-4-1' />}
          label="Final grade"
          value={placement.final_grade !== null ? String(Number(placement.final_grade)) : 'Pending'}
        />
      </div>

      <Tabs className='placement-detail-mb-5-1' options={tabs} value={tab} onChange={(key) => setTab(key as TabKey)} />

      {tab === 'overview' ? (
        <div className='placement-detail-grid-1'>
          <Card className='placement-detail-col-span-2-1'>
            <CardHeader title="Placement details" />
            <dl className='placement-detail-grid-2'>
              <Detail label="Student" value={placement.student?.full_name ?? '—'} />
              <Detail label="Student email" value={placement.student?.email ?? '—'} />
              <Detail label="University" value={placement.university?.name ?? '—'} />
              <Detail label="Company" value={placement.company?.name ?? '—'} />
              <Detail label="Opportunity" value={placement.posting?.title ?? '—'} />
              <Detail
                label="Opportunity type"
                value={placement.posting ? POSTING_TYPE_LABELS[placement.posting.type] : '—'}
              />
              <Detail
                label="Weekly logs"
                value={`${sortedLogs.length} total · ${approvedLogs} approved`}
              />
              <Detail label="Check-ins" value={String(placement.check_ins?.length ?? 0)} />
            </dl>
            {placement.grade_notes ? (
              <div className='placement-detail-border-t-1'>
                <p className='placement-detail-text-xs-1'>Grade notes</p>
                <p className='placement-detail-mt-1-1'>{placement.grade_notes}</p>
                <p className='placement-detail-mt-2-1'>
                  Recorded {placement.graded_at ? formatDateTime(placement.graded_at) : ''}
                </p>
              </div>
            ) : null}
          </Card>

          <div className='placement-detail-space-y-4-1'>
            <Card>
              <CardHeader title="Progress" />
              <div className='placement-detail-space-y-3-1'>
                <ProgressRow label="Logs approved" value={approvedLogs} total={sortedLogs.length} />
                <ProgressRow
                  label="Evaluations in"
                  value={placement.evaluations?.length ?? 0}
                  total={2}
                />
                <ProgressRow
                  label="Check-ins logged"
                  value={placement.check_ins?.length ?? 0}
                  total={undefined}
                />
              </div>
            </Card>

            {isCoordinator ? (
              <Card>
                <CardHeader
                  title="Faculty supervision"
                  actions={
                    <Button size="sm" variant="secondary" onClick={() => setAssignOpen(true)}>
                      {placement.faculty_supervisor_id ? 'Change' : 'Assign'}
                    </Button>
                  }
                />
                <div className='placement-detail-px-5-1'>
                  <p className='placement-detail-font-medium-1'>
                    {placement.faculty_supervisor?.full_name ?? 'No faculty supervisor assigned'}
                  </p>
                  <p className='placement-detail-mt-05-1'>
                    {placement.faculty_supervisor?.email ?? 'Assign a supervisor to enable grades and check-ins.'}
                  </p>
                </div>
              </Card>
            ) : null}

            {isStudent ? (
              <Card>
                <CardHeader title="Next steps" />
                <div className='placement-detail-space-y-2-1'>
                  {placement.status === 'active' ? (
                    <>
                      <p className='placement-detail-flex-2'>
                        <ClipboardList className='placement-detail-mt-05-2' />
                        Record daily reports and submit them together at the end of each week. Your assigned university faculty supervisor approves each week.
                      </p>
                      <p className='placement-detail-flex-2'>
                        <FileText className='placement-detail-mt-05-2' />
                        Upload your final report from the Documents tab when it is ready.
                      </p>
                    </>
                  ) : (
                    <p>This placement is {placement.status}. Contact your coordinator with any questions.</p>
                  )}
                </div>
              </Card>
            ) : null}
          </div>
        </div>
      ) : null}

      {tab === 'daily' ? (
        <DailyReportsPanel
          placementId={placement.id}
          startDate={placement.start_date}
          endDate={placement.end_date}
          isStudent={isStudent && placement.status === 'active'}
          weeklyLogs={sortedLogs.map((log) => ({ week_number: log.week_number, status: log.status }))}
        />
      ) : null}

      {tab === 'logs' ? (
        <div className='placement-detail-space-y-4-1'>
          <div className='placement-detail-flex-3'>
            <p className='placement-detail-text-sm-1'>
              {sortedLogs.length} log{sortedLogs.length === 1 ? '' : 's'} · {approvedLogs} approved
            </p>
            {isStudent && placement.status === 'active' && false ? (
              <Button size="sm" onClick={() => openLogModal()}>
                <Plus className='placement-detail-h-4-1' /> Add weekly log
              </Button>
            ) : null}
          </div>

          {sortedLogs.length === 0 ? (
            <EmptyState
              icon={<ClipboardList className='placement-detail-h-5-1' />}
              title="No weekly logs yet"
              description={isStudent ? 'Add your first weekly log to start the supervision trail.' : 'The student has not submitted any logs yet.'}
              action={
                isStudent && placement.status === 'active' && false ? (
                  <Button size="sm" onClick={() => openLogModal()}>
                    Add weekly summary
                  </Button>
                ) : undefined
              }
            />
          ) : (
            sortedLogs.map((log) => {
              const editable = isStudent && false && ['draft', 'needs_revision'].includes(log.status) && placement?.status === 'active';
              return (
                <Card key={log.id}>
                  <div className='placement-detail-flex-4'>
                    <div>
                      <div className='placement-detail-flex-5'>
                        <h3 className='placement-detail-text-sm-2'>Week {log.week_number}</h3>
                        <StatusBadge status={log.status} label={LOG_STATUS_LABELS[log.status]} />
                      </div>
                      <p className='placement-detail-mt-1-2'>
                        {formatHours(Number(log.hours))} hours
                        {log.submitted_at ? ` · submitted ${formatDateTime(log.submitted_at)}` : ' · not submitted'}
                      </p>
                    </div>
                    <div className='placement-detail-flex-6'>
                      {editable ? (
                        <>
                          <Button size="sm" variant="secondary" onClick={() => openLogModal(log)}>
                            Edit
                          </Button>
                          <Button size="sm" onClick={() => submitExistingLog(log)} loading={submitLog.isPending}>
                            <Send className='placement-detail-h-35-1' /> Submit
                          </Button>
                        </>
                      ) : null}
                      {canReviewLogs && log.status === 'submitted' ? (
                        <Button
                          size="sm"
                          onClick={() => {
                            setActionError('');
                            setReviewDecision('approved');
                            setReviewComment('');
                            setReviewingLog(log);
                          }}
                        >
                          Review log
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  <div className='placement-detail-grid-3'>
                    <div>
                      <p className='placement-detail-text-xs-1'>Tasks</p>
                      <p className='placement-detail-mt-1-1'>{log.tasks || '—'}</p>
                    </div>
                    <div>
                      <p className='placement-detail-text-xs-1'>Learning outcomes</p>
                      <p className='placement-detail-mt-1-1'>{log.learning_outcomes || '—'}</p>
                    </div>
                  </div>
                  {log.supervisor_comment ? (
                    <div className='placement-detail-border-t-2'>
                      <p className='placement-detail-text-xs-2'>Supervisor comment</p>
                      <p className='placement-detail-mt-1-3'>{log.supervisor_comment}</p>
                    </div>
                  ) : null}
                </Card>
              );
            })
          )}
        </div>
      ) : null}

      {tab === 'evaluations' ? (
        <div className='placement-detail-space-y-4-1'>
          <div className='placement-detail-flex-3'>
            <p className='placement-detail-text-sm-1'>
              Midterm and final evaluations recorded against the rubric.
            </p>
            {canSubmitEvaluation ? (
              <Button size="sm" onClick={openEvaluation}>
                <Star className='placement-detail-h-4-1' /> Submit evaluation
              </Button>
            ) : null}
          </div>

          {(placement.evaluations ?? []).length === 0 ? (
            <EmptyState
              icon={<Star className='placement-detail-h-5-1' />}
              title="No evaluations yet"
              description="Site and faculty supervisors can record evaluations when the time comes."
            />
          ) : (
            <div className='placement-detail-grid-4'>
              {(placement.evaluations ?? []).map((evaluation) => (
                <Card key={evaluation.id}>
                  <CardHeader
                    title={`${EVALUATION_TYPE_LABELS[evaluation.type]} evaluation`}
                    description={`By ${evaluation.evaluator_role === 'site_supervisor' ? 'site supervisor' : 'faculty supervisor'} · ${formatDate(evaluation.created_at)}`}
                    actions={
                      <Badge tone="violet">
                        {evaluation.overall_score !== null ? `${Number(evaluation.overall_score)} / 5` : '—'}
                      </Badge>
                    }
                  />
                  <div className='placement-detail-space-y-2-2'>
                    {RUBRIC_CRITERIA.map((criterion) => {
                      const score = Number(evaluation.rubric_scores?.[criterion.key] ?? 0);
                      return (
                        <div key={criterion.key} className='placement-detail-flex-7'>
                          <span className='placement-detail-w-32-1'>{criterion.label}</span>
                          <div className='placement-detail-flex-1-1'>
                            <div
                              className='placement-detail-h-15-1'
                              style={{ width: `${Math.max(0, Math.min(5, score)) * 20}%` }}
                            />
                          </div>
                          <span className='placement-detail-w-6-1'>{score || '—'}</span>
                        </div>
                      );
                    })}
                    {evaluation.comments ? (
                      <p className='placement-detail-mt-3-1'>
                        {evaluation.comments}
                      </p>
                    ) : null}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {tab === 'checkins' ? (
        <div className='placement-detail-space-y-4-1'>
          <div className='placement-detail-flex-3'>
            <p className='placement-detail-text-sm-1'>Supervision check-ins recorded by the faculty supervisor.</p>
            {isFaculty ? (
              <Button
                size="sm"
                onClick={() => {
                  setActionError('');
                  setCheckInForm({ type: 'call', notes: '', occurredAt: nowLocalInput() });
                  setCheckInOpen(true);
                }}
              >
                <Plus className='placement-detail-h-4-1' /> Log check-in
              </Button>
            ) : null}
          </div>

          {(placement.check_ins ?? []).length === 0 ? (
            <EmptyState
              icon={<MessageSquare className='placement-detail-h-5-1' />}
              title="No check-ins logged"
              description="Site visits, calls, and emails will appear here."
            />
          ) : (
            <div className='placement-detail-space-y-3-2'>
              {[...(placement.check_ins ?? [])]
                .sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime())
                .map((checkIn) => (
                  <Card key={checkIn.id}>
                    <div className='placement-detail-flex-8'>
                      <div>
                        <div className='placement-detail-flex-5'>
                          <Badge tone="blue">{CHECK_IN_TYPE_LABELS[checkIn.type]}</Badge>
                          <span className='placement-detail-text-xs-3'>{formatDateTime(checkIn.occurred_at)}</span>
                        </div>
                        <p className='placement-detail-mt-2-2'>{checkIn.notes}</p>
                      </div>
                    </div>
                  </Card>
                ))}
            </div>
          )}
        </div>
      ) : null}

      {tab === 'documents' ? (
        <div className='placement-detail-space-y-4-1'>
          <div className='placement-detail-flex-3'>
            <p className='placement-detail-text-sm-1'>
              Private CVs and final reports. Files are shared only with placement supervisors and tenant admins.
            </p>
            {isStudent ? (
              <div>
                <input
                  ref={reportInput}
                  type="file"
                  accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  className='placement-detail-hidden-1'
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void uploadReportFile(file);
                  }}
                />
                <Button
                  size="sm"
                  loading={uploading}
                  onClick={() => reportInput.current?.click()}
                >
                  <Upload className='placement-detail-h-4-1' /> Upload report
                </Button>
              </div>
            ) : null}
          </div>

          <Card>
            <CardHeader title="Documents" />
            {(placement.documents ?? []).length === 0 ? (
              <EmptyState
                icon={<Paperclip className='placement-detail-h-5-1' />}
                title="No documents yet"
                description={isStudent ? 'Upload your final report when it is ready.' : 'Uploaded reports will appear here.'}
              />
            ) : (
              <div className='placement-detail-divide-y-1'>
                {[...(placement.documents ?? [])]
                  .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                  .map((document) => (
                    <div key={document.id} className='placement-detail-flex-9'>
                      <div className='placement-detail-flex-10'>
                        <span className='placement-detail-flex-11'>
                          <FileText className='placement-detail-h-4-1' />
                        </span>
                        <div className='placement-detail-min-w-0-1'>
                          <p className='placement-detail-truncate-1'>{document.file_name}</p>
                          <p className='placement-detail-text-xs-3'>
                            {document.type.toUpperCase()} ·{' '}
                            {document.owner?.full_name ? `${document.owner.full_name} · ` : ''}
                            {formatDate(document.created_at)}
                          </p>
                        </div>
                      </div>
                      <div className='placement-detail-flex-12'>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={async () => {
                            try {
                              await openDocument('reports', document.storage_path);
                            } catch (caught) {
                              toast({
                                title: 'Could not open document',
                                description: errorMessage(caught),
                                tone: 'error',
                              });
                            }
                          }}
                        >
                          Open
                        </Button>
                        {document.owner_id === profile?.id ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={async () => {
                              try {
                                await deleteDocument.mutateAsync({
                                  documentId: document.id,
                                  placementId: placement.id,
                                  storagePath: document.storage_path,
                                });
                                toast({ title: 'Document removed', tone: 'info' });
                              } catch (caught) {
                                toast({
                                  title: 'Could not remove document',
                                  description: errorMessage(caught),
                                  tone: 'error',
                                });
                              }
                            }}
                          >
                            <Trash2 className='placement-detail-h-35-1' /> Delete
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </Card>
        </div>
      ) : null}

      <Modal
        open={logOpen}
        onClose={() => setLogOpen(false)}
        title={editingLog ? `Edit week ${editingLog.week_number}` : 'Weekly log'}
        description="Record hours, work completed, and what you learned."
        footer={
          <>
            <Button variant="secondary" onClick={() => setLogOpen(false)}>
              Cancel
            </Button>
            <Button variant="secondary" onClick={() => saveLog(false)} loading={logSaving}>
              Save draft
            </Button>
            <Button onClick={() => saveLog(true)} loading={logSaving}>
              Save & submit
            </Button>
          </>
        }
      >
        <div className='placement-detail-space-y-4-1'>
          {actionError ? <Alert tone="danger">{actionError}</Alert> : null}
          <div className='placement-detail-grid-5'>
            <Field label="Week number" htmlFor="log-week" required>
              <Input
                id="log-week"
                type="number"
                min={1}
                value={logForm.weekNumber}
                onChange={(event) => setLogForm((current) => ({ ...current, weekNumber: event.target.value }))}
                disabled={Boolean(editingLog)}
              />
            </Field>
            <Field label="Hours worked" htmlFor="log-hours" required>
              <Input
                id="log-hours"
                type="number"
                min={0}
                max={168}
                step="0.5"
                value={logForm.hours}
                onChange={(event) => setLogForm((current) => ({ ...current, hours: event.target.value }))}
              />
            </Field>
          </div>
          <Field label="Tasks completed" htmlFor="log-tasks" required>
            <Textarea
              id="log-tasks"
              rows={4}
              value={logForm.tasks}
              onChange={(event) => setLogForm((current) => ({ ...current, tasks: event.target.value }))}
              placeholder="Built the customer dashboard filter component…"
            />
          </Field>
          <Field label="Learning outcomes" htmlFor="log-outcomes">
            <Textarea
              id="log-outcomes"
              rows={3}
              value={logForm.outcomes}
              onChange={(event) => setLogForm((current) => ({ ...current, outcomes: event.target.value }))}
              placeholder="Learned how to structure React components for reuse…"
            />
          </Field>
        </div>
      </Modal>

      <Modal
        open={Boolean(reviewingLog)}
        onClose={() => setReviewingLog(null)}
        title={`Review week ${reviewingLog?.week_number ?? ''}`}
        description="Approve the log or request a revision with guidance."
        footer={
          <>
            <Button variant="secondary" onClick={() => setReviewingLog(null)}>
              Cancel
            </Button>
            <Button onClick={doReviewLog} loading={reviewLog.isPending}>
              Save decision
            </Button>
          </>
        }
      >
        <div className='placement-detail-space-y-4-1'>
          {actionError ? <Alert tone="danger">{actionError}</Alert> : null}
          <Field label="Decision" htmlFor="review-decision">
            <Select
              id="review-decision"
              value={reviewDecision}
              onChange={(event) => setReviewDecision(event.target.value as 'approved' | 'needs_revision')}
            >
              <option value="approved">Approve</option>
              <option value="needs_revision">Request revision</option>
            </Select>
          </Field>
          <Field label="Comment" htmlFor="review-comment" hint="Required context for a revision request.">
            <Textarea
              id="review-comment"
              rows={4}
              value={reviewComment}
              onChange={(event) => setReviewComment(event.target.value)}
              placeholder="Great progress. Please expand on the testing work next week…"
            />
          </Field>
        </div>
      </Modal>

      <Modal
        open={evaluationOpen}
        onClose={() => setEvaluationOpen(false)}
        title="Submit evaluation"
        description="Scores use a 1–5 scale across the four rubric criteria."
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEvaluationOpen(false)}>
              Cancel
            </Button>
            <Button onClick={doSubmitEvaluation} loading={submitEvaluation.isPending}>
              Save evaluation
            </Button>
          </>
        }
      >
        <div className='placement-detail-space-y-4-1'>
          {actionError ? <Alert tone="danger">{actionError}</Alert> : null}
          <Field label="Evaluation type" htmlFor="evaluation-type">
            <Select
              id="evaluation-type"
              value={evaluationType}
              onChange={(event) => changeEvaluationType(event.target.value as EvaluationType)}
            >
              {canEvaluateSite ? <option value="midterm">Midterm</option> : null}
              <option value="final">Final</option>
            </Select>
          </Field>

          <div className='placement-detail-grid-5'>
            {RUBRIC_CRITERIA.map((criterion) => (
              <Field key={criterion.key} label={criterion.label} htmlFor={`rubric-${criterion.key}`}>
                <Select
                  id={`rubric-${criterion.key}`}
                  value={String(rubric[criterion.key] ?? 4)}
                  onChange={(event) =>
                    setRubric((current) => ({ ...current, [criterion.key]: Number(event.target.value) }))
                  }
                >
                  {[1, 2, 3, 4, 5].map((score) => (
                    <option key={score} value={score}>
                      {score} — {['Poor', 'Below expectations', 'Meets expectations', 'Strong', 'Outstanding'][score - 1]}
                    </option>
                  ))}
                </Select>
              </Field>
            ))}
          </div>

          <Field label="Comments" htmlFor="evaluation-comments">
            <Textarea
              id="evaluation-comments"
              rows={5}
              value={evaluationComments}
              onChange={(event) => setEvaluationComments(event.target.value)}
              placeholder="Strengths, areas for growth, and readiness for the next stage…"
            />
          </Field>

          <div className='placement-detail-rounded-xl-1'>
            Overall score: <strong className='placement-detail-text-slate-900-1'>{averageScore(rubric) ?? '—'} / 5</strong>
          </div>
        </div>
      </Modal>

      <Modal
        open={checkInOpen}
        onClose={() => setCheckInOpen(false)}
        title="Log a check-in"
        description="Record a visit, call, or email with the student."
        footer={
          <>
            <Button variant="secondary" onClick={() => setCheckInOpen(false)}>
              Cancel
            </Button>
            <Button onClick={doAddCheckIn} loading={addCheckIn.isPending}>
              Save check-in
            </Button>
          </>
        }
      >
        <div className='placement-detail-space-y-4-1'>
          {actionError ? <Alert tone="danger">{actionError}</Alert> : null}
          <div className='placement-detail-grid-5'>
            <Field label="Type" htmlFor="checkin-type">
              <Select
                id="checkin-type"
                value={checkInForm.type}
                onChange={(event) =>
                  setCheckInForm((current) => ({ ...current, type: event.target.value as CheckInType }))
                }
              >
                <option value="visit">Site visit</option>
                <option value="call">Phone call</option>
                <option value="email">Email</option>
              </Select>
            </Field>
            <Field label="When" htmlFor="checkin-date">
              <Input
                id="checkin-date"
                type="datetime-local"
                value={checkInForm.occurredAt}
                onChange={(event) => setCheckInForm((current) => ({ ...current, occurredAt: event.target.value }))}
              />
            </Field>
          </div>
          <Field label="Notes" htmlFor="checkin-notes" required>
            <Textarea
              id="checkin-notes"
              rows={4}
              value={checkInForm.notes}
              onChange={(event) => setCheckInForm((current) => ({ ...current, notes: event.target.value }))}
              placeholder="Met with the student and site supervisor. Discussed project milestones…"
            />
          </Field>
        </div>
      </Modal>

      <Modal
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        title="Assign faculty supervisor"
        description={placement.student?.department ? "Choose a faculty supervisor from " + placement.student.department + "." : "Choose a faculty supervisor from your university. Set the student department in their profile to enforce department matching."}
        footer={
          <>
            <Button variant="secondary" onClick={() => setAssignOpen(false)}>
              Cancel
            </Button>
            <Button onClick={doAssignFaculty} loading={assignFaculty.isPending}>
              Assign supervisor
            </Button>
          </>
        }
      >
        <div className='placement-detail-space-y-4-1'>
          {actionError ? <Alert tone="danger">{actionError}</Alert> : null}
          <Field label="Faculty supervisor" htmlFor="assign-faculty" required>
            <Select id="assign-faculty" value={facultyId} onChange={(event) => setFacultyId(event.target.value)}>
              <option value="">Select a faculty supervisor</option>
              {facultyOptions.map((faculty) => (
                <option key={faculty.id} value={faculty.id}>
                  {faculty.full_name} · {faculty.department ?? 'Department not set'} · {faculty.email}
                </option>
              ))}
            </Select>
          </Field>
          {placement.student?.department && facultyOptions.length === 0 ? <Alert tone="warning">No faculty supervisor has the matching department set. Ask a faculty member to update their profile department first.</Alert> : null}
        </div>
      </Modal>

      <Modal
        open={gradeOpen}
        onClose={() => setGradeOpen(false)}
        title="Record final grade"
        description="The student is notified. The official grade is visible to the university and company, but only you as the assigned faculty supervisor can change it."
        footer={
          <>
            <Button variant="secondary" onClick={() => setGradeOpen(false)}>
              Cancel
            </Button>
            <Button onClick={doRecordGrade} loading={recordGrade.isPending}>
              Save grade
            </Button>
          </>
        }
      >
        <div className='placement-detail-space-y-4-1'>
          {actionError ? <Alert tone="danger">{actionError}</Alert> : null}
          <Field label="Final grade (0–100)" htmlFor="grade-value" required>
            <Input
              id="grade-value"
              type="number"
              min={0}
              max={100}
              step="0.5"
              value={gradeValue}
              onChange={(event) => setGradeValue(event.target.value)}
            />
          </Field>
          <Field label="Grade notes" htmlFor="grade-notes">
            <Textarea
              id="grade-notes"
              rows={4}
              value={gradeNotes}
              onChange={(event) => setGradeNotes(event.target.value)}
              placeholder="Summary of the evaluation evidence behind this grade…"
            />
          </Field>
        </div>
      </Modal>
    </div>
  );
}

function SummaryCard({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <Card className='placement-detail-p-4-1'>
      <div className='placement-detail-flex-7'>
        <span className='placement-detail-flex-13'>{icon}</span>
        <div className='placement-detail-min-w-0-1'>
          <p className='placement-detail-text-xs-3'>{label}</p>
          <p className='placement-detail-truncate-2'>{value}</p>
        </div>
      </div>
    </Card>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className='placement-detail-text-xs-1'>{label}</dt>
      <dd className='placement-detail-mt-1-4'>{value}</dd>
    </div>
  );
}

function ProgressRow({ label, value, total }: { label: string; value: number; total?: number }) {
  const percent = total && total > 0 ? Math.min(100, Math.round((value / total) * 100)) : null;
  return (
    <div>
      <div className='placement-detail-flex-14'>
        <span className='placement-detail-text-slate-500-1'>{label}</span>
        <span className='placement-detail-font-medium-1'>
          {value}
          {total ? ` / ${total}` : ''}
        </span>
      </div>
      {percent !== null ? (
        <div className='placement-detail-mt-15-1'>
          <div className='placement-detail-h-full-1' style={{ width: `${percent}%` }} />
        </div>
      ) : null}
    </div>
  );
}
