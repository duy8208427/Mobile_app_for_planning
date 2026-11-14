import { View, Text, StyleSheet, TouchableOpacity, Image, Alert, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { colors, spacing } from "../theme";

/** Keep the whole request well under the 4.5 MB serverless body limit. */
const MAX_TOTAL_CHARS = 3_600_000;

function warn(title: string, message: string) {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined") window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
}

export function totalPhotoChars(photos: string[]): number {
  return photos.reduce((n, p) => n + (p?.length || 0), 0);
}

const PICK_OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ["images"],
  base64: true,
  quality: 0.3,
  exif: false,
};

function toDataUrl(asset: ImagePicker.ImagePickerAsset): string | null {
  if (asset.base64) return `data:image/jpeg;base64,${asset.base64}`;
  if (asset.uri?.startsWith("data:")) return asset.uri;
  return null;
}

type Props = {
  photos: string[];
  onChange: (photos: string[]) => void;
  max?: number;
  /** Characters already used by other photos in the same request. */
  otherChars?: number;
  label?: string;
  testID?: string;
};

export default function PhotoPicker({ photos, onChange, max = 6, otherChars = 0, label, testID }: Props) {
  const remaining = max - photos.length;

  const add = (assets: ImagePicker.ImagePickerAsset[]) => {
    const next = [...photos];
    let used = otherChars + totalPhotoChars(next);
    let skipped = 0;
    for (const a of assets) {
      if (next.length >= max) break;
      const url = toDataUrl(a);
      if (!url) continue;
      if (used + url.length > MAX_TOTAL_CHARS) {
        skipped += 1;
        continue;
      }
      next.push(url);
      used += url.length;
    }
    if (skipped) {
      warn("Ảnh quá lớn", "Tổng dung lượng ảnh đã gần giới hạn gửi lên máy chủ. Hãy bớt ảnh hoặc chụp lại ảnh nhỏ hơn.");
    }
    onChange(next);
  };

  const takePhoto = async () => {
    if (remaining <= 0) return warn("Đủ số ảnh", `Tối đa ${max} ảnh.`);
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) return warn("Cần quyền", "Cho phép ứng dụng sử dụng camera để chụp ảnh hiện trường.");
      const res = await ImagePicker.launchCameraAsync(PICK_OPTIONS);
      if (res.canceled) return;
      add(res.assets);
    } catch {
      warn("Không mở được camera", "Thiết bị không hỗ trợ camera. Hãy chọn ảnh từ thư viện.");
    }
  };

  const pickFromLibrary = async () => {
    if (remaining <= 0) return warn("Đủ số ảnh", `Tối đa ${max} ảnh.`);
    try {
      if (Platform.OS !== "web") {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) return warn("Cần quyền", "Cho phép truy cập thư viện ảnh.");
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        ...PICK_OPTIONS,
        allowsMultipleSelection: remaining > 1,
        selectionLimit: remaining,
      });
      if (res.canceled) return;
      add(res.assets);
    } catch {
      warn("Lỗi", "Không chọn được ảnh.");
    }
  };

  const remove = (idx: number) => onChange(photos.filter((_, i) => i !== idx));

  return (
    <View testID={testID}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      {photos.length > 0 ? (
        <View style={styles.grid}>
          {photos.map((p, i) => (
            <View key={`${i}-${p.length}`} style={styles.thumbWrap}>
              <Image source={{ uri: p }} style={styles.thumb} />
              <TouchableOpacity style={styles.removeBtn} onPress={() => remove(i)} accessibilityLabel="Xoá ảnh">
                <Ionicons name="close" size={14} color="#fff" />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      ) : null}
      <View style={styles.btnRow}>
        <TouchableOpacity
          style={[styles.btn, remaining <= 0 && styles.btnDisabled]}
          onPress={takePhoto}
          disabled={remaining <= 0}
          testID={testID ? `${testID}-camera` : undefined}
        >
          <Ionicons name="camera-outline" size={18} color={colors.primary} />
          <Text style={styles.btnText}>Chụp ảnh</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btn, remaining <= 0 && styles.btnDisabled]}
          onPress={pickFromLibrary}
          disabled={remaining <= 0}
          testID={testID ? `${testID}-library` : undefined}
        >
          <Ionicons name="images-outline" size={18} color={colors.primary} />
          <Text style={styles.btnText}>Thư viện</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.hint}>
        {photos.length}/{max} ảnh
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.textMuted,
    letterSpacing: 1,
    marginTop: spacing.md,
    marginBottom: 6,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  thumbWrap: { width: 84, height: 84, borderRadius: 8, overflow: "hidden", backgroundColor: "#E2E8F0" },
  thumb: { width: "100%", height: "100%" },
  removeBtn: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  btnRow: { flexDirection: "row", gap: 8 },
  btn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 11,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: "dashed",
    borderRadius: 8,
  },
  btnDisabled: { opacity: 0.45 },
  btnText: { color: colors.primary, fontWeight: "700", fontSize: 13 },
  hint: { color: colors.textMuted, fontSize: 11, marginTop: 4 },
});
