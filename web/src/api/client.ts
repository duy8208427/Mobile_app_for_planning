import type {
  CaseAction,
  CaseDetail,
  CaseOfficer,
  CaseStats,
  CaseSummary,
  PrecheckContext,
  ViolationCatalog,
} from "./types";

const PRODUCTION_API_ORIGIN = "https://quyhoach-api.vercel.app";

function resolveApiHost(): string {
  const raw = String(import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
  if (raw && !raw.includes("railway.app") && !raw.includes("onrender.com")) return raw;
  if (import.meta.env.DEV) return raw || "http://localhost:8000";
  return PRODUCTION_API_ORIGIN;
}

const API_BASE = `${resolveApiHost()}/api`;

const TOKEN_KEY = "qh_web_token";
const USER_KEY = "qh_web_user";

export function getApiBase(): string {
  return API_BASE;
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser<T>(): T | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function saveAuth(token: string, user: unknown): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuth(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export async function api<T>(
  path: string,
  options: { method?: string; body?: unknown; auth?: boolean } = {}
): Promise<T> {
  const { method = "GET", body, auth = true } = options;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (
      msg === "Failed to fetch" ||
      msg.includes("NetworkError") ||
      err instanceof TypeError
    ) {
      throw new Error("Không kết nối được máy chủ. Kiểm tra API hoặc mạng.");
    }
    throw err;
  }
  const text = await res.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { detail: text };
  }
  if (!res.ok) {
    const railwayDown =
      res.status === 404 &&
      typeof data === "object" &&
      data !== null &&
      ("status" in data || "message" in data);
    const detail =
      railwayDown
        ? "Máy chủ API đang tắt hoặc không tìm thấy. Liên hệ quản trị để bật lại backend."
        : typeof data === "object" && data !== null && "detail" in data
        ? String((data as { detail: unknown }).detail)
        : `Lỗi ${res.status}`;
    throw new Error(detail);
  }
  return data as T;
}

export async function uploadFile<T>(path: string, file: File): Promise<T> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const body = new FormData();
  body.append("file", file);
  const res = await fetch(`${API_BASE}${path}`, { method: "POST", headers, body });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const detail =
      typeof data === "object" && data && "detail" in data
        ? String((data as { detail: unknown }).detail)
        : `Lỗi ${res.status}`;
    throw new Error(detail);
  }
  return data as T;
}

// ---------------------------------------------------------------------------
// Hồ sơ vụ việc
// ---------------------------------------------------------------------------

let catalogPromise: Promise<ViolationCatalog> | null = null;

/** Danh mục vi phạm ít thay đổi — cache trong phiên. */
export function fetchCatalog(): Promise<ViolationCatalog> {
  if (!catalogPromise) {
    catalogPromise = api<ViolationCatalog>("/violation-catalog").catch((e) => {
      catalogPromise = null;
      throw e;
    });
  }
  return catalogPromise;
}

export interface CaseFilters {
  status?: string;
  phase?: string | number;
  violation_code?: string;
  overdue?: boolean;
}

export function fetchCases(filters: CaseFilters = {}): Promise<CaseSummary[]> {
  const qs = new URLSearchParams();
  if (filters.status) qs.set("status", filters.status);
  if (filters.phase) qs.set("phase", String(filters.phase));
  if (filters.violation_code) qs.set("violation_code", filters.violation_code);
  if (filters.overdue) qs.set("overdue", "true");
  const q = qs.toString();
  return api<CaseSummary[]>(`/cases${q ? `?${q}` : ""}`);
}

export const fetchCaseStats = () => api<CaseStats>("/cases/stats");
export const fetchOfficers = () => api<CaseOfficer[]>("/cases/officers");
export const fetchCase = (id: string) => api<CaseDetail>(`/cases/${id}`);
export const fetchPrecheckContext = (id: string) =>
  api<PrecheckContext>(`/cases/${id}/precheck-context`);
export const openCaseFromViolation = (violationId: string) =>
  api<CaseDetail>(`/cases/from-violation/${violationId}`, { method: "POST" });
export const runCaseAction = (id: string, action: CaseAction, payload: unknown = {}) =>
  api<CaseDetail>(`/cases/${id}/actions/${action}`, { method: "POST", body: payload });
