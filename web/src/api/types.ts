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
