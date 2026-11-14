import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing } from "../theme";
import { FINAL_STATUSES, PHASE_SHORT, deadlineText, formatDate, formatDateTime } from "../cases";

/** 4-phase progress bar with the current phase highlighted. */
export function PhaseBar({ phase, status }: { phase?: number; status?: string }) {
  const current = phase || 1;
  const final = FINAL_STATUSES.includes(status || "");
  const closedEarly = status === "khong_vi_pham";
  return (
    <View>
      <View style={styles.barRow}>
        {[1, 2, 3, 4].map((p) => {
          const done = final ? p <= current : p < current;
          const active = !final && p === current;
          return (
            <View
              key={p}
              style={[
                styles.seg,
                done && { backgroundColor: closedEarly ? colors.textMuted : colors.success },
                active && { backgroundColor: colors.primary },
              ]}
            />
          );
        })}
      </View>
      <View style={styles.barLabels}>
        {[1, 2, 3, 4].map((p) => (
          <Text
            key={p}
            style={[styles.barLabel, p === current && { color: colors.text, fontWeight: "800" }]}
            numberOfLines={1}
          >
            {p}. {PHASE_SHORT[p]}
          </Text>
        ))}
      </View>
    </View>
  );
}

type HeaderProps = {
  code?: string;
  title?: string;
  statusLabel?: string;
  status?: string;
  step?: number;
  phase?: number;
  phaseLabel?: string;
  deadline?: string | null;
  overdue?: boolean;
};

export function CaseHeader(p: HeaderProps) {
  const final = FINAL_STATUSES.includes(p.status || "");
  return (
    <View style={styles.headerCard}>
      <View style={styles.headerTop}>
        <Text style={styles.code}>{p.code || "Hồ sơ"}</Text>
        <Text style={styles.stepText}>Bước {p.step || 1}/16</Text>
      </View>
      {p.title ? <Text style={styles.title}>{p.title}</Text> : null}
      <View style={styles.statusRow}>
        <View style={[styles.statusPill, final && { backgroundColor: "#DCFCE7" }]}>
          <Text style={[styles.statusText, final && { color: "#166534" }]}>{p.statusLabel || "—"}</Text>
        </View>
        {p.overdue ? (
          <View style={[styles.statusPill, { backgroundColor: "#FEE2E2" }]}>
            <Text style={[styles.statusText, { color: colors.alert }]}>Quá hạn</Text>
          </View>
        ) : null}
      </View>
      {p.phaseLabel ? <Text style={styles.phaseLabel}>Giai đoạn {p.phase}: {p.phaseLabel}</Text> : null}
      {p.deadline && !final ? (
        <View style={styles.deadlineRow}>
          <Ionicons name="time-outline" size={14} color={p.overdue ? colors.alert : colors.textMuted} />
          <Text style={[styles.deadlineText, p.overdue && { color: colors.alert, fontWeight: "700" }]}>
            Hạn: {formatDate(p.deadline)} ({deadlineText(p.deadline)})
          </Text>
        </View>
      ) : null}
      <View style={{ marginTop: spacing.md }}>
        <PhaseBar phase={p.phase} status={p.status} />
      </View>
    </View>
  );
}

export type TimelineItem = {
  step?: number;
  label?: string;
  status?: string;
  note?: string | null;
  by_name?: string | null;
  at?: string;
};

export function Timeline({ items }: { items: TimelineItem[] }) {
  if (!items?.length) return <Text style={styles.empty}>Chưa có hoạt động.</Text>;
  return (
    <View>
      {items.map((t, i) => {
        const last = i === items.length - 1;
        return (
          <View key={i} style={styles.tlRow}>
            <View style={styles.tlRail}>
              <View style={[styles.tlDot, last && { backgroundColor: colors.primary, borderColor: colors.primary }]} />
              {!last ? <View style={styles.tlLine} /> : null}
            </View>
            <View style={styles.tlBody}>
              <Text style={styles.tlLabel}>
                {t.step ? `Bước ${t.step}. ` : ""}
                {t.label}
              </Text>
              <Text style={styles.tlMeta}>
                {formatDateTime(t.at)}
                {t.by_name ? ` · ${t.by_name}` : ""}
              </Text>
              {t.note ? <Text style={styles.tlNote}>{t.note}</Text> : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  barRow: { flexDirection: "row", gap: 4 },
  seg: { flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.border },
  barLabels: { flexDirection: "row", gap: 4, marginTop: 4 },
  barLabel: { flex: 1, fontSize: 10, color: colors.textMuted },
  headerCard: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: spacing.md,
  },
  headerTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  code: { fontSize: 13, fontWeight: "800", color: colors.primary, letterSpacing: 0.4 },
  stepText: { fontSize: 12, fontWeight: "700", color: colors.textMuted },
  title: { fontSize: 18, fontWeight: "800", color: colors.text, marginTop: 6 },
  statusRow: { flexDirection: "row", gap: 6, marginTop: 8, flexWrap: "wrap" },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: "#E0F2FE" },
  statusText: { fontSize: 12, fontWeight: "700", color: colors.primary },
  phaseLabel: { fontSize: 12, color: colors.textMuted, marginTop: 8 },
  deadlineRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 },
  deadlineText: { fontSize: 12, color: colors.textMuted },
  empty: { color: colors.textMuted, fontSize: 13 },
  tlRow: { flexDirection: "row" },
  tlRail: { width: 18, alignItems: "center" },
  tlDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: colors.success,
    backgroundColor: "#fff",
    marginTop: 4,
  },
  tlLine: { flex: 1, width: 2, backgroundColor: colors.border, marginTop: 2 },
  tlBody: { flex: 1, paddingLeft: 8, paddingBottom: 14 },
  tlLabel: { fontSize: 13, fontWeight: "700", color: colors.text },
  tlMeta: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  tlNote: { fontSize: 12, color: colors.text, marginTop: 4, fontStyle: "italic" },
});
