import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldCheck, FileCheck2, Clock, ArrowRight, CheckCircle2, GraduationCap } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ZDSPGC Dimataling — Pre-Enrollment & Student Data Validation" },
      {
        name: "description",
        content:
          "Apply for enrollment, upload requirements, and track your application status at ZDSPGC Dimataling Campus.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { user, isAdmin } = useAuth();
  const portal = isAdmin ? "/admin" : "/dashboard";

  return (
    <div className="min-h-screen bg-background flex flex-col">

      {/* ── Navigation ──────────────────────────────────────────────────────── */}
      <header className="border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded bg-white border border-slate-200 shadow-sm p-0.5">
              <img src="/logo.png" alt="ZDSPGC Logo" className="h-full w-full object-contain" />
            </div>
            <div className="leading-tight">
              <p className="font-display text-base font-bold text-[#0A2540]">ZDSPGC</p>
              <p className="text-[10px] uppercase tracking-widest font-medium text-slate-400">
                Dimataling Campus
              </p>
            </div>
          </Link>

          <nav className="flex items-center gap-2">
            {user ? (
              <Link
                to={portal}
                className="inline-flex items-center gap-2 rounded bg-[#0A2540] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#0c2f58] transition-colors"
              >
                Open Portal <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <>
                <Link
                  to="/auth"
                  className="rounded px-4 py-2 text-sm font-medium text-[#0A2540] hover:bg-slate-100 transition-colors"
                >
                  Sign in
                </Link>
                <Link
                  to="/auth"
                  search={{ mode: "signup" }}
                  className="inline-flex items-center gap-2 rounded bg-[#0A2540] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#0c2f58] transition-colors"
                >
                  Create account
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <section className="relative text-white overflow-hidden">
        {/* Background */}
        <div
          className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: 'url("/hero-bg.jpg")' }}
        >
          <div className="absolute inset-0 bg-[#071E38]/88" />
          {/* Bottom fade to background color */}
          <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />
        </div>

        {/* Gold top accent line */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-gold via-[#e8c96a] to-gold z-10" />

        {/* Content */}
        <div className="relative z-10 mx-auto grid max-w-6xl gap-12 px-6 py-24 md:grid-cols-[1.3fr,1fr] md:py-32">
          <div>
            {/* Academic year badge */}
            <span className="inline-flex items-center gap-2 rounded border border-gold/40 bg-gold/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-gold">
              <GraduationCap className="h-3.5 w-3.5" />
              Academic Year 2026 – 2027
            </span>

            <h1 className="mt-6 font-display text-4xl font-bold leading-tight text-white md:text-5xl xl:text-6xl">
              Pre-Enrollment &<br />
              <span className="text-gold">Student Data</span><br />
              Validation System
            </h1>

            <p className="mt-5 max-w-lg text-base text-white/80 leading-relaxed">
              Empowering educational excellence at ZDSPGC-Dimataling by streamlining
              pre-enrollment and ensuring data integrity through seamless digital validation.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to={user ? portal : "/auth"}
                search={user ? undefined : { mode: "signup" }}
                className="inline-flex items-center gap-2 rounded bg-gold px-6 py-3 text-sm font-bold text-[#0A2540] shadow-lg hover:brightness-95 transition-all"
              >
                {user ? "Continue to portal" : "Start pre-enrollment"}
                <ArrowRight className="h-4 w-4" />
              </Link>
              {!user && (
                <Link
                  to="/auth"
                  className="inline-flex items-center gap-2 rounded border border-white/25 bg-white/10 backdrop-blur px-6 py-3 text-sm font-medium text-white hover:bg-white/18 transition-all"
                >
                  I already have an account
                </Link>
              )}
            </div>

            {/* Stats strip */}
            <dl className="mt-12 grid grid-cols-3 gap-8 border-t border-white/15 pt-8">
              {[
                ["100%", "Paperless intake"],
                ["24 / 7", "Submit anytime"],
                ["Secure", "Verified records"],
              ].map(([v, l]) => (
                <div key={l}>
                  <dt className="font-display text-2xl font-bold text-gold">{v}</dt>
                  <dd className="mt-0.5 text-sm text-white/70">{l}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* How it works card */}
          <div className="relative self-center">
            <div className="rounded-lg border border-white/15 bg-[#071E38]/70 backdrop-blur-md shadow-2xl overflow-hidden">
              {/* Card header accent */}
              <div className="h-1 bg-gradient-to-r from-gold to-[#e8c96a]" />
              <div className="p-6">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gold mb-5">
                  How it works
                </p>
                <ol className="space-y-5">
                  {[
                    ["Create your account", "Sign up with your active email address."],
                    ["Fill out the application", "Personal info, education background, and program of choice."],
                    ["Upload requirements", "PSA, Form 138, Good Moral, and other documents."],
                    ["Get validated", "The Registrar reviews and notifies you of the result."],
                  ].map((step, i) => (
                    <li key={step[0]} className="flex gap-4">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gold text-xs font-bold text-[#0A2540] shadow-sm">
                        {i + 1}
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-white">{step[0]}</p>
                        <p className="text-sm text-white/65 mt-0.5">{step[1]}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ────────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 py-20 flex-1">
        <div className="text-center mb-12">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gold mb-2">Features</p>
          <h2 className="font-display text-3xl font-bold text-[#0A2540]">
            Built for Modern Institutions
          </h2>
          <p className="mt-3 text-sm text-muted-foreground max-w-xl mx-auto">
            A complete digital pre-enrollment solution designed for accuracy, security, and ease of use.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          {[
            {
              icon: FileCheck2,
              title: "Smart Validation",
              text: "Required-field checks, duplicate detection, and file-type validation built into every submission.",
            },
            {
              icon: ShieldCheck,
              title: "Secure Records",
              text: "Role-based access and encrypted document storage protect every applicant's data.",
            },
            {
              icon: Clock,
              title: "Real-time Status",
              text: "Track Pending, Approved, or Correction Needed without standing in line.",
            },
          ].map(({ icon: Icon, title, text }) => (
            <div
              key={title}
              className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow border-l-4 border-l-[#0A2540]"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded bg-[#0A2540]/8 text-[#0A2540] mb-4">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="font-display text-lg font-bold text-[#0A2540]">{title}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{text}</p>
            </div>
          ))}
        </div>

        {/* Requirements section */}
        <div className="mt-12 rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
          {/* Top accent */}
          <div className="h-1 bg-gradient-to-r from-[#0A2540] to-[#1a4a7a]" />
          <div className="grid gap-8 p-8 md:grid-cols-2 md:p-12">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gold mb-3">
                Document Requirements
              </p>
              <h2 className="font-display text-2xl font-bold text-[#0A2540]">
                What you'll need
              </h2>
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                Prepare clear scans or photos (PDF, JPG, or PNG) of the following documents
                before starting your application.
              </p>
            </div>
            <ul className="space-y-3 text-sm self-center">
              {[
                "PSA Birth Certificate",
                "Form 138 (Report Card)",
                "Good Moral Certificate",
                "Transfer Credentials (transferees only)",
                "2×2 ID Photo",
              ].map((item) => (
                <li key={item} className="flex items-center gap-3">
                  <CheckCircle2 className="mt-0.5 h-4.5 w-4.5 text-success shrink-0" />
                  <span className="text-slate-700">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <footer className="bg-[#0A2540] text-white">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded bg-white p-0.5">
                  <img src="/logo.png" alt="ZDSPGC Logo" className="h-full w-full object-contain" />
                </div>
                <div>
                  <p className="font-display text-sm font-bold text-white">ZDSPGC</p>
                  <p className="text-[10px] uppercase tracking-widest text-white/50">Dimataling Campus</p>
                </div>
              </div>
              <p className="text-xs text-white/50 max-w-xs leading-relaxed">
                Zamboanga del Sur Provincial Government College — Dimataling Campus
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs font-semibold uppercase tracking-wider text-gold mb-1">Office of the Registrar</p>
              <p className="text-xs text-white/50">Pre-Enrollment & Student Data Validation System</p>
              <p className="text-xs text-white/40 mt-3">
                © {new Date().getFullYear()} ZDSPGC — All rights reserved.
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
