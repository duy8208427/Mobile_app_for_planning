import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Link, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../src/auth";
import { colors, spacing } from "../src/theme";

export default function Register() {
  const router = useRouter();
  const { register } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<"citizen" | "admin">("citizen");
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    if (!email || !password || !fullName) {
      return Alert.alert("Thiếu thông tin", "Vui lòng nhập đầy đủ");
    }
    if (password.length < 6) {
      return Alert.alert("Mật khẩu yếu", "Mật khẩu cần ít nhất 6 ký tự");
    }
    setLoading(true);
    try {
      await register(email.trim(), password, fullName, phone, role);
      router.replace("/(tabs)");
    } catch (e: any) {
      Alert.alert("Đăng ký thất bại", e.message || "Vui lòng thử lại");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Tạo tài khoản</Text>
          <Text style={styles.subtitle}>Tham gia hệ thống Quy hoạch AI</Text>

          <View style={styles.formCard}>
            <Text style={styles.label}>HỌ VÀ TÊN</Text>
            <TextInput
              testID="register-fullname-input"
              style={styles.input}
              value={fullName}
              onChangeText={setFullName}
              placeholder="Nguyễn Văn A"
              placeholderTextColor={colors.textMuted}
            />

            <Text style={styles.label}>EMAIL</Text>
            <TextInput
              testID="register-email-input"
              style={styles.input}
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              placeholder="email@quyhoach.vn"
              placeholderTextColor={colors.textMuted}
            />

            <Text style={styles.label}>SỐ ĐIỆN THOẠI</Text>
            <TextInput
              testID="register-phone-input"
              style={styles.input}
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
              placeholder="0901234567"
              placeholderTextColor={colors.textMuted}
            />

            <Text style={styles.label}>MẬT KHẨU</Text>
            <TextInput
              testID="register-password-input"
              style={styles.input}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={colors.textMuted}
            />

            <Text style={styles.label}>VAI TRÒ</Text>
            <View style={styles.roleRow}>
              <TouchableOpacity
                testID="register-role-citizen"
                style={[styles.roleBtn, role === "citizen" && styles.roleBtnActive]}
                onPress={() => setRole("citizen")}
              >
                <Text style={[styles.roleText, role === "citizen" && styles.roleTextActive]}>
                  Người dân
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID="register-role-admin"
                style={[styles.roleBtn, role === "admin" && styles.roleBtnActive]}
                onPress={() => setRole("admin")}
              >
                <Text style={[styles.roleText, role === "admin" && styles.roleTextActive]}>
                  Người phụ trách
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              testID="register-submit-button"
              style={[styles.btn, loading && { opacity: 0.6 }]}
              onPress={onSubmit}
              disabled={loading}
            >
              <Text style={styles.btnText}>{loading ? "Đang xử lý..." : "Đăng ký"}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Đã có tài khoản? </Text>
            <Link href="/login" testID="goto-login-link">
              <Text style={styles.link}>Đăng nhập</Text>
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
  title: { fontSize: 28, fontWeight: "800", color: colors.text, letterSpacing: -0.5 },
  subtitle: { color: colors.textMuted, marginTop: 4, marginBottom: spacing.lg },
  formCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  label: { fontSize: 11, color: colors.textMuted, letterSpacing: 1.2, marginBottom: 6, fontWeight: "700" },
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
  roleRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
  roleBtn: {
    flex: 1,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    backgroundColor: "#fff",
  },
  roleBtnActive: { borderColor: colors.primary, backgroundColor: "#EEF2FF" },
  roleText: { color: colors.text, fontWeight: "600" },
  roleTextActive: { color: colors.primary },
  btn: { backgroundColor: colors.primary, paddingVertical: 14, alignItems: "center", marginTop: spacing.sm },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: spacing.lg },
  footerText: { color: colors.textMuted },
  link: { color: colors.primary, fontWeight: "700" },
});
