import { useState } from "react";
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../src/api";
import { colors, spacing } from "../src/theme";

export default function ChangePassword() {
  const router = useRouter();
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    if (!oldPw || !newPw) return Alert.alert("Thiếu thông tin", "Vui lòng nhập đầy đủ");
    if (newPw.length < 6) return Alert.alert("Mật khẩu yếu", "Mật khẩu mới cần ít nhất 6 ký tự");
    setLoading(true);
    try {
      await api("/auth/change-password", { method: "POST", body: { old_password: oldPw, new_password: newPw } });
      Alert.alert("Thành công", "Mật khẩu đã được đổi", [{ text: "OK", onPress: () => router.back() }]);
    } catch (e: any) {
      Alert.alert("Lỗi", e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Đổi mật khẩu</Text>
        <View style={{ width: 36 }} />
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
          <Text style={styles.label}>MẬT KHẨU CŨ</Text>
          <TextInput testID="old-password-input" style={styles.input} secureTextEntry value={oldPw} onChangeText={setOldPw} />
          <Text style={styles.label}>MẬT KHẨU MỚI</Text>
          <TextInput testID="new-password-input" style={styles.input} secureTextEntry value={newPw} onChangeText={setNewPw} />
          <TouchableOpacity testID="change-password-submit" style={[styles.btn, loading && { opacity: 0.6 }]} onPress={onSubmit} disabled={loading}>
            <Text style={styles.btnText}>{loading ? "Đang xử lý..." : "Cập nhật"}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: "#fff" },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 16, fontWeight: "800", color: colors.text },
  label: { fontSize: 11, fontWeight: "800", color: colors.textMuted, letterSpacing: 1, marginTop: spacing.md, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: colors.border, backgroundColor: "#fff", padding: 12, color: colors.text, fontSize: 15 },
  btn: { backgroundColor: colors.primary, paddingVertical: 14, alignItems: "center", marginTop: spacing.lg },
  btnText: { color: "#fff", fontWeight: "800", fontSize: 15 },
});
