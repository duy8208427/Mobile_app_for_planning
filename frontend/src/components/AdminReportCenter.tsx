import { useCallback, useEffect, useState } from "react";
import { FlatList, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../api";
import { colors, spacing } from "../theme";
import { StatusBadge } from "../../app/(tabs)/index";

type ReportItem = {
  id: string;
  title: string;
  address: string;
  status: string;
  user_name: string;
  created_at: string;
};

type AdminStats = {
  total: number;
  pending: number;
  processing: number;
  resolved: number;
  rejected: number;
};

const FILTERS = [
  { id: "all", label: "Tất cả" },
  { id: "received", label: "Tiếp nhận" },
  { id: "processing", label: "Đang xử lý" },
  { id: "resolved", label: "Đã duyệt" },
  { id: "rejected", label: "Từ chối" },
];

type Props = {
  mode: "admin" | "mine";
  showStats?: boolean;
  showHeader?: boolean;
  title?: string;
  showBackButton?: boolean;
  onBack?: () => void;
  onOpenReport: (id: string, mode: "admin" | "mine") => void;
  testID?: string;
};

export default function AdminReportCenter({
  mode,
  showStats = false,
  showHeader = true,
  title,
  showBackButton = false,
  onBack,
  onOpenReport,
  testID = "admin-report-center",
}: Props) {
  const [filter, setFilter] = useState("all");
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const requests: Promise<any>[] = [];
      if (showStats && mode === "admin") {
        requests.push(api("/admin/stats"));
      } else {
        requests.push(Promise.resolve(null));
      }
      requests.push(api(mode === "mine" ? "/reports/mine" : `/reports${filter !== "all" ? `?status=${filter}` : ""}`));
      const [statsData, reportsData] = await Promise.all(requests);
      setStats(statsData);
      setReports(Array.isArray(reportsData) ? reportsData : []);
    } catch (e: any) {
      setError(e?.message || "Không tải được dữ liệu quản trị");
      setReports([]);
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, [filter, mode, showStats]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const viewTitle = title || (mode === "mine" ? "Báo cáo của tôi" : "Quản trị");

  return (
    <View style={styles.container} testID={testID}>
      {showHeader && (
        <View style={styles.header}>
          {showBackButton ? (
            <TouchableOpacity onPress={onBack} style={styles.backBtn}>
              <Ionicons name="chevron-back" size={22} color={colors.text} />
            </TouchableOpacity>
          ) : (
            <View style={styles.backBtn} />
          )}
          <Text style={styles.headerTitle}>{viewTitle}</Text>
          <View style={styles.backBtn} />
        </View>
      )}

      {mode === "admin" && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
          contentContainerStyle={styles.filterRow}
        >
          {FILTERS.map((item) => (
            <TouchableOpacity
              key={item.id}
              testID={`admin-filter-${item.id}`}
              style={[styles.chip, filter === item.id && styles.chipActive]}
              onPress={() => setFilter(item.id)}
            >
              <Text style={[styles.chipText, filter === item.id && styles.chipTextActive]}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {showStats && mode === "admin" && stats && (
        <View style={styles.statsWrap}>
          <View style={[styles.statCard, { borderLeftColor: "#334155" }]}>
            <Text style={styles.statNum}>{stats.total}</Text>
            <Text style={styles.statLabel}>Tổng</Text>
          </View>
          <View style={[styles.statCard, { borderLeftColor: "#F59E0B" }]}>
            <Text style={[styles.statNum, { color: "#B45309" }]}>{stats.pending}</Text>
            <Text style={styles.statLabel}>Chờ xử lý</Text>
          </View>
          <View style={[styles.statCard, { borderLeftColor: colors.primary }]}>
            <Text style={[styles.statNum, { color: colors.primary }]}>{stats.processing}</Text>
            <Text style={styles.statLabel}>Đang xử lý</Text>
          </View>
          <View style={[styles.statCard, { borderLeftColor: colors.success }]}>
            <Text style={[styles.statNum, { color: colors.success }]}>{stats.resolved}</Text>
            <Text style={styles.statLabel}>Đã duyệt</Text>
          </View>
        </View>
      )}

      <FlatList
        data={reports}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing.lg }}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Ionicons
              name={error ? "alert-circle-outline" : loading ? "time-outline" : "folder-open-outline"}
              size={30}
              color={error ? colors.alert : colors.textMuted}
            />
            <Text style={styles.emptyText}>
              {error ? error : loading ? "Đang tải dữ liệu..." : "Không có báo cáo"}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            testID={`admin-report-${item.id}`}
            style={styles.card}
            onPress={() => onOpenReport(item.id, mode)}
          >
            <View style={styles.cardHead}>
              <Text style={styles.cardTitle} numberOfLines={1}>
                {item.title}
              </Text>
              <StatusBadge status={item.status} />
            </View>
            <Text style={styles.cardAddr} numberOfLines={1}>
              {item.address}
            </Text>
            <Text style={styles.cardMeta}>
              {item.user_name || "Người dùng"} · {new Date(item.created_at).toLocaleString("vi-VN")}
            </Text>
          </TouchableOpacity>
        )}
      />
    </View>
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
  filterScroll: {
    maxHeight: 56,
    marginTop: spacing.xs,
  },
  filterRow: {
    paddingHorizontal: spacing.lg,
    paddingVertical: 6,
    gap: 6,
    flexDirection: "row",
    alignItems: "center",
  },
  chip: {
    minHeight: 36,
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#D5DEE8",
    borderRadius: 18,
    justifyContent: "center",
    alignSelf: "center",
  },
  chipActive: { backgroundColor: "#1D4ED8", borderColor: "#1D4ED8" },
  chipText: { color: "#334155", fontWeight: "600", fontSize: 13 },
  chipTextActive: { color: "#fff" },
  statsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xs,
  },
  statCard: {
    width: "48%",
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    backgroundColor: "#fff",
    padding: spacing.sm,
    borderRadius: 12,
  },
  statNum: { fontSize: 20, fontWeight: "800", color: colors.text },
  statLabel: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  card: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    borderRadius: 12,
  },
  cardHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  cardTitle: { flex: 1, fontWeight: "800", color: colors.text },
  cardAddr: { color: colors.textMuted, marginTop: 4, fontSize: 12 },
  cardMeta: { color: colors.textMuted, marginTop: 6, fontSize: 11 },
  emptyWrap: { padding: spacing.xl, alignItems: "center" },
  emptyText: { color: colors.textMuted, marginTop: 8, textAlign: "center" },
});
