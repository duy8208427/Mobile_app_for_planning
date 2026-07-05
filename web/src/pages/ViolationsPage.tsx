import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import type { Violation } from "../api/types";

const SEVERITY_LABEL: Record<string, string> = {
  high: "Cao",
  medium: "Trung bình",
  low: "Thấp",
};

const STATUS_LABEL: Record<string, string> = {
  pending_review: "Chờ duyệt",
  confirmed: "Đã xác nhận",
  rejected: "Bác bỏ",
};

export function ViolationsPage() {
  const [items, setItems] = useState<Violation[]>([]);
  const [filter, setFilter] = useState("pending_review");
  const [error, setError] = useState("");
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const load = useCallback(() => {
    const q = filter ? `?status=${filter}` : "";
    api<Violation[]>(`/violations${q}`)
      .then(setItems)
      .catch((e) => setError(e instanceof Error ? e.message : "Lỗi tải dữ liệu"));
  }, [filter]);

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

  return (
    <div className="flex flex-1 flex-col overflow-auto p-6">
      <h1 className="text-2xl font-bold">Nghi vấn vi phạm</h1>
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
              <th className="p-3">Lý do</th>
              <th className="p-3">Rule</th>
              <th className="p-3">Mức độ</th>
              <th className="p-3">Trạng thái</th>
              <th className="p-3">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {items.map((v) => (
              <tr key={v.id} className="border-b border-border-subtle">
                <td className="max-w-xs p-3">{v.reason}</td>
                <td className="p-3 font-mono text-xs">{v.rule_id}</td>
                <td className="p-3">{SEVERITY_LABEL[v.severity]}</td>
                <td className="p-3">{STATUS_LABEL[v.status]}</td>
                <td className="p-3">
                  {v.status === "pending_review" && (
                    <div className="flex gap-2">
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
                        Bác bỏ
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
