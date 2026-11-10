import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Briefcase,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  GraduationCap,
  Sparkles,
  Users,
} from 'lucide-react';
import { APP_NAME } from '@sims/shared';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui';

const features = [
  {
    icon: GraduationCap,
    title: 'For universities',
    body: 'Give coordinators and faculty one place to manage placements, approve weekly logs, and track learning outcomes.',
  },
  {
    icon: Building2,
    title: 'For companies',
    body: 'Publish internships and graduate roles to selected universities, review applicants, and supervise interns from day one.',
  },
  {
    icon: Users,
    title: 'For students',
    body: 'Find opportunities beyond your campus, apply in minutes, and keep every log, evaluation, and grade in one timeline.',
  },
];

const checklist = [
  'Multi-tenant by design: every university and company sees only its own data',
  'Application → placement → weekly logs → evaluation → grade in one workflow',
  'Role-based dashboards for students, faculty, supervisors, and admins',
  'Row Level Security enforced in the database, not just the UI',
];

export function Landing() {
  const { session } = useAuth();

  return (
    <div className="min-h-screen bg-white">
      <header className="absolute inset-x-0 top-0 z-20">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500 text-white shadow-lg shadow-indigo-500/30">
              <GraduationCap className="h-5 w-5" />
            </div>
            <span className="text-sm font-semibold tracking-tight text-white">{APP_NAME}</span>
          </div>
          <div className="flex items-center gap-2">
            {session ? (
              <Link to="/dashboard">
                <Button size="sm">Go to dashboard</Button>
              </Link>
            ) : (
              <>
                <Link to="/login">
                  <Button size="sm" variant="ghost" className="text-slate-200 hover:bg-white/10 hover:text-white">
                    Sign in
                  </Button>
                </Link>
                <Link to="/signup">
                  <Button size="sm" className="bg-white text-slate-900 hover:bg-slate-100">
                    Get started
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden bg-slate-950 pb-24 pt-32 text-white">
        <div className="pointer-events-none absolute -left-32 top-10 h-96 w-96 rounded-full bg-indigo-600/25 blur-3xl" />
        <div className="pointer-events-none absolute -right-20 top-40 h-80 w-80 rounded-full bg-violet-500/20 blur-3xl" />
        <div className="relative mx-auto grid max-w-6xl gap-12 px-5 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-indigo-200">
              <Sparkles className="h-3.5 w-3.5" />
              One platform for every placement stakeholder
            </span>
            <h1 className="mt-5 text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
              Internships that connect
              <span className="bg-gradient-to-r from-indigo-300 to-violet-300 bg-clip-text text-transparent"> universities, students, and companies.</span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-300">
              Publish opportunities across campuses, manage applications and placements, review weekly logs, and
              record final grades — without spreadsheets, email threads, or scattered documents.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link to={session ? '/dashboard' : '/signup'}>
                <Button size="lg" className="bg-indigo-500 hover:bg-indigo-400">
                  {session ? 'Open dashboard' : 'Create a student account'}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/login">
                <Button size="lg" variant="ghost" className="border border-white/15 text-white hover:bg-white/10">
                  Sign in
                </Button>
              </Link>
            </div>
            <p className="mt-5 text-xs text-slate-400">
              Demo accounts are available on the sign-in page.
            </p>
          </div>

          <div className="relative">
            <div className="absolute inset-0 -rotate-2 rounded-3xl bg-gradient-to-br from-indigo-500/30 to-violet-500/10 blur-xl" />
            <div className="relative rounded-2xl border border-white/10 bg-slate-900/80 p-5 shadow-2xl backdrop-blur">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Placement overview</p>
                  <p className="mt-1 text-sm font-semibold text-white">Ava Thompson · Acme Software</p>
                </div>
                <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-300 ring-1 ring-inset ring-emerald-400/20">
                  Active
                </span>
              </div>
              <div className="mt-5 grid grid-cols-3 gap-2">
                {[
                  { label: 'Weekly logs', value: '4' },
                  { label: 'Hours', value: '130' },
                  { label: 'Midterm', value: '4.25' },
                ].map((item) => (
                  <div key={item.label} className="rounded-xl border border-white/5 bg-white/5 p-3">
                    <p className="text-[11px] text-slate-400">{item.label}</p>
                    <p className="mt-1 text-lg font-semibold text-white">{item.value}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 space-y-2">
                {[
                  { title: 'Week 4 log needs revision', detail: 'Site supervisor · 3 days ago', tone: 'bg-amber-400' },
                  { title: 'Midterm evaluation submitted', detail: 'Grace Okafor · 20 days ago', tone: 'bg-emerald-400' },
                  { title: 'Faculty check-in logged', detail: 'Dr. Alan Reyes · 18 days ago', tone: 'bg-indigo-400' },
                ].map((row) => (
                  <div key={row.title} className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2.5">
                    <span className={`h-2 w-2 rounded-full ${row.tone}`} />
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-slate-200">{row.title}</p>
                      <p className="text-[11px] text-slate-500">{row.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-16">
        <div className="grid gap-8 lg:grid-cols-2 lg:items-start">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600">Built for the whole program</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
              Every stakeholder in one workflow
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              SIMS is a multi-tenant platform: universities and companies each get their own isolated workspace,
              while students can discover opportunities across every partner institution.
            </p>
            <ul className="mt-6 space-y-3">
              {checklist.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-slate-700">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                  {item}
                </li>
              ))}
            </ul>
            <div className="mt-8 flex gap-2">
              <Link to="/login">
                <Button variant="secondary">Explore the demo</Button>
              </Link>
              <Link to="/signup">
                <Button variant="ghost">Student sign up</Button>
              </Link>
            </div>
          </div>

          <div className="grid gap-4">
            {features.map((feature) => (
              <div key={feature.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                  <feature.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-3 text-sm font-semibold text-slate-900">{feature.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-500">{feature.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-slate-200 bg-slate-50">
        <div className="mx-auto grid max-w-6xl gap-6 px-5 py-12 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Briefcase, label: 'Opportunities', value: 'Internships & graduate roles' },
            { icon: ClipboardCheck, label: 'Approvals', value: 'Logs, evaluations, grades' },
            { icon: Building2, label: 'Companies', value: 'Target specific campuses' },
            { icon: Users, label: 'Students', value: 'One application timeline' },
          ].map((item) => (
            <div key={item.label} className="flex items-start gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-slate-600 shadow-sm ring-1 ring-slate-200">
                <item.icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{item.label}</p>
                <p className="mt-0.5 text-sm font-medium text-slate-800">{item.value}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-6 text-xs text-slate-500">
          <p>© {new Date().getFullYear()} {APP_NAME}. Student Internship Management System.</p>
          <div className="flex gap-4">
            <Link to="/login" className="hover:text-slate-800">Sign in</Link>
            <Link to="/signup" className="hover:text-slate-800">Student sign up</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
