import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import type { JobPosting, PostingStatus, PostingType, PostingVisibility } from '@sims/shared';
import { useAuth } from '@/context/AuthContext';
import { usePosting, useSavePosting } from '@/hooks/usePostings';
import { useUniversities } from '@/hooks/useLookups';
import { errorMessage } from '@/lib/utils';
import {
  Alert,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Select,
  Spinner,
  Textarea,
  useToast,
} from '@/components/ui';

interface FormState {
  title: string;
  type: PostingType;
  description: string;
  requirements: string;
  location: string;
  isRemote: boolean;
  durationMonths: string;
  stipend: string;
  deadline: string;
  status: PostingStatus;
  visibility: PostingVisibility;
  universityIds: string[];
}

function initialState(posting?: JobPosting): FormState {
  return {
    title: posting?.title ?? '',
    type: posting?.type ?? 'internship',
    description: posting?.description ?? '',
    requirements: posting?.requirements ?? '',
    location: posting?.location ?? '',
    isRemote: posting?.is_remote ?? false,
    durationMonths: posting?.duration_months ? String(posting.duration_months) : '',
    stipend: posting?.stipend ?? '',
    deadline: posting?.deadline ?? '',
    status: posting?.status ?? 'draft',
    visibility: posting?.visibility ?? 'all_universities',
    universityIds: posting?.posting_universities?.map((row) => row.university_id) ?? [],
  };
}

export function PostingEditor() {
  const { id } = useParams<{ id: string }>();
  const posting = usePosting(id);

  if (id) {
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
          title="Posting unavailable"
          description="It may have been deleted or belongs to another company."
          action={
            <Link to="/manage/postings">
              <Button variant="secondary">Back to postings</Button>
            </Link>
          }
        />
      );
    }
    return <PostingForm key={posting.data.id} posting={posting.data} />;
  }

  return <PostingForm />;
}

function PostingForm({ posting }: { posting?: JobPosting }) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const universities = useUniversities();
  const savePosting = useSavePosting();
  const [form, setForm] = useState<FormState>(() => initialState(posting));
  const [error, setError] = useState('');
  const editing = Boolean(posting);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const toggleUniversity = (universityId: string) => {
    setForm((current) => ({
      ...current,
      universityIds: current.universityIds.includes(universityId)
        ? current.universityIds.filter((value) => value !== universityId)
        : [...current.universityIds, universityId],
    }));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');

    if (!profile?.company_id) {
      setError('Your company workspace could not be resolved.');
      return;
    }
    if (!form.title.trim()) {
      setError('Add a title.');
      return;
    }
    if (!form.description.trim()) {
      setError('Add a description.');
      return;
    }
    if (!form.isRemote && !form.location.trim()) {
      setError('Add a location, or mark the role as remote.');
      return;
    }
    if (form.visibility === 'selected_universities' && form.universityIds.length === 0) {
      setError('Select at least one university, or open the posting to all universities.');
      return;
    }
    if (form.deadline) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (new Date(`${form.deadline}T00:00:00`) < today && form.status === 'published') {
        setError('Choose a deadline in the future before publishing.');
        return;
      }
    }

    try {
      const postingId = await savePosting.mutateAsync({
        id: posting?.id,
        values: {
          company_id: profile.company_id,
          created_by: posting?.created_by ?? profile.id,
          title: form.title.trim(),
          type: form.type,
          description: form.description.trim(),
          requirements: form.requirements.trim(),
          location: form.location.trim(),
          is_remote: form.isRemote,
          duration_months: form.durationMonths ? Number(form.durationMonths) : null,
          stipend: form.stipend.trim() || null,
          deadline: form.deadline || null,
          status: form.status,
          visibility: form.visibility,
        },
        universityIds: form.visibility === 'selected_universities' ? form.universityIds : [],
      });
      toast({
        title: editing ? 'Posting updated' : form.status === 'published' ? 'Posting published' : 'Draft saved',
        description: 'Changes are live for the universities that can see this posting.',
        tone: 'success',
      });
      navigate(`/postings/${postingId}`);
    } catch (caught) {
      setError(errorMessage(caught));
    }
  };

  return (
    <div>
      <Link
        to="/manage/postings"
        className="mb-4 inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 transition hover:text-slate-800"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Our postings
      </Link>

      <PageHeader
        title={editing ? 'Edit posting' : 'New posting'}
        description="Draft the role, choose who can see it, and publish when ready."
      />

      <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {error ? <Alert tone="danger">{error}</Alert> : null}

          <Card>
            <CardHeader title="Role details" />
            <div className="space-y-4 px-5 py-5">
              <Field label="Title" htmlFor="title" required>
                <Input
                  id="title"
                  value={form.title}
                  onChange={(event) => update('title', event.target.value)}
                  placeholder="Software Engineering Intern"
                />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Type" htmlFor="type">
                  <Select
                    id="type"
                    value={form.type}
                    onChange={(event) => update('type', event.target.value as PostingType)}
                  >
                    <option value="internship">Internship</option>
                    <option value="graduate_job">Graduate job</option>
                    <option value="part_time">Part-time</option>
                  </Select>
                </Field>
                <Field label="Duration (months)" htmlFor="duration">
                  <Input
                    id="duration"
                    type="number"
                    min={1}
                    value={form.durationMonths}
                    onChange={(event) => update('durationMonths', event.target.value)}
                    placeholder="12"
                  />
                </Field>
              </div>

              <Field label="Description" htmlFor="description" required>
                <Textarea
                  id="description"
                  rows={7}
                  value={form.description}
                  onChange={(event) => update('description', event.target.value)}
                  placeholder="What the intern will work on, the team they'll join, and what makes the role exciting…"
                />
              </Field>

              <Field
                label="Requirements"
                htmlFor="requirements"
                hint="One requirement per line. They render as a checklist."
              >
                <Textarea
                  id="requirements"
                  rows={5}
                  value={form.requirements}
                  onChange={(event) => update('requirements', event.target.value)}
                  placeholder={'Currently pursuing a CS or related degree\nExperience with TypeScript or Python\nStrong written communication'}
                />
              </Field>
            </div>
          </Card>

          <Card>
            <CardHeader title="Logistics" />
            <div className="space-y-4 px-5 py-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Location" htmlFor="location" required={!form.isRemote}>
                  <Input
                    id="location"
                    value={form.location}
                    onChange={(event) => update('location', event.target.value)}
                    placeholder="Boston, MA"
                  />
                </Field>
                <Field label="Stipend" htmlFor="stipend" hint="Free text, e.g. $30/hour or $2,000/month.">
                  <Input
                    id="stipend"
                    value={form.stipend}
                    onChange={(event) => update('stipend', event.target.value)}
                    placeholder="$30/hour"
                  />
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Application deadline" htmlFor="deadline">
                  <Input
                    id="deadline"
                    type="date"
                    value={form.deadline}
                    onChange={(event) => update('deadline', event.target.value)}
                  />
                </Field>
                <div className="flex items-end">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-600">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      checked={form.isRemote}
                      onChange={(event) => update('isRemote', event.target.checked)}
                    />
                    Remote role
                  </label>
                </div>
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Publishing" />
            <div className="space-y-4 px-5 py-5">
              <Field label="Status" htmlFor="status">
                <Select
                  id="status"
                  value={form.status}
                  onChange={(event) => update('status', event.target.value as PostingStatus)}
                >
                  <option value="draft">Draft — only your company</option>
                  <option value="published">Published — visible to students</option>
                  {editing ? <option value="closed">Closed — no new applications</option> : null}
                </Select>
              </Field>

              <Field label="Who can see it" htmlFor="visibility">
                <Select
                  id="visibility"
                  value={form.visibility}
                  onChange={(event) => update('visibility', event.target.value as PostingVisibility)}
                >
                  <option value="all_universities">All partner universities</option>
                  <option value="selected_universities">Selected universities</option>
                </Select>
              </Field>

              {form.visibility === 'selected_universities' ? (
                <div>
                  <p className="mb-1.5 text-sm font-medium text-slate-700">Target universities</p>
                  <div className="space-y-2 rounded-xl border border-slate-200 p-3">
                    {(universities.data ?? []).map((university) => (
                      <label key={university.id} className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          checked={form.universityIds.includes(university.id)}
                          onChange={() => toggleUniversity(university.id)}
                        />
                        {university.name}
                      </label>
                    ))}
                    {!universities.isLoading && (universities.data ?? []).length === 0 ? (
                      <p className="text-xs text-slate-500">No active universities are available.</p>
                    ) : null}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-500">
                  Every student at every partner university will be able to find and apply to this role.
                </p>
              )}
            </div>
          </Card>

          <Card>
            <div className="flex flex-col gap-2 p-4">
              <Button type="submit" loading={savePosting.isPending}>
                {editing ? 'Save changes' : form.status === 'published' ? 'Publish posting' : 'Save draft'}
              </Button>
              <Link to="/manage/postings">
                <Button type="button" variant="secondary" className="w-full">
                  Cancel
                </Button>
              </Link>
            </div>
          </Card>
        </div>
      </form>
    </div>
  );
}
