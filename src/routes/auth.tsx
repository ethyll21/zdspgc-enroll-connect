import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { GraduationCap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const searchSchema = z.object({
  mode: z.enum(["signin", "signup"]).optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Sign in — ZDSPGC Dimataling Pre-Enrollment" },
      { name: "description", content: "Access the ZDSPGC Dimataling student or registrar portal." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { mode: initialMode } = Route.useSearch();
  const navigate = useNavigate();
  const { session, isAdmin, loading } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">(initialMode ?? "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && session) {
      navigate({ to: isAdmin ? "/admin" : "/dashboard", replace: true });
    }
  }, [session, isAdmin, loading, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: { full_name: fullName },
          },
        });
        if (error) throw error;
        toast.success("Account created. You're signed in.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back.");
      }
    } catch (err: any) {
      toast.error(err.message ?? "Authentication failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen md:grid-cols-2">
      <div className="gradient-hero hidden flex-col justify-between p-12 text-primary-foreground md:flex">
        <Link to="/" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-gold text-gold-foreground">
            <GraduationCap className="h-5 w-5" />
          </div>
          <div>
            <p className="font-display text-base font-semibold">ZDSPGC</p>
            <p className="text-[11px] uppercase tracking-wider text-primary-foreground/70">Dimataling Campus</p>
          </div>
        </Link>
        <div>
          <h2 className="font-display text-4xl font-semibold leading-tight">
            Your enrollment, <br /> faster and paperless.
          </h2>
          <p className="mt-4 max-w-md text-primary-foreground/80">
            Sign in to continue your pre-enrollment application or to validate submissions as a registrar.
          </p>
        </div>
        <p className="text-xs text-primary-foreground/60">© {new Date().getFullYear()} ZDSPGC Dimataling Campus</p>
      </div>

      <div className="flex items-center justify-center bg-background p-6">
        <div className="w-full max-w-sm">
          <Link to="/" className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary md:hidden">
            ← Back to home
          </Link>
          <h1 className="font-display text-2xl font-semibold text-primary">
            {mode === "signup" ? "Create your account" : "Sign in to your portal"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "signup"
              ? "Start your pre-enrollment application."
              : "Students and registrars use the same sign-in form."}
          </p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            {mode === "signup" && (
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Juan Dela Cruz"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
              />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {mode === "signup" ? "Already have an account?" : "New here?"}{" "}
            <button
              className="font-medium text-primary hover:underline"
              onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
            >
              {mode === "signup" ? "Sign in" : "Create one"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
