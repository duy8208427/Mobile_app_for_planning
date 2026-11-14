import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchCase, fetchCatalog } from "../api/client";
import type { CaseDetail, ViolationCatalog } from "../api/types";
import { CaseActionPanel } from "../components/CaseActions";
import { InfoGrid, Notice, PhotoGrid, Section } from "../components/CaseUi";
import {
  AI_RULE_LABEL,
  ROLE_LABEL,
  SOURCE_LABEL,
  errMsg,
  findViolation,
  formatDate,
  formatDateTime,
  formatVnd,
} from "../lib/caseUtils";

const PERMIT_STATUS: Record<string, string> = {
  waiting: "Đang chờ cấp phép",
  granted: "Đã có giấy phép",
  expired: "Hết hạn / không được cấp phép",
};

const REINSPECTION_KIND: Record<string, string> = {
  permit_check: "Kiểm tra sau cấp phép (5 ngày)",
  post_remediation: "Hậu kiểm sau khắc phục",
};

function byLine(name?: string | null, role?: string | null, at?: string | null) {
  if (!name && !at) return null;
  return (
    <p className="mt-3 text-xs text-text-muted">
      {name}
      {role ? ` (${ROLE_LABEL[role] || role})` : ""}
      {at ? ` · ${formatDateTime(at)}` : ""}
    </p>
  );
}

function PhaseStepper({ c, catalog }: { c: CaseDetail; catalog: ViolationCatalog }) {
  const final = catalog.statuses[c.status]?.final;
  return (
    <div>
      <ol className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {Object.entries(catalog.phases).map(([k, label]) => {
          const n = Number(k);
          const state =
            n < c.phase || (final && n === c.phase) ? "done" : n === c.phase ? "current" : "todo";
          return (
            <li
              key={k}
              className={`border px-3 py-2 text-xs ${
                state === "current"
                  ? "border-primary bg-primary text-white"
                  : state === "done"
                  ? "border-accent-success bg-green-50"
                  : "border-border-subtle bg-surface-white text-text-muted"
              }`}
            >
              <span className="font-semibold">Giai đoạn {k}</span>
              <span className="block">{label}</span>
            </li>
          );
        })}
      </ol>
      <p className="mt-3 text-sm">
        <span className="font-semibold">
          Bước {c.step}/16:
        </span>{" "}
        {catalog.steps[String(c.step)] || ""}
      </p>
    </div>
  );
}

export function CaseDetailPage() {
  const { id = "" } = useParams();
  const [c, setCase] = useState<CaseDetail | null>(null);
  const [catalog, setCatalog] = useState<ViolationCatalog | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    setError("");
    fetchCase(id)
      .then(setCase)
      .catch((e) => setError(errMsg(e, "Lỗi tải hồ sơ")));
  }, [id]);

  useEffect(() => {
    load();
    fetchCatalog()
      .then(setCatalog)
      .catch((e) => setError(errMsg(e, "Lỗi tải danh mục")));
  }, [load]);

  if (error && !c) {
    return (
      <div className="p-6">
        <Link to="/admin/cases" className="text-sm text-primary">
          ← Hồ sơ vụ việc
        </Link>
        <p className="mt-4 text-sm text-accent-alert">{error}</p>
      </div>
    );
  }
  if (!c || !catalog) {
    return <p className="p-6 text-text-muted">Đang tải hồ sơ…</p>;
  }

  const vName = (code?: string | null) => findViolation(catalog, code)?.name || code || "—";
  const ins = c.inspection;
  const dec = c.decision;
  const pt = c.permit_track;
  const rem = c.remediation;
  const re = c.reinspection;
  const timeline = c.timeline || [];

  return (
    <div className="flex flex-1 flex-col overflow-auto p-6">
      <Link to="/admin/cases" className="text-sm text-primary">
        ← Hồ sơ vụ việc
      </Link>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-sm font-semibold text-primary">{c.code}</p>
          <h1 className="text-2xl font-bold">{c.title}</h1>
          <p className="mt-1 text-sm text-text-muted">
            Nguồn: {SOURCE_LABEL[c.source] || c.source} · Tạo lúc {formatDateTime(c.created_at)}
          </p>
        </div>
        <div className="text-right">
          <span className="inline-block border border-border-strong px-3 py-1 text-sm font-semibold">
            {c.status_label}
          </span>
          {c.deadline && (
            <p className={`mt-1 text-xs ${c.overdue ? "font-semibold text-accent-alert" : "text-text-muted"}`}>
              Hạn: {formatDate(c.deadline)}
              {c.overdue ? " — quá hạn" : ""}
            </p>
          )}
        </div>
      </div>

      <div className="mt-4">
        <PhaseStepper c={c} catalog={catalog} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_26rem]">
        <div className="space-y-4">
          <Section title="Thông tin tiếp nhận">
            <InfoGrid
              rows={[
                ["Người phản ánh", c.reporter_name],
                ["Quy tắc AI", c.ai_rule ? AI_RULE_LABEL[c.ai_rule] || c.ai_rule : null],
                ["Gợi ý hành vi", c.suggested_code ? vName(c.suggested_code) : null],
                ["Mô tả", c.description],
                ["Địa chỉ", c.address],
                [
                  "Tờ / Thửa",
                  c.so_to || c.so_thua ? `${c.so_to || "—"} / ${c.so_thua || "—"}` : null,
                ],
                ["Loại đất", c.loai_dat],
                ["Diện tích", c.area_m2 != null ? `${c.area_m2} m²` : null],
                [
                  "Toạ độ",
                  c.latitude != null && c.longitude != null
                    ? `${c.latitude.toFixed(5)}, ${c.longitude.toFixed(5)}`
                    : null,
                ],
              ]}
            />
            <PhotoGrid photos={c.photos} label="Ảnh phản ánh" />
          </Section>

          {c.precheck && (
            <Section title="Tiền kiểm">
              <InfoGrid
                rows={[
                  [
                    "Kết quả",
                    c.precheck.result === "violation" ? (
                      <span className="font-semibold text-accent-alert">Có dấu hiệu vi phạm</span>
                    ) : (
                      <span className="font-semibold text-accent-success">Không vi phạm</span>
                    ),
                  ],
                  ["Hành vi", c.precheck.violation_code ? vName(c.precheck.violation_code) : null],
                  ["Ghi chú", c.precheck.notes],
                ]}
              />
              {byLine(c.precheck.by_name, c.precheck.by_role, c.precheck.at)}
            </Section>
          )}

          {c.assignment?.officer_name && (
            <Section title="Phiếu giao việc">
              <InfoGrid
                rows={[
                  ["Cán bộ Xử lý", c.assignment.officer_name],
                  ["Hạn kiểm tra", formatDate(c.assignment.due_date)],
                  ["Chỉ đạo", c.assignment.instructions],
                ]}
              />
              {byLine(c.assignment.by_name, c.assignment.by_role, c.assignment.at)}
            </Section>
          )}

          {ins?.record_no && (
            <Section title="Biên bản hiện trường">
              <InfoGrid
                rows={[
                  ["Số biên bản", ins.record_no],
                  ["Nội dung", ins.description],
                  ["Diện tích vi phạm", ins.area_m2 != null ? `${ins.area_m2} m²` : null],
                  ["Hành vi", c.violation_code ? vName(c.violation_code) : null],
                  ["Loại công trình", c.work_type ? `${c.work_type}) ${catalog.work_types[c.work_type]}` : null],
                  [
                    "Tình trạng",
                    c.construction_state ? catalog.construction_states[c.construction_state] : null,
                  ],
                  [
                    "Yêu cầu dừng thi công",
                    ins.stop_order ? (
                      <span className="font-semibold text-accent-alert">Đã yêu cầu chấm dứt hành vi vi phạm</span>
                    ) : null,
                  ],
                  ["Gửi lúc", ins.submitted_at ? formatDateTime(ins.submitted_at) : null],
                ]}
              />
              {c.violator && (
                <div className="mt-4 border-t border-border-subtle pt-3">
                  <p className="mb-2 text-xs font-semibold uppercase text-text-muted">Người vi phạm</p>
                  <InfoGrid
                    rows={[
                      ["Họ tên / Tên", c.violator.name],
                      [
                        "Đối tượng",
                        c.violator.subject_type ? catalog.subject_types[c.violator.subject_type] : null,
                      ],
                      ["Điện thoại", c.violator.phone],
                      ["Địa chỉ", c.violator.address],
                    ]}
                  />
                </div>
              )}
              <PhotoGrid photos={ins.photos} label="Ảnh bằng chứng" />
              {byLine(ins.by_name, ins.by_role, ins.at)}
            </Section>
          )}

          {c.repeat && (
            <Section title="Tiếp tục thi công sau biên bản">
              <Notice tone="warning">
                {c.repeat.clause === "k12"
                  ? "Tiếp tục vi phạm sau khi đã có quyết định xử phạt (khoản 12 Điều 25)."
                  : "Tiếp tục vi phạm sau khi đã lập biên bản, trước khi ra quyết định (khoản 11 Điều 25)."}
              </Notice>
              {c.repeat.note && <p className="mt-2 whitespace-pre-wrap">{c.repeat.note}</p>}
            </Section>
          )}

          {dec?.decision_no && (
            <Section title="Quyết định xử phạt">
              <InfoGrid
                rows={[
                  ["Số quyết định", dec.decision_no],
                  ["Ngày ban hành", formatDate(dec.issued_date)],
                  ["Hành vi", vName(dec.violation_code)],
                  ["Căn cứ", dec.legal_basis],
                  [
                    "Đối tượng / loại CT",
                    `${dec.subject_type ? catalog.subject_types[dec.subject_type] : "—"} · loại ${dec.work_type || "—"}`,
                  ],
                  [
                    "Mức phạt",
                    <span>
                      <strong>{formatVnd(dec.fine_amount)}</strong>
                      {dec.fine_min != null && dec.fine_max != null && (
                        <span className="text-text-muted">
                          {" "}
                          (khung {formatVnd(dec.fine_min).replace(" đồng", "")} – {formatVnd(dec.fine_max)})
                        </span>
                      )}
                    </span>,
                  ],
                  ["Biện pháp khắc phục", dec.remedy],
                  ["Hạn khắc phục", dec.remedy_deadline ? formatDate(dec.remedy_deadline) : null],
                  ["Hình thức bổ sung", dec.extra_penalties],
                ]}
              />
              {dec.exceeds_commune_authority && (
                <div className="mt-3">
                  <Notice tone="alert">Mức phạt vượt thẩm quyền Chủ tịch UBND cấp xã.</Notice>
                </div>
              )}
              {byLine(dec.by_name, dec.by_role, dec.at)}
            </Section>
          )}

          {pt?.deadline && (
            <Section title="Theo dõi cấp phép (Điều 85)">
              <InfoGrid
                rows={[
                  ["Trạng thái", pt.status ? PERMIT_STATUS[pt.status] || pt.status : null],
                  [
                    "Hạn xin cấp phép",
                    <span>
                      <strong>{formatDate(pt.deadline)}</strong>
                      {pt.days ? <span className="text-text-muted"> ({pt.days} ngày)</span> : null}
                    </span>,
                  ],
                  ["Số giấy phép", pt.permit_no],
                  ["Nộp lúc", pt.submitted_at ? formatDateTime(pt.submitted_at) : null],
                ]}
              />
            </Section>
          )}

          {rem && (
            <Section title="Khắc phục">
              <InfoGrid
                rows={[
                  [
                    "Nộp phạt",
                    rem.fine_paid ? (
                      <span className="text-accent-success">Đã nộp</span>
                    ) : (
                      <span className="text-accent-alert">Chưa nộp</span>
                    ),
                  ],
                  ["Ghi chú", rem.notes],
                ]}
              />
              <PhotoGrid photos={rem.receipt_photo ? [rem.receipt_photo] : []} label="Biên lai" />
              <PhotoGrid photos={rem.photos} label="Ảnh sau khắc phục" />
              {byLine(rem.by_name, rem.by_role, rem.at)}
            </Section>
          )}

          {re && (
            <Section title="Hậu kiểm">
              <InfoGrid
                rows={[
                  ["Loại", re.kind ? REINSPECTION_KIND[re.kind] || re.kind : null],
                  ["Hạn", formatDate(re.due_date)],
                  [
                    "Kết quả",
                    re.result === "pass" ? (
                      <span className="font-semibold text-accent-success">Đạt</span>
                    ) : re.result === "fail" ? (
                      <span className="font-semibold text-accent-alert">Không đạt</span>
                    ) : (
                      "Đang chờ"
                    ),
                  ],
                  ["Ghi chú", re.notes],
                  ["Cán bộ", re.by_name],
                  ["Hoàn thành", re.done_at ? formatDateTime(re.done_at) : null],
                ]}
              />
              <PhotoGrid photos={re.photos} label="Ảnh hậu kiểm" />
            </Section>
          )}

          {c.closed && (
            <Section title="Đóng hồ sơ">
              <InfoGrid rows={[["Lý do", c.closed.reason]]} />
              {byLine(c.closed.by_name, c.closed.by_role, c.closed.at)}
            </Section>
          )}
        </div>

        <div className="space-y-4">
          <CaseActionPanel c={c} catalog={catalog} onUpdated={(updated) => {
              setCase(updated);
              load();
            }} />

          <Section title="Dòng thời gian">
            {timeline.length === 0 ? (
              <p className="text-text-muted">Chưa có sự kiện.</p>
            ) : (
              <ol className="space-y-3">
                {timeline.map((t, i) => (
                  <li key={i} className="border-l-2 border-primary pl-3">
                    <p className="text-xs text-text-muted">
                      Bước {t.step} · {formatDateTime(t.at)}
                    </p>
                    <p className="font-medium">{t.label}</p>
                    {(t.by_name || t.by_role) && (
                      <p className="text-xs text-text-muted">
                        {t.by_name}
                        {t.by_role ? ` — ${ROLE_LABEL[t.by_role] || t.by_role}` : ""}
                      </p>
                    )}
                    {t.note && <p className="mt-1 whitespace-pre-wrap text-sm">{t.note}</p>}
                  </li>
                ))}
              </ol>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}
