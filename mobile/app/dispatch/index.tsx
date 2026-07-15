import { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import type { DispatchDTO, DispatchStatus } from "@gss/shared";
import { useAuth } from "../../lib/auth-context";
import { api } from "../../lib/api";
import { Badge, Screen } from "../../components/ui";
import { colors, radii, scaleFont, spacing } from "../../lib/theme";

const STATUS_FILTERS: (DispatchStatus | "ALL")[] = ["ALL", "PENDING", "DISPATCHED", "DELIVERED"];

const STATUS_TONES: Record<DispatchStatus, "primary" | "success" | "warning" | "danger"> = {
  PENDING: "primary",
  DISPATCHED: "warning",
  DELIVERED: "success",
};

export default function DispatchListScreen() {
  const { auth } = useAuth();
  const router = useRouter();
  const [dispatches, setDispatches] = useState<DispatchDTO[]>([]);
  const [statusFilter, setStatusFilter] = useState<DispatchStatus | "ALL">("ALL");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => {
    if (!auth) return;
    setRefreshing(true);
    api.dispatch
      .list(auth.token, { status: statusFilter === "ALL" ? undefined : statusFilter })
      .then(setDispatches)
      .catch(() => setDispatches([]))
      .finally(() => setRefreshing(false));
  }, [auth, statusFilter]);

  useEffect(load, [load]);

  return (
    <Screen style={styles.container}>
      <View style={styles.filterRow}>
        {STATUS_FILTERS.map((status) => (
          <Pressable
            key={status}
            style={[styles.filterChip, statusFilter === status && styles.filterChipActive]}
            onPress={() => setStatusFilter(status)}
          >
            <Text style={[styles.filterChipText, statusFilter === status && styles.filterChipTextActive]}>{status}</Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={dispatches}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={colors.accent} />}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<Text style={styles.empty}>No dispatches found</Text>}
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => router.push(`/invoice/${item.invoiceId}`)}>
            <View style={{ flex: 1 }}>
              <Text style={styles.invoiceNumber}>{item.invoiceNumber}</Text>
              <Text style={styles.meta}>
                {item.customerName} · {new Date(item.createdAt).toLocaleDateString()}
              </Text>
              <Text style={styles.meta}>
                {item.vehicleNo ? `Vehicle ${item.vehicleNo}` : "Vehicle not set"}
                {item.lrNo ? ` · LR ${item.lrNo}` : ""}
              </Text>
            </View>
            <Badge label={item.status} tone={STATUS_TONES[item.status]} />
          </Pressable>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  filterRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, padding: spacing.lg },
  filterChip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterChipText: { fontSize: scaleFont(12), color: colors.textMuted },
  filterChipTextActive: { color: colors.onPrimary },
  listContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  invoiceNumber: { fontSize: scaleFont(15), fontWeight: "600", color: colors.text },
  meta: { fontSize: scaleFont(13), color: colors.textMuted, marginTop: 2 },
  empty: { textAlign: "center", color: colors.textMuted, marginTop: 40 },
});
