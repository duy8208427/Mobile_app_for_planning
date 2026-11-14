import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../src/api";
import { useAuth } from "../src/auth";
import { colors, spacing } from "../src/theme";
import { PHASE_SHORT } from "../src/cases";
import CaseRow, { sortByDeadline, type CaseListItem } from "../src/components/CaseRow";

export default function CasesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ phase?: string; overdue?: string; view?: string }>();
  const role = user?.role;
  const isAdmin = role === "admin";
  const isManager = role === "manager";
  const isCitizen = !isAdmin && !isManager;

  const [phase, setPhase] = useState<number | null>(params.phase ? Number(params.phase) || null : null);
  const [overdueOnly, setOverdueOnly] = useState(params.overdue === "1");
  const [view, setView] = useState<"reporter" | "violator">(params.view === "violator" ? "violator" : "reporter");
  const [items, setItems] = useState<CaseListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const query = useMemo(() => {
    const q: string[] = [];
    if (isCitizen) {
      if (view === "violator") q.push("role_view=violator");
    } else {
      if (phase) q.push(`phase=${phase}`);
      if (overdueOnly) q.push("overdue=true");
    }
    return q.length ? `?${q.join("&")}` : "";
  }, [isCitizen, view, phase, overdueOnly]);

  const load = useCallback(async () => {
    setError("");
    try {
      const data: CaseListItem[] = await api(`/cases${query}`);
      setItems(isManager ? sortByDeadline(data) : data);
    } catch (e: any) {
      setError(e?.message || "Không tải được danh sách hồ sơ");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [query, isManager]);

  // Spinner only when the filter changes; returning from a case reloads quietly.
  useEffect(() => {
    setLoading(true);
  }, [query]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const title = isAdmin ? "Hồ sơ vụ việc" : isManager ? "Việc được giao" : view === "violator" ? "Quyết định xử phạt của tôi" : "Phản ánh của tôi";

  return (
    <SafeAreaView style={styles.container} testID="cases-screen">
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} testID="cases-back">
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{title}</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={styles.filters}>
        {isCitizen ? (
          <View style={styles.segment}>
            {(
              [
                { k: "reporter", label: "Phản ánh của tôi" },
                { k: "violator", label: "Quyết định về tôi" },
              ] as const
            ).map((o) => (
              <TouchableOpacity
                key={o.k}
                style={[styles.segBtn, view === o.k && styles.segBtnOn]}
                onPress={() => setView(o.k)}
                testID={`cases-view-${o.k}`}
              >
                <Text style={[styles.segText, view === o.k && { color: "#fff" }]}>{o.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {isAdmin
              ? [null, 1, 2, 3, 4].map((p) => (
                  <TouchableOpacity
                    key={String(p)}
                    testID={`cases-phase-${p ?? "all"}`}
                    style={[styles.chip, phase === p && styles.chipOn]}
                    onPress={() => setPhase(p)}
                  >
                    <Text style={[styles.chipText, phase === p && { color: "#fff" }]}>
                      {p ? `${p}. ${PHASE_SHORT[p]}` : "Tất cả"}
                    </Text>
                  </TouchableOpacity>
                ))
              : null}
            <TouchableOpacity
              testID="cases-overdue-toggle"
              style={[styles.chip, overdueOnly && { backgroundColor: colors.alert, borderColor: colors.alert }]}
              onPress={() => setOverdueOnly((v) => !v)}
            >
              <Ionicons name="alarm-outline" size={14} color={overdueOnly ? "#fff" : colors.alert} />
              <Text style={[styles.chipText, { color: overdueOnly ? "#fff" : colors.alert }]}>Quá hạn</Text>
            </TouchableOpacity>
          </ScrollView>
        )}
      </View>

      {loading && !refreshing ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: spacing.md, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons
                name={error ? "alert-circle-outline" : "folder-open-outline"}
                size={34}
                color={error ? colors.alert : colors.textMuted}
              />
              <Text style={styles.emptyText}>
                {error ||
                  (isCitizen
                    ? view === "violator"
                      ? "Không có quyết định xử phạt nào liên quan đến bạn."
                      : "Bạn chưa gửi phản ánh nào."
                    : overdueOnly
                      ? "Không có hồ sơ quá hạn."
                      : "Chưa có hồ sơ nào.")}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <CaseRow item={item} citizenView={isCitizen && view === "reporter"} showOfficer={isAdmin} />
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
  filters: { backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: 10 },
  chips: { paddingHorizontal: spacing.md, gap: 6 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#fff",
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 12, fontWeight: "700", color: colors.text },
  segment: {
    flexDirection: "row",
    marginHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    overflow: "hidden",
  },
  segBtn: { flex: 1, paddingVertical: 9, alignItems: "center", backgroundColor: "#fff" },
  segBtnOn: { backgroundColor: colors.primary },
  segText: { fontSize: 13, fontWeight: "700", color: colors.text },
  empty: { alignItems: "center", padding: spacing.xl, gap: 8 },
  emptyText: { color: colors.textMuted, textAlign: "center" },
});
