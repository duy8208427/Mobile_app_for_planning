import { useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api, uploadFile } from "../api/client";
import { PlanningMap } from "../map/PlanningMap";

function todayISO(): string {
  const d = new Date();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

function areaFromFile(name: string): string {
  const base = name.replace(/\.(tif|tiff|cog)$/i, "").trim();
  return base || "Ảnh trực giao";
}

export function MapPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const missionId = params.get("mission_id") || undefined;
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const onFile = async (file: File) => {
    const lower = file.name.toLowerCase();
    if (!lower.endsWith(".tif") && !lower.endsWith(".tiff") && !lower.endsWith(".cog")) {
      setMessage("Chỉ nhận GeoTIFF/COG (.tif, .tiff, .cog).");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const job = await api<{ id: string }>("/surveys", {
        method: "POST",
        body: {
          flight_date: todayISO(),
          area_name: areaFromFile(file.name),
          cog_path: null,
          run_mock: false,
        },
      });
      await uploadFile(`/surveys/${job.id}/file`, file);
      setMessage("Đã đưa ảnh vào hàng đợi đối chiếu với địa chính.");
      navigate(`/admin/map?mission_id=${job.id}`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Không import được ảnh");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="flex h-full flex-col">
      <header className="flex shrink-0 items-start justify-between gap-4 border-b border-border-subtle bg-surface-white px-6 py-3">
        <div>
          <h1 className="text-xl font-bold">Bản đồ địa chính &amp; hiện trạng</h1>
          <p className="text-sm text-text-muted">
            Thửa đất từ FileGDB địa chính · mái nhà YOLO · nghi vấn flycam
            {missionId ? ` · đợt bay ${missionId.slice(0, 8)}…` : ""}
          </p>
          {message && <p className="mt-1 text-sm text-text-muted">{message}</p>}
        </div>
        <div>
          <button
            type="button"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
            className="bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy ? "Đang tải ảnh…" : "Import ảnh trực giao"}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".tif,.tiff,.cog"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void onFile(file);
            }}
          />
        </div>
      </header>
      <div className="relative flex flex-1 overflow-hidden">
        <PlanningMap className="flex-1" missionId={missionId} />
      </div>
    </div>
  );
}
