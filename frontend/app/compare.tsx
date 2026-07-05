import { useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
  PanResponder,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { api } from "../src/api";
import { colors, spacing } from "../src/theme";

const DEFAULT_PLANNING =
  "https://images.unsplash.com/photo-1593449226895-cc469c86c9b0?w=900&q=70";
const DEFAULT_SATELLITE =
  "https://images.unsplash.com/photo-1754797007234-65f6025a55a9?w=900&q=70";

export default function Compare() {
  const router = useRouter();
  const [planning, setPlanning] = useState<string>(DEFAULT_PLANNING);
  const [satellite, setSatellite] = useState<string>(DEFAULT_SATELLITE);
  const [planningB64, setPlanningB64] = useState<string | null>(null);
  const [satelliteB64, setSatelliteB64] = useState<string | null>(null);
  const [width, setWidth] = useState(360);
  const [sliderX, setSliderX] = useState(180);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<any>(null);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (_, g) => {
        const x = Math.max(0, Math.min(width, g.moveX - 16));
        setSliderX(x);
      },
    })
  ).current;

  const pickImage = async (which: "planning" | "satellite") => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert("Cần quyền", "Vui lòng cho phép truy cập thư viện ảnh");
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      base64: true,
      quality: 0.7,
    });
    if (res.canceled) return;
    const asset = res.assets[0];
    const dataUrl = `data:image/jpeg;base64,${asset.base64}`;
    if (which === "planning") {
      setPlanning(asset.uri);
      setPlanningB64(dataUrl);
    } else {
      setSatellite(asset.uri);
      setSatelliteB64(dataUrl);
    }
  };

  const fetchAsBase64 = async (url: string) => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      return url;
    }
  };

  const onAnalyze = async () => {
    setAnalyzing(true);
    setResult(null);
    try {
      const p = planningB64 || (await fetchAsBase64(planning));
      const s = satelliteB64 || (await fetchAsBase64(satellite));
      const r = await api("/ai/compare", {
        method: "POST",
        body: { planning_image_base64: p, satellite_image_base64: s, location: "Khu vực phân tích" },
      });
      setResult(r);
    } catch (e: any) {
      Alert.alert("Lỗi AI", e.message || "Không thể phân tích");
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} testID="compare-screen">
      <View style={styles.header}>
        <TouchableOpacity testID="compare-back" onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>So sánh AI</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View
          style={styles.compareWrap}
          onLayout={(e) => {
            setWidth(e.nativeEvent.layout.width);
            setSliderX(e.nativeEvent.layout.width / 2);
          }}
        >
          <Image source={{ uri: satellite }} style={StyleSheet.absoluteFillObject as any} />
          <View style={[StyleSheet.absoluteFillObject as any, { width: sliderX, overflow: "hidden" }]}>
            <Image source={{ uri: planning }} style={{ width: width, height: "100%" }} />
          </View>
          <View
            style={[styles.sliderLine, { left: sliderX - 1 }]}
            {...pan.panHandlers}
          >
            <View style={styles.sliderHandle}>
              <Ionicons name="chevron-back" size={14} color={colors.text} />
              <Ionicons name="chevron-forward" size={14} color={colors.text} />
            </View>
          </View>
          <View style={[styles.tag, { left: 12, top: 12 }]}>
            <Text style={styles.tagText}>QUY HOẠCH</Text>
          </View>
          <View style={[styles.tag, { right: 12, top: 12, backgroundColor: "rgba(0,0,0,0.7)" }]}>
            <Text style={styles.tagText}>VỆ TINH</Text>
          </View>
        </View>

        <View style={styles.uploadRow}>
          <TouchableOpacity testID="upload-planning" style={styles.uploadBtn} onPress={() => pickImage("planning")}>
            <Ionicons name="map-outline" size={18} color={colors.primary} />
            <Text style={styles.uploadText}>Tải bản đồ quy hoạch</Text>
          </TouchableOpacity>
          <TouchableOpacity testID="upload-satellite" style={styles.uploadBtn} onPress={() => pickImage("satellite")}>
            <Ionicons name="globe-outline" size={18} color={colors.primary} />
            <Text style={styles.uploadText}>Tải ảnh viễn thám</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          testID="ai-analyze-button"
          style={[styles.analyzeBtn, analyzing && { opacity: 0.6 }]}
          onPress={onAnalyze}
          disabled={analyzing}
        >
          {analyzing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="sparkles" size={18} color="#fff" />
              <Text style={styles.analyzeText}>Phân tích bằng AI</Text>
            </>
          )}
        </TouchableOpacity>

        {result && (
          <View style={styles.resultBox} testID="ai-result">
            <Text style={styles.resultTitle}>KẾT QUẢ AI · Độ tin cậy {Math.round((result.confidence || 0) * 100)}%</Text>
            <Text style={styles.resultSummary}>{result.summary}</Text>
            {(result.anomalies || []).length === 0 ? (
              <View style={styles.noAnomaly}>
                <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                <Text style={styles.noAnomalyText}>Không phát hiện bất thường</Text>
              </View>
            ) : (
              result.anomalies.map((a: any) => (
                <View
                  key={a.id}
                  style={[
                    styles.anomalyCard,
                    a.severity === "high" && { borderLeftColor: colors.alert },
                    a.severity === "medium" && { borderLeftColor: colors.warning },
                    a.severity === "low" && { borderLeftColor: colors.primary },
                  ]}
                >
                  <View style={styles.anomalyHead}>
                    <Text style={styles.anomalyType}>{a.type}</Text>
                    <View
                      style={[
                        styles.sevBadge,
                        a.severity === "high" && { backgroundColor: "#FEE2E2" },
                        a.severity === "medium" && { backgroundColor: "#FFF3E0" },
                        a.severity === "low" && { backgroundColor: "#E0F2FE" },
                      ]}
                    >
                      <Text
                        style={[
                          styles.sevText,
                          a.severity === "high" && { color: colors.alert },
                          a.severity === "medium" && { color: colors.warning },
                          a.severity === "low" && { color: colors.primary },
                        ]}
                      >
                        {a.severity === "high" ? "Cao" : a.severity === "medium" ? "Trung bình" : "Thấp"}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.anomalyDesc}>{a.description}</Text>
                  {a.location_hint ? <Text style={styles.anomalyHint}>📍 {a.location_hint}</Text> : null}
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>
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
  compareWrap: {
    height: 380,
    margin: spacing.lg,
    backgroundColor: "#000",
    overflow: "hidden",
  },
  sliderLine: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  sliderHandle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#fff",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  tag: {
    position: "absolute",
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "rgba(10, 74, 191, 0.9)",
  },
  tagText: { color: "#fff", fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  uploadRow: { flexDirection: "row", paddingHorizontal: spacing.lg, gap: spacing.sm },
  uploadBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: colors.border,
  },
  uploadText: { color: colors.primary, fontWeight: "600", fontSize: 12 },
  analyzeBtn: {
    margin: spacing.lg,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  analyzeText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  resultBox: {
    marginHorizontal: spacing.lg,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  resultTitle: { fontSize: 11, color: colors.textMuted, fontWeight: "800", letterSpacing: 1 },
  resultSummary: { fontSize: 14, color: colors.text, marginTop: 6, lineHeight: 20 },
  noAnomaly: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    backgroundColor: "#DCFCE7",
    marginTop: 12,
  },
  noAnomalyText: { color: colors.success, fontWeight: "700" },
  anomalyCard: {
    marginTop: 10,
    padding: 12,
    backgroundColor: "#FAFAFA",
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  anomalyHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  anomalyType: { fontWeight: "700", color: colors.text, flex: 1 },
  sevBadge: { paddingHorizontal: 8, paddingVertical: 2 },
  sevText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
  anomalyDesc: { color: colors.text, marginTop: 6, fontSize: 13, lineHeight: 18 },
  anomalyHint: { color: colors.textMuted, marginTop: 4, fontSize: 12 },
});
