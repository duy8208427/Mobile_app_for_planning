import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import type { Report } from "../api/types";

const STATUS_LABELS: Record<string, string> = {
  received: "Tiếp nhận",
  processing: "Đang xử lý",
  resolved: "Đã giải quyết",
  rejected: "Từ chối",
};

export function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<Report | null>(null);
  const [status, setStatus] = useState<Report["status"]>("processing");
  const [response, setResponse] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    const q = filter ? `?status=${filter}` : "";
    api<Report[]>(`/reports${q}`)
      .then(setReports)
      .catch((e) => setError(e instanceof Error ? e.message : "Lỗi tải báo cáo"));
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  const openReport = (r: Report) => {
    setSelected(r);
    setStatus(r.status);
    setResponse(r.admin_response || "");
  };

  const save = async () => {
    if (!selected) return;
    setSaving(true);
    setError("");
    try {
      const updated = await api<Report>(`/reports/${selected.id}`, {
        method: "PUT",
        body: { status, admin_response: response || null },
      });
      setSelected(updated);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi cập nhật");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="shrink-0 border-b border-border-subtle bg-surface-white px-6 py-4">
        <h1 className="text-xl font-bold">Báo cáo công dân</h1>
        <div className="mt-3 flex flex-wrap gap-2">
          {["", "received", "processing", "resolved", "rejected"].map((s) => (
            <button
              key={s || "all"}
              type="button"
              onClick={() => setFilter(s)}
              className={`border px-3 py-1 text-xs font-medium ${
                filter === s
                  ? "border-primary bg-primary text-white"
                  : "border-border-subtle bg-surface-white"
              }`}
            >
              {s ? STATUS_LABELS[s] : "Tất cả"}
            </button>
          ))}
        </div>
      </header>
      <div className="flex flex-1 overflow-hidden">
        <ul className="w-full max-w-md overflow-y-auto border-r border-border-subtle bg-background-base">
          {reports.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => openReport(r)}
                className={`w-full border-b border-border-subtle p-4 text-left hover:bg-surface-white ${
                  selected?.id === r.id ? "bg-surface-white" : ""
                }`}
              >
                <p className="font-medium">{r.title}</p>
                <p className="text-xs text-text-muted">{r.user_name}</p>
                <span className="mt-1 inline-block text-xs font-medium uppercase text-primary">
                  {STATUS_LABELS[r.status]}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <div className="flex flex-1 flex-col overflow-y-auto p-6">
          {!selected ? (
            <p className="text-text-muted">Chọn một báo cáo để xử lý</p>
          ) : (
            <>
              <h2 className="text-lg font-semibold">{selected.title}</h2>
              <p className="mt-2 text-sm">{selected.description}</p>
              <p className="mt-2 text-sm text-text-muted">{selected.address}</p>
              {error && <p className="mt-4 text-sm text-accent-alert">{error}</p>}
              <label className="mt-6 block text-sm font-medium">
                Trạng thái
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as Report["status"])}
                  className="mt-1 w-full border border-border-subtle px-3 py-2"
                >
                  {Object.entries(STATUS_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
              <label className="mt-4 block text-sm font-medium">
                Phản hồi cán bộ
                <textarea
                  value={response}
                  onChange={(e) => setResponse(e.target.value)}
                  rows={4}
                  className="mt-1 w-full border border-border-subtle px-3 py-2"
                />
              </label>
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="mt-4 bg-primary px-6 py-2 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-60"
                data-testid="report-save-button"
              >
                {saving ? "Đang lưu…" : "Cập nhật"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
