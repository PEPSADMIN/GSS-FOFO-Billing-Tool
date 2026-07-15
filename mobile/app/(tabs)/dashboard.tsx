import { ReactNode, useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Circle, G, Path } from "react-native-svg";
import type { DashboardDTO, InvoiceStatus } from "@gss/shared";
import { useAuth } from "../../lib/auth-context";
import { api, ApiError } from "../../lib/api";
import { formatMoney } from "../../lib/money";
import { Card, Screen, SectionHeader } from "../../components/ui";
import { DateRangeModal } from "../../components/DateRangeModal";
import { colors, radii, scaleFont, spacing } from "../../lib/theme";

const STATUS_COLORS: Record<InvoiceStatus, string> = {
  PAID: colors.success,
  PARTIAL: colors.warning,
  UNPAID: colors.danger,
};

const AVATAR_PALETTE = [colors.primary, colors.accent, colors.success, colors.warning, colors.accentViolet];

function avatarColor(index: number): string {
  return AVATAR_PALETTE[index % AVATAR_PALETTE.length];
}

export default function DashboardScreen() {
  const { auth } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<DashboardDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [dateModalVisible, setDateModalVisible] = useState(false);
  const hasDateFilter = Boolean(from || to);

  const load = useCallback(() => {
    if (!auth) return;
    api.dashboard
      .get(auth.token, { from: from || undefined, to: to || undefined })
      .then(setData)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load dashboard"));
  }, [auth, from, to]);

  useEffect(load, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await api.dashboard
      .get(auth!.token, { from: from || undefined, to: to || undefined })
      .then(setData)
      .catch(() => {});
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
        <View style={styles.filterRow}>
          {hasDateFilter ? (
            <Text style={styles.activeFilterText}>
              Filtered: {from || "…"} to {to || "…"}
            </Text>
          ) : (
            <Text style={styles.activeFilterText}>Showing all-time rankings</Text>
          )}
          <Pressable
            onPress={() => setDateModalVisible(true)}
            style={[styles.calendarButton, hasDateFilter && styles.calendarButtonActive]}
          >
            <Ionicons name="calendar-outline" size={18} color={hasDateFilter ? colors.primary : colors.textMuted} />
          </Pressable>
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

        <View style={styles.statGrid}>
          <StatCard label="Today's Sales" value={formatMoney(data.todaySales)} icon="cash-outline" tint={colors.success} />
          <StatCard label="Monthly Sales" value={formatMoney(data.monthlySales)} icon="trending-up-outline" tint={colors.primary} />
          <StatCard label="Outstanding" value={formatMoney(data.outstandingAmount)} icon="hourglass-outline" tint={colors.warning} />
          <StatCard label="Total Invoices" value={String(data.totalInvoices)} icon="document-text-outline" tint={colors.accentViolet} />
          <StatCard label="Total Customers" value={String(data.totalCustomers)} icon="people-outline" tint={colors.accent} />
          <StatCard
            label="Low Stock Items"
            value={String(data.lowStockItems)}
            icon="cube-outline"
            tint={data.lowStockItems > 0 ? colors.danger : colors.textMuted}
          />
        </View>

        <View style={styles.chartsRow}>
          <Card style={styles.chartCard}>
            <SectionHeader label="Revenue Trend (6 Months)" icon="stats-chart-outline" />
            <LineChart data={data.monthlyTrend.map((m) => ({ label: m.month, value: m.sales }))} color={colors.primary} />
          </Card>

          <Card style={styles.chartCard}>
            <SectionHeader label="Invoice Status" icon="pie-chart-outline" />
            <DonutChart
              segments={(["PAID", "PARTIAL", "UNPAID"] as InvoiceStatus[]).map((status) => ({
                label: status,
                value: data.statusCounts.find((s) => s.status === status)?.count ?? 0,
                amount: data.statusCounts.find((s) => s.status === status)?.amount ?? 0,
                color: STATUS_COLORS[status],
              }))}
            />
          </Card>
        </View>

        <SectionHeader label="Top 10 Customers" icon="people-outline" />
        <Card style={styles.barListCard}>
          {data.topCustomers.length === 0 ? (
            <Text style={styles.empty}>No sales recorded yet</Text>
          ) : (
            <BarList
              data={data.topCustomers}
              getKey={(c) => c.customerId}
              getValue={(c) => c.total}
              color={colors.accent}
              renderLabel={(c, idx) => (
                <>
                  <View style={[styles.avatar, { backgroundColor: avatarColor(idx) }]}>
                    <Text style={styles.avatarText}>{c.name.charAt(0).toUpperCase()}</Text>
                  </View>
                  <Text style={styles.listName}>{c.name}</Text>
                </>
              )}
            />
          )}
        </Card>

        <SectionHeader label="Top 10 Items" icon="cube-outline" />
        <Card style={styles.barListCard}>
          {data.topItems.length === 0 ? (
            <Text style={styles.empty}>No sales recorded yet</Text>
          ) : (
            <BarList
              data={data.topItems}
              getKey={(i) => i.itemId}
              getValue={(i) => i.total}
              color={colors.primary}
              renderLabel={(i, idx) => (
                <>
                  <Text style={styles.listRank}>{idx + 1}</Text>
                  <Text style={styles.listName}>{i.name}</Text>
                </>
              )}
            />
          )}
        </Card>

        <View style={styles.sectionHeaderRow}>
          <SectionHeader label="Recent Invoices" icon="receipt-outline" />
          <Pressable style={styles.newButton} onPress={() => router.push("/billing")}>
            <Ionicons name="add" size={16} color={colors.onPrimary} />
            <Text style={styles.newButtonText}>New</Text>
          </Pressable>
        </View>
        <Card style={styles.listCard}>
          {data.recentInvoices.length === 0 ? (
            <Text style={styles.empty}>No invoices yet</Text>
          ) : (
            data.recentInvoices.map((inv) => (
              <Pressable key={inv.id} style={styles.invoiceRow} onPress={() => router.push(`/invoice/${inv.id}`)}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.invoiceNumber}>{inv.invoiceNumber}</Text>
                  <Text style={styles.meta}>{inv.customerName}</Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={styles.invoiceAmount}>{formatMoney(inv.grandTotal)}</Text>
                  <Text style={[styles.statusTag, { color: STATUS_COLORS[inv.status] }]}>{inv.status}</Text>
                </View>
              </Pressable>
            ))
          )}
        </Card>
      </ScrollView>
    </Screen>
  );
}

function StatCard({ label, value, icon, tint }: { label: string; value: string; icon: keyof typeof Ionicons.glyphMap; tint: string }) {
  return (
    <Card style={styles.statCard}>
      <View style={styles.statCardTop}>
        <Text style={styles.statLabel}>{label}</Text>
        <View style={[styles.statIconBadge, { backgroundColor: `${tint}26` }]}>
          <Ionicons name={icon} size={16} color={tint} />
        </View>
      </View>
      <Text style={[styles.statValue, { color: tint }]}>{value}</Text>
    </Card>
  );
}

function LineChart({ data, color }: { data: { label: string; value: number }[]; color: string }) {
  const [width, setWidth] = useState(0);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const height = 140;
  const padding = 16;
  const max = Math.max(1, ...data.map((d) => d.value));

  const points = data.map((d, i) => {
    const x = data.length > 1 ? padding + (i * (width - padding * 2)) / (data.length - 1) : width / 2;
    const y = height - padding - (d.value / max) * (height - padding * 2);
    return { x, y };
  });

  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const lastPoint = points[points.length - 1];
  const firstPoint = points[0];
  const areaD =
    lastPoint && firstPoint
      ? `${pathD} L ${lastPoint.x.toFixed(1)} ${height - padding} L ${firstPoint.x.toFixed(1)} ${height - padding} Z`
      : "";

  const activePoint = activeIndex != null ? points[activeIndex] : null;
  const activeValue = activeIndex != null ? data[activeIndex] : null;

  return (
    <View>
      <Text style={styles.chartTooltip}>
        {activeValue ? `${activeValue.label} · ${formatMoney(activeValue.value)}` : " "}
      </Text>
      <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ height }}>
        {width > 0 && (
          <Svg width={width} height={height}>
            {areaD ? <Path d={areaD} fill={color} fillOpacity={0.12} /> : null}
            <Path d={pathD} stroke={color} strokeWidth={2.5} fill="none" />
            {points.map((p, i) => (
              <Circle
                key={i}
                cx={p.x}
                cy={p.y}
                r={activeIndex === i ? 5.5 : 3.5}
                fill={activeIndex === i ? colors.accent : color}
              />
            ))}
          </Svg>
        )}
        <View style={StyleSheet.absoluteFill}>
          <View style={{ flex: 1, flexDirection: "row" }}>
            {data.map((_, i) => (
              <Pressable
                key={i}
                style={{ flex: 1 }}
                onHoverIn={() => setActiveIndex(i)}
                onHoverOut={() => setActiveIndex((cur) => (cur === i ? null : cur))}
                onPress={() => setActiveIndex((cur) => (cur === i ? null : i))}
              />
            ))}
          </View>
        </View>
      </View>
      <View style={styles.chartLabelsRow}>
        {data.map((d) => (
          <Text key={d.label} style={styles.chartLabel}>
            {d.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

function BarList<T>({
  data,
  getKey,
  getValue,
  renderLabel,
  color,
}: {
  data: T[];
  getKey: (item: T) => string;
  getValue: (item: T) => number;
  renderLabel: (item: T, index: number) => ReactNode;
  color: string;
}) {
  const max = Math.max(1, ...data.map(getValue));
  return (
    <>
      {data.map((item, idx) => {
        const value = getValue(item);
        const pct = Math.max(4, (value / max) * 100);
        return (
          <View key={getKey(item)} style={styles.barRow}>
            <View style={styles.barRowTop}>
              {renderLabel(item, idx)}
              <Text style={styles.listValue}>{formatMoney(value)}</Text>
            </View>
            <View style={styles.barTrack}>
              <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: color }]} />
            </View>
          </View>
        );
      })}
    </>
  );
}

function DonutChart({ segments }: { segments: { label: string; value: number; amount: number; color: string }[] }) {
  const [activeLabel, setActiveLabel] = useState<string | null>(null);
  const size = 120;
  const baseStrokeWidth = 16;
  const radius = size / 2 - baseStrokeWidth / 2 - 2;
  const circumference = 2 * Math.PI * radius;
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  let cumulative = 0;

  const activeSegment = segments.find((s) => s.label === activeLabel) ?? null;

  return (
    <View>
      <Text style={styles.chartTooltip}>
        {activeSegment
          ? `${activeSegment.label} · ${activeSegment.value} invoice${activeSegment.value === 1 ? "" : "s"} · ${formatMoney(activeSegment.amount)} (${total > 0 ? Math.round((activeSegment.value / total) * 100) : 0}%)`
          : " "}
      </Text>
      <View style={styles.donutRow}>
        <Svg width={size} height={size}>
          <G transform={`rotate(-90 ${size / 2} ${size / 2})`}>
            {total === 0 ? (
              <Circle cx={size / 2} cy={size / 2} r={radius} stroke={colors.surfaceAlt} strokeWidth={baseStrokeWidth} fill="none" />
            ) : (
              segments
                .filter((s) => s.value > 0)
                .map((seg) => {
                  const segLength = (seg.value / total) * circumference;
                  const dashOffset = -((cumulative / total) * circumference);
                  cumulative += seg.value;
                  const isActive = activeLabel === seg.label;
                  return (
                    <Circle
                      key={seg.label}
                      cx={size / 2}
                      cy={size / 2}
                      r={radius}
                      stroke={seg.color}
                      strokeWidth={isActive ? baseStrokeWidth + 4 : baseStrokeWidth}
                      strokeOpacity={activeLabel && !isActive ? 0.4 : 1}
                      strokeDasharray={`${segLength} ${circumference - segLength}`}
                      strokeDashoffset={dashOffset}
                      fill="none"
                    />
                  );
                })
            )}
          </G>
        </Svg>
        <View style={styles.donutLegend}>
          {segments.map((seg) => (
            <Pressable
              key={seg.label}
              style={styles.donutLegendRow}
              onHoverIn={() => setActiveLabel(seg.label)}
              onHoverOut={() => setActiveLabel((cur) => (cur === seg.label ? null : cur))}
              onPress={() => setActiveLabel((cur) => (cur === seg.label ? null : seg.label))}
            >
              <View style={[styles.donutDot, { backgroundColor: seg.color }]} />
              <Text style={[styles.donutLegendText, activeLabel === seg.label && styles.donutLegendTextActive]}>
                {seg.label} {total > 0 ? Math.round((seg.value / total) * 100) : 0}%
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: 48 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  error: { color: colors.danger },
  filterRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md },
  activeFilterText: { fontSize: scaleFont(12), color: colors.textMuted },
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
  statGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  statCard: { width: "47%", padding: spacing.md },
  statCardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  statIconBadge: { width: 28, height: 28, borderRadius: radii.sm, alignItems: "center", justifyContent: "center" },
  statLabel: { fontSize: scaleFont(12), color: colors.textMuted, flex: 1, marginRight: spacing.xs },
  statValue: { fontSize: scaleFont(18), fontWeight: "700", marginTop: 8 },
  chartsRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.lg },
  chartCard: { flexBasis: 280, flexGrow: 1, padding: spacing.md },
  chartTooltip: { fontSize: scaleFont(12), fontWeight: "700", color: colors.accent, textAlign: "center", marginBottom: spacing.xs },
  chartLabelsRow: { flexDirection: "row", justifyContent: "space-between", marginTop: spacing.xs },
  chartLabel: { fontSize: scaleFont(11), color: colors.textMuted },
  donutRow: { flexDirection: "row", alignItems: "center", gap: spacing.lg, paddingVertical: spacing.sm },
  donutLegend: { gap: spacing.sm, flex: 1 },
  donutLegendRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  donutDot: { width: 10, height: 10, borderRadius: 5 },
  donutLegendText: { fontSize: scaleFont(13), color: colors.text },
  donutLegendTextActive: { fontWeight: "700", color: colors.accent },
  sectionHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  newButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    marginTop: spacing.lg,
  },
  newButtonText: { color: colors.onPrimary, fontSize: scaleFont(12), fontWeight: "700" },
  listCard: { padding: 0, overflow: "hidden" },
  invoiceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  invoiceNumber: { fontSize: scaleFont(14), fontWeight: "600", color: colors.text },
  invoiceAmount: { fontSize: scaleFont(14), fontWeight: "600", color: colors.text },
  statusTag: { fontSize: scaleFont(11), fontWeight: "700", marginTop: 2 },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  listRank: { width: 20, fontSize: scaleFont(13), color: colors.textMuted, fontWeight: "700" },
  avatar: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  avatarText: { color: colors.onPrimary, fontSize: scaleFont(13), fontWeight: "700" },
  listName: { flex: 1, fontSize: scaleFont(14), color: colors.text },
  listValue: { fontSize: scaleFont(14), fontWeight: "600", color: colors.text },
  barListCard: { padding: spacing.md },
  barRow: { marginBottom: spacing.md },
  barRowTop: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: 6 },
  barTrack: { height: 6, borderRadius: 3, backgroundColor: colors.surfaceAlt, overflow: "hidden" },
  barFill: { height: 6, borderRadius: 3 },
  meta: { fontSize: scaleFont(12), color: colors.textMuted, marginTop: 2 },
  empty: { textAlign: "center", color: colors.textMuted, padding: spacing.lg },
});
