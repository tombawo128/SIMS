import { Link } from 'react-router-dom';
import {
  ArrowRight, ArrowUpRight, BriefcaseBusiness, Building2, Check,
  ChevronRight, ClipboardCheck, FileCheck2, GraduationCap, Layers3,
  LockKeyhole, Menu, Network, ShieldCheck, Sparkles, UsersRound,
  Workflow, X, ChartNoAxesCombined, CalendarDays, BellRing,
} from 'lucide-react';
import { useState } from 'react';
import { APP_NAME } from '@sims/shared';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui';

const audiences = [
  {
    icon: GraduationCap,
    title: 'For students',
    copy: 'Find relevant opportunities, follow every application, and keep your internship work organised from start to finish.',
    points: ['Opportunity discovery', 'Application tracking', 'Weekly activity and feedback'],
  },
  {
    icon: Building2,
    title: 'For universities',
    copy: 'Coordinate placements across students, faculty and partner organisations with a shared view of progress.',
    points: ['Student and placement oversight', 'Supervisor coordination', 'Assessment visibility'],
  },
  {
    icon: BriefcaseBusiness,
    title: 'For employers',
    copy: 'Manage internship opportunities, review applicants and support interns throughout their placement.',
    points: ['Opportunity publishing', 'Applicant review', 'Intern supervision'],
  },
];

const stages = [
  { number: '01', icon: BriefcaseBusiness, title: 'Discover opportunities', copy: 'Companies publish roles and students explore opportunities that match their interests.' },
  { number: '02', icon: ClipboardCheck, title: 'Review and place', copy: 'Applications move through review and placement coordination with clear ownership.' },
  { number: '03', icon: FileCheck2, title: 'Record progress', copy: 'Students submit weekly activity and supervisors provide structured feedback.' },
  { number: '04', icon: ChartNoAxesCombined, title: 'Evaluate outcomes', copy: 'Faculty and company supervisors contribute to evaluations and final assessment.' },
];

export function Landing() {
  const { session } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const primaryHref = session ? '/dashboard' : '/signup';

  return (
    <main className="sims-public">
      <header className="public-header">
        <div className="public-header__inner">
          <Link to="/" className="public-brand" aria-label={APP_NAME + ' home'}>
            <span className="public-brand__mark"><GraduationCap size={23} /></span>
            <span className="public-brand__name">{APP_NAME}<small>Student internship management</small></span>
          </Link>
          <button className="public-menu-toggle" type="button" aria-label={menuOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={menuOpen} onClick={() => setMenuOpen(v => !v)}>
            {menuOpen ? <X size={21} /> : <Menu size={21} />}
          </button>
          <nav className={menuOpen ? 'public-nav public-nav--open' : 'public-nav'} aria-label="Main navigation">
            <a href="#platform" onClick={() => setMenuOpen(false)}>Platform</a>
            <a href="#workflow" onClick={() => setMenuOpen(false)}>How it works</a>
            <a href="#stakeholders" onClick={() => setMenuOpen(false)}>Who it serves</a>
            <Link to="/login" className="public-nav__signin">Sign in</Link>
            <Link to={primaryHref} className="public-nav__cta">{session ? 'Open workspace' : 'Get started'} <ArrowUpRight size={16} /></Link>
          </nav>
        </div>
      </header>

      <section className="public-hero">
        <div className="public-hero__grid">
          <div className="public-hero__copy">
            <div className="public-kicker"><span /> ONE CONNECTED INTERNSHIP WORKSPACE</div>
            <h1>Make every internship <em>count.</em></h1>
            <p className="public-hero__lead">From the first application to the final evaluation, SIMS brings students, universities and employers into one organised placement journey.</p>
            <div className="public-hero__actions">
              <Link to={primaryHref}><Button size="lg">{session ? 'Go to your workspace' : 'Explore SIMS'} <ArrowRight size={17} /></Button></Link>
              <a className="public-text-link" href="#platform">Discover the platform <ChevronRight size={16} /></a>
            </div>
            <div className="public-hero__proof">
              <span><ShieldCheck size={17} /> Role-based workspaces</span>
              <span><Workflow size={17} /> Connected workflows</span>
              <span><LockKeyhole size={17} /> Managed access</span>
            </div>
          </div>

          <div className="public-product" aria-label="Illustration of the SIMS management workspace">
            <div className="public-product__glow" />
            <div className="public-product__window">
              <div className="public-product__top">
                <div className="public-product__brand"><span><GraduationCap size={15} /></span> SIMS <small>WORKSPACE</small></div>
                <div className="public-product__top-right"><span className="public-product__live" /> Workspace overview <BellRing size={15} /></div>
              </div>
              <div className="public-product__body">
                <aside className="public-product__rail">
                  <span className="is-active"><Layers3 size={15} /></span>
                  <span><BriefcaseBusiness size={15} /></span>
                  <span><UsersRound size={15} /></span>
                  <span><CalendarDays size={15} /></span>
                  <span><ChartNoAxesCombined size={15} /></span>
                </aside>
                <div className="public-product__main">
                  <div className="public-product__welcome"><div><small>WORKSPACE OVERVIEW</small><strong>Internship operations</strong><p>Keep every stage moving forward.</p></div><span className="public-product__avatar">JD</span></div>
                  <div className="public-product__metric-grid">
                    <div className="public-product__metric"><span>Applications</span><strong><ClipboardCheck size={16} /> Review queue</strong><small>Track incoming applications</small></div>
                    <div className="public-product__metric"><span>Placements</span><strong><BriefcaseBusiness size={16} /> Active journeys</strong><small>Monitor placement progress</small></div>
                    <div className="public-product__metric"><span>People</span><strong><UsersRound size={16} /> Shared oversight</strong><small>Students and supervisors</small></div>
                  </div>
                  <div className="public-product__lower">
                    <div className="public-product__panel"><div className="public-product__panel-head"><strong>Placement workflow</strong><span>VIEW ALL</span></div>{['Application review','Placement confirmation','Weekly reporting','Final evaluation'].map((item,i)=><div className="public-product__step" key={item}><span className={i < 2 ? 'public-product__step-icon done' : 'public-product__step-icon'}>{i < 2 ? <Check size={12} /> : i+1}</span><span>{item}</span><small>{i < 2 ? 'In progress' : 'Upcoming'}</small></div>)}</div>
                    <div className="public-product__panel public-product__panel--side"><div className="public-product__panel-head"><strong>Workspace pulse</strong><ChartNoAxesCombined size={15} /></div><div className="public-product__bars"><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/></div><small>Progress at a glance</small><div className="public-product__legend"><span/> Applications <span/> Placements</div></div>
                  </div>
                </div>
              </div>
            </div>
            <div className="public-float public-float--one"><span><FileCheck2 size={17}/></span><div><strong>Reports organised</strong><small>Weekly activity and reviews</small></div></div>
            <div className="public-float public-float--two"><span><ShieldCheck size={17}/></span><div><strong>One shared process</strong><small>Clear roles and responsibilities</small></div></div>
          </div>
        </div>
        <div className="public-hero__base"><span>BUILT AROUND THE INTERNSHIP JOURNEY</span><div><i/> Discover <i/> Coordinate <i/> Supervise <i/> Evaluate</div></div>
      </section>

      <section className="public-platform" id="platform">
        <div className="public-section-heading">
          <span className="public-eyebrow">THE PLATFORM</span>
          <h2>One process. Every stakeholder.<br/><em>A clearer way to work.</em></h2>
          <p>SIMS connects the operational work behind internships so information and responsibilities are easier to follow.</p>
        </div>
        <div className="public-feature-layout">
          <article className="public-feature-card public-feature-card--large">
            <div className="public-feature-card__icon"><Network size={22}/></div>
            <span className="public-feature-card__label">CONNECTED OPERATIONS</span>
            <h3>Bring the whole placement journey together.</h3>
            <p>Keep applications, placements, weekly reporting and evaluations connected instead of spreading the process across disconnected tools.</p>
            <div className="public-flow">
              {stages.map((stage,i)=><div className="public-flow__node" key={stage.number}><span>{stage.number}</span><strong>{stage.title}</strong>{i < stages.length-1 ? <ArrowRight size={15}/> : null}</div>)}
            </div>
          </article>
          <article className="public-feature-card public-feature-card--dark">
            <div className="public-feature-card__icon"><ShieldCheck size={22}/></div>
            <span className="public-feature-card__label">CONTROLLED ACCESS</span>
            <h3>Relevant workspaces for every role.</h3>
            <p>Students, faculty, coordinators and company teams work with role-appropriate tools and information.</p>
            <div className="public-role-stack"><span><GraduationCap size={16}/> Student workspace</span><span><Building2 size={16}/> University workspace</span><span><BriefcaseBusiness size={16}/> Employer workspace</span></div>
          </article>
          <article className="public-feature-card public-feature-card--wide">
            <div><div className="public-feature-card__icon"><ChartNoAxesCombined size={22}/></div><span className="public-feature-card__label">PROGRESS AND VISIBILITY</span><h3>See where work stands.</h3><p>Bring status, activity and assessment information into a more coherent view for the people responsible for moving placements forward.</p></div>
            <div className="public-visibility"><div><small>APPLICATIONS</small><strong>Review</strong><span>Application status and decisions</span></div><div><small>PLACEMENTS</small><strong>Progress</strong><span>Supervision and weekly activity</span></div><div><small>EVALUATIONS</small><strong>Outcomes</strong><span>Feedback and assessment records</span></div></div>
          </article>
        </div>
      </section>

      <section className="public-workflow" id="workflow">
        <div className="public-workflow__intro"><span className="public-eyebrow">HOW IT WORKS</span><h2>From opportunity<br/>to <em>outcome.</em></h2><p>A structured journey that helps each participant understand what happens next and what they are responsible for.</p><Link to={primaryHref} className="public-text-link">{session ? 'Continue to SIMS' : 'Start with SIMS'} <ArrowRight size={16}/></Link></div>
        <div className="public-stage-list">{stages.map(stage=><article className="public-stage" key={stage.number}><span className="public-stage__number">{stage.number}</span><span className="public-stage__icon"><stage.icon size={21}/></span><div><h3>{stage.title}</h3><p>{stage.copy}</p></div><ArrowUpRight className="public-stage__arrow" size={19}/></article>)}</div>
      </section>

      <section className="public-audiences" id="stakeholders">
        <div className="public-section-heading public-section-heading--left"><span className="public-eyebrow">WHO SIMS SERVES</span><h2>Designed around the people<br/>who make placements work.</h2><p>Each group has a different responsibility. SIMS gives those responsibilities a shared place to happen.</p></div>
        <div className="public-audience-grid">{audiences.map((item,i)=><article className="public-audience" key={item.title}><div className="public-audience__top"><span className="public-audience__icon"><item.icon size={23}/></span><span>0{i+1}</span></div><h3>{item.title}</h3><p>{item.copy}</p><ul>{item.points.map(point=><li key={point}><Check size={15}/>{point}</li>)}</ul></article>)}</div>
      </section>

      <section className="sims-landing-section">
        <div className="sims-landing-container">
          <div className="sims-landing-heading"><span className="sims-landing-eyebrow">BUILT FOR REAL OPERATIONS</span><h2>Everything needed to manage the placement lifecycle.</h2><p>Bring the day-to-day tasks behind internships into a single, structured workspace.</p></div>
          <div className="sims-capability-grid">
            <article className="sims-capability-card"><span className="sims-capability-icon"><ClipboardCheck size={21}/></span><h3>Application management</h3><p>Follow submitted applications, review decisions and keep the next action visible to the right people.</p></article>
            <article className="sims-capability-card"><span className="sims-capability-icon"><CalendarDays size={21}/></span><h3>Placement tracking</h3><p>Keep placement records, timelines and supervision responsibilities connected throughout the internship.</p></article>
            <article className="sims-capability-card"><span className="sims-capability-icon"><FileCheck2 size={21}/></span><h3>Reports and evaluations</h3><p>Record weekly progress, supervisor feedback and assessment outcomes in one organised workflow.</p></article>
            <article className="sims-capability-card"><span className="sims-capability-icon"><ChartNoAxesCombined size={21}/></span><h3>Operational insights</h3><p>Give authorised teams visibility into participation, workload and placement activity.</p></article>
          </div>
        </div>
      </section>

      <section className="sims-landing-section sims-landing-security">
        <div className="sims-landing-container sims-security-layout">
          <div className="sims-landing-heading sims-security-heading"><span className="sims-landing-eyebrow">ACCOUNTABILITY BY DESIGN</span><h2>Clear access. Clear ownership.</h2><p>Internship information is handled through role-based workspaces, helping each participant focus on the records and actions relevant to their responsibilities.</p></div>
          <div className="sims-security-list">
            <article className="sims-security-item"><span><LockKeyhole size={19}/></span><div><h3>Role-based access</h3><p>Students, university teams, company teams and platform administrators have distinct workspace permissions.</p></div></article>
            <article className="sims-security-item"><span><ShieldCheck size={19}/></span><div><h3>Structured oversight</h3><p>Placement activity and key decisions remain organised for the people responsible for supervision and coordination.</p></div></article>
            <article className="sims-security-item"><span><BellRing size={19}/></span><div><h3>Centralised updates</h3><p>Keep important platform announcements and workflow notifications in one place.</p></div></article>
          </div>
        </div>
      </section>

      <section className="sims-landing-section">
        <div className="sims-landing-container">
          <div className="sims-landing-heading"><span className="sims-landing-eyebrow">QUICK ANSWERS</span><h2>Getting started with SIMS.</h2><p>A few things to know before using the platform.</p></div>
          <div className="sims-faq-grid">
            <details className="sims-faq-item"><summary>Who can use SIMS?<ChevronRight size={17}/></summary><p>Students, university coordinators, faculty supervisors, company administrators, site supervisors and authorised platform administrators.</p></details>
            <details className="sims-faq-item"><summary>Can students apply for opportunities?<ChevronRight size={17}/></summary><p>Yes. Students can explore available internship opportunities and follow their application status through their workspace.</p></details>
            <details className="sims-faq-item"><summary>How is internship progress recorded?<ChevronRight size={17}/></summary><p>Students record their activity through reporting workflows, while supervisors review progress and contribute feedback.</p></details>
            <details className="sims-faq-item"><summary>How do I access my organisation workspace?<ChevronRight size={17}/></summary><p>Sign in with the account provided by your university or company administrator. Your role determines the workspace available to you.</p></details>
          </div>
        </div>
      </section>
      <section className="public-cta">
        <div className="public-cta__ornament"><Sparkles size={28}/></div>
        <span className="public-eyebrow">A MORE CONNECTED INTERNSHIP PROCESS</span>
        <h2>Give every placement<br/><em>a clearer path forward.</em></h2>
        <p>Bring your internship operations into one organised workspace with SIMS.</p>
        <div className="public-cta__actions"><Link to={primaryHref}><Button size="lg">{session ? 'Open your workspace' : 'Get started with SIMS'} <ArrowRight size={17}/></Button></Link><Link to="/login" className="public-text-link">Already have an account? Sign in</Link></div>
      </section>

      <footer className="public-footer"><div className="public-footer__main"><Link to="/" className="public-brand"><span className="public-brand__mark"><GraduationCap size={22}/></span><span className="public-brand__name">{APP_NAME}<small>Student internship management</small></span></Link><p>A shared workspace for internship opportunities, coordination, supervision and evaluation.</p><div className="public-footer__links"><a href="#platform">Platform</a><a href="#workflow">How it works</a><a href="#stakeholders">Stakeholders</a><Link to="/login">Sign in</Link></div></div><div className="public-footer__bottom"><span>© {new Date().getFullYear()} {APP_NAME}. All rights reserved.</span><span>Student Internship Management System</span></div></footer>
    </main>
  );
}
