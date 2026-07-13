import { createFileRoute, Link } from "@tanstack/react-router";
import { GraduationCap, ShieldCheck, FileCheck2, Clock, ArrowRight, CheckCircle2 } from "lucide-react";
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
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60 bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-md bg-white p-0.5">
              <img src="/logo.png" alt="ZDSPGC Logo" className="h-full w-full object-contain" />
            </div>
            <div className="leading-tight">
              <p className="font-display text-base font-semibold text-primary">ZDSPGC</p>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Dimataling Campus</p>
            </div>
          </Link>
          <nav className="flex items-center gap-2">
            {user ? (
              <Link
                to={portal}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-secondary"
              >
                Open Portal <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <>
                <Link to="/auth" className="rounded-md px-4 py-2 text-sm font-medium text-primary hover:bg-muted">
                  Sign in
                </Link>
                <Link
                  to="/auth"
                  search={{ mode: "signup" }}
                  className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-secondary"
                >
                  Create account
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <section className="relative text-primary-foreground">
        {/* Background Image Container */}
        <div 
          className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: 'url("/hero-bg.jpg")' }}
        >
          {/* Professional dark blue overlay to maintain contrast and readability */}
          <div className="absolute inset-0 bg-[#0A2540]/85 mix-blend-multiply" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
        </div>

        {/* Content */}
        <div className="relative z-10 mx-auto grid max-w-6xl gap-12 px-6 py-20 md:grid-cols-[1.2fr,1fr] md:py-28">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-gold backdrop-blur-sm">
              Academic Year 2026 – 2027
            </span>
            <h1 className="mt-6 font-display text-4xl font-semibold leading-tight md:text-6xl text-white drop-shadow-md">
              Pre-Enrollment &<br />
              Student Data Validation
            </h1>
            <p className="mt-5 max-w-xl textnpm-base text-white/90 md:text-lg drop-shadow">
              Empowering educational excellence at ZDSPGC-Dimataling by streamlining pre-enrollment and ensuring data integrity through seamless, digital validation
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to={user ? portal : "/auth"}
                search={user ? undefined : { mode: "signup" }}
                className="inline-flex items-center gap-2 rounded-md bg-gold px-5 py-3 text-sm font-semibold text-gold-foreground shadow-lg shadow-black/20 hover:brightness-95"
              >
                {user ? "Continue to portal" : "Start pre-enrollment"}
                <ArrowRight className="h-4 w-4" />
              </Link>
              {!user && (
                <Link
                  to="/auth"
                  className="inline-flex items-center gap-2 rounded-md border border-white/40 bg-black/20 backdrop-blur-md px-5 py-3 text-sm font-medium text-white hover:bg-white/10"
                >
                  I already have an account
                </Link>
              )}
            </div>

            <dl className="mt-12 grid grid-cols-3 gap-6 border-t border-white/20 pt-6 text-sm">
              {[
                ["100%", "Paperless intake"],
                ["24/7", "Submit anytime"],
                ["Secure", "Verified records"],
              ].map(([v, l]) => (
                <div key={l}>
                  <dt className="font-display text-2xl text-gold drop-shadow-sm">{v}</dt>
                  <dd className="text-white/80">{l}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="relative">
            <div className="rounded-2xl border border-white/20 bg-[#0A2540]/60 p-6 backdrop-blur-md shadow-xl">
              <p className="text-xs font-semibold uppercase tracking-wider text-gold">How it works</p>
              <ol className="mt-5 space-y-5">
                {[
                  ["Create your account", "Sign up with your active email."],
                  ["Fill out the application", "Personal info, education, program of choice."],
                  ["Upload requirements", "PSA, Form 138, Good Moral, and more."],
                  ["Get validated", "Registrar reviews and notifies you of the result."],
                ].map((step, i) => (
                  <li key={step[0]} className="flex gap-4">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gold text-sm font-bold text-gold-foreground shadow-sm">
                      {i + 1}
                    </span>
                    <div>
                      <p className="font-semibold text-white">{step[0]}</p>
                      <p className="text-sm text-white/80">{step[1]}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="grid gap-6 md:grid-cols-3">
          {[
            {
              icon: FileCheck2,
              title: "Smart validation",
              text: "Required-field checks, duplicate detection, and file-type validation built into every submission.",
            },
            {
              icon: ShieldCheck,
              title: "Secure records",
              text: "Role-based access and encrypted document storage protect every applicant's data.",
            },
            {
              icon: Clock,
              title: "Real-time status",
              text: "Track Pending, Approved, or Correction Needed without standing in line.",
            },
          ].map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-xl border bg-card p-6 shadow-sm">
              <div className="flex h-11 w-11 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-display text-lg font-semibold">{title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{text}</p>
            </div>
          ))}
        </div>

        <div className="mt-16 grid gap-10 rounded-2xl border bg-card p-8 md:grid-cols-2 md:p-12">
          <div>
            <h2 className="font-display text-3xl font-semibold text-primary">What you'll need</h2>
            <p className="mt-3 text-sm text-muted-foreground">
              Prepare clear scans or photos (PDF, JPG, or PNG) of the following documents before starting.
            </p>
          </div>
          <ul className="space-y-3 text-sm">
            {[
              "PSA Birth Certificate",
              "Form 138 (Report Card)",
              "Good Moral Certificate",
              "Transfer Credentials (transferees only)",
              "2x2 ID Photo",
            ].map((item) => (
              <li key={item} className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 text-success" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <footer className="border-t bg-primary py-8 text-primary-foreground">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-6 text-sm md:flex-row">
          <p>© {new Date().getFullYear()} ZDSPGC — Dimataling Campus. All rights reserved.</p>
          <p className="text-primary-foreground/70">Office of the Registrar</p>
        </div>
      </footer>
    </div>
  );
}
