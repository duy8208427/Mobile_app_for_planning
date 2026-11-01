import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import type { Report, ReportStatus } from "../api/types";

const STATUS_LABELS: Record<string, string> = {
  received: "Tiếp nhận",
  assigned: "Đã giao",
  pending_approval: "Chờ duyệt",
  resolved: "Đã giải quyết",
  rejected: "Từ chối",
  processing: "Đã giao", // legacy
};

const FILTERS = ["", "received", "assigned", "pending_approval", "resolved", "rejected"];

export function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<Report | null>(null);
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
    setResponse(r.admin_response || "");
    setError("");
  };

  const applyStatus = async (status: ReportStatus) => {
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

  const status = selected?.status === "processing" ? "assigned" : selected?.status;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="shrink-0 border-b border-border-subtle bg-surface-white px-6 py-4">
        <h1 className="text-xl font-bold">Báo cáo công dân</h1>
        <div className="mt-3 flex flex-wrap gap-2">
          {FILTERS.map((s) => (
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
                  {STATUS_LABELS[r.status] || r.status}
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
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-lg font-semibold">{selected.title}</h2>
                <span className="shrink-0 text-xs font-semibold uppercase text-primary">
                  {STATUS_LABELS[selected.status] || selected.status}
                </span>
              </div>
              <p className="mt-2 text-sm">{selected.description}</p>
              <p className="mt-2 text-sm text-text-muted">{selected.address}</p>
              <p className="mt-1 text-xs text-text-muted">
                Người gửi: {selected.user_name}
                {selected.handled_by ? ` · Xử lý bởi: ${selected.handled_by}` : ""}
              </p>

              {selected.implementer_notes && (
                <div className="mt-4 border border-border-subtle bg-background-base p-3">
                  <p className="text-xs font-semibold uppercase text-text-muted">
                    Nội dung người thực hiện
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm">{selected.implementer_notes}</p>
                </div>
              )}

              {error && <p className="mt-4 text-sm text-accent-alert">{error}</p>}

              {(status === "received" || status === "pending_approval" || status === "assigned") && (
                <label className="mt-6 block text-sm font-medium">
                  Phản hồi Admin (gửi người dân khi phê duyệt / từ chối)
                  <textarea
                    value={response}
                    onChange={(e) => setResponse(e.target.value)}
                    rows={4}
                    className="mt-1 w-full border border-border-subtle px-3 py-2"
                  />
                </label>
              )}

              {selected.admin_response && status !== "received" && status !== "pending_approval" && (
                <div className="mt-4">
                  <p className="text-xs font-semibold uppercase text-text-muted">Phản hồi Admin</p>
                  <p className="mt-1 text-sm whitespace-pre-wrap">{selected.admin_response}</p>
                </div>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                {status === "received" && (
                  <>
                    <button
                      type="button"
                      onClick={() => applyStatus("assigned")}
                      disabled={saving}
                      className="bg-primary px-6 py-2 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-60"
                      data-testid="report-assign-button"
                    >
                      {saving ? "Đang lưu…" : "Giao việc"}
                    </button>
                    <button
                      type="button"
                      onClick={() => applyStatus("rejected")}
                      disabled={saving}
                      className="border border-accent-alert px-6 py-2 text-sm font-semibold text-accent-alert disabled:opacity-60"
                      data-testid="report-reject-button"
                    >
                      Từ chối
                    </button>
                  </>
                )}

                {status === "pending_approval" && (
                  <>
                    <button
                      type="button"
                      onClick={() => applyStatus("resolved")}
                      disabled={saving}
                      className="bg-accent-success px-6 py-2 text-sm font-semibold text-white disabled:opacity-60"
                      data-testid="report-approve-button"
                    >
                      {saving ? "Đang lưu…" : "Phê duyệt"}
                    </button>
                    <button
                      type="button"
                      onClick={() => applyStatus("rejected")}
                      disabled={saving}
                      className="border border-accent-alert px-6 py-2 text-sm font-semibold text-accent-alert disabled:opacity-60"
                      data-testid="report-reject-button"
                    >
                      Từ chối
                    </button>
                    <button
                      type="button"
                      onClick={() => applyStatus("assigned")}
                      disabled={saving}
                      className="border border-border-subtle px-6 py-2 text-sm font-semibold disabled:opacity-60"
                      data-testid="report-return-button"
                    >
                      Trả lại xử lý
                    </button>
                  </>
                )}

                {status === "assigned" && (
                  <button
                    type="button"
                    onClick={() => applyStatus("rejected")}
                    disabled={saving}
                    className="border border-accent-alert px-6 py-2 text-sm font-semibold text-accent-alert disabled:opacity-60"
                    data-testid="report-reject-button"
                  >
                    Từ chối
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
