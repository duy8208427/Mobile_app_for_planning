import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { api } from "../src/api";
import { colors, spacing } from "../src/theme";

type SocialHousingProject = {
  id: string;
  name: string;
  district: string;
  ward?: string | null;
  address: string;
  investor: string;
  updated_at?: string;
};

export default function SocialHousingScreen() {
  const router = useRouter();
  const [projects, setProjects] = useState<SocialHousingProject[]>([]);
  const [district, setDistrict] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showDistrictMenu, setShowDistrictMenu] = useState(false);

  const loadProjects = useCallback(async (selectedDistrict: string) => {
    setLoading(true);
    setError("");
    try {
      const q = selectedDistrict ? `?district=${encodeURIComponent(selectedDistrict)}` : "";
      const data = await api(`/social-housing${q}`);
      setProjects(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e?.message || "Không tải được danh sách nhà ở xã hội");
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProjects(district);
  }, [district, loadProjects]);

  const districtOptions = useMemo(() => {
    const unique = Array.from(
      new Set(projects.map((item) => item.district).filter((item): item is string => !!item))
    ).sort((a, b) => a.localeCompare(b, "vi"));
    return ["Tất cả quận/huyện", ...unique];
  }, [projects]);

  const selectedLabel = district || "Tất cả quận/huyện";

  const onSelectDistrict = (value: string) => {
    setShowDistrictMenu(false);
    if (value === "Tất cả quận/huyện") {
      setDistrict("");
      return;
    }
    setDistrict(value);
  };

  return (
    <SafeAreaView style={styles.container} testID="social-housing-screen">
      <View style={styles.header}>
        <TouchableOpacity
          testID="social-housing-back"
          onPress={() => router.back()}
          style={styles.backBtn}
        >
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Nhà ở xã hội</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={styles.filterWrap}>
        <Text style={styles.filterLabel}>Khu vực</Text>
        <TouchableOpacity
          testID="social-housing-district-dropdown"
          style={styles.dropdown}
          onPress={() => setShowDistrictMenu((prev) => !prev)}
        >
          <Text numberOfLines={1} style={styles.dropdownText}>
            {selectedLabel}
          </Text>
          <Ionicons
            name={showDistrictMenu ? "chevron-up" : "chevron-down"}
            size={16}
            color={colors.textMuted}
          />
        </TouchableOpacity>
        {showDistrictMenu && (
          <View style={styles.dropdownMenu}>
            {districtOptions.map((option) => (
              <TouchableOpacity
                key={option}
                style={styles.dropdownItem}
                onPress={() => onSelectDistrict(option)}
                testID={`social-housing-district-${option}`}
              >
                <Text
                  style={[
                    styles.dropdownItemText,
                    selectedLabel === option && styles.dropdownItemTextActive,
                  ]}
                >
                  {option}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.stateText}>Đang tải danh sách...</Text>
        </View>
      ) : error ? (
        <View style={styles.centerState}>
          <Ionicons name="alert-circle-outline" size={24} color={colors.alert} />
          <Text style={styles.stateText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => loadProjects(district)}>
            <Text style={styles.retryText}>Thử lại</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={projects}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: spacing.lg, paddingTop: spacing.md }}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            <View style={styles.centerState}>
              <Ionicons name="home-outline" size={24} color={colors.textMuted} />
              <Text style={styles.stateText}>Không có dự án cho khu vực đã chọn</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.card} testID={`social-housing-item-${item.id}`}>
              <Text style={styles.title}>{item.name}</Text>
              <Text style={styles.infoLine}>
                <Text style={styles.label}>Quận huyện: </Text>
                {item.district}
              </Text>
              {item.ward ? (
                <Text style={styles.infoLine}>
                  <Text style={styles.label}>Phường/Xã: </Text>
                  {item.ward}
                </Text>
              ) : null}
              <Text style={styles.infoLine}>
                <Text style={styles.label}>Địa chỉ: </Text>
                {item.address}
              </Text>
              <Text style={styles.infoLine}>
                <Text style={styles.label}>Chủ đầu tư: </Text>
                {item.investor}
              </Text>
            </View>
          )}
        />
      )}
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
  filterWrap: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: "#fff",
  },
  filterLabel: { fontSize: 12, color: colors.textMuted, marginBottom: 6, fontWeight: "700" },
  dropdown: {
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  dropdownText: { fontSize: 14, color: colors.text, flex: 1, marginRight: 8 },
  dropdownMenu: {
    borderWidth: 1,
    borderColor: colors.border,
    borderTopWidth: 0,
    backgroundColor: "#fff",
  },
  dropdownItem: {
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  dropdownItemText: { fontSize: 14, color: colors.text },
  dropdownItemTextActive: { color: colors.primary, fontWeight: "700" },
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
  centerState: {
    padding: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  stateText: { color: colors.textMuted, textAlign: "center" },
  retryBtn: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  retryText: { color: colors.primary, fontWeight: "700" },
});
