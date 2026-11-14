import { useState, useCallback } from "react";
import {
  ActivityIndicator,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter, type Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../src/auth";
import { api } from "../../src/api";
import { colors, spacing } from "../../src/theme";
import { PHASE_SHORT, caseDetailHref, casesHref, roleLabel } from "../../src/cases";
import CaseRow, { sortByDeadline, type CaseListItem } from "../../src/components/CaseRow";

type ReportItem = {
  id: string;
  title: string;
  address: string;
  status: string;
  case_id?: string | null;
};

type CaseStats = {
  total: number;
  open: number;
  overdue: number;
  by_phase: Record<string, number>;
};

export default function Home() {
  const router = useRouter();
  const { user } = useAuth();
  const isManager = user?.role === "manager";
  const isAdmin = user?.role === "admin";
  const isStaff = isManager || isAdmin;
  const [recent, setRecent] = useState<ReportItem[]>([]);
  const [stats, setStats] = useState<CaseStats | null>(null);
  const [myCases, setMyCases] = useState<CaseListItem[]>([]);
  const [violatorCases, setViolatorCases] = useState<CaseListItem[]>([]);
  const [loadingHome, setLoadingHome] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [pendingViolations, setPendingViolations] = useState(0);
  const [latestFlight, setLatestFlight] = useState("");

  const load = useCallback(async () => {
    setLoadError("");
    if (isAdmin) {
      setRecent([]);
      try {
        const [st, vs] = await Promise.all([
          api("/cases/stats"),
          api("/violations/stats").catch(() => null),
        ]);
        setStats(st);
        setPendingViolations(vs?.pending_review || 0);
        setLatestFlight(vs?.latest_mission?.flight_date || "");
      } catch (e: any) {
        setLoadError(e?.message || "Không tải được thống kê hồ sơ");
      } finally {
        setLoadingHome(false);
      }
      return;
    }
    if (isManager) {
      setRecent([]);
      try {
        const list: CaseListItem[] = await api("/cases");
        setMyCases(sortByDeadline(list.filter((c) => c.status !== "da_dong" && c.status !== "khong_vi_pham")));
      } catch (e: any) {
        setLoadError(e?.message || "Không tải được việc được giao");
        setMyCases([]);
      } finally {
        setLoadingHome(false);
      }
      return;
    }
    try {
      const [r, v] = await Promise.all([
        api("/reports/mine"),
        api("/cases?role_view=violator").catch(() => []),
      ]);
      setRecent(r.slice(0, 5));
      setViolatorCases(Array.isArray(v) ? v : []);
    } catch (e: any) {
      setLoadError(e?.message || "Không thể tải dữ liệu trang chủ");
      setRecent([]);
    } finally {
      setLoadingHome(false);
    }
  }, [isManager, isAdmin]);

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

  const quickActions = [
    {
      id: "report",
      testID: "report-feature-card",
      icon: "alert-circle-outline" as const,
      iconColor: "#0C4A6E",
      iconBg: "#E0F2FE",
      title: "Báo cáo",
      desc: "Vi phạm xây dựng",
      onPress: () => router.push("/report"),
    },
    {
      id: "confirmed-violations",
      testID: "confirmed-violations-card",
      icon: "map-outline" as const,
      iconColor: "#B45309",
      iconBg: "#FFEDD5",
      title: "Nhà đã xác nhận",
      desc: "Flycam vs địa chính",
      onPress: () => router.push("/violations-map" as Href),
    },
    {
      id: "social-housing",
      testID: "social-housing-feature-card",
      icon: "business-outline" as const,
      iconColor: "#1D4ED8",
      iconBg: "#DBEAFE",
      title: "Nhà ở xã hội",
      desc: "Danh sách theo khu vực",
      onPress: () => router.push("/social-housing"),
    },
  ];

  const highlightFeatures = [
    {
      id: "building-permit",
      testID: "building-permits-feature-card",
      icon: "construct-outline" as const,
      iconColor: "#0369A1",
      iconBg: "#E0F2FE",
      title: "Giấy phép xây dựng",
      desc: "Tra cứu GPXD",
      onPress: () => router.push("/building-permits"),
    },
    {
      id: "legal",
      testID: "legal-feature-card",
      icon: "document-text-outline" as const,
      iconColor: colors.primary,
      iconBg: "#DBEAFE",
      title: "Văn bản pháp luật",
      desc: "Pháp luật và quy hoạch",
      onPress: () => router.push("/legal"),
    },
    {
      id: "administrative-procedures",
      testID: "administrative-procedures-feature-card",
      icon: "list-outline" as const,
      iconColor: "#0C4A6E",
      iconBg: "#E0F2FE",
      title: "Thủ tục hành chính",
      desc: "Tra cứu thủ tục",
      onPress: () => router.push("/administrative-procedures"),
    },
  ];

  return (
    <SafeAreaView style={styles.container} testID="home-screen">
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.headerSection}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.hello}>Xin chào,</Text>
              <Text style={styles.name}>{user?.full_name || "Người dùng"}</Text>
            </View>
            <View
              style={[
                styles.roleBadge,
                isStaff && styles.roleAdmin,
              ]}
            >
              <Ionicons
                name={isStaff ? "shield-checkmark-outline" : "person-outline"}
                size={14}
                color={isStaff ? "#fff" : colors.primary}
              />
              <Text
                style={[
                  styles.roleText,
                  isStaff && { color: "#fff" },
                ]}
              >
                {roleLabel(user?.role)}
              </Text>
            </View>
          </View>

          <View style={styles.headerHint}>
            <Ionicons name="information-circle-outline" size={14} color={colors.primary} />
            <Text style={styles.headerHintText}>
              {isAdmin
                ? "Theo dõi hồ sơ vụ việc, tiền kiểm, giao việc và ra quyết định xử lý"
                : isManager
                  ? "Kiểm tra thực địa, lập biên bản và hậu kiểm các hồ sơ được giao"
                  : "Theo dõi quy hoạch, báo cáo vi phạm và tra cứu thông tin tại một nơi"}
            </Text>
          </View>
        </View>

        {!isStaff && (
        <TouchableOpacity
          testID="compare-feature-card"
          style={styles.heroCard}
          activeOpacity={0.85}
          onPress={() => router.push("/compare")}
        >
          <Image
            source={{
              uri: "https://images.unsplash.com/photo-1754797007234-65f6025a55a9?w=900&q=70",
            }}
            style={styles.heroImage}
          />
          <View style={styles.heroOverlay}>
            <Text style={styles.heroKicker}>PHÂN TÍCH THÔNG MINH</Text>
            <Text style={styles.heroTitle}>So sánh quy hoạch và dữ liệu viễn thám</Text>
            <Text style={styles.heroSub}>Phát hiện nhanh khu vực có dấu hiệu bất thường bằng AI</Text>
            <View style={styles.heroCta}>
              <Text style={styles.heroCtaText}>Bắt đầu phân tích</Text>
              <Ionicons name="arrow-forward" size={14} color="#fff" />
            </View>
          </View>
        </TouchableOpacity>
        )}

        {!isStaff && (
        <View style={styles.sectionWrap}>
          <Text style={styles.sectionTitle}>TIỆN ÍCH NHANH</Text>
          <View style={styles.quickGrid}>
            {quickActions.map((item) => (
              <TouchableOpacity
                key={item.id}
                testID={item.testID}
                style={styles.actionCard}
                onPress={item.onPress}
                activeOpacity={0.86}
              >
                <View style={[styles.iconBox, { backgroundColor: item.iconBg }]}>
                  <Ionicons name={item.icon} size={21} color={item.iconColor} />
                </View>
                <Text style={styles.actionTitle}>{item.title}</Text>
                <Text style={styles.actionDesc}>{item.desc}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        )}

        {!isStaff && (
        <View style={styles.sectionWrap}>
          <Text style={styles.sectionTitle}>TRA CỨU CHUYÊN SÂU</Text>
          {highlightFeatures.map((item) => (
            <TouchableOpacity
              key={item.id}
              testID={item.testID}
              style={styles.featureCard}
              onPress={item.onPress}
              activeOpacity={0.86}
            >
              <View style={[styles.iconBox, styles.featureIcon, { backgroundColor: item.iconBg }]}>
                <Ionicons name={item.icon} size={21} color={item.iconColor} />
              </View>
              <View style={styles.featureTextWrap}>
                <Text style={styles.featureTitle}>{item.title}</Text>
                <Text style={styles.featureDesc}>{item.desc}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          ))}
        </View>
        )}

        {isAdmin && (
          <View style={styles.sectionWrap}>
            <Text style={styles.sectionTitle}>HỒ SƠ VỤ VIỆC</Text>
            {loadingHome ? (
              <View style={styles.loadingCard}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.loadingText}>Đang tải thống kê...</Text>
              </View>
            ) : loadError ? (
              <View style={styles.emptyCard}>
                <Ionicons name="alert-circle-outline" size={28} color={colors.alert} />
                <Text style={styles.emptyText}>{loadError}</Text>
                <TouchableOpacity style={styles.retryBtn} onPress={load}>
                  <Text style={styles.retryText}>Thử lại</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <View style={styles.statRow}>
                  <TouchableOpacity
                    testID="stat-open"
                    style={styles.statCard}
                    onPress={() => router.push(casesHref())}
                  >
                    <Text style={styles.statNum}>{stats?.open ?? 0}</Text>
                    <Text style={styles.statLabel}>Đang mở</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    testID="stat-overdue"
                    style={[styles.statCard, (stats?.overdue ?? 0) > 0 && styles.statCardAlert]}
                    onPress={() => router.push(casesHref({ overdue: "1" }))}
                  >
                    <Text style={[styles.statNum, (stats?.overdue ?? 0) > 0 && { color: colors.alert }]}>
                      {stats?.overdue ?? 0}
                    </Text>
                    <Text style={styles.statLabel}>Quá hạn</Text>
                  </TouchableOpacity>
                  <View style={styles.statCard}>
                    <Text style={styles.statNum}>{stats?.total ?? 0}</Text>
                    <Text style={styles.statLabel}>Tổng hồ sơ</Text>
                  </View>
                </View>
                <View style={styles.phaseGrid}>
                  {[1, 2, 3, 4].map((p) => (
                    <TouchableOpacity
                      key={p}
                      testID={`stat-phase-${p}`}
                      style={styles.phaseCard}
                      onPress={() => router.push(casesHref({ phase: String(p) }))}
                    >
                      <Text style={styles.phaseNum}>{stats?.by_phase?.[String(p)] ?? 0}</Text>
                      <Text style={styles.phaseLabel}>
                        GĐ {p}. {PHASE_SHORT[p]}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}
            <TouchableOpacity
              testID="open-cases"
              style={[styles.adminShortcut, { marginTop: spacing.md }]}
              onPress={() => router.push(casesHref())}
            >
              <View style={[styles.iconBox, styles.featureIcon, { backgroundColor: "#DBEAFE" }]}>
                <Ionicons name="folder-open-outline" size={21} color={colors.primary} />
              </View>
              <View style={styles.featureTextWrap}>
                <Text style={styles.featureTitle}>Hồ sơ vụ việc</Text>
                <Text style={styles.featureDesc}>Tiền kiểm, giao việc, ra quyết định, hậu kiểm</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity
              testID="open-latest-survey-violations"
              style={[styles.adminShortcut, { marginTop: spacing.sm }]}
              onPress={() => router.push("/violations-map" as Href)}
            >
              <View style={[styles.iconBox, styles.featureIcon, { backgroundColor: "#FEE2E2" }]}>
                <Ionicons name="airplane-outline" size={21} color={colors.alert} />
              </View>
              <View style={styles.featureTextWrap}>
                <Text style={styles.featureTitle}>Nghi vấn flycam</Text>
                <Text style={styles.featureDesc}>
                  {latestFlight
                    ? `Đợt bay ${latestFlight} · ${pendingViolations} chờ duyệt`
                    : "Cảnh báo AI từ ảnh flycam"}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        )}

        {isManager && (
          <View style={styles.sectionWrap}>
            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>VIỆC ĐƯỢC GIAO</Text>
              <TouchableOpacity onPress={() => router.push(casesHref())} testID="open-cases-link">
                <Text style={styles.sectionLink}>Tất cả hồ sơ</Text>
              </TouchableOpacity>
            </View>
            {loadingHome ? (
              <View style={styles.loadingCard}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.loadingText}>Đang tải việc được giao...</Text>
              </View>
            ) : loadError ? (
              <View style={styles.emptyCard}>
                <Ionicons name="alert-circle-outline" size={28} color={colors.alert} />
                <Text style={styles.emptyText}>{loadError}</Text>
                <TouchableOpacity style={styles.retryBtn} onPress={load}>
                  <Text style={styles.retryText}>Thử lại</Text>
                </TouchableOpacity>
              </View>
            ) : myCases.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons name="checkmark-done-outline" size={28} color={colors.success} />
                <Text style={styles.emptyTitle}>Không có việc đang chờ</Text>
                <Text style={styles.emptyText}>Hồ sơ mới được giao sẽ hiển thị tại đây.</Text>
              </View>
            ) : (
              myCases.map((c) => <CaseRow key={c.id} item={c} />)
            )}
            <TouchableOpacity
              testID="open-cases"
              style={[styles.adminShortcut, { marginTop: spacing.sm }]}
              onPress={() => router.push(casesHref())}
            >
              <View style={[styles.iconBox, styles.featureIcon, { backgroundColor: "#DBEAFE" }]}>
                <Ionicons name="folder-open-outline" size={21} color={colors.primary} />
              </View>
              <View style={styles.featureTextWrap}>
                <Text style={styles.featureTitle}>Hồ sơ vụ việc</Text>
                <Text style={styles.featureDesc}>Toàn bộ hồ sơ được giao, kể cả đã đóng</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        )}

        {!isStaff && violatorCases.length > 0 && (
          <View style={styles.sectionWrap}>
            <TouchableOpacity
              testID="my-decisions-card"
              style={styles.decisionCard}
              onPress={() => router.push(casesHref({ view: "violator" }))}
              activeOpacity={0.86}
            >
              <View style={[styles.iconBox, styles.featureIcon, { backgroundColor: "#FEE2E2" }]}>
                <Ionicons name="hammer-outline" size={21} color={colors.alert} />
              </View>
              <View style={styles.featureTextWrap}>
                <Text style={styles.featureTitle}>Quyết định xử phạt của tôi</Text>
                <Text style={styles.featureDesc}>
                  {violatorCases.length} hồ sơ ·{" "}
                  {violatorCases.filter((c) => c.available_actions?.length).length} cần bạn thực hiện
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        )}

        {!isStaff && (
        <View style={styles.sectionWrap}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>BÁO CÁO CỦA TÔI</Text>
            {recent.length > 0 ? (
              <TouchableOpacity onPress={() => router.push(casesHref())} testID="open-my-cases">
                <Text style={styles.sectionLink}>Xem tiến độ</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          {loadingHome ? (
            <View style={styles.loadingCard}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.loadingText}>Đang tải dữ liệu báo cáo...</Text>
            </View>
          ) : loadError ? (
            <View style={styles.emptyCard}>
              <Ionicons name="alert-circle-outline" size={28} color={colors.alert} />
              <Text style={styles.emptyText}>{loadError}</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={load}>
                <Text style={styles.retryText}>Thử lại</Text>
              </TouchableOpacity>
            </View>
          ) : recent.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="document-text-outline" size={28} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>Chưa có báo cáo nào</Text>
              <Text style={styles.emptyText}>Bạn có thể gửi báo cáo mới từ mục Báo cáo vi phạm.</Text>
            </View>
          ) : (
            recent.map((r) => (
              <TouchableOpacity
                key={r.id}
                testID={`recent-report-${r.id}`}
                style={styles.reportRow}
                onPress={() =>
                  router.push(
                    r.case_id
                      ? caseDetailHref(r.case_id)
                      : { pathname: "/report-detail", params: { id: r.id } }
                  )
                }
              >
                <View style={styles.reportRowLeft}>
                  <Text style={styles.reportTitle} numberOfLines={1}>
                    {r.title}
                  </Text>
                  <Text style={styles.reportAddr} numberOfLines={1}>
                    {r.address}
                  </Text>
                </View>
                <StatusBadge status={r.status} />
              </TouchableOpacity>
            ))
          )}
        </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: any = {
    received: { c: "#FFF3E0", t: colors.warning, label: "Tiếp nhận" },
    assigned: { c: "#E0F2FE", t: colors.primary, label: "Đã giao" },
    processing: { c: "#E0F2FE", t: colors.primary, label: "Đã giao" },
    pending_approval: { c: "#FEF3C7", t: "#B45309", label: "Chờ duyệt" },
    resolved: { c: "#DCFCE7", t: colors.success, label: "Đã giải quyết" },
    rejected: { c: "#FEE2E2", t: colors.alert, label: "Từ chối" },
  };
  const s = map[status] || map.received;
  return (
    <View style={[badge.b, { backgroundColor: s.c }]}>
      <Text style={[badge.t, { color: s.t }]}>{s.label}</Text>
    </View>
  );
}
const badge = StyleSheet.create({
  b: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  t: { fontSize: 11, fontWeight: "700" },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F6FAFF" },
  content: { paddingBottom: 40 },
  headerSection: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  headerTop: {
    paddingHorizontal: spacing.lg,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  hello: { color: "#64748B", fontSize: 13 },
  name: { color: "#0F172A", fontSize: 24, fontWeight: "800", letterSpacing: -0.4, marginTop: 2 },
  roleBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    borderRadius: 999,
  },
  roleAdmin: { backgroundColor: colors.primary, borderColor: colors.primary },
  roleText: { fontSize: 11, fontWeight: "700", color: colors.primary },
  headerHint: {
    marginTop: spacing.sm,
    marginHorizontal: spacing.lg,
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#DBEAFE",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerHintText: { color: "#1E3A8A", fontSize: 12, flex: 1, lineHeight: 16 },
  heroCard: {
    marginHorizontal: spacing.lg,
    height: 196,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#DBEAFE",
    borderRadius: 20,
  },
  heroImage: { width: "100%", height: "100%" },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(9, 30, 66, 0.56)",
    padding: spacing.md,
    justifyContent: "flex-end",
  },
  heroKicker: {
    fontSize: 11,
    fontWeight: "700",
    color: "rgba(255,255,255,0.85)",
    letterSpacing: 0.8,
  },
  heroTitle: { color: "#fff", fontSize: 21, fontWeight: "800", letterSpacing: -0.4, marginTop: 6 },
  heroSub: { color: "rgba(255,255,255,0.9)", fontSize: 12, marginTop: 6, lineHeight: 18 },
  heroCta: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    marginTop: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(59, 130, 246, 0.28)",
  },
  heroCtaText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  sectionWrap: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: "#64748B",
    letterSpacing: 1.1,
    marginBottom: spacing.sm,
  },
  quickGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  actionCard: {
    width: "47.5%",
    minHeight: 132,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 16,
    padding: spacing.md,
  },
  iconBox: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    borderRadius: 12,
  },
  actionTitle: { fontSize: 15, fontWeight: "700", color: "#0F172A" },
  actionDesc: { fontSize: 12, color: "#64748B", marginTop: 4, lineHeight: 17 },
  featureCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  featureIcon: { marginBottom: 0 },
  featureTextWrap: { flex: 1, marginLeft: spacing.sm, marginRight: spacing.xs },
  featureTitle: { fontSize: 15, fontWeight: "700", color: "#0F172A" },
  featureDesc: { fontSize: 12, color: "#64748B", marginTop: 2 },
  adminShortcut: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 16,
    padding: spacing.md,
  },
  sectionHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionLink: { fontSize: 12, fontWeight: "700", color: colors.primary, marginBottom: spacing.sm },
  statRow: { flexDirection: "row", gap: spacing.sm },
  statCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  statCardAlert: { borderColor: "#FCA5A5", backgroundColor: "#FEF2F2" },
  statNum: { fontSize: 24, fontWeight: "800", color: "#0F172A" },
  statLabel: { fontSize: 12, color: "#64748B", marginTop: 2 },
  phaseGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.sm },
  phaseCard: {
    width: "48.5%",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    padding: 12,
  },
  phaseNum: { fontSize: 20, fontWeight: "800", color: colors.primary },
  phaseLabel: { fontSize: 12, color: "#334155", marginTop: 2, fontWeight: "600" },
  decisionCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF7F7",
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 16,
    padding: spacing.md,
  },
  loadingCard: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    padding: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  loadingText: { color: "#64748B", fontSize: 13 },
  emptyCard: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    padding: spacing.lg,
    alignItems: "center",
  },
  emptyTitle: { color: "#0F172A", fontSize: 14, fontWeight: "700", marginTop: 8 },
  emptyText: { color: "#64748B", marginTop: 6, textAlign: "center", lineHeight: 18 },
  retryBtn: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "#EFF6FF",
  },
  retryText: { color: "#1D4ED8", fontSize: 12, fontWeight: "700" },
  reportRow: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    padding: spacing.md,
    marginBottom: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  reportRowLeft: { flex: 1, marginRight: spacing.md },
  reportTitle: { fontSize: 14, fontWeight: "700", color: "#0F172A" },
  reportAddr: { fontSize: 12, color: "#64748B", marginTop: 3 },
});
