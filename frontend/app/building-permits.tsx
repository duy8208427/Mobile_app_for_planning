import { View, Text, StyleSheet, FlatList, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { constructionPermits } from "../src/data/constructionPermits";
import { colors, spacing } from "../src/theme";

export default function BuildingPermits() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container} testID="building-permits-screen">
      <View style={styles.header}>
        <TouchableOpacity
          testID="building-permits-back"
          onPress={() => router.back()}
          style={styles.backBtn}
        >
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Giấy phép xây dựng</Text>
        <View style={{ width: 36 }} />
      </View>

      <FlatList
        data={constructionPermits}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing.lg }}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        renderItem={({ item }) => (
          <TouchableOpacity
            testID={`building-permit-item-${item.id}`}
            style={styles.card}
            activeOpacity={0.85}
            onPress={() =>
              router.push({ pathname: "/building-permit-detail", params: { id: item.id } })
            }
          >
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.permitLine}>
              GPXD: {item.permitCode} {item.permitDate}
            </Text>
            <Text style={styles.infoLine}>
              <Text style={styles.label}>Chủ đầu tư: </Text>
              {item.investor}
            </Text>
            <Text style={styles.infoLine}>
              <Text style={styles.label}>Địa điểm: </Text>
              {item.address}
            </Text>
            <Text style={styles.infoLine}>
              <Text style={styles.label}>Quận huyện: </Text>
              {item.district}
            </Text>
          </TouchableOpacity>
        )}
      />
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
  separator: { height: 1, backgroundColor: colors.border },
  card: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  title: {
    fontSize: 16,
    fontWeight: "800",
    color: "#7B2D26",
    lineHeight: 22,
    marginBottom: 6,
  },
  permitLine: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0E7490",
    marginBottom: 8,
  },
  infoLine: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 20,
    marginTop: 2,
  },
  label: {
    fontWeight: "700",
    color: colors.text,
  },
});
