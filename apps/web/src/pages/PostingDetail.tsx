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
      <div className="flex items-center justify-center py-20">
        <Spinner className="h-6 w-6" />
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
        className="mb-4 inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 transition hover:text-slate-800"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> All opportunities
      </Link>

      <PageHeader
        title={data.title}
        description={`${data.company?.name ?? 'Company'} · ${POSTING_TYPE_LABELS[data.type]}`}
        actions={
          canManage ? (
            <>
              <Link to={`/manage/postings/${data.id}/edit`}>
                <Button variant="secondary">
                  <Pencil className="h-4 w-4" /> Edit posting
                </Button>
              </Link>
              <Link to="/applications">
                <Button>Review applicants</Button>
              </Link>
            </>
          ) : canApply ? (
            <Button onClick={() => setOpen(true)}>
              <Send className="h-4 w-4" /> Apply now
            </Button>
          ) : undefined
        }
      />

      {existingApplication ? (
        <div className="mb-5">
          <Alert
            tone={existingApplication.status === 'accepted' ? 'success' : existingApplication.status === 'rejected' ? 'warning' : 'info'}
            title={`You applied on ${formatDate(existingApplication.created_at)}`}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
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
        <div className="mb-5">
          <Alert tone="warning" title="Applications closed">
            The deadline for this opportunity has passed.
          </Alert>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="About the role" />
            <div className="space-y-4 px-5 py-4 text-sm leading-relaxed text-slate-600">
              {data.description.split(/\n{2,}/).map((paragraph, index) => (
                <p key={index} className="whitespace-pre-line">
                  {paragraph}
                </p>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader title="What we're looking for" />
            <div className="px-5 py-4">
              {data.requirements.trim() ? (
                <ul className="space-y-2 text-sm text-slate-600">
                  {data.requirements
                    .split('\n')
                    .map((line) => line.replace(/^[-*]\s*/, '').trim())
                    .filter(Boolean)
                    .map((line, index) => (
                      <li key={index} className="flex gap-2">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                        <span>{line}</span>
                      </li>
                    ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-500">No specific requirements listed.</p>
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
                    <Download className="h-3.5 w-3.5" /> View CV
                  </Button>
                }
              />
              <p className="px-5 py-4 text-xs text-slate-500">
                Update your CV or profile details from the Profile page.
              </p>
            </Card>
          ) : null}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="At a glance" />
            <dl className="space-y-3 px-5 py-4 text-sm">
              <Detail icon={<Building2 className="h-4 w-4" />} label="Company" value={data.company?.name ?? '—'} />
              <Detail icon={<Briefcase className="h-4 w-4" />} label="Type" value={POSTING_TYPE_LABELS[data.type]} />
              <Detail
                icon={<MapPin className="h-4 w-4" />}
                label="Location"
                value={data.is_remote ? 'Remote' : data.location || 'Flexible'}
              />
              {data.is_remote ? <Detail icon={<Wifi className="h-4 w-4" />} label="Remote" value="Yes" /> : null}
              <Detail
                icon={<CalendarClock className="h-4 w-4" />}
                label="Duration"
                value={data.duration_months ? `${data.duration_months} months` : 'Not specified'}
              />
              <Detail
                icon={<Banknote className="h-4 w-4" />}
                label="Stipend"
                value={data.stipend || 'Not specified'}
              />
              <Detail
                icon={<CalendarX2 className="h-4 w-4" />}
                label="Deadline"
                value={data.deadline ? formatDate(data.deadline) : 'Rolling'}
              />
            </dl>
            <div className="border-t border-slate-100 px-5 py-3">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Status</span>
                <StatusBadge status={data.status} label={POSTING_STATUS_LABELS[data.status]} />
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Who can apply" />
            <div className="px-5 py-4 text-sm text-slate-600">
              {data.visibility === 'all_universities' ? (
                <p className="flex items-start gap-2">
                  <GraduationCap className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" />
                  Open to students from every partner university.
                </p>
              ) : (
                <div>
                  <p className="flex items-start gap-2">
                    <GraduationCap className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" />
                    Targeted at selected universities:
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {targetedUniversities.length ? (
                      targetedUniversities.map((university) => (
                        <Badge key={university.id} tone="violet">
                          {university.name}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-xs text-slate-500">No universities selected yet.</span>
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
        <div className="space-y-4">
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
              className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-indigo-700 hover:file:bg-indigo-100"
              onChange={(event) => setCvFile(event.target.files?.[0] ?? null)}
            />
          </Field>

          {studentProfile.data?.cv_path ? (
            <p className="text-xs text-slate-500">
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
    <div className="flex items-start justify-between gap-3">
      <dt className="inline-flex items-center gap-2 text-slate-500">
        <span className="text-slate-400">{icon}</span>
        {label}
      </dt>
      <dd className="text-right font-medium text-slate-800">{value}</dd>
    </div>
  );
}
