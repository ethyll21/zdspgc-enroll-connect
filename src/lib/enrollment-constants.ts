export const REQUIRED_DOCUMENTS = [
  { key: "psa_birth_certificate", label: "PSA Birth Certificate", required: true },
  { key: "form_138", label: "Form 138 (Report Card)", required: true },
  { key: "good_moral", label: "Good Moral Certificate", required: true },
  { key: "transfer_credentials", label: "Transfer Credentials", required: false },
  { key: "id_photo", label: "2x2 ID Photo", required: true },
  { key: "other", label: "Other Supporting Document", required: false },
] as const;

export type DocumentKey = (typeof REQUIRED_DOCUMENTS)[number]["key"];

export const YEAR_LEVELS = ["1st Year", "2nd Year", "3rd Year", "4th Year"];
export const STUDENT_TYPES = [
  { value: "new", label: "New Student" },
  { value: "transferee", label: "Transferee" },
  { value: "returnee", label: "Returnee" },
  { value: "old", label: "Continuing / Old Student" },
] as const;

export const STATUS_META: Record<string, { label: string; tone: string }> = {
  pending: { label: "Pending Review", tone: "bg-warning/15 text-warning-foreground border border-warning/40" },
  approved: { label: "Approved", tone: "bg-success/15 text-success border border-success/40" },
  rejected: { label: "Rejected", tone: "bg-destructive/15 text-destructive border border-destructive/40" },
  correction: { label: "Needs Correction", tone: "bg-accent/30 text-secondary border border-accent" },
};
