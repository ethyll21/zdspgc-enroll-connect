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
import { useForm, useFieldArray } from "react-hook-form";
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
  email: z.string().optional(),
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
  senior_high_track: z.string().optional(),
  senior_high_school: z.string().optional(),
  senior_high_address: z.string().optional(),
  senior_high_years: z.string().optional(),

  // Academic details
  year_level: z.string().min(1, { message: "Please select your Year Level" }),
  school_year: z.string().min(1, { message: "Please enter the School Year" }),
  semester: z.string().min(1, { message: "Please select the Semester" }),

  // Subjects for Old Students
  subjects: z.array(z.object({
    course_no: z.string().optional(),
    descriptive_title: z.string().optional(),
    units: z.string().optional(),
    time: z.string().optional(),
    days: z.string().optional(),
    room: z.string().optional(),
    final_grade: z.string().optional(),
    posted_by: z.string().optional(),
  })).optional(),

  // Pledge
  pledge_accepted: z.boolean().refine(val => val === true, { message: "You must accept the Student's Pledge to submit" }),
});

function ApplyPage() {
  const { user, isAdmin, loading } = useAuth();
  const navigate    = useNavigate();
  const queryClient = useQueryClient();
  const [busy, setBusy]   = useState(false);
  const [files, setFiles] = useState<Partial<Record<DocKey, File>>>({});
  const [studentType, setStudentType] = useState<"new" | "old">("new");

  useEffect(() => {
    if (!loading && isAdmin) navigate({ to: "/admin", replace: true });
  }, [isAdmin, loading, navigate]);

  // ΓöÇΓöÇ Fetch programs ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
  const { data: programList = [] } = useQuery({
    queryKey: ["programs"],
    queryFn: () => programsApi.list().then((r) => 
      r.programs.filter(p => ["ACT", "BSIS", "BPED"].includes(p.code.toUpperCase()))
    ),
  });

  // ΓöÇΓöÇ Fetch existing student record to pre-fill ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
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
      senior_high_track: "",
      senior_high_school: "", senior_high_address: "", senior_high_years: "",
      // Academic
      school_year: CURRENT_SY,
      semester: SEMESTERS[0],
      pledge_accepted: false,
      subjects: [],
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
        senior_high_track: eb.senior_high_track || "",
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
        senior_high_track: "",
        senior_high_school: "", senior_high_address: "", senior_high_years: "",
        school_year: CURRENT_SY,
        semester: SEMESTERS[0],
        pledge_accepted: false,
      });
    }
  }, [studentRecord, user, form]);

  const submit = async (values: z.infer<typeof applySchema>) => {
    if (studentType === "new") {
      const missingReq = REQUIRED_DOCUMENTS.filter((d) => d.required && !files[d.key]);
      if (missingReq.length) {
        toast.error(`Please upload: ${missingReq.map((d) => d.label).join(", ")}`);
        return;
      }
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
        senior_high_track: values.senior_high_track,
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

      const validSubjects = studentType === "old"
        ? values.subjects?.filter((s) => s.course_no?.trim() || s.descriptive_title?.trim() || s.units?.trim())
        : undefined;

      // 2. Submit enrollment
      await enrollments.submit({ 
        school_year: values.school_year, 
        semester: values.semester,
        student_type: studentType,
        subjects: validSubjects,
      });

      // 3. Upload documents (Only for New Students)
      if (studentType === "new") {
        for (const def of REQUIRED_DOCUMENTS) {
          const file = files[def.key];
          if (!file) continue;
          await docsApi.upload(file, def.key);
        }
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
      {/* Registration Type Switcher */}
      <div className="flex justify-center mb-2 mt-4">
        <div className="inline-flex items-center rounded-full border p-1 bg-muted/20 shadow-sm">
          <button
            type="button"
            onClick={() => {
              setStudentType("new");
              form.clearErrors();
            }}
            className={`px-6 py-2 rounded-full text-sm font-medium transition-colors ${
              studentType === "new"
                ? "bg-primary text-primary-foreground shadow"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            New Student
          </button>
          <button
            type="button"
            onClick={() => {
              setStudentType("old");
              form.clearErrors();
            }}
            className={`px-6 py-2 rounded-full text-sm font-medium transition-colors ${
              studentType === "old"
                ? "bg-primary text-primary-foreground shadow"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Old Student
          </button>
        </div>
      </div>

      {/* Formal Header */}
      <div className="rounded-lg border border-primary/20 bg-primary/5 p-8 text-center shadow-sm">
        <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <ShieldCheck className="h-8 w-8 text-primary" />
        </div>
        <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Republic of the Philippines</p>
        <h1 className="font-display text-2xl font-bold tracking-tight text-primary">ZAMBOANGA DEL SUR PROVINCIAL GOVERNMENT COLLEGE</h1>
        <p className="text-sm text-muted-foreground">Dimataling Campus ┬╖ Dimataling, Zamboanga del Sur</p>
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

          {/* ═══ Top Section (Paper Form for Old Students, Standard Sections for Others) ═══ */}
          {studentType === "old" ? (
            <OldStudentPaperFormHeader form={form} programList={programList} studentType={studentType} />
          ) : (
            <>
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
                  <FormField
                    control={form.control}
                    name="school_year"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>School Year (SY) <span className="text-destructive ml-1" title="Required">*</span></FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. 2026-2027" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
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
                  <div className="hidden">
                    <FormField control={form.control} name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email Address</FormLabel>
                          <FormControl><Input type="email" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
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
            </>
          )}

          {/* ═══ Subjects / Schedule (Old Students only) ═══ */}
          {studentType === "old" && (
            <OldStudentSubjectsSection form={form} />
          )}

          {/* ═══ Personal Information (Old Students only) ═══ */}
          {studentType === "old" && (
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
          )}

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

          {/* ΓòÉΓòÉΓòÉ Educational Background ΓòÉΓòÉΓòÉ */}
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
                      <FormLabel>{studentType === "old" ? "Year Graduated" : "Inclusive Years"}</FormLabel>
                      <FormControl><Input maxLength={20} placeholder={studentType === "old" ? "e.g. 2016" : "e.g. 2010-2016"} {...field} /></FormControl>
                    </FormItem>
                  )}
                />
              </div>

              {/* Junior High School */}
              <div className="space-y-4 rounded-lg border bg-muted/20 p-4">
                <h3 className="text-sm font-semibold text-primary text-center border-b pb-2">{studentType === "old" ? "Secondary (Senior HS)" : "Junior High School"}</h3>
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
                      <FormLabel>{studentType === "old" ? "Year Graduated" : "Inclusive Years"}</FormLabel>
                      <FormControl><Input maxLength={20} placeholder={studentType === "old" ? "e.g. 2020" : "e.g. 2016-2020"} {...field} /></FormControl>
                    </FormItem>
                  )}
                />
                {studentType === "old" && (
                  <FormField control={form.control} name="senior_high_track"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Track</FormLabel>
                        <FormControl><Input maxLength={100} placeholder="e.g. STEM, HUMSS, TVL" {...field} /></FormControl>
                      </FormItem>
                    )}
                  />
                )}
              </div>

              {/* Senior High School / School Last Attended (COLLEGE) */}
              <div className="space-y-4 rounded-lg border bg-muted/20 p-4">
                <h3 className="text-sm font-semibold text-primary text-center border-b pb-2">{studentType === "old" ? "School Last Attended (COLLEGE)" : "Senior High School"}</h3>
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
                      <FormLabel>{studentType === "old" ? "Course & Year" : "Inclusive Years"}</FormLabel>
                      <FormControl><Input maxLength={20} placeholder={studentType === "old" ? "e.g. BSIT 1" : "e.g. 2020-2022"} {...field} /></FormControl>
                    </FormItem>
                  )}
                />
              </div>
            </div>
          </Section>


          {/* ═══ Required Documents (New Students only) ═══ */}
          {studentType === "new" && (
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
          )}

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
              {busy ? "Submitting ApplicationΓÇª" : "Submit Final Application"}
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
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-slate-200">
          <Icon className="h-5 w-5 text-[#0A2540]" />
        </div>
        <h2 className="font-display text-xl font-semibold text-[#0A2540] tracking-tight">{title}</h2>
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

function OldStudentSubjectsSection({ form }: { form: any }) {
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "subjects",
  });

  useEffect(() => {
    if (fields.length < 10) {
      const emptySubject = { course_no: "", descriptive_title: "", units: "", time: "", days: "", room: "", final_grade: "", posted_by: "" };
      const toAdd = 10 - fields.length;
      const newSubjects = Array(toAdd).fill(emptySubject);
      append(newSubjects);
    }
  }, [fields.length, append]);

  const subjects: any[] = form.watch("subjects") ?? [];
  const totalUnits = subjects.reduce((sum: number, s: any) => sum + (parseFloat(s.units) || 0), 0);

  return (
    <div className="rounded-lg border bg-card p-6 md:p-8 shadow-sm">
      <div className="mb-6 flex items-center gap-3 border-b pb-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-slate-200">
          <BookOpen className="h-5 w-5 text-[#0A2540]" />
        </div>
        <h2 className="font-display text-xl font-semibold text-[#0A2540] tracking-tight">Subjects / Schedule</h2>
      </div>

      <p className="text-sm text-muted-foreground mb-4">
        Enter the subjects you are enrolling in for this semester.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-muted/40">
              <th className="border px-3 py-2 text-left font-semibold text-muted-foreground w-8">#</th>
              <th className="border px-3 py-2 text-left font-semibold text-muted-foreground">Course No.</th>
              <th className="border px-3 py-2 text-left font-semibold text-muted-foreground">Descriptive Title</th>
              <th className="border px-3 py-2 text-center font-semibold text-muted-foreground w-20">Units</th>
              <th className="border px-3 py-2 text-left font-semibold text-muted-foreground">Time</th>
              <th className="border px-3 py-2 text-left font-semibold text-muted-foreground">Days</th>
              <th className="border px-3 py-2 text-left font-semibold text-muted-foreground">Room</th>
              <th className="border px-3 py-2 text-center font-semibold text-muted-foreground w-12"></th>
            </tr>
          </thead>
          <tbody>
            {fields.length === 0 && (
              <tr>
                <td colSpan={8} className="border px-3 py-6 text-center text-muted-foreground text-sm italic">
                  No subjects added yet. Click "Add Subject" below to start.
                </td>
              </tr>
            )}
            {fields.map((field, index) => (
              <tr key={field.id} className="hover:bg-muted/20 transition-colors">
                <td className="border px-3 py-2 text-center text-muted-foreground">{index + 1}</td>
                <td className="border px-1 py-1">
                  <Input
                    {...form.register(`subjects.${index}.course_no`)}
                    placeholder="e.g. CS101"
                    className="border-0 bg-transparent h-8 text-sm focus-visible:ring-1"
                  />
                </td>
                <td className="border px-1 py-1">
                  <Input
                    {...form.register(`subjects.${index}.descriptive_title`)}
                    placeholder="Subject name"
                    className="border-0 bg-transparent h-8 text-sm focus-visible:ring-1"
                  />
                </td>
                <td className="border px-1 py-1">
                  <Input
                    {...form.register(`subjects.${index}.units`)}
                    placeholder="3"
                    type="number"
                    min="0"
                    step="0.5"
                    className="border-0 bg-transparent h-8 text-sm text-center focus-visible:ring-1"
                  />
                </td>
                <td className="border px-1 py-1">
                  <Input
                    {...form.register(`subjects.${index}.time`)}
                    placeholder="7:00-8:30"
                    className="border-0 bg-transparent h-8 text-sm focus-visible:ring-1"
                  />
                </td>
                <td className="border px-1 py-1">
                  <Input
                    {...form.register(`subjects.${index}.days`)}
                    placeholder="MWF"
                    className="border-0 bg-transparent h-8 text-sm focus-visible:ring-1"
                  />
                </td>
                <td className="border px-1 py-1">
                  <Input
                    {...form.register(`subjects.${index}.room`)}
                    placeholder="Rm 101"
                    className="border-0 bg-transparent h-8 text-sm focus-visible:ring-1"
                  />
                </td>
                <td className="border px-1 py-1 text-center">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-destructive hover:bg-destructive/10"
                    onClick={() => remove(index)}
                    title="Remove subject"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
          {fields.length > 0 && (
            <tfoot>
              <tr className="bg-muted/30 font-semibold">
                <td colSpan={3} className="border px-3 py-2 text-right text-muted-foreground">Total Units:</td>
                <td className="border px-3 py-2 text-center text-primary font-bold">{totalUnits}</td>
                <td colSpan={4} className="border"></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <div className="mt-4">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => append({ course_no: "", descriptive_title: "", units: "", time: "", days: "", room: "", final_grade: "", posted_by: "" })}
          className="gap-2"
        >
          <span className="text-lg leading-none">+</span> Add Subject
        </Button>
      </div>
    </div>
  );
}

function OldStudentPaperFormHeader({ form, programList, studentType }: { form: any; programList: any[]; studentType: string }) {
  return (
    <div className="mb-8 border border-slate-300 bg-white p-0 text-black font-sans shadow-sm rounded-none overflow-hidden">
      <div className="grid grid-cols-12 divide-x divide-slate-300 border-b border-slate-300">
        <div className="col-span-12 md:col-span-6 p-3 space-y-1">
          <div className="flex gap-2 items-baseline">
            <span className="font-bold text-sm uppercase">NAME:</span>
            <div className="grid grid-cols-3 gap-2 flex-1 pt-4">
              <FormField control={form.control} name="last_name" render={({ field }) => (
                <FormItem className="space-y-0">
                  <FormControl><Input className="h-7 border-0 border-b border-slate-300 rounded-none shadow-none focus-visible:ring-0 px-1 text-sm bg-transparent" {...field} /></FormControl>
                  <FormLabel className="text-[10px] italic text-center block pt-1 font-normal text-black">Last Name</FormLabel>
                </FormItem>
              )} />
              <FormField control={form.control} name="first_name" render={({ field }) => (
                <FormItem className="space-y-0">
                  <FormControl><Input className="h-7 border-0 border-b border-slate-300 rounded-none shadow-none focus-visible:ring-0 px-1 text-sm bg-transparent" {...field} /></FormControl>
                  <FormLabel className="text-[10px] italic text-center block pt-1 font-normal text-black">First Name</FormLabel>
                </FormItem>
              )} />
              <FormField control={form.control} name="middle_name" render={({ field }) => (
                <FormItem className="space-y-0">
                  <FormControl><Input className="h-7 border-0 border-b border-slate-300 rounded-none shadow-none focus-visible:ring-0 px-1 text-sm bg-transparent" {...field} /></FormControl>
                  <FormLabel className="text-[10px] italic text-center block pt-1 font-normal text-black">Middle Name</FormLabel>
                </FormItem>
              )} />
            </div>
          </div>
        </div>
        
        <div className="col-span-4 md:col-span-2 p-3 flex flex-col">
          <span className="font-bold text-xs uppercase mb-1">COURSE</span>
          <FormField control={form.control} name="program_id" render={({ field }) => (
            <FormItem className="space-y-0 flex-1">
              <Select onValueChange={field.onChange} value={field.value || undefined}>
                <FormControl>
                  <SelectTrigger className="h-7 border-0 border-b border-slate-300 rounded-none shadow-none focus:ring-0 px-1 text-xs bg-transparent">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {programList.map((p) => <SelectItem key={p.id} value={p.id}>{p.code}</SelectItem>)}
                </SelectContent>
              </Select>
            </FormItem>
          )} />
        </div>

        <div className="col-span-4 md:col-span-2 p-3 flex flex-col">
          <span className="font-bold text-xs uppercase mb-1">MAJOR</span>
          <FormField control={form.control} name="major" render={({ field }) => (
            <FormItem className="space-y-0 flex-1">
              <FormControl><Input className="h-7 border-0 border-b border-slate-300 rounded-none shadow-none focus-visible:ring-0 px-1 text-xs bg-transparent" {...field} /></FormControl>
            </FormItem>
          )} />
        </div>

        <div className="col-span-4 md:col-span-2 p-3 flex flex-col">
          <span className="font-bold text-xs uppercase mb-1">STUDENT NUMBER</span>
          <FormField control={form.control} name="student_no" render={({ field }) => (
            <FormItem className="space-y-0 flex-1">
              <FormControl><Input className="h-7 border-0 border-b border-slate-300 rounded-none shadow-none focus-visible:ring-0 px-1 text-xs bg-transparent font-mono uppercase" {...field} /></FormControl>
            </FormItem>
          )} />
        </div>
      </div>

      <div className="grid grid-cols-12 divide-x divide-slate-300">
        <div className="col-span-12 md:col-span-6 p-3 grid grid-cols-2 gap-x-6 gap-y-3 text-xs font-semibold">
          <div className="flex items-center gap-2">
            <span>Semester:</span>
            <FormField control={form.control} name="semester" render={({ field }) => (
              <FormItem className="space-y-0 flex-1">
                <Select onValueChange={field.onChange} value={field.value || undefined}>
                  <FormControl>
                    <SelectTrigger className="h-6 border-0 border-b border-slate-300 rounded-none shadow-none focus:ring-0 px-1 text-xs bg-transparent">
                      <SelectValue placeholder="" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="1st Semester">1st</SelectItem>
                    <SelectItem value="2nd Semester">2nd</SelectItem>
                    <SelectItem value="Summer">Summer</SelectItem>
                  </SelectContent>
                </Select>
              </FormItem>
            )} />
          </div>
          <div className="flex items-center gap-2">
            <span>Summer:</span>
            <div className="border-b border-slate-300 flex-1 h-5 flex items-end justify-center px-1 font-normal">
              {form.watch("semester") === "Summer" ? "Yes" : ""}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span>SY:</span>
            <FormField control={form.control} name="school_year" render={({ field }) => (
              <FormItem className="space-y-0 flex-1">
                <FormControl><Input className="h-6 border-0 border-b border-slate-300 rounded-none shadow-none focus-visible:ring-0 px-1 text-xs bg-transparent" {...field} /></FormControl>
              </FormItem>
            )} />
          </div>
          <div className="flex items-center gap-2">
            <span>Year Level:</span>
            <FormField control={form.control} name="year_level" render={({ field }) => (
              <FormItem className="space-y-0 flex-1">
                <Select onValueChange={field.onChange} value={field.value || undefined}>
                  <FormControl>
                    <SelectTrigger className="h-6 border-0 border-b border-slate-300 rounded-none shadow-none focus:ring-0 px-1 text-xs bg-transparent">
                      <SelectValue placeholder="" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {["1st Year", "2nd Year", "3rd Year", "4th Year", "5th Year"].map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                  </SelectContent>
                </Select>
              </FormItem>
            )} />
          </div>
          <div className="col-span-2 flex items-center gap-2 mt-1">
            <span>Date Enrolled:</span>
            <div className="border-b border-slate-300 flex-1 h-5 flex items-end font-normal px-2">
              {new Date().toLocaleDateString()}
            </div>
          </div>
        </div>

        <div className="col-span-8 md:col-span-4 p-3">
          <span className="font-bold text-xs uppercase block mb-3">STATUS OF REGISTRATION</span>
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div className="flex items-center gap-2">
              <span>{studentType === "new" ? "[✔]" : "[ ]"} New Student</span>
            </div>
            <div className="flex items-center gap-2">
              <span>{studentType === "transferee" ? "[✔]" : "[ ]"} Transferee</span>
            </div>
            <div className="flex items-center gap-2">
              <span>{studentType === "old" ? "[✔]" : "[ ]"} Old Student</span>
            </div>
            <div className="flex items-center gap-2">
              <span>{studentType === "returnee" ? "[✔]" : "[ ]"} Returning</span>
            </div>
          </div>
        </div>

        <div className="col-span-4 md:col-span-2 p-3">
          <span className="font-bold text-xs uppercase block mb-3">SEX</span>
          <FormField control={form.control} name="gender" render={({ field }) => (
            <FormItem className="space-y-3">
              <div className="flex items-center gap-2 text-xs cursor-pointer select-none" onClick={() => field.onChange("male")}>
                <span>{field.value === "male" ? "[✔]" : "[ ]"} Male</span>
              </div>
              <div className="flex items-center gap-2 text-xs cursor-pointer select-none" onClick={() => field.onChange("female")}>
                <span>{field.value === "female" ? "[✔]" : "[ ]"} Female</span>
              </div>
            </FormItem>
          )} />
        </div>
      </div>
    </div>
  );
}
