import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import type { AdminStats, ViolationStats } from "../api/types";

export function DashboardPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [vstats, setVstats] = useState<ViolationStats | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<AdminStats>("/admin/stats")
      .then(setStats)
      .catch((e) => setError(e instanceof Error ? e.message : "Lỗi tải thống kê"));
    api<ViolationStats>("/violations/stats")
      .then(setVstats)
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
      <p className="mt-1 text-sm text-text-muted">Control room — báo cáo công dân và nghi vấn flycam</p>
      {error && <p className="mt-4 text-sm text-accent-alert">{error}</p>}
      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
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
            <p className="text-xs uppercase tracking-wide text-text-muted">Bác bỏ</p>
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
          to="/admin/reports"
          className="border border-border-subtle bg-surface-white p-5 hover:-translate-y-0.5 hover:shadow-md transition-transform"
        >
          <h2 className="text-lg font-semibold">Hàng đợi báo cáo</h2>
          <p className="mt-1 text-sm text-text-muted">Duyệt và phản hồi báo cáo từ mobile</p>
        </Link>
      </div>
    </div>
  );
}
