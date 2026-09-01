import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuth } from "../../src/auth";
import { colors } from "../../src/theme";
import AdminReportCenter from "../../src/components/AdminReportCenter";

export default function AdminTab() {
  const router = useRouter();
  const { user } = useAuth();

  if (user?.role !== "manager") {
    return (
      <SafeAreaView style={styles.container} testID="admin-tab-no-access">
        <View style={styles.noAccessWrap}>
          <Text style={styles.noAccessTitle}>Bạn không có quyền truy cập</Text>
          <Text style={styles.noAccessText}>
            Khu vực này chỉ dành cho tài khoản Người thực hiện (manager).
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} testID="admin-tab-screen">
      <AdminReportCenter
        mode="admin"
        showHeader
        showStats
        title="Quản trị"
        onOpenReport={(id) =>
          router.push({
            pathname: "/admin-report",
            params: { id },
          })
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  noAccessWrap: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },
  noAccessTitle: { fontSize: 17, fontWeight: "800", color: colors.text },
  noAccessText: { marginTop: 8, color: colors.textMuted, textAlign: "center" },
});
