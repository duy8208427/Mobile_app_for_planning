import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { colors, spacing } from "../theme";
import { FINAL_STATUSES, caseDetailHref, deadlineText, formatDate } from "../cases";

export type CaseListItem = {
  id: string;
  code: string;
  title: string;
  address?: string;
  status: string;
  status_label?: string;
  citizen_status_label?: string;
  step?: number;
  phase?: number;
  phase_label?: string;
  violation_name?: string;
  deadline?: string | null;
  overdue?: boolean;
  assignment?: { officer_name?: string; due_date?: string } | null;
  available_actions?: string[];
  updated_at?: string;
};

/** Open cases first, then by deadline (soonest first), cases without deadline last. */
export function sortByDeadline(items: CaseListItem[]): CaseListItem[] {
  return [...items].sort((a, b) => {
    const fa = FINAL_STATUSES.includes(a.status) ? 1 : 0;
    const fb = FINAL_STATUSES.includes(b.status) ? 1 : 0;
    if (fa !== fb) return fa - fb;
    const da = a.deadline || "9999-12-31";
    const db = b.deadline || "9999-12-31";
    return da.localeCompare(db);
  });
}

export default function CaseRow({ item, citizenView, showOfficer }: { item: CaseListItem; citizenView?: boolean; showOfficer?: boolean }) {
  const router = useRouter();
  const final = FINAL_STATUSES.includes(item.status);
  const needsMe = !!item.available_actions?.length;
  return (
    <TouchableOpacity
      testID={`case-row-${item.id}`}
      style={[styles.row, item.overdue && styles.rowOverdue]}
      onPress={() => router.push(caseDetailHref(item.id))}
      activeOpacity={0.85}
    >
      <View style={styles.rowTop}>
        <Text style={styles.code}>{item.code}</Text>
        {!citizenView ? <Text style={styles.step}>Bước {item.step || 1}/16</Text> : null}
      </View>
      <Text style={styles.title} numberOfLines={2}>
        {item.title}
      </Text>
      {item.address ? (
        <Text style={styles.addr} numberOfLines={1}>
          {item.address}
        </Text>
      ) : null}
      {!citizenView && item.violation_name ? (
        <Text style={styles.violation} numberOfLines={1}>
          {item.violation_name}
        </Text>
      ) : null}
      <View style={styles.badges}>
        <View style={[styles.badge, final && { backgroundColor: "#DCFCE7" }]}>
          <Text style={[styles.badgeText, final && { color: "#166534" }]}>
            {citizenView ? item.citizen_status_label || item.status_label : item.status_label}
          </Text>
        </View>
        {item.overdue && !citizenView ? (
          <View style={[styles.badge, { backgroundColor: "#FEE2E2" }]}>
            <Text style={[styles.badgeText, { color: colors.alert }]}>Quá hạn</Text>
          </View>
        ) : null}
        {needsMe ? (
          <View style={[styles.badge, { backgroundColor: "#FEF3C7" }]}>
            <Text style={[styles.badgeText, { color: "#B45309" }]}>Cần xử lý</Text>
          </View>
        ) : null}
      </View>
      {(item.deadline && !final && !citizenView) || (showOfficer && item.assignment?.officer_name) ? (
        <View style={styles.metaRow}>
          {item.deadline && !final && !citizenView ? (
            <Text style={[styles.meta, item.overdue && { color: colors.alert, fontWeight: "700" }]}>
              Hạn {formatDate(item.deadline)} · {deadlineText(item.deadline)}
            </Text>
          ) : null}
          {showOfficer && item.assignment?.officer_name ? (
            <Text style={styles.meta}>CB: {item.assignment.officer_name}</Text>
          ) : null}
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: spacing.md,
    marginBottom: 8,
  },
  rowOverdue: { borderColor: "#FCA5A5", borderLeftWidth: 4, borderLeftColor: colors.alert },
  rowTop: { flexDirection: "row", justifyContent: "space-between" },
  code: { fontSize: 12, fontWeight: "800", color: colors.primary, letterSpacing: 0.3 },
  step: { fontSize: 11, fontWeight: "700", color: colors.textMuted },
  title: { fontSize: 15, fontWeight: "700", color: colors.text, marginTop: 4 },
  addr: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  violation: { fontSize: 12, color: colors.text, marginTop: 4 },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: "#E0F2FE" },
  badgeText: { fontSize: 11, fontWeight: "700", color: colors.primary },
  metaRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 8, gap: 8 },
  meta: { fontSize: 11, color: colors.textMuted },
});
