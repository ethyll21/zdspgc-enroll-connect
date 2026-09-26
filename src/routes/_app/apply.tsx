import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, useRef } from "react";
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
import { FormScaleWrapper } from "@/components/FormScaleWrapper";

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
  suffix: z.string().optional(),
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
  student_type: z.string().optional(),
  date_enrolled: z.string().optional(),

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
  // Uncontrolled personal info fields for old students (persisted across step navigation)
  const [oldAge, setOldAge] = useState("");
  const [oldPresentAddress, setOldPresentAddress] = useState("");
  const [oldEmployer, setOldEmployer] = useState("");
  const [oldOccupation, setOldOccupation] = useState("");

  useEffect(() => {
    if (!loading && isAdmin) navigate({ to: "/admin", replace: true });
  }, [isAdmin, loading, navigate]);

  // ΓöÇΓöÇ Fetch programs ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
  const { data: programList = [] } = useQuery({
    queryKey: ["programs"],
    enabled: typeof window !== 'undefined',
    queryFn: () => programsApi.list().then((r) => r.programs.filter(p => p.active !== false)),
  });

  // ΓöÇΓöÇ Fetch existing student record to pre-fill ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
  const { data: studentRecord } = useQuery({
    queryKey: ["student-me", user?.id],
    enabled: typeof window !== 'undefined' && !!user,
    queryFn: () => students.me().then((r) => r.student).catch(() => null),
  });

  const form = useForm<z.infer<typeof applySchema>>({
    resolver: zodResolver(applySchema),
    defaultValues: {
      student_no: "N/A",
      first_name: "", middle_name: "N/A", last_name: "", suffix: "N/A",
      contact_number: "", date_of_birth: "",
      gender: "", address: "", email: "",
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
      student_type: "new",
      date_enrolled: new Date().toISOString().split("T")[0],
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
        middle_name:     studentRecord.middle_name || "N/A",
        last_name:       studentRecord.last_name || nameParts[nameParts.length - 1] || "",
        suffix:          studentRecord.suffix || "N/A",
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
        student_type: "new",
        date_enrolled: new Date().toISOString().split("T")[0],
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

      // 2. Submit enrollment (or get existing if duplicate)
      let enrollmentId: string | undefined;
      try {
        const enrollmentResult = await enrollments.submit({ 
          school_year: values.school_year, 
          semester: values.semester,
          student_type: values.student_type || studentType,
          subjects: validSubjects,
        });
        enrollmentId = enrollmentResult.enrollment?.id;
        console.log('[apply] enrollment created:', enrollmentId);
      } catch (enrollErr: any) {
        // If duplicate enrollment (409), fetch the existing one for this period
        if (enrollErr.message?.includes('already have an active enrollment')) {
          const existing = await enrollments.my();
          const found = existing.enrollments?.find(
            (e: any) => e.school_year === values.school_year && e.semester === values.semester
          );
          enrollmentId = found?.id;
          console.log('[apply] using existing enrollment id:', enrollmentId);
          if (!enrollmentId) throw enrollErr; // re-throw if can't find it
        } else {
          throw enrollErr; // re-throw other errors
        }
      }

      if (!enrollmentId) {
        throw new Error('Failed to get enrollment ID after submission. Please try again.');
      }

      // 3. Upload documents (Only for New/Transferee/Returnee students)
      if (studentType !== "old") {
        const uploadErrors: string[] = [];
        for (const def of REQUIRED_DOCUMENTS) {
          const file = files[def.key];
          if (!file) continue;
          try {
            console.log('[apply] uploading', def.key, 'for enrollment', enrollmentId);
            await docsApi.upload(file, def.key, enrollmentId);
            console.log('[apply] uploaded', def.key, 'OK');
          } catch (uploadErr: any) {
            console.error(`[apply] Document upload failed for ${def.key}:`, uploadErr);
            uploadErrors.push(`${def.label ?? def.key} (Error: ${uploadErr?.message || 'Upload failed'})`);
          }
        }
        if (uploadErrors.length > 0) {
          const msg = `Enrollment submitted, but the following documents FAILED to upload:\n\n${uploadErrors.join('\n')}\n\nPlease re-upload them from your application page.`;
          toast.error(msg, { duration: 15000 });
          alert(msg);
        }
      }

      toast.success("Enrollment submitted successfully!");
      queryClient.invalidateQueries({ queryKey: ["my-enrollments"] });
      queryClient.invalidateQueries({ queryKey: ["student-me"] });
      navigate({ to: `/applications/${enrollmentId}` });
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
    { id: 'status', title: 'Course & Major', fields: ['last_name', 'first_name', 'middle_name', 'program_id', 'major', 'student_no', 'semester', 'school_year', 'year_level', 'gender'] },
    { id: 'subjects', title: 'Subjects/Schedule', fields: ['subjects'] },
    { id: 'personal', title: 'Personal Information', fields: ['date_of_birth', 'gender', 'place_of_birth', 'civil_status', 'religion', 'citizenship', 'contact_number', 'email', 'address', 'postal_code'] },
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
      if (!isValid) {
        setTimeout(() => {
          const firstError = document.querySelector('[aria-invalid="true"]');
          if (firstError) {
            firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
            (firstError as HTMLElement).focus();
          }
        }, 50);
        return;
      }
    }

    // Extra validation for old student personal step (uncontrolled plain inputs)
    if (studentType === "old" && currentStepsList[currentStep].id === 'personal') {
      const checks = [
        { id: 'old-age',            msg: 'Please enter your Age (e.g. 20)' },
        { id: 'old-present-address',msg: 'Please enter your Present Address (or N/A)' },
        { id: 'old-employer',       msg: 'Please enter Name & Address of Employer (or N/A)' },
        { id: 'old-occupation',     msg: 'Please enter your Occupation (or N/A)' },
      ];
      let firstEmpty: HTMLInputElement | null = null;
      checks.forEach(({ id, msg }) => {
        const el = document.getElementById(id) as HTMLInputElement | null;
        const errEl = document.getElementById(id + '-error');
        if (!el) return;
        if (!el.value.trim()) {
          el.style.borderColor = '#f87171';
          el.style.borderWidth = '1px';
          el.style.borderStyle = 'solid';
          el.style.backgroundColor = '';
          if (errEl) { errEl.innerHTML = '<span style="display:inline-flex;align-items:center;gap:4px;"><span style="width:14px;height:14px;border-radius:50%;background:#f87171;color:white;font-size:10px;font-weight:bold;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;">!</span>' + msg + '</span>'; errEl.style.display = 'block'; }
          if (!firstEmpty) firstEmpty = el;
        } else {
          el.style.borderColor = '';
          el.style.borderWidth = '';
          el.style.borderStyle = '';
          el.style.backgroundColor = '';
          if (errEl) { errEl.innerHTML = ''; errEl.style.display = 'none'; }
        }
      });
      if (firstEmpty) {
        (firstEmpty as HTMLInputElement).scrollIntoView({ behavior: 'smooth', block: 'center' });
        (firstEmpty as HTMLInputElement).focus();
        return;
      }
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
              // Clear hidden fields so new students can fill them in
              if (form.getValues("suffix") === "N/A") form.setValue("suffix", "");
              if (form.getValues("middle_name") === "N/A") form.setValue("middle_name", "");
              form.setValue("student_type", "new");
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
              form.setValue("student_type", "old");
            }}
            className={`px-6 py-2 rounded-full text-sm font-medium transition-colors ${studentType === "old" ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"}`}
          >
            Old Student
          </button>
        </div>
      </div>

      {/* Progress Indicator — hidden on Review step */}
      {!isReviewStep && (
        <div className="mb-8 mt-4">
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm px-6 py-4">
            {/* Step labels row */}
            <div className="flex items-center justify-between mb-3">
              {currentStepsList.map((step, idx) => {
                const isActive = idx === currentStep;
                const isCompleted = idx < currentStep;
                return (
                  <span
                    key={step.id}
                    className={`text-[10px] font-semibold text-center flex-1 transition-all duration-300 ${
                      isActive ? 'text-primary' : isCompleted ? 'text-foreground/60' : 'text-muted-foreground/40'
                    }`}
                  >
                    {isActive ? step.title : ''}
                  </span>
                );
              })}
            </div>

            {/* Track + Bubbles */}
            <div className="relative flex items-center justify-between">
              {/* Full background track */}
              <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[2px] bg-slate-200 rounded-full" />
              {/* Filled progress track */}
              <div
                className="absolute top-1/2 -translate-y-1/2 h-[2px] bg-primary rounded-full transition-all duration-700 ease-in-out left-0"
                style={{ width: `${(currentStep / Math.max(1, currentStepsList.length - 1)) * 100}%` }}
              />

              {currentStepsList.map((step, idx) => {
                const isActive = idx === currentStep;
                const isCompleted = idx < currentStep;
                return (
                  <div
                    key={step.id}
                    className={`relative z-10 flex items-center justify-center rounded-full border-2 transition-all duration-500 ease-in-out
                      ${isCompleted
                        ? 'w-7 h-7 bg-primary border-primary text-primary-foreground'
                        : isActive
                        ? 'w-9 h-9 bg-white border-primary text-primary ring-4 ring-primary/15 shadow-md'
                        : 'w-6 h-6 bg-white border-slate-300 text-slate-400'}
                    `}
                  >
                    {isCompleted
                      ? <CheckCircle2 className="w-3.5 h-3.5" />
                      : <span className={`font-bold ${isActive ? 'text-sm' : 'text-[10px]'}`}>{idx + 1}</span>
                    }
                  </div>
                );
              })}
            </div>

            {/* Step count label */}
            <div className="mt-3 text-center text-[11px] text-muted-foreground">
              Step <span className="font-semibold text-primary">{currentStep + 1}</span> of {currentStepsList.length}
            </div>
          </div>
        </div>
      )}

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
              {/* Row 1: Last Name / First Name / Middle Name / Suffix — new students only */}
              {studentType !== "old" && (
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
              )}

              {/* Row 2: Sex / Civil Status / Date of Birth / Place of Birth */}
              <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-6">
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
                <FormField control={form.control} name="date_of_birth" render={({ field }) => (
                  <FormItem><FormLabel>Birthdate</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="place_of_birth" render={({ field }) => (
                  <FormItem><FormLabel>Place of Birth</FormLabel><FormControl><Input maxLength={200} {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>

              {/* Row 2b: Age / Zip Code */}
              <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium leading-none">Age</label>
                  <Input id="old-age" type="number" min={1} max={120} placeholder="Enter age"
                    value={oldAge} onChange={e => setOldAge(e.target.value)} />
                  <p id="old-age-error" className="text-xs text-destructive font-medium" style={{display:'none'}}></p>
                </div>
                <FormField control={form.control} name="postal_code" render={({ field }) => (
                  <FormItem><FormLabel>Zip Code</FormLabel><FormControl><Input maxLength={10} placeholder="e.g. 7100" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>

              {/* Row 3: Home Address */}
              <div className="mt-6">
                <FormField control={form.control} name="address" render={({ field }) => (
                  <FormItem><FormLabel>Home Address <span className="text-destructive ml-1">*</span></FormLabel><FormControl><Input maxLength={300} {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>

              <div className="mt-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium leading-none">
                    Present Address
                  </label>
                  <Input id="old-present-address" maxLength={300} placeholder=""
                    value={oldPresentAddress} onChange={e => setOldPresentAddress(e.target.value)} />
                  <p id="old-present-address-error" className="text-xs text-destructive font-medium" style={{display:'none'}}></p>
                </div>
              </div>

              {/* Row 5: Contact Number / Email Address */}
              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField control={form.control} name="contact_number" render={({ field }) => (
                  <FormItem><FormLabel>Contact Number</FormLabel><FormControl><Input placeholder="09XXXXXXXXX" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="email" render={({ field }) => (
                  <FormItem><FormLabel>Email Address</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>

              {/* Row 6: Citizenship */}
              <div className="mt-6">
                <FormField control={form.control} name="citizenship" render={({ field }) => {
                  const isAlien = field.value && field.value.toLowerCase() !== "filipino" && field.value !== "";
                  return (
                    <FormItem>
                      <FormLabel className="uppercase font-bold text-sm">Citizenship</FormLabel>
                      <div className="flex flex-wrap items-center gap-6 mt-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" name="citizenship_type" className="w-4 h-4"
                            checked={!isAlien || field.value === "" || field.value?.toLowerCase() === "filipino"}
                            onChange={() => field.onChange("Filipino")}
                          />
                          <span className="text-sm font-medium">Filipino</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" name="citizenship_type" className="w-4 h-4"
                            checked={isAlien}
                            onChange={() => field.onChange("")}  
                          />
                          <span className="text-sm font-medium">If Alien, ACR No.:</span>
                        </label>
                        <Input
                          className="w-48"
                          placeholder="ACR Number"
                          value={isAlien ? (field.value || "") : ""}
                          onChange={(e) => field.onChange(e.target.value)}
                        />
                      </div>
                      <FormMessage />
                    </FormItem>
                  );
                }} />
              </div>

              {/* Row 7: Religious Affiliation */}
              <div className="mt-6">
                <FormField control={form.control} name="religion" render={({ field }) => {
                  const isIslam = field.value?.toLowerCase() === "islam";
                  const isProtestant = field.value?.toLowerCase() === "protestant";
                  const isCatholic = field.value?.toLowerCase() === "catholic";
                  const isOther = field.value && !isIslam && !isProtestant && !isCatholic;
                  return (
                    <FormItem>
                      <FormLabel className="font-bold text-sm">Religious Affiliation</FormLabel>
                      <div className="flex flex-wrap items-center gap-6 mt-2">
                        {[{ label: "Islam", value: "Islam" }, { label: "Protestant", value: "Protestant" }, { label: "Catholic", value: "Catholic" }].map(opt => (
                          <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                            <input type="radio" name="religion_type" className="w-4 h-4"
                              checked={field.value?.toLowerCase() === opt.value.toLowerCase()}
                              onChange={() => field.onChange(opt.value)}
                            />
                            <span className="text-sm font-medium">{opt.label}</span>
                          </label>
                        ))}
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" name="religion_type" className="w-4 h-4"
                            checked={!!isOther}
                            onChange={() => field.onChange(" ")}
                          />
                          <span className="text-sm font-medium">Other (pls specify)</span>
                        </label>
                        <Input
                          className="w-48"
                          placeholder="Specify religion"
                          value={isOther ? (field.value || "") : ""}
                          onChange={(e) => field.onChange(e.target.value)}
                        />
                      </div>
                      <FormMessage />
                    </FormItem>
                  );
                }} />
              </div>

              {/* Row 8: Name & Address of Employer (old students) */}
              {studentType === "old" && (
                <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium leading-none">
                      Name &amp; Address of Employer <span className="text-muted-foreground text-xs">(If Employed)</span>
                    </label>
                    <Input id="old-employer" maxLength={200} placeholder=""
                      value={oldEmployer} onChange={e => setOldEmployer(e.target.value)} />
                    <p id="old-employer-error" className="text-xs text-destructive font-medium" style={{display:'none'}}></p>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium leading-none">
                      Occupation <span className="text-muted-foreground text-xs">(If Employed)</span>
                    </label>
                    <Input id="old-occupation" maxLength={100} placeholder=""
                      value={oldOccupation} onChange={e => setOldOccupation(e.target.value)} />
                    <p id="old-occupation-error" className="text-xs text-destructive font-medium" style={{display:'none'}}></p>
                  </div>
                </div>
              )}
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
                  <FormField control={form.control} name="father_company" render={({ field }) => (<FormItem><FormLabel>Monthly Income</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)} />
                  <FormField control={form.control} name="father_address" render={({ field }) => (<FormItem><FormLabel>Home Address</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)} />
                  <FormField control={form.control} name="father_contact" render={({ field }) => (<FormItem><FormLabel>Contact Number</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)} />
                </div>
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-primary border-b pb-2">Mother's Information</h3>
                  <FormField control={form.control} name="mother_name" render={({ field }) => (<FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)} />
                  <FormField control={form.control} name="mother_occupation" render={({ field }) => (<FormItem><FormLabel>Occupation</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)} />
                  <FormField control={form.control} name="mother_company" render={({ field }) => (<FormItem><FormLabel>Monthly Income</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)} />
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
            <Section title="Course & Major" icon={GraduationCap}>
              <FormScaleWrapper>
                  <OldStudentPaperFormHeader form={form} programList={programList} studentType={studentType} />
              </FormScaleWrapper>
            </Section>
          )}

          {/* Old Student Subjects */}
          {studentType === "old" && currentStepsList[currentStep].id === 'subjects' && (
            <OldStudentSubjectsSection form={form} />
          )}

          {/* Review Step */}
          {isReviewStep && (
            <div className="w-full animate-in fade-in zoom-in-95 duration-300">
              <h2 className="text-xl font-bold text-[#0A2540] mb-4 flex items-center gap-2">
                <CheckCircle2 className="h-6 w-6 text-primary" /> Review Application
              </h2>
              {studentType === 'new' ? (
                <div className="space-y-6">
                  <div className="rounded-lg border p-1 bg-slate-50 overflow-hidden shadow-md">
                    <FormScaleWrapper>
                        <NewStudentPaperReview vals={form.getValues()} programList={programList} />
                    </FormScaleWrapper>
                  </div>
                  <div className="rounded-lg border bg-white p-6 shadow-sm">
                    <h3 className="font-semibold text-slate-800 border-b pb-3 mb-4 flex items-center gap-2"><Paperclip className="h-5 w-5 text-primary" /> Documents to Submit</h3>
                    {Object.values(files).filter(Boolean).length === 0 ? (
                      <p className="text-sm text-slate-500">No documents uploaded.</p>
                    ) : (
                      <div className="grid grid-cols-1 gap-6">
                        {REQUIRED_DOCUMENTS.map(def => {
                          const file = files[def.key];
                          if (!file) return null;
                          const isImage = file.type.startsWith('image/');
                          const isPdf = file.type === 'application/pdf';
                          const fileUrl = URL.createObjectURL(file);
                          return (
                            <div key={def.key} className="flex flex-col gap-4 rounded-xl border p-4 shadow-sm bg-muted/10">
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="font-semibold text-primary">{def.label}</p>
                                  <p className="text-sm text-muted-foreground truncate">{file.name}</p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <span className="status-pill bg-amber-100 text-amber-800 border-amber-200">PENDING</span>
                                </div>
                              </div>
                              <div className="mt-2 w-full overflow-hidden rounded-lg border bg-muted/30 flex items-center justify-center min-h-[200px] max-h-[600px] relative">
                                {isImage ? (
                                  <img src={fileUrl} alt={file.name} className="object-contain w-full h-full max-h-[600px]" />
                                ) : isPdf ? (
                                  <iframe src={fileUrl} className="w-full h-[600px] border-0" title={file.name} />
                                ) : (
                                  <div className="flex flex-col items-center justify-center p-8 text-center">
                                    <AlertCircle className="h-10 w-10 text-muted-foreground mb-2" />
                                    <p className="text-sm text-muted-foreground mb-4">Preview not available for this file type.</p>
                                    <Button variant="outline" onClick={() => window.open(fileUrl, "_blank")}>
                                      <ExternalLink className="mr-2 h-4 w-4" /> Open File
                                    </Button>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <FormScaleWrapper>
                  <div className="flex flex-col gap-8">
                    {/* ── PAGE 1 (FRONT) — Two copies ── */}
                    <div className="space-y-6 bg-white text-black p-6 sm:p-8 text-[11px] leading-tight shadow-md border border-slate-200">
                      <OldStudentPaperReview copyTitle="REGISTRAR'S COPY" vals={form.getValues()} programList={programList} />
                      <div className="relative py-2 text-center">
                        <div className="border-t-2 border-dashed border-slate-400 w-full absolute top-1/2" />
                        <span className="relative bg-white px-3 text-[9px] uppercase font-bold text-slate-400 tracking-widest">✂ Cut along dotted line</span>
                      </div>
                      <OldStudentPaperReview copyTitle="PROGRAM HEAD'S COPY" vals={form.getValues()} programList={programList} />
                    </div>

                    {/* ── PAGE 2 (BACK) ── */}
                    <div className="bg-white text-black p-6 sm:p-8 text-[11px] leading-tight shadow-md border border-slate-200 min-h-[1056px] flex flex-col">
                      {/* PAGE 2 — left-aligned tab */}
                      <div className="flex items-center gap-0 mb-4 shrink-0">
                        <span className="text-[11px] font-black uppercase tracking-widest text-white bg-[#0A2540] px-4 py-1.5 rounded-tl rounded-bl border border-[#0A2540]">
                          PAGE 2
                        </span>
                        <div className="flex-1 h-px bg-slate-300 border-t border-slate-300" />
                      </div>

                      <OldStudentBackPage vals={form.getValues()} />
                    </div>
                  </div>
                </FormScaleWrapper>

              )}
              <div className="mt-6 bg-primary/5 p-4 rounded-md border border-primary/20 text-center">
                <p className="text-sm font-medium">Please verify all information above is correct before submitting your final application.</p>
              </div>
            </div>
          )}

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
      <div className="flex items-start justify-between gap-4 pb-2">
        {/* Left Column: Header, Title, Direction, Course/Major */}
        <div className="flex-1 flex flex-col">
          {/* Logo & Header Text */}
          <div className="flex items-center justify-center gap-4 mb-2">
            <img src="/logo.png" alt="ZDSPGC Logo" className="h-16 w-16 object-contain hidden sm:block print:block" />
            <div className="text-center flex flex-col items-center justify-center">
              <p className="text-[11px] leading-tight">Republic of the Philippines</p>
              <p className="text-[14px] font-bold uppercase tracking-wide leading-tight mt-0.5">Zamboanga del Sur Provincial Government College</p>
              <p className="text-[10px] uppercase leading-tight mt-0.5">Dimataling Campus &middot; Dimataling, Zamboanga del Sur</p>
            </div>
          </div>

          {/* Title Bar */}
          <div className="bg-black text-white text-center py-1 font-bold text-[13px] tracking-wider uppercase print:bg-black print:text-white" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
            College Enrollment Form
          </div>

          {/* Direction */}
          <div className="text-left mt-1 leading-tight">
            <p className="text-[11px] italic" style={{ color: '#000000' }}>Direction: Fill-out required informations. Do not leave an item blank (indicate N/A if item is not applicable)</p>
          </div>

          {/* Course & Major */}
          <div className="flex flex-col gap-2 pt-3 pb-2">
            <div className="flex gap-2 items-center"><span className="font-bold w-[60px]">COURSE:</span> <span className="border border-black flex-1 px-2 py-0.5 font-semibold uppercase leading-tight min-h-[22px] flex items-center">{courseName}</span></div>
            <div className="flex gap-2 items-center"><span className="font-bold w-[60px]">MAJOR:</span> <span className="border border-black flex-1 px-2 py-0.5 font-semibold uppercase leading-tight min-h-[22px] flex items-center">{vals.major || "N/A"}</span></div>
          </div>
        </div>

        {/* Right Column: 2x2 Box */}
        <div className="w-[2in] flex justify-end shrink-0 hidden sm:flex print:flex">
          <div className="w-[2in] h-[2in] border border-black flex items-center justify-center text-[12px] text-gray-500">
            2x2
          </div>
        </div>
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
      <div className="mb-6 flex items-center gap-3 border-b border-sky-300 bg-sky-100 -mx-6 md:-mx-8 px-6 md:px-8 py-3 rounded-t-lg">
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

  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    const emptySubject = { course_no: "", descriptive_title: "", units: "", time: "", days: "", room: "", final_grade: "", posted_by: "" };
    // Reset to exactly 5 rows: remove all existing, then add 5 fresh empty rows
    form.setValue("subjects", Array(5).fill(null).map(() => ({ ...emptySubject })), { shouldDirty: false });
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

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

      <FormScaleWrapper>
        <table className="w-full text-sm border-collapse min-w-[700px]">
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
      </FormScaleWrapper>

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
      {/* Row 1: Name | Course | Major | Student Number */}
      <div className="grid grid-cols-12 divide-x divide-slate-300 border-b border-slate-300">
        <div className="col-span-12 md:col-span-6 p-4 space-y-2">
          <div className="flex gap-3 items-baseline">
            <span className="font-bold text-base uppercase shrink-0">NAME:</span>
            <div className="grid grid-cols-3 gap-3 flex-1 pt-5">
              <FormField control={form.control} name="last_name" render={({ field }) => (
                <FormItem className="space-y-0">
                  <FormControl><Input className="h-8 border-0 border-b border-slate-300 rounded-none shadow-none focus-visible:ring-0 px-1 text-sm bg-transparent text-center" {...field} /></FormControl>
                  <FormLabel className="text-[11px] italic text-center block pt-1 font-normal text-black">Last Name</FormLabel>
                </FormItem>
              )} />
              <FormField control={form.control} name="first_name" render={({ field }) => (
                <FormItem className="space-y-0">
                  <FormControl><Input className="h-8 border-0 border-b border-slate-300 rounded-none shadow-none focus-visible:ring-0 px-1 text-sm bg-transparent text-center" {...field} /></FormControl>
                  <FormLabel className="text-[11px] italic text-center block pt-1 font-normal text-black">First Name</FormLabel>
                </FormItem>
              )} />
              <FormField control={form.control} name="middle_name" render={({ field }) => (
                <FormItem className="space-y-0">
                  <FormControl><Input className="h-8 border-0 border-b border-slate-300 rounded-none shadow-none focus-visible:ring-0 px-1 text-sm bg-transparent text-center" {...field} /></FormControl>
                  <FormLabel className="text-[11px] italic text-center block pt-1 font-normal text-black">Middle Name</FormLabel>
                </FormItem>
              )} />
            </div>
          </div>
        </div>

        <div className="col-span-4 md:col-span-2 p-4 flex flex-col">
          <span className="font-bold text-sm uppercase mb-2">COURSE</span>
          <FormField control={form.control} name="program_id" render={({ field }) => (
            <FormItem className="space-y-0 flex-1">
              <Select onValueChange={field.onChange} value={field.value || undefined}>
                <FormControl>
                  <SelectTrigger className="h-8 border-0 border-b border-slate-300 rounded-none shadow-none focus:ring-0 px-1 text-sm bg-transparent font-normal">
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

        <div className="col-span-4 md:col-span-2 p-4 flex flex-col">
          <span className="font-bold text-sm uppercase mb-2">MAJOR</span>
          <FormField control={form.control} name="major" render={({ field }) => (
            <FormItem className="space-y-0 flex-1">
              <FormControl><Input className="h-8 border-0 border-b border-slate-300 rounded-none shadow-none focus-visible:ring-0 px-1 text-sm bg-transparent font-normal" {...field} /></FormControl>
            </FormItem>
          )} />
        </div>

        <div className="col-span-4 md:col-span-2 p-4 flex flex-col">
          <span className="font-bold text-sm uppercase mb-2">STUDENT NUMBER</span>
          <FormField control={form.control} name="student_no" render={({ field }) => (
            <FormItem className="space-y-0 flex-1">
              <FormControl><Input className="h-8 border-0 border-b border-slate-300 rounded-none shadow-none focus-visible:ring-0 px-1 text-sm bg-transparent font-mono uppercase font-normal" {...field} /></FormControl>
            </FormItem>
          )} />
        </div>
      </div>

      {/* Row 2: Term Info | Status of Registration | Sex */}
      <div className="grid grid-cols-12 divide-x divide-slate-300">
        <div className="col-span-12 md:col-span-6 p-4 grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
          <div className="flex items-center gap-3">
            <span className="font-semibold shrink-0">Semester:</span>
            <FormField control={form.control} name="semester" render={({ field }) => (
              <FormItem className="space-y-0 flex-1">
                <Select
                  onValueChange={field.onChange}
                  value={field.value === "Summer" ? undefined : (field.value || undefined)}
                >
                  <FormControl>
                    <SelectTrigger className="h-8 border-0 border-b border-slate-300 rounded-none shadow-none focus:ring-0 px-1 text-sm bg-transparent font-normal">
                      <SelectValue placeholder="" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="1st Semester">1st</SelectItem>
                    <SelectItem value="2nd Semester">2nd</SelectItem>
                  </SelectContent>
                </Select>
              </FormItem>
            )} />
          </div>
          <div
            className="flex items-center gap-3 cursor-pointer select-none"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (form.getValues("semester") === "Summer") {
                form.setValue("semester", "", { shouldValidate: true, shouldDirty: true });
              } else {
                form.setValue("semester", "Summer", { shouldValidate: true, shouldDirty: true });
              }
            }}
          >
            <span className="font-semibold shrink-0">Summer:</span>
            <div className="border-b border-slate-300 flex-1 h-8 flex items-center justify-center px-1 font-normal text-sm">
              {form.watch("semester") === "Summer" ? "✔" : ""}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-semibold shrink-0">SY:</span>
            <FormField control={form.control} name="school_year" render={({ field }) => (
              <FormItem className="space-y-0 flex-1">
                <FormControl><Input className="h-8 border-0 border-b border-slate-300 rounded-none shadow-none focus-visible:ring-0 px-1 text-sm bg-transparent font-normal" {...field} /></FormControl>
              </FormItem>
            )} />
          </div>
          <div className="flex items-center gap-3">
            <span className="font-semibold shrink-0">Year Level:</span>
            <FormField control={form.control} name="year_level" render={({ field }) => (
              <FormItem className="space-y-0 flex-1">
                <Select onValueChange={field.onChange} value={field.value || undefined}>
                  <FormControl>
                    <SelectTrigger className="h-8 border-0 border-b border-slate-300 rounded-none shadow-none focus:ring-0 px-1 text-sm bg-transparent font-normal">
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
          <div className="col-span-2 flex items-center gap-3">
            <span className="font-semibold shrink-0">Date Enrolled:</span>
            <FormField control={form.control} name="date_enrolled" render={({ field }) => (
              <FormItem className="space-y-0 flex-1">
                <FormControl>
                  <Input
                    type="date"
                    className="h-8 border-0 border-b border-slate-300 rounded-none shadow-none focus-visible:ring-0 px-1 text-sm bg-transparent font-normal"
                    {...field}
                  />
                </FormControl>
              </FormItem>
            )} />
          </div>
        </div>

        <div className="col-span-8 md:col-span-4 p-4">
          <span className="font-bold text-sm uppercase block mb-4">STATUS OF REGISTRATION</span>
          <div className="grid grid-cols-2 gap-y-4 gap-x-3 text-sm">
            <div className="flex items-center gap-2 cursor-pointer select-none" onClick={() => form.setValue("student_type", "new", { shouldValidate: true, shouldDirty: true })}>
              <span>{form.watch("student_type") === "new" ? "[✔]" : "[ ]"} New Student</span>
            </div>
            <div className="flex items-center gap-2 cursor-pointer select-none" onClick={() => form.setValue("student_type", "transferee", { shouldValidate: true, shouldDirty: true })}>
              <span>{form.watch("student_type") === "transferee" ? "[✔]" : "[ ]"} Transferee</span>
            </div>
            <div className="flex items-center gap-2 cursor-pointer select-none" onClick={() => form.setValue("student_type", "old", { shouldValidate: true, shouldDirty: true })}>
              <span>{form.watch("student_type") === "old" ? "[✔]" : "[ ]"} Old Student</span>
            </div>
            <div className="flex items-center gap-2 cursor-pointer select-none" onClick={() => form.setValue("student_type", "returnee", { shouldValidate: true, shouldDirty: true })}>
              <span>{form.watch("student_type") === "returnee" ? "[✔]" : "[ ]"} Returning</span>
            </div>
          </div>
        </div>

        <div className="col-span-4 md:col-span-2 p-4">
          <span className="font-bold text-sm uppercase block mb-4">SEX</span>
          <FormField control={form.control} name="gender" render={({ field }) => (
            <FormItem className="space-y-4">
              <div className="flex items-center gap-2 text-sm cursor-pointer select-none" onClick={() => field.onChange("male")}>
                <span>{field.value === "male" ? "[✔]" : "[ ]"} Male</span>
              </div>
              <div className="flex items-center gap-2 text-sm cursor-pointer select-none" onClick={() => field.onChange("female")}>
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
        <div className="flex items-center justify-center gap-6">
          <img src="/province-logo-white.png" alt="Province Logo" className="h-14 w-14 object-contain hidden sm:block print:block" />
          <div className="text-center">
            <p className="text-[8px] uppercase tracking-wide">Republic of the Philippines</p>
            <p className="text-[8px] uppercase font-semibold">Zamboanga Peninsula, Region-IX</p>
            <p className="text-[8.5px] uppercase font-bold">PROVINCE OF ZAMBOANGA DEL SUR</p>
            <h1 className="text-xs font-black uppercase tracking-wider">ZAMBOANGA DEL SUR PROVINCIAL GOVERNMENT COLLEGE</h1>
            <p className="text-[8px] uppercase">DIMATALING, ZAMBOANGA DEL SUR</p>
          </div>
          <img src="/logo.png" alt="ZDSPGC Logo" className="h-14 w-14 object-contain hidden sm:block print:block" />
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
          <div><strong>Date Enrolled:</strong> {vals.date_enrolled ? new Date(vals.date_enrolled + "T00:00:00").toLocaleDateString() : new Date().toLocaleDateString()}</div>
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

function OldStudentBackPage({ vals }: { vals: any }) {
  const age = vals.date_of_birth
    ? Math.floor((Date.now() - new Date(vals.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    : "—";

  const isFilipinoOrBlank = !vals.citizenship || vals.citizenship.trim().toLowerCase() === "filipino";
  const isIslam = (vals.religion || "").toLowerCase() === "islam";
  const isProtestant = (vals.religion || "").toLowerCase() === "protestant";
  const isCatholic = (vals.religion || "").toLowerCase() === "catholic";
  const isOtherReligion = vals.religion && !isIslam && !isProtestant && !isCatholic;

  // Helper: renders a value inside a bordered box (mimics a paper form input)
  const Box = ({ value, wide }: { value?: string | number | null; wide?: boolean }) => (
    <span
      style={{
        flex: "1 1 auto",
        minWidth: 0,
        maxWidth: "100%",
        borderBottom: "1.5px solid #000",
        padding: "0 4px",
        lineHeight: "1.4",
      }}
    >
      {value ?? ""}
    </span>
  );
  const F = ({ children }: { children: React.ReactNode }) => (
    <div style={{ display: "flex", alignItems: "baseline", gap: "4px", minWidth: 0, overflow: "hidden" }}>{children}</div>
  );

  return (
    <div className="border border-black p-6 text-xs leading-relaxed font-sans mt-3 flex-1 flex flex-col">
      {/* Body — two-column layout */}
      <div className="grid grid-cols-12 gap-6 flex-1">

        {/* ── Left Column (form fields) ── */}
        <div className="col-span-8 space-y-3 text-[11px]">

          {/* Age / Sex / Civil Status */}
          <div className="grid grid-cols-3 gap-1">
            <F><span className="font-bold" style={{whiteSpace:"nowrap"}}>Age:</span><Box value={age} /></F>
            <F><span className="font-bold" style={{whiteSpace:"nowrap"}}>Sex:</span><Box value={vals.gender ? vals.gender.charAt(0).toUpperCase() + vals.gender.slice(1) : ""} /></F>
            <F><span className="font-bold" style={{whiteSpace:"nowrap"}}>Civil Status:</span><Box value={vals.civil_status} wide /></F>
          </div>

          {/* Place of Birth / Zip */}
          <div className="grid grid-cols-2 gap-1">
            <F><span className="font-bold" style={{whiteSpace:"nowrap"}}>Place of Birth:</span><Box value={vals.place_of_birth} wide /></F>
            <F><span className="font-bold" style={{whiteSpace:"nowrap"}}>Zip Code:</span><Box value={vals.postal_code} /></F>
          </div>

          {/* Birthdate */}
          <F><span className="font-bold" style={{whiteSpace:"nowrap"}}>Birthdate:</span><Box value={vals.date_of_birth} wide /></F>

          {/* Home Address */}
          <F><span className="font-bold" style={{whiteSpace:"nowrap"}}>Home Address:</span><Box value={vals.address} wide /></F>

          {/* Present Address */}
          <F><span className="font-bold" style={{whiteSpace:"nowrap"}}>Present Address:</span><Box value={vals.address} wide /></F>

          {/* Contact / Email */}
          <div className="grid grid-cols-2 gap-1">
            <F><span className="font-bold" style={{whiteSpace:"nowrap"}}>Contact Number:</span><Box value={vals.contact_number} wide /></F>
            <F><span className="font-bold" style={{whiteSpace:"nowrap"}}>Email Address:</span><Box value={vals.email} wide /></F>
          </div>

          {/* Citizenship */}
          <div>
            <span className="font-bold uppercase">CITIZENSHIP:</span>{" "}
            <span className="mr-2">{isFilipinoOrBlank ? "[✔]" : "[ ]"} Filipino</span>
            <span style={{display:"inline-flex",alignItems:"baseline",gap:"4px",flexWrap:"wrap"}}>
              {!isFilipinoOrBlank ? "[✔]" : "[ ]"} If Alien, ACR No.:
              <Box value={!isFilipinoOrBlank ? vals.citizenship : ""} wide />
            </span>
          </div>

          {/* Religious Affiliation */}
          <div>
            <span className="font-bold">Religious Affiliation:</span>{" "}
            <span className="mr-2">{isIslam ? "[✔]" : "[ ]"} Islam</span>
            <span className="mr-2">{isProtestant ? "[✔]" : "[ ]"} Protestant</span>
            <span className="mr-2">{isCatholic ? "[✔]" : "[ ]"} Catholic</span>
            <span style={{display:"inline-flex",alignItems:"baseline",gap:"4px"}}>
              {isOtherReligion ? "[✔]" : "[ ]"} Other:
              <Box value={isOtherReligion ? vals.religion : ""} wide />
            </span>
          </div>

          <div className="border-t border-slate-400 my-1" />

          {/* Employer */}
          <div className="flex flex-wrap gap-x-2 items-baseline">
            <span className="font-bold">Name &amp; Address of Employer (If Employed):</span>
            <Box value="" wide />
          </div>

          {/* Father */}
          <div className="grid grid-cols-2 gap-1">
            <F><span className="font-bold" style={{whiteSpace:"nowrap"}}>Father's Complete Name:</span><Box value={vals.father_name} wide /></F>
            <F><span className="font-bold" style={{whiteSpace:"nowrap"}}>Occupation:</span><Box value={vals.father_occupation} wide /></F>
          </div>
          <div className="grid grid-cols-2 gap-1">
            <F><span className="font-bold" style={{whiteSpace:"nowrap"}}>Monthly Income:</span><Box value={vals.father_company} wide /></F>
            <F><span className="font-bold" style={{whiteSpace:"nowrap"}}>Contact Number:</span><Box value={vals.father_contact} wide /></F>
          </div>

          {/* Mother */}
          <F><span className="font-bold" style={{whiteSpace:"nowrap"}}>Mother's Complete Maiden Name:</span><Box value={vals.mother_name} wide /></F>
          <F><span className="font-bold" style={{whiteSpace:"nowrap"}}>Contact No.:</span><Box value={vals.mother_contact} wide /></F>
          <div className="grid grid-cols-2 gap-1">
            <F><span className="font-bold" style={{whiteSpace:"nowrap"}}>Occupation:</span><Box value={vals.mother_occupation} wide /></F>
            <F><span className="font-bold" style={{whiteSpace:"nowrap"}}>Monthly Income:</span><Box value={vals.mother_company} wide /></F>
          </div>
          <F><span className="font-bold" style={{whiteSpace:"nowrap"}}>Parents' Address:</span><Box value={vals.father_address || vals.mother_address} wide /></F>

          {/* Guardian */}
          <div className="grid grid-cols-2 gap-1">
            <F><span className="font-bold" style={{whiteSpace:"nowrap"}}>Guardian's Name:</span><Box value={vals.guardian_name} wide /></F>
            <F><span className="font-bold" style={{whiteSpace:"nowrap"}}>Contact Number:</span><Box value={vals.guardian_contact} wide /></F>
          </div>
          <div className="grid grid-cols-2 gap-1">
            <F><span className="font-bold" style={{whiteSpace:"nowrap"}}>Monthly Income:</span><Box value="" wide /></F>
            <F><span className="font-bold" style={{whiteSpace:"nowrap"}}>Relationship:</span><Box value={vals.guardian_relationship} wide /></F>
          </div>
          <F><span className="font-bold" style={{whiteSpace:"nowrap"}}>Address:</span><Box value={vals.guardian_address} wide /></F>
        </div>

        {/* ── Right Column — Student's Pledge Box ── */}
        <div className="col-span-4 flex flex-col justify-end pb-36">
          <div className="border border-black p-4 text-[10px] leading-relaxed flex flex-col">
            <p className="font-bold text-center text-[11px] uppercase mb-3">STUDENT'S PLEDGE</p>
            <p className="text-justify">
              In consideration of my admission to the{" "}
              <strong>ZAMBOANGA DEL SUR PROVINCIAL GOVERNMENT COLLEGE</strong>{" "}
              and of the privileges I will henceforth enjoy as student of this institution,
              I hereby pledge to abide by the rules and regulations laid down by the competent
              authority of the state college and of the college in which I am enrolled.
            </p>
            <div className="mt-8">
              <div className="border-b border-black w-full mb-1" />
              <p className="text-center text-[9px]">Student's Signature</p>
            </div>
            <p className="text-[9px] italic mt-4">
              * Refusal to take this pledge or any violation of its term shall be sufficient
              cause of denial of admission.
            </p>
          </div>
        </div>

        {/* ── Full-width divider ── */}
        <div className="col-span-12 border-t border-slate-400" />

        {/* ── Educational Background — full width ── */}
        <div className="col-span-12 space-y-3 text-[11px]">
          <div className="font-bold uppercase text-[12px]">Educational Background:</div>

          {/* Elementary */}
          <div className="grid grid-cols-2 gap-6">
            <F><span className="font-bold" style={{whiteSpace:"nowrap"}}>Elementary:</span><Box value={vals.elementary_school} wide /></F>
            <F><span className="font-bold" style={{whiteSpace:"nowrap"}}>Year Graduated:</span><Box value={vals.elementary_years} /></F>
          </div>
          <F><span className="font-bold" style={{whiteSpace:"nowrap"}}>Address:</span><Box value={vals.elementary_address} wide /></F>

          {/* Secondary (Senior HS) */}
          <div className="grid grid-cols-2 gap-6">
            <F><span className="font-bold" style={{whiteSpace:"nowrap"}}>Secondary (Senior HS):</span><Box value={vals.junior_high_school} wide /></F>
            <F><span className="font-bold" style={{whiteSpace:"nowrap"}}>Year Graduated:</span><Box value={vals.junior_high_years} /></F>
          </div>
          <div className="grid grid-cols-2 gap-6">
            <F><span className="font-bold" style={{whiteSpace:"nowrap"}}>Address:</span><Box value={vals.junior_high_address} wide /></F>
            <F><span className="font-bold" style={{whiteSpace:"nowrap"}}>Track:</span><Box value={vals.senior_high_track} wide /></F>
          </div>

          {/* School Last Attended (College) */}
          <div className="grid grid-cols-2 gap-6">
            <F><span className="font-bold" style={{whiteSpace:"nowrap"}}>School Last Attended (COLLEGE):</span><Box value={vals.senior_high_school} wide /></F>
            <F><span className="font-bold" style={{whiteSpace:"nowrap"}}>Course &amp; Year:</span><Box value={vals.senior_high_years} wide /></F>
          </div>
          <F><span className="font-bold" style={{whiteSpace:"nowrap"}}>Address:</span><Box value={vals.senior_high_address} wide /></F>

        </div>
      </div>

      {/* Bottom — Full Student's Pledge block */}
      <div className="mt-auto pt-4"><div className="border-t border-black pr-6 pt-3">
        <p className="font-bold text-center text-[13px] uppercase mb-2">STUDENT'S PLEDGE</p>
        <p className="text-[11px] text-justify leading-relaxed">
          In consideration of my admission to the ZAMBOANGA DEL SUR PROVINCIAL GOVERNMENT COLLEGE
          and of the privileges I will henceforth enjoy as a student of this institution, I hereby
          pledge to abide by the rules and regulations laid down by competent authority of the state
          college and of the college in which I am enrolled.
        </p>
        <div className="mt-8 flex justify-end">
          <div className="text-center">
            <div className="border-b border-black w-56 mb-1" />
            <p className="text-[10px]">Student's Signature</p>
          </div>
        </div>
        <p className="text-[9px] text-center mt-3 italic mb-2">
          *Refusal to take this pledge or any violation of its terms shall be sufficient cause for denial of the admission.
        </p>
      </div>
    </div>
    </div>
  );
}
