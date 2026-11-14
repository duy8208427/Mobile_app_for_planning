import { Alert, Platform } from "react-native";
import type { Href } from "expo-router";
import { api } from "./api";

export type Role = "citizen" | "manager" | "admin";

export function roleLabel(role?: string | null): string {
  if (role === "admin") return "Cán bộ Quản lý";
  if (role === "manager") return "Cán bộ Xử lý";
  return "Người dân";
}

export const isStaffRole = (role?: string | null) => role === "admin" || role === "manager";

export const PHASES: Record<number, string> = {
  1: "Phát hiện và Tiền kiểm",
  2: "Kiểm tra thực địa và Lập biên bản",
  3: "Ban hành quyết định và Xử lý",
  4: "Hậu kiểm và Đóng hồ sơ",
};

export const PHASE_SHORT: Record<number, string> = {
  1: "Tiền kiểm",
  2: "Thực địa",
  3: "Xử lý",
  4: "Hậu kiểm",
};

export const FINAL_STATUSES = ["da_dong", "khong_vi_pham"];

export const ACTION_LABELS: Record<string, string> = {
  precheck: "Tiền kiểm online",
  assign: "Lập phiếu giao việc",
  accept: "Nhận việc, đến hiện trường",
  submit_record: "Lập biên bản hiện trường",
  return_record: "Trả lại bổ sung biên bản",
  decide: "Ban hành quyết định xử phạt",
  report_continuing: "Vẫn tiếp tục thi công",
  submit_permit: "Nộp giấy phép được cấp/điều chỉnh",
  permit_expired: "Hết hạn cấp phép: buộc phá dỡ",
  report_remediation: "Báo cáo kết quả khắc phục",
  request_reinspection: "Yêu cầu hậu kiểm",
  reinspect: "Trả kết quả hậu kiểm",
  close: "Đóng hồ sơ lưu trữ",
};

export const ACTION_ICONS: Record<string, string> = {
  precheck: "search-outline",
  assign: "person-add-outline",
  accept: "walk-outline",
  submit_record: "document-text-outline",
  return_record: "arrow-undo-outline",
  decide: "hammer-outline",
  report_continuing: "warning-outline",
  submit_permit: "ribbon-outline",
  permit_expired: "close-circle-outline",
  report_remediation: "construct-outline",
  request_reinspection: "repeat-outline",
  reinspect: "checkmark-done-outline",
  close: "archive-outline",
};

export const SOURCE_LABELS: Record<string, string> = {
  citizen_report: "Phản ánh của người dân",
  ai_violation: "Cảnh báo AI (flycam)",
};

export type CatalogViolation = {
  code: string;
  name: string;
  behavior: string;
  legal_basis: string;
  remedy: string;
  permit_track: boolean;
  extra_penalties?: string | null;
  fines_org: Record<string, { min: number; max: number }>;
  fines_individual: Record<string, { min: number; max: number }>;
};

export type Catalog = {
  violations: CatalogViolation[];
  work_types: Record<string, string>;
  subject_types: Record<string, string>;
  construction_states: Record<string, string>;
  statuses: Record<string, { label: string; step: number; phase: number; final: boolean }>;
  phases: Record<string, string>;
  steps: Record<string, string>;
  actions: Record<string, { label: string; step: number }>;
  authority_limit: { to_chuc: number; ca_nhan: number };
  permit_days: { house: number; project: number; check: number; demolish: number };
  legal_note: string;
};

let catalogCache: Catalog | null = null;
let catalogPromise: Promise<Catalog> | null = null;

export function loadCatalog(): Promise<Catalog> {
  if (catalogCache) return Promise.resolve(catalogCache);
  if (!catalogPromise) {
    catalogPromise = api("/violation-catalog")
      .then((c: Catalog) => {
        catalogCache = c;
        return c;
      })
      .catch((e) => {
        catalogPromise = null;
        throw e;
      });
  }
  return catalogPromise;
}

export function caseDetailHref(id: string): Href {
  return { pathname: "/case-detail", params: { id } } as unknown as Href;
}

export function casesHref(params?: Record<string, string>): Href {
  return (params ? { pathname: "/cases", params } : "/cases") as unknown as Href;
}

export function formatMoney(n?: number | null): string {
  if (n == null || isNaN(Number(n))) return "—";
  return `${Math.round(Number(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")} đ`;
}

export function formatDate(value?: string | null): string {
  if (!value) return "—";
  const s = String(value);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  const d = new Date(s.endsWith("Z") || /[+-]\d\d:\d\d$/.test(s) ? s : `${s}Z`);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleDateString("vi-VN");
}

export function formatDateTime(value?: string | null): string {
  if (!value) return "—";
  const s = String(value);
  const d = new Date(s.endsWith("Z") || /[+-]\d\d:\d\d$/.test(s) ? s : `${s}Z`);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleString("vi-VN");
}

/** ISO date (YYYY-MM-DD) for today + n days, in local time. */
export function isoInDays(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function isValidIsoDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00`);
  return !isNaN(d.getTime());
}

/** Days from today until an ISO date (negative when past). */
export function daysUntil(iso?: string | null): number | null {
  if (!iso || !isValidIsoDate(String(iso).slice(0, 10))) return null;
  const target = new Date(`${String(iso).slice(0, 10)}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

export function deadlineText(iso?: string | null): string {
  const n = daysUntil(iso);
  if (n == null) return "";
  if (n < 0) return `quá hạn ${-n} ngày`;
  if (n === 0) return "hết hạn hôm nay";
  return `còn ${n} ngày`;
}

export function notify(title: string, message?: string) {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined") window.alert(message ? `${title}\n\n${message}` : title);
    return;
  }
  Alert.alert(title, message);
}

export function askConfirm(title: string, message: string, okLabel = "Xác nhận"): Promise<boolean> {
  if (Platform.OS === "web") {
    return Promise.resolve(typeof window !== "undefined" ? window.confirm(`${title}\n\n${message}`) : true);
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: "Huỷ", style: "cancel", onPress: () => resolve(false) },
      { text: okLabel, onPress: () => resolve(true) },
    ]);
  });
}

export function runCaseAction(caseId: string, action: string, payload: Record<string, any> = {}) {
  return api(`/cases/${caseId}/actions/${action}`, { method: "POST", body: payload });
}
