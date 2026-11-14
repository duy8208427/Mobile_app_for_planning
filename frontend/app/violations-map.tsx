import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, type Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import MapHtmlView from "../src/components/MapHtmlView";
import { api } from "../src/api";
import { useAuth } from "../src/auth";
import { colors, spacing } from "../src/theme";
import { violationMapHtml } from "../src/mapHtml";

type Violation = {
  id: string;
  reason: string;
  rule_id: string;
  status: string;
  so_to?: string;
  so_thua?: string;
  loai_dat?: string;
  area_m2?: number;
  latitude?: number;
  longitude?: number;
  geometry?: unknown;
};

const RULE: Record<string, string> = {
  SAI_MDSD: "Sai mục đích đất",
  LAN_RANH: "Lấn ranh",
  NHA_MOI: "Nhà mới",
};

export default function ViolationsMap() {
  const router = useRouter();
  const { user } = useAuth();
  const isStaff = user?.role === "manager" || user?.role === "admin";
  const { height } = useWindowDimensions();
  const [items, setItems] = useState<Violation[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const q = isStaff ? "" : "";
      const data = await api(`/violations${q}`);
      setItems(data);
    } catch (e: any) {
      setError(e?.message || "Không tải được nghi vấn");
    }
  }, [isStaff]);

  useEffect(() => {
    load();
  }, [load]);

  const geojson = useMemo(
    () => ({
      type: "FeatureCollection",
      features: items
        .filter((v) => v.geometry)
        .map((v) => ({
          type: "Feature",
          geometry: v.geometry,
          properties: v,
        })),
    }),
    [items]
  );

  const center: [number, number] = [
    items.find((v) => v.longitude)?.longitude || 105.634,
    items.find((v) => v.latitude)?.latitude || 10.457,
  ];

  const html = useMemo(() => violationMapHtml(geojson, center), [geojson, center]);

  return (
    <SafeAreaView style={styles.container} testID="violations-map-screen">
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} testID="violations-map-back">
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{isStaff ? "Nghi vấn flycam" : "Công trình đã xác nhận"}</Text>
        <View style={{ width: 24 }} />
      </View>
      <Text style={styles.hint}>
        {isStaff
          ? "Danh sách gợi ý AI — cần xác minh trên web quản trị trước khi công bố."
          : "Chỉ hiện các trường hợp cán bộ đã xác nhận vi phạm."}
      </Text>
      <View style={{ height: Math.min(280, height * 0.35) }}>
        <MapHtmlView html={html} />
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
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
        contentContainerStyle={{ padding: spacing.lg }}
        ListEmptyComponent={
          <Text style={styles.empty}>Chưa có công trình trên bản đồ</Text>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            testID={`violation-row-${item.id}`}
            style={styles.card}
            onPress={() =>
              router.push({ pathname: "/violation-detail", params: { id: item.id } } as unknown as Href)
            }
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.rule}>{RULE[item.rule_id] || item.rule_id}</Text>
              <Text style={styles.reason} numberOfLines={2}>
                {item.reason}
              </Text>
              <Text style={styles.meta}>
                Tờ {item.so_to || "—"} · Thửa {item.so_thua || "—"} · {item.loai_dat || ""}
                {item.area_m2 != null ? ` · ${item.area_m2} m²` : ""}
              </Text>
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  title: { fontSize: 18, fontWeight: "800", color: colors.text },
  hint: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    color: colors.textMuted,
    fontSize: 12,
  },
  error: { color: colors.alert, paddingHorizontal: spacing.lg, marginTop: 8 },
  empty: { color: colors.textMuted, textAlign: "center", marginTop: 24 },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  rule: { fontWeight: "800", color: colors.primary, fontSize: 12 },
  reason: { color: colors.text, marginTop: 4, fontSize: 14 },
  meta: { color: colors.textMuted, marginTop: 6, fontSize: 12 },
});
