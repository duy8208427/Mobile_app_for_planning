import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../src/api";
import { useAuth } from "../src/auth";
import { colors, spacing } from "../src/theme";
import {
  SOURCE_LABELS,
  deadlineText,
  formatDate,
  formatDateTime,
  formatMoney,
  isStaffRole,
  loadCatalog,
  type Catalog,
} from "../src/cases";
import { CaseHeader, Timeline } from "../src/components/CaseProgress";
import CaseActionPanel from "../src/components/CaseActionForms";

const PERMIT_STATUS: Record<string, string> = {
  waiting: "Đang chờ cấp/điều chỉnh giấy phép",
  granted: "Đã nộp giấy phép",
  expired: "Hết hạn / không được cấp phép",
};

export default function CaseDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [item, setItem] = useState<any>(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [catalog, setCatalog] = useState<Catalog | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setError("");
      setItem(await api(`/cases/${id}`));
    } catch (e: any) {
      setError(e?.message || "Không tải được hồ sơ");
    }
  }, [id]);

  useEffect(() => {
    load();
    loadCatalog().then(setCatalog).catch(() => {});
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const staff = isStaffRole(user?.role);
  const isViolator = !!item && !!user && item.violator_user_id === user.id;
  const reporterOnly = !!item && !staff && !isViolator;
  const workTypeName = (k?: string) => (k ? catalog?.work_types?.[k] || k : "—");
  const subjectName = (k?: string) => (k ? catalog?.subject_types?.[k] || k : "—");
  const stateName = (k?: string) => (k ? catalog?.construction_states?.[k] || k : "—");
  const codeName = (k?: string) => (k ? catalog?.violations.find((v) => v.code === k)?.name || k : "—");

  return (
    <SafeAreaView style={styles.container} testID="case-detail-screen">
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} testID="case-detail-back">
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{reporterOnly ? "Tiến độ xử lý" : "Hồ sơ vụ việc"}</Text>
        <View style={{ width: 36 }} />
      </View>
      {!item && !error ? <ActivityIndicator color={colors.primary} style={{ marginTop: 32 }} /> : null}
      {error && !item ? (
        <View style={styles.errorWrap}>
          <Text style={styles.error}>{error}</Text>
          <TouchableOpacity onPress={load} style={styles.retry}>
            <Text style={styles.retryText}>Thử lại</Text>
          </TouchableOpacity>
        </View>
      ) : null}
      {item ? (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView
            contentContainerStyle={{ padding: spacing.md, paddingBottom: 60 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            keyboardShouldPersistTaps="handled"
          >
            <CaseHeader
              code={item.code}
              title={item.title}
              status={item.status}
              statusLabel={reporterOnly ? item.citizen_status_label : item.status_label}
              step={item.step}
              phase={item.phase}
              phaseLabel={item.phase_label}
              deadline={reporterOnly ? null : item.deadline}
              overdue={reporterOnly ? false : item.overdue}
            />

            {reporterOnly ? (
              <>
                {item.address ? (
                  <Section title="THÔNG TIN PHẢN ÁNH">
                    <Row label="Địa chỉ" value={item.address} />
                    <Row label="Gửi lúc" value={formatDateTime(item.created_at)} />
                  </Section>
                ) : null}
                <Section title="TIẾN ĐỘ XỬ LÝ">
                  <Timeline items={item.timeline || []} />
                </Section>
                <Text style={styles.footNote}>
                  Vì lý do bảo mật, người phản ánh chỉ xem được tiến độ xử lý, không xem thông tin người vi phạm.
                </Text>
              </>
            ) : (
              <>
                <CaseActionPanel caseData={item} role={user?.role} onUpdated={setItem} />

                {staff ? (
                  <Section title="THÔNG TIN VỤ VIỆC">
                    <Row label="Nguồn" value={SOURCE_LABELS[item.source] || item.source || "—"} />
                    {item.reporter_name ? <Row label="Người phản ánh" value={item.reporter_name} /> : null}
                    <Row label="Địa chỉ" value={item.address || "—"} />
                    {item.latitude != null && item.longitude != null ? (
                      <Row label="Toạ độ" value={`${Number(item.latitude).toFixed(5)}, ${Number(item.longitude).toFixed(5)}`} />
                    ) : null}
                    <Row label="Tờ / thửa" value={`${item.so_to || "—"} / ${item.so_thua || "—"}`} />
                    <Row label="Loại đất" value={item.loai_dat || "—"} />
                    {item.violation_code ? <Row label="Hành vi" value={item.violation_name || codeName(item.violation_code)} /> : null}
                    {item.description ? <Row label="Mô tả" value={item.description} /> : null}
                    <Row label="Tạo lúc" value={formatDateTime(item.created_at)} />
                    <Photos photos={item.photos} />
                  </Section>
                ) : (
                  <Section title="THÔNG TIN VỤ VIỆC">
                    <Row label="Địa chỉ" value={item.address || "—"} />
                    {item.violation_code ? <Row label="Hành vi" value={item.violation_name || codeName(item.violation_code)} /> : null}
                  </Section>
                )}

                {item.precheck ? (
                  <Section title="TIỀN KIỂM">
                    <Row label="Kết quả" value={item.precheck.result === "no_violation" ? "Không vi phạm" : "Có dấu hiệu vi phạm"} />
                    {item.precheck.violation_code ? <Row label="Hành vi nghi vấn" value={codeName(item.precheck.violation_code)} /> : null}
                    {item.precheck.notes ? <Row label="Ghi chú" value={item.precheck.notes} /> : null}
                    <Row label="Người tiền kiểm" value={`${item.precheck.by_name || "—"} · ${formatDateTime(item.precheck.at)}`} />
                  </Section>
                ) : null}

                {item.assignment?.officer_name ? (
                  <Section title="GIAO VIỆC">
                    <Row label="Cán bộ Xử lý" value={item.assignment.officer_name} />
                    <Row label="Hạn kiểm tra" value={formatDate(item.assignment.due_date)} />
                    {item.assignment.instructions ? <Row label="Chỉ đạo" value={item.assignment.instructions} /> : null}
                  </Section>
                ) : null}

                {item.inspection?.record_no ? (
                  <Section title="BIÊN BẢN HIỆN TRƯỜNG">
                    <Row label="Số biên bản" value={item.inspection.record_no} />
                    {item.inspection.description ? <Row label="Nội dung" value={item.inspection.description} /> : null}
                    {item.inspection.area_m2 != null ? <Row label="Diện tích vi phạm" value={`${item.inspection.area_m2} m²`} /> : null}
                    <Row label="Loại công trình" value={workTypeName(item.work_type)} />
                    <Row label="Tình trạng thi công" value={stateName(item.construction_state)} />
                    {item.violator ? (
                      <Row
                        label="Người vi phạm"
                        value={[
                          item.violator.name,
                          subjectName(item.violator.subject_type),
                          item.violator.phone,
                          item.violator.address,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      />
                    ) : null}
                    {item.inspection.stop_order ? <Row label="Yêu cầu chấm dứt vi phạm" value="Đã yêu cầu" /> : null}
                    <Row label="Lập bởi" value={`${item.inspection.by_name || "—"} · ${formatDateTime(item.inspection.submitted_at)}`} />
                    <Photos photos={item.inspection.photos} />
                  </Section>
                ) : null}

                {item.repeat ? (
                  <Section title="TIẾP TỤC THI CÔNG SAU BIÊN BẢN" tone="danger">
                    <Row label="Áp dụng" value={item.repeat.clause === "k12" ? "Khoản 12 Điều 25 (sau quyết định)" : "Khoản 11 Điều 25"} />
                    {item.repeat.note ? <Row label="Ghi nhận" value={item.repeat.note} /> : null}
                    <Row label="Người ghi nhận" value={`${item.repeat.by_name || "—"} · ${formatDateTime(item.repeat.at)}`} />
                    <Photos photos={item.repeat.photos} />
                  </Section>
                ) : null}

                {item.decision ? (
                  <Section title="QUYẾT ĐỊNH XỬ PHẠT">
                    <Row label="Số quyết định" value={item.decision.decision_no} />
                    {item.decision.issued_date ? <Row label="Ngày ban hành" value={formatDate(item.decision.issued_date)} /> : null}
                    <Row label="Hành vi" value={codeName(item.decision.violation_code)} />
                    <Row label="Mức phạt" value={formatMoney(item.decision.fine_amount)} strong />
                    {item.decision.fine_min != null ? (
                      <Row label="Khung phạt" value={`${formatMoney(item.decision.fine_min)} – ${formatMoney(item.decision.fine_max)}`} />
                    ) : null}
                    <Row label="Căn cứ" value={item.decision.legal_basis || "—"} />
                    {item.decision.remedy ? <Row label="Biện pháp khắc phục" value={item.decision.remedy} /> : null}
                    {item.decision.remedy_deadline ? (
                      <Row
                        label="Hạn khắc phục"
                        value={`${formatDate(item.decision.remedy_deadline)} (${deadlineText(item.decision.remedy_deadline)})`}
                      />
                    ) : null}
                    {item.decision.extra_penalties ? <Row label="Xử phạt bổ sung" value={item.decision.extra_penalties} /> : null}
                    {item.decision.exceeds_commune_authority ? (
                      <Text style={styles.warnText}>Mức phạt vượt thẩm quyền Chủ tịch UBND cấp xã.</Text>
                    ) : null}
                    {catalog?.legal_note ? <Text style={styles.legalNote}>{catalog.legal_note}</Text> : null}
                  </Section>
                ) : null}

                {item.permit_track ? (
                  <Section title="CẤP PHÉP THEO ĐIỀU 85">
                    <Row label="Trạng thái" value={PERMIT_STATUS[item.permit_track.status] || item.permit_track.status} />
                    <Row
                      label="Hạn được cấp phép"
                      value={`${formatDate(item.permit_track.deadline)}${item.permit_track.days ? ` (${item.permit_track.days} ngày)` : ""}${
                        item.permit_track.status === "waiting" ? ` · ${deadlineText(item.permit_track.deadline)}` : ""
                      }`}
                    />
                    {item.permit_track.permit_no ? <Row label="Số giấy phép" value={item.permit_track.permit_no} /> : null}
                  </Section>
                ) : null}

                {item.remediation ? (
                  <Section title="KẾT QUẢ KHẮC PHỤC">
                    <Row label="Nộp phạt" value={item.remediation.fine_paid ? "Đã nộp phạt" : "Chưa nộp phạt"} />
                    {item.remediation.notes ? <Row label="Ghi chú" value={item.remediation.notes} /> : null}
                    <Row label="Báo cáo bởi" value={`${item.remediation.by_name || "—"} · ${formatDateTime(item.remediation.at)}`} />
                    {item.remediation.receipt_photo ? <Photos photos={[item.remediation.receipt_photo]} label="Biên lai" /> : null}
                    <Photos photos={item.remediation.photos} />
                  </Section>
                ) : null}

                {item.reinspection ? (
                  <Section title={item.reinspection.kind === "permit_check" ? "KIỂM TRA SAU CẤP PHÉP" : "HẬU KIỂM"}>
                    <Row label="Hạn kiểm tra" value={formatDate(item.reinspection.due_date)} />
                    <Row
                      label="Kết quả"
                      value={
                        item.reinspection.result === "pass"
                          ? "Đạt"
                          : item.reinspection.result === "fail"
                            ? "Không đạt"
                            : "Chưa có kết quả"
                      }
                    />
                    {item.reinspection.notes ? <Row label="Ghi chú" value={item.reinspection.notes} /> : null}
                    {item.reinspection.by_name ? (
                      <Row label="Cán bộ" value={`${item.reinspection.by_name} · ${formatDateTime(item.reinspection.done_at)}`} />
                    ) : null}
                    <Photos photos={item.reinspection.photos} />
                  </Section>
                ) : null}

                {item.closed ? (
                  <Section title="ĐÓNG HỒ SƠ">
                    <Row label="Lý do" value={item.closed.reason || "—"} />
                    <Row label="Người đóng" value={`${item.closed.by_name || "—"} · ${formatDateTime(item.closed.at)}`} />
                  </Section>
                ) : null}

                <Section title="DÒNG THỜI GIAN">
                  <Timeline items={item.timeline || []} />
                </Section>
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      ) : null}
    </SafeAreaView>
  );
}

function Section({ title, children, tone }: { title: string; children: ReactNode; tone?: "danger" }) {
  return (
    <View style={{ marginTop: spacing.lg }}>
      <Text style={[styles.sectionTitle, tone === "danger" && { color: colors.alert }]}>{title}</Text>
      <View style={[styles.card, tone === "danger" && { borderColor: "#FECACA" }]}>{children}</View>
    </View>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, strong && { fontWeight: "800", fontSize: 16 }]}>{value}</Text>
    </View>
  );
}

function Photos({ photos, label }: { photos?: string[]; label?: string }) {
  const list = (photos || []).filter(Boolean);
  if (!list.length) return null;
  return (
    <View style={{ marginTop: 6 }}>
      {label ? <Text style={styles.rowLabel}>{label}</Text> : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
        {list.map((p, i) => (
          <Image key={i} source={{ uri: p }} style={styles.photo} />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: "#fff",
  },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 16, fontWeight: "800", color: colors.text },
  errorWrap: { padding: spacing.lg, alignItems: "center" },
  error: { color: colors.alert, textAlign: "center" },
  retry: { marginTop: 10, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: colors.border, borderRadius: 999 },
  retryText: { color: colors.primary, fontWeight: "700" },
  sectionTitle: { fontSize: 11, fontWeight: "800", color: colors.textMuted, letterSpacing: 1.1, marginBottom: 8 },
  card: { backgroundColor: "#fff", borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: spacing.md },
  row: { marginBottom: 8 },
  rowLabel: { fontSize: 11, color: colors.textMuted },
  rowValue: { fontSize: 14, color: colors.text, marginTop: 1, lineHeight: 19 },
  photo: { width: 120, height: 120, borderRadius: 8, backgroundColor: "#E2E8F0" },
  warnText: { color: colors.alert, fontWeight: "700", fontSize: 12, marginTop: 4 },
  legalNote: { fontSize: 11, color: colors.textMuted, fontStyle: "italic", marginTop: 8, lineHeight: 16 },
  footNote: { fontSize: 11, color: colors.textMuted, marginTop: spacing.md, lineHeight: 16 },
});
