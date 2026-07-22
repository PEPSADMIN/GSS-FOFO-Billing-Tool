import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import type { InvoiceDTO, InvoiceStatus } from "@gss/shared";
import { useAuth } from "../../lib/auth-context";
import { api, ApiError } from "../../lib/api";
import { formatMoney } from "../../lib/money";
import { downloadFile } from "../../lib/download";
import { Button, Screen } from "../../components/ui";
import { DateRangeModal } from "../../components/DateRangeModal";
import { colors, radii, scaleFont, spacing } from "../../lib/theme";

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

const PAGE_SIZE = 20;

const STATUS_FILTERS: (InvoiceStatus | "ALL")[] = ["ALL", "PAID", "PARTIAL", "UNPAID"];

const STATUS_COLORS: Record<InvoiceStatus, string> = {
  PAID: colors.success,
  PARTIAL: colors.warning,
  UNPAID: colors.danger,
};

export default function InvoicesScreen() {
  const { auth } = useAuth();
  const router = useRouter();
  const [invoices, setInvoices] = useState<InvoiceDTO[]>([]);
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | "ALL">("ALL");
  const [refreshing, setRefreshing] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [dateModalVisible, setDateModalVisible] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);

  const filterOpts = useCallback(
    () => ({
      status: statusFilter === "ALL" ? undefined : statusFilter,
      from: from || undefined,
      to: to || undefined,
    }),
    [statusFilter, from, to]
  );

  const load = useCallback(() => {
    if (!auth) return;
    setRefreshing(true);
    setPage(1);
    api.invoices
      .list(auth.token, { ...filterOpts(), page: 1, pageSize: PAGE_SIZE })
      .then((res) => {
        setInvoices(res.data);
        setTotal(res.total);
      })
      .catch(() => {
        setInvoices([]);
        setTotal(0);
      })
      .finally(() => setRefreshing(false));
  }, [auth, filterOpts]);

  useEffect(() => {
    load();
  }, [load]);

  function loadMore() {
    if (!auth || loadingMore || refreshing || invoices.length >= total) return;
    const nextPage = page + 1;
    setLoadingMore(true);
    api.invoices
      .list(auth.token, { ...filterOpts(), page: nextPage, pageSize: PAGE_SIZE })
      .then((res) => {
        setInvoices((prev) => [...prev, ...res.data]);
        setPage(nextPage);
      })
      .catch(() => {})
      .finally(() => setLoadingMore(false));
  }

  async function exportInvoices() {
    if (!auth) return;
    setExportError(null);
    setExporting(true);
    try {
      await downloadFile(api.invoices.exportPath(filterOpts()), auth.token, `invoices-${todayStr()}.xlsx`);
    } catch (err) {
      setExportError(err instanceof ApiError ? err.message : "Failed to export invoices");
    } finally {
      setExporting(false);
    }
  }

  const hasDateFilter = Boolean(from || to);

  return (
    <Screen style={styles.container}>
      <View style={styles.filterRow}>
        {STATUS_FILTERS.map((status) => (
          <Pressable
            key={status}
            style={[styles.filterChip, statusFilter === status && styles.filterChipActive]}
            onPress={() => setStatusFilter(status)}
          >
            <Text style={[styles.filterChipText, statusFilter === status && styles.filterChipTextActive]}>
              {status}
            </Text>
          </Pressable>
        ))}
        <Pressable
          onPress={() => setDateModalVisible(true)}
          style={[styles.calendarButton, hasDateFilter && styles.calendarButtonActive]}
        >
          <Ionicons name="calendar-outline" size={18} color={hasDateFilter ? colors.primary : colors.textMuted} />
        </Pressable>
        <Button
          label="Export"
          variant="secondary"
          loading={exporting}
          disabled={invoices.length === 0}
          onPress={exportInvoices}
          style={styles.exportButton}
        />
        <Button label="Dispatch" variant="secondary" onPress={() => router.push("/dispatch")} style={styles.exportButton} />
      </View>
      {exportError ? <Text style={styles.exportError}>{exportError}</Text> : null}

      <FlatList
        data={invoices}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={colors.accent} />}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<Text style={styles.empty}>No invoices yet</Text>}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          loadingMore ? <ActivityIndicator color={colors.accent} style={{ marginVertical: spacing.lg }} /> : null
        }
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => router.push(`/invoice/${item.id}`)}>
            <View style={{ flex: 1 }}>
              <Text style={styles.invoiceNumber}>{item.invoiceNumber}</Text>
              <Text style={styles.meta}>
                {item.customer?.name ?? "Walk-in"} · {new Date(item.createdAt).toLocaleString()}
              </Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={styles.amount}>{formatMoney(item.grandTotal)}</Text>
              <Text style={[styles.status, { color: STATUS_COLORS[item.status] }]}>{item.status}</Text>
            </View>
          </Pressable>
        )}
      />

      <DateRangeModal
        visible={dateModalVisible}
        from={from}
        to={to}
        onApply={(f, t) => {
          setFrom(f);
          setTo(t);
          setDateModalVisible(false);
        }}
        onClose={() => setDateModalVisible(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    alignItems: "center",
    padding: spacing.lg,
    paddingBottom: spacing.sm,
  },
  filterChip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterChipText: { fontSize: scaleFont(13), color: colors.textMuted },
  calendarButton: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  calendarButtonActive: { borderColor: colors.primary },
  exportButton: { paddingHorizontal: spacing.lg },
  exportError: { color: colors.danger, marginHorizontal: spacing.lg, marginBottom: spacing.sm },
  filterChipTextActive: { color: colors.onPrimary },
  listContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  invoiceNumber: { fontSize: scaleFont(15), fontWeight: "600", color: colors.text },
  meta: { fontSize: scaleFont(13), color: colors.textMuted, marginTop: 2 },
  amount: { fontSize: scaleFont(15), fontWeight: "600", color: colors.text },
  status: { fontSize: scaleFont(12), fontWeight: "700", marginTop: 2 },
  empty: { textAlign: "center", color: colors.textMuted, marginTop: 40 },
});
