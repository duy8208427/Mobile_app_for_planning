import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api } from "../api/client";
import type { AdminUserCreate, AdminUserUpdate, User, UserRole } from "../api/types";
import { useAuth } from "../auth/AuthContext";

const ROLE_LABELS: Record<UserRole, string> = {
  citizen: "Người dân",
  manager: "Người thực hiện",
  admin: "Admin",
};

const emptyForm = {
  full_name: "",
  email: "",
  phone: "",
  role: "citizen" as UserRole,
  password: "",
};

export function UsersPage() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [filter, setFilter] = useState<"" | UserRole>("");
  const [selected, setSelected] = useState<User | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    const q = filter ? `?role=${filter}` : "";
    setError("");
    api<User[]>(`/admin/users${q}`)
      .then(setUsers)
      .catch((e) => {
        setUsers([]);
        setError(e instanceof Error ? e.message : "Lỗi tải người dùng");
      });
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  const startCreate = () => {
    setCreating(true);
    setSelected(null);
    setForm(emptyForm);
    setError("");
  };

  const openUser = (u: User) => {
    setCreating(false);
    setSelected(u);
    setForm({
      full_name: u.full_name,
      email: u.email,
      phone: u.phone || "",
      role: u.role,
      password: "",
    });
    setError("");
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (creating) {
        const body: AdminUserCreate = {
          full_name: form.full_name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim() || null,
          role: form.role,
          password: form.password,
        };
        const created = await api<User>("/admin/users", { method: "POST", body });
        setCreating(false);
        openUser(created);
      } else if (selected) {
        const body: AdminUserUpdate = {
          full_name: form.full_name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim() || null,
          role: form.role,
        };
        if (form.password.trim()) {
          body.password = form.password;
        }
        const updated = await api<User>(`/admin/users/${selected.id}`, {
          method: "PUT",
          body,
        });
        openUser(updated);
      }
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi lưu người dùng");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {
    if (!selected || selected.id === me?.id) return;
    if (!window.confirm(`Xóa tài khoản ${selected.email}?`)) return;
    setSaving(true);
    setError("");
    try {
      await api<{ ok: boolean }>(`/admin/users/${selected.id}`, { method: "DELETE" });
      setSelected(null);
      setCreating(false);
      setForm(emptyForm);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi xóa người dùng");
    } finally {
      setSaving(false);
    }
  };

  const editingSelf = !!selected && selected.id === me?.id;
  const showForm = creating || !!selected;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="shrink-0 border-b border-border-subtle bg-surface-white px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-bold">Người dùng</h1>
          <button
            type="button"
            onClick={startCreate}
            className="bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover"
            data-testid="user-create-button"
          >
            Thêm người dùng
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {(
            [
              ["", "Tất cả"],
              ["citizen", "Người dân"],
              ["manager", "Người thực hiện"],
              ["admin", "Admin"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value || "all"}
              type="button"
              onClick={() => setFilter(value)}
              className={`border px-3 py-1 text-xs font-medium ${
                filter === value
                  ? "border-primary bg-primary text-white"
                  : "border-border-subtle bg-surface-white"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </header>
      <div className="flex flex-1 overflow-hidden">
        <ul className="w-full max-w-md overflow-y-auto border-r border-border-subtle bg-background-base">
          {users.map((u) => (
            <li key={u.id}>
              <button
                type="button"
                onClick={() => openUser(u)}
                className={`w-full border-b border-border-subtle p-4 text-left hover:bg-surface-white ${
                  selected?.id === u.id && !creating ? "bg-surface-white" : ""
                }`}
              >
                <p className="font-medium">{u.full_name}</p>
                <p className="text-xs text-text-muted">{u.email}</p>
                <span className="mt-1 inline-block text-xs font-medium uppercase text-primary">
                  {ROLE_LABELS[u.role]}
                </span>
              </button>
            </li>
          ))}
          {users.length === 0 && (
            <li className="p-4 text-sm text-text-muted">
              {error ? error : "Chưa có người dùng trong bộ lọc này."}
            </li>
          )}
        </ul>
        <div className="flex flex-1 flex-col overflow-y-auto p-6">
          {!showForm ? (
            <p className="text-text-muted">
              {error && users.length === 0
                ? error
                : "Chọn một người dùng để sửa, hoặc thêm mới."}
            </p>
          ) : (
            <form onSubmit={onSubmit} className="max-w-lg">
              <h2 className="text-lg font-semibold">
                {creating ? "Thêm người dùng" : "Sửa người dùng"}
              </h2>
              {error && <p className="mt-4 text-sm text-accent-alert">{error}</p>}
              <label className="mt-6 block text-sm font-medium">
                Họ và tên
                <input
                  value={form.full_name}
                  onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                  className="mt-1 w-full border border-border-subtle px-3 py-2"
                  required
                  data-testid="user-fullname"
                />
              </label>
              <label className="mt-4 block text-sm font-medium">
                Email
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className="mt-1 w-full border border-border-subtle px-3 py-2"
                  required
                  disabled={editingSelf}
                  data-testid="user-email"
                />
              </label>
              <label className="mt-4 block text-sm font-medium">
                Số điện thoại
                <input
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  className="mt-1 w-full border border-border-subtle px-3 py-2"
                  data-testid="user-phone"
                />
              </label>
              <label className="mt-4 block text-sm font-medium">
                Vai trò
                <select
                  value={form.role}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, role: e.target.value as UserRole }))
                  }
                  className="mt-1 w-full border border-border-subtle px-3 py-2"
                  disabled={editingSelf}
                  data-testid="user-role"
                >
                  <option value="citizen">Người dân</option>
                  <option value="manager">Người thực hiện</option>
                  <option value="admin">Admin</option>
                </select>
              </label>
              <label className="mt-4 block text-sm font-medium">
                Mật khẩu{creating ? "" : " (để trống nếu giữ nguyên)"}
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  className="mt-1 w-full border border-border-subtle px-3 py-2"
                  required={creating}
                  minLength={creating ? 6 : undefined}
                  data-testid="user-password"
                />
              </label>
              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-primary px-6 py-2 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-60"
                  data-testid="user-save-button"
                >
                  {saving ? "Đang lưu…" : creating ? "Tạo" : "Cập nhật"}
                </button>
                {!creating && selected && !editingSelf && (
                  <button
                    type="button"
                    onClick={onDelete}
                    disabled={saving}
                    className="border border-accent-alert px-6 py-2 text-sm font-semibold text-accent-alert hover:bg-red-50 disabled:opacity-60"
                    data-testid="user-delete-button"
                  >
                    Xóa
                  </button>
                )}
              </div>
              {editingSelf && (
                <p className="mt-3 text-xs text-text-muted">
                  Đây là tài khoản đang đăng nhập — không thể xóa, đổi email hay hạ quyền.
                </p>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
