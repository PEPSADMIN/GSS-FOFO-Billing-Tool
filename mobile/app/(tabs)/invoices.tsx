import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Linking, Modal, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import type { DueInstallmentDTO, InvoiceDTO, InvoiceStatus } from "@gss/shared";
import { useAuth } from "../../lib/auth-context";
import { api, ApiError } from "../../lib/api";
import { formatMoney } from "../../lib/money";
import { downloadFile } from "../../lib/download";
import { Badge, Button, ModalHeader, Screen } from "../../components/ui";
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
  const [dueInstallments, setDueInstallments] = useState<DueInstallmentDTO[]>([]);
  const [remindersVisible, setRemindersVisible] = useState(false);
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

  useEffect(() => {
    if (!auth) return;
    api.invoices
      .dueInstallments(auth.token, 1)
      .then(setDueInstallments)
      .catch(() => setDueInstallments([]));
  }, [auth]);

  function callCustomer(phone?: string | null) {
    if (!phone) return;
    Linking.openURL(`tel:${phone}`).catch(() => {});
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
      {dueInstallments.length > 0 && (
        <Pressable style={styles.reminderBanner} onPress={() => setRemindersVisible(true)}>
          <Ionicons name="warning-outline" size={18} color={colors.warning} />
          <Text style={styles.reminderBannerText}>
            {dueInstallments.length} installment{dueInstallments.length > 1 ? "s" : ""} due today or overdue — tap to view
          </Text>
        </Pressable>
      )}

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

      <RemindersModal
        visible={remindersVisible}
        installments={dueInstallments}
        onClose={() => setRemindersVisible(false)}
        onCall={callCustomer}
        onViewInvoice={(invoiceId) => {
          setRemindersVisible(false);
          router.push(`/invoice/${invoiceId}`);
        }}
      />
    </Screen>
  );
}

function RemindersModal({
  visible,
  installments,
  onClose,
  onCall,
  onViewInvoice,
}: {
  visible: boolean;
  installments: DueInstallmentDTO[];
  onClose: () => void;
  onCall: (phone?: string | null) => void;
  onViewInvoice: (invoiceId: string) => void;
}) {
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <ModalHeader title="Payment Reminders" onClose={onClose} />
          <FlatList
            data={installments}
            keyExtractor={(i) => i.id}
            style={{ maxHeight: 420 }}
            ListEmptyComponent={<Text style={styles.empty}>Nothing due</Text>}
            renderItem={({ item }) => (
              <View style={styles.reminderRow}>
                <View style={{ flex: 1 }}>
                  <View style={styles.reminderTitleRow}>
                    <Text style={styles.invoiceNumber}>{item.customerName}</Text>
                    <Badge label={item.status} tone={item.status === "OVERDUE" ? "danger" : "warning"} />
                  </View>
                  <Text style={styles.meta}>
                    {item.invoiceNumber} · {formatMoney(item.amount)} · Due {new Date(item.dueDate).toLocaleDateString()}
                  </Text>
                  <View style={styles.reminderActions}>
                    {item.customerPhone ? (
                      <Pressable onPress={() => onCall(item.customerPhone)} style={styles.callBtn}>
                        <Ionicons name="call-outline" size={14} color={colors.primary} />
                        <Text style={styles.callBtnText}>Call {item.customerPhone}</Text>
                      </Pressable>
                    ) : null}
                    <Pressable onPress={() => onViewInvoice(item.invoiceId)}>
                      <Text style={styles.viewInvoiceLink}>View invoice</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            )}
          />
        </View>
      </View>
    </Modal>
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
  reminderBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: "rgba(251,191,36,0.12)",
    borderWidth: 1,
    borderColor: colors.warning,
    borderRadius: radii.md,
    padding: spacing.md,
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
  },
  reminderBannerText: { color: colors.text, fontSize: scaleFont(13), fontWeight: "600", flex: 1 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(2,6,16,0.7)", justifyContent: "flex-end" },
  modalCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    maxHeight: "85%",
  },
  reminderRow: { paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  reminderTitleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  reminderActions: { flexDirection: "row", alignItems: "center", gap: spacing.lg, marginTop: spacing.sm },
  callBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  callBtnText: { color: colors.primary, fontWeight: "600", fontSize: scaleFont(13) },
  viewInvoiceLink: { color: colors.accent, fontWeight: "600", fontSize: scaleFont(13) },
});
