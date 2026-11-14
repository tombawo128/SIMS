import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  Briefcase,
  Building2,
  CheckCircle2,
  ChevronRight,
  GraduationCap,
  LineChart,
  Sparkles,
  ShieldCheck,
  ClipboardCheck,
  FileText,
  Bell,
  Users,
  Workflow,
  BarChart3,
  CalendarCheck,
  CircleHelp,
  Zap,
} from 'lucide-react';
import { APP_NAME } from '@sims/shared';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui';
import { cn } from '@/lib/utils';



const roles = [
  {
    icon: GraduationCap,
    title: 'Students',
    body: 'Discover internships across every partner campus, apply in minutes, and track your entire placement journey in one place.',
    color: 'landing-gradient-indigo-1',
    bg: 'landing-bg-indigo-50-1',
    text: 'landing-text-indigo-600-1',
  },
  {
    icon: Building2,
    title: 'Universities',
    body: 'Give coordinators and faculty a single hub to manage placements, approve weekly logs, and monitor learning outcomes.',
    color: 'landing-gradient-violet-1',
    bg: 'landing-bg-violet-50-1',
    text: 'landing-text-violet-600-1',
  },
  {
    icon: Briefcase,
    title: 'Companies',
    body: 'Post roles to targeted campuses, review applicants instantly, and supervise interns with structured evaluations.',
    color: 'landing-gradient-emerald-1',
    bg: 'landing-bg-emerald-50-1',
    text: 'landing-text-emerald-600-1',
  },
];

const steps = [
  {
    step: '01',
    icon: Briefcase,
    title: 'Post & Discover',
    body: 'Companies publish internships and graduate roles. Students browse and apply with a few clicks.',
  },
  {
    step: '02',
    icon: CheckCircle2,
    title: 'Review & Place',
    body: 'Coordinators review applications, match students to opportunities, and confirm placements.',
  },
  {
    step: '03',
    icon: BookOpen,
    title: 'Log & Evaluate',
    body: 'Students submit weekly logs. Supervisors and faculty provide feedback and midterm evaluations.',
  },
  {
    step: '04',
    icon: LineChart,
    title: 'Grade & Report',
    body: 'Final evaluations are submitted, grades are recorded, and program reports are generated automatically.',
  },
];

const stats = [
  { value: '4', label: 'Connected workflow stages' },
  { value: '3', label: 'Core stakeholder groups' },
  { value: '1', label: 'Central workspace' },
  { value: 'End-to-end', label: 'Placement visibility' },
];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function Landing() {
  const { session } = useAuth();

  return (
    <div className='landing-min-h-screen-1'>
      {/* ── Navigation ──────────────────────────────────────────── */}
      <header className='landing-absolute-1'>
        <div className='landing-mx-auto-1'>
          <Link to="/" className='landing-flex-1'>
            <div className='landing-flex-2'>
              <GraduationCap className='landing-h-5-1' />
            </div>
            <span className='landing-text-base-1'>{APP_NAME}</span>
          </Link>

          <nav className='landing-hidden-1'>
            <a href="#features" className='landing-transition-1'>Features</a>
            <a href="#how-it-works" className='landing-transition-1'>How it works</a>
            <a href="#capabilities" className='landing-transition-1'>Capabilities</a>
            <a href="#security" className='landing-transition-1'>Security</a>
            <a href="#faq" className='landing-transition-1'>FAQ</a>
          </nav>

          <div className='landing-flex-3'>
            {session ? (
              <Link to="/dashboard">
                <Button size="sm" className='landing-bg-white-1'>
                  Dashboard
                  <ChevronRight className='landing-h-35-1' />
                </Button>
              </Link>
            ) : (
              <>
                <Link to="/login">
                  <Button size="sm" variant="ghost" className='landing-text-slate-300-1'>
                    Sign in
                  </Button>
                </Link>
                <Link to="/signup">
                  <Button size="sm" className='landing-bg-white-2'>
                    Get started free
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section className='landing-relative-1'>
        {/* Animated gradient blobs */}
        <div className='landing-pointer-events-none-1' />
        <div className='landing-pointer-events-none-2' />
        <div className='landing-pointer-events-none-3' />

        <div className='landing-relative-2'>
          <div className='landing-mx-auto-2'>
            <span className='landing-inline-flex-1'>
              <Sparkles className='landing-h-35-1' />
              The modern internship management platform
            </span>

            <h1 className='landing-mt-8-1'>
              Where internships{' '}
              <span className='landing-bg-gradient-to-r-1'>
                actually work
              </span>
            </h1>

            <p className='landing-mx-auto-3'>
              Connect universities, students, and companies on one platform. From posting opportunities
              to final grades — no spreadsheets, no email chains, no chaos.
            </p>

            <div className='landing-mt-10-1'>
              <Link to={session ? '/dashboard' : '/signup'}>
                <Button size="lg" className='landing-bg-indigo-500-1'>
                  {session ? 'Go to dashboard' : 'Start for free'}
                  <ArrowRight className='landing-h-4-1' />
                </Button>
              </Link>
              <Link to="/login">
                <Button size="lg" variant="ghost" className='landing-border-1'>
                  Sign in
                </Button>
              </Link>
            </div>

          </div>

          {/* Hero preview card */}
          <div className='landing-relative-3'>
            <div className='landing-absolute-2' />
            <div className='landing-relative-4'>
              {/* Window chrome */}
              <div className='landing-flex-5'>
                <span className='landing-h-25-1' />
                <span className='landing-h-25-2' />
                <span className='landing-h-25-3' />
                <span className='landing-ml-3-1'>sims-dashboard</span>
              </div>

              <div className='landing-p-5-1'>
                <div className='landing-flex-6'>
                  <div>
                    <p className='landing-text-11px-1'>Active placement</p>
                    <p className='landing-mt-1-1'>Ava Thompson · Acme Software</p>
                  </div>
                  <span className='landing-rounded-full-1'>
                    Active
                  </span>
                </div>

                <div className='landing-mt-5-1'>
                  {[
                    { label: 'Weekly logs', value: '4 / 6' },
                    { label: 'Hours logged', value: '130' },
                    { label: 'Midterm score', value: '4.25' },
                  ].map((item) => (
                    <div key={item.label} className='landing-rounded-xl-1'>
                      <p className='landing-text-10px-1'>{item.label}</p>
                      <p className='landing-mt-15-1'>{item.value}</p>
                    </div>
                  ))}
                </div>

                <div className='landing-mt-4-1'>
                  {[
                    { title: 'Week 4 log needs revision', detail: 'Site supervisor · 3 days ago', dot: 'landing-dot-amber-1' },
                    { title: 'Midterm evaluation submitted', detail: 'Faculty · 20 days ago', dot: 'landing-dot-emerald-1' },
                    { title: 'Faculty check-in logged', detail: 'Dr. Alan Reyes · 18 days ago', dot: 'landing-dot-indigo-1' },
                  ].map((row) => (
                    <div key={row.title} className='landing-flex-7'>
                      <span className={cn('landing-h-2-1', row.dot)} />
                      <div className='landing-min-w-0-1'>
                        <p className='landing-truncate-1'>{row.title}</p>
                        <p className='landing-text-11px-2'>{row.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats bar ────────────────────────────────────────────── */}
      <section className='landing-border-b-1'>
        <div className='landing-mx-auto-4'>
          {stats.map((stat) => (
            <div key={stat.label} className='landing-text-center-1'>
              <p className='landing-text-3xl-1'>{stat.value}</p>
              <p className='landing-mt-1-2'>{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features (roles) ─────────────────────────────────────── */}
      <section id="features" className='landing-mx-auto-5'>
        <div className='landing-mx-auto-6'>
          <p className='landing-text-xs-1'>Built for everyone</p>
          <h2 className='landing-mt-3-1'>
            One platform, every stakeholder
          </h2>
          <p className='landing-mt-4-2'>
            Whether you're a student looking for your first role, a university managing hundreds of placements,
            or a company searching for fresh talent — SIMS brings it all together.
          </p>
        </div>

        <div className='landing-mt-16-1'>
          {roles.map((role) => (
            <div
              key={role.title}
              className='group landing-relative-5'
            >
              <div className={cn('landing-inline-flex-3', role.bg, role.text)}>
                <role.icon className='landing-h-6-1' />
              </div>
              <h3 className='landing-mt-5-2'>{role.title}</h3>
              <p className='landing-mt-2-1'>{role.body}</p>
              <div className={cn('landing-absolute-3', role.color)} />
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────── */}
      <section id="how-it-works" className='landing-bg-slate-50-1'>
        <div className='landing-mx-auto-5'>
          <div className='landing-mx-auto-6'>
            <p className='landing-text-xs-1'>Simple process</p>
            <h2 className='landing-mt-3-1'>
              From posting to final grade
            </h2>
            <p className='landing-mt-4-2'>
              The entire internship lifecycle in four clear steps. No manual hand-offs, no lost paperwork.
            </p>
          </div>

          <div className='landing-relative-6'>
            {/* Connecting line (desktop) */}
            <div className='landing-pointer-events-none-4' />

            {steps.map((step) => (
              <div key={step.step} className='landing-relative-7'>
                <div className='landing-relative-8'>
                  <div className='landing-absolute-4' />
                  <step.icon className='landing-relative-9' />
                  <span className='landing-absolute-5'>
                    {step.step}
                  </span>
                </div>
                <h3 className='landing-mt-5-3'>{step.title}</h3>
                <p className='landing-mt-2-1'>{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Platform capabilities ───────────────────────────────── */}
      <section id="capabilities" className="sims-landing-section">
        <div className="sims-landing-container">
          <div className="sims-landing-heading">
            <span className="sims-landing-eyebrow">A connected workspace</span>
            <h2>Everything the internship journey needs.</h2>
            <p>Keep every stage, document and decision connected — from the first application to the final evaluation.</p>
          </div>
          <div className="sims-capability-grid">
            {[
              { icon: Briefcase, title: 'Opportunity management', body: 'Publish internship opportunities, manage listings and keep role information organised.' },
              { icon: ClipboardCheck, title: 'Application tracking', body: 'Review applications, follow decisions and keep each applicant’s progress visible.' },
              { icon: CalendarCheck, title: 'Placement coordination', body: 'Manage confirmed placements, key dates, supervisors and placement progress.' },
              { icon: FileText, title: 'Daily and weekly reports', body: 'Give students a structured place to record work, reflect on learning and submit reports.' },
              { icon: Users, title: 'Supervisor collaboration', body: 'Connect students, site supervisors, faculty supervisors and coordinators around the same placement.' },
              { icon: BarChart3, title: 'Analytics and reporting', body: 'Turn placement activity and submitted evaluations into clearer programme oversight.' },
              { icon: Bell, title: 'Notifications and updates', body: 'Keep important application, placement and review activity visible to the right people.' },
              { icon: Workflow, title: 'Connected administration', body: 'Bring people, organisations, access and operational workflows into one managed system.' },
            ].map((item) => (
              <article className="sims-capability-card" key={item.title}>
                <span className="sims-capability-icon"><item.icon size={21} /></span>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── Accountability and security ─────────────────────────── */}
      <section id="security" className="sims-landing-section sims-landing-security">
        <div className="sims-landing-container sims-security-layout">
          <div className="sims-landing-heading sims-security-heading">
            <span className="sims-landing-eyebrow">Built for accountability</span>
            <h2>Clear responsibilities. Better oversight.</h2>
            <p>Internship management involves several people and important decisions. SIMS gives each role a structured place in the process.</p>
          </div>
          <div className="sims-security-list">
            {[
              ['Role-aware workspaces', 'Students, supervisors, coordinators and company teams work within role-appropriate areas.'],
              ['Structured reviews', 'Reports and evaluations follow a defined review process instead of scattered messages.'],
              ['Centralised records', 'Keep application, placement and progress information together for easier follow-up.'],
              ['Administrative oversight', 'Platform administration tools support user management, activity visibility and system operations.'],
            ].map(([title, body]) => (
              <div className="sims-security-item" key={title}>
                <span><ShieldCheck size={19} /></span>
                <div><h3>{title}</h3><p>{body}</p></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Frequently asked questions ──────────────────────────── */}
      <section id="faq" className="sims-landing-section">
        <div className="sims-landing-container">
          <div className="sims-landing-heading">
            <span className="sims-landing-eyebrow">Questions, answered</span>
            <h2>Get to know SIMS.</h2>
            <p>A quick overview of who the platform is for and how the workflow fits together.</p>
          </div>
          <div className="sims-faq-grid">
            {[
              ['Who can use SIMS?', 'SIMS is designed for students, university coordinators, faculty supervisors, company administrators and site supervisors involved in internship programmes.'],
              ['Can students track their internship progress?', 'Yes. Students can follow applications and placements, submit required reports and keep track of feedback and evaluation activity available to them.'],
              ['How are internship reports reviewed?', 'Students submit their reports through the platform. The relevant supervisors and faculty can review submissions and provide feedback as part of the internship workflow.'],
              ['Can companies manage opportunities?', 'Company teams can manage internship postings, review applicants and participate in supervising and evaluating interns.'],
              ['Where do I start?', 'If your account has already been created, sign in. New users can use the account registration flow to get started where registration is available.'],
            ].map(([question, answer]) => (
              <details className="sims-faq-item" key={question}>
                <summary><span>{question}</span><CircleHelp size={18} /></summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────── */}
      <section className='landing-relative-10'>
        <div className='landing-pointer-events-none-5' />
        <div className='landing-pointer-events-none-6' />

        <div className='landing-relative-11'>
          <div className='landing-mx-auto-7'>
            <Zap className='landing-h-7-1' />
          </div>
          <h2 className='landing-mt-6-2'>
            Ready to simplify internship management?
          </h2>
          <p className='landing-mx-auto-8'>
            Bring internship opportunities, placement coordination, reporting and evaluation into one organised workflow.
          </p>
          <div className='landing-mt-10-1'>
            <Link to={session ? '/dashboard' : '/signup'}>
              <Button size="lg" className='landing-bg-indigo-500-2'>
                {session ? 'Open dashboard' : 'Get started free'}
                <ArrowRight className='landing-h-4-1' />
              </Button>
            </Link>
            <Link to="/login">
              <Button size="lg" variant="ghost" className='landing-border-1'>
                Sign in to your account
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────── */}
      <footer className='landing-border-t-1'>
        <div className='landing-mx-auto-9'>
          <div className='landing-flex-1'>
            <div className='landing-flex-10'>
              <GraduationCap className='landing-h-4-1' />
            </div>
            <span className='landing-text-sm-1'>{APP_NAME}</span>
          </div>
          <p className='landing-text-xs-2'>
            © {new Date().getFullYear()} {APP_NAME}. Student Internship Management System. All rights reserved.
          </p>
          <div className='landing-flex-11'>
            <Link to="/login" className='landing-text-slate-500-1'>Sign in</Link>
            <Link to="/signup" className='landing-text-slate-500-1'>Create account</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
