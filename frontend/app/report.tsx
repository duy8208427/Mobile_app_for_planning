import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { api } from "../src/api";
import { colors, spacing } from "../src/theme";

export default function ReportScreen() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageB64, setImageB64] = useState<string | null>(null);
  const [violationType, setViolationType] = useState("construction");
  const [submitting, setSubmitting] = useState(false);

  const types = [
    { id: "construction", label: "Xây dựng trái phép" },
    { id: "encroachment", label: "Lấn chiếm" },
    { id: "zoning", label: "Sai quy hoạch" },
    { id: "other", label: "Khác" },
  ];

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert("Cần quyền", "Cho phép truy cập thư viện ảnh");
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      base64: true,
      quality: 0.6,
    });
    if (res.canceled) return;
    const asset = res.assets[0];
    setImageUri(asset.uri);
    setImageB64(`data:image/jpeg;base64,${asset.base64}`);
  };

  const getLocation = async () => {
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== "granted") {
        Alert.alert("Cần quyền", "Cho phép truy cập vị trí");
        return;
      }
      const loc = await Location.getCurrentPositionAsync({});
      setCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude });
    } catch (e) {
      Alert.alert("Lỗi", "Không thể lấy vị trí");
    }
  };

  const onSubmit = async () => {
    if (!title || !description || !address) {
      return Alert.alert("Thiếu thông tin", "Vui lòng nhập tiêu đề, mô tả và địa chỉ");
    }
    setSubmitting(true);
    try {
      await api("/reports", {
        method: "POST",
        body: {
          title,
          description,
          address,
          latitude: coords?.lat,
          longitude: coords?.lng,
          image_base64: imageB64,
          violation_type: violationType,
        },
      });
      Alert.alert("Thành công", "Báo cáo đã được gửi đến cơ quan quản lý", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (e: any) {
      Alert.alert("Lỗi", e.message || "Gửi báo cáo thất bại");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} testID="report-screen">
      <View style={styles.header}>
        <TouchableOpacity testID="report-back" onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Báo cáo vi phạm</Text>
        <View style={{ width: 36 }} />
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}>
          <Text style={styles.label}>TIÊU ĐỀ</Text>
          <TextInput
            testID="report-title-input"
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="VD: Nhà 4 tầng xây không phép"
            placeholderTextColor={colors.textMuted}
          />

          <Text style={styles.label}>LOẠI VI PHẠM</Text>
          <View style={styles.typeRow}>
            {types.map((t) => (
              <TouchableOpacity
                key={t.id}
                testID={`type-${t.id}`}
                style={[styles.typeChip, violationType === t.id && styles.typeChipActive]}
                onPress={() => setViolationType(t.id)}
              >
                <Text style={[styles.typeText, violationType === t.id && { color: "#fff" }]}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>ĐỊA CHỈ</Text>
          <TextInput
            testID="report-address-input"
            style={styles.input}
            value={address}
            onChangeText={setAddress}
            placeholder="VD: Số 123 Đường Nguyễn Huệ, Quận 1, TP.HCM"
            placeholderTextColor={colors.textMuted}
          />

          <TouchableOpacity testID="get-location-btn" style={styles.gpsBtn} onPress={getLocation}>
            <Ionicons name="locate" size={18} color={colors.primary} />
            <Text style={styles.gpsText}>
              {coords
                ? `Tọa độ: ${coords.lat.toFixed(5)}°, ${coords.lng.toFixed(5)}°`
                : "Lấy tọa độ GPS hiện tại"}
            </Text>
          </TouchableOpacity>

          <Text style={styles.label}>HÌNH ẢNH HIỆN TRẠNG</Text>
          <TouchableOpacity testID="report-image-picker" style={styles.imageBox} onPress={pickImage}>
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={styles.imagePreview} />
            ) : (
              <View style={styles.imagePlaceholder}>
                <Ionicons name="camera-outline" size={32} color={colors.textMuted} />
                <Text style={styles.imageHint}>Chọn ảnh từ thư viện</Text>
              </View>
            )}
          </TouchableOpacity>

          <Text style={styles.label}>MÔ TẢ CHI TIẾT</Text>
          <TextInput
            testID="report-description-input"
            style={[styles.input, { height: 120, textAlignVertical: "top" }]}
            value={description}
            onChangeText={setDescription}
            placeholder="Mô tả tình hình vi phạm, thời gian phát hiện..."
            placeholderTextColor={colors.textMuted}
            multiline
          />

          <TouchableOpacity
            testID="report-submit-button"
            style={[styles.submit, submitting && { opacity: 0.6 }]}
            onPress={onSubmit}
            disabled={submitting}
          >
            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Gửi báo cáo</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
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
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: "#fff",
  },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 16, fontWeight: "800", color: colors.text },
  label: { fontSize: 11, fontWeight: "800", color: colors.textMuted, letterSpacing: 1, marginTop: spacing.md, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#fff",
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
  },
  typeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  typeChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: colors.border,
  },
  typeChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  typeText: { color: colors.text, fontWeight: "600", fontSize: 12 },
  gpsBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.sm,
  },
  gpsText: { color: colors.text, fontSize: 13 },
  imageBox: {
    height: 160,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: "dashed",
    overflow: "hidden",
  },
  imagePreview: { width: "100%", height: "100%" },
  imagePlaceholder: { flex: 1, alignItems: "center", justifyContent: "center", gap: 6 },
  imageHint: { color: colors.textMuted },
  submit: {
    marginTop: spacing.lg,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    alignItems: "center",
  },
  submitText: { color: "#fff", fontWeight: "800", fontSize: 15 },
});
