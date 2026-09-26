// Document types must match the PostgreSQL document_type enum in PRE-ENROLLMENT_DB
export const REQUIRED_DOCUMENTS = [
  { key: "registration_form",     label: "Registration Form",            required: true, for: ["old"] },
  { key: "psa_birth_certificate", label: "PSA Birth Certificate",        required: true, for: ["new"] },
  { key: "form_138",              label: "Form 138 (Report Card)",        required: true, for: ["new"] },
  { key: "good_moral",            label: "Good Moral Certificate",        required: true, for: ["new"] },
  { key: "transfer_certificate",  label: "Transfer Credentials",          required: false, for: ["new"] },
  { key: "other",                 label: "Other Supporting Documents",    required: false, for: ["new", "old"] },
] as const;

export type DocumentKey = (typeof REQUIRED_DOCUMENTS)[number]["key"];

export const YEAR_LEVELS = ["1st Year", "2nd Year", "3rd Year", "4th Year"];
export const STUDENT_TYPES = [
  { value: "new",        label: "New Student" },
  { value: "transferee", label: "Transferee" },
  { value: "returnee",   label: "Returnee" },
  { value: "old",        label: "Continuing / Old Student" },
] as const;

// Status values match enrollment_status enum in PRE-ENROLLMENT_DB
export const STATUS_META: Record<string, { label: string; tone: string }> = {
  pending:      { label: "Pending Review", tone: "bg-warning/15 text-warning-foreground border border-warning/40" },
  under_review: { label: "Under Review",   tone: "bg-accent/30 text-secondary border border-accent" },
  approved:     { label: "Approved",       tone: "bg-success/15 text-success border border-success/40" },
  rejected:     { label: "Rejected",       tone: "bg-destructive/15 text-destructive border border-destructive/40" },
};

// Document status values match document_status enum in PRE-ENROLLMENT_DB
export const DOC_STATUS_META: Record<string, { label: string; tone: string }> = {
  pending:  { label: "Pending",  tone: "bg-warning/15 text-warning-foreground border border-warning/40" },
  approved: { label: "Approved", tone: "bg-success/15 text-success border border-success/40" },
  rejected: { label: "Rejected", tone: "bg-destructive/15 text-destructive border border-destructive/40" },
};
