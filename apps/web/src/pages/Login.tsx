import "./landing.css";

/* Change these if your routes differ. If you use react-router, swap the
 * <a href> tags for <Link to> and keep the same className values. */
const LOGIN = "/login";
const SIGNUP = "/register";

const roles = [
  {
    title: "Students",
    text: "Find openings, apply, and see where each application stands.",
    points: ["Browse placements from partner companies", "Track every application in one list", "Receive decisions and next steps"],
  },
  {
    title: "University coordinators",
    text: "Oversee placements across a cohort without chasing spreadsheets.",
    points: ["See who is placed, pending, or unplaced", "Approve placements and assign supervisors", "Export records for reporting"],
  },
  {
    title: "Companies",
    text: "Publish openings and review candidates from the universities you work with.",
    points: ["Post internship positions", "Review applications and shortlist", "Confirm placements and dates"],
  },
];

const steps = [
  { title: "Post", text: "A company publishes an internship opening." },
  { title: "Apply", text: "Students apply and the company reviews candidates." },
  { title: "Confirm", text: "The company offers a place and the university approves it." },
  { title: "Follow up", text: "Progress and outcomes stay on the placement record." },
];

const features = [
  ["One record per placement", "Student, company, supervisor, dates and status live together instead of across emails and sheets."],
  ["Several universities, several companies", "Each organisation works in its own space on the same system."],
  ["Clear status at every stage", "Everyone sees the same status, so nobody has to ask where an application is."],
  ["Role-based access", "Students, coordinators and companies each see only what their role needs."],
];

const faqs = [
  ["Who can use SIMS?", "Students, university coordinators and partner companies. Each role has its own sign-in and its own view."],
  ["Does it cost anything for students?", "Replace this answer with your actual pricing policy."],
  ["How do I join as a company or university?", "Create an account and complete your organisation details. A coordinator or administrator confirms new organisations."],
  ["Who can see my information?", "Only people involved in your placement: you, the company, and your university coordinator."],
];

export default function Landing() {
  return (
    <div className="lp">
      <header className="lp-header">
        <div className="lp-wrap">
          <a href="/" className="lp-brand">SIMS</a>
          <nav className="lp-nav" aria-label="Main">
            <div className="lp-nav-links">
              <a href="#who">Who it is for</a>
              <a href="#process">How it works</a>
              <a href="#faq">FAQ</a>
            </div>
            <a href={LOGIN}>Sign in</a>
            <a href={SIGNUP} className="lp-btn lp-btn-primary lp-btn-sm">Get started</a>
          </nav>
        </div>
      </header>

      <main>
        <section className="lp-hero">
          <div className="lp-wrap">
            <div>
              <h1>Student internship placements, managed in one place</h1>
              <p className="lp-hero-lead">
                SIMS connects students, universities and companies on a single placement record,
                from the first application to the final outcome.
              </p>
              <div className="lp-hero-actions">
                <a href={SIGNUP} className="lp-btn lp-btn-primary">Create an account</a>
                <a href={LOGIN} className="lp-btn lp-btn-quiet">Sign in</a>
              </div>
              <p className="lp-hero-note">For students, university coordinators and partner companies.</p>
            </div>

            <div className="lp-record" aria-label="Example placement list">
              <div className="lp-record-head">
                <strong>Placements</strong>
                <span>Example data</span>
              </div>
              <table>
                <thead>
                  <tr><th>Student</th><th>Company</th><th>Start</th><th>Status</th></tr>
                </thead>
                <tbody>
                  <tr><td>A. Mukamana<small>Computer Science</small></td><td>Northfield Systems</td><td>3 Feb</td><td><span className="lp-status lp-status-ok">Placed</span></td></tr>
                  <tr><td>J. Habimana<small>Business IT</small></td><td>Kivu Logistics</td><td>10 Feb</td><td><span className="lp-status lp-status-wait">Awaiting approval</span></td></tr>
                  <tr><td>C. Uwase<small>Information Systems</small></td><td>Lakeside Bank</td><td>17 Feb</td><td><span className="lp-status lp-status-info">Interview</span></td></tr>
                  <tr><td>P. Niyonzima<small>Computer Science</small></td><td>Akira Digital</td><td>24 Feb</td><td><span className="lp-status lp-status-ok">Placed</span></td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="lp-section" id="who">
          <div className="lp-wrap">
            <h2>Built for the three groups involved in a placement</h2>
            <div className="lp-section-body lp-roles">
              {roles.map((r) => (
                <div className="lp-role" key={r.title}>
                  <h3>{r.title}</h3>
                  <p>{r.text}</p>
                  <ul>{r.points.map((p) => <li key={p}>{p}</li>)}</ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="lp-section lp-section-wash" id="process">
          <div className="lp-wrap">
            <h2>How a placement moves from opening to outcome</h2>
            <ol className="lp-section-body lp-steps">
              {steps.map((s) => (
                <li key={s.title}><h3>{s.title}</h3><p>{s.text}</p></li>
              ))}
            </ol>
          </div>
        </section>

        <section className="lp-section" id="features">
          <div className="lp-wrap">
            <h2>What you get</h2>
            <dl className="lp-section-body lp-features">
              {features.map(([t, d]) => (
                <div key={t}><dt>{t}</dt><dd>{d}</dd></div>
              ))}
            </dl>
          </div>
        </section>

        <section className="lp-section lp-section-wash" id="faq">
          <div className="lp-wrap">
            <h2>Common questions</h2>
            <div className="lp-section-body lp-faq">
              {faqs.map(([q, a]) => (
                <details key={q}><summary>{q}</summary><p>{a}</p></details>
              ))}
            </div>
          </div>
        </section>

        <section className="lp-cta">
          <div className="lp-wrap">
            <div>
              <h2>Start managing placements in SIMS</h2>
              <p>Create an account to get started, or sign in if you already have one.</p>
            </div>
            <a href={SIGNUP} className="lp-btn lp-btn-primary">Create an account</a>
          </div>
        </section>
      </main>

      <footer className="lp-footer">
        <div className="lp-wrap">
          <span>© {new Date().getFullYear()} SIMS</span>
          <nav aria-label="Footer">
            <a href={LOGIN}>Sign in</a>
            <a href={SIGNUP}>Create an account</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
