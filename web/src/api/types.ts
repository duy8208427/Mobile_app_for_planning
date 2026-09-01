export type UserRole = "citizen" | "manager" | "admin";

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
  processing: number;
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
  status: "received" | "processing" | "resolved" | "rejected";
  admin_response?: string | null;
  handled_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface GeoJSONFeatureCollection {
  type: "FeatureCollection";
  features: GeoJSON.Feature[];
}
