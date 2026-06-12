import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { Upload, X, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { REQUIRED_DOCUMENTS, YEAR_LEVELS, STUDENT_TYPES } from "@/lib/enrollment-constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/apply")({
  component: ApplyPage,
});

const schema = z.object({
  fullName: z.string().trim().min(3, "Full name is required").max(120),
  contactNumber: z
    .string()
    .trim()
    .regex(/^(\+?\d{10,15})$/, "Enter a valid contact number"),
  birthdate: z.string().min(1, "Birthdate is required"),
  gender: z.string().min(1, "Select a gender"),
  address: z.string().trim().min(5, "Address is required").max(300),
  programId: z.string().uuid("Choose a program"),
  yearLevel: z.string().min(1),
  studentType: z.enum(["new", "transferee", "returnee", "old"]),
  previousSchool: z.string().max(200).optional().or(z.literal("")),
  previousSchoolAddress: z.string().max(200).optional().or(z.literal("")),
  yearGraduated: z.string().max(20).optional().or(z.literal("")),
});

function ApplyPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [files, setFiles] = useState<Record<string, File | null>>({});

  const { data: programs = [] } = useQuery({
    queryKey: ["programs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("programs")
        .select("id, code, name")
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle();
      return data;
    },
  });

  const [form, setForm] = useState({
    fullName: "",
    contactNumber: "",
    birthdate: "",
    gender: "",
    address: "",
    programId: "",
    yearLevel: YEAR_LEVELS[0],
    studentType: "new" as "new" | "transferee" | "returnee" | "old",
    previousSchool: "",
    previousSchoolAddress: "",
    yearGraduated: "",
  });

  // hydrate from profile once
  useState(() => {
    if (profile) {
      setForm((f) => ({
        ...f,
        fullName: profile.full_name || "",
        contactNumber: profile.contact_number || "",
        birthdate: profile.birthdate || "",
        gender: profile.gender || "",
        address: profile.address || "",
      }));
    }
  });

  const setF = (k: keyof typeof form) => (v: string) => setForm((s) => ({ ...s, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    // check required docs
    const missingReq = REQUIRED_DOCUMENTS.filter((d) => d.required && !files[d.key]);
    if (missingReq.length) {
      toast.error(`Please upload: ${missingReq.map((d) => d.label).join(", ")}`);
      return;
    }

    setBusy(true);
    try {
      // upsert profile
      await supabase.from("profiles").upsert({
        id: user!.id,
        email: user!.email!,
        full_name: form.fullName,
        contact_number: form.contactNumber,
        birthdate: form.birthdate,
        gender: form.gender,
        address: form.address,
      });

      // create application
      const { data: app, error: appErr } = await supabase
        .from("applications")
        .insert({
          student_id: user!.id,
          program_id: form.programId,
          year_level: form.yearLevel,
          student_type: form.studentType,
          previous_school: form.previousSchool || null,
          previous_school_address: form.previousSchoolAddress || null,
          year_graduated: form.yearGraduated || null,
        })
        .select("id")
        .single();
      if (appErr) throw appErr;

      // upload each file
      for (const def of REQUIRED_DOCUMENTS) {
        const file = files[def.key];
        if (!file) continue;
        const path = `${user!.id}/${app.id}/${def.key}-${Date.now()}-${file.name}`;
        const { error: upErr } = await supabase.storage.from("enrollment-documents").upload(path, file);
        if (upErr) throw upErr;
        await supabase.from("application_documents").insert({
          application_id: app.id,
          student_id: user!.id,
          document_type: def.key,
          file_path: path,
          file_name: file.name,
        });
      }

      toast.success("Application submitted! Status: Pending Review");
      navigate({ to: "/dashboard" });
    } catch (err: any) {
      toast.error(err.message ?? "Submission failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-24">
      <header>
        <h1 className="font-display text-3xl font-semibold text-primary">New Pre-Enrollment Application</h1>
        <p className="text-sm text-muted-foreground">Fill out all fields and attach the required documents.</p>
      </header>

      <form onSubmit={submit} className="space-y-6">
        <Section title="Personal Information">
          <Field label="Full Name" required>
            <Input value={form.fullName} onChange={(e) => setF("fullName")(e.target.value)} required maxLength={120} />
          </Field>
          <Field label="Contact Number" required>
            <Input value={form.contactNumber} onChange={(e) => setF("contactNumber")(e.target.value)} placeholder="09XXXXXXXXX" required />
          </Field>
          <Field label="Birthdate" required>
            <Input type="date" value={form.birthdate} onChange={(e) => setF("birthdate")(e.target.value)} required />
          </Field>
          <Field label="Gender" required>
            <Select value={form.gender} onValueChange={setF("gender")}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Male">Male</SelectItem>
                <SelectItem value="Female">Female</SelectItem>
                <SelectItem value="Prefer not to say">Prefer not to say</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Address" required full>
            <Textarea value={form.address} onChange={(e) => setF("address")(e.target.value)} required rows={2} maxLength={300} />
          </Field>
        </Section>

        <Section title="Program & Academic">
          <Field label="Program" required>
            <Select value={form.programId} onValueChange={setF("programId")}>
              <SelectTrigger><SelectValue placeholder="Choose program" /></SelectTrigger>
              <SelectContent>
                {programs.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name} ({p.code})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Year Level" required>
            <Select value={form.yearLevel} onValueChange={setF("yearLevel")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {YEAR_LEVELS.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Student Type" required>
            <Select value={form.studentType} onValueChange={(v) => setF("studentType")(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STUDENT_TYPES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
        </Section>

        <Section title="Educational Background">
          <Field label="Previous School">
            <Input value={form.previousSchool} onChange={(e) => setF("previousSchool")(e.target.value)} maxLength={200} />
          </Field>
          <Field label="Previous School Address">
            <Input value={form.previousSchoolAddress} onChange={(e) => setF("previousSchoolAddress")(e.target.value)} maxLength={200} />
          </Field>
          <Field label="Year Graduated">
            <Input value={form.yearGraduated} onChange={(e) => setF("yearGraduated")(e.target.value)} placeholder="e.g. 2025" maxLength={20} />
          </Field>
        </Section>

        <Section title="Requirements">
          <div className="md:col-span-2 space-y-3">
            {REQUIRED_DOCUMENTS.map((d) => (
              <DocUpload
                key={d.key}
                label={d.label}
                required={d.required}
                file={files[d.key] ?? null}
                onChange={(f) => setFiles((s) => ({ ...s, [d.key]: f }))}
              />
            ))}
          </div>
        </Section>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => navigate({ to: "/dashboard" })}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? "Submitting…" : "Submit Application"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm">
      <h2 className="font-display text-lg font-semibold text-primary">{title}</h2>
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">{children}</div>
    </div>
  );
}

function Field({ label, required, full, children }: { label: string; required?: boolean; full?: boolean; children: React.ReactNode }) {
  return (
    <div className={`space-y-2 ${full ? "md:col-span-2" : ""}`}>
      <Label>{label}{required && <span className="text-destructive"> *</span>}</Label>
      {children}
    </div>
  );
}

function DocUpload({
  label, required, file, onChange,
}: { label: string; required: boolean; file: File | null; onChange: (f: File | null) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-dashed bg-background p-3">
      <div className="flex items-center gap-3 min-w-0">
        <FileText className="h-4 w-4 text-primary shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">
            {label}{required && <span className="text-destructive"> *</span>}
          </p>
          {file ? (
            <p className="text-xs text-muted-foreground truncate">{file.name}</p>
          ) : (
            <p className="text-xs text-muted-foreground">PDF, JPG, or PNG · max 10 MB</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {file && (
          <Button type="button" size="icon" variant="ghost" onClick={() => onChange(null)}>
            <X className="h-4 w-4" />
          </Button>
        )}
        <label className="cursor-pointer">
          <input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              if (f.size > 10 * 1024 * 1024) {
                toast.error("File must be 10MB or less");
                return;
              }
              onChange(f);
            }}
          />
          <span className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-secondary">
            <Upload className="h-3.5 w-3.5" /> {file ? "Replace" : "Upload"}
          </span>
        </label>
      </div>
    </div>
  );
}
