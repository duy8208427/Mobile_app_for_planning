import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { api } from "../src/api";
import { colors, spacing } from "../src/theme";

type AdministrativeProcedure = {
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

export default function AdministrativeProceduresScreen() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [items, setItems] = useState<AdministrativeProcedure[]>([]);
  const [expandedByCategory, setExpandedByCategory] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 320);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const q = debouncedSearch ? `?q=${encodeURIComponent(debouncedSearch)}` : "";
        const data = await api(`/administrative-procedures${q}`);
        if (!mounted) return;
        const list = Array.isArray(data) ? (data as AdministrativeProcedure[]) : [];
        setItems(list);

        const categories = Array.from(new Set(list.map((item) => item.category)));
        setExpandedByCategory((prev) => {
          const next: Record<string, boolean> = {};
          categories.forEach((category, idx) => {
            if (debouncedSearch) {
              next[category] = true;
            } else {
              next[category] = prev[category] ?? idx === 0;
            }
          });
          return next;
        });
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message || "Không tải được thủ tục hành chính");
        setItems([]);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, [debouncedSearch]);

  const grouped = useMemo(() => {
    const map = new Map<string, AdministrativeProcedure[]>();
    items.forEach((item) => {
      const existing = map.get(item.category) || [];
      existing.push(item);
      map.set(item.category, existing);
    });
    return Array.from(map.entries()).map(([category, procedures]) => ({
      category,
      procedures: [...procedures].sort((a, b) => a.order - b.order || a.title.localeCompare(b.title, "vi")),
    }));
  }, [items]);

  const toggleCategory = (category: string) => {
    setExpandedByCategory((prev) => ({ ...prev, [category]: !prev[category] }));
  };

  return (
    <SafeAreaView style={styles.container} testID="administrative-procedures-screen">
      <View style={styles.header}>
        <TouchableOpacity
          testID="administrative-procedures-back"
          onPress={() => router.back()}
          style={styles.backBtn}
        >
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Thủ tục hành chính</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={styles.searchWrap}>
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={16} color={colors.textMuted} />
          <TextInput
            testID="administrative-procedures-search"
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Tìm kiếm thủ tục..."
            placeholderTextColor={colors.textMuted}
          />
        </View>
      </View>

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.stateText}>Đang tải dữ liệu...</Text>
        </View>
      ) : error ? (
        <View style={styles.centerState}>
          <Ionicons name="alert-circle-outline" size={26} color={colors.alert} />
          <Text style={styles.stateText}>{error}</Text>
        </View>
      ) : grouped.length === 0 ? (
        <View style={styles.centerState}>
          <Ionicons name="folder-open-outline" size={26} color={colors.textMuted} />
          <Text style={styles.stateText}>Không có thủ tục phù hợp</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {grouped.map((group) => {
            const opened = !!expandedByCategory[group.category];
            return (
              <View key={group.category} style={styles.groupWrap}>
                <TouchableOpacity
                  testID={`administrative-category-${group.category}`}
                  style={styles.groupHeader}
                  onPress={() => toggleCategory(group.category)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.groupToggle}>{opened ? "−" : "+"}</Text>
                  <Text style={styles.groupTitle}>{group.category.toUpperCase()}</Text>
                </TouchableOpacity>

                {opened && (
                  <View style={styles.groupBody}>
                    {group.procedures.map((item) => (
                      <TouchableOpacity
                        key={item.id}
                        style={styles.procedureRow}
                        activeOpacity={0.82}
                        testID={`administrative-procedure-${item.id}`}
                        onPress={() =>
                          router.push({
                            pathname: "/administrative-procedure-detail",
                            params: { id: item.id },
                          })
                        }
                      >
                        <View style={styles.numberBadge}>
                          <Text style={styles.numberText}>{item.order}</Text>
                        </View>
                        <View style={styles.procedureTextWrap}>
                          <Text style={styles.procedureTitle}>{item.title}</Text>
                          {!!item.content && (
                            <Text style={styles.procedureContent} numberOfLines={2}>
                              {item.content}
                            </Text>
                          )}
                        </View>
                        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            );
          })}
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
  searchWrap: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: "#fff",
  },
  searchBox: {
    borderWidth: 1,
    borderColor: "#CFE3F9",
    backgroundColor: "#E7F5FF",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  searchInput: { flex: 1, color: colors.text, fontSize: 14, paddingVertical: 0 },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  groupWrap: {
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#fff",
    borderRadius: 12,
    overflow: "hidden",
  },
  groupHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#F8FAFC",
    borderBottomWidth: 1,
    borderBottomColor: "#EDF2F7",
  },
  groupToggle: { width: 14, textAlign: "center", fontSize: 16, fontWeight: "700", color: "#111827" },
  groupTitle: { fontSize: 13, fontWeight: "800", color: "#334155", letterSpacing: 0.5 },
  groupBody: { paddingVertical: 6 },
  procedureRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  numberBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#67C8E5",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  numberText: { color: "#fff", fontWeight: "800", fontSize: 11 },
  procedureTextWrap: { flex: 1 },
  procedureTitle: { color: "#334155", fontSize: 13, fontWeight: "600", lineHeight: 18 },
  procedureContent: { color: "#64748B", fontSize: 12, marginTop: 2, lineHeight: 17 },
  centerState: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: spacing.lg },
  stateText: { color: colors.textMuted, textAlign: "center" },
});
