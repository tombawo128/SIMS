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
    <div className='auth-shell'>
      <aside className='auth-aside'>
        <div className='auth-aside__blob-1' />
        <div className='auth-aside__blob-2' />

        <Link to="/" className='auth-aside__brand'>
          <div className='auth-aside__logo'>
            <GraduationCap className='icon-lg' />
          </div>
          <div>
            <p className='auth-aside__app-name'>{APP_NAME}</p>
            <p className='auth-aside__app-tagline'>Internships & opportunities</p>
          </div>
        </Link>

        <div className='auth-aside__hero'>
          <p className='auth-aside__eyebrow'>
            Multi-university, multi-company
          </p>
          <h2 className='auth-aside__headline'>
            The operating system for student placements.
          </h2>
          <p className='auth-aside__subhead'>
            From the first application to the final grade, every stakeholder works from the same source of truth.
          </p>
          <ul className='auth-aside__points'>
            {points.map((point) => (
              <li key={point} className='auth-aside__point'>
                <CheckCircle2 className='auth-aside__point-icon' />
                {point}
              </li>
            ))}
          </ul>
        </div>

        <div className='auth-aside__quote'>
          <p className='auth-aside__quote-text'>
            “We replaced three spreadsheets and a shared inbox with one workflow. Faculty finally see the evidence
            behind every grade.”
          </p>
          <p className='auth-aside__quote-author'>Dana Whitfield · Internship Coordinator</p>
        </div>
      </aside>

      <main className='auth-main'>
        <div className={cn('auth-form-wrap', wide ? 'auth-form-wrap--wide' : 'auth-form-wrap--narrow')}>
          <div className='auth-mobile-bar'>
            <Link to="/" className='auth-mobile-brand'>
              <div className='auth-mobile-logo'>
                <GraduationCap className='icon-lg' />
              </div>
              <span className='auth-mobile-name'>{APP_NAME}</span>
            </Link>
            <Link to="/" className='auth-mobile-home'>
              <ArrowLeft className='icon-sm' />
              Home
            </Link>
          </div>

          <div className='auth-heading'>
            <h1 className='auth-heading__title'>{title}</h1>
            <p className='auth-heading__subtitle'>{subtitle}</p>
          </div>

          {children}

          <Link
            to="/"
            className='auth-back'
          >
            <ArrowLeft className='icon-sm' />
            Back to home
          </Link>
        </div>
      </main>
    </div>
  );
}
