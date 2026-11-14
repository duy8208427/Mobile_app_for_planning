import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api, fetchCatalog, openCaseFromViolation } from "../api/client";
import type { Violation, ViolationCatalog } from "../api/types";
import { findViolation } from "../lib/caseUtils";

const SEVERITY_LABEL: Record<string, string> = {
  high: "Cao",
  medium: "Trung bình",
  low: "Thấp",
};

const STATUS_LABEL: Record<string, string> = {
  pending_review: "Chờ duyệt",
  confirmed: "Đã xác nhận",
  rejected: "Không vi phạm",
};

const RULE_LABEL: Record<string, string> = {
  SAI_MDSD: "Sai mục đích đất",
  LAN_RANH: "Lấn ranh",
  NHA_MOI: "Nhà mới",
};

export function ViolationsPage() {
  const [params] = useSearchParams();
  const missionId = params.get("mission_id") || "";
  const [items, setItems] = useState<Violation[]>([]);
  const [filter, setFilter] = useState("pending_review");
  const [error, setError] = useState("");
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<ViolationCatalog | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchCatalog()
      .then(setCatalog)
      .catch(() => undefined);
  }, []);

  const load = useCallback(() => {
    const qs = new URLSearchParams();
    if (filter) qs.set("status", filter);
    if (missionId) qs.set("mission_id", missionId);
    const q = qs.toString() ? `?${qs}` : "";
    api<Violation[]>(`/violations${q}`)
      .then(setItems)
      .catch((e) => setError(e instanceof Error ? e.message : "Lỗi tải dữ liệu"));
  }, [filter, missionId]);

  useEffect(() => {
    load();
  }, [load]);

  const review = async (id: string, status: "confirmed" | "rejected") => {
    setLoadingId(id);
    try {
      await api(`/violations/${id}/review`, {
        method: "PATCH",
        body: { status },
      });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi duyệt");
    } finally {
      setLoadingId(null);
    }
  };

  const openCase = async (id: string) => {
    setLoadingId(id);
    setError("");
    try {
      const c = await openCaseFromViolation(id);
      navigate(`/admin/cases/${c.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi mở hồ sơ");
    } finally {
      setLoadingId(null);
    }
  };

  const suggestion = (rule: string) =>
    findViolation(catalog, catalog?.ai_rule_suggestion[rule])?.name;

  return (
    <div className="flex flex-1 flex-col overflow-auto p-6">
      <h1 className="text-2xl font-bold">Nghi vấn nhà xây trái phép</h1>
      <p className="mt-1 text-sm text-text-muted">
        AI chỉ gợi ý. Cán bộ Quản lý mở hồ sơ tiền kiểm hoặc xác nhận trước khi công dân thấy trên bản đồ.
        {missionId ? ` Đợt bay: ${missionId.slice(0, 8)}…` : ""}
      </p>
      <div className="mt-4 flex gap-2">
        {["pending_review", "confirmed", "rejected", ""].map((s) => (
          <button
            key={s || "all"}
            type="button"
            onClick={() => setFilter(s)}
            className={`border px-3 py-1 text-xs font-medium ${
              filter === s
                ? "border-primary bg-primary text-white"
                : "border-border-subtle"
            }`}
          >
            {s ? STATUS_LABEL[s] : "Tất cả"}
          </button>
        ))}
      </div>
      {error && <p className="mt-4 text-sm text-accent-alert">{error}</p>}
      <div className="mt-6 overflow-x-auto border border-border-subtle bg-surface-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border-subtle bg-background-base text-xs uppercase tracking-wide text-text-muted">
            <tr>
              <th className="p-3">Thửa</th>
              <th className="p-3">Loại đất</th>
              <th className="p-3">Rule</th>
              <th className="p-3">Diện tích</th>
              <th className="p-3">Lý do</th>
              <th className="p-3">Mức</th>
              <th className="p-3">Trạng thái</th>
              <th className="p-3">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {items.map((v) => (
              <tr key={v.id} className="border-b border-border-subtle">
                <td className="p-3 font-mono text-xs">
                  {v.so_to || "—"}/{v.so_thua || "—"}
                </td>
                <td className="p-3">{v.loai_dat || "—"}</td>
                <td className="p-3">
                  {RULE_LABEL[v.rule_id] || v.rule_id}
                  {suggestion(v.rule_id) && (
                    <p className="mt-1 text-xs text-primary">Gợi ý: {suggestion(v.rule_id)}</p>
                  )}
                </td>
                <td className="p-3">{v.area_m2 != null ? `${v.area_m2} m²` : "—"}</td>
                <td className="max-w-xs p-3">{v.reason}</td>
                <td className="p-3">{SEVERITY_LABEL[v.severity] || v.severity}</td>
                <td className="p-3">{STATUS_LABEL[v.status] || v.status}</td>
                <td className="p-3">
                  {v.case_id && (
                    <Link
                      to={`/admin/cases/${v.case_id}`}
                      className="mb-2 inline-block text-xs font-semibold text-primary underline"
                    >
                      Xem hồ sơ
                    </Link>
                  )}
                  {v.status === "pending_review" && (
                    <div className="flex flex-wrap gap-2">
                      {!v.case_id && (
                        <button
                          type="button"
                          disabled={loadingId === v.id}
                          onClick={() => openCase(v.id)}
                          className="bg-primary px-2 py-1 text-xs text-white hover:bg-primary-hover disabled:opacity-60"
                        >
                          Mở hồ sơ tiền kiểm
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={loadingId === v.id}
                        onClick={() => review(v.id, "confirmed")}
                        className="bg-accent-success px-2 py-1 text-xs text-white"
                      >
                        Xác nhận
                      </button>
                      <button
                        type="button"
                        disabled={loadingId === v.id}
                        onClick={() => review(v.id, "rejected")}
                        className="border border-border-strong px-2 py-1 text-xs"
                      >
                        Không vi phạm
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {items.length === 0 && (
          <p className="p-6 text-center text-text-muted">Không có bản ghi</p>
        )}
      </div>
    </div>
  );
}
