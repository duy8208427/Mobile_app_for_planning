export type UserRole = "citizen" | "manager" | "admin";

export type ReportStatus =
  | "received"
  | "assigned"
  | "pending_approval"
  | "resolved"
  | "rejected"
  | "processing"; // legacy

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  phone?: string | null;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  user: User;
}

export interface AdminStats {
  total: number;
  pending: number;
  assigned: number;
  pending_approval: number;
  processing: number; // alias of assigned (compat)
  resolved: number;
  rejected: number;
}

export interface AdminUserCreate {
  email: string;
  password: string;
  full_name: string;
  phone?: string | null;
  role: UserRole;
}

export interface AdminUserUpdate {
  email?: string;
  password?: string;
  full_name?: string;
  phone?: string | null;
  role?: UserRole;
}

export interface Report {
  id: string;
  user_id: string;
  user_name: string;
  title: string;
  description: string;
  address: string;
  latitude?: number | null;
  longitude?: number | null;
  violation_type: string;
  status: ReportStatus;
  admin_response?: string | null;
  implementer_notes?: string | null;
  handled_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface GeoJSONFeatureCollection {
  type: "FeatureCollection";
  features: GeoJSON.Feature[];
  properties?: { truncated?: boolean; returned?: number; reason?: string };
}

export interface CadastreExtent {
  count: number;
  west: number | null;
  south: number | null;
  east: number | null;
  north: number | null;
  layer?: string | null;
  source?: string | null;
  imported_at?: string | null;
}

export type ViolationStatus = "pending_review" | "confirmed" | "rejected";
export type ViolationRule = "LAN_RANH" | "SAI_MDSD" | "NHA_MOI" | string;

export interface Violation {
  id: string;
  mission_id?: string | null;
  parcel_id?: string | null;
  so_to?: string | null;
  so_thua?: string | null;
  loai_dat?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  severity: "low" | "medium" | "high" | string;
  rule_id: ViolationRule;
  reason: string;
  area_m2?: number | null;
  confidence?: number | null;
  status: ViolationStatus;
  geometry?: GeoJSON.Geometry | null;
  reviewed_by?: string | null;
  review_note?: string | null;
  case_id?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface SurveyJob {
  id: string;
  flight_date: string;
  area_name: string;
  crs: string;
  gsd_cm?: number | null;
  cog_path?: string | null;
  notes?: string | null;
  status: "draft" | "queued" | "running" | "done" | "error" | string;
  building_count?: number;
  violation_count?: number;
  error?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface ViolationStats {
  pending_review: number;
  confirmed: number;
  rejected: number;
  latest_pending: number;
  latest_mission?: SurveyJob | null;
}

// ---------------------------------------------------------------------------
// Hồ sơ vụ việc (case workflow, 16 bước / 4 giai đoạn)
// ---------------------------------------------------------------------------

export type WorkType = "a" | "b" | "c" | "d";
export type SubjectType = "ca_nhan" | "to_chuc";
export type ConstructionState = "dang_thi_cong" | "da_hoan_thanh";
export type CaseSource = "citizen_report" | "ai_violation" | string;

export type CaseStatus =
  | "tiep_nhan"
  | "da_tien_kiem"
  | "khong_vi_pham"
  | "da_giao_viec"
  | "dang_kiem_tra"
  | "cho_quyet_dinh"
  | "cho_cap_phep"
  | "cho_khac_phuc"
  | "da_bao_cao_khac_phuc"
  | "cho_hau_kiem"
  | "hau_kiem_dat"
  | "da_dong";

export type CaseAction =
  | "precheck"
  | "assign"
  | "accept"
  | "submit_record"
  | "return_record"
  | "decide"
  | "report_continuing"
  | "submit_permit"
  | "permit_expired"
  | "report_remediation"
  | "request_reinspection"
  | "reinspect"
  | "close";

export interface FineRange {
  min: number;
  max: number;
}

export interface CatalogViolation {
  code: string;
  order: number;
  name: string;
  behavior: string;
  legal_basis: string;
  remedy: string;
  permit_track: boolean;
  extra_penalties?: string | null;
  fines_org: Record<WorkType, FineRange>;
  fines_individual?: Record<WorkType, FineRange>;
  fines_k12_org?: Record<WorkType, FineRange>;
  fines_k12_individual?: Record<WorkType, FineRange>;
}

export interface CatalogStatusInfo {
  label: string;
  step: number;
  phase: number;
  final: boolean;
}

export interface ViolationCatalog {
  violations: CatalogViolation[];
  work_types: Record<WorkType, string>;
  subject_types: Record<SubjectType, string>;
  construction_states: Record<ConstructionState, string>;
  statuses: Record<string, CatalogStatusInfo>;
  phases: Record<string, string>;
  steps: Record<string, string>;
  actions: Record<string, { label: string; step: number }>;
  ai_rule_suggestion: Record<string, string>;
  authority_limit: Record<SubjectType, number>;
  permit_days: { house: number; project: number; check: number; demolish: number };
  legal_note: string;
}

export interface ActorStamp {
  by_id?: string | null;
  by_name?: string | null;
  by_role?: string | null;
  at?: string | null;
}

export interface CaseAssignment extends ActorStamp {
  officer_id?: string | null;
  officer_name?: string | null;
  due_date?: string | null;
  instructions?: string | null;
}

export interface CasePrecheck extends ActorStamp {
  result: "violation" | "no_violation";
  violation_code?: string | null;
  notes?: string | null;
}

export interface CaseInspection extends ActorStamp {
  started_at?: string | null;
  record_no?: string | null;
  description?: string | null;
  area_m2?: number | null;
  photos?: string[];
  stop_order?: boolean | null;
  submitted_at?: string | null;
}

export interface CaseViolator {
  name?: string | null;
  phone?: string | null;
  address?: string | null;
  subject_type?: SubjectType | null;
}

export interface CaseDecision extends ActorStamp {
  decision_no?: string | null;
  violation_code?: string | null;
  work_type?: WorkType | null;
  subject_type?: SubjectType | null;
  fine_amount?: number | null;
  fine_min?: number | null;
  fine_max?: number | null;
  legal_basis?: string | null;
  remedy?: string | null;
  extra_penalties?: string | null;
  exceeds_commune_authority?: boolean | null;
  issued_date?: string | null;
  remedy_deadline?: string | null;
}

export interface CasePermitTrack {
  deadline?: string | null;
  days?: number | null;
  status?: string | null;
  permit_no?: string | null;
  submitted_at?: string | null;
}

export interface CaseRemediation extends ActorStamp {
  fine_paid?: boolean | null;
  receipt_photo?: string | null;
  photos?: string[];
  notes?: string | null;
}

export interface CaseReinspection {
  kind?: string | null;
  due_date?: string | null;
  requested_at?: string | null;
  result?: "pass" | "fail" | string | null;
  photos?: string[];
  notes?: string | null;
  by_name?: string | null;
  done_at?: string | null;
}

export interface CaseTimelineEntry {
  step: number;
  action: string;
  label: string;
  status?: string | null;
  note?: string | null;
  by_name?: string | null;
  by_role?: string | null;
  at: string;
}

export interface CaseSummary {
  id: string;
  code: string;
  source: CaseSource;
  title: string;
  address?: string | null;
  status: CaseStatus | string;
  status_label: string;
  step: number;
  phase: number;
  phase_label?: string;
  violation_code?: string | null;
  violation_name?: string | null;
  deadline?: string | null;
  overdue?: boolean;
  assignment?: CaseAssignment | null;
  updated_at?: string;
  created_at: string;
  available_actions: CaseAction[];
}

export interface CaseDetail extends CaseSummary {
  description?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  so_to?: string | null;
  so_thua?: string | null;
  loai_dat?: string | null;
  area_m2?: number | null;
  photos?: string[];
  reporter_name?: string | null;
  ai_rule?: string | null;
  suggested_code?: string | null;
  work_type?: WorkType | null;
  subject_type?: SubjectType | null;
  construction_state?: ConstructionState | null;
  precheck?: CasePrecheck | null;
  inspection?: CaseInspection | null;
  violator?: CaseViolator | null;
  decision?: CaseDecision | null;
  permit_track?: CasePermitTrack | null;
  remediation?: CaseRemediation | null;
  reinspection?: CaseReinspection | null;
  repeat?: { clause?: string | null; note?: string | null } | null;
  closed?: ({ reason?: string | null } & ActorStamp) | null;
  timeline?: CaseTimelineEntry[];
}

export interface CaseStats {
  total: number;
  open: number;
  overdue: number;
  by_status: Record<string, number>;
  by_phase: Record<string, number>;
  by_code: Record<string, number>;
}

export interface CaseOfficer {
  id: string;
  full_name: string;
  phone?: string | null;
}

export interface PrecheckContext {
  parcel: (Record<string, unknown> & { geometry?: GeoJSON.Geometry | null }) | null;
  zone: Record<string, unknown> | null;
  permits: Record<string, unknown>[];
  permits_loaded: boolean;
  suggested_code?: string | null;
  suggestion_reason?: string | null;
  plan_check?: {
    current_use: string | null;
    planned_use: string | null;
    planned_name?: string | null;
    plan_year?: number | null;
    housing_allowed: boolean;
    same_use: boolean;
  } | null;
  duplicates: { id: string; code: string; status: string; source: CaseSource }[];
}
