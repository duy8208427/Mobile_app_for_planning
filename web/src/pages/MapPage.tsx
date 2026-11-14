import { Link, useSearchParams } from "react-router-dom";
import { PlanningMap } from "../map/PlanningMap";

export function MapPage() {
  const [params] = useSearchParams();
  const missionId = params.get("mission_id") || undefined;

  return (
    <div className="flex h-full flex-col">
      <header className="flex shrink-0 items-start justify-between gap-4 border-b border-border-subtle bg-surface-white px-6 py-3">
        <div>
          <h1 className="text-xl font-bold">Bản đồ địa chính &amp; hiện trạng</h1>
          <p className="text-sm text-text-muted">
            Thửa đất từ FileGDB địa chính · mái nhà YOLO · nghi vấn flycam
            {missionId ? ` · đợt bay ${missionId.slice(0, 8)}…` : ""}
          </p>
        </div>
        <Link to="/admin/surveys" className="bg-primary px-4 py-2 text-sm font-medium text-white">
          Đợt bay / bổ sung ảnh
        </Link>
      </header>
      <div className="relative flex flex-1 overflow-hidden">
        <PlanningMap className="flex-1" missionId={missionId} />
      </div>
    </div>
  );
}
