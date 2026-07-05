import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../src/api";
import { colors, spacing } from "../src/theme";

export default function LegalDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [doc, setDoc] = useState<any>(null);

  useEffect(() => {
    if (id) api(`/legal/${id}`, { auth: false }).then(setDoc).catch(() => {});
  }, [id]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Chi tiết văn bản</Text>
        <View style={{ width: 36 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
        {doc && (
          <>
            <View style={styles.codeBadge}>
              <Text style={styles.codeText}>{doc.category}</Text>
            </View>
            <Text style={styles.code}>{doc.code}</Text>
            <Text style={styles.title}>{doc.title}</Text>
            <View style={styles.metaRow}>
              <Text style={styles.meta}>Cơ quan: {doc.issuer}</Text>
              <Text style={styles.meta}>Ngày: {doc.issued_date}</Text>
            </View>
            <View style={styles.divider} />
            <Text style={styles.sectionTitle}>TÓM TẮT</Text>
            <Text style={styles.body}>{doc.summary}</Text>
            <Text style={styles.sectionTitle}>NỘI DUNG</Text>
            <Text style={styles.body}>{doc.content}</Text>
          </>
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
  codeBadge: { alignSelf: "flex-start", backgroundColor: "#EEF2FF", paddingHorizontal: 10, paddingVertical: 4 },
  codeText: { color: colors.primary, fontSize: 11, fontWeight: "800", letterSpacing: 0.5 },
  code: { color: colors.textMuted, marginTop: 8, fontWeight: "600" },
  title: { fontSize: 22, fontWeight: "800", color: colors.text, marginTop: 4, letterSpacing: -0.3 },
  metaRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 12 },
  meta: { color: colors.textMuted, fontSize: 12 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.md },
  sectionTitle: { fontSize: 11, fontWeight: "800", color: colors.textMuted, letterSpacing: 1, marginTop: spacing.md, marginBottom: 6 },
  body: { color: colors.text, fontSize: 14, lineHeight: 22 },
});
