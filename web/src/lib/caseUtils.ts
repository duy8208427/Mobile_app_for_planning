import type {
  CatalogViolation,
  FineRange,
  SubjectType,
  ViolationCatalog,
  WorkType,
} from "../api/types";

export const SOURCE_LABEL: Record<string, string> = {
  citizen_report: "Người dân",
  ai_violation: "AI",
};

export const ROLE_LABEL: Record<string, string> = {
  admin: "Cán bộ Quản lý",
  manager: "Cán bộ Xử lý",
  citizen: "Người dân",
};

export const AI_RULE_LABEL: Record<string, string> = {
  SAI_MDSD: "Sai mục đích sử dụng đất",
  LAN_RANH: "Lấn ranh",
  NHA_MOI: "Nhà mới",
};

export const PERMIT_TRACK_CODES = ["KHONG_PHEP", "SAI_PHEP"];

const vnd = new Intl.NumberFormat("vi-VN");

export function formatVnd(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return `${vnd.format(n)} đồng`;
}

/** 60000000 → "60", 1200000000 → "1,2 tỷ" (dùng trong bảng danh mục). */
function compactMillion(n: number): string {
  if (n >= 1_000_000_000) {
    return `${vnd.format(Math.round(n / 100_000_000) / 10)} tỷ`;
  }
  return vnd.format(Math.round((n / 1_000_000) * 10) / 10);
}

export function formatRangeShort(r: FineRange | undefined | null): string {
  if (!r) return "—";
  const lo = compactMillion(r.min);
  const hi = compactMillion(r.max);
  const unit = r.max >= 1_000_000_000 ? "" : " triệu";
  return `${lo}–${hi}${unit}`;
}

export function formatDate(s: string | null | undefined): string {
  if (!s) return "—";
  const d = new Date(s.length === 10 ? `${s}T00:00:00` : s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString("vi-VN");
}

export function formatDateTime(s: string | null | undefined): string {
  if (!s) return "—";
  // Backend trả thời gian UTC không kèm múi giờ.
  const iso = /[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : `${s}Z`;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** YYYY-MM-DD theo giờ địa phương, cộng thêm `days` ngày. */
export function isoDatePlus(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function findViolation(
  catalog: ViolationCatalog | null,
  code: string | null | undefined
): CatalogViolation | undefined {
  if (!catalog || !code) return undefined;
  return catalog.violations.find((v) => v.code === code);
}

/** Khung phạt theo đối tượng: Nghị định quy định cho tổ chức, cá nhân bằng 1/2. */
export function fineRange(
  v: CatalogViolation | undefined,
  workType: WorkType,
  subject: SubjectType
): FineRange | undefined {
  if (!v) return undefined;
  const org = v.fines_org?.[workType];
  if (subject === "to_chuc") return org;
  const ind = v.fines_individual?.[workType];
  if (ind) return ind;
  return org ? { min: org.min / 2, max: org.max / 2 } : undefined;
}

export function sortedViolations(catalog: ViolationCatalog | null): CatalogViolation[] {
  return catalog ? [...catalog.violations].sort((a, b) => a.order - b.order) : [];
}

/** Đọc ảnh, thu nhỏ cạnh dài về ~1280px và nén JPEG (q≈0.7), trả về data URL. */
export function compressImage(file: File, maxSide = 1280, quality = 0.7): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Trình duyệt không hỗ trợ xử lý ảnh"));
        return;
      }
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Không đọc được ảnh ${file.name}`));
    };
    img.src = url;
  });
}

export function errMsg(e: unknown, fallback = "Đã xảy ra lỗi"): string {
  return e instanceof Error ? e.message : fallback;
}
