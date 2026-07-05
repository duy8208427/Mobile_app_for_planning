import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import type { AdminStats } from "../api/types";

export function DashboardPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<AdminStats>("/admin/stats")
      .then(setStats)
      .catch((e) => setError(e instanceof Error ? e.message : "Lỗi tải thống kê"));
  }, []);

  const cards = stats
    ? [
        { label: "Tổng báo cáo", value: stats.total, color: "text-text-main" },
        { label: "Chờ xử lý", value: stats.pending, color: "text-accent-warning" },
        { label: "Đang xử lý", value: stats.processing, color: "text-primary" },
        { label: "Đã giải quyết", value: stats.resolved, color: "text-accent-success" },
        { label: "Từ chối", value: stats.rejected, color: "text-accent-alert" },
      ]
    : [];

  return (
    <div className="flex flex-1 flex-col overflow-auto p-6">
      <h1 className="text-2xl font-bold">Tổng quan</h1>
      <p className="mt-1 text-sm text-text-muted">Control room — thống kê báo cáo công dân</p>
      {error && <p className="mt-4 text-sm text-accent-alert">{error}</p>}
      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-5">
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
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <Link
          to="/admin/map"
          className="border border-border-subtle bg-surface-white p-5 hover:-translate-y-0.5 hover:shadow-md transition-transform"
        >
          <h2 className="text-lg font-semibold">Bản đồ quy hoạch</h2>
          <p className="mt-1 text-sm text-text-muted">
            Overlay vùng quy hoạch và điểm nghi vấn vi phạm
          </p>
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
