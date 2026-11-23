import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Card, Button } from '@/components/ui';
import {
  ArrowRight,
  BookOpen,
  Briefcase,
  CheckCircle2,
  GraduationCap,
  LineChart,
  Sparkles,
  Star,
  Zap,
} from 'lucide-react';

// Data definitions (unchanged)
const roles = [
  {
    icon: GraduationCap,
    title: 'For students',
    copy: 'Find relevant opportunities, follow every application, and keep your internship work organised from start to finish.',
    points: ['Opportunity discovery', 'Application tracking', 'Weekly activity and feedback'],
    bg: 'bg-blue-500',
    text: 'text-white',
    color: 'bg-blue-500',
  },
  {
    icon: Briefcase,
    title: 'For universities',
    copy: 'Coordinate placements across students, faculty and partner organisations with a shared view of progress.',
    points: ['Student and placement oversight', 'Supervisor coordination', 'Assessment visibility'],
    bg: 'bg-green-500',
    text: 'text-white',
    color: 'bg-green-500',
  },
  {
    icon: BookOpen,
    title: 'For employers',
    copy: 'Manage internship opportunities, review applicants and support interns throughout their placement.',
    points: ['Opportunity publishing', 'Applicant review', 'Intern supervision'],
    bg: 'bg-indigo-600',
    text: 'text-white',
    color: 'bg-indigo-600',
  },
];

const steps = [
  { step: '01', icon: Briefcase, title: 'Post & Discover', body: 'Companies publish internships and graduate roles. Students browse and apply with a few clicks.' },
  { step: '02', icon: CheckCircle2, title: 'Review & Place', body: 'Coordinators review applications, match students to opportunities, and confirm placements.' },
  { step: '03', icon: BookOpen, title: 'Log & Evaluate', body: 'Students submit weekly logs. Supervisors and faculty provide feedback and midterm evaluations.' },
  { step: '04', icon: LineChart, title: 'Grade & Report', body: 'Final evaluations are submitted, grades are recorded, and program reports are generated automatically.' },
];

const stats = [
  { value: '100%', label: 'Digital workflow' },
  { value: '3×', label: 'Faster placements' },
  { value: '0', label: 'Spreadsheets needed' },
  { value: '24/7', label: 'Access anywhere' },
];

const testimonials = [
  { quote: "SIMS eliminated weeks of back‑and‑forth emails. Our placement rate improved dramatically in just one semester.", name: "Dr. Grace Okafor", role: "Internship Coordinator", org: "Bay State University" },
  { quote: "I found my internship, applied, and got placed — all without leaving the platform. It couldn't have been easier.", name: "James Nkosi", role: "Computer Science Student", org: "Northbridge Tech" },
  { quote: "We can now target specific campuses and manage interns with proper evaluations instead of scattered documents.", name: "Sarah Chen", role: "HR Manager", org: "Acme Software" },
];

export function Landing() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Hero */}
      <section className="bg-gradient-to-r from-primary to-emerald-500 text-white py-20">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Where internships actually work</h1>
          <p className="text-lg md:text-xl mb-8">
            The modern internship management platform for students, universities & companies.
          </p>
          <div className="flex justify-center space-x-4">
            <Link to="/signup">
              <Button variant="primary" size="lg">Get started free</Button>
            </Link>
            <Link to="/login">
              <Button variant="ghost" size="lg">Sign in</Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Roles */}
      <section className="container mx-auto px-4 py-12">
        <h2 className="text-3xl font-semibold text-center mb-8">Built for everyone</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {roles.map((role) => (
            <Card key={role.title} className={cn('p-6 text-center', role.bg, role.text)}>
              <role.icon className="w-12 h-12 mx-auto mb-4" />
              <h3 className="text-xl font-bold mb-2">{role.title}</h3>
              <p className="mb-4">{role.copy}</p>
              <ul className="text-left space-y-1">
                {role.points.map((p) => (
                  <li key={p}>• {p}</li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="bg-white dark:bg-gray-800 py-12">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-semibold text-center mb-8">How it works</h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-6">
              {steps.map((step) => (
                <div key={step.step} className="flex items-start">
                  <div className="flex-shrink-0 w-12 h-12 bg-primary text-white rounded-full flex items-center justify-center mr-4">
                    {step.step}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold flex items-center">
                      <step.icon className="w-6 h-6 mr-2" />
                      {step.title}
                    </h3>
                    <p>{step.body}</p>
                  </div>
                </div>
              ))}
            </div>
            {/* Illustration placeholder */}
            <div className="flex items-center justify-center">
              <Sparkles className="w-48 h-48 text-primary" />
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="bg-gray-100 dark:bg-gray-700 py-12">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-4 text-center">
            {stats.map((s) => (
              <div key={s.label}>
                <p className="text-3xl font-bold text-primary">{s.value}</p>
                <p className="text-sm text-gray-600 dark:text-gray-300">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="container mx-auto px-4 py-12">
        <h2 className="text-3xl font-semibold text-center mb-8">What people say</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {testimonials.map((t) => (
            <Card key={t.name} className="p-6">
              <div className="flex items-center mb-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="w-5 h-5 text-yellow-400" />
                ))}
              </div>
              <p className="italic mb-4">“{t.quote}”</p>
              <p className="font-bold">{t.name}</p>
              <p className="text-sm text-gray-600">{t.role} · {t.org}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-primary text-white py-12">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to simplify internship management?</h2>
          <p className="mb-6">Join the universities and companies already using SIMS to streamline placements from start to finish.</p>
          <Link to="/signup">
            <Button variant="primary" size="lg">Get started free</Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
