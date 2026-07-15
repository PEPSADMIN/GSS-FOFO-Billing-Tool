import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import type { DailySummaryDTO, GstSummaryDTO, InvoiceDTO, InvoiceStatus, OutstandingSummaryDTO, PaymentMode } from "@gss/shared";
import { PAYMENT_MODE_LABELS } from "@gss/shared";
import { useAuth } from "../../lib/auth-context";
import { api, ApiError } from "../../lib/api";
import { formatMoney } from "../../lib/money";
import { downloadFile } from "../../lib/download";
import { Badge, Button, Card, Screen, SectionHeader } from "../../components/ui";
import { DateField } from "../../components/DateField";
import { DateRangeModal } from "../../components/DateRangeModal";
import { colors, radii, scaleFont, spacing } from "../../lib/theme";

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

const REPORT_TABS = ["daily", "gst", "transactions", "outstanding"] as const;
type ReportTab = (typeof REPORT_TABS)[number];

const REPORT_TAB_LABELS: Record<ReportTab, string> = {
  daily: "Daily Summary",
  gst: "GST Summary",
  transactions: "Transactions",
  outstanding: "Outstanding",
};

const STATUS_COLORS: Record<InvoiceStatus, string> = {
  PAID: colors.success,
  PARTIAL: colors.warning,
  UNPAID: colors.danger,
};

const PAGE_SIZE = 20;

export default function ReportsScreen() {
  const [tab, setTab] = useState<ReportTab>("daily");

  return (
    <Screen style={styles.container}>
      <View style={styles.tabRow}>
        {REPORT_TABS.map((t) => (
          <Pressable key={t} onPress={() => setTab(t)} style={[styles.tabBtn, tab === t && styles.tabBtnActive]}>
            <Text style={[styles.tabBtnText, tab === t && styles.tabBtnTextActive]}>{REPORT_TAB_LABELS[t]}</Text>
          </Pressable>
        ))}
      </View>

      {tab === "daily" && <DailySummaryTab />}
      {tab === "gst" && <GstSummaryTab />}
      {tab === "transactions" && <TransactionsTab />}
      {tab === "outstanding" && <OutstandingTab />}
    </Screen>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={bold ? styles.boldText : styles.text}>{label}</Text>
      <Text style={bold ? styles.boldText : styles.text}>{value}</Text>
    </View>
  );
}

function DailySummaryTab() {
  const { auth } = useAuth();
  const [date, setDate] = useState(todayStr());
  const [daily, setDaily] = useState<DailySummaryDTO | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!auth) return;
    setLoading(true);
    api.reports
      .dailySummary(auth.token, date)
      .then(setDaily)
      .catch(() => setDaily(null))
      .finally(() => setLoading(false));
  }, [auth, date]);

  async function exportDaily() {
    if (!auth) return;
    setError(null);
    setExporting(true);
    try {
      await downloadFile(api.reports.dailySummaryExportPath(date), auth.token, `daily-summary-${date}.xlsx`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to download report");
    } finally {
      setExporting(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <DateField value={date} onChange={setDate} placeholder="Select date" />
      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 12 }} />
      ) : daily ? (
        <Card style={styles.box}>
          <Row label="Invoices" value={String(daily.invoiceCount)} />
          <Row label="Total sales" value={formatMoney(daily.totalSales)} />
          <Row label="Total tax" value={formatMoney(daily.totalTax)} />
          {Object.entries(daily.byMode).map(([mode, amount]) => (
            <Row key={mode} label={PAYMENT_MODE_LABELS[mode as PaymentMode]} value={formatMoney(amount ?? 0)} />
          ))}
        </Card>
      ) : (
        <Text style={styles.empty}>No data</Text>
      )}
      <Button label="Download Excel" variant="secondary" loading={exporting} disabled={!daily} onPress={exportDaily} style={styles.downloadButton} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </ScrollView>
  );
}

function GstSummaryTab() {
  const { auth } = useAuth();
  const [from, setFrom] = useState(todayStr());
  const [to, setTo] = useState(todayStr());
  const [dateModalVisible, setDateModalVisible] = useState(false);
  const [gst, setGst] = useState<GstSummaryDTO | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!auth) return;
    setLoading(true);
    api.reports
      .gstSummary(auth.token, { from, to })
      .then(setGst)
      .catch(() => setGst(null))
      .finally(() => setLoading(false));
  }, [auth, from, to]);

  async function exportGst() {
    if (!auth) return;
    setError(null);
    setExporting(true);
    try {
      await downloadFile(api.reports.gstSummaryExportPath({ from, to }), auth.token, `gst-summary-${from}_to_${to}.xlsx`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to download report");
    } finally {
      setExporting(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <DateFilterRow from={from} to={to} onPress={() => setDateModalVisible(true)} />
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
      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 12 }} />
      ) : gst ? (
        <>
          <Card style={styles.box}>
            <Row label="Taxable value" value={formatMoney(gst.taxableValue)} />
            <Row label="CGST" value={formatMoney(gst.cgst)} />
            <Row label="SGST" value={formatMoney(gst.sgst)} />
            <Row label="IGST" value={formatMoney(gst.igst)} />
            <Row label="Grand total" value={formatMoney(gst.grandTotal)} bold />
          </Card>

          {gst.byRate.length > 0 && (
            <Card style={styles.box}>
              <Text style={styles.subTitle}>By GST rate</Text>
              {gst.byRate.map((rate) => (
                <View key={rate.gstRate} style={styles.byRateRow}>
                  <Text style={styles.byRateLabel}>{rate.gstRate}%</Text>
                  <Text style={styles.byRateValue}>Taxable {formatMoney(rate.taxableValue)}</Text>
                  <Text style={styles.byRateValue}>Tax {formatMoney(rate.cgst + rate.sgst + rate.igst)}</Text>
                </View>
              ))}
            </Card>
          )}
        </>
      ) : (
        <Text style={styles.empty}>No data</Text>
      )}
      <Button label="Download Excel" variant="secondary" loading={exporting} disabled={!gst} onPress={exportGst} style={styles.downloadButton} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </ScrollView>
  );
}

function OutstandingTab() {
  const { auth } = useAuth();
  const [outstanding, setOutstanding] = useState<OutstandingSummaryDTO | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!auth) return;
    setLoading(true);
    api.reports
      .outstanding(auth.token)
      .then(setOutstanding)
      .catch(() => setOutstanding(null))
      .finally(() => setLoading(false));
  }, [auth]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 12 }} />
      ) : outstanding ? (
        <>
          <Card style={styles.box}>
            <Row label="Total outstanding" value={formatMoney(outstanding.totalOutstanding)} bold />
          </Card>
          <View style={styles.agingRow}>
            {outstanding.aging.map((bucket) => (
              <Card key={bucket.bucket} style={styles.agingCard}>
                <Text style={styles.agingBucket}>{bucket.bucket} days</Text>
                <Text style={styles.agingAmount}>{formatMoney(bucket.amount)}</Text>
                <Text style={styles.agingCount}>
                  {bucket.count} invoice{bucket.count === 1 ? "" : "s"}
                </Text>
              </Card>
            ))}
          </View>
          {outstanding.customers.length > 0 && (
            <Card style={styles.box}>
              <Text style={styles.subTitle}>By customer</Text>
              {outstanding.customers.map((c) => (
                <View key={c.customerId} style={styles.byRateRow}>
                  <Text style={styles.byRateLabel}>{c.name}</Text>
                  <Text style={styles.byRateValue}>
                    {formatMoney(c.outstanding)} · oldest due {c.oldestDueDays} day{c.oldestDueDays === 1 ? "" : "s"}
                  </Text>
                </View>
              ))}
            </Card>
          )}
        </>
      ) : (
        <Text style={styles.empty}>No data</Text>
      )}
    </ScrollView>
  );
}

function TransactionsTab() {
  const { auth } = useAuth();
  const router = useRouter();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | "ALL">("ALL");
  const [dateModalVisible, setDateModalVisible] = useState(false);
  const [invoices, setInvoices] = useState<InvoiceDTO[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filterOpts = useCallback(
    () => ({ from: from || undefined, to: to || undefined, status: statusFilter === "ALL" ? undefined : statusFilter }),
    [from, to, statusFilter]
  );

  useEffect(() => {
    if (!auth) return;
    setLoading(true);
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
      .finally(() => setLoading(false));
  }, [auth, filterOpts]);

  function loadMore() {
    if (!auth || loadingMore || loading || invoices.length >= total) return;
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

  async function exportTransactions() {
    if (!auth) return;
    setError(null);
    setExporting(true);
    try {
      await downloadFile(api.invoices.exportPath(filterOpts()), auth.token, `transactions-${todayStr()}.xlsx`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to download report");
    } finally {
      setExporting(false);
    }
  }

  const hasDateFilter = Boolean(from || to);

  return (
    <View style={styles.container}>
      <View style={styles.txFilterRow}>
        <DateFilterRow from={from} to={to} onPress={() => setDateModalVisible(true)} compact />
        <Button label="Export" variant="secondary" loading={exporting} disabled={invoices.length === 0} onPress={exportTransactions} style={styles.exportButton} />
      </View>
      <View style={styles.statusChipRow}>
        {(["ALL", "PAID", "PARTIAL", "UNPAID"] as const).map((s) => (
          <Pressable key={s} onPress={() => setStatusFilter(s)} style={[styles.statusChip, statusFilter === s && styles.statusChipActive]}>
            <Text style={[styles.statusChipText, statusFilter === s && styles.statusChipTextActive]}>{s}</Text>
          </Pressable>
        ))}
      </View>
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
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Text style={styles.txSummary}>
        {total} transaction{total === 1 ? "" : "s"}
        {hasDateFilter ? ` · ${from || "…"} to ${to || "…"}` : ""}
      </Text>

      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.xl }} />
      ) : invoices.length === 0 ? (
        <Text style={styles.empty}>No transactions found</Text>
      ) : (
        <ScrollView
          contentContainerStyle={styles.txListContent}
          onScroll={({ nativeEvent }) => {
            const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
            if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 200) loadMore();
          }}
          scrollEventThrottle={200}
        >
          {invoices.map((inv) => (
            <Pressable key={inv.id} style={styles.txRow} onPress={() => router.push(`/invoice/${inv.id}`)}>
              <View style={styles.txRowTop}>
                <Text style={styles.txInvoiceNo}>{inv.invoiceNumber}</Text>
                <Badge label={inv.status} tone={inv.status === "PAID" ? "success" : inv.status === "PARTIAL" ? "warning" : "danger"} />
              </View>
              <Text style={styles.meta}>
                {inv.customer?.name ?? "Walk-in customer"} · {new Date(inv.createdAt).toLocaleDateString()}
              </Text>
              <View style={styles.txBreakdownRow}>
                <Text style={styles.txBreakdownItem}>Taxable {formatMoney(inv.taxableValue)}</Text>
                {inv.isInterState ? (
                  <Text style={styles.txBreakdownItem}>IGST {formatMoney(inv.igstAmount)}</Text>
                ) : (
                  <>
                    <Text style={styles.txBreakdownItem}>CGST {formatMoney(inv.cgstAmount)}</Text>
                    <Text style={styles.txBreakdownItem}>SGST {formatMoney(inv.sgstAmount)}</Text>
                  </>
                )}
                <Text style={[styles.txBreakdownItem, { color: STATUS_COLORS[inv.status] }]}>Paid {formatMoney(inv.amountPaid)}</Text>
              </View>
              <Text style={styles.txTotal}>{formatMoney(inv.grandTotal)}</Text>
            </Pressable>
          ))}
          {loadingMore ? <ActivityIndicator color={colors.accent} style={{ marginVertical: spacing.lg }} /> : null}
        </ScrollView>
      )}
    </View>
  );
}

function DateFilterRow({ from, to, onPress, compact }: { from: string; to: string; onPress: () => void; compact?: boolean }) {
  const hasDateFilter = Boolean(from || to);
  return (
    <Pressable style={[styles.dateFilterRow, compact && { flex: 1 }]} onPress={onPress}>
      <Ionicons name="calendar-outline" size={18} color={hasDateFilter ? colors.primary : colors.textMuted} />
      <Text style={styles.dateFilterText}>{hasDateFilter ? `${from || "…"} to ${to || "…"}` : "Filter by date"}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: 48 },
  tabRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, padding: spacing.lg, paddingBottom: spacing.sm },
  tabBtn: {
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  tabBtnActive: { backgroundColor: colors.surface, borderColor: colors.accent },
  tabBtnText: { color: colors.textMuted, fontWeight: "600", fontSize: scaleFont(13) },
  tabBtnTextActive: { color: colors.accent },
  dateFilterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  dateFilterText: { fontSize: scaleFont(14), color: colors.text },
  subTitle: { fontSize: scaleFont(14), fontWeight: "700", color: colors.text, marginBottom: spacing.sm },
  box: { marginTop: spacing.md, padding: spacing.md },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  text: { fontSize: scaleFont(14), color: colors.textMuted },
  boldText: { fontSize: scaleFont(16), fontWeight: "700", color: colors.accent },
  byRateRow: { paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border },
  byRateLabel: { fontSize: scaleFont(14), fontWeight: "700", color: colors.text },
  byRateValue: { fontSize: scaleFont(13), color: colors.textMuted },
  downloadButton: { marginTop: spacing.md },
  agingRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.md },
  agingCard: { flexBasis: "47%", flexGrow: 1, padding: spacing.md },
  agingBucket: { fontSize: scaleFont(12), color: colors.textMuted },
  agingAmount: { fontSize: scaleFont(16), fontWeight: "700", color: colors.text, marginTop: 2 },
  agingCount: { fontSize: scaleFont(11), color: colors.textMuted, marginTop: 2 },
  error: { color: colors.danger, marginTop: spacing.md, marginHorizontal: spacing.lg },
  empty: { textAlign: "center", color: colors.textMuted, marginTop: 20 },
  txFilterRow: { flexDirection: "row", gap: spacing.sm, paddingHorizontal: spacing.lg, alignItems: "center" },
  exportButton: { paddingHorizontal: spacing.lg },
  statusChipRow: { flexDirection: "row", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  statusChip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  statusChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  statusChipText: { fontSize: scaleFont(12), color: colors.textMuted },
  statusChipTextActive: { color: colors.onPrimary, fontWeight: "700" },
  txSummary: { fontSize: scaleFont(12), color: colors.textMuted, paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  txListContent: { padding: spacing.lg, paddingTop: spacing.sm },
  txRow: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  txRowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  txInvoiceNo: { fontSize: scaleFont(14), fontWeight: "700", color: colors.text },
  meta: { fontSize: scaleFont(12), color: colors.textMuted, marginTop: 2 },
  txBreakdownRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, marginTop: spacing.sm },
  txBreakdownItem: { fontSize: scaleFont(12), color: colors.textMuted },
  txTotal: { fontSize: scaleFont(15), fontWeight: "700", color: colors.accent, marginTop: spacing.sm, textAlign: "right" },
});
