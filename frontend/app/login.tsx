import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
} from "react-native";
import { Link, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../src/auth";
import { colors, spacing } from "../src/theme";

function showNotice(title: string, message: string) {
  if (Platform.OS !== "web") {
    Alert.alert(title, message);
  }
}

export default function Login() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const onSubmit = async () => {
    if (!email || !password) {
      const msg = "Vui lòng nhập email và mật khẩu";
      setError(msg);
      showNotice("Thiếu thông tin", msg);
      return;
    }
    setError("");
    setLoading(true);
    try {
      await login(email.trim(), password);
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
            <Text style={styles.label}>EMAIL</Text>
            <TextInput
              testID="login-email-input"
              style={styles.input}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="email@quyhoach.vn"
              placeholderTextColor={colors.textMuted}
              value={email}
              onChangeText={(v) => {
                setEmail(v);
                if (error) setError("");
              }}
            />
            <Text style={styles.label}>MẬT KHẨU</Text>
            <TextInput
              testID="login-password-input"
              style={styles.input}
              secureTextEntry
              placeholder="••••••••"
              placeholderTextColor={colors.textMuted}
              value={password}
              onChangeText={(v) => {
                setPassword(v);
                if (error) setError("");
              }}
            />
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

          <View style={styles.helperBox}>
            <Text style={styles.helperTitle}>Tài khoản dùng thử</Text>
            <Text style={styles.helperLine}>Người dân: citizen@quyhoach.vn / Citizen@123</Text>
            <Text style={styles.helperLine}>Người thực hiện: manager@quyhoach.vn / Manager@123</Text>
            <Text style={styles.helperLine}>Admin (web): admin@quyhoach.vn / Admin@123</Text>
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
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
    marginBottom: spacing.md,
    backgroundColor: "#fff",
  },
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
  helperBox: {
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: "#EEF2FF",
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  helperTitle: { fontWeight: "700", color: colors.text, marginBottom: 4, fontSize: 12, letterSpacing: 0.5 },
  helperLine: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: spacing.lg },
  footerText: { color: colors.textMuted },
  link: { color: colors.primary, fontWeight: "700" },
});
