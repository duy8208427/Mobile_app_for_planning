import { useState, type ReactNode } from "react";

export const inputCls = "mt-1 w-full border border-border-subtle bg-white px-3 py-2 text-sm";
export const primaryBtn =
  "bg-primary px-5 py-2 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-60";
export const dangerBtn =
  "border border-accent-alert px-5 py-2 text-sm font-semibold text-accent-alert hover:bg-red-50 disabled:opacity-60";

export function Section({
  title,
  children,
  aside,
}: {
  title: string;
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <section className="border border-border-subtle bg-surface-white">
      <div className="flex items-center justify-between gap-2 border-b border-border-subtle px-4 py-2.5">
        <h2 className="text-sm font-semibold uppercase tracking-wide">{title}</h2>
        {aside}
      </div>
      <div className="p-4 text-sm">{children}</div>
    </section>
  );
}

/** Lưới thông tin dạng nhãn – giá trị; bỏ qua dòng không có dữ liệu. */
export function InfoGrid({ rows }: { rows: [string, ReactNode][] }) {
  const visible = rows.filter(([, v]) => v !== null && v !== undefined && v !== "" && v !== false);
  if (visible.length === 0) return null;
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-[8.5rem_1fr]">
      {visible.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-xs uppercase tracking-wide text-text-muted sm:pt-0.5">{k}</dt>
          <dd className="whitespace-pre-wrap break-words">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function PhotoGrid({ photos, label }: { photos?: (string | null | undefined)[]; label?: string }) {
  const list = (photos || []).filter((p): p is string => !!p);
  const [open, setOpen] = useState<string | null>(null);
  if (list.length === 0) return null;
  return (
    <div className="mt-3">
      {label && <p className="mb-1 text-xs uppercase tracking-wide text-text-muted">{label}</p>}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
        {list.map((src, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setOpen(src)}
            className="aspect-square overflow-hidden border border-border-subtle bg-background-base"
            title="Xem ảnh lớn"
          >
            <img src={src} alt={`Ảnh ${i + 1}`} className="h-full w-full object-cover" />
          </button>
        ))}
      </div>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6"
          onClick={() => setOpen(null)}
          role="dialog"
        >
          <img src={open} alt="Ảnh phóng to" className="max-h-full max-w-full" />
          <button
            type="button"
            className="absolute right-4 top-4 bg-white px-3 py-1 text-sm font-medium"
            onClick={() => setOpen(null)}
          >
            Đóng
          </button>
        </div>
      )}
    </div>
  );
}

export function Notice({
  tone = "info",
  children,
}: {
  tone?: "info" | "warning" | "alert" | "success";
  children: ReactNode;
}) {
  const cls = {
    info: "border-primary/40 bg-blue-50 text-text-main",
    warning: "border-accent-warning bg-orange-50 text-text-main",
    alert: "border-accent-alert bg-red-50 text-accent-alert",
    success: "border-accent-success bg-green-50 text-text-main",
  }[tone];
  return <div className={`border px-3 py-2 text-sm ${cls}`}>{children}</div>;
}
