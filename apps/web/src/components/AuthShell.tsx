import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Check, GraduationCap } from 'lucide-react';
import { APP_NAME } from '@sims/shared';
import { cn } from '@/lib/utils';
import './auth-shell.css';

const points = [
  'University and company workspaces stay separate',
  'One workflow from application to final grade',
  'Weekly logs and evaluations built in',
];

interface AuthShellProps {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Wider form card, used by the sign up page. */
  wide?: boolean;
  children: ReactNode;
}

/** Shared frame for the sign in, sign up and password pages. */
export function AuthShell({ title, subtitle, wide = false, children }: AuthShellProps) {
  return (
    <div className="sims-auth">
      {/* Information panel (large screens only) */}
      <aside className="sims-auth__aside">
        <Link to="/" className="sims-auth__aside-brand">
          <span className="sims-auth__aside-logo">
            <GraduationCap className="sims-auth__brand-icon" />
          </span>
          <span className="sims-auth__aside-name">{APP_NAME}</span>
        </Link>

        <div className="sims-auth__aside-body">
          <span className="sims-auth__aside-kicker">THE SIMS PLATFORM</span>
          <h2 className="sims-auth__aside-title">
            A clearer way to manage the entire internship journey.
          </h2>
          <p className="sims-auth__aside-text">
            One connected workspace for opportunities, applications, placements, weekly reporting and evaluation.
          </p>
          <div className="sims-auth__aside-flow" aria-label="Internship workflow">
            <span><b>01</b> Discover</span><i /><span><b>02</b> Place</span><i /><span><b>03</b> Review</span><i /><span><b>04</b> Evaluate</span>
          </div>

          <ul className="sims-auth__aside-list">
            {points.map((point) => (
              <li key={point} className="sims-auth__aside-item">
                <Check className="sims-auth__aside-check" />
                {point}
              </li>
            ))}
          </ul>
        </div>

        <p className="sims-auth__aside-foot">
          &copy; {new Date().getFullYear()} {APP_NAME}
        </p>
      </aside>

      <main className="sims-auth__main">
        {/* Brand bar (small screens only) */}
        <div className="sims-auth__bar">
          <Link to="/" className="sims-auth__aside-brand">
            <span className="sims-auth__aside-logo">
              <GraduationCap className="sims-auth__brand-icon" />
            </span>
            <span className="sims-auth__aside-name">{APP_NAME}</span>
          </Link>
        </div>

        <div className="sims-auth__content">
          <div className={cn('sims-auth__inner', wide && 'sims-auth__inner--wide')}>
            <div className="sims-auth__card">
              <h1 className="sims-auth__title">{title}</h1>
              {subtitle ? <p className="sims-auth__subtitle">{subtitle}</p> : null}
              <div className="sims-auth__body">{children}</div>
            </div>

            <Link to="/" className="sims-auth__back">
              <ArrowLeft className="sims-auth__back-icon" />
              Back to home
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
