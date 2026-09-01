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
  student_no: z.string().optional(),
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
  const [currentStep, setCurrentStep] = useState(0);

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
      student_no: "",
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


  const newStudentSteps = [
    { id: 'course', title: 'Course & Major', fields: ['program_id', 'major', 'semester', 'school_year', 'year_level'] },
    { id: 'personal', title: 'Personal Information', fields: ['last_name', 'first_name', 'middle_name', 'suffix', 'date_of_birth', 'gender', 'place_of_birth', 'civil_status', 'religion', 'citizenship', 'contact_number', 'email', 'address', 'postal_code'] },
    { id: 'family', title: 'Family Background', fields: ['father_name', 'father_occupation', 'father_company', 'father_address', 'father_contact', 'mother_name', 'mother_occupation', 'mother_company', 'mother_address', 'mother_contact', 'guardian_name', 'guardian_relationship', 'guardian_address', 'guardian_contact', 'emergency_contact_person', 'emergency_contact_address', 'emergency_contact_number'] },
    { id: 'education', title: 'Educational Background', fields: ['elementary_school', 'elementary_address', 'elementary_years', 'junior_high_school', 'junior_high_address', 'junior_high_years', 'senior_high_school', 'senior_high_address', 'senior_high_years'] },
    { id: 'documents', title: 'Required Documents', fields: [] },
    { id: 'pledge', title: 'Student Pledge', fields: ['pledge_accepted'] },
    { id: 'review', title: 'Review & Submit', fields: [] }
  ];

  const oldStudentSteps = [
    { id: 'status', title: 'Status of Registration', fields: ['last_name', 'first_name', 'middle_name', 'program_id', 'major', 'student_no', 'semester', 'school_year', 'year_level', 'gender'] },
    { id: 'subjects', title: 'Subjects/Schedule', fields: ['subjects'] },
    { id: 'personal', title: 'Personal Information', fields: ['date_of_birth', 'place_of_birth', 'civil_status', 'religion', 'citizenship', 'contact_number', 'email', 'address', 'postal_code', 'suffix'] },
    { id: 'family', title: 'Family Background', fields: ['father_name', 'father_occupation', 'father_company', 'father_address', 'father_contact', 'mother_name', 'mother_occupation', 'mother_company', 'mother_address', 'mother_contact', 'guardian_name', 'guardian_relationship', 'guardian_address', 'guardian_contact', 'emergency_contact_person', 'emergency_contact_address', 'emergency_contact_number'] },
    { id: 'education', title: 'Educational Background', fields: ['elementary_school', 'elementary_address', 'elementary_years', 'junior_high_school', 'junior_high_address', 'junior_high_years', 'senior_high_school', 'senior_high_address', 'senior_high_years', 'senior_high_track'] },
    { id: 'pledge', title: "Student's Pledge", fields: ['pledge_accepted'] },
    { id: 'review', title: 'Review & Submit', fields: [] }
  ];

  const currentStepsList = studentType === "new" ? newStudentSteps : oldStudentSteps;
  const isReviewStep = currentStep === currentStepsList.length - 1;

  const handleNext = async () => {
    const fieldsToValidate = currentStepsList[currentStep].fields as any[];
    if (fieldsToValidate.length > 0) {
      const isValid = await form.trigger(fieldsToValidate);
      if (!isValid) return;
    }
    
    // Custom validation for documents step
    if (studentType === "new" && currentStepsList[currentStep].id === 'documents') {
      const missingReq = REQUIRED_DOCUMENTS.filter((d) => d.required && !files[d.key]);
      if (missingReq.length > 0) {
        toast.error(`Please upload: ${missingReq.map((d) => d.label).join(", ")}`);
        return;
      }
    }

    if (currentStep < currentStepsList.length - 1) {
      setCurrentStep(prev => prev + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const ReviewSection = () => {
    const vals = form.getValues();
    
    if (studentType === 'new') {
      return (
        <div className="w-full animate-in fade-in zoom-in-95 duration-300">
           <h2 className="text-xl font-bold text-[#0A2540] mb-4 flex items-center gap-2">
             <CheckCircle2 className="h-6 w-6 text-primary" /> Review Application
           </h2>
           <div className="rounded-lg border p-1 bg-slate-50 overflow-hidden shadow-md">
             <NewStudentPaperReview vals={vals} programList={programList} />
           </div>
           <div className="mt-6 bg-primary/5 p-4 rounded-md border border-primary/20 text-center">
             <p className="text-sm font-medium">Please verify all information above is correct before submitting your final application.</p>
           </div>
        </div>
      );
    }
    
    return (
      <Section title="Review Application" icon={CheckCircle2}>
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <h4 className="font-semibold text-primary mb-2 border-b pb-1">Program Details</h4>
              <p><span className="text-muted-foreground">Type:</span> {studentType === 'new' ? 'New Student' : 'Old Student'}</p>
              <p><span className="text-muted-foreground">Course:</span> {programList.find(p => p.id === vals.program_id)?.code || vals.program_id}</p>
              {vals.major && <p><span className="text-muted-foreground">Major:</span> {vals.major}</p>}
              <p><span className="text-muted-foreground">Semester:</span> {vals.semester}</p>
              <p><span className="text-muted-foreground">School Year:</span> {vals.school_year}</p>
              <p><span className="text-muted-foreground">Year Level:</span> {YEAR_LEVELS[parseInt(vals.year_level) - 1] || vals.year_level}</p>
              {studentType === 'old' && vals.student_no && <p><span className="text-muted-foreground">Student No:</span> {vals.student_no}</p>}
            </div>
            <div>
              <h4 className="font-semibold text-primary mb-2 border-b pb-1">Personal Info</h4>
              <p><span className="text-muted-foreground">Name:</span> {vals.last_name}, {vals.first_name} {vals.middle_name} {vals.suffix}</p>
              <p><span className="text-muted-foreground">Contact:</span> {vals.contact_number}</p>
              <p><span className="text-muted-foreground">Email:</span> {vals.email}</p>
              <p><span className="text-muted-foreground">Address:</span> {vals.address}</p>
            </div>
          </div>
          
          {studentType === 'old' && vals.subjects && vals.subjects.length > 0 && (
             <div>
              <h4 className="font-semibold text-primary mb-2 border-b pb-1">Subjects to Enroll</h4>
              <ul className="list-disc pl-5 text-sm space-y-1">
                {vals.subjects.filter(s => s.course_no || s.descriptive_title).map((s, i) => (
                  <li key={i}>{s.course_no} - {s.descriptive_title} ({s.units} units)</li>
                ))}
              </ul>
             </div>
          )}
          
          <div className="bg-primary/5 p-4 rounded-md border border-primary/20">
            <p className="text-sm">Please verify all information above is correct before submitting your final application.</p>
          </div>
        </div>
      </Section>
    );
  };

  return (
    <div className="mx-auto max-w-4xl space-y-8 pb-24">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2 mt-4 px-1">
        <span className="text-sm font-semibold text-muted-foreground">Select Registration Type</span>
        <div className="inline-flex items-center rounded-full border p-1 bg-muted/20 shadow-sm">
          <button
            type="button"
            onClick={() => { setStudentType("new"); setCurrentStep(0); form.clearErrors(); }}
            className={`px-6 py-2 rounded-full text-sm font-medium transition-colors ${studentType === "new" ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"}`}
          >
            New Student
          </button>
          <button
            type="button"
            onClick={() => { setStudentType("old"); setCurrentStep(0); form.clearErrors(); }}
            className={`px-6 py-2 rounded-full text-sm font-medium transition-colors ${studentType === "old" ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"}`}
          >
            Old Student
          </button>
        </div>
      </div>

      {/* Enhanced Progress Indicator */}
      <div className="mb-12 mt-6">
        <div className="relative flex justify-between items-start">
          {/* Background Track */}
          <div className="absolute left-[5%] right-[5%] top-5 h-[3px] bg-muted overflow-hidden rounded-full -z-0">
            <div 
              className="h-full bg-primary transition-all duration-700 ease-in-out"
              style={{ width: `${(currentStep / (Math.max(1, currentStepsList.length - 1))) * 100}%` }}
            />
          </div>
          
          {currentStepsList.map((step, idx) => {
            const isActive = idx === currentStep;
            const isCompleted = idx < currentStep;
            
            return (
              <div key={step.id} className="relative z-10 flex flex-col items-center flex-1 group">
                <div 
                  className={`
                    flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all duration-500 ease-in-out
                    ${isCompleted ? 'bg-primary border-primary text-primary-foreground shadow-sm' 
                      : isActive ? 'bg-background border-primary text-primary scale-110 ring-4 ring-primary/20 shadow-md' 
                      : 'bg-background border-muted-foreground/30 text-muted-foreground hover:border-primary/50'}
                  `}
                >
                  {isCompleted ? <CheckCircle2 className="w-5 h-5 animate-in zoom-in duration-300" /> : <span className="font-semibold text-sm">{idx + 1}</span>}
                </div>
                <span 
                  className={`text-[10px] sm:text-[11px] mt-3 block text-center max-w-[70px] leading-tight sm:max-w-[100px] transition-all duration-300
                    ${isActive ? 'font-bold text-primary translate-y-0' : isCompleted ? 'font-medium text-foreground/80' : 'font-medium text-muted-foreground opacity-70 group-hover:opacity-100'}
                  `}
                >
                  {step.title}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(submit, (errs) => {
          const first = Object.values(errs)[0]?.message;
          toast.error(typeof first === 'string' ? first : "Please check the form for errors.");
        })} className="space-y-8">

          {/* New Student Course & Major */}
          {studentType === "new" && currentStepsList[currentStep].id === 'course' && (
            <Section title="Course & Major" icon={GraduationCap}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField control={form.control} name="program_id" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Course <span className="text-destructive ml-1" title="Required">*</span></FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || undefined}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Choose course/program" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {programList.map((p) => <SelectItem key={p.id} value={p.id}>{p.name} ({p.code})</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="major" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Major</FormLabel>
                    <FormControl><Input maxLength={150} placeholder="If applicable" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                <FormField control={form.control} name="semester" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Semester <span className="text-destructive ml-1" title="Required">*</span></FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || undefined}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select semester" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {SEMESTERS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="school_year" render={({ field }) => (
                  <FormItem>
                    <FormLabel>School Year (SY) <span className="text-destructive ml-1" title="Required">*</span></FormLabel>
                    <FormControl><Input placeholder="e.g. 2026-2027" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="year_level" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Year Level <span className="text-destructive ml-1" title="Required">*</span></FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || undefined}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select year level" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {YEAR_LEVELS.map((y, i) => <SelectItem key={y} value={String(i + 1)}>{y}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            </Section>
          )}

          {/* Personal Information (Both Types) */}
          {currentStepsList[currentStep].id === 'personal' && (
            <Section title="Personal Information" icon={User}>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <FormField control={form.control} name="last_name" render={({ field }) => (
                  <FormItem><FormLabel>Last Name <span className="text-destructive ml-1">*</span></FormLabel><FormControl><Input maxLength={80} {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="first_name" render={({ field }) => (
                  <FormItem><FormLabel>First Name <span className="text-destructive ml-1">*</span></FormLabel><FormControl><Input maxLength={80} {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="middle_name" render={({ field }) => (
                  <FormItem><FormLabel>Middle Name</FormLabel><FormControl><Input maxLength={80} {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="suffix" render={({ field }) => (
                  <FormItem><FormLabel>Suffix</FormLabel><FormControl><Input maxLength={10} placeholder="Jr., Sr., III" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>

              <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                <FormField control={form.control} name="date_of_birth" render={({ field }) => (
                  <FormItem><FormLabel>Date of Birth</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="gender" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sex <span className="text-destructive ml-1">*</span></FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || undefined}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                      <SelectContent><SelectItem value="female">Female</SelectItem><SelectItem value="male">Male</SelectItem></SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="place_of_birth" render={({ field }) => (
                  <FormItem><FormLabel>Place of Birth</FormLabel><FormControl><Input maxLength={200} {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>

              <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-6">
                <FormField control={form.control} name="civil_status" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Civil Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || undefined}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                      <SelectContent>{CIVIL_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="religion" render={({ field }) => (
                  <FormItem><FormLabel>Religion</FormLabel><FormControl><Input maxLength={100} {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="citizenship" render={({ field }) => (
                  <FormItem><FormLabel>Citizenship</FormLabel><FormControl><Input maxLength={100} {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="contact_number" render={({ field }) => (
                  <FormItem><FormLabel>Contact No.</FormLabel><FormControl><Input placeholder="09XXXXXXXXX" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>

              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="hidden">
                  <FormField control={form.control} name="email" render={({ field }) => (
                    <FormItem><FormLabel>Email Address</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="postal_code" render={({ field }) => (
                  <FormItem><FormLabel>Postal Code</FormLabel><FormControl><Input maxLength={10} placeholder="e.g. 7100" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>

              <div className="mt-6">
                <FormField control={form.control} name="address" render={({ field }) => (
                  <FormItem><FormLabel>Permanent Address <span className="text-destructive ml-1">*</span></FormLabel><FormControl><Textarea rows={2} maxLength={300} {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
            </Section>
          )}

          {/* Family Background (Both Types) */}
          {currentStepsList[currentStep].id === 'family' && (
            <Section title="Family Background" icon={Users}>
              {/* Father & Mother */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-primary border-b pb-2">Father's Information</h3>
                  <FormField control={form.control} name="father_name" render={({ field }) => (<FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)} />
                  <FormField control={form.control} name="father_occupation" render={({ field }) => (<FormItem><FormLabel>Occupation</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)} />
                  <FormField control={form.control} name="father_company" render={({ field }) => (<FormItem><FormLabel>Company</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)} />
                  <FormField control={form.control} name="father_address" render={({ field }) => (<FormItem><FormLabel>Home Address</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)} />
                  <FormField control={form.control} name="father_contact" render={({ field }) => (<FormItem><FormLabel>Contact Number</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)} />
                </div>
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-primary border-b pb-2">Mother's Information</h3>
                  <FormField control={form.control} name="mother_name" render={({ field }) => (<FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)} />
                  <FormField control={form.control} name="mother_occupation" render={({ field }) => (<FormItem><FormLabel>Occupation</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)} />
                  <FormField control={form.control} name="mother_company" render={({ field }) => (<FormItem><FormLabel>Company</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)} />
                  <FormField control={form.control} name="mother_address" render={({ field }) => (<FormItem><FormLabel>Home Address</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)} />
                  <FormField control={form.control} name="mother_contact" render={({ field }) => (<FormItem><FormLabel>Contact Number</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)} />
                </div>
              </div>

              {/* Guardian & Emergency */}
              <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-primary border-b pb-2">Guardian</h3>
                  <FormField control={form.control} name="guardian_name" render={({ field }) => (<FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)} />
                  <FormField control={form.control} name="guardian_relationship" render={({ field }) => (<FormItem><FormLabel>Relationship</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)} />
                  <FormField control={form.control} name="guardian_address" render={({ field }) => (<FormItem><FormLabel>Home Address</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)} />
                  <FormField control={form.control} name="guardian_contact" render={({ field }) => (<FormItem><FormLabel>Contact Number</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)} />
                </div>
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-primary border-b pb-2">In Case of Emergency</h3>
                  <FormField control={form.control} name="emergency_contact_person" render={({ field }) => (<FormItem><FormLabel>Contact Person</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)} />
                  <FormField control={form.control} name="emergency_contact_address" render={({ field }) => (<FormItem><FormLabel>Home Address</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)} />
                  <FormField control={form.control} name="emergency_contact_number" render={({ field }) => (<FormItem><FormLabel>Contact Number</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)} />
                </div>
              </div>
            </Section>
          )}

          {/* Educational Background (Both Types) */}
          {currentStepsList[currentStep].id === 'education' && (
            <Section title="Educational Background" icon={School}>
              <p className="text-sm text-muted-foreground mb-6 italic">Do not abbreviate school names.</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-4 rounded-lg border bg-muted/20 p-4">
                  <h3 className="text-sm font-semibold text-primary text-center border-b pb-2">Elementary</h3>
                  <FormField control={form.control} name="elementary_school" render={({ field }) => (<FormItem><FormLabel>School Name</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)} />
                  <FormField control={form.control} name="elementary_address" render={({ field }) => (<FormItem><FormLabel>School Address</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)} />
                  <FormField control={form.control} name="elementary_years" render={({ field }) => (<FormItem><FormLabel>{studentType === "old" ? "Year Graduated" : "Inclusive Years"}</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)} />
                </div>
                <div className="space-y-4 rounded-lg border bg-muted/20 p-4">
                  <h3 className="text-sm font-semibold text-primary text-center border-b pb-2">{studentType === "old" ? "Secondary (Senior HS)" : "Junior High School"}</h3>
                  <FormField control={form.control} name="junior_high_school" render={({ field }) => (<FormItem><FormLabel>School Name</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)} />
                  <FormField control={form.control} name="junior_high_address" render={({ field }) => (<FormItem><FormLabel>School Address</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)} />
                  <FormField control={form.control} name="junior_high_years" render={({ field }) => (<FormItem><FormLabel>{studentType === "old" ? "Year Graduated" : "Inclusive Years"}</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)} />
                  {studentType === "old" && <FormField control={form.control} name="senior_high_track" render={({ field }) => (<FormItem><FormLabel>Track</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)} />}
                </div>
                <div className="space-y-4 rounded-lg border bg-muted/20 p-4">
                  <h3 className="text-sm font-semibold text-primary text-center border-b pb-2">{studentType === "old" ? "School Last Attended (COLLEGE)" : "Senior High School"}</h3>
                  <FormField control={form.control} name="senior_high_school" render={({ field }) => (<FormItem><FormLabel>School Name</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)} />
                  <FormField control={form.control} name="senior_high_address" render={({ field }) => (<FormItem><FormLabel>School Address</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)} />
                  <FormField control={form.control} name="senior_high_years" render={({ field }) => (<FormItem><FormLabel>{studentType === "old" ? "Course & Year" : "Inclusive Years"}</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)} />
                </div>
              </div>
            </Section>
          )}

          {/* Documents (New Student) */}
          {studentType === "new" && currentStepsList[currentStep].id === 'documents' && (
            <Section title="Required Documents" icon={Paperclip}>
              <p className="text-sm text-muted-foreground mb-6">Please provide clear, legible copies of the following documents.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {REQUIRED_DOCUMENTS.map((d) => (
                  <DocUpload key={d.key} label={d.label} required={d.required} file={files[d.key] ?? null} onChange={(f) => setFiles((s) => ({ ...s, [d.key]: f ?? undefined }))} />
                ))}
              </div>
            </Section>
          )}

          {/* Student Pledge (Both Types) */}
          {currentStepsList[currentStep].id === 'pledge' && (
            <Section title="Student's Pledge" icon={BookOpen}>
              <div className="rounded-lg border bg-muted/20 p-6">
                <p className="text-sm leading-relaxed text-foreground/90 text-justify">
                  In consideration of my admission to the <strong>ZAMBOANGA DEL SUR PROVINCIAL GOVERNMENT COLLEGE (ZDSPGC)</strong> and of the privileges I will henceforth enjoy as a student of this institution, I hereby pledge to abide the rules and regulations laid down by competent authority of the college in which I am enrolled.
                </p>
                <div className="mt-6">
                  <FormField control={form.control} name="pledge_accepted" render={({ field }) => (
                    <FormItem className="flex items-start gap-3">
                      <FormControl><input type="checkbox" id="pledge-checkbox" checked={field.value} onChange={field.onChange} className="mt-1 h-5 w-5 rounded border-gray-300 text-primary cursor-pointer" /></FormControl>
                      <FormLabel htmlFor="pledge-checkbox" className="text-sm font-medium cursor-pointer">I have read and agree to the Student's Pledge above. <span className="text-destructive">*</span></FormLabel>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
              </div>
            </Section>
          )}

          {/* Old Student Status Header */}
          {studentType === "old" && currentStepsList[currentStep].id === 'status' && (
            <OldStudentPaperFormHeader form={form} programList={programList} studentType={studentType} />
          )}

          {/* Old Student Subjects */}
          {studentType === "old" && currentStepsList[currentStep].id === 'subjects' && (
            <OldStudentSubjectsSection form={form} />
          )}

          {/* Review Step */}
          {isReviewStep && <ReviewSection />}

          {/* Navigation Buttons */}
          <div className="mt-8 flex flex-col-reverse sm:flex-row items-center justify-between border-t pt-6 gap-4">
             <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={currentStep > 0 ? handleBack : () => navigate({ to: "/dashboard" })}>
               {currentStep > 0 ? "Back" : "Cancel Application"}
             </Button>
             
             {isReviewStep ? (
               <Button type="submit" size="lg" className="w-full sm:w-auto font-semibold px-8" disabled={busy}>
                 {busy ? "Submitting Application..." : "Submit Final Application"}
               </Button>
             ) : (
               <Button type="button" size="lg" className="w-full sm:w-auto font-semibold px-8" onClick={handleNext}>
                 Next
               </Button>
             )}
          </div>

        </form>
      </Form>
    </div>
  );
}


function NewStudentPaperReview({ vals, programList }: { vals: any; programList: any[] }) {
  const courseCode = programList.find(p => p.id === vals.program_id)?.code || vals.program_id || 'N/A';
  const courseName = programList.find(p => p.id === vals.program_id)?.name || courseCode;

  const Cell = ({ label, value, colSpan = 1 }: { label: string, value: any, colSpan?: number }) => (
    <div className={`p-1 border-r border-slate-300 last:border-r-0 col-span-${colSpan} flex flex-col`}>
      <span className="font-bold text-[9px] uppercase leading-none">{label}:</span>
      <span className="text-[11px] uppercase mt-0.5 whitespace-nowrap overflow-hidden text-ellipsis">{value || 'N/A'}</span>
    </div>
  );

  return (
    <div className="border border-slate-300 bg-white text-black shadow-sm font-sans w-full max-w-full overflow-x-auto">
      <div className="min-w-[800px]">
        {/* Header Section */}
        <div className="flex flex-col items-center justify-center pt-6 pb-4 relative">
          <img src="/province-logo.png" alt="Province Seal" className="absolute left-8 top-6 h-20 w-20 object-contain" />
          <div className="text-center leading-snug">
            <p className="text-[11px]">REPUBLIC OF THE PHILIPPINES</p>
            <p className="text-[15px] font-extrabold tracking-tight mt-0.5">ZAMBOANGA DEL SUR PROVINCIAL GOVERNMENT COLLEGE</p>
            <p className="text-[9px] uppercase mt-0.5">Dimataling Campus - Dimataling, Zamboanga del Sur</p>
          </div>
          <div className="w-full mt-4 border-t-2 border-b border-black py-1 text-center">
            <h1 className="font-extrabold uppercase text-[13px] tracking-wide">COLLEGE ENROLLMENT FORM</h1>
          </div>
          <div className="w-full border-b border-black py-0.5 text-center bg-gray-50">
            <p className="text-[10px] italic">Direction: Fill-out required informations. Do not leave an item blank (indicate N/A if item is not applicable)</p>
          </div>
        </div>

        {/* Course & Major */}
        <div className="px-4 py-2 flex items-end gap-2 text-[11px]">
          <span className="font-bold uppercase whitespace-nowrap">COURSE:</span>
          <span className="border-b border-black flex-1 uppercase px-2">{courseName}</span>
          <span className="font-bold uppercase whitespace-nowrap ml-4">MAJOR:</span>
          <span className="border-b border-black flex-1 uppercase px-2">{vals.major || 'N/A'}</span>
        </div>

        {/* PERSONAL INFORMATION */}
        <div className="mt-2 border-t-4 border-black">
          <div className="bg-black text-white text-center py-0.5 font-bold text-[11px] uppercase">PERSONAL INFORMATION</div>
          <div className="border-x border-b border-slate-300">
            <div className="grid grid-cols-4 border-b border-slate-300">
              <Cell label="LAST NAME" value={vals.last_name} />
              <Cell label="FIRST NAME" value={vals.first_name} />
              <Cell label="MIDDLE NAME" value={vals.middle_name} />
              <Cell label="SUFFIX" value={vals.suffix} />
            </div>
            <div className="grid grid-cols-3 border-b border-slate-300">
              <Cell label="DATE OF BIRTH" value={vals.date_of_birth} />
              <Cell label="SEX" value={vals.gender} />
              <Cell label="CONTACT" value={vals.contact_number} />
            </div>
            <div className="grid grid-cols-3 border-b border-slate-300">
              <Cell label="PLACE OF BIRTH" value={vals.place_of_birth} />
              <Cell label="CITIZENSHIP" value={vals.citizenship} />
              <Cell label="PERMANENT ADDRESS" value={vals.address} />
            </div>
            <div className="grid grid-cols-3">
              <Cell label="CIVIL STATUS" value={vals.civil_status} />
              <Cell label="RELIGION" value={vals.religion} />
              <Cell label="POSTAL CODE" value={vals.postal_code} />
            </div>
          </div>
        </div>

        {/* FAMILY BACKGROUND */}
        <div className="mt-4 border-t-4 border-black">
          <div className="bg-black text-white text-center py-0.5 font-bold text-[11px] uppercase">FAMILY BACKGROUND</div>
          <div className="border-x border-b border-slate-300">
            <div className="grid grid-cols-2 border-b border-slate-300">
              <div className="p-1 border-r border-slate-300">
                <Cell label="FATHER'S NAME" value={vals.father_name} />
                <Cell label="OCCUPATION" value={vals.father_occupation} />
                <Cell label="HOME ADDRESS" value={vals.father_address} />
                <Cell label="CONTACT NUMBER" value={vals.father_contact} />
              </div>
              <div className="p-1">
                <Cell label="MOTHER'S NAME" value={vals.mother_name} />
                <Cell label="OCCUPATION" value={vals.mother_occupation} />
                <Cell label="HOME ADDRESS" value={vals.mother_address} />
                <Cell label="CONTACT NUMBER" value={vals.mother_contact} />
              </div>
            </div>
            <div className="grid grid-cols-2">
              <div className="p-1 border-r border-slate-300">
                <Cell label="GUARDIAN" value={vals.guardian_name} />
                <Cell label="RELATIONSHIP" value={vals.guardian_relationship} />
                <Cell label="HOME ADDRESS" value={vals.guardian_address} />
                <Cell label="CONTACT NUMBER" value={vals.guardian_contact} />
              </div>
              <div className="p-1">
                <Cell label="EMERGENCY CONTACT PERSON" value={vals.emergency_contact_person} />
                <Cell label="HOME ADDRESS" value={vals.emergency_contact_address} />
                <Cell label="CONTACT NUMBER" value={vals.emergency_contact_number} />
              </div>
            </div>
          </div>
        </div>

        {/* EDUCATIONAL BACKGROUND */}
        <div className="mt-4 border-t-4 border-black mb-4">
          <div className="bg-black text-white text-center py-0.5 font-bold text-[11px] uppercase">EDUCATIONAL BACKGROUND</div>
          <div className="border-x border-b border-slate-300 grid grid-cols-3 divide-x divide-slate-300">
            <div className="p-0 flex flex-col">
              <div className="text-center font-bold text-[10px] py-1 border-b border-slate-300">ELEMENTARY<br/><span className="italic font-normal text-[8px]">(do not abbreviate)</span></div>
              <div className="p-1"><Cell label="NAME OF SCHOOL" value={vals.elementary_school} /></div>
              <div className="p-1"><Cell label="SCHOOL ADDRESS" value={vals.elementary_address} /></div>
              <div className="p-1"><Cell label="INCLUSIVE YEARS" value={vals.elementary_years} /></div>
            </div>
            <div className="p-0 flex flex-col">
              <div className="text-center font-bold text-[10px] py-1 border-b border-slate-300">JUNIOR HIGH SCHOOL<br/><span className="italic font-normal text-[8px]">(do not abbreviate)</span></div>
              <div className="p-1"><Cell label="NAME OF SCHOOL" value={vals.junior_high_school} /></div>
              <div className="p-1"><Cell label="SCHOOL ADDRESS" value={vals.junior_high_address} /></div>
              <div className="p-1"><Cell label="INCLUSIVE YEARS" value={vals.junior_high_years} /></div>
            </div>
            <div className="p-0 flex flex-col">
              <div className="text-center font-bold text-[10px] py-1 border-b border-slate-300">SENIOR HIGH SCHOOL<br/><span className="italic font-normal text-[8px]">(do not abbreviate)</span></div>
              <div className="p-1"><Cell label="NAME OF SCHOOL" value={vals.senior_high_school} /></div>
              <div className="p-1"><Cell label="SCHOOL ADDRESS" value={vals.senior_high_address} /></div>
              <div className="p-1"><Cell label="INCLUSIVE YEARS" value={vals.senior_high_years} /></div>
            </div>
          </div>
        </div>
        
      </div>
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

      {/* ── Paper-form bottom section ── */}
      <div className="mt-6 border border-slate-300 text-black text-xs font-sans overflow-x-auto rounded-none">

        {/* Row 1: Advised By | Approved By | Date */}
        <div className="grid grid-cols-12 divide-x divide-slate-300 border-b border-slate-300">
          {/* Advised By */}
          <div className="col-span-6 p-2 text-center">
            <p className="font-semibold uppercase text-[10px] leading-tight">Advised By:</p>
            <p className="font-bold uppercase text-[11px] underline leading-tight mt-0.5">JOANNAH LEA S. LAMBAN</p>
            <p className="text-[10px] leading-tight">DSA</p>
          </div>

          {/* Approved By */}
          <div className="col-span-5 p-2 text-center">
            <p className="font-semibold uppercase text-[10px] leading-tight">Approved By:</p>
            <p className="font-bold uppercase text-[11px] underline leading-tight mt-0.5">JEFFRYL DAVE S. ALBELLAR</p>
            <p className="text-[10px] leading-tight">Registrar</p>
          </div>

          {/* Date */}
          <div className="col-span-1 p-2 flex flex-col">
            <p className="font-semibold text-[10px] leading-tight whitespace-nowrap">Date:</p>
            <div className="border-b border-slate-400 flex-1 mt-1" />
          </div>
        </div>

        {/* Row 2: ROTC/WATC | Commandant | Payment Receipt columns */}
        <div className="grid grid-cols-12 divide-x divide-slate-300">
          {/* ROTC/WATC */}
          <div className="col-span-7 p-2 space-y-1">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="font-semibold">ROTC/WATC:</span>
              <label className="flex items-center gap-1 cursor-pointer select-none">
                <input type="checkbox" className="h-3 w-3 accent-slate-700" /> Deferred by
              </label>
              <div className="border-b border-slate-400 w-24 h-4" />
            </div>
            <div className="flex items-center gap-3 flex-wrap mt-1">
              <label className="flex items-center gap-1 cursor-pointer select-none">
                <input type="checkbox" className="h-3 w-3 accent-slate-700" /> Exempted
              </label>
              <label className="flex items-center gap-1 cursor-pointer select-none">
                <input type="checkbox" className="h-3 w-3 accent-slate-700" /> Enrolled
              </label>
            </div>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="font-semibold whitespace-nowrap">Assessed by:</span>
              <div className="border-b border-slate-400 w-24 h-4" />
              <span className="font-semibold whitespace-nowrap">OR No.:</span>
              <div className="border-b border-slate-400 w-24 h-4" />
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="font-semibold whitespace-nowrap">Commandant:</span>
              <div className="border-b border-slate-400 flex-1 h-4" />
            </div>
          </div>

          {/* Payment Receipt columns */}
          <div className="col-span-5 grid grid-cols-4 divide-x divide-slate-300">
            <div className="p-1 text-center font-semibold text-[10px] flex items-center justify-center border-b border-slate-300">Date</div>
            <div className="p-1 text-center font-semibold text-[10px] flex items-center justify-center border-b border-slate-300">Amount</div>
            <div className="p-1 text-center font-semibold text-[10px] flex items-center justify-center border-b border-slate-300">Collected by:</div>
            <div className="p-1 text-center font-semibold text-[10px] flex items-center justify-center border-b border-slate-300">Student's Signature</div>
            {/* blank receipt row */}
            <div className="p-2 h-10" />
            <div className="p-2 h-10" />
            <div className="p-2 h-10" />
            <div className="p-2 h-10" />
          </div>
        </div>

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
