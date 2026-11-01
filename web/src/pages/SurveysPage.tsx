import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api, uploadFile } from "../api/client";
import type { SurveyJob } from "../api/types";

const STATUS_LABEL: Record<string, string> = {
  draft: "Nháp",
  queued: "Chờ xử lý",
  running: "Đang chạy YOLO",
  done: "Xong",
  error: "Lỗi",
};

export function SurveysPage() {
  const [items, setItems] = useState<SurveyJob[]>([]);
  const [error, setError] = useState("");
  const [flightDate, setFlightDate] = useState("");
  const [areaName, setAreaName] = useState("");
  const [cogPath, setCogPath] = useState("");
  const [runMock, setRunMock] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    api<SurveyJob[]>("/surveys")
      .then(setItems)
      .catch((e) => setError(e instanceof Error ? e.message : "Lỗi tải đợt bay"));
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, [load]);

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const job = await api<SurveyJob>("/surveys", {
        method: "POST",
        body: {
          flight_date: flightDate,
          area_name: areaName,
          cog_path: cogPath || null,
          run_mock: runMock && !file && !cogPath,
        },
      });
      if (file) {
        await uploadFile(`/surveys/${job.id}/file`, file);
      }
      setFlightDate("");
      setAreaName("");
      setCogPath("");
      setFile(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tạo được đợt bay");
    } finally {
      setSaving(false);
    }
  };

  const queue = async (id: string) => {
    try {
      await api(`/surveys/${id}/run`, { method: "POST" });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không chạy được");
    }
  };

  return (
    <div className="flex flex-1 flex-col overflow-auto p-6">
      <h1 className="text-2xl font-bold">Đợt bay flycam</h1>
      <p className="mt-1 text-sm text-text-muted">
        Mỗi tháng import orthophoto GeoTIFF đã nắn hình. Worker YOLO tách mái nhà rồi đối chiếu thửa đất.
      </p>
      {error && <p className="mt-4 text-sm text-accent-alert">{error}</p>}

      <form
        onSubmit={onCreate}
        className="mt-6 grid gap-3 border border-border-subtle bg-surface-white p-4 md:grid-cols-2"
      >
        <label className="text-sm">
          Ngày bay
          <input
            required
            type="date"
            value={flightDate}
            onChange={(e) => setFlightDate(e.target.value)}
            className="mt-1 w-full border border-border-subtle px-2 py-1"
          />
        </label>
        <label className="text-sm">
          Khu vực
          <input
            required
            value={areaName}
            onChange={(e) => setAreaName(e.target.value)}
            placeholder="Xã / phường thí điểm"
            className="mt-1 w-full border border-border-subtle px-2 py-1"
          />
        </label>
        <label className="text-sm md:col-span-2">
          Đường dẫn GeoTIFF trên máy chủ (tuỳ chọn)
          <input
            value={cogPath}
            onChange={(e) => setCogPath(e.target.value)}
            placeholder="C:\data\ortho_2026_10.tif"
            className="mt-1 w-full border border-border-subtle px-2 py-1"
          />
        </label>
        <label className="text-sm md:col-span-2">
          Hoặc tải GeoTIFF/COG
          <input
            type="file"
            accept=".tif,.tiff,.cog"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="mt-1 w-full text-sm"
          />
        </label>
        <label className="flex items-center gap-2 text-sm md:col-span-2">
          <input
            type="checkbox"
            checked={runMock}
            onChange={(e) => setRunMock(e.target.checked)}
          />
          Chạy mock (không có ảnh / chưa có file ONNX) — vẫn sinh nghi vấn từ thửa mẫu
        </label>
        <button
          type="submit"
          disabled={saving}
          className="bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {saving ? "Đang lưu…" : "Tạo đợt bay"}
        </button>
      </form>

      <div className="mt-6 overflow-x-auto border border-border-subtle bg-surface-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border-subtle bg-background-base text-xs uppercase tracking-wide text-text-muted">
            <tr>
              <th className="p-3">Ngày bay</th>
              <th className="p-3">Khu vực</th>
              <th className="p-3">Trạng thái</th>
              <th className="p-3">Mái nhà</th>
              <th className="p-3">Nghi vấn</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((s) => (
              <tr key={s.id} className="border-b border-border-subtle">
                <td className="p-3">{s.flight_date}</td>
                <td className="p-3">{s.area_name}</td>
                <td className="p-3">{STATUS_LABEL[s.status] || s.status}</td>
                <td className="p-3">{s.building_count ?? 0}</td>
                <td className="p-3">{s.violation_count ?? 0}</td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-2">
                    {(s.status === "draft" || s.status === "error" || s.status === "done") && (
                      <button
                        type="button"
                        onClick={() => queue(s.id)}
                        className="border border-border-strong px-2 py-1 text-xs"
                      >
                        Chạy lại
                      </button>
                    )}
                    <Link
                      to={`/admin/violations?mission_id=${s.id}`}
                      className="text-xs text-primary underline"
                    >
                      Xem nghi vấn
                    </Link>
                    <Link
                      to={`/admin/map?mission_id=${s.id}`}
                      className="text-xs text-primary underline"
                    >
                      Bản đồ
                    </Link>
                  </div>
                  {s.error && <p className="mt-1 text-xs text-accent-alert">{s.error}</p>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {items.length === 0 && (
          <p className="p-6 text-center text-text-muted">Chưa có đợt bay</p>
        )}
      </div>
    </div>
  );
}
