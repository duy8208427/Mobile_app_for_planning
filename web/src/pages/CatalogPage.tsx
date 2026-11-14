import { useEffect, useState } from "react";
import { fetchCatalog } from "../api/client";
import type { ViolationCatalog, WorkType } from "../api/types";
import { Notice } from "../components/CaseUi";
import { errMsg, fineRange, formatVnd, formatRangeShort, sortedViolations } from "../lib/caseUtils";

const WORK_TYPES: WorkType[] = ["a", "b", "c", "d"];

export function CatalogPage() {
  const [catalog, setCatalog] = useState<ViolationCatalog | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchCatalog()
      .then(setCatalog)
      .catch((e) => setError(errMsg(e, "Lỗi tải danh mục")));
  }, []);

  return (
    <div className="flex flex-1 flex-col overflow-auto p-6">
      <h1 className="text-2xl font-bold">Danh mục vi phạm</h1>
      <p className="mt-1 text-sm text-text-muted">
        5 hành vi trọng tâm theo Điều 25 Nghị định 339/2026/NĐ-CP.
      </p>
      {error && <p className="mt-4 text-sm text-accent-alert">{error}</p>}
      {catalog && (
        <>
          <div className="mt-4">
            <Notice tone="info">{catalog.legal_note}</Notice>
          </div>

          <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
            <div className="border border-border-subtle bg-surface-white p-4">
              <p className="text-xs font-semibold uppercase text-text-muted">Loại công trình</p>
              <ul className="mt-2 space-y-1">
                {WORK_TYPES.map((k) => (
                  <li key={k}>
                    <span className="font-semibold">{k})</span> {catalog.work_types[k]}
                  </li>
                ))}
              </ul>
            </div>
            <div className="border border-border-subtle bg-surface-white p-4">
              <p className="text-xs font-semibold uppercase text-text-muted">Quy định chung</p>
              <ul className="mt-2 list-inside list-disc space-y-1">
                <li>Mức phạt trong Nghị định áp dụng cho tổ chức; cá nhân bằng 1/2.</li>
                <li>
                  Thẩm quyền Chủ tịch UBND cấp xã: tối đa {formatVnd(catalog.authority_limit.to_chuc)} (tổ
                  chức), {formatVnd(catalog.authority_limit.ca_nhan)} (cá nhân).
                </li>
                <li>
                  Điều 85: không phép/sai phép đang thi công có {catalog.permit_days.house} ngày (nhà ở
                  riêng lẻ) hoặc {catalog.permit_days.project} ngày (công trình khác) để xin cấp/điều chỉnh
                  giấy phép; hết hạn buộc phá dỡ trong {catalog.permit_days.demolish} ngày.
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-6 overflow-x-auto border border-border-subtle bg-surface-white">
            <table className="w-full min-w-[64rem] text-left text-sm">
              <thead className="border-b border-border-subtle bg-background-base text-xs uppercase tracking-wide text-text-muted">
                <tr>
                  <th className="p-3" rowSpan={2}>
                    Hành vi
                  </th>
                  <th className="p-3" rowSpan={2}>
                    Căn cứ
                  </th>
                  <th className="border-l border-border-subtle p-3 text-center" colSpan={4}>
                    Tổ chức
                  </th>
                  <th className="border-l border-border-subtle p-3 text-center" colSpan={4}>
                    Cá nhân
                  </th>
                  <th className="border-l border-border-subtle p-3" rowSpan={2}>
                    Biện pháp khắc phục
                  </th>
                </tr>
                <tr>
                  {["to_chuc", "ca_nhan"].map((s) =>
                    WORK_TYPES.map((wt, i) => (
                      <th
                        key={`${s}-${wt}`}
                        className={`p-2 text-center ${i === 0 ? "border-l border-border-subtle" : ""}`}
                        title={catalog.work_types[wt]}
                      >
                        {wt}
                      </th>
                    ))
                  )}
                </tr>
              </thead>
              <tbody>
                {sortedViolations(catalog).map((v) => (
                  <tr key={v.code} className="border-b border-border-subtle align-top">
                    <td className="max-w-xs p-3">
                      <p className="font-semibold">
                        {v.order}. {v.name}
                      </p>
                      <p className="mt-1 text-xs text-text-muted">{v.behavior}</p>
                      <p className="mt-1 font-mono text-[10px] text-text-muted">{v.code}</p>
                      {v.permit_track && (
                        <span className="mt-1 inline-block border border-accent-warning px-1.5 text-[10px] font-medium text-accent-warning">
                          Điều 85
                        </span>
                      )}
                    </td>
                    <td className="max-w-[12rem] p-3 text-xs">{v.legal_basis}</td>
                    {(["to_chuc", "ca_nhan"] as const).map((s) =>
                      WORK_TYPES.map((wt, i) => (
                        <td
                          key={`${s}-${wt}`}
                          className={`whitespace-nowrap p-2 text-center text-xs ${
                            i === 0 ? "border-l border-border-subtle" : ""
                          }`}
                        >
                          {formatRangeShort(fineRange(v, wt, s))}
                        </td>
                      ))
                    )}
                    <td className="max-w-xs border-l border-border-subtle p-3 text-xs">
                      {v.remedy}
                      {v.extra_penalties && (
                        <p className="mt-2">
                          <span className="font-semibold">Hình thức bổ sung: </span>
                          {v.extra_penalties}
                        </p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
