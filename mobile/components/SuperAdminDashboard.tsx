import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { OutletSalesSummaryDTO } from "@gss/shared";
import { useAuth } from "../lib/auth-context";
import { api, ApiError } from "../lib/api";
import { formatMoney } from "../lib/money";
import { Card, Screen, SectionHeader } from "./ui";
import { colors, radii, scaleFont, spacing } from "../lib/theme";

export function SuperAdminDashboard() {
  const { auth } = useAuth();
  const [data, setData] = useState<OutletSalesSummaryDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => {
    if (!auth) return;
    api.dashboard
      .allOutlets(auth.token)
      .then(setData)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load outlet comparison"));
  }, [auth]);

  useEffect(load, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  if (error) {
    return (
      <Screen style={styles.centered}>
        <Text style={styles.error}>{error}</Text>
      </Screen>
    );
  }

  if (!data) {
    return (
      <Screen style={styles.centered}>
        <ActivityIndicator color={colors.accent} />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
      >
        <SectionHeader label="Shops by Monthly Sales" icon="podium-outline" />
        {data.length === 0 ? (
          <Text style={styles.helperText}>No outlets found.</Text>
        ) : (
          data.map((outlet, index) => (
            <Card key={outlet.outletId} style={styles.outletCard}>
              <View style={styles.outletHeaderRow}>
                <View style={styles.rankBadge}>
                  <Text style={styles.rankText}>{index + 1}</Text>
                </View>
                <Text style={styles.outletName}>{outlet.outletName}</Text>
                {index === 0 && data.length > 1 ? (
                  <View style={styles.topBadge}>
                    <Ionicons name="trophy-outline" size={12} color={colors.onPrimary} />
                    <Text style={styles.topBadgeText}>Highest</Text>
                  </View>
                ) : null}
              </View>

              <View style={styles.metricRow}>
                <View style={styles.metric}>
                  <Text style={styles.metricLabel}>Monthly Sales</Text>
                  <Text style={styles.metricValuePrimary}>{formatMoney(outlet.monthlySales)}</Text>
                </View>
                <View style={styles.metric}>
                  <Text style={styles.metricLabel}>Today</Text>
                  <Text style={styles.metricValue}>{formatMoney(outlet.todaySales)}</Text>
                </View>
              </View>
              <View style={styles.metricRow}>
                <View style={styles.metric}>
                  <Text style={styles.metricLabel}>Outstanding</Text>
                  <Text style={styles.metricValue}>{formatMoney(outlet.outstandingAmount)}</Text>
                </View>
                <View style={styles.metric}>
                  <Text style={styles.metricLabel}>Invoices</Text>
                  <Text style={styles.metricValue}>{outlet.totalInvoices}</Text>
                </View>
                <View style={styles.metric}>
                  <Text style={styles.metricLabel}>Customers</Text>
                  <Text style={styles.metricValue}>{outlet.totalCustomers}</Text>
                </View>
              </View>
            </Card>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  centered: { alignItems: "center", justifyContent: "center" },
  error: { color: colors.danger, fontSize: scaleFont(14) },
  helperText: { fontSize: scaleFont(13), color: colors.textMuted },
  outletCard: { marginBottom: spacing.md, padding: spacing.md },
  outletHeaderRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm },
  rankBadge: {
    width: 22,
    height: 22,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  rankText: { fontSize: scaleFont(12), fontWeight: "700", color: colors.text },
  outletName: { flex: 1, fontSize: scaleFont(15), fontWeight: "700", color: colors.text },
  topBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  topBadgeText: { fontSize: scaleFont(11), fontWeight: "700", color: colors.onPrimary },
  metricRow: { flexDirection: "row", marginTop: spacing.sm },
  metric: { flex: 1 },
  metricLabel: { fontSize: scaleFont(11), color: colors.textMuted, marginBottom: 2 },
  metricValue: { fontSize: scaleFont(14), fontWeight: "600", color: colors.text },
  metricValuePrimary: { fontSize: scaleFont(16), fontWeight: "700", color: colors.accent },
});
