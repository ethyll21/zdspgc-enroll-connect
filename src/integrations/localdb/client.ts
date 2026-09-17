// Local PostgreSQL API client — replaces Supabase DB calls.
// Auth is handled with local JWT stored in localStorage.

const BASE_URL = import.meta.env.PROD ? '' : 'http://localhost:4000';

export const TOKEN_KEY = 'zdspgc_token';
export const USER_KEY  = 'zdspgc_user';

// ── Token helpers ─────────────────────────────────────────────────────────────
export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  if (typeof window !== 'undefined') localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }
}

export function getStoredUser(): LocalUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setStoredUser(user: LocalUser): void {
  if (typeof window !== 'undefined')
    localStorage.setItem(USER_KEY, JSON.stringify(user));
}

// ── Types ─────────────────────────────────────────────────────────────────────
export interface LocalUser {
  id: string;
  email: string;
  role: 'student' | 'admin';
  full_name: string;
  student_type?: string;
  profile?: Profile | null;
}

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  contact_number: string | null;
  birthdate: string | null;
  gender: string | null;
  address: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface FamilyBackground {
  father_name?: string;
  father_occupation?: string;
  father_company?: string;
  father_address?: string;
  father_contact?: string;
  mother_name?: string;
  mother_occupation?: string;
  mother_company?: string;
  mother_address?: string;
  mother_contact?: string;
  guardian_name?: string;
  guardian_relationship?: string;
  guardian_address?: string;
  guardian_contact?: string;
  emergency_contact_person?: string;
  emergency_contact_address?: string;
  emergency_contact_number?: string;
}

export interface EducationalBackground {
  elementary_school?: string;
  elementary_address?: string;
  elementary_years?: string;
  junior_high_school?: string;
  junior_high_address?: string;
  junior_high_years?: string;
  senior_high_track?: string;
  senior_high_school?: string;
  senior_high_address?: string;
  senior_high_years?: string;
}

export interface Student {
  id: string;
  user_id: string;
  student_no: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  suffix: string | null;
  gender: 'male' | 'female' | 'other' | null;
  date_of_birth: string | null;
  place_of_birth: string | null;
  civil_status: string | null;
  religion: string | null;
  citizenship: string | null;
  address: string | null;
  postal_code: string | null;
  contact_number: string | null;
  email: string | null;
  program_id: string | null;
  program_code: string | null;
  program_name: string | null;
  major: string | null;
  year_level: number | null;
  previous_school: string | null;
  family_background: FamilyBackground | null;
  educational_background: EducationalBackground | null;
  pledge_accepted: boolean;
  created_at: string;
  updated_at: string;
}

export interface Program {
  id: string;
  code: string;
  name: string;
  description: string | null;
  active: boolean;
  created_at: string;
}

export interface SubjectScheduleItem {
  course_no: string;
  descriptive_title: string;
  units: number | string;
  time?: string;
  days?: string;
  room?: string;
  final_grade?: string;
  posted_by?: string;
}

export interface RotcWatcDetails {
  status?: 'enrolled' | 'exempted' | 'deferred' | string;
  deferred_by?: string;
  assessed_by?: string;
  or_no?: string;
  date?: string;
  amount?: string;
  collected_by?: string;
  commandant?: string;
}

export interface Enrollment {
  id: string;
  student_id: string;
  school_year: string;
  semester: string;
  student_type?: 'new' | 'old' | 'transferee' | 'returnee' | string;
  date_enrolled?: string;
  subjects?: SubjectScheduleItem[];
  total_units?: number;
  advised_by?: string;
  approved_by?: string;
  rotc_watc?: RotcWatcDetails;
  status: 'pending' | 'under_review' | 'approved' | 'rejected';
  remarks: string | null;
  submitted_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  created_at: string;
  updated_at: string;
  // joined
  student_no?: string;
  first_name?: string;
  last_name?: string;
  middle_name?: string;
  gender?: string;
  date_of_birth?: string;
  address?: string;
  contact_number?: string;
  student_email?: string;
  program_code?: string;
  program_name?: string;
  major?: string;
  year_level?: number;
}

export interface ValidationRecord {
  id: string;
  enrollment_id: string;
  validated_by: string;
  result: string;
  notes: string | null;
  created_at: string;
  validated_by_name?: string;
}

export interface Document {
  id: string;
  student_id: string;
  doc_type: 'psa_birth_certificate' | 'form_138' | 'good_moral' | 'transfer_certificate' | 'other';
  file_path: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  status: 'pending' | 'approved' | 'rejected';
  remarks: string | null;
  uploaded_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
}

export interface User {
  id: string;
  email: string;
  is_active: boolean;
  created_at: string;
  full_name?: string;
  role: string;
}

export type ApiError = { error: string; details?: string };

// ── Core fetch wrapper ────────────────────────────────────────────────────────
async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${BASE_URL}${endpoint}`, { ...options, headers });
  } catch (err: any) {
    throw new Error('Failed to connect to the server. Please ensure the API is running.');
  }

  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const text = await res.text().catch(() => '');
    throw new Error(`Server returned non-JSON response. Check API URL. Status: ${res.status}`);
  }

  const data = await res.json().catch(() => ({ error: 'Invalid JSON response' }));

  if (!res.ok) {
    const apiErr = data as any;
    const err = apiErr.error || `HTTP ${res.status}`;
    const detailMsg = apiErr.details ? ` (${apiErr.details})` : '';
    throw new Error(`${err}${detailMsg}`);
  }
  return data as T;
}

// ── Multipart fetch (for file uploads) ───────────────────────────────────────
async function apiUpload<T>(endpoint: string, formData: FormData): Promise<T> {
  const token = getToken();
  let res;
  try {
    res = await fetch(`${BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
  } catch (err: any) {
    throw new Error('Failed to connect to the server. Please ensure the API is running.');
  }

  const data = await res.json().catch(() => ({ error: 'Invalid JSON response' }));
  if (!res.ok) throw new Error((data as ApiError).error || `HTTP ${res.status}`);
  return data as T;
}

// ══════════════════════════════════════════════════════════════════════════════
// AUTH API
// ══════════════════════════════════════════════════════════════════════════════
export const auth = {
  async register(email: string, password: string, full_name?: string, studentType?: string) {
    const res = await apiFetch<{ token: string; user: LocalUser }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, full_name, student_type: studentType }),
    });
    setToken(res.token);
    setStoredUser(res.user);
    return res;
  },

  async login(email: string, password: string) {
    const res = await apiFetch<{ token: string; user: LocalUser }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setToken(res.token);
    setStoredUser(res.user);
    return res;
  },

  async me() {
    return apiFetch<{ user: LocalUser & { roles: string[] } }>('/api/auth/me');
  },

  async changePassword(current_password: string, new_password: string) {
    return apiFetch<{ message: string }>('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ current_password, new_password }),
    });
  },

  logout() {
    clearToken();
  },
};

// ══════════════════════════════════════════════════════════════════════════════
// PROGRAMS API
// ══════════════════════════════════════════════════════════════════════════════
export const programs = {
  list() {
    return apiFetch<{ programs: Program[] }>('/api/programs');
  },
  listAll() {
    return apiFetch<{ programs: Program[] }>('/api/programs/all');
  },
  create(data: { code: string; name: string; description?: string }) {
    return apiFetch<{ program: Program }>('/api/programs', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  update(id: string, data: Partial<Program>) {
    return apiFetch<{ program: Program }>(`/api/programs/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },
};

// ══════════════════════════════════════════════════════════════════════════════
// PROFILES API
// ══════════════════════════════════════════════════════════════════════════════
export const profiles = {
  me() {
    return apiFetch<{ profile: Profile }>('/api/profiles/me');
  },
  update(data: Partial<Profile>) {
    return apiFetch<{ profile: Profile }>('/api/profiles/me', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },
  uploadAvatar(file: File) {
    const form = new FormData();
    form.append('avatar', file);
    return apiUpload<{ profile: Profile; avatar_url: string }>('/api/profiles/me/avatar', form);
  },
  avatarUrl(url: string | null | undefined): string | undefined {
    if (!url) return undefined;
    if (url.startsWith('http')) return url;
    return `${BASE_URL}${url}`;
  },
  list(params?: { search?: string; page?: number; limit?: number }) {
    const qs = new URLSearchParams(params as any).toString();
    return apiFetch<{ profiles: Profile[]; total: number }>(`/api/profiles?${qs}`);
  },
  getById(id: string) {
    return apiFetch<{ profile: Profile }>(`/api/profiles/${id}`);
  },
};

// ══════════════════════════════════════════════════════════════════════════════
// STUDENTS API
// ══════════════════════════════════════════════════════════════════════════════
export const students = {
  me() {
    return apiFetch<{ student: Student }>('/api/students/me');
  },
  create(data: Partial<Student>) {
    return apiFetch<{ student: Student }>('/api/students', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  updateMe(data: Partial<Student>) {
    return apiFetch<{ student: Student }>('/api/students/me', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },
  list(params?: { search?: string; program_id?: string; page?: number; limit?: number }) {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params ?? {}).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)]))
    ).toString();
    return apiFetch<{ students: Student[]; total: number }>(`/api/students?${qs}`);
  },
  getById(id: string) {
    return apiFetch<{ student: Student }>(`/api/students/${id}`);
  },
};

// ══════════════════════════════════════════════════════════════════════════════
// ENROLLMENTS API
// ══════════════════════════════════════════════════════════════════════════════
export const enrollments = {
  my() {
    return apiFetch<{ enrollments: Enrollment[] }>('/api/enrollments/my');
  },
  submit(data: {
    school_year: string;
    semester: string;
    student_type?: string;
    date_enrolled?: string;
    subjects?: SubjectScheduleItem[];
    total_units?: number;
    advised_by?: string;
    approved_by?: string;
    rotc_watc?: RotcWatcDetails;
  }) {
    return apiFetch<{ enrollment: Enrollment }>('/api/enrollments', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  list(params?: { status?: string; school_year?: string; page?: number; limit?: number }) {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params ?? {}).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)]))
    ).toString();
    return apiFetch<{ enrollments: Enrollment[]; total: number }>(`/api/enrollments?${qs}`);
  },
  getById(id: string) {
    return apiFetch<{ enrollment: Enrollment }>(`/api/enrollments/${id}`);
  },
  review(id: string, data: { status: string; remarks?: string }) {
    return apiFetch<{ enrollment: Enrollment }>(`/api/enrollments/${id}/review`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },
  notifyResubmit(id: string) {
    return apiFetch<{ success: boolean }>(`/api/enrollments/${id}/notify-resubmit`, {
      method: 'POST',
    });
  },
  delete(id: string) {
    return apiFetch<{ message: string }>(`/api/enrollments/${id}`, {
      method: 'DELETE',
    });
  },
  stats() {
    return apiFetch<{ stats: Record<string, number> }>('/api/enrollments/stats/overview');
  },
  history(id: string) {
    return apiFetch<{ history: ValidationRecord[] }>(`/api/enrollments/${id}/history`);
  },
};

// ══════════════════════════════════════════════════════════════════════════════
// DOCUMENTS API
// ══════════════════════════════════════════════════════════════════════════════
export const documents = {
  my(enrollment_id?: string) {
    const qs = enrollment_id ? `?enrollment_id=${enrollment_id}` : '';
    return apiFetch<{ documents: Document[] }>(`/api/documents/my${qs}`);
  },
  upload(file: File, doc_type: string, enrollment_id?: string) {
    const form = new FormData();
    form.append('file', file);
    form.append('doc_type', doc_type);
    if (enrollment_id) form.append('enrollment_id', enrollment_id);
    return apiUpload<{ document: Document }>('/api/documents/upload', form);
  },
  list(params?: { status?: string; student_id?: string; enrollment_id?: string }) {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params ?? {}).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)]))
    ).toString();
    return apiFetch<{ documents: Document[] }>(`/api/documents?${qs}`);
  },
  review(id: string, data: { status: string; remarks?: string }) {
    return apiFetch<{ document: Document }>(`/api/documents/${id}/review`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },
  delete(id: string) {
    return apiFetch<{ message: string }>(`/api/documents/${id}`, { method: 'DELETE' });
  },
  fileUrl(id: string) {
    const token = getToken();
    return `${BASE_URL}/api/documents/file/${id}?token=${token ?? ''}`;
  },
};

// ══════════════════════════════════════════════════════════════════════════════
// NOTIFICATIONS API
// ══════════════════════════════════════════════════════════════════════════════
export const notifications = {
  my() {
    return apiFetch<{ notifications: Notification[] }>('/api/notifications/my');
  },
  markRead(id: string) {
    return apiFetch<{ notification: Notification }>(`/api/notifications/${id}/read`, { method: 'PATCH' });
  },
  markAllRead() {
    return apiFetch<{ message: string }>('/api/notifications/read-all', { method: 'PATCH' });
  },
  delete(id: string) {
    return apiFetch<{ message: string }>(`/api/notifications/${id}`, { method: 'DELETE' });
  },
};

// ══════════════════════════════════════════════════════════════════════════════
// 6. Users (Super Admin only)
// ══════════════════════════════════════════════════════════════════════════════
export const users = {
  list() {
    return apiFetch<{ users: User[] }>('/api/users');
  },
  create(data: any) {
    return apiFetch<{ message: string; id: string }>('/api/users', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  update(id: string, data: any) {
    return apiFetch<{ message: string }>(`/api/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },
  delete(id: string) {
    return apiFetch<{ message: string }>(`/api/users/${id}`, {
      method: 'DELETE',
    });
  },
};

// ══════════════════════════════════════════════════════════════════════════════
// HEALTH CHECK
// ══════════════════════════════════════════════════════════════════════════════
export async function checkApiHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/api/health`);
    return res.ok;
  } catch {
    return false;
  }
}

// Default export for convenience
const api = { auth, programs, profiles, students, enrollments, documents, notifications, checkApiHealth };
export default api;
