import { PlanningMap } from "../map/PlanningMap";

export function MapPage() {
  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 border-b border-border-subtle bg-surface-white px-6 py-3">
        <h1 className="text-xl font-bold">Bản đồ quy hoạch</h1>
        <p className="text-sm text-text-muted">
          Khu vực demo Đồng Tháp — lớp vùng quy hoạch
        </p>
      </header>
      <div className="relative flex flex-1 overflow-hidden">
        <PlanningMap className="flex-1" />
      </div>
    </div>
  );
}
