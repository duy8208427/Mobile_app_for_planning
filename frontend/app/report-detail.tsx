import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../src/api";
import { colors, spacing } from "../src/theme";
import { StatusBadge } from "./(tabs)/index";

export default function ReportDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [report, setReport] = useState<any>(null);

  useEffect(() => { if (id) api(`/reports/${id}`).then(setReport).catch(() => {}); }, [id]);

  if (!report) return <SafeAreaView style={styles.container}><ActivityIndicator style={{ marginTop: 40 }} /></SafeAreaView>;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Chi tiết báo cáo</Text>
        <View style={{ width: 36 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{report.title}</Text>
          <StatusBadge status={report.status} />
        </View>
        <Text style={styles.meta}>📍 {report.address}</Text>
        <Text style={styles.meta}>🕒 {new Date(report.created_at).toLocaleString("vi-VN")}</Text>

        {report.image_base64 && <Image source={{ uri: report.image_base64 }} style={styles.image} />}

        <Text style={styles.section}>MÔ TẢ</Text>
        <Text style={styles.body}>{report.description}</Text>

        {report.admin_response && (
          <>
            <Text style={styles.section}>PHẢN HỒI TỪ QUẢN LÝ</Text>
            <View style={styles.responseBox}>
              <Text style={styles.body}>{report.admin_response}</Text>
              {report.handled_by && <Text style={[styles.meta, { marginTop: 6 }]}>— {report.handled_by}</Text>}
            </View>
          </>
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
  responseBox: { backgroundColor: "#EEF2FF", borderLeftWidth: 3, borderLeftColor: colors.primary, padding: 12 },
});
