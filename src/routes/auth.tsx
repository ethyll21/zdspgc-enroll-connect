import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { GraduationCap, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

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

const getAuthSchema = (isSignup: boolean) => z.object({
  fullName: isSignup 
    ? z.string().min(1, { message: "Please enter your Full Name" }) 
    : z.string().optional(),
  email: z.string().min(1, { message: "Please provide your Email Address" }).email({ message: "Please enter a valid email address" }),
  password: z.string().min(8, { message: "Password must be at least 8 characters" }),
});

function AuthPage() {
  const { mode: initialMode } = Route.useSearch();
  const navigate = useNavigate();
  const { user, isAdmin, loading, signIn, signUp } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">(initialMode ?? "signin");
  const [showPw, setShowPw]     = useState(false);
  const [busy, setBusy]         = useState(false);

  const form = useForm<z.infer<ReturnType<typeof getAuthSchema>>>({
    resolver: zodResolver(getAuthSchema(mode === "signup")),
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
    },
  });

  useEffect(() => {
    if (!loading && user) navigate({ to: isAdmin ? "/admin" : "/dashboard", replace: true });
  }, [user, isAdmin, loading, navigate]);

  useEffect(() => {
    form.clearErrors();
  }, [mode, form]);

  const submit = async (values: z.infer<ReturnType<typeof getAuthSchema>>) => {
    setBusy(true);
    try {
      if (mode === "signup") {
        await signUp(values.email, values.password, values.fullName || "");
        toast.success("Account created! Welcome to ZDSPGC.");
        navigate({ to: "/dashboard", replace: true });
      } else {
        await signIn(values.email, values.password);
        toast.success("Welcome back!");
      }
    } catch (err: any) {
      toast.error(err.message ?? "Authentication failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen md:grid-cols-2 bg-muted/20">
      {/* Left panel */}
      <div className="hidden flex-col justify-between p-12 md:flex text-primary-foreground relative overflow-hidden">
        {/* Background Image Container */}
        <div 
          className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: 'url("/hero-bg.jpg")' }}
        >
          <div className="absolute inset-0 bg-[#0A2540]/85 mix-blend-multiply" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-[#0A2540]/50 to-transparent" />
        </div>
        
        <Link to="/" className="relative z-10 flex items-center gap-3 transition-transform hover:-translate-y-0.5">
          <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-md bg-white p-0.5 shadow-lg">
            <img src="/logo.png" alt="ZDSPGC Logo" className="h-full w-full object-contain" />
          </div>
          <div>
            <p className="font-display text-lg font-bold tracking-tight">ZDSPGC</p>
            <p className="text-[11px] uppercase tracking-wider text-primary-foreground/80 font-medium">Dimataling Campus</p>
          </div>
        </Link>
        <div className="relative z-10">
          <h2 className="font-display text-5xl font-bold leading-tight tracking-tight">
            Ditch the paper, <br /> speed up your enrollment
          </h2>
          <p className="mt-6 text-lg max-w-md text-primary-foreground/90 font-medium leading-relaxed">
            Sign in to continue your pre-enrollment application or check your status securely.
          </p>
          <div className="mt-10 flex items-center gap-4 rounded-xl border border-white/20 bg-black/20 p-4 backdrop-blur-md max-w-sm shadow-xl">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold/20 text-gold border border-gold/30 shadow-inner">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold text-white">Official & Secure</p>
              <p className="text-sm text-primary-foreground/80">Protected by enterprise-grade encryption.</p>
            </div>
          </div>
        </div>
        <p className="relative z-10 text-xs font-medium text-primary-foreground/70">© {new Date().getFullYear()} ZDSPGC Dimataling Campus</p>
      </div>

      {/* Right panel — form */}
      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="glass-card w-full max-w-md rounded-3xl p-8 sm:p-10 transition-all duration-500 ease-out hover:shadow-xl">
          <Link to="/" className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary transition-colors md:hidden">
            ← Back to home
          </Link>
          <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">
            {mode === "signup" ? "Create your account" : "Sign in to your portal"}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {mode === "signup"
              ? "Start your pre-enrollment application in seconds."
              : "Welcome back! Please sign in to continue."}
          </p>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(submit)} className="mt-8 space-y-5">
              {mode === "signup" && (
                <FormField
                  control={form.control}
                  name="fullName"
                  render={({ field }) => (
                    <FormItem className="space-y-2.5">
                      <FormLabel className="font-medium">Full Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Juan Dela Cruz"
                          className="h-12 rounded-xl transition-shadow focus-visible:shadow-md"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem className="space-y-2.5">
                    <FormLabel className="font-medium">Email Address</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="student@zdspgc.edu.ph"
                        autoComplete="email"
                        className="h-12 rounded-xl transition-shadow focus-visible:shadow-md"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem className="space-y-2.5">
                    <FormLabel className="font-medium">Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showPw ? "text" : "password"}
                          placeholder="At least 8 characters"
                          autoComplete={mode === "signup" ? "new-password" : "current-password"}
                          className="h-12 rounded-xl pr-12 transition-shadow focus-visible:shadow-md"
                          {...field}
                        />
                        <button
                          type="button"
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                          onClick={() => setShowPw(!showPw)}
                          tabIndex={-1}
                        >
                          {showPw ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button 
                type="submit" 
                className="w-full h-12 mt-4 rounded-xl font-semibold text-[15px] transition-all hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.98]" 
                disabled={busy}
              >
                {busy ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in securely"}
              </Button>
            </form>
          </Form>

          <p className="mt-8 text-center text-[15px] text-muted-foreground font-medium">
            {mode === "signup" ? "Already have an account?" : "New here?"}{" "}
            <button
              className="font-bold text-primary hover:text-accent hover:underline transition-colors"
              onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
            >
              {mode === "signup" ? "Sign in instead" : "Create an account"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

