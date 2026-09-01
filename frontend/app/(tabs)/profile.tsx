import { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "../../src/auth";
import { confirmAction } from "../../src/confirm";
import { api } from "../../src/api";
import { colors, spacing } from "../../src/theme";

export default function Profile() {
  const router = useRouter();
  const { user, logout, setUser } = useAuth();
  const [reportCount, setReportCount] = useState(0);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [province, setProvince] = useState("");
  const [district, setDistrict] = useState("");
  const [ward, setWard] = useState("");
  const [street, setStreet] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setFullName(user?.full_name || "");
    setEmail(user?.email || "");
    setPhone(user?.phone || "");
    setProvince(user?.address?.province || "");
    setDistrict(user?.address?.district || "");
    setWard(user?.address?.ward || "");
    setStreet(user?.address?.street || "");
  }, [user]);

  useEffect(() => {
    (async () => {
      try {
        if (user?.role === "citizen") {
          const r = await api("/reports/mine");
          setReportCount(r.length);
        } else {
          const s = await api("/admin/stats");
          setReportCount(s.total);
        }
      } catch {}
    })();
  }, [user]);

  const onLogout = async () => {
    const ok = await confirmAction("Đăng xuất", "Bạn có chắc muốn đăng xuất?");
    if (!ok) return;
    await logout();
    router.replace("/login");
  };

  const onSaveProfile = async () => {
    const normalizedName = fullName.trim();
    const normalizedEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!normalizedName) {
      return Alert.alert("Thiếu thông tin", "Họ và tên là bắt buộc");
    }
    if (!normalizedEmail) {
      return Alert.alert("Thiếu thông tin", "Email là bắt buộc");
    }
    if (!emailRegex.test(normalizedEmail)) {
      return Alert.alert("Email không hợp lệ", "Vui lòng nhập đúng định dạng email");
    }

    setSaving(true);
    try {
      const updated = await api("/auth/profile", {
        method: "PUT",
        body: {
          full_name: normalizedName,
          email: normalizedEmail,
          phone: phone.trim(),
          address: {
            province: province.trim(),
            district: district.trim(),
            ward: ward.trim(),
            street: street.trim(),
          },
        },
      });
      setUser(updated);
      Alert.alert("Thành công", "Đã cập nhật thông tin tài khoản");
    } catch (e: any) {
      Alert.alert("Cập nhật thất bại", e?.message || "Vui lòng thử lại");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} testID="profile-screen">
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}>
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(user?.full_name || "U").charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.name}>{user?.full_name}</Text>
          <Text style={styles.email}>{user?.email}</Text>
          <View
            style={[
              styles.roleBadge,
              (user?.role === "manager" || user?.role === "admin") && {
                backgroundColor: colors.primary,
              },
            ]}
          >
            <Text
              style={[
                styles.roleText,
                (user?.role === "manager" || user?.role === "admin") && { color: "#fff" },
              ]}
            >
              {user?.role === "manager"
                ? "Người thực hiện"
                : user?.role === "admin"
                  ? "Admin"
                  : "Người dân"}
            </Text>
          </View>
        </View>

        <View style={styles.statBox}>
          <View style={styles.statItem}>
            <Text style={styles.statNum}>{reportCount}</Text>
            <Text style={styles.statLabel}>
              {user?.role === "manager" ? "Tổng báo cáo" : "Báo cáo của tôi"}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>CẬP NHẬT THÔNG TIN</Text>
        <View style={styles.formCard}>
          <Text style={styles.label}>HỌ VÀ TÊN *</Text>
          <TextInput
            testID="profile-fullname-input"
            style={styles.input}
            value={fullName}
            onChangeText={setFullName}
            placeholder="Nguyễn Văn A"
            placeholderTextColor={colors.textMuted}
          />

          <Text style={styles.label}>EMAIL ĐĂNG NHẬP *</Text>
          <TextInput
            testID="profile-email-input"
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
            testID="profile-phone-input"
            style={styles.input}
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
            placeholder="0901234567"
            placeholderTextColor={colors.textMuted}
          />

          <Text style={styles.label}>TỈNH/THÀNH PHỐ</Text>
          <TextInput
            testID="profile-province-input"
            style={styles.input}
            value={province}
            onChangeText={setProvince}
            placeholder="TP. Hồ Chí Minh"
            placeholderTextColor={colors.textMuted}
          />

          <Text style={styles.label}>QUẬN/HUYỆN</Text>
          <TextInput
            testID="profile-district-input"
            style={styles.input}
            value={district}
            onChangeText={setDistrict}
            placeholder="Quận 1"
            placeholderTextColor={colors.textMuted}
          />

          <Text style={styles.label}>PHƯỜNG/XÃ</Text>
          <TextInput
            testID="profile-ward-input"
            style={styles.input}
            value={ward}
            onChangeText={setWard}
            placeholder="Phường Bến Nghé"
            placeholderTextColor={colors.textMuted}
          />

          <Text style={styles.label}>SỐ NHÀ, TÊN ĐƯỜNG</Text>
          <TextInput
            testID="profile-street-input"
            style={styles.input}
            value={street}
            onChangeText={setStreet}
            placeholder="12 Nguyễn Huệ"
            placeholderTextColor={colors.textMuted}
          />

          <TouchableOpacity
            testID="profile-save-button"
            style={[styles.saveBtn, saving && { opacity: 0.6 }]}
            onPress={onSaveProfile}
            disabled={saving}
          >
            <Text style={styles.saveBtnText}>{saving ? "Đang lưu..." : "Lưu thông tin"}</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>TÀI KHOẢN</Text>
        <View style={styles.menu}>
          <Row
            icon="document-text-outline"
            label="Báo cáo đã gửi"
            onPress={() => router.push({ pathname: "/admin", params: { mine: "1" } })}
            testID="menu-my-reports"
            hidden={user?.role === "manager"}
          />
          <Row
            icon="key-outline"
            label="Đổi mật khẩu"
            onPress={() => router.push("/change-password")}
            testID="menu-change-password"
          />
          <Row icon="notifications-outline" label="Cài đặt thông báo" onPress={() => Alert.alert("Sắp ra mắt")} testID="menu-notif-setting" />
          <Row icon="language-outline" label="Ngôn ngữ: Tiếng Việt" onPress={() => Alert.alert("Đa ngôn ngữ", "Sắp ra mắt")} testID="menu-language" />
          <Row icon="shield-checkmark-outline" label="Quyền riêng tư" onPress={() => Alert.alert("Quyền riêng tư")} testID="menu-privacy" />
        </View>

        <TouchableOpacity testID="logout-button" style={styles.logout} onPress={onLogout}>
          <Ionicons name="log-out-outline" size={20} color={colors.alert} />
          <Text style={styles.logoutText}>Đăng xuất</Text>
        </TouchableOpacity>

        <Text style={styles.version}>QuyHoạch AI · v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({
  icon,
  label,
  onPress,
  testID,
  hidden,
}: {
  icon: any;
  label: string;
  onPress: () => void;
  testID: string;
  hidden?: boolean;
}) {
  if (hidden) return null;
  return (
    <TouchableOpacity testID={testID} style={styles.row} onPress={onPress}>
      <Ionicons name={icon} size={20} color={colors.text} />
      <Text style={styles.rowLabel}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  profileCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    alignItems: "center",
  },
  avatar: {
    width: 72,
    height: 72,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  avatarText: { color: "#fff", fontSize: 28, fontWeight: "800" },
  name: { fontSize: 18, fontWeight: "800", color: colors.text },
  email: { color: colors.textMuted, marginTop: 2 },
  roleBadge: {
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#EEF2FF",
  },
  roleText: { color: colors.primary, fontWeight: "700", fontSize: 12, letterSpacing: 0.3 },
  statBox: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.md,
  },
  statItem: { flex: 1, alignItems: "center", padding: spacing.md },
  statNum: { fontSize: 22, fontWeight: "800", color: colors.text },
  statLabel: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  formCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  label: {
    fontSize: 11,
    color: colors.textMuted,
    letterSpacing: 1.1,
    marginBottom: 6,
    fontWeight: "700",
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 11,
    fontSize: 14,
    color: colors.text,
    marginBottom: spacing.sm,
    backgroundColor: "#fff",
  },
  saveBtn: {
    marginTop: spacing.sm,
    backgroundColor: colors.primary,
    alignItems: "center",
    paddingVertical: 12,
  },
  saveBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.textMuted,
    letterSpacing: 1.2,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  menu: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 12,
  },
  rowLabel: { flex: 1, color: colors.text, fontSize: 14 },
  logout: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.md,
    marginTop: spacing.lg,
    borderWidth: 1,
    borderColor: colors.alert,
    gap: 8,
  },
  logoutText: { color: colors.alert, fontWeight: "700" },
  version: { textAlign: "center", color: colors.textMuted, fontSize: 11, marginTop: spacing.lg },
});
