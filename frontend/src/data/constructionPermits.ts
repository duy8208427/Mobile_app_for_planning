import { api } from "../api";

export type ConstructionPermit = {
  id: string;
  title: string;
  permitCode: string;
  permitDate: string;
  investor: string;
  address: string;
  district: string;
  projectType?: string;
  status?: string;
  note?: string;
  isDemo?: boolean;
};

type PermitRow = {
  id: string;
  permit_no: string;
  so_to?: string;
  so_thua?: string;
  owner_name?: string;
  address?: string;
  floors?: number;
  area_m2?: number;
  issued_date?: string;
  issuer?: string;
  is_demo?: boolean;
};

let cache: ConstructionPermit[] | null = null;

function viDate(iso?: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return d && m && y ? `${Number(d)}/${Number(m)}/${y}` : iso;
}

function toPermit(p: PermitRow): ConstructionPermit {
  const floors = p.floors ? `${p.floors} tầng` : "";
  return {
    id: p.id,
    title: `Nhà ở riêng lẻ${floors ? ` ${floors}` : ""} — tờ ${p.so_to ?? "?"}, thửa ${p.so_thua ?? "?"}`,
    permitCode: p.permit_no,
    permitDate: viDate(p.issued_date),
    investor: p.owner_name || "—",
    address: p.address || "TP. Cao Lãnh, Đồng Tháp",
    district: "TP. Cao Lãnh",
    projectType: "Nhà ở riêng lẻ",
    status: p.is_demo ? "Đã cấp phép (dữ liệu mẫu)" : "Đã cấp phép",
    note: [p.area_m2 ? `Diện tích xây dựng ${p.area_m2} m²` : "", floors, p.issuer || ""].filter(Boolean).join(" · "),
    isDemo: !!p.is_demo,
  };
}

/** Building permits from the API (collection `permits`). Demo permits are flagged isDemo. */
export async function loadPermits(force = false): Promise<ConstructionPermit[]> {
  if (cache && !force) return cache;
  const res = await api("/permits");
  cache = ((res?.items || []) as PermitRow[]).map(toPermit);
  return cache;
}

export async function getPermitById(id: string): Promise<ConstructionPermit | undefined> {
  const list = await loadPermits();
  return list.find((p) => p.id === id);
}
