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
  student_no: z.string().min(1, { message: "Please enter Student No. (or 'N/A')" }),
  program_id: z.string().min(1, { message: "Please select a Course/Program" }),
  major: z.string().min(1, { message: "Please enter Major (or 'N/A')" }),

  // Personal Information
  last_name: z.string().min(1, { message: "Please enter your Last Name" }),
  first_name: z.string().min(1, { message: "Please enter your First Name" }),
  middle_name: z.string().min(1, { message: "Please enter Middle Name (or 'N/A')" }),
  suffix: z.string().min(1, { message: "Please enter Suffix (or 'N/A')" }),
  date_of_birth: z.string().min(1, { message: "Please enter your Date of Birth" }),
  gender: z.string().min(1, { message: "Please select Sex (Male/Female)" }),
  place_of_birth: z.string().min(1, { message: "Please enter your Place of Birth" }),
  civil_status: z.string().min(1, { message: "Please select Civil Status" }),
  religion: z.string().min(1, { message: "Please enter your Religion" }),
  citizenship: z.string().min(1, { message: "Please enter your Citizenship" }),
  contact_number: z.string().regex(/^09\d{9}$/, { message: "Please enter a valid 11-digit mobile number starting with 09" }),
  email: z.string().min(1, { message: "Please enter your Email Address" }).email({ message: "Please enter a valid email address" }),
  address: z.string().min(1, { message: "Please enter your Permanent Address" }),
  postal_code: z.string().min(1, { message: "Please enter your Postal Code" }),

  // Family Background
  father_name: z.string().min(1, { message: "Please enter Father's Name" }),
  father_occupation: z.string().min(1, { message: "Please enter Father's Occupation" }),
  father_company: z.string().min(1, { message: "Please enter Father's Company (or 'N/A')" }),
  father_address: z.string().min(1, { message: "Please enter Father's Address" }),
  father_contact: z.string().min(1, { message: "Please enter Father's Contact Number" }),
  mother_name: z.string().min(1, { message: "Please enter Mother's Name" }),
  mother_occupation: z.string().min(1, { message: "Please enter Mother's Occupation" }),
  mother_company: z.string().min(1, { message: "Please enter Mother's Company (or 'N/A')" }),
  mother_address: z.string().min(1, { message: "Please enter Mother's Address" }),
  mother_contact: z.string().min(1, { message: "Please enter Mother's Contact Number" }),
  guardian_name: z.string().min(1, { message: "Please enter Guardian's Name" }),
  guardian_relationship: z.string().min(1, { message: "Please enter Guardian's Relationship" }),
  guardian_address: z.string().min(1, { message: "Please enter Guardian's Address" }),
  guardian_contact: z.string().min(1, { message: "Please enter Guardian's Contact Number" }),
  emergency_contact_person: z.string().min(1, { message: "Please enter Emergency Contact Person" }),
  emergency_contact_address: z.string().min(1, { message: "Please enter Emergency Contact Address" }),
  emergency_contact_number: z.string().min(1, { message: "Please enter Emergency Contact Number" }),

  // Educational Background
  elementary_school: z.string().min(1, { message: "Please enter Elementary School" }),
  elementary_address: z.string().min(1, { message: "Please enter Elementary Address" }),
  elementary_years: z.string().min(1, { message: "Please enter Elementary Years" }),
  junior_high_school: z.string().min(1, { message: "Please enter Junior High School" }),
  junior_high_address: z.string().min(1, { message: "Please enter Junior High Address" }),
  junior_high_years: z.string().min(1, { message: "Please enter Junior High Years" }),
  senior_high_track: z.string().min(1, { message: "Please enter Senior High Track (or 'N/A')" }),
  senior_high_school: z.string().min(1, { message: "Please enter Senior High School" }),
  senior_high_address: z.string().min(1, { message: "Please enter Senior High Address" }),
  senior_high_years: z.string().min(1, { message: "Please enter Senior High Years" }),

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
      student_no: "N/A",
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
      senior_high_track: "N/A",
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
        student_no:      studentRecord.student_no || "N/A",
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
        senior_high_track: eb.senior_high_track || "N/A",
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
        student_no: "N/A",
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
        senior_high_track: "N/A",
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
      <div className="w-full animate-in fade-in zoom-in-95 duration-300">
         <h2 className="text-xl font-bold text-[#0A2540] mb-4 flex items-center gap-2">
           <CheckCircle2 className="h-6 w-6 text-primary" /> Review Application
         </h2>
         <div className="space-y-6 bg-white text-black p-6 sm:p-8 text-[11px] leading-tight shadow-md border border-slate-200">
           {/* TOP COPY: REGISTRAR'S COPY */}
           <OldStudentPaperReview 
             copyTitle="REGISTRAR'S COPY" 
             vals={vals} 
             programList={programList} 
           />
           {/* Cut Line */}
           <div className="relative py-2 text-center">
             <div className="border-t-2 border-dashed border-slate-400 w-full absolute top-1/2" />
             <span className="relative bg-white px-3 text-[9px] uppercase font-bold text-slate-400 tracking-widest">
               ✂ Cut along dotted line
             </span>
           </div>
           {/* BOTTOM COPY: PROGRAM HEAD'S COPY */}
           <OldStudentPaperReview 
             copyTitle="PROGRAM HEAD'S COPY" 
             vals={vals} 
             programList={programList} 
           />
         </div>
         <div className="mt-6 bg-primary/5 p-4 rounded-md border border-primary/20 text-center">
           <p className="text-sm font-medium">Please verify all information above is correct before submitting your final application.</p>
         </div>
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-4xl space-y-8 pb-24">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2 mt-4 px-1">
        <span className="text-sm font-semibold text-muted-foreground">Select Registration Type</span>
        <div className="inline-flex items-center rounded-full border p-1 bg-muted/20 shadow-sm">
          <button
            type="button"
            onClick={() => { 
              setStudentType("new"); setCurrentStep(0); form.clearErrors(); 
              form.setValue("student_no", "N/A");
              form.setValue("senior_high_track", "N/A");
            }}
            className={`px-6 py-2 rounded-full text-sm font-medium transition-colors ${studentType === "new" ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"}`}
          >
            New Student
          </button>
          <button
            type="button"
            onClick={() => { 
              setStudentType("old"); setCurrentStep(0); form.clearErrors(); 
              if (form.getValues("student_no") === "N/A") form.setValue("student_no", "");
              if (form.getValues("senior_high_track") === "N/A") form.setValue("senior_high_track", "");
            }}
            className={`px-6 py-2 rounded-full text-sm font-medium transition-colors ${studentType === "old" ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"}`}
          >
            Old Student
          </button>
        </div>
      </div>

      {/* Enhanced Progress Indicator — hidden on Review step */}
      {!isReviewStep && <div className="mb-12 mt-6">
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
      </div>}

      <Form {...form}>
        <form 
          onSubmit={(e) => { e.preventDefault(); }}
          className="space-y-8">

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
               <Button
                 type="button"
                 size="lg"
                 className="w-full sm:w-auto font-semibold px-8"
                 disabled={busy}
                 onClick={() => {
                   form.handleSubmit(submit, (errs) => {
                     const first = Object.values(errs)[0]?.message;
                     toast.error(typeof first === 'string' ? first : "Please check the form for errors.");
                   })();
                 }}
               >
                 {busy ? "Submitting..." : "Submit"}
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

  return (
    <div className="space-y-4 bg-white text-black p-8 text-[11px] leading-tight shadow-md border border-slate-200 print:shadow-none print:border-none print:p-0">
      {/* Header */}
      <div className="pb-2 relative">
        <div className="flex items-center justify-between pb-2">
          {/* Left Logo */}
          <div className="w-[120px] flex justify-center shrink-0">
            <img src="/logo.png" alt="ZDSPGC Logo" className="h-20 w-20 object-contain hidden sm:block print:block" />
          </div>

          {/* Center Text */}
          <div className="flex-1 text-center flex flex-col items-center justify-center">
            <p className="text-[11px] leading-tight">Republic of the Philippines</p>
            <p className="text-[13px] font-bold uppercase tracking-wide leading-tight mt-0.5">Zamboanga del Sur</p>
            <p className="text-[14px] font-bold uppercase tracking-wide leading-tight">Provincial Government College</p>
            <p className="text-[13px] font-bold uppercase tracking-wide leading-tight">Dimataling Campus</p>
            <p className="text-[10px] leading-tight mt-0.5">Dimataling, Zamboanga del Sur</p>
          </div>

          {/* Right 2x2 Box */}
          <div className="w-[120px] flex justify-center shrink-0 hidden sm:flex print:flex">
            <div className="w-24 h-24 border border-black flex items-center justify-center text-[10px] text-gray-500">
              2x2
            </div>
          </div>
        </div>

        {/* Title Bar */}
        <div className="bg-black text-white text-center py-1 font-bold text-[13px] tracking-wider uppercase mt-1">
          College Enrollment Form
        </div>

        {/* Direction */}
        <div className="text-left mt-2 leading-tight">
          <p className="text-[12px] italic">Direction: Fill-out required informations. Do not leave an item blank</p>
          <p className="text-[12px] italic ml-10">(indicate N/A if item is not applicable)</p>
        </div>
      </div>

      {/* Course & Major */}
      <div className="grid grid-cols-2 gap-4 pt-1">
        <div className="flex gap-1"><span className="font-bold">COURSE:</span> <span className="border-b border-black flex-1 px-1 font-semibold uppercase">{courseName}</span></div>
        <div className="flex gap-1"><span className="font-bold">MAJOR:</span> <span className="border-b border-black flex-1 px-1 font-semibold uppercase">{vals.major || "N/A"}</span></div>
      </div>

      {/* Personal Information */}
      <div>
        <div className="bg-black text-white text-center font-bold py-0.5 text-xs uppercase">Personal Information</div>
        <div className="border border-black p-2 space-y-1">
          <div className="grid grid-cols-4 gap-2">
            <div><span className="font-bold text-[10px]">LAST NAME:</span><br/><span className="border-b border-black block font-semibold uppercase">{vals.last_name || "—"}</span></div>
            <div><span className="font-bold text-[10px]">FIRST NAME:</span><br/><span className="border-b border-black block font-semibold uppercase">{vals.first_name || "—"}</span></div>
            <div><span className="font-bold text-[10px]">MIDDLE NAME:</span><br/><span className="border-b border-black block font-semibold uppercase">{vals.middle_name || "—"}</span></div>
            <div><span className="font-bold text-[10px]">SUFFIX:</span><br/><span className="border-b border-black block uppercase">{vals.suffix || "N/A"}</span></div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div><span className="font-bold text-[10px]">DATE OF BIRTH:</span> <span>{vals.date_of_birth ? vals.date_of_birth.slice(0, 10) : "—"}</span></div>
            <div><span className="font-bold text-[10px]">SEX:</span> <span className="uppercase font-semibold">{vals.gender || "—"}</span></div>
            <div><span className="font-bold text-[10px]">PLACE OF BIRTH:</span> <span className="uppercase">{vals.place_of_birth || "—"}</span></div>
          </div>
          <div className="grid grid-cols-4 gap-2">
            <div><span className="font-bold text-[10px]">CIVIL STATUS:</span> <span className="uppercase">{vals.civil_status || "—"}</span></div>
            <div><span className="font-bold text-[10px]">RELIGION:</span> <span className="uppercase">{vals.religion || "—"}</span></div>
            <div><span className="font-bold text-[10px]">CITIZENSHIP:</span> <span className="uppercase">{vals.citizenship || "Filipino"}</span></div>
            <div><span className="font-bold text-[10px]">CONTACT:</span> <span>{vals.contact_number || "—"}</span></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><span className="font-bold text-[10px]">PERMANENT ADDRESS:</span> <span className="uppercase">{vals.address || "—"}</span></div>
            <div><span className="font-bold text-[10px]">POSTAL CODE:</span> <span>{vals.postal_code || "—"}</span></div>
          </div>
        </div>
      </div>

      {/* Family Background */}
      <div>
        <div className="bg-black text-white text-center font-bold py-0.5 text-xs uppercase">Family Background</div>
        <div className="border border-black p-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-0.5 uppercase">
              <div><span className="font-bold text-[10px]">FATHER'S NAME:</span> {vals.father_name || "—"}</div>
              <div><span className="font-bold text-[10px]">OCCUPATION:</span> {vals.father_occupation || "—"}</div>
              <div><span className="font-bold text-[10px]">COMPANY:</span> {vals.father_company || "—"}</div>
              <div><span className="font-bold text-[10px]">HOME ADDRESS:</span> {vals.father_address || "—"}</div>
              <div><span className="font-bold text-[10px]">CONTACT NUMBER:</span> {vals.father_contact || "—"}</div>
            </div>
            <div className="space-y-0.5 uppercase">
              <div><span className="font-bold text-[10px]">MOTHER'S NAME:</span> {vals.mother_name || "—"}</div>
              <div><span className="font-bold text-[10px]">OCCUPATION:</span> {vals.mother_occupation || "—"}</div>
              <div><span className="font-bold text-[10px]">COMPANY:</span> {vals.mother_company || "—"}</div>
              <div><span className="font-bold text-[10px]">HOME ADDRESS:</span> {vals.mother_address || "—"}</div>
              <div><span className="font-bold text-[10px]">CONTACT NUMBER:</span> {vals.mother_contact || "—"}</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-2 pt-1 border-t border-gray-400">
            <div className="space-y-0.5 uppercase">
              <div><span className="font-bold text-[10px]">GUARDIAN:</span> {vals.guardian_name || "—"}</div>
              <div><span className="font-bold text-[10px]">RELATIONSHIP:</span> {vals.guardian_relationship || "—"}</div>
              <div><span className="font-bold text-[10px]">HOME ADDRESS:</span> {vals.guardian_address || "—"}</div>
              <div><span className="font-bold text-[10px]">CONTACT NUMBER:</span> {vals.guardian_contact || "—"}</div>
            </div>
            <div className="space-y-0.5 uppercase">
              <div><span className="font-bold text-[10px]">INCASE OF EMERGENCY:</span></div>
              <div><span className="font-bold text-[10px]">CONTACT PERSON:</span> {vals.emergency_contact_person || "—"}</div>
              <div><span className="font-bold text-[10px]">HOME ADDRESS:</span> {vals.emergency_contact_address || "—"}</div>
              <div><span className="font-bold text-[10px]">CONTACT NUMBER:</span> {vals.emergency_contact_number || "—"}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Educational Background */}
      <div>
        <div className="bg-black text-white text-center font-bold py-0.5 text-xs uppercase">Educational Background</div>
        <div className="border border-black">
          <div className="grid grid-cols-3 divide-x divide-black uppercase">
            <div className="p-2 space-y-0.5">
              <div className="font-bold text-center text-[10px] border-b border-black pb-0.5 mb-1">ELEMENTARY<br/><span className="font-normal italic text-[9px] lowercase">(do not abbreviate)</span></div>
              <div><span className="font-bold text-[10px]">NAME OF SCHOOL:</span> {vals.elementary_school || "—"}</div>
              <div><span className="font-bold text-[10px]">SCHOOL ADDRESS:</span> {vals.elementary_address || "—"}</div>
              <div><span className="font-bold text-[10px]">INCLUSIVE YEARS:</span> {vals.elementary_years || "—"}</div>
            </div>
            <div className="p-2 space-y-0.5">
              <div className="font-bold text-center text-[10px] border-b border-black pb-0.5 mb-1">JUNIOR HIGH SCHOOL<br/><span className="font-normal italic text-[9px] lowercase">(do not abbreviate)</span></div>
              <div><span className="font-bold text-[10px]">NAME OF SCHOOL:</span> {vals.junior_high_school || "—"}</div>
              <div><span className="font-bold text-[10px]">SCHOOL ADDRESS:</span> {vals.junior_high_address || "—"}</div>
              <div><span className="font-bold text-[10px]">INCLUSIVE YEARS:</span> {vals.junior_high_years || "—"}</div>
            </div>
            <div className="p-2 space-y-0.5">
              <div className="font-bold text-center text-[10px] border-b border-black pb-0.5 mb-1">SENIOR HIGH SCHOOL<br/><span className="font-normal italic text-[9px] lowercase">(do not abbreviate)</span></div>
              <div><span className="font-bold text-[10px]">NAME OF SCHOOL:</span> {vals.senior_high_school || "—"}</div>
              <div><span className="font-bold text-[10px]">SCHOOL ADDRESS:</span> {vals.senior_high_address || "—"}</div>
              <div><span className="font-bold text-[10px]">INCLUSIVE YEARS:</span> {vals.senior_high_years || "—"}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Student Pledge */}
      <div className="pt-2">
        <div className="text-center font-bold uppercase text-xs mb-1">Student's Pledge</div>
        <p className="text-[10px] text-justify leading-snug px-4">
          In consideration of my admission to the ZAMBOANGA DEL SUR PROVINCIAL GOVERNMENT COLLEGE (ZDSPGC) and of the privileges I will henceforth enjoy as a student of this institution, I hereby pledge to abide the rules and regulations laid down by competent authority of the college in which I am enrolled.
        </p>
      </div>

      {/* Signatures */}
      <div className="mt-10 grid grid-cols-2 gap-8 text-center pt-6">
        <div>
          <div className="border-b border-black w-56 mx-auto mb-1"></div>
          <p className="text-[10px] uppercase font-bold">Student Signature</p>
          <p className="text-[9px]">over printed name</p>
        </div>
        <div>
          <div className="border-b border-black w-56 mx-auto mb-1"></div>
          <p className="text-[10px] uppercase font-bold">Registrar / Verifying Officer</p>
          <p className="text-[9px]">Signature over printed name</p>
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
                    {["1st Year", "2nd Year", "3rd Year", "4th Year"].map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
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

function OldStudentPaperReview({ vals, programList, copyTitle }: { vals: any; programList: any[]; copyTitle: string }) {
  const courseCode = programList.find(p => p.id === vals.program_id)?.code || vals.program_id || 'N/A';
  const subjects = vals.subjects || [];
  const paddedSubjects = [...subjects];
  while (paddedSubjects.length < 8) {
    paddedSubjects.push({ course_no: "", descriptive_title: "", units: "", time: "", days: "", room: "", final_grade: "", posted_by: "" });
  }

  const totalUnits = subjects.reduce((sum: number, s: any) => {
    const u = Number(s.units);
    return sum + (isNaN(u) ? 0 : u);
  }, 0);

  return (
    <div className="border border-black p-3.5 relative text-[10px] leading-tight font-sans">
      {/* Right Margin Vertical Copy Indicator */}
      <div className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] font-bold tracking-widest uppercase [writing-mode:vertical-rl] rotate-180 text-black border-l border-black pl-1 h-36 flex items-center justify-center">
        {copyTitle}
      </div>

      {/* Header */}
      <div className="text-center relative pb-2 border-b border-black pr-6">
        <div className="flex items-center justify-center gap-3">
          <img src="/logo.png" alt="ZDSPGC Logo" className="h-10 w-10 object-contain hidden sm:block print:block" />
          <div>
            <p className="text-[8px] uppercase tracking-wide">Republic of the Philippines</p>
            <p className="text-[8px] uppercase font-semibold">Zamboanga Peninsula, Region-IX</p>
            <p className="text-[8.5px] uppercase font-bold">PROVINCE OF ZAMBOANGA DEL SUR</p>
            <h1 className="text-xs font-black uppercase tracking-wider">ZAMBOANGA DEL SUR PROVINCIAL GOVERNMENT COLLEGE</h1>
            <p className="text-[8px] uppercase">DIMATALING, ZAMBOANGA DEL SUR</p>
          </div>
        </div>
        <p className="text-left text-[7.5px] italic mt-1 font-bold uppercase tracking-wide border-t border-black pt-0.5">
          WRITE IN CAPITAL LETTERS: Fill-out this Form Correctly &amp; Legibly.
        </p>
      </div>

      {/* Top Student Box */}
      <div className="border-b border-black py-1.5 pr-6 grid grid-cols-12 gap-1 text-[9px]">
        <div className="col-span-6 flex flex-col justify-end border-r border-black pr-2">
          <div className="flex items-baseline gap-1 mb-0.5">
            <div className="flex justify-between flex-1 uppercase font-bold text-[10px] px-1">
              <span className="text-left w-1/3 truncate">{vals.last_name || ""}</span>
              <span className="text-center w-1/3 truncate">{vals.first_name || ""}</span>
              <span className="text-right w-1/3 truncate">{vals.middle_name || ""}</span>
            </div>
          </div>
          <div className="flex justify-between text-[7px] text-slate-500 pt-0.5 px-1 border-t border-slate-300">
            <span className="text-left w-1/3">Last Name</span>
            <span className="text-center w-1/3">First Name</span>
            <span className="text-right w-1/3">Middle Name</span>
          </div>
        </div>
        <div className="col-span-6 grid grid-cols-3 gap-1 pl-1">
          <div>
            <span className="font-bold text-[8px] block">COURSE:</span>
            <span className="font-bold text-[9px] uppercase">{courseCode}</span>
          </div>
          <div>
            <span className="font-bold text-[8px] block">MAJOR:</span>
            <span className="font-bold text-[9px] uppercase">{vals.major || "N/A"}</span>
          </div>
          <div>
            <span className="font-bold text-[8px] block">STUDENT NUMBER:</span>
            <span className="font-mono font-bold text-[9.5px] uppercase">{vals.student_no || "—"}</span>
          </div>
        </div>
      </div>

      {/* Term & Registration Details Grid */}
      <div className="border-b border-black py-1.5 pr-6 grid grid-cols-12 gap-2 text-[8.5px]">
        <div className="col-span-5 space-y-0.5 border-r border-black pr-2">
          <div className="flex justify-between">
            <span><strong>Semester:</strong> {vals.semester?.includes("1st") ? "[✔] 1st" : vals.semester?.includes("2nd") ? "[✔] 2nd" : vals.semester}</span>
            <span><strong>Summer:</strong> {vals.semester === "Summer" ? "[✔]" : "____"}</span>
          </div>
          <div className="flex justify-between">
            <span><strong>SY:</strong> {vals.school_year}</span>
            <span><strong>Year Level:</strong> {vals.year_level ? `${vals.year_level} Year` : "—"}</span>
          </div>
          <div><strong>Date Enrolled:</strong> {new Date().toLocaleDateString()}</div>
        </div>
        <div className="col-span-5 space-y-0.5 border-r border-black pr-2">
          <span className="font-bold uppercase text-[8px] block">STATUS OF REGISTRATION</span>
          <div className="grid grid-cols-2 gap-0.5 text-[8px]">
            <span>[ ] New Student</span>
            <span>[ ] Transferee</span>
            <span>[✔] Old Student</span>
            <span>[ ] Returning</span>
          </div>
        </div>
        <div className="col-span-2 flex flex-col justify-center">
          <span className="font-bold uppercase text-[8px] block">SEX</span>
          <div className="text-[8px] space-y-0.5">
            <span>{vals.gender === "male" ? "[✔]" : "[ ]"} Male</span><br/>
            <span>{vals.gender === "female" ? "[✔]" : "[ ]"} Female</span>
          </div>
        </div>
      </div>

      {/* Subject Schedule Table */}
      <div className="pr-6 pt-1">
        <table className="w-full text-left border-collapse border border-black text-[8px]">
          <thead>
            <tr className="bg-slate-100 divide-x divide-black border-b border-black font-bold text-center">
              <th className="p-1 w-20">Course No.</th>
              <th className="p-1">Descriptive Title</th>
              <th className="p-1 w-10">Units</th>
              <th className="p-1 w-24">Time</th>
              <th className="p-1 w-14">Days</th>
              <th className="p-1 w-14">Room</th>
              <th className="p-1 w-16">Final Grade</th>
              <th className="p-1 w-20">Posted by</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black">
            {paddedSubjects.map((sub, idx) => (
              <tr key={idx} className="divide-x divide-black h-4.5">
                <td className="p-0.5 px-1 font-mono uppercase font-bold">{sub.course_no || ""}</td>
                <td className="p-0.5 px-1 truncate max-w-[200px]">{sub.descriptive_title || ""}</td>
                <td className="p-0.5 text-center font-semibold">{sub.units || ""}</td>
                <td className="p-0.5 px-1">{sub.time || ""}</td>
                <td className="p-0.5 px-1 uppercase">{sub.days || ""}</td>
                <td className="p-0.5 px-1">{sub.room || ""}</td>
                <td className="p-0.5 text-center">{sub.final_grade || ""}</td>
                <td className="p-0.5 px-1">{sub.posted_by || ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Bottom Signatories & ROTC Block */}
      <div className="pr-6 pt-1.5 space-y-1 text-[8px]">
        <div className="grid grid-cols-12 gap-2 border-b border-black pb-1">
          <div className="col-span-4 flex items-center gap-1">
            <strong>Total Units:</strong> <span className="font-bold underline text-[9px]">{totalUnits || "—"}</span>
          </div>
          <div className="col-span-4">
            <span className="font-bold text-[7px] uppercase block text-slate-500">ADVISED BY:</span>
            <div className="inline-block text-center mt-2">
              <p className="font-bold uppercase text-[8.5px] border-b border-black">JOANNAH LEA S. LAMBAN</p>
              <span className="text-[7px] block">DSA</span>
            </div>
          </div>
          <div className="col-span-4">
            <span className="font-bold text-[7px] uppercase block text-slate-500">APPROVED BY:</span>
            <div className="inline-block text-center mt-2">
              <p className="font-bold uppercase text-[8.5px] border-b border-black">JEFFRYL DAVE S. ALBELLAR</p>
              <span className="text-[7px] block">Registrar</span>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-12 gap-2 pt-0.5">
          <div className="col-span-8 text-[7.5px] leading-tight space-y-0.5">
            <div><strong>ROTC/WATC:</strong> [ ] Deferred by: _____ · Assessed by: _____ · OR No.: _____</div>
            <div>[ ] Exempted · [✔] Enrolled · Commandant: ________________</div>
          </div>
          <div className="col-span-4 text-center">
            <div className="border-b border-black w-36 mx-auto mb-0.5 mt-5"></div>
            <p className="text-[7.5px] uppercase font-bold">Student's Signature</p>
          </div>
        </div>
      </div>
    </div>
  );
}
