import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { Violation } from "../api/types";
import { PlanningMap } from "../map/PlanningMap";

export function MapPage() {
  const [violations, setViolations] = useState<Violation[]>([]);
  const [selected, setSelected] = useState<Violation | null>(null);

  useEffect(() => {
    api<Violation[]>("/violations")
      .then(setViolations)
      .catch(() => setViolations([]));
  }, []);

  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 border-b border-border-subtle bg-surface-white px-6 py-3">
        <h1 className="text-xl font-bold">Bản đồ quy hoạch</h1>
        <p className="text-sm text-text-muted">
          Khu vực demo Đồng Thập — lớp vùng quy hoạch + điểm nghi vấn
        </p>
      </header>
      <div className="relative flex flex-1 overflow-hidden">
        <PlanningMap
          violations={violations}
          onSelectViolation={setSelected}
          className="flex-1"
        />
        {selected && (
          <aside className="w-80 shrink-0 overflow-y-auto border-l border-border-subtle bg-surface-white p-4">
            <p className="text-xs uppercase tracking-widest text-text-muted">
              Nghi vấn vi phạm
            </p>
            <p className="mt-2 font-semibold">{selected.reason}</p>
            <p className="mt-2 text-sm">
              Mức độ: <strong>{selected.severity}</strong> · Rule: {selected.rule_id}
            </p>
            <p className="text-sm text-text-muted">
              Confidence: {(selected.confidence * 100).toFixed(0)}%
            </p>
            <p className="text-sm">Trạng thái: {selected.status}</p>
            <button
              type="button"
              className="mt-4 text-sm text-primary underline"
              onClick={() => setSelected(null)}
            >
              Đóng
            </button>
          </aside>
        )}
      </div>
    </div>
  );
}
