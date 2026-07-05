import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

const nav = [
  { to: "/admin", label: "Tổng quan", end: true },
  { to: "/admin/map", label: "Bản đồ quy hoạch" },
  { to: "/admin/violations", label: "Nghi vấn vi phạm" },
  { to: "/admin/reports", label: "Báo cáo công dân" },
];

export function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-56 shrink-0 flex-col border-r border-border-subtle bg-surface-white">
        <div className="border-b border-border-subtle p-4">
          <p className="text-xs font-medium uppercase tracking-widest text-text-muted">
            QuyHoạch AI
          </p>
          <p className="mt-1 text-sm font-semibold">Bảng quản trị</p>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-2">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "border-l-2 border-primary bg-background-base text-primary"
                    : "text-text-main hover:bg-background-base"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-border-subtle p-3 text-xs text-text-muted">
          <p className="font-medium text-text-main">{user?.full_name}</p>
          <p className="truncate">{user?.email}</p>
          <button
            type="button"
            onClick={handleLogout}
            className="mt-2 w-full border border-border-subtle px-2 py-1 text-left text-sm hover:bg-background-base"
            data-testid="logout-button"
          >
            Đăng xuất
          </button>
        </div>
      </aside>
      <main className="flex flex-1 flex-col overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}
