import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, TextInput, Alert, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../src/api";
import { colors, spacing } from "../src/theme";
import { StatusBadge } from "./(tabs)/index";

export default function AdminReport() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [report, setReport] = useState<any>(null);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const r = await api(`/reports/${id}`);
      setReport(r);
      setNotes(r.implementer_notes || "");
    } catch (e: any) {
      Alert.alert("Lỗi", e.message);
    }
  };

  useEffect(() => { if (id) load(); }, [id]);

  const submitForApproval = async () => {
    const trimmed = notes.trim();
    if (!trimmed) {
      Alert.alert("Thiếu nội dung", "Vui lòng nhập nội dung xử lý trước khi gửi Admin.");
      return;
    }
    setSaving(true);
    try {
      await api(`/reports/${id}`, {
        method: "PUT",
        body: { status: "pending_approval", implementer_notes: trimmed },
      });
      Alert.alert("Đã gửi", "Báo cáo đã được gửi Admin phê duyệt.");
      load();
    } catch (e: any) {
      Alert.alert("Lỗi", e.message);
    } finally {
      setSaving(false);
    }
  };

  if (!report) return <SafeAreaView style={styles.container}><ActivityIndicator style={{ marginTop: 40 }} /></SafeAreaView>;

  const status = report.status === "processing" ? "assigned" : report.status;
  const canSubmit = status === "assigned";

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Xử lý báo cáo</Text>
        <View style={{ width: 36 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{report.title}</Text>
          <StatusBadge status={report.status} />
        </View>
        <Text style={styles.meta}>👤 {report.user_name}</Text>
        <Text style={styles.meta}>📍 {report.address}</Text>
        {report.latitude ? <Text style={styles.meta}>🌐 {report.latitude.toFixed(5)}, {report.longitude.toFixed(5)}</Text> : null}
        <Text style={styles.meta}>🕒 {new Date(report.created_at).toLocaleString("vi-VN")}</Text>

        {report.image_base64 && (
          <Image source={{ uri: report.image_base64 }} style={styles.image} />
        )}

        <Text style={styles.section}>MÔ TẢ</Text>
        <Text style={styles.body}>{report.description}</Text>

        {report.admin_response ? (
          <>
            <Text style={styles.section}>PHẢN HỒI ADMIN</Text>
            <Text style={styles.body}>{report.admin_response}</Text>
          </>
        ) : null}

        <Text style={styles.section}>NỘI DUNG XỬ LÝ</Text>
        {canSubmit ? (
          <TextInput
            testID="implementer-notes-input"
            style={styles.input}
            value={notes}
            onChangeText={setNotes}
            placeholder="Nhập kết quả kiểm tra / xử lý gửi Admin phê duyệt..."
            placeholderTextColor={colors.textMuted}
            multiline
          />
        ) : (
          <Text style={styles.body}>{report.implementer_notes || "—"}</Text>
        )}

        {canSubmit && (
          <View style={styles.actions}>
            <TouchableOpacity
              testID="action-pending-approval"
              style={[styles.btn, { backgroundColor: colors.primary }]}
              onPress={submitForApproval}
              disabled={saving}
            >
              <Text style={styles.btnText}>{saving ? "Đang gửi…" : "Gửi Admin phê duyệt"}</Text>
            </TouchableOpacity>
          </View>
        )}

        {status === "pending_approval" && (
          <Text style={styles.hint}>Đã gửi Admin — đang chờ phê duyệt.</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: "#fff" },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 16, fontWeight: "800", color: colors.text },
  titleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  title: { flex: 1, fontSize: 22, fontWeight: "800", color: colors.text, letterSpacing: -0.3 },
  meta: { color: colors.textMuted, marginTop: 4, fontSize: 13 },
  image: { width: "100%", height: 220, marginTop: spacing.md, backgroundColor: "#000" },
  section: { fontSize: 11, fontWeight: "800", color: colors.textMuted, letterSpacing: 1, marginTop: spacing.lg, marginBottom: 6 },
  body: { color: colors.text, lineHeight: 20 },
  input: { borderWidth: 1, borderColor: colors.border, backgroundColor: "#fff", padding: 12, minHeight: 90, textAlignVertical: "top", color: colors.text },
  actions: { marginTop: spacing.lg },
  btn: { paddingVertical: 14, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "800", fontSize: 14 },
  hint: { marginTop: spacing.md, color: colors.textMuted, fontSize: 13, fontStyle: "italic" },
});
