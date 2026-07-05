import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../src/api";
import { colors, spacing } from "../src/theme";

type AdministrativeProcedureDetail = {
  id: string;
  title: string;
  category: string;
  order: number;
  content?: string | null;
  required_documents?: string[];
  processing_time?: string;
  fee?: string;
  receiving_agency?: string;
  legal_basis?: string[];
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.sectionCard}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

export default function AdministrativeProcedureDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [detail, setDetail] = useState<AdministrativeProcedureDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    const loadDetail = async () => {
      if (!id) {
        setError("Thiếu mã thủ tục");
        setLoading(false);
        return;
      }
      setLoading(true);
      setError("");
      try {
        const data = await api(`/administrative-procedures/${id}`);
        if (!mounted) return;
        setDetail(data as AdministrativeProcedureDetail);
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message || "Không tải được chi tiết thủ tục");
        setDetail(null);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadDetail();
    return () => {
      mounted = false;
    };
  }, [id]);

  return (
    <SafeAreaView style={styles.container} testID="administrative-procedure-detail-screen">
      <View style={styles.header}>
        <TouchableOpacity
          testID="administrative-procedure-detail-back"
          onPress={() => router.back()}
          style={styles.backBtn}
        >
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Chi tiết thủ tục</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.stateText}>Đang tải chi tiết...</Text>
        </View>
      ) : error || !detail ? (
        <View style={styles.centerState}>
          <Ionicons name="alert-circle-outline" size={26} color={colors.alert} />
          <Text style={styles.stateText}>{error || "Không tìm thấy thủ tục"}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.topCard}>
            <Text style={styles.categoryText}>{detail.category}</Text>
            <Text style={styles.titleText}>{detail.title}</Text>
            {detail.content ? <Text style={styles.summaryText}>{detail.content}</Text> : null}
          </View>

          <Section title="Hồ sơ cần nộp">
            {(detail.required_documents && detail.required_documents.length > 0
              ? detail.required_documents
              : ["Đang cập nhật"]).map((item, idx) => (
              <View key={`${item}-${idx}`} style={styles.bulletRow}>
                <Text style={styles.bullet}>•</Text>
                <Text style={styles.bulletText}>{item}</Text>
              </View>
            ))}
          </Section>

          <Section title="Thời hạn xử lý">
            <Text style={styles.infoText}>{detail.processing_time || "Đang cập nhật"}</Text>
          </Section>

          <Section title="Lệ phí">
            <Text style={styles.infoText}>{detail.fee || "Đang cập nhật"}</Text>
          </Section>

          <Section title="Cơ quan tiếp nhận">
            <Text style={styles.infoText}>{detail.receiving_agency || "Đang cập nhật"}</Text>
          </Section>

          <Section title="Căn cứ pháp lý">
            {(detail.legal_basis && detail.legal_basis.length > 0 ? detail.legal_basis : ["Đang cập nhật"]).map(
              (item, idx) => (
                <View key={`${item}-${idx}`} style={styles.bulletRow}>
                  <Text style={styles.bullet}>•</Text>
                  <Text style={styles.bulletText}>{item}</Text>
                </View>
              )
            )}
          </Section>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5FAFF" },
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
  content: { padding: spacing.lg, paddingBottom: spacing.xl },
  topCard: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  categoryText: { color: "#1D4ED8", fontWeight: "700", fontSize: 12, marginBottom: 6 },
  titleText: { color: "#0F172A", fontSize: 19, fontWeight: "800", lineHeight: 26 },
  summaryText: { color: "#64748B", marginTop: 8, lineHeight: 20 },
  sectionCard: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  sectionTitle: { color: "#334155", fontWeight: "800", fontSize: 13, marginBottom: 6 },
  bulletRow: { flexDirection: "row", alignItems: "flex-start", marginTop: 4 },
  bullet: { color: "#0F172A", marginRight: 8, lineHeight: 20 },
  bulletText: { color: "#475569", flex: 1, lineHeight: 20 },
  infoText: { color: "#475569", lineHeight: 20 },
  centerState: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: spacing.lg },
  stateText: { color: colors.textMuted, textAlign: "center" },
});
