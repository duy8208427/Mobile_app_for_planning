import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, fetchCaseStats, fetchCatalog } from "../api/client";
import type { AdminStats, CaseStats, ViolationCatalog, ViolationStats } from "../api/types";
import { sortedViolations } from "../lib/caseUtils";

export function DashboardPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [vstats, setVstats] = useState<ViolationStats | null>(null);
  const [cstats, setCstats] = useState<CaseStats | null>(null);
  const [catalog, setCatalog] = useState<ViolationCatalog | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<AdminStats>("/admin/stats")
      .then(setStats)
      .catch((e) => setError(e instanceof Error ? e.message : "Lỗi tải thống kê"));
    api<ViolationStats>("/violations/stats")
      .then(setVstats)
      .catch(() => undefined);
    fetchCaseStats()
      .then(setCstats)
      .catch(() => undefined);
    fetchCatalog()
      .then(setCatalog)
      .catch(() => undefined);
  }, []);

  const cards = stats
    ? [
        { label: "Tổng báo cáo", value: stats.total, color: "text-text-main" },
        { label: "Tiếp nhận", value: stats.pending, color: "text-accent-warning" },
        { label: "Đã giao", value: stats.assigned ?? stats.processing, color: "text-primary" },
        {
          label: "Chờ duyệt",
          value: stats.pending_approval ?? 0,
          color: "text-primary",
        },
        { label: "Đã giải quyết", value: stats.resolved, color: "text-accent-success" },
        { label: "Từ chối", value: stats.rejected, color: "text-accent-alert" },
      ]
    : [];

  return (
    <div className="flex flex-1 flex-col overflow-auto p-6">
      <h1 className="text-2xl font-bold">Tổng quan</h1>
      <p className="mt-1 text-sm text-text-muted">Control room — hồ sơ vụ việc, báo cáo công dân và nghi vấn flycam</p>
      {error && <p className="mt-4 text-sm text-accent-alert">{error}</p>}

      {cstats && (
        <section className="mt-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">Hồ sơ vụ việc</h2>
          <div className="mt-2 grid grid-cols-2 gap-3 md:grid-cols-6">
            <Link
              to="/admin/cases"
              className="border border-border-subtle bg-surface-white p-4 hover:bg-background-base"
            >
              <p className="text-xs uppercase tracking-wide text-text-muted">Hồ sơ đang mở</p>
              <p className="mt-2 text-3xl font-bold text-primary">{cstats.open}</p>
              <p className="text-xs text-text-muted">/ {cstats.total} hồ sơ</p>
            </Link>
            <Link
              to="/admin/cases?overdue=true"
              className="border border-border-subtle bg-surface-white p-4 hover:bg-background-base"
            >
              <p className="text-xs uppercase tracking-wide text-text-muted">Quá hạn</p>
              <p className={`mt-2 text-3xl font-bold ${cstats.overdue > 0 ? "text-accent-alert" : ""}`}>
                {cstats.overdue}
              </p>
            </Link>
            {["1", "2", "3", "4"].map((ph) => (
              <Link
                key={ph}
                to={`/admin/cases?phase=${ph}`}
                className="border border-border-subtle bg-surface-white p-4 hover:bg-background-base"
                title={catalog?.phases[ph]}
              >
                <p className="text-xs uppercase tracking-wide text-text-muted">Giai đoạn {ph}</p>
                <p className="mt-2 text-3xl font-bold">{cstats.by_phase[ph] ?? 0}</p>
                <p className="truncate text-xs text-text-muted">{catalog?.phases[ph] || ""}</p>
              </Link>
            ))}
          </div>
          {catalog && (
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {sortedViolations(catalog).map((v) => (
                <Link
                  key={v.code}
                  to={`/admin/cases?violation_code=${v.code}`}
                  className="border border-border-subtle bg-surface-white p-4 hover:bg-background-base"
                >
                  <p className="text-xs text-text-muted">
                    {v.order}. {v.name}
                  </p>
                  <p className="mt-2 text-2xl font-bold">{cstats.by_code[v.code] ?? 0}</p>
                </Link>
              ))}
            </div>
          )}
        </section>
      )}

      {cards.length > 0 && (
        <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-text-muted">Báo cáo công dân</h2>
      )}
      <div className="mt-2 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {cards.map((c) => (
          <div
            key={c.label}
            className="border border-border-subtle bg-surface-white p-4"
          >
            <p className="text-xs uppercase tracking-wide text-text-muted">{c.label}</p>
            <p className={`mt-2 text-3xl font-bold ${c.color}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {vstats && (
        <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="border border-border-subtle bg-surface-white p-4">
            <p className="text-xs uppercase tracking-wide text-text-muted">Nghi vấn chờ duyệt</p>
            <p className="mt-2 text-3xl font-bold text-accent-alert">{vstats.pending_review}</p>
          </div>
          <div className="border border-border-subtle bg-surface-white p-4">
            <p className="text-xs uppercase tracking-wide text-text-muted">Đã xác nhận</p>
            <p className="mt-2 text-3xl font-bold text-accent-warning">{vstats.confirmed}</p>
          </div>
          <div className="border border-border-subtle bg-surface-white p-4">
            <p className="text-xs uppercase tracking-wide text-text-muted">Không vi phạm</p>
            <p className="mt-2 text-3xl font-bold">{vstats.rejected}</p>
          </div>
          <div className="border border-border-subtle bg-surface-white p-4">
            <p className="text-xs uppercase tracking-wide text-text-muted">Đợt bay mới nhất</p>
            <p className="mt-2 text-lg font-bold">
              {vstats.latest_mission?.flight_date || "—"}
            </p>
            <p className="text-xs text-text-muted">
              {vstats.latest_pending} chờ duyệt · {vstats.latest_mission?.area_name || ""}
            </p>
          </div>
        </div>
      )}

      <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Link
          to="/admin/map"
          className="border border-border-subtle bg-surface-white p-5 hover:-translate-y-0.5 hover:shadow-md transition-transform"
        >
          <h2 className="text-lg font-semibold">Bản đồ</h2>
          <p className="mt-1 text-sm text-text-muted">
            Overlay thửa đất, mái nhà AI và nghi vấn
          </p>
        </Link>
        <Link
          to="/admin/surveys"
          className="border border-border-subtle bg-surface-white p-5 hover:-translate-y-0.5 hover:shadow-md transition-transform"
        >
          <h2 className="text-lg font-semibold">Đợt bay flycam</h2>
          <p className="mt-1 text-sm text-text-muted">Import orthophoto hàng tháng</p>
        </Link>
        <Link
          to="/admin/violations"
          className="border border-border-subtle bg-surface-white p-5 hover:-translate-y-0.5 hover:shadow-md transition-transform"
        >
          <h2 className="text-lg font-semibold">Nghi vấn AI</h2>
          <p className="mt-1 text-sm text-text-muted">Duyệt nhà xây sai so với địa chính</p>
        </Link>
        <Link
          to="/admin/cases"
          className="border border-border-subtle bg-surface-white p-5 hover:-translate-y-0.5 hover:shadow-md transition-transform"
        >
          <h2 className="text-lg font-semibold">Hồ sơ vụ việc</h2>
          <p className="mt-1 text-sm text-text-muted">Tiền kiểm, giao việc, xử phạt và hậu kiểm</p>
        </Link>
      </div>
    </div>
  );
}
