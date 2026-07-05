import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../src/api";
import { colors, spacing } from "../src/theme";

export default function Legal() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [docs, setDocs] = useState<any[]>([]);

  const load = useCallback(async (search?: string) => {
    try {
      const data = await api(`/legal${search ? `?q=${encodeURIComponent(search)}` : ""}`, { auth: false });
      setDocs(data);
    } catch {}
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <SafeAreaView style={styles.container} testID="legal-screen">
      <View style={styles.header}>
        <TouchableOpacity testID="legal-back" onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Văn bản pháp luật</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color={colors.textMuted} />
        <TextInput
          testID="legal-search-input"
          style={styles.searchInput}
          placeholder="Tìm kiếm luật, nghị định, thông tư..."
          placeholderTextColor={colors.textMuted}
          value={q}
          onChangeText={setQ}
          onSubmitEditing={() => load(q)}
          returnKeyType="search"
        />
        {q.length > 0 && (
          <TouchableOpacity onPress={() => { setQ(""); load(""); }} testID="legal-clear">
            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={docs}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: spacing.lg }}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        renderItem={({ item }) => (
          <TouchableOpacity
            testID={`legal-item-${item.id}`}
            style={styles.card}
            onPress={() => router.push({ pathname: "/legal-detail", params: { id: item.id } })}
          >
            <View style={styles.cardTop}>
              <View style={styles.codeBadge}>
                <Text style={styles.codeText}>{item.category}</Text>
              </View>
              <Text style={styles.codeMain}>{item.code}</Text>
            </View>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardSummary} numberOfLines={2}>{item.summary}</Text>
            <View style={styles.cardFoot}>
              <Text style={styles.cardMeta}>{item.issuer}</Text>
              <Text style={styles.cardMeta}>{item.issued_date}</Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={{ padding: spacing.xl, alignItems: "center" }}>
            <Text style={{ color: colors.textMuted }}>Không tìm thấy văn bản</Text>
          </View>
        }
      />
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
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    margin: spacing.lg,
    paddingHorizontal: 12,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  searchInput: { flex: 1, paddingVertical: 12, color: colors.text, fontSize: 14 },
  card: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  codeBadge: { backgroundColor: "#EEF2FF", paddingHorizontal: 8, paddingVertical: 2 },
  codeText: { color: colors.primary, fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
  codeMain: { color: colors.textMuted, fontSize: 12, fontWeight: "600" },
  cardTitle: { color: colors.text, fontWeight: "800", fontSize: 15 },
  cardSummary: { color: colors.textMuted, marginTop: 4, fontSize: 13, lineHeight: 18 },
  cardFoot: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  cardMeta: { color: colors.textMuted, fontSize: 11 },
});
