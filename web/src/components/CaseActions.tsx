import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { fetchOfficers, fetchPrecheckContext, runCaseAction } from "../api/client";
import type {
  CaseAction,
  CaseDetail,
  CaseOfficer,
  ConstructionState,
  PrecheckContext,
  SubjectType,
  ViolationCatalog,
  WorkType,
} from "../api/types";
import {
  AI_RULE_LABEL,
  compressImage,
  errMsg,
  findViolation,
  fineRange,
  formatDate,
  formatVnd,
  isoDatePlus,
  sortedViolations,
} from "../lib/caseUtils";
import { InfoGrid, Notice, PhotoGrid, dangerBtn, inputCls, primaryBtn } from "./CaseUi";

const OFFICER_ONLY: CaseAction[] = ["accept", "submit_record", "reinspect"];

interface FormProps {
  c: CaseDetail;
  catalog: ViolationCatalog;
  submit: (action: CaseAction, payload: unknown) => Promise<void>;
  busy: boolean;
}

/** Bảng thao tác: một biểu mẫu cho mỗi phần tử trong available_actions. */
export function CaseActionPanel({
  c,
  catalog,
  onUpdated,
}: {
  c: CaseDetail;
  catalog: ViolationCatalog;
  onUpdated: (updated: CaseDetail) => void;
}) {
  const actions = c.available_actions.filter((a) => !OFFICER_ONLY.includes(a));
  const officerActions = c.available_actions.filter((a) => OFFICER_ONLY.includes(a));
  const [open, setOpen] = useState<CaseAction | null>(actions[0] ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  useEffect(() => {
    setOpen(actions[0] ?? null);
    setError("");
  }, [c.status, c.available_actions.join(",")]);

  const submit = async (action: CaseAction, payload: unknown) => {
    setBusy(true);
    setError("");
    setDone("");
    try {
      const updated = await runCaseAction(c.id, action, payload);
      setDone(`Đã thực hiện: ${catalog.actions[action]?.label || action}`);
      onUpdated(updated);
    } catch (e) {
      setError(errMsg(e, "Thao tác thất bại"));
    } finally {
      setBusy(false);
    }
  };

  const props: FormProps = { c, catalog, submit, busy };

  return (
    <section className="border border-border-strong bg-surface-white">
      <div className="border-b border-border-subtle bg-background-base px-4 py-2.5">
        <h2 className="text-sm font-semibold uppercase tracking-wide">Thao tác của Cán bộ Quản lý</h2>
      </div>
      <div className="space-y-3 p-4 text-sm">
        {done && <Notice tone="success">{done}</Notice>}
        {error && <Notice tone="alert">{error}</Notice>}
        {actions.length === 0 && (
          <p className="text-text-muted">
            {officerActions.length > 0
              ? "Hồ sơ đang chờ Cán bộ Xử lý thực hiện trên ứng dụng di động."
              : "Không có thao tác nào ở bước hiện tại."}
          </p>
        )}
        {actions.length === 0 && c.status === "dang_kiem_tra" && (
          <p className="text-xs text-text-muted">Cán bộ Xử lý đang kiểm tra thực địa, lập biên bản.</p>
        )}
        {actions.map((a) => {
          const meta = catalog.actions[a];
          const isOpen = open === a;
          return (
            <div key={a} className="border border-border-subtle">
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : a)}
                className={`flex w-full items-center justify-between px-3 py-2 text-left font-medium ${
                  isOpen ? "bg-primary text-white" : "hover:bg-background-base"
                }`}
                data-testid={`case-action-${a}`}
              >
                <span>
                  {meta?.label || a}
                  {meta?.step ? (
                    <span className={`ml-2 text-xs ${isOpen ? "text-white/80" : "text-text-muted"}`}>
                      Bước {meta.step}
                    </span>
                  ) : null}
                </span>
                <span aria-hidden>{isOpen ? "−" : "+"}</span>
              </button>
              {isOpen && (
                <div className="border-t border-border-subtle p-3">
                  <ActionForm action={a} {...props} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ActionForm({ action, ...p }: FormProps & { action: CaseAction }) {
  switch (action) {
    case "precheck":
      return <PrecheckForm {...p} />;
    case "assign":
      return <AssignForm {...p} />;
    case "return_record":
      return (
        <NoteForm
          {...p}
          action="return_record"
          label="Nội dung cần bổ sung (bắt buộc)"
          required
          button="Trả lại biên bản"
        />
      );
    case "decide":
      return <DecideForm {...p} />;
    case "report_continuing":
      return <ContinuingForm {...p} />;
    case "submit_permit":
      return <SubmitPermitForm {...p} />;
    case "permit_expired":
      return <PermitExpiredForm {...p} />;
    case "report_remediation":
      return <RemediationForm {...p} />;
    case "request_reinspection":
      return <ReinspectionForm {...p} />;
    case "close":
      return (
        <NoteForm
          {...p}
          action="close"
          label="Ghi chú đóng hồ sơ"
          placeholder="Đã khắc phục, đóng hồ sơ lưu trữ"
          button="Đóng hồ sơ lưu trữ"
        />
      );
    default:
      return <p className="text-text-muted">Thao tác này chưa được hỗ trợ trên web.</p>;
  }
}

function Label({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <span className="block text-sm font-medium">
      {children}
      {hint && <span className="ml-1 text-xs font-normal text-text-muted">{hint}</span>}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Bước 3: Tiền kiểm
// ---------------------------------------------------------------------------

function pickStr(obj: Record<string, unknown> | null | undefined, ...keys: string[]): string | null {
  if (!obj) return null;
  for (const k of keys) {
    const v = obj[k];
    if (v !== null && v !== undefined && v !== "") return String(v);
  }
  return null;
}

function primitiveEntries(obj: Record<string, unknown>, limit = 10): [string, string][] {
  return Object.entries(obj)
    .filter(([k, v]) => k !== "geometry" && k !== "id" && v !== null && v !== "" && typeof v !== "object")
    .slice(0, limit)
    .map(([k, v]) => [k, typeof v === "boolean" ? (v ? "Có" : "Không") : String(v)]);
}

function PrecheckForm({ c, catalog, submit, busy }: FormProps) {
  const [ctx, setCtx] = useState<PrecheckContext | null>(null);
  const [ctxError, setCtxError] = useState("");
  const [result, setResult] = useState<"violation" | "no_violation">("violation");
  const [code, setCode] = useState(c.violation_code || c.suggested_code || "");
  const [note, setNote] = useState("");

  useEffect(() => {
    fetchPrecheckContext(c.id)
      .then((d) => {
        setCtx(d);
        if (d.suggested_code) setCode((cur) => cur || d.suggested_code || "");
      })
      .catch((e) => setCtxError(errMsg(e, "Lỗi tải dữ liệu đối chiếu")));
  }, [c.id]);

  const suggested = ctx?.suggested_code || c.suggested_code;
  const parcel = ctx?.parcel;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const payload: Record<string, unknown> = { result };
    if (result === "violation" && code) payload.violation_code = code;
    if (note.trim()) payload.note = note.trim();
    submit("precheck", payload);
  };

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <p className="text-xs text-text-muted">
        Đối chiếu bản đồ địa chính, quy hoạch và dữ liệu giấy phép trước khi giao việc.
      </p>
      {ctxError && <Notice tone="alert">{ctxError}</Notice>}
      {!ctx && !ctxError && <p className="text-text-muted">Đang tải dữ liệu đối chiếu…</p>}
      {ctx && (
        <div className="space-y-3">
          <div className="border border-border-subtle bg-background-base p-3">
            <p className="mb-2 text-xs font-semibold uppercase text-text-muted">Thửa đất</p>
            {parcel ? (
              <InfoGrid
                rows={[
                  ["Tờ / Thửa", `${pickStr(parcel, "so_to", "SoTo") || "—"} / ${pickStr(parcel, "so_thua", "SoThua") || "—"}`],
                  ["Loại đất", pickStr(parcel, "loai_dat", "KyHieuLoaiDat")],
                  ["Diện tích", pickStr(parcel, "DienTich", "dien_tich") ? `${pickStr(parcel, "DienTich", "dien_tich")} m²` : null],
                  [
                    "Được phép xây",
                    parcel.allow_build === undefined ? null : parcel.allow_build ? "Có" : "Không",
                  ],
                ]}
              />
            ) : (
              <p className="text-text-muted">Không tìm thấy thửa đất tại vị trí hồ sơ.</p>
            )}
          </div>
          <div className="border border-border-subtle bg-background-base p-3">
            <p className="mb-2 text-xs font-semibold uppercase text-text-muted">Quy hoạch</p>
            {ctx.zone ? (
              <>
                <InfoGrid
                  rows={[
                    ["Quy hoạch tại vị trí", `${ctx.zone.zone_code ?? "—"} — ${ctx.zone.zone_name ?? ""}`],
                    ["Năm quy hoạch", ctx.zone.plan_year ? String(ctx.zone.plan_year) : null],
                    ["Hiện trạng (thửa)", ctx.plan_check?.current_use ?? null],
                    ["Cho phép xây nhà ở", ctx.zone.allow_build ? "Có (đất ở)" : "Không"],
                  ]}
                />
                {ctx.plan_check && !ctx.plan_check.housing_allowed && (
                  <p className="mt-2 text-xs font-semibold text-alert">
                    Vị trí không thuộc quy hoạch đất ở: công trình nhà ở mới có dấu hiệu xây dựng không đúng quy hoạch.
                  </p>
                )}
              </>
            ) : (
              <p className="text-text-muted">Vị trí không nằm trong vùng quy hoạch đã nạp.</p>
            )}
          </div>
          <div className="border border-border-subtle bg-background-base p-3">
            <p className="mb-2 text-xs font-semibold uppercase text-text-muted">Giấy phép xây dựng</p>
            {!ctx.permits_loaded ? (
              <p className="text-text-muted">Chưa có dữ liệu giấy phép, sẽ nạp khi có file.</p>
            ) : ctx.permits.length === 0 ? (
              <p>Không tìm thấy giấy phép cho thửa đất này.</p>
            ) : (
              <ul className="space-y-2">
                {ctx.permits.map((pm, i) => (
                  <li key={i} className="border-b border-border-subtle pb-2 last:border-0">
                    {pm.is_demo ? (
                      <p className="mb-1 text-xs font-semibold text-warning">Dữ liệu mẫu để demo</p>
                    ) : null}
                    <InfoGrid rows={primitiveEntries(pm, 7)} />
                  </li>
                ))}
              </ul>
            )}
          </div>
          {ctx.duplicates.length > 0 && (
            <Notice tone="warning">
              <p className="font-semibold">Thửa đất đã có hồ sơ đang mở:</p>
              <ul className="mt-1 list-inside list-disc">
                {ctx.duplicates.map((d) => (
                  <li key={d.id}>
                    <Link to={`/admin/cases/${d.id}`} className="font-mono text-primary underline">
                      {d.code}
                    </Link>{" "}
                    — {catalog.statuses[d.status]?.label || d.status}
                  </li>
                ))}
              </ul>
            </Notice>
          )}
        </div>
      )}

      {c.ai_rule && (
        <p className="text-xs text-text-muted">
          Quy tắc AI: {AI_RULE_LABEL[c.ai_rule] || c.ai_rule}
        </p>
      )}
      {suggested && (
        <Notice tone="info">
          Gợi ý hành vi: <strong>{findViolation(catalog, suggested)?.name || suggested}</strong>
          {ctx?.suggestion_reason ? <span className="block text-xs">{ctx.suggestion_reason}</span> : null}
        </Notice>
      )}

      <fieldset className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="precheck-result"
            checked={result === "violation"}
            onChange={() => setResult("violation")}
          />
          Có vi phạm
        </label>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="precheck-result"
            checked={result === "no_violation"}
            onChange={() => setResult("no_violation")}
          />
          Không vi phạm (đóng hồ sơ)
        </label>
      </fieldset>
      {result === "violation" && (
        <label className="block">
          <Label hint="(Cán bộ Xử lý có thể điều chỉnh khi lập biên bản)">Hành vi nghi vi phạm</Label>
          <select value={code} onChange={(e) => setCode(e.target.value)} className={inputCls}>
            <option value="">— Chưa xác định —</option>
            {sortedViolations(catalog).map((v) => (
              <option key={v.code} value={v.code}>
                {v.order}. {v.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="block">
        <Label>Ghi chú</Label>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} className={inputCls} />
      </label>
      <button
        type="submit"
        disabled={busy}
        className={result === "violation" ? primaryBtn : dangerBtn}
      >
        {busy ? "Đang lưu…" : result === "violation" ? "Xác nhận nghi vấn vi phạm" : "Đóng: không vi phạm"}
      </button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Bước 5: Giao việc
// ---------------------------------------------------------------------------

function useOfficers() {
  const [officers, setOfficers] = useState<CaseOfficer[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    fetchOfficers()
      .then(setOfficers)
      .catch((e) => setError(errMsg(e, "Lỗi tải danh sách cán bộ")));
  }, []);
  return { officers, error };
}

function AssignForm({ c, submit, busy }: FormProps) {
  const { officers, error } = useOfficers();
  const [officerId, setOfficerId] = useState(c.assignment?.officer_id || "");
  const [due, setDue] = useState(isoDatePlus(3));
  const [instructions, setInstructions] = useState("");

  useEffect(() => {
    if (!officerId && officers.length > 0) setOfficerId(officers[0].id);
  }, [officers, officerId]);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    submit("assign", {
      officer_id: officerId,
      due_date: due,
      ...(instructions.trim() ? { instructions: instructions.trim() } : {}),
    });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      {error && <Notice tone="alert">{error}</Notice>}
      <label className="block">
        <Label>Cán bộ Xử lý</Label>
        <select
          value={officerId}
          onChange={(e) => setOfficerId(e.target.value)}
          className={inputCls}
          required
        >
          <option value="" disabled>
            — Chọn cán bộ —
          </option>
          {officers.map((o) => (
            <option key={o.id} value={o.id}>
              {o.full_name}
              {o.phone ? ` · ${o.phone}` : ""}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <Label>Hạn kiểm tra thực địa</Label>
        <input
          type="date"
          value={due}
          min={isoDatePlus(0)}
          onChange={(e) => setDue(e.target.value)}
          className={inputCls}
          required
        />
      </label>
      <label className="block">
        <Label>Chỉ đạo / yêu cầu</Label>
        <textarea
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          rows={3}
          className={inputCls}
          placeholder="VD: Kiểm tra giấy phép, đo đạc phần lấn chiếm…"
        />
      </label>
      <button type="submit" disabled={busy || !officerId} className={primaryBtn}>
        {busy ? "Đang lưu…" : "Lập phiếu giao việc"}
      </button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Bước 9–10: Quyết định xử phạt
// ---------------------------------------------------------------------------

function DecideForm({ c, catalog, submit, busy }: FormProps) {
  const [code, setCode] = useState(
    c.violation_code || c.precheck?.violation_code || c.suggested_code || ""
  );
  const [workType, setWorkType] = useState<WorkType>(c.work_type || "a");
  const [subject, setSubject] = useState<SubjectType>(
    c.subject_type || c.violator?.subject_type || "ca_nhan"
  );
  const [state, setState] = useState<ConstructionState>(c.construction_state || "dang_thi_cong");
  const entry = findViolation(catalog, code);
  const range = fineRange(entry, workType, subject, code === "TIEP_TUC_SAU_BIEN_BAN" && c.repeat?.clause === "k12");
  const [amount, setAmount] = useState<string>("");
  const [remedy, setRemedy] = useState(entry?.remedy || "");
  const [extra, setExtra] = useState(entry?.extra_penalties || "");
  const [remedyDeadline, setRemedyDeadline] = useState(isoDatePlus(catalog.permit_days.demolish));
  const [decisionNo, setDecisionNo] = useState("");

  // Khi đổi hành vi: điền lại biện pháp khắc phục, hình thức bổ sung theo danh mục.
  useEffect(() => {
    setRemedy(entry?.remedy || "");
    setExtra(entry?.extra_penalties || "");
  }, [entry?.code]);

  // Khi đổi khung phạt: gợi ý mức tối thiểu.
  useEffect(() => {
    if (range) setAmount(String(range.min));
  }, [range?.min, range?.max]);

  const amountNum = Number(amount.replace(/[^\d]/g, ""));
  const outOfRange = !!range && !!amount && (amountNum < range.min || amountNum > range.max);
  const limit = catalog.authority_limit[subject];
  const overAuthority = !!amount && amountNum > limit;
  const isRepeatK12 = c.repeat?.clause === "k12" && code === "TIEP_TUC_SAU_BIEN_BAN";

  const permitTrack = !!entry?.permit_track && state === "dang_thi_cong";
  const permitDays =
    workType === "c" || workType === "d" ? catalog.permit_days.project : catalog.permit_days.house;

  const canSubmit =
    !!code && !!decisionNo.trim() && !!amount && !outOfRange && (permitTrack || !!remedyDeadline);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    const payload: Record<string, unknown> = {
      decision_no: decisionNo.trim(),
      violation_code: code,
      work_type: workType,
      subject_type: subject,
      construction_state: state,
      fine_amount: amountNum,
    };
    if (remedy.trim()) payload.remedy = remedy.trim();
    if (extra.trim()) payload.extra_penalties = extra.trim();
    if (!permitTrack) payload.remedy_deadline = remedyDeadline;
    submit("decide", payload);
  };

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <Notice tone="info">
        <span className="text-xs">{catalog.legal_note}</span>
      </Notice>
      <label className="block">
        <Label>Hành vi vi phạm</Label>
        <select value={code} onChange={(e) => setCode(e.target.value)} className={inputCls} required>
          <option value="" disabled>
            — Chọn hành vi —
          </option>
          {sortedViolations(catalog).map((v) => (
            <option key={v.code} value={v.code}>
              {v.order}. {v.name}
            </option>
          ))}
        </select>
      </label>
      {entry && <p className="text-xs text-text-muted">Căn cứ: {entry.legal_basis}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <Label>Loại công trình</Label>
          <select
            value={workType}
            onChange={(e) => setWorkType(e.target.value as WorkType)}
            className={inputCls}
          >
            {(Object.entries(catalog.work_types) as [WorkType, string][]).map(([k, label]) => (
              <option key={k} value={k}>
                {k}) {label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <Label>Đối tượng vi phạm</Label>
          <select
            value={subject}
            onChange={(e) => setSubject(e.target.value as SubjectType)}
            className={inputCls}
          >
            {(Object.entries(catalog.subject_types) as [SubjectType, string][]).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="block sm:col-span-2">
          <Label>Tình trạng công trình</Label>
          <select
            value={state}
            onChange={(e) => setState(e.target.value as ConstructionState)}
            className={inputCls}
          >
            {(Object.entries(catalog.construction_states) as [ConstructionState, string][]).map(
              ([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              )
            )}
          </select>
        </label>
      </div>

      <div className="border border-border-subtle bg-background-base p-3">
        <p className="text-sm">
          Khung phạt:{" "}
          <strong>{range ? `${formatVnd(range.min).replace(" đồng", "")} – ${formatVnd(range.max)}` : "—"}</strong>
        </p>
        <p className="mt-1 text-xs text-text-muted">
          {subject === "ca_nhan"
            ? "Cá nhân: bằng 1/2 mức phạt áp dụng với tổ chức."
            : "Tổ chức: mức phạt theo Nghị định."}
        </p>
        {isRepeatK12 && (
          <p className="mt-1 text-xs text-accent-warning">
            Tái phạm sau quyết định: áp dụng khung phạt khoản 12 Điều 25 (cao hơn khoản 11).
          </p>
        )}
      </div>

      <label className="block">
        <Label hint="(đồng)">Mức phạt</Label>
        <input
          type="text"
          inputMode="numeric"
          value={amount ? new Intl.NumberFormat("vi-VN").format(amountNum) : ""}
          onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))}
          className={`${inputCls} ${outOfRange ? "border-accent-alert" : ""}`}
          required
        />
        {outOfRange && (
          <span className="mt-1 block text-xs text-accent-alert">Mức phạt phải nằm trong khung phạt.</span>
        )}
      </label>
      {overAuthority && (
        <Notice tone="alert">
          Mức phạt vượt thẩm quyền Chủ tịch UBND cấp xã ({formatVnd(limit)} đối với{" "}
          {catalog.subject_types[subject].toLowerCase()}). Cần chuyển cấp có thẩm quyền ban hành quyết
          định.
        </Notice>
      )}

      <label className="block">
        <Label>Biện pháp khắc phục hậu quả</Label>
        <textarea value={remedy} onChange={(e) => setRemedy(e.target.value)} rows={3} className={inputCls} />
      </label>

      {permitTrack ? (
        <Notice tone="warning">
          <p className="font-semibold">Áp dụng Điều 85 — theo dõi cấp phép</p>
          <p className="mt-1">
            Người vi phạm có {permitDays} ngày xin cấp/điều chỉnh giấy phép xây dựng (
            {catalog.permit_days.house} ngày với nhà ở riêng lẻ, {catalog.permit_days.project} ngày với
            công trình khác). Hết hạn hoặc không được cấp phép: buộc phá dỡ trong{" "}
            {catalog.permit_days.demolish} ngày. Không cần nhập hạn khắc phục.
          </p>
        </Notice>
      ) : (
        <label className="block">
          <Label>Hạn khắc phục</Label>
          <input
            type="date"
            value={remedyDeadline}
            min={isoDatePlus(0)}
            onChange={(e) => setRemedyDeadline(e.target.value)}
            className={inputCls}
            required
          />
        </label>
      )}

      <label className="block">
        <Label>Hình thức xử phạt bổ sung</Label>
        <textarea
          value={extra}
          onChange={(e) => setExtra(e.target.value)}
          rows={2}
          className={inputCls}
          placeholder="Nếu có"
        />
      </label>

      <label className="block">
        <Label>Số quyết định</Label>
        <input
          value={decisionNo}
          onChange={(e) => setDecisionNo(e.target.value)}
          className={inputCls}
          placeholder="VD: 123/QĐ-XPHC"
          required
        />
      </label>

      <button type="submit" disabled={busy || !canSubmit} className={primaryBtn}>
        {busy ? "Đang ban hành…" : "Ban hành quyết định xử phạt"}
      </button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Các biểu mẫu đơn giản
// ---------------------------------------------------------------------------

function NoteForm({
  submit,
  busy,
  action,
  label,
  placeholder,
  required,
  button,
}: FormProps & {
  action: CaseAction;
  label: string;
  placeholder?: string;
  required?: boolean;
  button: string;
}) {
  const [note, setNote] = useState("");
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    submit(action, note.trim() ? { note: note.trim() } : {});
  };
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <label className="block">
        <Label>{label}</Label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          className={inputCls}
          placeholder={placeholder}
          required={required}
        />
      </label>
      <button type="submit" disabled={busy || (required && !note.trim())} className={primaryBtn}>
        {busy ? "Đang lưu…" : button}
      </button>
    </form>
  );
}

function ContinuingForm({ c, submit, busy }: FormProps) {
  const [note, setNote] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const beforeDecision = c.status === "cho_quyet_dinh";
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    submit("report_continuing", { note: note.trim(), ...(photos.length ? { photos } : {}) });
  };
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <Notice tone="warning">
        {beforeDecision
          ? "Vẫn tiếp tục thi công sau khi đã lập biên bản: hồ sơ chuyển sang hành vi “Tiếp tục xây dựng sau khi đã bị lập biên bản” (khoản 11 Điều 25)."
          : "Vẫn tiếp tục thi công sau khi đã có quyết định xử phạt (khoản 12 Điều 25): ghi nhận để xử lý tiếp."}
      </Notice>
      <label className="block">
        <Label>Mô tả hiện trạng</Label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          className={inputCls}
          required
        />
      </label>
      <PhotoPicker photos={photos} onChange={setPhotos} max={6} label="Ảnh hiện trường (không bắt buộc)" />
      <button type="submit" disabled={busy || !note.trim()} className={dangerBtn}>
        {busy ? "Đang lưu…" : "Ghi nhận tiếp tục thi công"}
      </button>
    </form>
  );
}

function SubmitPermitForm({ c, submit, busy }: FormProps) {
  const [permitNo, setPermitNo] = useState("");
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    submit("submit_permit", { permit_no: permitNo.trim() });
  };
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <p className="text-xs text-text-muted">
        Nhập thay người vi phạm khi họ nộp giấy phép trực tiếp.
        {c.permit_track?.deadline ? ` Hạn cấp phép: ${formatDate(c.permit_track.deadline)}.` : ""} Sau khi nộp, Cán bộ
        Xử lý kiểm tra hiện trạng trong 5 ngày.
      </p>
      <label className="block">
        <Label>Số giấy phép xây dựng được cấp / điều chỉnh</Label>
        <input
          value={permitNo}
          onChange={(e) => setPermitNo(e.target.value)}
          className={inputCls}
          placeholder="VD: GPXD-2026-015"
          required
        />
      </label>
      <button type="submit" disabled={busy || !permitNo.trim()} className={primaryBtn}>
        {busy ? "Đang lưu…" : "Ghi nhận giấy phép"}
      </button>
    </form>
  );
}

function PermitExpiredForm({ c, catalog, submit, busy }: FormProps) {
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="space-y-3">
      <Notice tone="alert">
        Người vi phạm hết hạn{c.permit_track?.deadline ? ` (${formatDate(c.permit_track.deadline)})` : ""} hoặc không được
        cấp phép. Hồ sơ chuyển sang buộc phá dỡ công trình, phần công trình vi phạm trong{" "}
        {catalog.permit_days.demolish} ngày.
      </Notice>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} />
        Tôi xác nhận chuyển sang buộc phá dỡ
      </label>
      <button
        type="button"
        disabled={busy || !confirm}
        onClick={() => submit("permit_expired", {})}
        className={dangerBtn}
      >
        {busy ? "Đang lưu…" : "Buộc phá dỡ"}
      </button>
    </div>
  );
}

function PhotoPicker({
  photos,
  onChange,
  max,
  label,
}: {
  photos: string[];
  onChange: (p: string[]) => void;
  max: number;
  label: string;
}) {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const onFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError("");
    setLoading(true);
    try {
      const room = max - photos.length;
      const picked = Array.from(files).slice(0, room);
      const urls = await Promise.all(picked.map((f) => compressImage(f)));
      onChange([...photos, ...urls]);
      if (files.length > room) setError(`Chỉ giữ tối đa ${max} ảnh.`);
    } catch (e) {
      setError(errMsg(e, "Lỗi xử lý ảnh"));
    } finally {
      setLoading(false);
    }
  };
  return (
    <div>
      <Label hint={`(${photos.length}/${max})`}>{label}</Label>
      {photos.length < max && (
        <input
          type="file"
          accept="image/*"
          multiple={max > 1}
          onChange={(e) => {
            onFiles(e.target.files);
            e.target.value = "";
          }}
          className="mt-1 block text-sm"
        />
      )}
      {loading && <p className="mt-1 text-xs text-text-muted">Đang nén ảnh…</p>}
      {error && <p className="mt-1 text-xs text-accent-alert">{error}</p>}
      {photos.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {photos.map((p, i) => (
            <div key={i} className="relative h-20 w-20 border border-border-subtle">
              <img src={p} alt={`Ảnh ${i + 1}`} className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => onChange(photos.filter((_, j) => j !== i))}
                className="absolute right-0 top-0 bg-black/70 px-1 text-xs text-white"
                title="Xoá ảnh"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RemediationForm({ c, submit, busy }: FormProps) {
  const [finePaid, setFinePaid] = useState(false);
  const [photos, setPhotos] = useState<string[]>([]);
  const [receipt, setReceipt] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    submit("report_remediation", {
      fine_paid: finePaid,
      photos,
      ...(receipt[0] ? { receipt_photo: receipt[0] } : {}),
      ...(note.trim() ? { note: note.trim() } : {}),
    });
  };
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <p className="text-xs text-text-muted">
        Nhập thay người vi phạm khi họ báo cáo trực tiếp.
        {c.decision?.remedy_deadline ? ` Hạn khắc phục: ${formatDate(c.decision.remedy_deadline)}.` : ""}
      </p>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={finePaid} onChange={(e) => setFinePaid(e.target.checked)} />
        Đã nộp tiền phạt
        {c.decision?.fine_amount ? (
          <span className="text-text-muted">({formatVnd(c.decision.fine_amount)})</span>
        ) : null}
      </label>
      <PhotoPicker photos={receipt} onChange={setReceipt} max={1} label="Ảnh biên lai nộp phạt" />
      <PhotoPicker photos={photos} onChange={setPhotos} max={6} label="Ảnh hiện trạng sau khắc phục (1–6 ảnh)" />
      <label className="block">
        <Label>Ghi chú</Label>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className={inputCls} />
      </label>
      <button type="submit" disabled={busy || photos.length === 0} className={primaryBtn}>
        {busy ? "Đang gửi…" : "Báo cáo kết quả khắc phục"}
      </button>
    </form>
  );
}

function ReinspectionForm({ c, submit, busy }: FormProps) {
  const { officers, error } = useOfficers();
  const [due, setDue] = useState(isoDatePlus(3));
  const [officerId, setOfficerId] = useState("");
  const [note, setNote] = useState("");
  const current = c.assignment?.officer_name;
  const sortedOfficers = useMemo(
    () => [...officers].sort((a, b) => a.full_name.localeCompare(b.full_name, "vi")),
    [officers]
  );
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    submit("request_reinspection", {
      due_date: due,
      ...(officerId ? { officer_id: officerId } : {}),
      ...(note.trim() ? { note: note.trim() } : {}),
    });
  };
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      {error && <Notice tone="alert">{error}</Notice>}
      {c.remediation && (
        <PhotoGrid photos={c.remediation.photos} label="Ảnh báo cáo khắc phục" />
      )}
      <label className="block">
        <Label>Hạn hậu kiểm</Label>
        <input
          type="date"
          value={due}
          min={isoDatePlus(0)}
          onChange={(e) => setDue(e.target.value)}
          className={inputCls}
          required
        />
      </label>
      <label className="block">
        <Label>Cán bộ Xử lý hậu kiểm</Label>
        <select value={officerId} onChange={(e) => setOfficerId(e.target.value)} className={inputCls}>
          <option value="">{current ? `Giữ nguyên: ${current}` : "— Chọn cán bộ —"}</option>
          {sortedOfficers.map((o) => (
            <option key={o.id} value={o.id}>
              {o.full_name}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <Label>Ghi chú</Label>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className={inputCls} />
      </label>
      <button type="submit" disabled={busy || (!officerId && !current)} className={primaryBtn}>
        {busy ? "Đang lưu…" : "Yêu cầu hậu kiểm"}
      </button>
    </form>
  );
}
