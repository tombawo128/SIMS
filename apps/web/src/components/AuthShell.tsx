import { Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, GraduationCap } from 'lucide-react';
import { APP_NAME } from '@sims/shared';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

const points = [
  'University and company workspaces stay isolated',
  'One application-to-grade workflow',
  'Weekly logs and evaluations built in',
];

export function AuthShell({
  title,
  subtitle,
  children,
  wide = false,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="min-h-screen bg-slate-50 lg:grid lg:grid-cols-[1.05fr_0.95fr]">
      <aside className="relative hidden overflow-hidden bg-slate-950 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute -left-24 -top-24 h-96 w-96 rounded-full bg-indigo-600/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-violet-500/20 blur-3xl" />

        <Link to="/" className="relative flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500 text-white shadow-lg shadow-indigo-500/30">
            <GraduationCap className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold tracking-tight">{APP_NAME}</p>
            <p className="text-[11px] text-slate-400">Internships & opportunities</p>
          </div>
        </Link>

        <div className="relative max-w-md">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-300">
            Multi-university, multi-company
          </p>
          <h2 className="mt-3 text-3xl font-semibold leading-tight tracking-tight">
            The operating system for student placements.
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-slate-300">
            From the first application to the final grade, every stakeholder works from the same source of truth.
          </p>
          <ul className="mt-8 space-y-3">
            {points.map((point) => (
              <li key={point} className="flex items-center gap-2.5 text-sm text-slate-300">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                {point}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur">
          <p className="text-sm leading-relaxed text-slate-300">
            “We replaced three spreadsheets and a shared inbox with one workflow. Faculty finally see the evidence
            behind every grade.”
          </p>
          <p className="mt-3 text-xs font-medium text-slate-400">Dana Whitfield · Internship Coordinator</p>
        </div>
      </aside>

      <main className="flex min-h-screen items-start justify-center px-4 py-8 sm:px-6 lg:items-center lg:py-12">
        <div className={cn('w-full', wide ? 'max-w-xl' : 'max-w-md')}>
          <div className="mb-8 flex items-center justify-between lg:hidden">
            <Link to="/" className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white">
                <GraduationCap className="h-5 w-5" />
              </div>
              <span className="text-sm font-semibold tracking-tight text-slate-900">{APP_NAME}</span>
            </Link>
            <Link to="/" className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800">
              <ArrowLeft className="h-3.5 w-3.5" />
              Home
            </Link>
          </div>

          <div className="mb-7">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
            <p className="mt-1.5 text-sm text-slate-500">{subtitle}</p>
          </div>

          {children}

          <Link
            to="/"
            className="mt-8 hidden items-center gap-1 text-xs font-medium text-slate-400 transition hover:text-slate-700 lg:inline-flex"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to home
          </Link>
        </div>
      </main>
    </div>
  );
}
