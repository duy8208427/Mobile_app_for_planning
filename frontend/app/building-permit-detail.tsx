import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { getPermitById } from "../src/data/constructionPermits";
import { colors, spacing } from "../src/theme";

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

export default function BuildingPermitDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const permit = id ? getPermitById(id) : undefined;

  return (
    <SafeAreaView style={styles.container} testID="building-permit-detail-screen">
      <View style={styles.header}>
        <TouchableOpacity
          testID="building-permit-detail-back"
          onPress={() => router.back()}
          style={styles.backBtn}
        >
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Chi tiết GPXD</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
        {permit ? (
          <>
            <Text style={styles.title}>{permit.title}</Text>
            <Text style={styles.permitLine}>
              GPXD: {permit.permitCode} {permit.permitDate}
            </Text>

            <View style={styles.divider} />

            <Text style={styles.sectionTitle}>THÔNG TIN GIẤY PHÉP</Text>
            <View style={styles.card}>
              <DetailRow label="Mã giấy phép" value={permit.permitCode} />
              <DetailRow label="Ngày cấp" value={permit.permitDate} />
              <DetailRow label="Trạng thái" value={permit.status || "Đã cấp phép"} />
              <DetailRow label="Loại công trình" value={permit.projectType || "—"} />
            </View>

            <Text style={styles.sectionTitle}>CHỦ ĐẦU TƯ & ĐỊA ĐIỂM</Text>
            <View style={styles.card}>
              <DetailRow label="Chủ đầu tư" value={permit.investor} />
              <DetailRow label="Địa điểm" value={permit.address} />
              <DetailRow label="Quận/Huyện" value={permit.district} />
            </View>

            {permit.note ? (
              <>
                <Text style={styles.sectionTitle}>GHI CHÚ</Text>
                <Text style={styles.note}>{permit.note}</Text>
              </>
            ) : null}
          </>
        ) : (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Không tìm thấy giấy phép</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
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
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: "#7B2D26",
    letterSpacing: -0.3,
    lineHeight: 28,
  },
  permitLine: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0E7490",
    marginTop: 8,
  },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.md },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.textMuted,
    letterSpacing: 1,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  card: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  row: { marginBottom: spacing.sm },
  rowLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.textMuted,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  rowValue: { fontSize: 14, color: colors.text, lineHeight: 20 },
  note: { fontSize: 14, color: colors.text, lineHeight: 22 },
  empty: { padding: spacing.xl, alignItems: "center" },
  emptyText: { color: colors.textMuted },
});
