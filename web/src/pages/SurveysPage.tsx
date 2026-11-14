import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api, getApiBase, uploadFile } from "../api/client";
import type { SurveyJob } from "../api/types";

const STATUS_LABEL: Record<string, string> = {
  draft: "Chờ ảnh (bổ sung sau)",
  queued: "Chờ AI xử lý",
  running: "Đang chạy AI",
  done: "Xong",
  error: "Lỗi",
};

/** Uploading orthophotos only works against an API on the AI workstation, not the online demo. */
function isWorkstationApi(): boolean {
  const base = getApiBase();
  return base.includes("localhost") || base.includes("127.0.0.1");
}

export function SurveysPage() {
  const workstation = isWorkstationApi();
  const [items, setItems] = useState<SurveyJob[]>([]);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [flightDate, setFlightDate] = useState("");
  const [areaName, setAreaName] = useState("");
  const [notes, setNotes] = useState("");
  const [cogPath, setCogPath] = useState("");
  const [runMock, setRunMock] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadFor, setUploadFor] = useState<string | null>(null);
  const [helpFor, setHelpFor] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

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
    setInfo("");
    try {
      await api<SurveyJob>("/surveys", {
        method: "POST",
        body: {
          flight_date: flightDate,
          area_name: areaName,
          notes: notes.trim() || null,
          cog_path: workstation ? cogPath || null : null,
          run_mock: workstation && runMock && !cogPath,
        },
      });
      setFlightDate("");
      setAreaName("");
      setNotes("");
      setCogPath("");
      setRunMock(false);
      setInfo("Đã đăng ký đợt bay. Khi có ảnh trực giao, bấm “Bổ sung ảnh” ở dòng tương ứng.");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tạo được đợt bay");
    } finally {
      setSaving(false);
    }
  };

  const onPickFile = async (file: File) => {
    if (!uploadFor) return;
    setError("");
    setInfo("Đang tải ảnh lên máy trạm…");
    try {
      await uploadFile(`/surveys/${uploadFor}/file`, file);
      setInfo("Đã nhận ảnh, đợt bay chuyển sang chờ AI xử lý.");
      load();
    } catch (err) {
      setInfo("");
      setError(err instanceof Error ? err.message : "Không tải được ảnh");
    } finally {
      setUploadFor(null);
      if (fileRef.current) fileRef.current.value = "";
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

  const addPhotos = (id: string) => {
    if (workstation) {
      setUploadFor(id);
      fileRef.current?.click();
    } else {
      setHelpFor((cur) => (cur === id ? null : id));
    }
  };

  return (
    <div className="flex flex-1 flex-col overflow-auto p-6">
      <h1 className="text-2xl font-bold">Đợt bay flycam</h1>
      <p className="mt-1 text-sm text-text-muted">
        Mỗi đợt bay chụp ảnh trực giao (GeoTIFF). AI tách mái nhà rồi đối chiếu với thửa đất để sinh nghi vấn,
        Cán bộ Quản lý mở hồ sơ tiền kiểm từ trang Nghi vấn AI.
      </p>
      {error && <p className="mt-4 text-sm text-accent-alert">{error}</p>}
      {info && <p className="mt-4 text-sm text-primary">{info}</p>}

      <form
        onSubmit={onCreate}
        className="mt-6 grid gap-3 border border-border-subtle bg-surface-white p-4 md:grid-cols-2"
      >
        <p className="text-sm font-semibold md:col-span-2">Đăng ký đợt bay (bổ sung ảnh sau)</p>
        <label className="text-sm">
          Ngày bay (dự kiến)
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
            placeholder="Phường / xã thí điểm"
            className="mt-1 w-full border border-border-subtle px-2 py-1"
          />
        </label>
        <label className="text-sm md:col-span-2">
          Ghi chú
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Đơn vị bay, độ phân giải, phạm vi…"
            className="mt-1 w-full border border-border-subtle px-2 py-1"
          />
        </label>
        {workstation && (
          <>
            <label className="text-sm md:col-span-2">
              Đường dẫn GeoTIFF trên máy trạm (nếu đã có ảnh)
              <input
                value={cogPath}
                onChange={(e) => setCogPath(e.target.value)}
                placeholder="C:\data\ortho_2026_10.tif"
                className="mt-1 w-full border border-border-subtle px-2 py-1"
              />
            </label>
            <label className="flex items-center gap-2 text-sm md:col-span-2">
              <input type="checkbox" checked={runMock} onChange={(e) => setRunMock(e.target.checked)} />
              Chạy thử AI không cần ảnh (sinh nghi vấn mẫu) — chỉ dùng trên máy trạm
            </label>
          </>
        )}
        <button
          type="submit"
          disabled={saving}
          className="bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50 md:col-span-2 md:justify-self-start"
        >
          {saving ? "Đang lưu…" : "Đăng ký đợt bay"}
        </button>
      </form>

      <input
        ref={fileRef}
        type="file"
        accept=".tif,.tiff,.cog"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void onPickFile(f);
        }}
      />

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
              <tr key={s.id} className="border-b border-border-subtle align-top">
                <td className="p-3">{s.flight_date}</td>
                <td className="p-3">
                  {s.area_name}
                  {s.notes ? <p className="text-xs text-text-muted">{s.notes}</p> : null}
                </td>
                <td className="p-3">{STATUS_LABEL[s.status] || s.status}</td>
                <td className="p-3">{s.building_count ?? 0}</td>
                <td className="p-3">{s.violation_count ?? 0}</td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-2">
                    {s.status === "draft" && (
                      <button
                        type="button"
                        onClick={() => addPhotos(s.id)}
                        className="bg-primary px-2 py-1 text-xs font-medium text-white"
                      >
                        Bổ sung ảnh
                      </button>
                    )}
                    {s.cog_path && (s.status === "error" || s.status === "done") && (
                      <button
                        type="button"
                        onClick={() => queue(s.id)}
                        className="border border-border-strong px-2 py-1 text-xs"
                      >
                        Chạy lại AI
                      </button>
                    )}
                    {s.status !== "draft" && (
                      <>
                        <Link to={`/admin/violations?mission_id=${s.id}`} className="text-xs text-primary underline">
                          Xem nghi vấn
                        </Link>
                        <Link to={`/admin/map?mission_id=${s.id}`} className="text-xs text-primary underline">
                          Bản đồ
                        </Link>
                      </>
                    )}
                  </div>
                  {helpFor === s.id && (
                    <div className="mt-2 max-w-md border border-border-subtle bg-background-base p-2 text-xs text-text-muted">
                      Ảnh trực giao (GeoTIFF) thường nặng hàng GB nên không tải qua bản web online. Sau khi bay:
                      chép ảnh vào máy trạm AI, mở web quản trị trên máy trạm và bấm “Bổ sung ảnh” cho đợt bay này
                      (hướng dẫn chi tiết trong Sổ tay quản trị, mục Đợt bay flycam).
                    </div>
                  )}
                  {s.error && <p className="mt-1 text-xs text-accent-alert">{s.error}</p>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {items.length === 0 && <p className="p-6 text-center text-text-muted">Chưa có đợt bay</p>}
      </div>
    </div>
  );
}
