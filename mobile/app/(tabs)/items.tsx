import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import type { ItemDTO } from "@gss/shared";
import { rupeesToPaise, paiseToRupees, GST_SLABS } from "@gss/shared";
import { useAuth } from "../../lib/auth-context";
import { api, ApiError, ItemInput, StockAdjustmentInput } from "../../lib/api";
import { formatMoney } from "../../lib/money";
import { Button, Input, ModalHeader, Screen } from "../../components/ui";
import { showAlert, showConfirm } from "../../lib/alert";
import { colors, radii, scaleFont, spacing, typography } from "../../lib/theme";

function formatRupees(value: number): string {
  return `₹${value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const PAGE_SIZE = 20;

const ADJUSTMENT_TYPES: StockAdjustmentInput["type"][] = [
  "PURCHASE_IN",
  "ADJUSTMENT_IN",
  "ADJUSTMENT_OUT",
  "RETURN_IN",
  "OPENING_STOCK",
  "DAMAGE_OUT",
  "SAMPLE_OUT",
];

const ADJUSTMENT_TYPE_LABELS: Record<StockAdjustmentInput["type"], string> = {
  PURCHASE_IN: "Purchase In",
  ADJUSTMENT_IN: "Correction In",
  ADJUSTMENT_OUT: "Correction Out",
  RETURN_IN: "Customer Return",
  OPENING_STOCK: "Opening Stock",
  DAMAGE_OUT: "Damage Stock",
  SAMPLE_OUT: "Sample Issue",
};

const EMPTY_FORM: ItemInput = { name: "", hsnCode: "", unit: "PCS", gstRate: 0, price: 0 };

const ITEM_FIELD_LABELS: Record<string, string> = {
  name: "Item Name",
  hsnCode: "HSN Code",
  price: "Selling Price",
};

function validateItemForm(form: ItemInput, priceText: string): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!form.name.trim()) errors.name = "Item Name is required";
  if (!form.hsnCode.trim()) errors.hsnCode = "HSN Code is required";
  if (!priceText.trim() || Number(priceText) <= 0) errors.price = "Selling Price is required";
  return errors;
}

export default function ItemsScreen() {
  const { auth } = useAuth();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [items, setItems] = useState<ItemDTO[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<ItemDTO | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const selectionMode = selectedIds.size > 0;
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [deletedVisible, setDeletedVisible] = useState(false);

  const load = useCallback(() => {
    if (!auth) return;
    setRefreshing(true);
    setPage(1);
    api.items
      .list(auth.token, { search: search.trim() || undefined, lowStock: lowStockOnly, page: 1, pageSize: PAGE_SIZE })
      .then((res) => {
        setItems(res.data);
        setTotal(res.total);
      })
      .catch(() => {
        setItems([]);
        setTotal(0);
      })
      .finally(() => setRefreshing(false));
  }, [auth, search, lowStockOnly]);

  useEffect(() => {
    const handle = setTimeout(load, 300);
    return () => clearTimeout(handle);
  }, [load]);

  function loadMore() {
    if (!auth || loadingMore || refreshing || items.length >= total) return;
    const nextPage = page + 1;
    setLoadingMore(true);
    api.items
      .list(auth.token, { search: search.trim() || undefined, lowStock: lowStockOnly, page: nextPage, pageSize: PAGE_SIZE })
      .then((res) => {
        setItems((prev) => [...prev, ...res.data]);
        setPage(nextPage);
      })
      .catch(() => {})
      .finally(() => setLoadingMore(false));
  }

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function deleteSelected() {
    if (!auth || selectedIds.size === 0) return;
    const confirmed = await showConfirm(
      "Delete items",
      `Remove ${selectedIds.size} item${selectedIds.size > 1 ? "s" : ""} from your item list? Past invoices and stock history will be kept.`,
      "Delete"
    );
    if (!confirmed) return;
    setBulkDeleting(true);
    try {
      await api.items.bulkRemove(auth.token, Array.from(selectedIds));
      setSelectedIds(new Set());
      load();
    } catch (err) {
      showAlert("Failed to delete items", err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    } finally {
      setBulkDeleting(false);
    }
  }

  return (
    <Screen style={styles.container}>
      {selectionMode ? (
        <View style={styles.selectionBar}>
          <Pressable onPress={() => setSelectedIds(new Set())} hitSlop={8}>
            <Ionicons name="close" size={22} color={colors.text} />
          </Pressable>
          <Text style={styles.selectionCount}>{selectedIds.size} selected</Text>
          <Pressable onPress={deleteSelected} disabled={bulkDeleting} hitSlop={8}>
            {bulkDeleting ? (
              <ActivityIndicator size="small" color={colors.danger} />
            ) : (
              <Ionicons name="trash-outline" size={22} color={colors.danger} />
            )}
          </Pressable>
        </View>
      ) : (
        <>
          <View style={styles.headerRow}>
            <Input style={styles.searchInput} placeholder="Search items" value={search} onChangeText={setSearch} />
            <Button label="Stock Ledger" variant="secondary" onPress={() => router.push("/stock-ledger")} style={styles.ledgerButton} />
            <Button label="+ Add" onPress={() => setAddModalVisible(true)} style={styles.addButton} />
          </View>
          <View style={styles.lowStockRow}>
            <Switch
              value={lowStockOnly}
              onValueChange={setLowStockOnly}
              trackColor={{ false: colors.surfaceAlt, true: colors.primary }}
              thumbColor={colors.text}
            />
            <Text style={styles.lowStockLabel}>Low stock only</Text>
            <Pressable onPress={() => setDeletedVisible(true)}>
              <Text style={styles.deletedLink}>Deleted items</Text>
            </Pressable>
          </View>
          <Text style={styles.selectionHint}>Hold an item to select multiple</Text>
        </>
      )}

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={colors.accent} />}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<Text style={styles.empty}>No items found</Text>}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          loadingMore ? <ActivityIndicator color={colors.accent} style={{ marginVertical: spacing.lg }} /> : null
        }
        renderItem={({ item }) => {
          const low = item.currentStock <= item.lowStockThreshold;
          const selected = selectedIds.has(item.id);
          return (
            <Pressable
              style={[styles.row, selected && styles.rowSelected]}
              onPress={() => (selectionMode ? toggleSelected(item.id) : setEditingItem(item))}
              onLongPress={() => toggleSelected(item.id)}
            >
              {selectionMode && (
                <Ionicons
                  name={selected ? "checkmark-circle" : "ellipse-outline"}
                  size={22}
                  color={selected ? colors.accent : colors.textMuted}
                  style={styles.selectionIcon}
                />
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.meta}>
                  HSN {item.hsnCode} · {item.unit} · GST {item.gstRate}%
                </Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={styles.price}>{formatMoney(item.price)}</Text>
                <Text style={[styles.stock, low && styles.stockLow]}>Stock: {item.currentStock}</Text>
              </View>
            </Pressable>
          );
        }}
      />

      <ItemFormModal
        visible={addModalVisible}
        initial={EMPTY_FORM}
        title="Add item"
        onClose={() => setAddModalVisible(false)}
        onSaved={() => {
          setAddModalVisible(false);
          load();
        }}
      />

      {editingItem && (
        <EditItemModal
          item={editingItem}
          onClose={() => setEditingItem(null)}
          onSaved={() => {
            setEditingItem(null);
            load();
          }}
        />
      )}

      <DeletedItemsModal
        visible={deletedVisible}
        onClose={() => setDeletedVisible(false)}
        onRestored={load}
      />
    </Screen>
  );
}

function ItemFormModal({
  visible,
  initial,
  title,
  itemId,
  onClose,
  onSaved,
}: {
  visible: boolean;
  initial: ItemInput;
  title: string;
  itemId?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { auth } = useAuth();
  const [form, setForm] = useState<ItemInput>(initial);
  const [priceText, setPriceText] = useState(initial.price ? String(paiseToRupees(initial.price)) : "");
  const [customGst, setCustomGst] = useState(!GST_SLABS.includes(initial.gstRate as never));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setForm(initial);
    setPriceText(initial.price ? String(paiseToRupees(initial.price)) : "");
    setCustomGst(!GST_SLABS.includes(initial.gstRate as never));
    setFieldErrors({});
  }, [initial, visible]);

  async function submit() {
    if (!auth) return;
    const errors = validateItemForm(form, priceText);
    setFieldErrors(errors);
    const firstErrorKey = Object.keys(errors)[0];
    if (firstErrorKey) {
      showAlert("Missing information", `Kindly fill the respective ${ITEM_FIELD_LABELS[firstErrorKey] ?? firstErrorKey} field to continue.`);
      return;
    }
    setSubmitting(true);
    setError(null);
    const data: ItemInput = { ...form, price: rupeesToPaise(Number(priceText) || 0) };
    try {
      if (itemId) {
        await api.items.update(auth.token, itemId, data);
      } else {
        await api.items.create(auth.token, data);
      }
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save item");
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteItem() {
    if (!auth || !itemId) return;
    const confirmed = await showConfirm(
      "Delete item",
      `Remove "${form.name}" from your item list? Past invoices and stock history will be kept.`,
      "Delete"
    );
    if (!confirmed) return;
    setSubmitting(true);
    try {
      await api.items.remove(auth.token, itemId);
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete item");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <ScrollView style={styles.modalCard} keyboardShouldPersistTaps="handled">
        <ModalHeader title={title} onClose={onClose} />

        <Text style={styles.fieldLabel}>
          Item Name <Text style={styles.required}>*</Text>
        </Text>
        <Input
          placeholder="e.g. Memory Foam Mattress"
          value={form.name}
          onChangeText={(name) => setForm((f) => ({ ...f, name }))}
          error={!!fieldErrors.name}
        />
        {fieldErrors.name ? <Text style={styles.fieldErrorText}>{fieldErrors.name}</Text> : null}

        <Text style={styles.fieldLabel}>
          HSN Code <Text style={styles.required}>*</Text>
        </Text>
        <Input
          placeholder="e.g. 9404"
          value={form.hsnCode}
          onChangeText={(hsnCode) => setForm((f) => ({ ...f, hsnCode }))}
          error={!!fieldErrors.hsnCode}
        />
        {fieldErrors.hsnCode ? <Text style={styles.fieldErrorText}>{fieldErrors.hsnCode}</Text> : null}

        <Text style={styles.fieldLabel}>Unit</Text>
        <Input placeholder="e.g. PCS, KG, BOX" value={form.unit} onChangeText={(unit) => setForm((f) => ({ ...f, unit }))} />

        <Text style={styles.fieldLabel}>GST Rate %</Text>
        <View style={styles.modeChips}>
          {GST_SLABS.map((slab) => (
            <Pressable
              key={slab}
              style={[styles.chip, !customGst && form.gstRate === slab && styles.chipActive]}
              onPress={() => {
                setCustomGst(false);
                setForm((f) => ({ ...f, gstRate: slab }));
              }}
            >
              <Text style={[styles.chipText, !customGst && form.gstRate === slab && styles.chipTextActive]}>{slab}%</Text>
            </Pressable>
          ))}
          <Pressable style={[styles.chip, customGst && styles.chipActive]} onPress={() => setCustomGst(true)}>
            <Text style={[styles.chipText, customGst && styles.chipTextActive]}>Other</Text>
          </Pressable>
        </View>
        {customGst && (
          <Input
            placeholder="Custom GST rate %"
            keyboardType="decimal-pad"
            value={form.gstRate ? String(form.gstRate) : ""}
            onChangeText={(text) => setForm((f) => ({ ...f, gstRate: Number(text) || 0 }))}
          />
        )}

        <Text style={styles.fieldLabel}>
          Selling Price (₹, excl. GST) <Text style={styles.required}>*</Text>
        </Text>
        <Input
          placeholder="e.g. 2500"
          keyboardType="decimal-pad"
          value={priceText}
          onChangeText={setPriceText}
          error={!!fieldErrors.price}
        />
        {fieldErrors.price ? <Text style={styles.fieldErrorText}>{fieldErrors.price}</Text> : null}

        {Number(priceText) > 0 && (
          <View style={styles.pricePreview}>
            <Text style={styles.pricePreviewTitle}>Price Preview</Text>
            <View style={styles.pricePreviewRow}>
              <Text style={styles.pricePreviewLabel}>Base price</Text>
              <Text style={styles.pricePreviewValue}>{formatRupees(Number(priceText))}</Text>
            </View>
            <View style={styles.pricePreviewRow}>
              <Text style={styles.pricePreviewLabel}>GST ({form.gstRate}%)</Text>
              <Text style={styles.pricePreviewValue}>{formatRupees((Number(priceText) * form.gstRate) / 100)}</Text>
            </View>
            <View style={styles.pricePreviewRow}>
              <Text style={styles.pricePreviewLabelBold}>Customer pays (incl. GST)</Text>
              <Text style={styles.pricePreviewValueBold}>
                {formatRupees(Number(priceText) + (Number(priceText) * form.gstRate) / 100)}
              </Text>
            </View>
          </View>
        )}

        {!itemId && (
          <>
            <Text style={styles.fieldLabel}>Opening Stock Quantity</Text>
            <Input
              placeholder="e.g. 50"
              keyboardType="number-pad"
              value={form.currentStock !== undefined && form.currentStock > 0 ? String(form.currentStock) : ""}
              onChangeText={(text) => setForm((f) => ({ ...f, currentStock: Number(text) || 0 }))}
            />
            <Text style={styles.helperText}>How many units you currently have in stock when adding this item.</Text>
          </>
        )}

        <Text style={styles.fieldLabel}>Low Stock Alert Threshold</Text>
        <Input
          placeholder="e.g. 5"
          keyboardType="number-pad"
          value={form.lowStockThreshold !== undefined ? String(form.lowStockThreshold) : ""}
          onChangeText={(text) => setForm((f) => ({ ...f, lowStockThreshold: Number(text) || 0 }))}
        />
        <Text style={styles.helperText}>You'll see a low-stock warning once quantity on hand drops to this number or below.</Text>

        {itemId ? <Text style={styles.currentStockText}>Current stock on hand: {form.currentStock ?? 0} {form.unit}</Text> : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}
        <View style={styles.modalActions}>
          {itemId ? (
            <Pressable onPress={deleteItem} disabled={submitting} style={styles.deleteLinkRow}>
              <Text style={styles.deleteLink}>Delete item</Text>
            </Pressable>
          ) : null}
          <View style={{ flex: 1 }} />
          <Pressable onPress={onClose}>
            <Text style={styles.cancelLink}>Cancel</Text>
          </Pressable>
          <Button
            label="Save"
            loading={submitting}
            onPress={submit}
            style={styles.saveButton}
          />
        </View>

        {itemId && <StockAdjustmentSection itemId={itemId} onAdjusted={onSaved} />}
        </ScrollView>
      </View>
    </Modal>
  );
}

function StockAdjustmentSection({ itemId, onAdjusted }: { itemId: string; onAdjusted: () => void }) {
  const { auth } = useAuth();
  const [adjType, setAdjType] = useState<StockAdjustmentInput["type"]>("PURCHASE_IN");
  const [adjQuantity, setAdjQuantity] = useState("");
  const [adjSubmitting, setAdjSubmitting] = useState(false);
  const [adjError, setAdjError] = useState<string | null>(null);

  async function submitAdjustment() {
    if (!auth) return;
    if (!adjQuantity || Number(adjQuantity) <= 0) {
      showAlert("Missing information", "Kindly fill the respective Quantity field to continue.");
      return;
    }
    setAdjSubmitting(true);
    setAdjError(null);
    try {
      await api.items.stockAdjustment(auth.token, itemId, { type: adjType, quantity: Number(adjQuantity) });
      setAdjQuantity("");
      onAdjusted();
    } catch (err) {
      setAdjError(err instanceof ApiError ? err.message : "Failed to adjust stock");
    } finally {
      setAdjSubmitting(false);
    }
  }

  return (
    <View style={styles.stockAdjustSection}>
      <Text style={styles.modalTitle}>Stock adjustment</Text>
      <Text style={styles.helperText}>Use this to record stock movements — purchases received, manual corrections, or customer returns.</Text>

      <Text style={styles.fieldLabel}>Adjustment Type</Text>
      <View style={styles.modeChips}>
        {ADJUSTMENT_TYPES.map((type) => (
          <Pressable
            key={type}
            style={[styles.chip, adjType === type && styles.chipActive]}
            onPress={() => setAdjType(type)}
          >
            <Text style={[styles.chipText, adjType === type && styles.chipTextActive]}>{ADJUSTMENT_TYPE_LABELS[type]}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.fieldLabel}>Quantity to {adjType === "OPENING_STOCK" || adjType.endsWith("IN") ? "add" : "remove"}</Text>
      <Input placeholder="e.g. 10" keyboardType="number-pad" value={adjQuantity} onChangeText={setAdjQuantity} />
      {adjError ? <Text style={styles.error}>{adjError}</Text> : null}
      <Button label="Apply adjustment" loading={adjSubmitting} onPress={submitAdjustment} />
    </View>
  );
}

function EditItemModal({ item, onClose, onSaved }: { item: ItemDTO; onClose: () => void; onSaved: () => void }) {
  return (
    <ItemFormModal
      visible
      initial={{
        name: item.name,
        hsnCode: item.hsnCode,
        unit: item.unit,
        gstRate: item.gstRate,
        price: item.price,
        currentStock: item.currentStock,
        lowStockThreshold: item.lowStockThreshold,
      }}
      title="Edit item"
      itemId={item.id}
      onClose={onClose}
      onSaved={onSaved}
    />
  );
}

function DeletedItemsModal({
  visible,
  onClose,
  onRestored,
}: {
  visible: boolean;
  onClose: () => void;
  onRestored: () => void;
}) {
  const { auth } = useAuth();
  const [items, setItems] = useState<ItemDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!auth) return;
    setLoading(true);
    api.items
      .list(auth.token, { status: "inactive", pageSize: 200 })
      .then((res) => setItems(res.data))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [auth]);

  useEffect(() => {
    if (visible) load();
  }, [visible, load]);

  async function restore(item: ItemDTO) {
    if (!auth) return;
    setRestoringId(item.id);
    try {
      await api.items.restore(auth.token, item.id);
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      onRestored();
    } catch (err) {
      showAlert("Failed to restore item", err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    } finally {
      setRestoringId(null);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <ModalHeader title="Deleted items" onClose={onClose} />
          {loading ? (
            <ActivityIndicator color={colors.accent} />
          ) : items.length === 0 ? (
            <Text style={styles.empty}>No deleted items</Text>
          ) : (
            <FlatList
              data={items}
              keyExtractor={(i) => i.id}
              style={{ maxHeight: 400 }}
              renderItem={({ item }) => (
                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{item.name}</Text>
                    <Text style={styles.meta}>HSN {item.hsnCode}</Text>
                  </View>
                  <Pressable onPress={() => restore(item)} disabled={restoringId === item.id}>
                    {restoringId === item.id ? (
                      <ActivityIndicator size="small" color={colors.accent} />
                    ) : (
                      <Text style={styles.restoreLink}>Restore</Text>
                    )}
                  </Pressable>
                </View>
              )}
            />
          )}
          <Pressable onPress={onClose}>
            <Text style={styles.cancelLink}>Close</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerRow: { flexDirection: "row", gap: spacing.sm, padding: spacing.lg, paddingBottom: spacing.sm, alignItems: "center" },
  searchInput: { flex: 1, marginBottom: 0 },
  addButton: { paddingHorizontal: spacing.lg },
  ledgerButton: { paddingHorizontal: spacing.md },
  lowStockRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  lowStockLabel: { fontSize: scaleFont(14), color: colors.textMuted },
  deletedLink: { fontSize: scaleFont(13), color: colors.accent, fontWeight: "600", marginLeft: "auto" },
  selectionHint: { fontSize: scaleFont(12), color: colors.textMuted, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  restoreLink: { color: colors.accent, fontWeight: "600", fontSize: scaleFont(13) },
  selectionBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.lg,
    backgroundColor: colors.surfaceAlt,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  selectionCount: { fontSize: scaleFont(15), fontWeight: "700", color: colors.text },
  selectionIcon: { marginRight: spacing.sm },
  listContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowSelected: { backgroundColor: colors.surfaceAlt },
  name: { fontSize: scaleFont(15), fontWeight: "600", color: colors.text },
  meta: { fontSize: scaleFont(13), color: colors.textMuted, marginTop: 2 },
  price: { fontSize: scaleFont(15), fontWeight: "600", color: colors.text },
  stock: { fontSize: scaleFont(13), color: colors.textMuted, marginTop: 2 },
  stockLow: { color: colors.danger, fontWeight: "700" },
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
  modalTitle: { ...typography.heading, marginBottom: spacing.md },
  error: { color: colors.danger, marginBottom: spacing.sm },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: spacing.lg, marginTop: spacing.sm, alignItems: "center" },
  cancelLink: { color: colors.textMuted, fontWeight: "600", marginTop: spacing.md },
  saveButton: { paddingHorizontal: spacing.xl },
  deleteLinkRow: { marginTop: spacing.md },
  deleteLink: { color: colors.danger, fontWeight: "600" },
  fieldLabel: { fontSize: scaleFont(13), fontWeight: "600", color: colors.text, marginBottom: 6 },
  required: { color: colors.danger },
  fieldErrorText: { fontSize: scaleFont(12), color: colors.danger, marginTop: -2, marginBottom: spacing.sm },
  helperText: { fontSize: scaleFont(12), color: colors.textMuted, marginTop: -4, marginBottom: spacing.sm },
  currentStockText: { fontSize: scaleFont(13), color: colors.primary, fontWeight: "600", marginBottom: spacing.sm },
  pricePreview: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  pricePreviewTitle: {
    fontSize: scaleFont(12),
    fontWeight: "700",
    color: colors.primary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  pricePreviewRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  pricePreviewLabel: { fontSize: scaleFont(13), color: colors.textMuted },
  pricePreviewValue: { fontSize: scaleFont(13), color: colors.text },
  pricePreviewLabelBold: { fontSize: scaleFont(14), fontWeight: "700", color: colors.text },
  pricePreviewValueBold: { fontSize: scaleFont(14), fontWeight: "700", color: colors.primary },
  modeChips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.sm },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: scaleFont(12), color: colors.textMuted },
  chipTextActive: { color: colors.onPrimary },
  stockAdjustSection: {
    marginTop: spacing.xl,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
});
