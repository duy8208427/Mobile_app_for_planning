import { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import MapHtmlView from "../src/components/MapHtmlView";
import { api } from "../src/api";
import { useAuth } from "../src/auth";
import { colors, spacing } from "../src/theme";
import { violationMapHtml } from "../src/mapHtml";
import { caseDetailHref, notify } from "../src/cases";

const RULE: Record<string, string> = {
  SAI_MDSD: "Sai mục đích sử dụng đất",
  LAN_RANH: "Lấn ranh thửa",
  NHA_MOI: "Nhà mới so với địa chính",
};

const STATUS: Record<string, string> = {
  pending_review: "Chờ cán bộ duyệt",
  confirmed: "Đã xác nhận",
  rejected: "Đã bác bỏ",
};

export default function ViolationDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const isStaff = user?.role === "manager" || user?.role === "admin";
  const isAdmin = user?.role === "admin";
  const [item, setItem] = useState<any>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [opening, setOpening] = useState(false);

  const openCase = async () => {
    if (!item) return;
    setOpening(true);
    try {
      const c = await api(`/cases/from-violation/${item.id}`, { method: "POST" });
      setItem((prev: any) => (prev ? { ...prev, case_id: c.id } : prev));
      router.push(caseDetailHref(c.id));
    } catch (e: any) {
      notify("Không mở được hồ sơ", e?.message || "Vui lòng thử lại");
    } finally {
      setOpening(false);
    }
  };

  useEffect(() => {
    if (!id) return;
    api(`/violations/${id}`)
      .then(setItem)
      .catch((e: any) => setError(e?.message || "Không tải được"));
  }, [id]);

  const html = useMemo(() => {
    if (!item?.geometry) return "";
    const gj = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: item.geometry,
          properties: item,
        },
      ],
    };
    return violationMapHtml(gj, [item.longitude || 105.634, item.latitude || 10.457]);
  }, [item]);

  return (
    <SafeAreaView style={styles.container} testID="violation-detail-screen">
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Chi tiết nghi vấn</Text>
        <View style={{ width: 24 }} />
      </View>
      {!item && !error ? <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {item ? (
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
          {html ? (
            <View style={{ height: 220 }}>
              <MapHtmlView html={html} />
            </View>
          ) : null}
          <View style={styles.body}>
            <Text style={styles.kicker}>{RULE[item.rule_id] || item.rule_id}</Text>
            <Text style={styles.reason}>{item.reason}</Text>
            <Row label="Trạng thái" value={STATUS[item.status] || item.status} />
            <Row label="Tờ / thửa" value={`${item.so_to || "—"} / ${item.so_thua || "—"}`} />
            <Row label="Loại đất" value={item.loai_dat || "—"} />
            <Row label="Diện tích lệch" value={item.area_m2 != null ? `${item.area_m2} m²` : "—"} />
            <Row
              label="Độ tin cậy AI"
              value={item.confidence != null ? `${Math.round(item.confidence * 100)}%` : "—"}
            />
            {item.review_note ? <Row label="Ghi chú duyệt" value={item.review_note} /> : null}
            {isAdmin ? (
              <TouchableOpacity
                testID="open-precheck-case"
                disabled={opening}
                style={[styles.caseBtn, opening && { opacity: 0.6 }]}
                onPress={openCase}
              >
                {opening ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="folder-open-outline" size={18} color="#fff" />
                    <Text style={styles.caseBtnText}>{item.case_id ? "Xem hồ sơ vụ việc" : "Mở hồ sơ tiền kiểm"}</Text>
                  </>
                )}
              </TouchableOpacity>
            ) : null}
            {isStaff && item.status === "pending_review" && !item.case_id ? (
              <View style={styles.actions}>
                <TouchableOpacity
                  disabled={busy}
                  style={styles.rejectBtn}
                  onPress={async () => {
                    setBusy(true);
                    try {
                      const updated = await api(`/violations/${item.id}/review`, {
                        method: "PATCH",
                        body: { status: "rejected" },
                      });
                      setItem(updated);
                    } catch (e: any) {
                      setError(e?.message || "Không cập nhật được");
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  <Text style={styles.rejectText}>Không vi phạm</Text>
                </TouchableOpacity>
              </View>
            ) : null}
            <Text style={styles.disclaimer}>
              Kết quả do AI gợi ý từ ảnh flycam đối chiếu bản đồ địa chính, chưa phải quyết định xử lý vi phạm.
            </Text>
          </View>
        </ScrollView>
      ) : null}
    </SafeAreaView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
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
  },
  title: { fontSize: 18, fontWeight: "800", color: colors.text },
  error: { color: colors.alert, padding: spacing.lg },
  body: { padding: spacing.lg },
  kicker: { color: colors.primary, fontWeight: "800", fontSize: 12, letterSpacing: 0.4 },
  reason: { fontSize: 18, fontWeight: "700", color: colors.text, marginTop: 8, marginBottom: 16 },
  row: { marginBottom: 10 },
  label: { fontSize: 12, color: colors.textMuted },
  value: { fontSize: 15, color: colors.text, marginTop: 2 },
  disclaimer: { marginTop: 20, fontSize: 12, color: colors.textMuted, lineHeight: 18 },
  actions: { marginTop: 16, gap: 8 },
  caseBtn: {
    marginTop: 12,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  caseBtnText: { color: "#fff", fontWeight: "700" },
  confirmBtn: { backgroundColor: colors.success, paddingVertical: 12, alignItems: "center" },
  confirmText: { color: "#fff", fontWeight: "700" },
  rejectBtn: { borderWidth: 1, borderColor: colors.borderStrong, paddingVertical: 12, alignItems: "center" },
  rejectText: { color: colors.text, fontWeight: "700" },
});
