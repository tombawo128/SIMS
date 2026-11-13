export type UserRole =
  | 'student'
  | 'faculty_supervisor'
  | 'coordinator'
  | 'site_supervisor'
  | 'company_admin'
  | 'platform_admin';

export type PostingType = 'internship' | 'graduate_job' | 'part_time';
export type PostingStatus = 'draft' | 'published' | 'closed';
export type PostingVisibility = 'all_universities' | 'selected_universities';
export type ApplicationStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'shortlisted'
  | 'accepted'
  | 'rejected'
  | 'withdrawn';
export type PlacementStatus = 'active' | 'completed' | 'cancelled';
export type WeeklyLogStatus = 'draft' | 'submitted' | 'approved' | 'needs_revision';
export type EvaluationType = 'midterm' | 'final';
export type EvaluationRole = 'site_supervisor' | 'faculty_supervisor';
export type CheckInType = 'visit' | 'call' | 'email';
export type DocumentType = 'cv' | 'report' | 'other';
export type TenantStatus = 'active' | 'suspended';
export type AccountStatus = 'pending' | 'active' | 'suspended' | 'blocked';

export interface University {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  logo_url: string | null;
  status: TenantStatus;
  created_at: string;
}

export interface Company {
  id: string;
  name: string;
  slug: string;
  industry: string | null;
  website: string | null;
  logo_url: string | null;
  status: TenantStatus;
  created_at: string;
}

export interface Profile {
  id: string;
  role: UserRole;
  university_id: string | null;
  company_id: string | null;
  full_name: string;
  email: string;
  phone: string | null;
  department: string | null;
  avatar_url: string | null;
  account_status: AccountStatus;
  created_at: string;
  university?: Pick<University, 'id' | 'name'> | null;
  company?: Pick<Company, 'id' | 'name'> | null;
}

export interface StudentProfile {
  user_id: string;
  student_id: string | null;
  program: string | null;
  year: number | null;
  cv_path: string | null;
  skills: string[];
}

export interface ProfileSummary extends Pick<Profile, 'id' | 'full_name' | 'email' | 'department'> {
  student_profile?: StudentProfile | null;
}

export interface JobPosting {
  id: string;
  company_id: string;
  created_by: string | null;
  title: string;
  type: PostingType;
  description: string;
  requirements: string;
  location: string;
  is_remote: boolean;
  duration_months: number | null;
  stipend: string | null;
  deadline: string | null;
  status: PostingStatus;
  visibility: PostingVisibility;
  created_at: string;
  updated_at: string;
  company?: Pick<Company, 'id' | 'name' | 'industry' | 'logo_url'> | null;
  posting_universities?: { university_id: string }[];
}

export interface Application {
  id: string;
  posting_id: string;
  student_id: string;
  university_id: string;
  company_id: string;
  cv_path: string | null;
  cover_letter: string;
  status: ApplicationStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
  posting?: JobPosting | null;
  student?: ProfileSummary | null;
  company?: Pick<Company, 'id' | 'name'> | null;
  university?: Pick<University, 'id' | 'name'> | null;
}

export interface Placement {
  id: string;
  application_id: string;
  student_id: string;
  university_id: string;
  company_id: string;
  posting_id: string;
  site_supervisor_id: string;
  faculty_supervisor_id: string | null;
  start_date: string;
  end_date: string;
  status: PlacementStatus;
  final_grade: number | null;
  grade_notes: string | null;
  graded_by: string | null;
  graded_at: string | null;
  created_at: string;
  updated_at: string;
  student?: ProfileSummary | null;
  site_supervisor?: Pick<Profile, 'id' | 'full_name' | 'email'> | null;
  faculty_supervisor?: Pick<Profile, 'id' | 'full_name' | 'email'> | null;
  company?: Pick<Company, 'id' | 'name'> | null;
  university?: Pick<University, 'id' | 'name'> | null;
  posting?: Pick<JobPosting, 'id' | 'title' | 'type'> | null;
}

export interface WeeklyLog {
  id: string;
  placement_id: string;
  week_number: number;
  hours: number;
  tasks: string;
  learning_outcomes: string;
  status: WeeklyLogStatus;
  supervisor_comment: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Evaluation {
  id: string;
  placement_id: string;
  evaluator_id: string;
  evaluator_role: EvaluationRole;
  type: EvaluationType;
  rubric_scores: Record<string, number>;
  comments: string;
  overall_score: number | null;
  created_at: string;
  updated_at: string;
}

export interface CheckIn {
  id: string;
  placement_id: string;
  faculty_supervisor_id: string;
  type: CheckInType;
  notes: string;
  occurred_at: string;
  created_at: string;
}

export interface DocumentRecord {
  id: string;
  owner_id: string;
  placement_id: string | null;
  type: DocumentType;
  storage_path: string;
  file_name: string;
  created_at: string;
  owner?: Pick<Profile, 'id' | 'full_name'> | null;
}

export interface AppNotification {
  id: string;
  user_id: string;
  title: string;
  body: string;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

export interface UniversityStats {
  students: number;
  faculty: number;
  active_placements: number;
  pending_applications: number;
  pending_logs: number;
  completed_placements: number;
  placements_without_faculty: number;
}

export interface FacultyStats {
  placements: number;
  pending_logs: number;
  students: number;
  check_ins: number;
}

export interface CompanyStats {
  total_postings: number;
  published_postings: number;
  new_applications: number;
  active_placements: number;
  pending_logs: number;
}

export interface PlatformStats {
  universities: number;
  companies: number;
  students: number;
  published_postings: number;
  applications: number;
  active_placements: number;
  completed_placements: number;
}

export interface InvitePayload {
  email: string;
  full_name: string;
  role: UserRole;
  university_id?: string;
  company_id?: string;
}

export interface InviteResult {
  id: string;
  email: string;
  temporary_password: string;
}

export interface PlatformAdmin {
  id: string;
  full_name: string;
  email: string;
  created_at: string;
}

export interface AdminUser {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  account_status: AccountStatus;
  university_id: string | null;
  company_id: string | null;
  university_name: string | null;
  company_name: string | null;
  created_at: string;
}

export interface AdminSignupPayload {
  email: string;
  password: string;
  full_name: string;
}

export interface AdminSignupResult {
  id: string;
  email: string;
}
