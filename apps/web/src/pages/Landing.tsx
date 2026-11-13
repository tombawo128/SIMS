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
  Zap,
  ClipboardCheck,
  FileText,
  Search,
  Users,
  ShieldCheck,
  BarChart3,
  Building,
} from 'lucide-react';

import { APP_NAME } from '@sims/shared';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui';
import { cn } from '@/lib/utils';


// ============================================================
// USER ROLES — PRESERVED
// ============================================================

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


// ============================================================
// INTERNSHIP LIFECYCLE — UPDATED
// ============================================================

const steps = [
  {
    step: '01',
    icon: Search,
    title: 'Discover Opportunities',
    body: 'Companies publish internship opportunities while students explore available positions and find opportunities relevant to their academic interests.',
  },
  {
    step: '02',
    icon: ClipboardCheck,
    title: 'Apply & Get Placed',
    body: 'Students submit applications, companies review candidates, and university coordinators oversee the placement process.',
  },
  {
    step: '03',
    icon: FileText,
    title: 'Monitor Internship Progress',
    body: 'Students maintain weekly activity logs while workplace supervisors and university coordinators monitor progress and provide feedback.',
  },
  {
    step: '04',
    icon: GraduationCap,
    title: 'Evaluate & Complete',
    body: 'Supervisors submit internship evaluations, faculty assess student performance, and coordinators manage final academic records.',
  },
];


// ============================================================
// PLATFORM CAPABILITIES — UPDATED
// ============================================================

const stats = [
  {
    value: '01',
    label: 'Opportunity Management',
  },
  {
    value: '02',
    label: 'Placement Coordination',
  },
  {
    value: '03',
    label: 'Progress Monitoring',
  },
  {
    value: '04',
    label: 'Performance Evaluation',
  },
];


// ============================================================
// PLATFORM OVERVIEW — REPLACES TESTIMONIALS
// ============================================================

const platformFeatures = [
  {
    icon: Briefcase,
    title: 'Internship Opportunities',
    category: 'OPPORTUNITY MANAGEMENT',
    description:
      'A centralized environment for companies to publish internship opportunities and for students to discover and apply for available positions.',
  },
  {
    icon: Users,
    title: 'Coordinated Placements',
    category: 'PLACEMENT MANAGEMENT',
    description:
      'Bring students, university coordinators and company representatives together to manage applications, placement decisions and internship assignments.',
  },
  {
    icon: BarChart3,
    title: 'Academic Monitoring',
    category: 'PERFORMANCE TRACKING',
    description:
      'Support the internship evaluation process through weekly activity logs, supervisor feedback, academic assessments and performance reporting.',
  },
];


// ============================================================
// LANDING PAGE COMPONENT
// ============================================================

export function Landing() {
  const { session } = useAuth();

  return (
    <div className='landing-min-h-screen-1'>

      {/* ======================================================
          NAVIGATION
      ====================================================== */}

      <header className='landing-absolute-1'>
        <div className='landing-mx-auto-1'>

          <Link to="/" className='landing-flex-1'>
            <div className='landing-flex-2'>
              <GraduationCap className='landing-h-5-1' />
            </div>

            <span className='landing-text-base-1'>
              {APP_NAME}
            </span>
          </Link>

          <nav className='landing-hidden-1'>
            <a href="#features" className='landing-transition-1'>
              Features
            </a>

            <a href="#how-it-works" className='landing-transition-1'>
              How it works
            </a>

            <a href="#platform-overview" className='landing-transition-1'>
              Platform
            </a>
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
                  <Button
                    size="sm"
                    variant="ghost"
                    className='landing-text-slate-300-1'
                  >
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


      {/* ======================================================
          HERO SECTION
      ====================================================== */}

      <section className='landing-relative-1'>

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
              Connect universities, students, and companies on one
              platform. From posting opportunities to final grades —
              no spreadsheets, no email chains, no chaos.
            </p>

            <div className='landing-mt-10-1'>

              <Link to={session ? '/dashboard' : '/signup'}>
                <Button
                  size="lg"
                  className='landing-bg-indigo-500-1'
                >
                  {session ? 'Go to dashboard' : 'Start for free'}
                  <ArrowRight className='landing-h-4-1' />
                </Button>
              </Link>

              <Link to="/login">
                <Button
                  size="lg"
                  variant="ghost"
                  className='landing-border-1'
                >
                  Sign in
                </Button>
              </Link>

            </div>

            {/* Trust badge */}

            <div className='landing-mt-12-1'>

              <div className='landing-flex-4'>

                {['A', 'B', 'C', 'D'].map((letter) => (
                  <span
                    key={letter}
                    className='landing-inline-flex-2'
                  >
                    {letter}
                  </span>
                ))}

              </div>

              <span className='landing-ml-2-1'>
                Built for universities & companies
              </span>

            </div>

          </div>


          {/* Dashboard Preview */}

          <div className='landing-relative-3'>

            <div className='landing-absolute-2' />

            <div className='landing-relative-4'>

              <div className='landing-flex-5'>

                <span className='landing-h-25-1' />
                <span className='landing-h-25-2' />
                <span className='landing-h-25-3' />

                <span className='landing-ml-3-1'>
                  sims-dashboard
                </span>

              </div>

              <div className='landing-p-5-1'>

                <div className='landing-flex-6'>

                  <div>
                    <p className='landing-text-11px-1'>
                      Active placement
                    </p>

                    <p className='landing-mt-1-1'>
                      Ava Thompson · Acme Software
                    </p>
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

                    <div
                      key={item.label}
                      className='landing-rounded-xl-1'
                    >
                      <p className='landing-text-10px-1'>
                        {item.label}
                      </p>

                      <p className='landing-mt-15-1'>
                        {item.value}
                      </p>
                    </div>

                  ))}

                </div>


                <div className='landing-mt-4-1'>

                  {[
                    {
                      title: 'Week 4 log needs revision',
                      detail: 'Site supervisor · 3 days ago',
                      dot: 'landing-dot-amber-1',
                    },
                    {
                      title: 'Midterm evaluation submitted',
                      detail: 'Faculty · 20 days ago',
                      dot: 'landing-dot-emerald-1',
                    },
                    {
                      title: 'Faculty check-in logged',
                      detail: 'Dr. Alan Reyes · 18 days ago',
                      dot: 'landing-dot-indigo-1',
                    },
                  ].map((row) => (

                    <div
                      key={row.title}
                      className='landing-flex-7'
                    >

                      <span
                        className={cn(
                          'landing-h-2-1',
                          row.dot
                        )}
                      />

                      <div className='landing-min-w-0-1'>

                        <p className='landing-truncate-1'>
                          {row.title}
                        </p>

                        <p className='landing-text-11px-2'>
                          {row.detail}
                        </p>

                      </div>

                    </div>

                  ))}

                </div>

              </div>

            </div>

          </div>

        </div>

      </section>


      {/* ======================================================
          PLATFORM CAPABILITIES
      ====================================================== */}

      <section className='landing-border-b-1'>

        <div className='landing-mx-auto-4'>

          {stats.map((stat) => (

            <div
              key={stat.label}
              className='landing-text-center-1'
            >

              <p className='landing-text-3xl-1'>
                {stat.value}
              </p>

              <p className='landing-mt-1-2'>
                {stat.label}
              </p>

            </div>

          ))}

        </div>

      </section>


      {/* ======================================================
          FEATURES — USER ROLES
          PRESERVED
      ====================================================== */}

      <section
        id="features"
        className='landing-mx-auto-5'
      >

        <div className='landing-mx-auto-6'>

          <p className='landing-text-xs-1'>
            Built for everyone
          </p>

          <h2 className='landing-mt-3-1'>
            One platform, every stakeholder
          </h2>

          <p className='landing-mt-4-2'>
            Whether you're a student looking for your first role,
            a university managing hundreds of placements, or a
            company searching for fresh talent — SIMS brings it
            all together.
          </p>

        </div>


        <div className='landing-mt-16-1'>

          {roles.map((role) => (

            <div
              key={role.title}
              className='group landing-relative-5'
            >

              <div
                className={cn(
                  'landing-inline-flex-3',
                  role.bg,
                  role.text
                )}
              >
                <role.icon className='landing-h-6-1' />
              </div>

              <h3 className='landing-mt-5-2'>
                {role.title}
              </h3>

              <p className='landing-mt-2-1'>
                {role.body}
              </p>

              <div
                className={cn(
                  'landing-absolute-3',
                  role.color
                )}
              />

            </div>

          ))}

        </div>

      </section>


      {/* ======================================================
          INTERNSHIP LIFECYCLE
          UPDATED
      ====================================================== */}

      <section
        id="how-it-works"
        className='landing-bg-slate-50-1'
      >

        <div className='landing-mx-auto-5'>

          <div className='landing-mx-auto-6'>

            <p className='landing-text-xs-1'>
              THE INTERNSHIP LIFECYCLE
            </p>

            <h2 className='landing-mt-3-1'>
              From opportunity to completion
            </h2>

            <p className='landing-mt-4-2'>
              SIMS brings the complete internship process into
              one coordinated environment, connecting applications,
              placements, supervision and academic evaluation.
            </p>

          </div>


          <div className='landing-relative-6'>

            {/* Connecting line */}

            <div className='landing-pointer-events-none-4' />

            {steps.map((step) => (

              <div
                key={step.step}
                className='landing-relative-7'
              >

                <div className='landing-relative-8'>

                  <div className='landing-absolute-4' />

                  <step.icon className='landing-relative-9' />

                  <span className='landing-absolute-5'>
                    {step.step}
                  </span>

                </div>

                <h3 className='landing-mt-5-3'>
                  {step.title}
                </h3>

                <p className='landing-mt-2-1'>
                  {step.body}
                </p>

              </div>

            ))}

          </div>

        </div>

      </section>


      {/* ======================================================
          PLATFORM OVERVIEW
          REPLACES TESTIMONIALS
      ====================================================== */}

      <section
        id="platform-overview"
        className='landing-mx-auto-5'
      >

        <div className='landing-mx-auto-6'>

          <p className='landing-text-xs-1'>
            THE SIMS ECOSYSTEM
          </p>

          <h2 className='landing-mt-3-1'>
            More than an internship portal
          </h2>

          <p className='landing-mt-4-2'>
            SIMS provides a structured digital environment for
            managing internship opportunities, coordinating
            placements and monitoring student development
            throughout the internship programme.
          </p>

        </div>


        <div className='landing-mt-14-1'>

          {platformFeatures.map((feature) => (

            <div
              key={feature.title}
              className='landing-flex-8'
            >

              {/* Feature icon */}

              <div className='landing-flex-9'>

                <feature.icon className='landing-h-6-1' />

              </div>


              {/* Category */}

              <p className='landing-text-xs-1'>
                {feature.category}
              </p>


              {/* Title */}

              <h3 className='landing-mt-4-3'>
                {feature.title}
              </h3>


              {/* Description */}

              <p className='landing-mt-4-3'>
                {feature.description}
              </p>

            </div>

          ))}

        </div>

      </section>


      {/* ======================================================
          CALL TO ACTION
          PRESERVED
      ====================================================== */}

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
            Bring students, universities and companies together
            through a more organized approach to internship
            management.
          </p>

          <div className='landing-mt-10-1'>

            <Link to={session ? '/dashboard' : '/signup'}>

              <Button
                size="lg"
                className='landing-bg-indigo-500-2'
              >

                {session ? 'Open dashboard' : 'Get started free'}

                <ArrowRight className='landing-h-4-1' />

              </Button>

            </Link>


            <Link to="/login">

              <Button
                size="lg"
                variant="ghost"
                className='landing-border-1'
              >
                Sign in to your account
              </Button>

            </Link>

          </div>

        </div>

      </section>


      {/* ======================================================
          FOOTER
          PRESERVED
      ====================================================== */}

      <footer className='landing-border-t-1'>

        <div className='landing-mx-auto-9'>

          <div className='landing-flex-1'>

            <div className='landing-flex-10'>
              <GraduationCap className='landing-h-4-1' />
            </div>

            <span className='landing-text-sm-1'>
              {APP_NAME}
            </span>

          </div>


          <p className='landing-text-xs-2'>
            © {new Date().getFullYear()} {APP_NAME}.
            Student Internship Management System.
            All rights reserved.
          </p>


          <div className='landing-flex-11'>

            <Link
              to="/login"
              className='landing-text-slate-500-1'
            >
              Sign in
            </Link>

            <Link
              to="/signup"
              className='landing-text-slate-500-1'
            >
              Create account
            </Link>

          </div>

        </div>

      </footer>

    </div>
  );
}