import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../src/api";
import { colors, spacing } from "../../src/theme";
import { useRouter } from "expo-router";

export default function Notifications() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api("/notifications");
      setItems(data);
    } catch {}
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const markAll = async () => {
    try {
      await api("/notifications/read-all", { method: "POST" });
      load();
    } catch {}
  };

  const onPress = async (item: any) => {
    if (!item.read) {
      try {
        await api(`/notifications/${item.id}/read`, { method: "POST" });
      } catch {}
    }
    if (item.related_report_id) {
      router.push({ pathname: "/report-detail", params: { id: item.related_report_id } });
    } else {
      load();
    }
  };

  return (
    <SafeAreaView style={styles.container} testID="notifications-screen">
      <View style={styles.header}>
        <Text style={styles.title}>Thông báo</Text>
        <TouchableOpacity onPress={markAll} testID="mark-all-read-button">
          <Text style={styles.markAll}>Đánh dấu đã đọc</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: spacing.lg }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="notifications-off-outline" size={36} color={colors.textMuted} />
            <Text style={styles.emptyText}>Chưa có thông báo nào</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            testID={`notification-item-${item.id}`}
            style={[styles.card, !item.read && styles.cardUnread]}
            onPress={() => onPress(item)}
          >
            <View style={[styles.dot, { backgroundColor: !item.read ? colors.primary : "transparent" }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.itemTitle}>{item.title}</Text>
              <Text style={styles.itemBody} numberOfLines={2}>{item.body}</Text>
              <Text style={styles.itemTime}>{new Date(item.created_at).toLocaleString("vi-VN")}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: { fontSize: 24, fontWeight: "800", color: colors.text, letterSpacing: -0.3 },
  markAll: { color: colors.primary, fontWeight: "600", fontSize: 13 },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  cardUnread: { borderLeftWidth: 3, borderLeftColor: colors.primary },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  itemTitle: { fontWeight: "700", color: colors.text, fontSize: 14 },
  itemBody: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  itemTime: { color: colors.textMuted, fontSize: 11, marginTop: 6 },
  empty: { alignItems: "center", padding: spacing.xl, gap: 8 },
  emptyText: { color: colors.textMuted },
});
