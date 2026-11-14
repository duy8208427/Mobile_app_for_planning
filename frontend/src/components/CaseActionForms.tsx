import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Switch,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { api } from "../api";
import { colors, spacing } from "../theme";
import {
  ACTION_ICONS,
  ACTION_LABELS,
  askConfirm,
  caseDetailHref,
  formatMoney,
  isValidIsoDate,
  isoInDays,
  loadCatalog,
  notify,
  runCaseAction,
  type Catalog,
} from "../cases";
import PhotoPicker, { totalPhotoChars } from "./PhotoPicker";

// ---------------------------------------------------------------------------
// Small form primitives
// ---------------------------------------------------------------------------
export function FieldLabel({ children }: { children: ReactNode }) {
  return <Text style={styles.label}>{children}</Text>;
}

function Input(props: React.ComponentProps<typeof TextInput> & { multilineHeight?: number }) {
  const { multilineHeight, style, ...rest } = props;
  return (
    <TextInput
      placeholderTextColor={colors.textMuted}
      {...rest}
      style={[
        styles.input,
        rest.multiline && { minHeight: multilineHeight || 80, textAlignVertical: "top" },
        style,
      ]}
    />
  );
}

function Chips<T extends string>({
  options,
  value,
  onChange,
  testIDPrefix,
}: {
  options: { value: T; label: string }[];
  value: T | null | undefined;
  onChange: (v: T) => void;
  testIDPrefix?: string;
}) {
  return (
    <View style={styles.chips}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <TouchableOpacity
            key={o.value}
            testID={testIDPrefix ? `${testIDPrefix}-${o.value}` : undefined}
            style={[styles.chip, on && styles.chipOn]}
            onPress={() => onChange(o.value)}
          >
            <Text style={[styles.chipText, on && { color: "#fff" }]}>{o.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function DateField({ value, onChange, quick }: { value: string; onChange: (v: string) => void; quick: number[] }) {
  return (
    <View>
      <Input value={value} onChangeText={onChange} placeholder="YYYY-MM-DD" autoCapitalize="none" />
      <View style={[styles.chips, { marginTop: 6 }]}>
        {quick.map((n) => {
          const iso = isoInDays(n);
          const on = iso === value;
          return (
            <TouchableOpacity key={n} style={[styles.chipSm, on && styles.chipOn]} onPress={() => onChange(iso)}>
              <Text style={[styles.chipSmText, on && { color: "#fff" }]}>+{n} ngày</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function SwitchRow({ label, value, onChange, hint }: { label: string; value: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <View style={styles.switchRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.switchLabel}>{label}</Text>
        {hint ? <Text style={styles.switchHint}>{hint}</Text> : null}
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.primary, false: colors.border }} />
    </View>
  );
}

function SubmitButton({ label, onPress, busy, tone = "primary", testID }: {
  label: string;
  onPress: () => void;
  busy?: boolean;
  tone?: "primary" | "danger" | "success";
  testID?: string;
}) {
  const bg = tone === "danger" ? colors.alert : tone === "success" ? colors.success : colors.primary;
  return (
    <TouchableOpacity
      testID={testID}
      style={[styles.submit, { backgroundColor: bg }, busy && { opacity: 0.6 }]}
      onPress={onPress}
      disabled={busy}
    >
      {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>{label}</Text>}
    </TouchableOpacity>
  );
}

function InfoBox({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "warn" | "danger" }) {
  const map = {
    info: { bg: "#EFF6FF", border: "#BFDBFE", color: "#1E3A8A", icon: "information-circle-outline" },
    warn: { bg: "#FFFBEB", border: "#FDE68A", color: "#92400E", icon: "warning-outline" },
    danger: { bg: "#FEF2F2", border: "#FECACA", color: "#991B1B", icon: "alert-circle-outline" },
  }[tone];
  return (
    <View style={[styles.infoBox, { backgroundColor: map.bg, borderColor: map.border }]}>
      <Ionicons name={map.icon as any} size={16} color={map.color} />
      <Text style={[styles.infoText, { color: map.color }]}>{children}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Types and helpers
// ---------------------------------------------------------------------------
type FormProps = {
  caseData: any;
  catalog: Catalog | null;
  officers: { id: string; full_name: string }[];
  submit: (payload: Record<string, any>, opts?: { confirm?: { title: string; message: string } }) => Promise<void>;
  busy: boolean;
};

const codeOptions = (catalog: Catalog | null) =>
  (catalog?.violations || []).map((v) => ({ value: v.code, label: v.name }));

const dictOptions = (d?: Record<string, string>) =>
  Object.entries(d || {}).map(([value, label]) => ({ value, label }));

const workTypeOptions = (catalog: Catalog | null) =>
  Object.entries(catalog?.work_types || {}).map(([value, label]) => ({ value, label: `${value}) ${label}` }));

function parseNumber(s: string): number | undefined {
  const n = parseFloat(s.replace(",", "."));
  return isNaN(n) ? undefined : n;
}

// ---------------------------------------------------------------------------
// Admin: tiền kiểm
// ---------------------------------------------------------------------------
function PrecheckForm({ caseData, catalog, submit, busy }: FormProps) {
  const router = useRouter();
  const [ctx, setCtx] = useState<any>(null);
  const [ctxError, setCtxError] = useState("");
  const [result, setResult] = useState<"violation" | "no_violation">("violation");
  const [code, setCode] = useState<string | null>(caseData.violation_code || caseData.suggested_code || null);
  const [note, setNote] = useState("");

  useEffect(() => {
    api(`/cases/${caseData.id}/precheck-context`)
      .then((c) => {
        setCtx(c);
        if (c?.suggested_code) setCode((cur) => cur || c.suggested_code);
      })
      .catch((e) => setCtxError(e?.message || "Không tải được dữ liệu đối chiếu"));
  }, [caseData.id]);

  const parcel = ctx?.parcel;
  const zone = ctx?.zone;

  return (
    <View>
      <FieldLabel>ĐỐI CHIẾU DỮ LIỆU</FieldLabel>
      {!ctx && !ctxError ? <ActivityIndicator color={colors.primary} /> : null}
      {ctxError ? <InfoBox tone="danger">{ctxError}</InfoBox> : null}
      {ctx ? (
        <View style={styles.ctxCard}>
          <Text style={styles.ctxTitle}>Thửa đất</Text>
          {parcel ? (
            <Text style={styles.ctxText}>
              Tờ {parcel.so_to || parcel.SoTo || "—"} / Thửa {parcel.so_thua || parcel.SoThua || "—"} · Loại đất{" "}
              {parcel.loai_dat || parcel.KyHieuLoaiDat || "—"}
              {parcel.DienTich ? ` · ${parcel.DienTich} m²` : ""}
              {parcel.allow_build === false ? " · Không được phép xây dựng" : parcel.allow_build ? " · Được phép xây dựng" : ""}
            </Text>
          ) : (
            <Text style={styles.ctxMuted}>Không xác định được thửa đất tại vị trí này.</Text>
          )}

          <Text style={styles.ctxTitle}>Quy hoạch</Text>
          {zone ? (
            <Text style={styles.ctxText}>
              {zone.zone_name || zone.name || "Khu quy hoạch"}
              {zone.zone_code ? ` (${zone.zone_code})` : ""}
              {zone.allow_build === false ? " · Không cho phép xây dựng" : zone.allow_build ? " · Cho phép xây dựng" : ""}
              {zone.max_floor ? ` · Tối đa ${zone.max_floor} tầng` : ""}
            </Text>
          ) : (
            <Text style={styles.ctxMuted}>Không có dữ liệu quy hoạch tại vị trí này.</Text>
          )}

          <Text style={styles.ctxTitle}>Giấy phép xây dựng</Text>
          {!ctx.permits_loaded ? (
            <Text style={styles.ctxMuted}>Chưa có dữ liệu giấy phép trong hệ thống.</Text>
          ) : ctx.permits?.length ? (
            ctx.permits.map((p: any, i: number) => (
              <Text key={p.id || i} style={styles.ctxText}>
                • {p.permit_no || "GPXD"} {p.owner_name ? `· ${p.owner_name}` : ""} {p.issued_date ? `· ${p.issued_date}` : ""}
              </Text>
            ))
          ) : (
            <Text style={styles.ctxText}>Không có giấy phép trên thửa này.</Text>
          )}

          <Text style={styles.ctxTitle}>Hồ sơ trùng thửa đang mở</Text>
          {ctx.duplicates?.length ? (
            ctx.duplicates.map((d: any) => (
              <TouchableOpacity key={d.id} onPress={() => router.push(caseDetailHref(d.id))}>
                <Text style={[styles.ctxText, { color: colors.primary }]}>• {d.code} ({d.status})</Text>
              </TouchableOpacity>
            ))
          ) : (
            <Text style={styles.ctxMuted}>Không có.</Text>
          )}

          {ctx.suggested_code ? (
            <Text style={[styles.ctxText, { marginTop: 8, fontWeight: "700" }]}>
              Gợi ý hành vi: {catalog?.violations.find((v) => v.code === ctx.suggested_code)?.name || ctx.suggested_code}
            </Text>
          ) : null}
        </View>
      ) : null}

      <FieldLabel>KẾT QUẢ TIỀN KIỂM</FieldLabel>
      <Chips
        testIDPrefix="precheck-result"
        options={[
          { value: "violation", label: "Có dấu hiệu vi phạm" },
          { value: "no_violation", label: "Không vi phạm" },
        ]}
        value={result}
        onChange={setResult}
      />
      {result === "violation" ? (
        <>
          <FieldLabel>HÀNH VI NGHI VẤN</FieldLabel>
          <Chips options={codeOptions(catalog)} value={code} onChange={setCode} />
        </>
      ) : null}
      <FieldLabel>GHI CHÚ</FieldLabel>
      <Input value={note} onChangeText={setNote} multiline placeholder="Kết quả đối chiếu bản đồ, giấy phép..." />
      <SubmitButton
        busy={busy}
        tone={result === "no_violation" ? "danger" : "primary"}
        label={result === "no_violation" ? "Kết luận không vi phạm, đóng hồ sơ" : "Xác nhận có dấu hiệu vi phạm"}
        onPress={() =>
          submit(
            {
              result,
              violation_code: result === "violation" ? code || undefined : undefined,
              note: note.trim() || undefined,
              permit_checked: !!ctx?.permits_loaded,
              zone_checked: !!ctx?.zone,
            },
            result === "no_violation"
              ? { confirm: { title: "Đóng hồ sơ?", message: "Hồ sơ sẽ được đóng với kết luận không vi phạm." } }
              : undefined
          )
        }
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Admin: giao việc
// ---------------------------------------------------------------------------
function OfficerPicker({ officers, value, onChange }: { officers: FormProps["officers"]; value: string | null; onChange: (v: string) => void }) {
  if (!officers.length) return <Text style={styles.ctxMuted}>Chưa có Cán bộ Xử lý nào.</Text>;
  return <Chips options={officers.map((o) => ({ value: o.id, label: o.full_name }))} value={value} onChange={onChange} />;
}

function AssignForm({ caseData, officers, submit, busy }: FormProps) {
  const [officerId, setOfficerId] = useState<string | null>(caseData.assignment?.officer_id || null);
  const [due, setDue] = useState(isoInDays(3));
  const [instructions, setInstructions] = useState("");
  useEffect(() => {
    if (!officerId && officers.length) setOfficerId(officers[0].id);
  }, [officers, officerId]);
  return (
    <View>
      <FieldLabel>CÁN BỘ XỬ LÝ</FieldLabel>
      <OfficerPicker officers={officers} value={officerId} onChange={setOfficerId} />
      <FieldLabel>HẠN KIỂM TRA THỰC ĐỊA</FieldLabel>
      <DateField value={due} onChange={setDue} quick={[1, 3, 5, 7]} />
      <FieldLabel>CHỈ ĐẠO</FieldLabel>
      <Input value={instructions} onChangeText={setInstructions} multiline placeholder="Nội dung cần kiểm tra..." />
      <SubmitButton
        busy={busy}
        label="Giao việc"
        onPress={() => {
          if (!officerId) return notify("Thiếu thông tin", "Chọn Cán bộ Xử lý.");
          if (!isValidIsoDate(due)) return notify("Ngày không hợp lệ", "Nhập hạn theo dạng YYYY-MM-DD.");
          submit({ officer_id: officerId, due_date: due, instructions: instructions.trim() || undefined });
        }}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Officer: nhận việc
// ---------------------------------------------------------------------------
function AcceptForm({ caseData, submit, busy }: FormProps) {
  return (
    <View>
      {caseData.assignment?.instructions ? <InfoBox>Chỉ đạo: {caseData.assignment.instructions}</InfoBox> : null}
      <Text style={styles.paragraph}>
        Xác nhận bạn đã nhận phiếu giao việc và di chuyển đến hiện trường để kiểm tra, thu thập bằng chứng.
      </Text>
      <SubmitButton busy={busy} label="Nhận việc, đến hiện trường" onPress={() => submit({})} testID="action-accept-submit" />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Officer: lập biên bản
// ---------------------------------------------------------------------------
function SubmitRecordForm({ caseData, catalog, submit, busy }: FormProps) {
  const prevViolator = caseData.violator || {};
  const prevInspection = caseData.inspection || {};
  const [recordNo, setRecordNo] = useState(prevInspection.record_no || "");
  const [description, setDescription] = useState(prevInspection.description || "");
  const [area, setArea] = useState(prevInspection.area_m2 != null ? String(prevInspection.area_m2) : "");
  const [code, setCode] = useState<string | null>(caseData.violation_code || null);
  const [workType, setWorkType] = useState<string | null>(caseData.work_type || "a");
  const [state, setState] = useState<string | null>(caseData.construction_state || "dang_thi_cong");
  const [vName, setVName] = useState(prevViolator.name || "");
  const [vPhone, setVPhone] = useState(prevViolator.phone || "");
  const [vAddress, setVAddress] = useState(prevViolator.address || "");
  const [subject, setSubject] = useState<string | null>(caseData.subject_type || "ca_nhan");
  const [stopOrder, setStopOrder] = useState(true);
  const [photos, setPhotos] = useState<string[]>([]);

  const onSubmit = () => {
    if (!recordNo.trim() || !description.trim() || !vName.trim()) {
      return notify("Thiếu thông tin", "Nhập số biên bản, nội dung vi phạm và tên người vi phạm.");
    }
    if (!code || !workType || !state || !subject) {
      return notify("Thiếu thông tin", "Chọn hành vi, loại công trình, tình trạng thi công và đối tượng.");
    }
    if (!stopOrder) {
      return notify("Bắt buộc", "Biên bản phải kèm yêu cầu chấm dứt hành vi vi phạm (Điều 87).");
    }
    if (!photos.length) return notify("Thiếu ảnh", "Cần ít nhất 1 ảnh bằng chứng hiện trường.");
    submit({
      record_no: recordNo.trim(),
      description: description.trim(),
      area_m2: area ? parseNumber(area) : undefined,
      violation_code: code,
      work_type: workType,
      construction_state: state,
      violator_name: vName.trim(),
      violator_phone: vPhone.trim() || undefined,
      violator_address: vAddress.trim() || undefined,
      subject_type: subject,
      stop_order: true,
      photos,
    });
  };

  return (
    <View>
      <FieldLabel>SỐ BIÊN BẢN *</FieldLabel>
      <Input value={recordNo} onChangeText={setRecordNo} placeholder="VD: 12/BB-VPHC" testID="record-no-input" />
      <FieldLabel>NỘI DUNG VI PHẠM *</FieldLabel>
      <Input value={description} onChangeText={setDescription} multiline placeholder="Mô tả hiện trạng, hành vi vi phạm..." />
      <FieldLabel>DIỆN TÍCH VI PHẠM (m²)</FieldLabel>
      <Input value={area} onChangeText={setArea} keyboardType="decimal-pad" placeholder="VD: 45.5" />
      <FieldLabel>HÀNH VI VI PHẠM *</FieldLabel>
      <Chips options={codeOptions(catalog)} value={code} onChange={setCode} />
      <FieldLabel>LOẠI CÔNG TRÌNH *</FieldLabel>
      <Chips options={workTypeOptions(catalog)} value={workType} onChange={setWorkType} />
      <FieldLabel>TÌNH TRẠNG THI CÔNG *</FieldLabel>
      <Chips options={dictOptions(catalog?.construction_states)} value={state} onChange={setState} />

      <FieldLabel>NGƯỜI VI PHẠM *</FieldLabel>
      <Input value={vName} onChangeText={setVName} placeholder="Họ tên / tên tổ chức" />
      <Input value={vPhone} onChangeText={setVPhone} keyboardType="phone-pad" placeholder="Số điện thoại" style={{ marginTop: 8 }} />
      <Input value={vAddress} onChangeText={setVAddress} placeholder="Địa chỉ" style={{ marginTop: 8 }} />
      <FieldLabel>ĐỐI TƯỢNG *</FieldLabel>
      <Chips options={dictOptions(catalog?.subject_types)} value={subject} onChange={setSubject} />
      <Text style={styles.hint}>Số điện thoại trùng tài khoản người dân sẽ cho phép họ xem quyết định trên ứng dụng.</Text>

      <SwitchRow
        label="Đã yêu cầu chấm dứt hành vi vi phạm"
        hint="Bắt buộc theo Điều 87"
        value={stopOrder}
        onChange={setStopOrder}
      />
      <PhotoPicker label="ẢNH BẰNG CHỨNG HIỆN TRƯỜNG * (1–6)" photos={photos} onChange={setPhotos} max={6} testID="record-photos" />
      <SubmitButton busy={busy} label="Gửi biên bản" onPress={onSubmit} testID="action-submit-record-submit" />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Admin: trả lại biên bản
// ---------------------------------------------------------------------------
function ReturnRecordForm({ submit, busy }: FormProps) {
  const [note, setNote] = useState("");
  return (
    <View>
      <FieldLabel>NỘI DUNG CẦN BỔ SUNG *</FieldLabel>
      <Input value={note} onChangeText={setNote} multiline placeholder="Ghi rõ nội dung cần bổ sung, chỉnh sửa..." />
      <SubmitButton
        busy={busy}
        tone="danger"
        label="Trả lại cho Cán bộ Xử lý"
        onPress={() => {
          if (!note.trim()) return notify("Thiếu thông tin", "Cần ghi rõ nội dung cần bổ sung.");
          submit({ note: note.trim() });
        }}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Admin: ban hành quyết định
// ---------------------------------------------------------------------------
function DecideForm({ caseData, catalog, submit, busy }: FormProps) {
  const [decisionNo, setDecisionNo] = useState("");
  const [code, setCode] = useState<string | null>(caseData.violation_code || null);
  const [workType, setWorkType] = useState<string | null>(caseData.work_type || "a");
  const [subject, setSubject] = useState<string | null>(caseData.subject_type || "ca_nhan");
  const [state, setState] = useState<string | null>(caseData.construction_state || "dang_thi_cong");
  const [amountText, setAmountText] = useState("");
  const [remedy, setRemedy] = useState("");
  const [extra, setExtra] = useState("");
  const [deadline, setDeadline] = useState(isoInDays(30));
  const [usePermit, setUsePermit] = useState(true);

  const violation = useMemo(() => catalog?.violations.find((v) => v.code === code), [catalog, code]);
  const range = violation && workType
    ? (subject === "to_chuc" ? violation.fines_org : violation.fines_individual)[workType]
    : undefined;
  const k12 = code === "TIEP_TUC_SAU_BIEN_BAN" && caseData.repeat?.clause === "k12";
  const amount = parseInt(amountText.replace(/\D/g, ""), 10) || 0;
  const limit = catalog?.authority_limit?.[(subject as "to_chuc" | "ca_nhan") || "ca_nhan"];
  const exceeds = !!limit && amount > limit;
  const permitEligible = !!violation?.permit_track && state === "dang_thi_cong";
  const permitTrack = permitEligible && usePermit;
  const permitDays = workType === "c" || workType === "d" ? catalog?.permit_days.project : catalog?.permit_days.house;

  // Prefill remedy / extra penalties / amount from the catalog when the code changes
  useEffect(() => {
    if (!violation) return;
    setRemedy(violation.remedy || "");
    setExtra(violation.extra_penalties || "");
  }, [violation]);
  useEffect(() => {
    if (range && !k12) setAmountText(String(range.min));
  }, [range?.min, range?.max, k12]); // eslint-disable-line react-hooks/exhaustive-deps

  const onSubmit = () => {
    if (!decisionNo.trim()) return notify("Thiếu thông tin", "Nhập số quyết định.");
    if (!code || !workType || !subject) return notify("Thiếu thông tin", "Chọn hành vi, loại công trình và đối tượng.");
    if (!amount) return notify("Thiếu thông tin", "Nhập mức phạt.");
    if (range && !k12 && (amount < range.min || amount > range.max)) {
      return notify("Mức phạt ngoài khung", `Mức phạt phải trong khung ${formatMoney(range.min)} – ${formatMoney(range.max)}.`);
    }
    if (!permitTrack && !isValidIsoDate(deadline)) return notify("Ngày không hợp lệ", "Nhập hạn khắc phục dạng YYYY-MM-DD.");
    submit(
      {
        decision_no: decisionNo.trim(),
        violation_code: code,
        work_type: workType,
        subject_type: subject,
        construction_state: state || undefined,
        fine_amount: amount,
        remedy: remedy.trim() || undefined,
        extra_penalties: extra.trim() || undefined,
        permit_track: permitTrack,
        remedy_deadline: permitTrack ? undefined : deadline,
      },
      exceeds
        ? {
            confirm: {
              title: "Vượt thẩm quyền cấp xã",
              message: `Mức phạt ${formatMoney(amount)} vượt thẩm quyền Chủ tịch UBND cấp xã (${formatMoney(limit)}). Vẫn ban hành?`,
            },
          }
        : undefined
    );
  };

  return (
    <View>
      {caseData.repeat ? (
        <InfoBox tone="warn">
          Đã ghi nhận tiếp tục thi công sau biên bản ({caseData.repeat.clause === "k12" ? "khoản 12" : "khoản 11"} Điều 25).
        </InfoBox>
      ) : null}
      <FieldLabel>SỐ QUYẾT ĐỊNH *</FieldLabel>
      <Input value={decisionNo} onChangeText={setDecisionNo} placeholder="VD: 25/QĐ-XPVPHC" testID="decision-no-input" />
      <FieldLabel>HÀNH VI VI PHẠM</FieldLabel>
      <Chips options={codeOptions(catalog)} value={code} onChange={setCode} />
      {violation ? <Text style={styles.hint}>Căn cứ: {violation.legal_basis}</Text> : null}
      <FieldLabel>LOẠI CÔNG TRÌNH</FieldLabel>
      <Chips options={workTypeOptions(catalog)} value={workType} onChange={setWorkType} />
      <FieldLabel>ĐỐI TƯỢNG</FieldLabel>
      <Chips options={dictOptions(catalog?.subject_types)} value={subject} onChange={setSubject} />
      <FieldLabel>TÌNH TRẠNG THI CÔNG</FieldLabel>
      <Chips options={dictOptions(catalog?.construction_states)} value={state} onChange={setState} />

      <FieldLabel>MỨC PHẠT (ĐỒNG) *</FieldLabel>
      {range && !k12 ? (
        <InfoBox>
          Khung phạt: {formatMoney(range.min)} – {formatMoney(range.max)}
          {subject === "ca_nhan" ? " (cá nhân = 1/2 mức phạt tổ chức)" : " (mức phạt đối với tổ chức)"}
        </InfoBox>
      ) : k12 ? (
        <InfoBox tone="warn">Áp dụng khung khoản 12 (tái phạm sau quyết định); máy chủ sẽ kiểm tra khung phạt.</InfoBox>
      ) : null}
      <Input value={amountText} onChangeText={(t) => setAmountText(t.replace(/\D/g, ""))} keyboardType="number-pad" placeholder="VD: 30000000" />
      <Text style={styles.hint}>{amount ? formatMoney(amount) : ""}</Text>
      {exceeds ? (
        <InfoBox tone="danger">
          Vượt thẩm quyền Chủ tịch UBND cấp xã ({formatMoney(limit)}). Cần chuyển cấp có thẩm quyền.
        </InfoBox>
      ) : null}

      <FieldLabel>BIỆN PHÁP KHẮC PHỤC</FieldLabel>
      <Input value={remedy} onChangeText={setRemedy} multiline />
      <FieldLabel>HÌNH THỨC XỬ PHẠT BỔ SUNG</FieldLabel>
      <Input value={extra} onChangeText={setExtra} multiline placeholder="Nếu có" />

      {permitEligible ? (
        <SwitchRow
          label="Cho phép làm thủ tục cấp/điều chỉnh giấy phép (Điều 85)"
          hint={`Đang thi công: người vi phạm có ${permitDays || "—"} ngày để được cấp phép; quá hạn sẽ buộc phá dỡ.`}
          value={usePermit}
          onChange={setUsePermit}
        />
      ) : null}
      {!permitTrack ? (
        <>
          <FieldLabel>HẠN KHẮC PHỤC *</FieldLabel>
          <DateField value={deadline} onChange={setDeadline} quick={[15, 30, 60, 90]} />
        </>
      ) : null}

      {catalog?.legal_note ? <Text style={styles.legalNote}>{catalog.legal_note}</Text> : null}
      <SubmitButton busy={busy} label="Ban hành quyết định" onPress={onSubmit} testID="action-decide-submit" />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Officer / admin: vẫn tiếp tục thi công (Case 5)
// ---------------------------------------------------------------------------
function ReportContinuingForm({ caseData, submit, busy }: FormProps) {
  const [note, setNote] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const afterDecision = caseData.status !== "cho_quyet_dinh";
  return (
    <View>
      <InfoBox tone="warn">
        {afterDecision
          ? "Sau khi đã có quyết định: ghi nhận tái phạm theo khoản 12 Điều 25."
          : "Trước khi ra quyết định: hồ sơ chuyển sang hành vi tiếp tục thi công sau biên bản (khoản 11 Điều 25)."}
      </InfoBox>
      <FieldLabel>MÔ TẢ HIỆN TRẠNG *</FieldLabel>
      <Input value={note} onChangeText={setNote} multiline placeholder="Công trình vẫn tiếp tục thi công..." />
      <PhotoPicker label="ẢNH HIỆN TRƯỜNG" photos={photos} onChange={setPhotos} max={3} />
      <SubmitButton
        busy={busy}
        tone="danger"
        label="Ghi nhận vẫn tiếp tục thi công"
        onPress={() => {
          if (!note.trim()) return notify("Thiếu thông tin", "Mô tả hiện trạng thi công.");
          submit({ note: note.trim(), photos });
        }}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Violator (or admin on behalf): nộp giấy phép
// ---------------------------------------------------------------------------
function SubmitPermitForm({ caseData, submit, busy }: FormProps) {
  const [permitNo, setPermitNo] = useState("");
  return (
    <View>
      {caseData.permit_track?.deadline ? (
        <InfoBox>Hạn được cấp/điều chỉnh giấy phép: {caseData.permit_track.deadline}</InfoBox>
      ) : null}
      <FieldLabel>SỐ GIẤY PHÉP XÂY DỰNG *</FieldLabel>
      <Input value={permitNo} onChangeText={setPermitNo} placeholder="VD: 123/GPXD" />
      <Text style={styles.hint}>Sau khi nộp, Cán bộ Xử lý sẽ kiểm tra hiện trạng trong 5 ngày.</Text>
      <SubmitButton
        busy={busy}
        label="Nộp giấy phép"
        onPress={() => {
          if (!permitNo.trim()) return notify("Thiếu thông tin", "Nhập số giấy phép.");
          submit({ permit_no: permitNo.trim() });
        }}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Admin: hết hạn cấp phép
// ---------------------------------------------------------------------------
function PermitExpiredForm({ caseData, catalog, submit, busy }: FormProps) {
  const days = catalog?.permit_days.demolish || 15;
  return (
    <View>
      <InfoBox tone="danger">
        Hạn cấp phép {caseData.permit_track?.deadline || ""} đã hết hoặc không được cấp phép. Người vi phạm sẽ bị buộc tự phá dỡ
        trong {days} ngày.
      </InfoBox>
      <SubmitButton
        busy={busy}
        tone="danger"
        label="Chuyển sang buộc phá dỡ"
        onPress={() =>
          submit({}, { confirm: { title: "Buộc phá dỡ?", message: `Người vi phạm phải tự phá dỡ trong ${days} ngày.` } })
        }
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Violator (or staff on behalf): báo cáo khắc phục
// ---------------------------------------------------------------------------
function ReportRemediationForm({ caseData, submit, busy }: FormProps) {
  const [finePaid, setFinePaid] = useState(false);
  const [receipt, setReceipt] = useState<string[]>([]);
  const [photos, setPhotos] = useState<string[]>([]);
  const [note, setNote] = useState("");
  return (
    <View>
      {caseData.decision?.remedy ? <InfoBox>Yêu cầu khắc phục: {caseData.decision.remedy}</InfoBox> : null}
      <SwitchRow
        label="Đã nộp phạt"
        hint={caseData.decision?.fine_amount ? `Số tiền: ${formatMoney(caseData.decision.fine_amount)}` : undefined}
        value={finePaid}
        onChange={setFinePaid}
      />
      {finePaid ? (
        <PhotoPicker label="ẢNH BIÊN LAI NỘP PHẠT" photos={receipt} onChange={setReceipt} max={1} otherChars={totalPhotoChars(photos)} />
      ) : null}
      <PhotoPicker
        label="ẢNH HIỆN TRẠNG SAU KHẮC PHỤC * (1–5)"
        photos={photos}
        onChange={setPhotos}
        max={5}
        otherChars={totalPhotoChars(receipt)}
      />
      <FieldLabel>GHI CHÚ</FieldLabel>
      <Input value={note} onChangeText={setNote} multiline placeholder="Đã tháo dỡ phần vi phạm..." />
      <SubmitButton
        busy={busy}
        label="Gửi báo cáo khắc phục"
        onPress={() => {
          if (!photos.length) return notify("Thiếu ảnh", "Cần ít nhất 1 ảnh hiện trạng sau khắc phục.");
          submit({
            fine_paid: finePaid,
            receipt_photo: finePaid ? receipt[0] : undefined,
            photos,
            note: note.trim() || undefined,
          });
        }}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Admin: yêu cầu hậu kiểm
// ---------------------------------------------------------------------------
function RequestReinspectionForm({ caseData, officers, submit, busy }: FormProps) {
  const [officerId, setOfficerId] = useState<string | null>(caseData.assignment?.officer_id || null);
  const [due, setDue] = useState(isoInDays(5));
  const [note, setNote] = useState("");
  useEffect(() => {
    if (!officerId && officers.length) setOfficerId(officers[0].id);
  }, [officers, officerId]);
  return (
    <View>
      <FieldLabel>CÁN BỘ HẬU KIỂM</FieldLabel>
      <OfficerPicker officers={officers} value={officerId} onChange={setOfficerId} />
      <FieldLabel>HẠN HẬU KIỂM</FieldLabel>
      <DateField value={due} onChange={setDue} quick={[3, 5, 7, 10]} />
      <FieldLabel>GHI CHÚ</FieldLabel>
      <Input value={note} onChangeText={setNote} multiline />
      <SubmitButton
        busy={busy}
        label="Yêu cầu hậu kiểm"
        onPress={() => {
          if (!isValidIsoDate(due)) return notify("Ngày không hợp lệ", "Nhập hạn dạng YYYY-MM-DD.");
          submit({ due_date: due, officer_id: officerId || undefined, note: note.trim() || undefined });
        }}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Officer: hậu kiểm
// ---------------------------------------------------------------------------
function ReinspectForm({ caseData, submit, busy }: FormProps) {
  const [result, setResult] = useState<"pass" | "fail">("pass");
  const [photos, setPhotos] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const permitCheck = caseData.reinspection?.kind === "permit_check";
  return (
    <View>
      {permitCheck ? (
        <InfoBox>
          Kiểm tra công trình có phù hợp giấy phép {caseData.permit_track?.permit_no || ""} vừa được cấp. Không phù hợp: buộc phá dỡ
          phần sai.
        </InfoBox>
      ) : caseData.remediation ? (
        <InfoBox>Người vi phạm đã báo cáo khắc phục. Kiểm tra hiện trạng thực tế.</InfoBox>
      ) : null}
      <FieldLabel>KẾT QUẢ</FieldLabel>
      <Chips
        options={[
          { value: "pass", label: permitCheck ? "Phù hợp giấy phép" : "Đạt – đã khắc phục" },
          { value: "fail", label: permitCheck ? "Không phù hợp" : "Không đạt" },
        ]}
        value={result}
        onChange={setResult}
      />
      <PhotoPicker label="ẢNH HIỆN TRẠNG * (1–6)" photos={photos} onChange={setPhotos} max={6} />
      <FieldLabel>GHI CHÚ</FieldLabel>
      <Input value={note} onChangeText={setNote} multiline />
      <SubmitButton
        busy={busy}
        tone={result === "pass" ? "success" : "danger"}
        label="Gửi kết quả"
        onPress={() => {
          if (!photos.length) return notify("Thiếu ảnh", "Cần ít nhất 1 ảnh hiện trạng.");
          submit({ result, photos, note: note.trim() || undefined });
        }}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Admin: đóng hồ sơ
// ---------------------------------------------------------------------------
function CloseForm({ submit, busy }: FormProps) {
  const [note, setNote] = useState("");
  return (
    <View>
      <FieldLabel>GHI CHÚ ĐÓNG HỒ SƠ</FieldLabel>
      <Input value={note} onChangeText={setNote} multiline placeholder="Đã khắc phục, đóng hồ sơ lưu trữ" />
      <SubmitButton
        busy={busy}
        tone="success"
        label="Đóng hồ sơ"
        onPress={() =>
          submit({ note: note.trim() || undefined }, { confirm: { title: "Đóng hồ sơ?", message: "Hồ sơ sẽ được lưu trữ." } })
        }
      />
    </View>
  );
}

const FORMS: Record<string, (p: FormProps) => ReactNode> = {
  precheck: PrecheckForm,
  assign: AssignForm,
  accept: AcceptForm,
  submit_record: SubmitRecordForm,
  return_record: ReturnRecordForm,
  decide: DecideForm,
  report_continuing: ReportContinuingForm,
  submit_permit: SubmitPermitForm,
  permit_expired: PermitExpiredForm,
  report_remediation: ReportRemediationForm,
  request_reinspection: RequestReinspectionForm,
  reinspect: ReinspectForm,
  close: CloseForm,
};

function actionLabel(action: string, caseData: any, role?: string) {
  if (action === "reinspect" && caseData.reinspection?.kind === "permit_check") return "Kiểm tra hiện trạng sau cấp phép";
  if (action === "report_continuing") return "Vẫn tiếp tục thi công";
  const base = ACTION_LABELS[action] || action;
  if ((action === "submit_permit" || action === "report_remediation") && role !== "citizen") {
    return `${base} (thay người vi phạm)`;
  }
  return base;
}

// ---------------------------------------------------------------------------
// Panel: one button per available action, the chosen one opens its form
// ---------------------------------------------------------------------------
export default function CaseActionPanel({
  caseData,
  role,
  onUpdated,
}: {
  caseData: any;
  role?: string;
  onUpdated: (updated: any) => void;
}) {
  const actions: string[] = (caseData?.available_actions || []).filter((a: string) => FORMS[a]);
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [officers, setOfficers] = useState<{ id: string; full_name: string }[]>([]);

  useEffect(() => {
    if (!actions.length) return;
    loadCatalog().then(setCatalog).catch(() => {});
  }, [actions.length]);

  useEffect(() => {
    if (role !== "admin") return;
    if (!actions.some((a) => a === "assign" || a === "request_reinspection")) return;
    api("/cases/officers").then(setOfficers).catch(() => {});
  }, [role, actions.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (open && !actions.includes(open)) setOpen(null);
    if (!open && actions.length === 1) setOpen(actions[0]);
  }, [actions.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!actions.length) return null;

  const submitFor = (action: string) => async (
    payload: Record<string, any>,
    opts?: { confirm?: { title: string; message: string } }
  ) => {
    if (opts?.confirm) {
      const ok = await askConfirm(opts.confirm.title, opts.confirm.message);
      if (!ok) return;
    }
    setBusy(true);
    try {
      const updated = await runCaseAction(caseData.id, action, payload);
      setOpen(null);
      onUpdated(updated);
      notify("Đã cập nhật", `${actionLabel(action, caseData, role)}: ${updated?.status_label || "thành công"}.`);
    } catch (e: any) {
      notify("Không thực hiện được", e?.message || "Vui lòng thử lại");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.panel}>
      <Text style={styles.panelTitle}>VIỆC CẦN LÀM</Text>
      {actions.map((a) => {
        const isOpen = open === a;
        const Form = FORMS[a];
        return (
          <View key={a} style={[styles.actionCard, isOpen && styles.actionCardOpen]}>
            <TouchableOpacity
              testID={`case-action-${a}`}
              style={styles.actionHead}
              onPress={() => setOpen(isOpen ? null : a)}
            >
              <View style={styles.actionIcon}>
                <Ionicons name={(ACTION_ICONS[a] || "ellipse-outline") as any} size={18} color={colors.primary} />
              </View>
              <Text style={styles.actionTitle}>{actionLabel(a, caseData, role)}</Text>
              <Ionicons name={isOpen ? "chevron-up" : "chevron-down"} size={18} color={colors.textMuted} />
            </TouchableOpacity>
            {isOpen ? (
              <View style={styles.actionBody}>
                <Form caseData={caseData} catalog={catalog} officers={officers} submit={submitFor(a)} busy={busy} />
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.textMuted,
    letterSpacing: 1,
    marginTop: spacing.md,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
    borderRadius: 8,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#fff",
    maxWidth: "100%",
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 12, fontWeight: "600", color: colors.text },
  chipSm: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#fff",
  },
  chipSmText: { fontSize: 11, fontWeight: "600", color: colors.textMuted },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: spacing.md,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#fff",
  },
  switchLabel: { fontSize: 13, fontWeight: "700", color: colors.text },
  switchHint: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  submit: { marginTop: spacing.md, paddingVertical: 13, alignItems: "center", borderRadius: 8 },
  submitText: { color: "#fff", fontWeight: "800", fontSize: 14 },
  infoBox: {
    flexDirection: "row",
    gap: 6,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 6,
    alignItems: "flex-start",
  },
  infoText: { flex: 1, fontSize: 12, lineHeight: 17 },
  hint: { fontSize: 11, color: colors.textMuted, marginTop: 4 },
  paragraph: { fontSize: 13, color: colors.text, lineHeight: 19, marginTop: 6 },
  legalNote: { fontSize: 11, color: colors.textMuted, fontStyle: "italic", marginTop: spacing.md, lineHeight: 16 },
  ctxCard: { backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 10 },
  ctxTitle: { fontSize: 12, fontWeight: "800", color: colors.text, marginTop: 6 },
  ctxText: { fontSize: 12, color: colors.text, marginTop: 2, lineHeight: 17 },
  ctxMuted: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  panel: { marginTop: spacing.lg },
  panelTitle: { fontSize: 11, fontWeight: "800", color: colors.textMuted, letterSpacing: 1.1, marginBottom: 8 },
  actionCard: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    marginBottom: 8,
    overflow: "hidden",
  },
  actionCardOpen: { borderColor: colors.primary },
  actionHead: { flexDirection: "row", alignItems: "center", padding: 12, gap: 10 },
  actionIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#DBEAFE",
    alignItems: "center",
    justifyContent: "center",
  },
  actionTitle: { flex: 1, fontSize: 14, fontWeight: "700", color: colors.text },
  actionBody: { paddingHorizontal: 12, paddingBottom: 14, borderTopWidth: 1, borderTopColor: colors.border },
});
