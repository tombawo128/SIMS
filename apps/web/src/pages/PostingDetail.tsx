import { useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Banknote,
  Briefcase,
  Building2,
  CalendarClock,
  CalendarX2,
  CheckCircle2,
  Download,
  GraduationCap,
  MapPin,
  Pencil,
  Send,
  Wifi,
} from 'lucide-react';
import {
  APPLICATION_STATUS_LABELS,
  POSTING_STATUS_LABELS,
  POSTING_TYPE_LABELS,
  formatDate,
  isDeadlinePassed,
} from '@sims/shared';
import type { Application } from '@sims/shared';
import { useAuth } from '@/context/AuthContext';
import { useApplications, useApply, useWithdrawApplication } from '@/hooks/useApplications';
import { usePosting } from '@/hooks/usePostings';
import { useStudentProfile, useSaveStudentProfile } from '@/hooks/useStudentProfile';
import { useUniversities } from '@/hooks/useLookups';
import { uploadCv, openDocument } from '@/lib/storage';
import { errorMessage } from '@/lib/utils';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Field,
  Modal,
  PageHeader,
  Spinner,
  Textarea,
  useToast,
} from '@/components/ui';
import { StatusBadge } from '@/components/StatusBadge';

const WITHDRAWABLE = ['submitted', 'under_review', 'shortlisted'];

export function PostingDetail() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const { toast } = useToast();
  const posting = usePosting(id);
  const universities = useUniversities();
  const isStudent = profile?.role === 'student';
  const applications = useApplications(isStudent);
  const studentProfile = useStudentProfile(isStudent ? profile?.id : undefined);
  const saveStudentProfile = useSaveStudentProfile(profile?.id);
  const apply = useApply();
  const withdraw = useWithdrawApplication();

  const [open, setOpen] = useState(false);
  const [coverLetter, setCoverLetter] = useState('');
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);

  const existingApplication: Application | undefined = (applications.data ?? []).find(
    (application) => application.posting_id === id && application.student_id === profile?.id,
  );

  const targetedUniversities = useMemo(() => {
    const ids = posting.data?.posting_universities?.map((row) => row.university_id) ?? [];
    return (universities.data ?? []).filter((university) => ids.includes(university.id));
  }, [posting.data, universities.data]);

  if (posting.isLoading) {
    return (
      <div className='posting-detail-flex-1'>
        <Spinner className='posting-detail-h-6-1' />
      </div>
    );
  }

  if (posting.isError || !posting.data) {
    return (
      <EmptyState
        title="Opportunity unavailable"
        description="This posting may have been removed, or it is not visible to your workspace."
        action={
          <Link to="/postings">
            <Button variant="secondary">Back to opportunities</Button>
          </Link>
        }
      />
    );
  }

  const data = posting.data;
  const closed = isDeadlinePassed(data.deadline);
  const canApply =
    isStudent &&
    data.status === 'published' &&
    !closed &&
    (!existingApplication || existingApplication.status === 'draft');
  const canManage =
    profile &&
    ['company_admin', 'site_supervisor'].includes(profile.role) &&
    profile.company_id === data.company_id;

  const submitApplication = async () => {
    if (!profile || !profile.university_id) return;
    setError('');
    if (!coverLetter.trim()) {
      setError('Add a short cover letter before submitting.');
      return;
    }
    if (!studentProfile.data?.cv_path && !cvFile) {
      setError('Attach your CV to apply.');
      return;
    }

    try {
      let cvPath = studentProfile.data?.cv_path ?? null;
      if (cvFile) {
        cvPath = await uploadCv(cvFile, profile.id);
        await saveStudentProfile.mutateAsync({
          student_id: studentProfile.data?.student_id ?? null,
          program: studentProfile.data?.program ?? null,
          year: studentProfile.data?.year ?? null,
          skills: studentProfile.data?.skills ?? [],
          cv_path: cvPath,
        });
      }

      await apply.mutateAsync({
        posting_id: data.id,
        student_id: profile.id,
        university_id: profile.university_id,
        company_id: data.company_id,
        cover_letter: coverLetter.trim(),
        cv_path: cvPath,
      });
      toast({ title: 'Application submitted', description: `You applied for ${data.title}.`, tone: 'success' });
      setOpen(false);
      setCoverLetter('');
      setCvFile(null);
    } catch (caught) {
      setError(errorMessage(caught));
    }
  };

  return (
    <div>
      <Link
        to="/postings"
        className='posting-detail-mb-4-1'
      >
        <ArrowLeft className='posting-detail-h-35-1' /> All opportunities
      </Link>

      <PageHeader
        title={data.title}
        description={`${data.company?.name ?? 'Company'} · ${POSTING_TYPE_LABELS[data.type]}`}
        actions={
          canManage ? (
            <>
              <Link to={`/manage/postings/${data.id}/edit`}>
                <Button variant="secondary">
                  <Pencil className='posting-detail-h-4-1' /> Edit posting
                </Button>
              </Link>
              <Link to="/applications">
                <Button>Review applicants</Button>
              </Link>
            </>
          ) : canApply ? (
            <Button onClick={() => setOpen(true)}>
              <Send className='posting-detail-h-4-1' /> Apply now
            </Button>
          ) : undefined
        }
      />

      {existingApplication ? (
        <div className='posting-detail-mb-5-1'>
          <Alert
            tone={existingApplication.status === 'accepted' ? 'success' : existingApplication.status === 'rejected' ? 'warning' : 'info'}
            title={`You applied on ${formatDate(existingApplication.created_at)}`}
          >
            <div className='posting-detail-flex-2'>
              <span>
                Current status: <strong>{APPLICATION_STATUS_LABELS[existingApplication.status]}</strong>
                {existingApplication.rejection_reason ? ` — ${existingApplication.rejection_reason}` : ''}
              </span>
              {WITHDRAWABLE.includes(existingApplication.status) ? (
                <Button
                  size="sm"
                  variant="secondary"
                  loading={withdraw.isPending}
                  onClick={async () => {
                    try {
                      await withdraw.mutateAsync(existingApplication.id);
                      toast({ title: 'Application withdrawn', tone: 'info' });
                    } catch (caught) {
                      toast({ title: 'Could not withdraw', description: errorMessage(caught), tone: 'error' });
                    }
                  }}
                >
                  Withdraw
                </Button>
              ) : null}
            </div>
          </Alert>
        </div>
      ) : null}

      {closed && isStudent && !existingApplication ? (
        <div className='posting-detail-mb-5-1'>
          <Alert tone="warning" title="Applications closed">
            The deadline for this opportunity has passed.
          </Alert>
        </div>
      ) : null}

      <div className='posting-detail-grid-1'>
        <div className='posting-detail-space-y-6-1'>
          <Card>
            <CardHeader title="About the role" />
            <div className='posting-detail-space-y-4-1'>
              {data.description.split(/\n{2,}/).map((paragraph, index) => (
                <p key={index} className='posting-detail-whitespace-pre-line-1'>
                  {paragraph}
                </p>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader title="What we're looking for" />
            <div className='posting-detail-px-5-1'>
              {data.requirements.trim() ? (
                <ul className='posting-detail-space-y-2-1'>
                  {data.requirements
                    .split('\n')
                    .map((line) => line.replace(/^[-*]\s*/, '').trim())
                    .filter(Boolean)
                    .map((line, index) => (
                      <li key={index} className='posting-detail-flex-3'>
                        <CheckCircle2 className='posting-detail-mt-05-1' />
                        <span>{line}</span>
                      </li>
                    ))}
                </ul>
              ) : (
                <p className='posting-detail-text-sm-1'>No specific requirements listed.</p>
              )}
            </div>
          </Card>

          {profile?.role === 'student' && studentProfile.data?.cv_path ? (
            <Card>
              <CardHeader
                title="Your CV on file"
                description="This is the CV companies receive with your application."
                actions={
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={async () => {
                      try {
                        await openDocument('cvs', studentProfile.data!.cv_path!);
                      } catch (caught) {
                        toast({ title: 'Could not open CV', description: errorMessage(caught), tone: 'error' });
                      }
                    }}
                  >
                    <Download className='posting-detail-h-35-1' /> View CV
                  </Button>
                }
              />
              <p className='posting-detail-px-5-2'>
                Update your CV or profile details from the Profile page.
              </p>
            </Card>
          ) : null}
        </div>

        <div className='posting-detail-space-y-4-2'>
          <Card>
            <CardHeader title="At a glance" />
            <dl className='posting-detail-space-y-3-1'>
              <Detail icon={<Building2 className='posting-detail-h-4-1' />} label="Company" value={data.company?.name ?? '—'} />
              <Detail icon={<Briefcase className='posting-detail-h-4-1' />} label="Type" value={POSTING_TYPE_LABELS[data.type]} />
              <Detail
                icon={<MapPin className='posting-detail-h-4-1' />}
                label="Location"
                value={data.is_remote ? 'Remote' : data.location || 'Flexible'}
              />
              {data.is_remote ? <Detail icon={<Wifi className='posting-detail-h-4-1' />} label="Remote" value="Yes" /> : null}
              <Detail
                icon={<CalendarClock className='posting-detail-h-4-1' />}
                label="Duration"
                value={data.duration_months ? `${data.duration_months} months` : 'Not specified'}
              />
              <Detail
                icon={<Banknote className='posting-detail-h-4-1' />}
                label="Stipend"
                value={data.stipend || 'Not specified'}
              />
              <Detail
                icon={<CalendarX2 className='posting-detail-h-4-1' />}
                label="Deadline"
                value={data.deadline ? formatDate(data.deadline) : 'Rolling'}
              />
            </dl>
            <div className='posting-detail-border-t-1'>
              <div className='posting-detail-flex-4'>
                <span>Status</span>
                <StatusBadge status={data.status} label={POSTING_STATUS_LABELS[data.status]} />
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Who can apply" />
            <div className='posting-detail-px-5-3'>
              {data.visibility === 'all_universities' ? (
                <p className='posting-detail-flex-5'>
                  <GraduationCap className='posting-detail-mt-05-2' />
                  Open to students from every partner university.
                </p>
              ) : (
                <div>
                  <p className='posting-detail-flex-5'>
                    <GraduationCap className='posting-detail-mt-05-2' />
                    Targeted at selected universities:
                  </p>
                  <div className='posting-detail-mt-2-1'>
                    {targetedUniversities.length ? (
                      targetedUniversities.map((university) => (
                        <Badge key={university.id} tone="violet">
                          {university.name}
                        </Badge>
                      ))
                    ) : (
                      <span className='posting-detail-text-xs-1'>No universities selected yet.</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`Apply for ${data.title}`}
        description={`${data.company?.name ?? 'Company'} · ${POSTING_TYPE_LABELS[data.type]}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitApplication} loading={apply.isPending || saveStudentProfile.isPending}>
              Submit application
            </Button>
          </>
        }
      >
        <div className='posting-detail-space-y-4-2'>
          {error ? <Alert tone="danger">{error}</Alert> : null}

          <Field label="Cover letter" htmlFor="cover-letter" required hint="Tell the company why you're a strong fit.">
            <Textarea
              id="cover-letter"
              rows={7}
              value={coverLetter}
              onChange={(event) => setCoverLetter(event.target.value)}
              placeholder="I'm a third-year computer science student with experience building…"
            />
          </Field>

          <Field
            label={studentProfile.data?.cv_path ? 'Replace your CV (optional)' : 'CV'}
            htmlFor="cv-file"
            required={!studentProfile.data?.cv_path}
            hint="PDF or Word document, up to 5 MB."
          >
            <input
              id="cv-file"
              ref={fileInput}
              type="file"
              accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className='posting-detail-block-1'
              onChange={(event) => setCvFile(event.target.files?.[0] ?? null)}
            />
          </Field>

          {studentProfile.data?.cv_path ? (
            <p className='posting-detail-text-xs-1'>
              If you don't upload a new file, we'll send your CV already on file.
            </p>
          ) : null}
        </div>
      </Modal>
    </div>
  );
}

function Detail({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className='posting-detail-flex-6'>
      <dt className='posting-detail-inline-flex-1'>
        <span className='posting-detail-text-slate-400-1'>{icon}</span>
        {label}
      </dt>
      <dd className='posting-detail-text-right-1'>{value}</dd>
    </div>
  );
}
