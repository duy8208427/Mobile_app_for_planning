import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../src/api";
import { colors, spacing } from "../src/theme";
import { StatusBadge } from "./(tabs)/index";
import { caseDetailHref, formatDateTime } from "../src/cases";
import { CaseHeader, Timeline } from "../src/components/CaseProgress";

export default function ReportDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [report, setReport] = useState<any>(null);
  const [caseData, setCaseData] = useState<any>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    api(`/reports/${id}`)
      .then((r) => {
        setReport(r);
        if (r?.case_id) {
          api(`/cases/${r.case_id}`).then(setCaseData).catch(() => {});
        }
      })
      .catch((e: any) => setError(e?.message || "Không tải được báo cáo"));
  }, [id]);

  if (!report) {
    return (
      <SafeAreaView style={styles.container}>
        {error ? <Text style={styles.error}>{error}</Text> : <ActivityIndicator style={{ marginTop: 40 }} />}
      </SafeAreaView>
    );
  }

  const photos: string[] = [report.image_base64, ...(report.images || [])].filter(Boolean);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Chi tiết báo cáo</Text>
        <View style={{ width: 36 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{report.title}</Text>
          {!caseData ? <StatusBadge status={report.status} /> : null}
        </View>
        <Text style={styles.meta}>📍 {report.address}</Text>
        <Text style={styles.meta}>🕒 {formatDateTime(report.created_at)}</Text>

        {caseData ? (
          <>
            <Text style={styles.section}>TIẾN ĐỘ HỒ SƠ</Text>
            <CaseHeader
              code={caseData.code}
              status={caseData.status}
              statusLabel={caseData.citizen_status_label || caseData.status_label}
              step={caseData.step}
              phase={caseData.phase}
              phaseLabel={caseData.phase_label}
            />
            <View style={styles.timelineBox}>
              <Timeline items={caseData.timeline || []} />
            </View>
            <TouchableOpacity
              style={styles.caseLink}
              onPress={() => router.push(caseDetailHref(caseData.id))}
              testID="open-case-progress"
            >
              <Text style={styles.caseLinkText}>Xem hồ sơ {caseData.code}</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.primary} />
            </TouchableOpacity>
          </>
        ) : null}

        {photos.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginTop: spacing.md }}>
            {photos.map((p, i) => (
              <Image key={i} source={{ uri: p }} style={photos.length > 1 ? styles.thumb : styles.image} />
            ))}
          </ScrollView>
        ) : null}

        <Text style={styles.section}>MÔ TẢ</Text>
        <Text style={styles.body}>{report.description}</Text>

        {report.admin_response && (
          <>
            <Text style={styles.section}>PHẢN HỒI TỪ CƠ QUAN QUẢN LÝ</Text>
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
  error: { color: colors.alert, padding: spacing.lg, textAlign: "center" },
  titleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  title: { flex: 1, fontSize: 22, fontWeight: "800", color: colors.text, letterSpacing: -0.3 },
  meta: { color: colors.textMuted, marginTop: 4, fontSize: 13 },
  image: { width: 320, height: 220, backgroundColor: "#000" },
  thumb: { width: 160, height: 160, backgroundColor: "#000", borderRadius: 8 },
  section: { fontSize: 11, fontWeight: "800", color: colors.textMuted, letterSpacing: 1, marginTop: spacing.lg, marginBottom: 6 },
  body: { color: colors.text, lineHeight: 20 },
  responseBox: { backgroundColor: "#EEF2FF", borderLeftWidth: 3, borderLeftColor: colors.primary, padding: 12 },
  timelineBox: { backgroundColor: "#fff", borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: spacing.md, marginTop: 8 },
  caseLink: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 8, alignSelf: "flex-end" },
  caseLinkText: { color: colors.primary, fontWeight: "700", fontSize: 13 },
});
