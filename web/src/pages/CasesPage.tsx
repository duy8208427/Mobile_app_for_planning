import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { fetchCases, fetchCatalog } from "../api/client";
import type { CaseSummary, ViolationCatalog } from "../api/types";
import {
  SOURCE_LABEL,
  errMsg,
  formatDate,
  formatDateTime,
  sortedViolations,
} from "../lib/caseUtils";

const chip = (active: boolean) =>
  `border px-3 py-1 text-xs font-medium ${
    active ? "border-primary bg-primary text-white" : "border-border-subtle bg-surface-white"
  }`;

export function CasesPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const phase = params.get("phase") || "";
  const status = params.get("status") || "";
  const code = params.get("violation_code") || "";
  const overdue = params.get("overdue") === "true";

  const [catalog, setCatalog] = useState<ViolationCatalog | null>(null);
  const [items, setItems] = useState<CaseSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key === "phase") next.delete("status");
    setParams(next, { replace: true });
  };

  useEffect(() => {
    fetchCatalog()
      .then(setCatalog)
      .catch((e) => setError(errMsg(e, "Lỗi tải danh mục")));
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    fetchCases({ phase, status, violation_code: code, overdue })
      .then(setItems)
      .catch((e) => setError(errMsg(e, "Lỗi tải hồ sơ")))
      .finally(() => setLoading(false));
  }, [phase, status, code, overdue]);

  useEffect(() => {
    load();
  }, [load]);

  const phases = catalog ? Object.entries(catalog.phases) : [];
  const statusOptions = useMemo(() => {
    if (!catalog) return [];
    return Object.entries(catalog.statuses)
      .filter(([, s]) => !phase || String(s.phase) === phase)
      .sort((a, b) => a[1].step - b[1].step);
  }, [catalog, phase]);

  return (
    <div className="flex flex-1 flex-col overflow-auto p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Hồ sơ vụ việc</h1>
          <p className="mt-1 text-sm text-text-muted">
            Quy trình 16 bước: phát hiện, tiền kiểm, kiểm tra thực địa, xử phạt, hậu kiểm.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          className="border border-border-subtle bg-surface-white px-3 py-1.5 text-sm hover:bg-background-base"
        >
          Làm mới
        </button>
      </div>

      <div className="mt-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-24 text-xs uppercase tracking-wide text-text-muted">Giai đoạn</span>
          <button type="button" className={chip(!phase)} onClick={() => setParam("phase", "")}>
            Tất cả
          </button>
          {phases.map(([k, label]) => (
            <button
              key={k}
              type="button"
              className={chip(phase === k)}
              onClick={() => setParam("phase", k)}
              title={label}
            >
              {k}. {label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-24 text-xs uppercase tracking-wide text-text-muted">Trạng thái</span>
          <button type="button" className={chip(!status)} onClick={() => setParam("status", "")}>
            Tất cả
          </button>
          {statusOptions.map(([k, s]) => (
            <button
              key={k}
              type="button"
              className={chip(status === k)}
              onClick={() => setParam("status", k)}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="w-24 text-xs uppercase tracking-wide text-text-muted">Hành vi</span>
          <select
            value={code}
            onChange={(e) => setParam("violation_code", e.target.value)}
            className="border border-border-subtle bg-white px-2 py-1 text-sm"
          >
            <option value="">Tất cả hành vi</option>
            {sortedViolations(catalog).map((v) => (
              <option key={v.code} value={v.code}>
                {v.order}. {v.name}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={overdue}
              onChange={(e) => setParam("overdue", e.target.checked ? "true" : "")}
            />
            <span className={overdue ? "font-semibold text-accent-alert" : ""}>Quá hạn</span>
          </label>
        </div>
      </div>

      {error && <p className="mt-4 text-sm text-accent-alert">{error}</p>}

      <div className="mt-6 overflow-x-auto border border-border-subtle bg-surface-white">
        <table className="w-full min-w-[56rem] text-left text-sm">
          <thead className="border-b border-border-subtle bg-background-base text-xs uppercase tracking-wide text-text-muted">
            <tr>
              <th className="p-3">Mã hồ sơ</th>
              <th className="p-3">Tiêu đề</th>
              <th className="p-3">Nguồn</th>
              <th className="p-3">Trạng thái</th>
              <th className="p-3">Hành vi vi phạm</th>
              <th className="p-3">Cán bộ Xử lý</th>
              <th className="p-3">Hạn xử lý</th>
              <th className="p-3">Cập nhật</th>
            </tr>
          </thead>
          <tbody>
            {items.map((c) => (
              <tr
                key={c.id}
                onClick={() => navigate(`/admin/cases/${c.id}`)}
                className="cursor-pointer border-b border-border-subtle hover:bg-background-base"
                data-testid="case-row"
              >
                <td className="whitespace-nowrap p-3 font-mono text-xs font-semibold text-primary">{c.code}</td>
                <td className="max-w-xs p-3">
                  <p className="font-medium">{c.title}</p>
                  {c.address && <p className="text-xs text-text-muted">{c.address}</p>}
                </td>
                <td className="p-3">
                  <span
                    className={`inline-block border px-2 py-0.5 text-xs font-medium ${
                      c.source === "ai_violation"
                        ? "border-primary text-primary"
                        : "border-border-strong"
                    }`}
                  >
                    {SOURCE_LABEL[c.source] || c.source}
                  </span>
                </td>
                <td className="p-3">
                  <p className="font-medium">{c.status_label}</p>
                  <p className="text-xs text-text-muted">
                    GĐ {c.phase} · Bước {c.step}/16
                  </p>
                </td>
                <td className="max-w-[14rem] p-3">{c.violation_name || "—"}</td>
                <td className="p-3">{c.assignment?.officer_name || "—"}</td>
                <td
                  className={`p-3 whitespace-nowrap ${
                    c.overdue ? "font-semibold text-accent-alert" : ""
                  }`}
                >
                  {formatDate(c.deadline)}
                  {c.overdue && <span className="ml-1 text-xs">(quá hạn)</span>}
                </td>
                <td className="p-3 whitespace-nowrap text-xs text-text-muted">
                  {formatDateTime(c.updated_at || c.created_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && items.length === 0 && (
          <p className="p-6 text-center text-text-muted">Không có hồ sơ</p>
        )}
        {loading && <p className="p-6 text-center text-text-muted">Đang tải…</p>}
      </div>
    </div>
  );
}
