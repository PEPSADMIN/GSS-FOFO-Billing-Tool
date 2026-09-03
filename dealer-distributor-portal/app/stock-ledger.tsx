import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { ItemDTO, StockLedgerEntryDTO } from "@gss/shared";
import { STOCK_MOVEMENT_LABELS } from "@gss/shared";
import { useAuth } from "../lib/auth-context";
import { api } from "../lib/api";
import { ModalHeader, Screen } from "../components/ui";
import { DateRangeModal } from "../components/DateRangeModal";
import { colors, radii, scaleFont, spacing } from "../lib/theme";

export default function StockLedgerScreen() {
  const { auth } = useAuth();
  const [entries, setEntries] = useState<StockLedgerEntryDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<ItemDTO[]>([]);
  const [selectedItem, setSelectedItem] = useState<ItemDTO | null>(null);
  const [itemPickerVisible, setItemPickerVisible] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [dateModalVisible, setDateModalVisible] = useState(false);

  useEffect(() => {
    if (!auth) return;
    api.items
      .list(auth.token, { pageSize: 200 })
      .then((res) => setItems(res.data))
      .catch(() => setItems([]));
  }, [auth]);

  const load = useCallback(() => {
    if (!auth) return;
    setLoading(true);
    api.stock
      .ledger(auth.token, { itemId: selectedItem?.id, from: from || undefined, to: to || undefined })
      .then(setEntries)
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, [auth, selectedItem, from, to]);

  useEffect(load, [load]);

  const hasDateFilter = Boolean(from || to);

  return (
    <Screen style={styles.container}>
      <View style={styles.headerRow}>
        <Pressable style={styles.itemFilterButton} onPress={() => setItemPickerVisible(true)}>
          <Ionicons name="cube-outline" size={16} color={colors.textMuted} />
          <Text style={styles.itemFilterText}>{selectedItem ? selectedItem.name : "All items"}</Text>
          {selectedItem ? (
            <Pressable onPress={() => setSelectedItem(null)} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </Pressable>
        <Pressable
          onPress={() => setDateModalVisible(true)}
          style={[styles.calendarButton, hasDateFilter && styles.calendarButtonActive]}
        >
          <Ionicons name="calendar-outline" size={20} color={hasDateFilter ? colors.primary : colors.textMuted} />
        </Pressable>
      </View>

      {hasDateFilter ? (
        <Text style={styles.activeFilterText}>
          Filtered: {from || "…"} to {to || "…"}
        </Text>
      ) : null}

      <View style={styles.tableHeader}>
        <Text style={[styles.headerCell, { flex: 2 }]}>Item / Type</Text>
        <Text style={[styles.headerCell, { width: 60, textAlign: "right" }]}>In</Text>
        <Text style={[styles.headerCell, { width: 60, textAlign: "right" }]}>Out</Text>
        <Text style={[styles.headerCell, { width: 70, textAlign: "right" }]}>Balance</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.xl }} />
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(e) => e.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={<Text style={styles.empty}>No stock movements found</Text>}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View style={{ flex: 2 }}>
                <Text style={styles.itemName}>{item.itemName}</Text>
                <Text style={styles.meta}>
                  {STOCK_MOVEMENT_LABELS[item.type]} · {new Date(item.createdAt).toLocaleDateString()}
                </Text>
              </View>
              <View style={[styles.cellWrap, { width: 60 }]}>
                {item.in > 0 ? (
                  <View style={styles.inPill}>
                    <Text style={styles.inPillText}>+{item.in}</Text>
                  </View>
                ) : (
                  <Text style={styles.cellDash}>—</Text>
                )}
              </View>
              <View style={[styles.cellWrap, { width: 60 }]}>
                {item.out > 0 ? (
                  <View style={styles.outPill}>
                    <Text style={styles.outPillText}>-{item.out}</Text>
                  </View>
                ) : (
                  <Text style={styles.cellDash}>—</Text>
                )}
              </View>
              <Text style={[styles.cellValue, { width: 70, fontWeight: "700" }]}>{item.balance}</Text>
            </View>
          )}
        />
      )}

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

      <Modal visible={itemPickerVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <ModalHeader title="Filter by item" onClose={() => setItemPickerVisible(false)} />
            <Pressable
              style={styles.pickerRow}
              onPress={() => {
                setSelectedItem(null);
                setItemPickerVisible(false);
              }}
            >
              <Text style={styles.pickerRowText}>All items</Text>
            </Pressable>
            <FlatList
              data={items}
              keyExtractor={(i) => i.id}
              style={{ maxHeight: 380 }}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.pickerRow}
                  onPress={() => {
                    setSelectedItem(item);
                    setItemPickerVisible(false);
                  }}
                >
                  <Text style={styles.pickerRowText}>{item.name}</Text>
                </Pressable>
              )}
            />
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerRow: { flexDirection: "row", gap: spacing.sm, padding: spacing.lg, alignItems: "center" },
  itemFilterButton: {
    flex: 1,
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
  itemFilterText: { flex: 1, color: colors.text, fontSize: scaleFont(14) },
  calendarButton: {
    width: 42,
    height: 42,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  calendarButtonActive: { borderColor: colors.primary },
  activeFilterText: { fontSize: scaleFont(12), color: colors.primary, marginHorizontal: spacing.lg, marginBottom: spacing.sm },
  tableHeader: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerCell: { fontSize: scaleFont(11), fontWeight: "700", color: colors.textMuted, textTransform: "uppercase" },
  listContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  itemName: { fontSize: scaleFont(14), fontWeight: "600", color: colors.text },
  meta: { fontSize: scaleFont(12), color: colors.textMuted, marginTop: 2 },
  cellValue: { fontSize: scaleFont(14), textAlign: "right", color: colors.text },
  cellWrap: { alignItems: "flex-end" },
  cellDash: { fontSize: scaleFont(14), color: colors.textMuted },
  inPill: {
    backgroundColor: "rgba(16,185,129,0.15)",
    borderRadius: radii.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  inPillText: { fontSize: scaleFont(12), fontWeight: "700", color: colors.success },
  outPill: {
    backgroundColor: "rgba(248,113,113,0.15)",
    borderRadius: radii.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  outPillText: { fontSize: scaleFont(12), fontWeight: "700", color: colors.danger },
  empty: { textAlign: "center", color: colors.textMuted, marginTop: 40 },
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
  pickerRow: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  pickerRowText: { fontSize: scaleFont(15), color: colors.text },
});
