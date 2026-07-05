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
  const [response, setResponse] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const r = await api(`/reports/${id}`);
      setReport(r);
      setResponse(r.admin_response || "");
    } catch (e: any) {
      Alert.alert("Lỗi", e.message);
    }
  };

  useEffect(() => { if (id) load(); }, [id]);

  const update = async (status: string) => {
    setSaving(true);
    try {
      await api(`/reports/${id}`, { method: "PUT", body: { status, admin_response: response } });
      Alert.alert("Đã cập nhật", "Trạng thái báo cáo đã được cập nhật");
      load();
    } catch (e: any) {
      Alert.alert("Lỗi", e.message);
    } finally {
      setSaving(false);
    }
  };

  if (!report) return <SafeAreaView style={styles.container}><ActivityIndicator style={{ marginTop: 40 }} /></SafeAreaView>;

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

        <Text style={styles.section}>PHẢN HỒI CỦA QUẢN LÝ</Text>
        <TextInput
          testID="admin-response-input"
          style={styles.input}
          value={response}
          onChangeText={setResponse}
          placeholder="Nhập phản hồi gửi cho người dân..."
          placeholderTextColor={colors.textMuted}
          multiline
        />

        <View style={styles.actions}>
          <TouchableOpacity testID="action-processing" style={[styles.btn, { backgroundColor: colors.primary }]} onPress={() => update("processing")} disabled={saving}>
            <Text style={styles.btnText}>Đang xử lý</Text>
          </TouchableOpacity>
          <TouchableOpacity testID="action-resolved" style={[styles.btn, { backgroundColor: colors.success }]} onPress={() => update("resolved")} disabled={saving}>
            <Text style={styles.btnText}>Duyệt</Text>
          </TouchableOpacity>
          <TouchableOpacity testID="action-rejected" style={[styles.btn, { backgroundColor: colors.alert }]} onPress={() => update("rejected")} disabled={saving}>
            <Text style={styles.btnText}>Từ chối</Text>
          </TouchableOpacity>
        </View>
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
  actions: { flexDirection: "row", gap: 8, marginTop: spacing.lg },
  btn: { flex: 1, paddingVertical: 14, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "800", fontSize: 13 },
});
