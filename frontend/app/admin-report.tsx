import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api } from "../src/api";
import { colors } from "../src/theme";
import { caseDetailHref, casesHref } from "../src/cases";

/** Old report handling screen: open the report's case instead. */
export default function AdminReportRedirect() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let caseId: string | undefined;
      if (id) {
        try {
          caseId = (await api(`/reports/${id}`))?.case_id;
        } catch {}
      }
      if (!cancelled) router.replace(caseId ? caseDetailHref(caseId) : casesHref());
    })();
    return () => {
      cancelled = true;
    };
  }, [id, router]);

  return (
    <View style={styles.container}>
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
});
