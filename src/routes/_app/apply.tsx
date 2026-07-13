import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Upload, X, FileText, User, GraduationCap, School, Paperclip, CheckCircle2, AlertCircle, ShieldCheck, Users, BookOpen } from "lucide-react";
import { programs as programsApi, students, enrollments, documents as docsApi } from "@/integrations/localdb/client";
import type { FamilyBackground, EducationalBackground } from "@/integrations/localdb/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

export const Route = createFileRoute("/_app/apply")({
  component: ApplyPage,
});

const YEAR_LEVELS = ["1st Year", "2nd Year", "3rd Year", "4th Year"];
const SEMESTERS   = ["1st Semester", "2nd Semester", "Summer"];
const CURRENT_SY  = "2026-2027";
const CIVIL_STATUSES = ["Single", "Married", "Widower"];

const REQUIRED_DOCUMENTS = [
  { key: "psa_birth_certificate", label: "PSA Birth Certificate",       required: true },
  { key: "form_138",              label: "Form 138 (Report Card)",       required: true },
  { key: "good_moral",            label: "Good Moral Certificate",       required: true },
  { key: "transfer_certificate",  label: "Transfer Credentials",         required: false },
  { key: "other",                 label: "Other Supporting Documents",   required: false },
] as const;

type DocKey = (typeof REQUIRED_DOCUMENTS)[number]["key"];

const applySchema = z.object({
  // Course & Major
  program_id: z.string().min(1, { message: "Please select a Course/Program" }),
  major: z.string().optional(),

  // Personal Information
  last_name: z.string().min(1, { message: "Please enter your Last Name" }),
  first_name: z.string().min(1, { message: "Please enter your First Name" }),
  middle_name: z.string().optional(),
  suffix: z.string().optional(),
  date_of_birth: z.string().optional().or(z.literal("")),
  gender: z.string().min(1, { message: "Please select Sex (Male/Female)" }),
  place_of_birth: z.string().optional(),
  civil_status: z.string().optional(),
  religion: z.string().optional(),
  citizenship: z.string().optional(),
  contact_number: z.string().regex(/^09\d{9}$/, { message: "Please enter a valid 11-digit mobile number starting with 09" }).optional().or(z.literal("")),
  email: z.string().min(1, { message: "Please provide your Email Address" }).email({ message: "Please enter a valid email address" }),
  address: z.string().min(1, { message: "Please enter your Permanent Address" }),
  postal_code: z.string().optional(),

  // Family Background
  father_name: z.string().optional(),
  father_occupation: z.string().optional(),
  father_company: z.string().optional(),
  father_address: z.string().optional(),
  father_contact: z.string().optional(),
  mother_name: z.string().optional(),
  mother_occupation: z.string().optional(),
  mother_company: z.string().optional(),
  mother_address: z.string().optional(),
  mother_contact: z.string().optional(),
  guardian_name: z.string().optional(),
  guardian_relationship: z.string().optional(),
  guardian_address: z.string().optional(),
  guardian_contact: z.string().optional(),
  emergency_contact_person: z.string().optional(),
  emergency_contact_address: z.string().optional(),
  emergency_contact_number: z.string().optional(),

  // Educational Background
  elementary_school: z.string().optional(),
  elementary_address: z.string().optional(),
  elementary_years: z.string().optional(),
  junior_high_school: z.string().optional(),
  junior_high_address: z.string().optional(),
  junior_high_years: z.string().optional(),
  senior_high_school: z.string().optional(),
  senior_high_address: z.string().optional(),
  senior_high_years: z.string().optional(),

  // Academic details
  year_level: z.string().min(1, { message: "Please select your Year Level" }),
  school_year: z.string().min(1, { message: "Please enter the School Year" }),
  semester: z.string().min(1, { message: "Please select the Semester" }),

  // Pledge
  pledge_accepted: z.boolean().refine(val => val === true, { message: "You must accept the Student's Pledge to submit" }),
});

function ApplyPage() {
  const { user, isAdmin, loading } = useAuth();
  const navigate    = useNavigate();
  const queryClient = useQueryClient();
  const [busy, setBusy]   = useState(false);
  const [files, setFiles] = useState<Partial<Record<DocKey, File>>>({});

  useEffect(() => {
    if (!loading && isAdmin) navigate({ to: "/admin", replace: true });
  }, [isAdmin, loading, navigate]);

  // ── Fetch programs ─────────────────────────────────────────────────────────
  const { data: programList = [] } = useQuery({
    queryKey: ["programs"],
    queryFn: () => programsApi.list().then((r) => 
      r.programs.filter(p => ["ACT", "BSIS", "BPED"].includes(p.code.toUpperCase()))
    ),
  });

  // ── Fetch existing student record to pre-fill ──────────────────────────────
  const { data: studentRecord } = useQuery({
    queryKey: ["student-me", user?.id],
    enabled: !!user,
    queryFn: () => students.me().then((r) => r.student).catch(() => null),
  });

  const form = useForm<z.infer<typeof applySchema>>({
    resolver: zodResolver(applySchema),
    defaultValues: {
      first_name: "", middle_name: "", last_name: "", suffix: "",
      contact_number: "", date_of_birth: "",
      gender: "", address: "", email: "",
      place_of_birth: "", civil_status: "", religion: "",
      citizenship: "Filipino", postal_code: "",
      program_id: "", major: "",
      year_level: "1",
      // Family
      father_name: "", father_occupation: "", father_company: "",
      father_address: "", father_contact: "",
      mother_name: "", mother_occupation: "", mother_company: "",
      mother_address: "", mother_contact: "",
      guardian_name: "", guardian_relationship: "",
      guardian_address: "", guardian_contact: "",
      emergency_contact_person: "", emergency_contact_address: "",
      emergency_contact_number: "",
      // Education
      elementary_school: "", elementary_address: "", elementary_years: "",
      junior_high_school: "", junior_high_address: "", junior_high_years: "",
      senior_high_school: "", senior_high_address: "", senior_high_years: "",
      // Academic
      school_year: CURRENT_SY,
      semester: SEMESTERS[0],
      pledge_accepted: false,
    },
  });

  // Hydrate from existing record
  useEffect(() => {
    if (studentRecord) {
      const nameParts = user?.full_name?.split(" ") ?? [];
      const fb = (studentRecord.family_background || {}) as FamilyBackground;
      const eb = (studentRecord.educational_background || {}) as EducationalBackground;
      form.reset({
        first_name:      studentRecord.first_name || nameParts[0] || "",
        middle_name:     studentRecord.middle_name || "",
        last_name:       studentRecord.last_name || nameParts[nameParts.length - 1] || "",
        suffix:          studentRecord.suffix || "",
        contact_number:  studentRecord.contact_number || "",
        date_of_birth:   studentRecord.date_of_birth || "",
        gender:          studentRecord.gender || "",
        address:         studentRecord.address || "",
        email:           studentRecord.email || user?.email || "",
        place_of_birth:  studentRecord.place_of_birth || "",
        civil_status:    studentRecord.civil_status || "",
        religion:        studentRecord.religion || "",
        citizenship:     studentRecord.citizenship || "Filipino",
        postal_code:     studentRecord.postal_code || "",
        program_id:      studentRecord.program_id || "",
        major:           studentRecord.major || "",
        year_level:      String(studentRecord.year_level || 1),
        // Family background
        father_name:     fb.father_name || "",
        father_occupation: fb.father_occupation || "",
        father_company:  fb.father_company || "",
        father_address:  fb.father_address || "",
        father_contact:  fb.father_contact || "",
        mother_name:     fb.mother_name || "",
        mother_occupation: fb.mother_occupation || "",
        mother_company:  fb.mother_company || "",
        mother_address:  fb.mother_address || "",
        mother_contact:  fb.mother_contact || "",
        guardian_name:   fb.guardian_name || "",
        guardian_relationship: fb.guardian_relationship || "",
        guardian_address: fb.guardian_address || "",
        guardian_contact: fb.guardian_contact || "",
        emergency_contact_person: fb.emergency_contact_person || "",
        emergency_contact_address: fb.emergency_contact_address || "",
        emergency_contact_number: fb.emergency_contact_number || "",
        // Educational background
        elementary_school: eb.elementary_school || "",
        elementary_address: eb.elementary_address || "",
        elementary_years: eb.elementary_years || "",
        junior_high_school: eb.junior_high_school || "",
        junior_high_address: eb.junior_high_address || "",
        junior_high_years: eb.junior_high_years || "",
        senior_high_school: eb.senior_high_school || "",
        senior_high_address: eb.senior_high_address || "",
        senior_high_years: eb.senior_high_years || "",
        school_year:     CURRENT_SY,
        semester:        SEMESTERS[0],
        pledge_accepted: studentRecord.pledge_accepted || false,
      });
    } else if (user) {
      const nameParts = user.full_name?.split(" ") ?? [];
      form.reset({
        first_name: nameParts[0] || "",
        middle_name: "",
        last_name:  nameParts[nameParts.length - 1] || "",
        suffix: "",
        email:      user.email || "",
        contact_number: "", date_of_birth: "",
        gender: "", address: "",
        place_of_birth: "", civil_status: "", religion: "",
        citizenship: "Filipino", postal_code: "",
        program_id: "", major: "",
        year_level: "1",
        father_name: "", father_occupation: "", father_company: "",
        father_address: "", father_contact: "",
        mother_name: "", mother_occupation: "", mother_company: "",
        mother_address: "", mother_contact: "",
        guardian_name: "", guardian_relationship: "",
        guardian_address: "", guardian_contact: "",
        emergency_contact_person: "", emergency_contact_address: "",
        emergency_contact_number: "",
        elementary_school: "", elementary_address: "", elementary_years: "",
        junior_high_school: "", junior_high_address: "", junior_high_years: "",
        senior_high_school: "", senior_high_address: "", senior_high_years: "",
        school_year: CURRENT_SY,
        semester: SEMESTERS[0],
        pledge_accepted: false,
      });
    }
  }, [studentRecord, user, form]);

  const submit = async (values: z.infer<typeof applySchema>) => {
    const missingReq = REQUIRED_DOCUMENTS.filter((d) => d.required && !files[d.key]);
    if (missingReq.length) {
      toast.error(`Please upload: ${missingReq.map((d) => d.label).join(", ")}`);
      return;
    }

    setBusy(true);
    try {
      // Build family background JSON
      const family_background: FamilyBackground = {
        father_name: values.father_name, father_occupation: values.father_occupation,
        father_company: values.father_company, father_address: values.father_address,
        father_contact: values.father_contact,
        mother_name: values.mother_name, mother_occupation: values.mother_occupation,
        mother_company: values.mother_company, mother_address: values.mother_address,
        mother_contact: values.mother_contact,
        guardian_name: values.guardian_name, guardian_relationship: values.guardian_relationship,
        guardian_address: values.guardian_address, guardian_contact: values.guardian_contact,
        emergency_contact_person: values.emergency_contact_person,
        emergency_contact_address: values.emergency_contact_address,
        emergency_contact_number: values.emergency_contact_number,
      };

      // Build educational background JSON
      const educational_background: EducationalBackground = {
        elementary_school: values.elementary_school, elementary_address: values.elementary_address,
        elementary_years: values.elementary_years,
        junior_high_school: values.junior_high_school, junior_high_address: values.junior_high_address,
        junior_high_years: values.junior_high_years,
        senior_high_school: values.senior_high_school, senior_high_address: values.senior_high_address,
        senior_high_years: values.senior_high_years,
      };

      // Build previous_school string for backward compat
      const prev_school_str = [
        values.elementary_school ? `Elementary: ${values.elementary_school}` : '',
        values.junior_high_school ? `JHS: ${values.junior_high_school}` : '',
        values.senior_high_school ? `SHS: ${values.senior_high_school}` : '',
      ].filter(Boolean).join(', ');

      const studentPayload = {
        first_name: values.first_name, middle_name: values.middle_name || undefined,
        last_name: values.last_name, suffix: values.suffix || undefined,
        gender: values.gender as any,
        date_of_birth: values.date_of_birth || undefined,
        place_of_birth: values.place_of_birth || undefined,
        civil_status: values.civil_status || undefined,
        religion: values.religion || undefined,
        citizenship: values.citizenship || undefined,
        address: values.address,
        postal_code: values.postal_code || undefined,
        contact_number: values.contact_number, email: values.email,
        program_id: values.program_id,
        major: values.major || undefined,
        year_level: parseInt(values.year_level) as any,
        previous_school: prev_school_str || undefined,
        family_background,
        educational_background,
        pledge_accepted: values.pledge_accepted,
      };

      // 1. Create or update student record
      if (studentRecord) {
        await students.updateMe(studentPayload);
      } else {
        await students.create(studentPayload);
      }

      // 2. Submit enrollment
      await enrollments.submit({ school_year: values.school_year, semester: values.semester });

      // 3. Upload documents
      for (const def of REQUIRED_DOCUMENTS) {
        const file = files[def.key];
        if (!file) continue;
        await docsApi.upload(file, def.key);
      }

      toast.success("Enrollment submitted successfully!");
      queryClient.invalidateQueries({ queryKey: ["my-enrollments"] });
      queryClient.invalidateQueries({ queryKey: ["student-me"] });
      navigate({ to: "/dashboard" });
    } catch (err: any) {
      toast.error(err.message ?? "Submission failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-8 pb-24">
      {/* Formal Header */}
      <div className="rounded-lg border border-primary/20 bg-primary/5 p-8 text-center shadow-sm">
        <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <ShieldCheck className="h-8 w-8 text-primary" />
        </div>
        <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Republic of the Philippines</p>
        <h1 className="font-display text-2xl font-bold tracking-tight text-primary">ZAMBOANGA DEL SUR PROVINCIAL GOVERNMENT COLLEGE</h1>
        <p className="text-sm text-muted-foreground">Dimataling Campus · Dimataling, Zamboanga del Sur</p>
        <div className="mt-4 inline-block rounded-md bg-primary/10 px-6 py-2">
          <h2 className="font-display text-lg font-bold text-primary uppercase tracking-wide">College Enrollment Form</h2>
        </div>
        <p className="mt-3 text-sm text-muted-foreground max-w-2xl mx-auto leading-relaxed italic">
          Direction: Fill-out required information. Do not leave an item blank (indicate N/A if item is not applicable).
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(submit, (errs) => {
          const first = Object.values(errs)[0]?.message;
          toast.error(typeof first === 'string' ? first : "Please check the form for errors.");
        })} className="space-y-8">

          {/* ═══ Course & Major ═══ */}
          <Section title="Course & Major" icon={GraduationCap}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="program_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Course <span className="text-destructive ml-1" title="Required">*</span></FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || undefined}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Choose course/program" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {programList.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.name} ({p.code})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="major"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Major</FormLabel>
                    <FormControl>
                      <Input maxLength={150} placeholder="If applicable" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
              <FormField
                control={form.control}
                name="year_level"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Year Level <span className="text-destructive ml-1" title="Required">*</span></FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || undefined}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select year level" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {YEAR_LEVELS.map((y, i) => <SelectItem key={y} value={String(i + 1)}>{y}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="school_year"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>School Year <span className="text-destructive ml-1" title="Required">*</span></FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. 2026-2027" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="semester"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Semester <span className="text-destructive ml-1" title="Required">*</span></FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || undefined}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select semester" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {SEMESTERS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </Section>

          {/* ═══ Personal Information ═══ */}
          <Section title="Personal Information" icon={User}>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <FormField control={form.control} name="last_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last Name <span className="text-destructive ml-1">*</span></FormLabel>
                    <FormControl><Input maxLength={80} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField control={form.control} name="first_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Name <span className="text-destructive ml-1">*</span></FormLabel>
                    <FormControl><Input maxLength={80} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField control={form.control} name="middle_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Middle Name</FormLabel>
                    <FormControl><Input maxLength={80} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField control={form.control} name="suffix"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Suffix</FormLabel>
                    <FormControl><Input maxLength={10} placeholder="Jr., Sr., III" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
              <FormField control={form.control} name="date_of_birth"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date of Birth</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField control={form.control} name="gender"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sex <span className="text-destructive ml-1">*</span></FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || undefined}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="male">Male</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField control={form.control} name="place_of_birth"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Place of Birth</FormLabel>
                    <FormControl><Input maxLength={200} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-6">
              <FormField control={form.control} name="civil_status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Civil Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || undefined}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {CIVIL_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField control={form.control} name="religion"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Religion</FormLabel>
                    <FormControl><Input maxLength={100} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField control={form.control} name="citizenship"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Citizenship</FormLabel>
                    <FormControl><Input maxLength={100} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField control={form.control} name="contact_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact No.</FormLabel>
                    <FormControl><Input placeholder="09XXXXXXXXX" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField control={form.control} name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Address <span className="text-destructive ml-1">*</span></FormLabel>
                    <FormControl><Input type="email" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField control={form.control} name="postal_code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Postal Code</FormLabel>
                    <FormControl><Input maxLength={10} placeholder="e.g. 7100" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="mt-6">
              <FormField control={form.control} name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Permanent Address <span className="text-destructive ml-1">*</span></FormLabel>
                    <FormControl><Textarea rows={2} maxLength={300} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </Section>

          {/* ═══ Family Background ═══ */}
          <Section title="Family Background" icon={Users}>
            {/* Father & Mother side-by-side */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-primary border-b pb-2">Father's Information</h3>
                <FormField control={form.control} name="father_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Father's Name</FormLabel>
                      <FormControl><Input maxLength={150} {...field} /></FormControl>
                    </FormItem>
                  )}
                />
                <FormField control={form.control} name="father_occupation"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Occupation</FormLabel>
                      <FormControl><Input maxLength={100} {...field} /></FormControl>
                    </FormItem>
                  )}
                />
                <FormField control={form.control} name="father_company"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company</FormLabel>
                      <FormControl><Input maxLength={150} {...field} /></FormControl>
                    </FormItem>
                  )}
                />
                <FormField control={form.control} name="father_address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Home Address</FormLabel>
                      <FormControl><Input maxLength={200} {...field} /></FormControl>
                    </FormItem>
                  )}
                />
                <FormField control={form.control} name="father_contact"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact Number</FormLabel>
                      <FormControl><Input maxLength={20} {...field} /></FormControl>
                    </FormItem>
                  )}
                />
              </div>
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-primary border-b pb-2">Mother's Information</h3>
                <FormField control={form.control} name="mother_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mother's Name</FormLabel>
                      <FormControl><Input maxLength={150} {...field} /></FormControl>
                    </FormItem>
                  )}
                />
                <FormField control={form.control} name="mother_occupation"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Occupation</FormLabel>
                      <FormControl><Input maxLength={100} {...field} /></FormControl>
                    </FormItem>
                  )}
                />
                <FormField control={form.control} name="mother_company"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company</FormLabel>
                      <FormControl><Input maxLength={150} {...field} /></FormControl>
                    </FormItem>
                  )}
                />
                <FormField control={form.control} name="mother_address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Home Address</FormLabel>
                      <FormControl><Input maxLength={200} {...field} /></FormControl>
                    </FormItem>
                  )}
                />
                <FormField control={form.control} name="mother_contact"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact Number</FormLabel>
                      <FormControl><Input maxLength={20} {...field} /></FormControl>
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Guardian & Emergency Contact */}
            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-primary border-b pb-2">Guardian</h3>
                <FormField control={form.control} name="guardian_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Guardian Name</FormLabel>
                      <FormControl><Input maxLength={150} {...field} /></FormControl>
                    </FormItem>
                  )}
                />
                <FormField control={form.control} name="guardian_relationship"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Relationship</FormLabel>
                      <FormControl><Input maxLength={50} {...field} /></FormControl>
                    </FormItem>
                  )}
                />
                <FormField control={form.control} name="guardian_address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Home Address</FormLabel>
                      <FormControl><Input maxLength={200} {...field} /></FormControl>
                    </FormItem>
                  )}
                />
                <FormField control={form.control} name="guardian_contact"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact Number</FormLabel>
                      <FormControl><Input maxLength={20} {...field} /></FormControl>
                    </FormItem>
                  )}
                />
              </div>
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-primary border-b pb-2">In Case of Emergency</h3>
                <FormField control={form.control} name="emergency_contact_person"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact Person</FormLabel>
                      <FormControl><Input maxLength={150} {...field} /></FormControl>
                    </FormItem>
                  )}
                />
                <FormField control={form.control} name="emergency_contact_address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Home Address</FormLabel>
                      <FormControl><Input maxLength={200} {...field} /></FormControl>
                    </FormItem>
                  )}
                />
                <FormField control={form.control} name="emergency_contact_number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact Number</FormLabel>
                      <FormControl><Input maxLength={20} {...field} /></FormControl>
                    </FormItem>
                  )}
                />
              </div>
            </div>
          </Section>

          {/* ═══ Educational Background ═══ */}
          <Section title="Educational Background" icon={School}>
            <p className="text-sm text-muted-foreground mb-6 italic">Do not abbreviate school names.</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Elementary */}
              <div className="space-y-4 rounded-lg border bg-muted/20 p-4">
                <h3 className="text-sm font-semibold text-primary text-center border-b pb-2">Elementary</h3>
                <FormField control={form.control} name="elementary_school"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>School Name</FormLabel>
                      <FormControl><Input maxLength={200} placeholder="Full school name" {...field} /></FormControl>
                    </FormItem>
                  )}
                />
                <FormField control={form.control} name="elementary_address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>School Address</FormLabel>
                      <FormControl><Input maxLength={200} {...field} /></FormControl>
                    </FormItem>
                  )}
                />
                <FormField control={form.control} name="elementary_years"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Inclusive Years</FormLabel>
                      <FormControl><Input maxLength={20} placeholder="e.g. 2010-2016" {...field} /></FormControl>
                    </FormItem>
                  )}
                />
              </div>

              {/* Junior High School */}
              <div className="space-y-4 rounded-lg border bg-muted/20 p-4">
                <h3 className="text-sm font-semibold text-primary text-center border-b pb-2">Junior High School</h3>
                <FormField control={form.control} name="junior_high_school"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>School Name</FormLabel>
                      <FormControl><Input maxLength={200} placeholder="Full school name" {...field} /></FormControl>
                    </FormItem>
                  )}
                />
                <FormField control={form.control} name="junior_high_address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>School Address</FormLabel>
                      <FormControl><Input maxLength={200} {...field} /></FormControl>
                    </FormItem>
                  )}
                />
                <FormField control={form.control} name="junior_high_years"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Inclusive Years</FormLabel>
                      <FormControl><Input maxLength={20} placeholder="e.g. 2016-2020" {...field} /></FormControl>
                    </FormItem>
                  )}
                />
              </div>

              {/* Senior High School */}
              <div className="space-y-4 rounded-lg border bg-muted/20 p-4">
                <h3 className="text-sm font-semibold text-primary text-center border-b pb-2">Senior High School</h3>
                <FormField control={form.control} name="senior_high_school"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>School Name</FormLabel>
                      <FormControl><Input maxLength={200} placeholder="Full school name" {...field} /></FormControl>
                    </FormItem>
                  )}
                />
                <FormField control={form.control} name="senior_high_address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>School Address</FormLabel>
                      <FormControl><Input maxLength={200} {...field} /></FormControl>
                    </FormItem>
                  )}
                />
                <FormField control={form.control} name="senior_high_years"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Inclusive Years</FormLabel>
                      <FormControl><Input maxLength={20} placeholder="e.g. 2020-2022" {...field} /></FormControl>
                    </FormItem>
                  )}
                />
              </div>
            </div>
          </Section>

          {/* ═══ Required Documents ═══ */}
          <Section title="Required Documents" icon={Paperclip}>
            <p className="text-sm text-muted-foreground mb-6">
              Please provide clear, legible copies of the following documents. Formats accepted: PDF, JPG, PNG (Max 10MB per file).
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {REQUIRED_DOCUMENTS.map((d) => (
                <DocUpload
                  key={d.key}
                  label={d.label}
                  required={d.required}
                  file={files[d.key] ?? null}
                  onChange={(f) => setFiles((s) => ({ ...s, [d.key]: f ?? undefined }))}
                />
              ))}
            </div>
          </Section>

          {/* ═══ Student's Pledge ═══ */}
          <Section title="Student's Pledge" icon={BookOpen}>
            <div className="rounded-lg border bg-muted/20 p-6">
              <p className="text-sm leading-relaxed text-foreground/90 text-justify">
                In consideration of my admission to the <strong>ZAMBOANGA DEL SUR PROVINCIAL GOVERNMENT COLLEGE (ZDSPGC)</strong> and of the privileges I will henceforth enjoy as a student of this institution, I hereby pledge to abide the rules and regulations laid down by competent authority of the college in which I am enrolled.
              </p>
              <div className="mt-6">
                <FormField control={form.control} name="pledge_accepted"
                  render={({ field }) => (
                    <FormItem className="flex items-start gap-3">
                      <FormControl>
                        <input
                          type="checkbox"
                          id="pledge-checkbox"
                          checked={field.value}
                          onChange={field.onChange}
                          className="mt-1 h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer accent-[hsl(var(--primary))]"
                        />
                      </FormControl>
                      <FormLabel htmlFor="pledge-checkbox" className="text-sm font-medium cursor-pointer select-none leading-snug">
                        I have read and agree to the Student's Pledge above. <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
          </Section>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-end gap-4 border-t pt-6">
            <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => navigate({ to: "/dashboard" })}>
              Cancel Application
            </Button>
            <Button type="submit" size="lg" className="w-full sm:w-auto font-semibold px-8" disabled={busy}>
              {busy ? "Submitting Application…" : "Submit Final Application"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-card p-6 md:p-8 shadow-sm transition-all duration-200 hover:shadow-md">
      <div className="mb-6 flex items-center gap-3 border-b pb-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <h2 className="font-display text-xl font-semibold text-foreground tracking-tight">{title}</h2>
      </div>
      <div>{children}</div>
    </div>
  );
}

function DocUpload({ label, required, file, onChange }: {
  label: string; required: boolean; file: File | null; onChange: (f: File | null) => void;
}) {
  const isUploaded = !!file;

  return (
    <div className={`flex flex-col gap-3 rounded-lg border p-4 transition-colors ${isUploaded ? "border-success/50 bg-success/5" : "bg-muted/30"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`shrink-0 flex items-center justify-center h-8 w-8 rounded-full ${isUploaded ? "bg-success/20 text-success" : "bg-muted text-muted-foreground"}`}>
             {isUploaded ? <CheckCircle2 className="h-5 w-5" /> : required ? <AlertCircle className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
          </div>
          <div className="min-w-0">
            <p className={`text-sm font-semibold truncate ${isUploaded ? "text-foreground" : ""}`}>
              {label}{required && !isUploaded && <span className="text-destructive ml-1">*</span>}
            </p>
            {isUploaded ? (
              <p className="text-xs text-success font-medium truncate">{file.name}</p>
            ) : (
              <p className="text-xs text-muted-foreground">Required Document</p>
            )}
          </div>
        </div>
      </div>
      
      <div className="flex items-center gap-2 mt-2">
        <label className="cursor-pointer flex-1">
          <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              if (f.size > 10 * 1024 * 1024) { toast.error("File must be 10MB or less"); return; }
              onChange(f);
              e.target.value = "";
            }}
          />
          <span className={`flex w-full items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground ${isUploaded ? "bg-background" : "bg-primary text-primary-foreground hover:bg-primary/90"}`}>
            <Upload className="h-4 w-4" /> {isUploaded ? "Replace File" : "Choose File"}
          </span>
        </label>
        {isUploaded && (
          <Button type="button" size="icon" variant="outline" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => onChange(null)} title="Remove file">
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
