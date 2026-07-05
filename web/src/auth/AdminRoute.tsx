import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "./AuthContext";

export function AdminRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-text-muted">
        Đang tải…
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role !== "admin") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6">
        <p className="text-lg font-semibold">Chỉ tài khoản quản lý mới truy cập được.</p>
        <a href="/login" className="text-primary underline">
          Đăng nhập lại
        </a>
      </div>
    );
  }

  return <Outlet />;
}
