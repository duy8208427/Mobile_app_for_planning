import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export function LoginPage() {
  const { user, loading, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("admin@quyhoach.vn");
  const [password, setPassword] = useState("Admin@123");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!loading && user?.role === "admin") {
    return <Navigate to="/admin" replace />;
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const u = await login(email.trim(), password);
      if (u.role !== "admin") {
        setError("Tài khoản không có quyền quản trị web.");
        return;
      }
      navigate("/admin");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đăng nhập thất bại");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md border border-border-strong bg-surface-white p-8 shadow-sm"
      >
        <p className="text-xs font-medium uppercase tracking-widest text-text-muted">
          Quản trị
        </p>
        <h1 className="mt-2 text-2xl font-bold">Đăng nhập</h1>
        <p className="mt-1 text-sm text-text-muted">
          Dành cho cán bộ quản lý quy hoạch
        </p>
        {error && (
          <p className="mt-4 border border-accent-alert bg-red-50 px-3 py-2 text-sm text-accent-alert">
            {error}
          </p>
        )}
        <label className="mt-6 block text-sm font-medium">
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full border border-border-subtle px-3 py-2"
            required
            data-testid="login-email"
          />
        </label>
        <label className="mt-4 block text-sm font-medium">
          Mật khẩu
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full border border-border-subtle px-3 py-2"
            required
            data-testid="login-password"
          />
        </label>
        <button
          type="submit"
          disabled={submitting}
          className="mt-6 w-full bg-primary py-2.5 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-60"
          data-testid="login-submit"
        >
          {submitting ? "Đang đăng nhập…" : "Đăng nhập"}
        </button>
      </form>
    </div>
  );
}
