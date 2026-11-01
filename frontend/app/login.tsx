import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
} from "react-native";
import { Link, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../src/auth";
import { colors, spacing } from "../src/theme";

const ACCOUNTS = [
  {
    email: "citizen@quyhoach.vn",
    password: "Citizen@123",
    label: "Nguyễn Văn An — Người dân",
  },
  {
    email: "manager@quyhoach.vn",
    password: "Manager@123",
    label: "Phạm Văn Thực — Người thực hiện",
  },
  {
    email: "admin@quyhoach.vn",
    password: "Admin@123",
    label: "Trần Văn Quản — Quản trị",
  },
] as const;

function showNotice(title: string, message: string) {
  if (Platform.OS !== "web") {
    Alert.alert(title, message);
  }
}

export default function Login() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState<string>(ACCOUNTS[0].email);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const selected = ACCOUNTS.find((a) => a.email === email) ?? ACCOUNTS[0];

  const onSubmit = async () => {
    setError("");
    setLoading(true);
    try {
      await login(selected.email, selected.password);
      router.replace("/(tabs)");
    } catch (e: any) {
      const msg = e.message || "Vui lòng thử lại";
      setError(msg);
      showNotice("Đăng nhập thất bại", msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.brand}>
            <Text style={styles.brandSquare}>QH</Text>
          </View>
          <Text style={styles.title}>Quy Hoạch AI</Text>
          <Text style={styles.subtitle}>Quản lý quy hoạch & trật tự xây dựng</Text>

          <View style={styles.formCard}>
            <Text style={styles.label}>TÀI KHOẢN</Text>
            <TouchableOpacity
              testID="login-email-input"
              style={styles.select}
              onPress={() => setOpen((v) => !v)}
              accessibilityRole="combobox"
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.selectLabel}>{selected.label}</Text>
                <Text style={styles.selectEmail}>{selected.email}</Text>
              </View>
              <Ionicons name={open ? "chevron-up" : "chevron-down"} size={18} color={colors.textMuted} />
            </TouchableOpacity>
            {open
              ? ACCOUNTS.map((acc) => (
                  <TouchableOpacity
                    key={acc.email}
                    testID={`login-account-${acc.email}`}
                    style={[
                      styles.option,
                      acc.email === selected.email && styles.optionActive,
                    ]}
                    onPress={() => {
                      setEmail(acc.email);
                      setOpen(false);
                      if (error) setError("");
                    }}
                  >
                    <Text style={styles.selectLabel}>{acc.label}</Text>
                    <Text style={styles.selectEmail}>{acc.email}</Text>
                  </TouchableOpacity>
                ))
              : null}
            {error ? (
              <Text testID="login-error" style={styles.error}>
                {error}
              </Text>
            ) : null}
            <TouchableOpacity
              testID="login-submit-button"
              style={[styles.btn, loading && { opacity: 0.6 }]}
              onPress={onSubmit}
              disabled={loading}
            >
              <Text style={styles.btnText}>{loading ? "Đang xử lý..." : "Đăng nhập"}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Chưa có tài khoản? </Text>
            <Link href="/register" testID="goto-register-link">
              <Text style={styles.link}>Đăng ký ngay</Text>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.lg, paddingTop: spacing.xl },
  brand: {
    width: 56,
    height: 56,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  brandSquare: { color: "#fff", fontSize: 20, fontWeight: "800", letterSpacing: 1 },
  title: { fontSize: 30, fontWeight: "800", color: colors.text, letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: colors.textMuted, marginTop: 4, marginBottom: spacing.lg },
  formCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  label: {
    fontSize: 11,
    color: colors.textMuted,
    letterSpacing: 1.2,
    marginBottom: 6,
    fontWeight: "700",
  },
  select: {
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    marginBottom: spacing.sm,
    backgroundColor: "#fff",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  selectLabel: { fontSize: 15, color: colors.text, fontWeight: "600" },
  selectEmail: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  option: {
    borderWidth: 1,
    borderColor: colors.border,
    borderTopWidth: 0,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    backgroundColor: "#fff",
  },
  optionActive: { backgroundColor: "#EEF2FF" },
  error: {
    color: colors.alert,
    fontSize: 13,
    marginBottom: spacing.sm,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
  },
  btn: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: spacing.sm,
  },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 15, letterSpacing: 0.3 },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: spacing.lg },
  footerText: { color: colors.textMuted },
  link: { color: colors.primary, fontWeight: "700" },
});
