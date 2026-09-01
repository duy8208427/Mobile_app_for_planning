import { StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAuth } from "../src/auth";
import { colors } from "../src/theme";
import AdminReportCenter from "../src/components/AdminReportCenter";

export default function Admin() {
  const router = useRouter();
  const { mine } = useLocalSearchParams<{ mine?: string }>();
  const { user } = useAuth();

  const isMine = mine === "1" || user?.role !== "manager";

  return (
    <SafeAreaView style={styles.container} testID="admin-screen">
      <AdminReportCenter
        mode={isMine ? "mine" : "admin"}
        showHeader
        showBackButton
        showStats={!isMine}
        title={isMine ? "Báo cáo của tôi" : "Quản lý báo cáo"}
        onBack={() => router.back()}
        onOpenReport={(id, mode) =>
          router.push({
            pathname: mode === "mine" ? "/report-detail" : "/admin-report",
            params: { id },
          })
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
});
