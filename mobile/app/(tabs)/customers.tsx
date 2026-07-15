import { ComponentProps, ReactNode, useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { CustomerAddressDTO, CustomerDTO, CustomerItemDTO, CreateCustomerAddressInput, InvoiceDTO, ItemDTO } from "@gss/shared";
import { paiseToRupees, rupeesToPaise } from "@gss/shared";
import { useAuth } from "../../lib/auth-context";
import { api, ApiError, CustomerInput } from "../../lib/api";
import { formatMoney } from "../../lib/money";
import { downloadFile } from "../../lib/download";
import { showAlert, showConfirm } from "../../lib/alert";
import { Button, Input, ModalHeader, Screen, SectionHeader } from "../../components/ui";
import { DateField } from "../../components/DateField";
import { DateRangeModal } from "../../components/DateRangeModal";
import { colors, radii, scaleFont, spacing, typography } from "../../lib/theme";

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

const PAGE_SIZE = 20;

export default function CustomersScreen() {
  const { auth } = useAuth();
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [customers, setCustomers] = useState<CustomerDTO[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<CustomerDTO | null>(null);
  const [detailFor, setDetailFor] = useState<CustomerDTO | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [dateModalVisible, setDateModalVisible] = useState(false);
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
    api.customers
      .list(auth.token, { search: search.trim() || undefined, from: from || undefined, to: to || undefined, page: 1, pageSize: PAGE_SIZE })
      .then((res) => {
        setCustomers(res.data);
        setTotal(res.total);
      })
      .catch(() => {
        setCustomers([]);
        setTotal(0);
      })
      .finally(() => setRefreshing(false));
  }, [auth, search, from, to]);

  useEffect(() => {
    const handle = setTimeout(load, 300);
    return () => clearTimeout(handle);
  }, [load]);

  function loadMore() {
    if (!auth || loadingMore || refreshing || customers.length >= total) return;
    const nextPage = page + 1;
    setLoadingMore(true);
    api.customers
      .list(auth.token, { search: search.trim() || undefined, from: from || undefined, to: to || undefined, page: nextPage, pageSize: PAGE_SIZE })
      .then((res) => {
        setCustomers((prev) => [...prev, ...res.data]);
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
      "Delete customers",
      `Remove ${selectedIds.size} customer${selectedIds.size > 1 ? "s" : ""} from your list? Their invoices and purchase history will be kept.`,
      "Delete"
    );
    if (!confirmed) return;
    setBulkDeleting(true);
    try {
      await api.customers.bulkRemove(auth.token, Array.from(selectedIds));
      setSelectedIds(new Set());
      load();
    } catch (err) {
      showAlert("Failed to delete customers", err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    } finally {
      setBulkDeleting(false);
    }
  }

  async function exportCustomers() {
    if (!auth) return;
    setExportError(null);
    setExporting(true);
    try {
      await downloadFile(
        api.customers.exportPath({ search: search.trim() || undefined, from: from || undefined, to: to || undefined }),
        auth.token,
        `customers-${todayStr()}.xlsx`
      );
    } catch (err) {
      setExportError(err instanceof ApiError ? err.message : "Failed to export customers");
    } finally {
      setExporting(false);
    }
  }

  const hasDateFilter = Boolean(from || to);

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
        <View style={styles.headerRow}>
          <Input style={styles.searchInput} placeholder="Search name, phone, code" value={search} onChangeText={setSearch} />
          <Pressable
            onPress={() => setDateModalVisible(true)}
            style={[styles.calendarButton, hasDateFilter && styles.calendarButtonActive]}
          >
            <Ionicons name="calendar-outline" size={20} color={hasDateFilter ? colors.primary : colors.textMuted} />
          </Pressable>
          <Button
            label="Export"
            variant="secondary"
            loading={exporting}
            disabled={customers.length === 0}
            onPress={exportCustomers}
            style={styles.exportButton}
          />
          <Button label="+ Add" onPress={() => setAddModalVisible(true)} style={styles.addButton} />
        </View>
      )}

      {!selectionMode && hasDateFilter ? (
        <Text style={styles.activeFilterText}>
          Filtered: {from || "…"} to {to || "…"}
        </Text>
      ) : null}
      {!selectionMode ? (
        <View style={styles.hintRow}>
          {!hasDateFilter ? <Text style={styles.selectionHint}>Hold a customer to select multiple</Text> : <View />}
          <Pressable onPress={() => setDeletedVisible(true)}>
            <Text style={styles.deletedLink}>Deleted customers</Text>
          </Pressable>
        </View>
      ) : null}
      {exportError ? <Text style={styles.exportError}>{exportError}</Text> : null}

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

      <FlatList
        data={customers}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={colors.accent} />}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<Text style={styles.empty}>No customers found</Text>}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          loadingMore ? <ActivityIndicator color={colors.accent} style={{ marginVertical: spacing.lg }} /> : null
        }
        renderItem={({ item }) => {
          const selected = selectedIds.has(item.id);
          return (
            <Pressable
              style={[styles.row, selected && styles.rowSelected]}
              onPress={() => (selectionMode ? toggleSelected(item.id) : setDetailFor(item))}
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
                  {item.customerCode}
                  {item.phone ? ` · ${item.phone}` : ""}
                  {item.city ? ` · ${item.city}` : ""}
                  {item.creditLimit != null ? ` · Credit limit ${formatMoney(item.creditLimit)}` : ""}
                </Text>
              </View>
              {!selectionMode && <Ionicons name="chevron-forward" color={colors.textMuted} size={18} />}
            </Pressable>
          );
        }}
      />

      <CustomerFormModal
        visible={addModalVisible}
        initial={EMPTY_CUSTOMER_FORM}
        title="New Customer"
        onClose={() => setAddModalVisible(false)}
        onSaved={() => {
          setAddModalVisible(false);
          load();
        }}
      />

      {editingCustomer ? (
        <CustomerFormModal
          visible
          customerId={editingCustomer.id}
          initial={toCustomerInput(editingCustomer)}
          initialCreditLimitText={editingCustomer.creditLimit != null ? String(paiseToRupees(editingCustomer.creditLimit)) : ""}
          title="Edit Customer"
          onClose={() => setEditingCustomer(null)}
          onSaved={() => {
            setEditingCustomer(null);
            setDetailFor(null);
            load();
          }}
        />
      ) : null}

      <CustomerDetailModal
        customer={detailFor}
        onClose={() => setDetailFor(null)}
        onEdit={(c) => {
          setDetailFor(null);
          setEditingCustomer(c);
        }}
        onDeleted={() => {
          setDetailFor(null);
          load();
        }}
      />

      <DeletedCustomersModal
        visible={deletedVisible}
        onClose={() => setDeletedVisible(false)}
        onRestored={load}
      />
    </Screen>
  );
}

function toCustomerInput(c: CustomerDTO): CustomerInput {
  return {
    name: c.name,
    email: c.email ?? "",
    phone: c.phone ?? "",
    alternateMobile: c.alternateMobile ?? "",
    company: c.company ?? "",
    addressLine1: c.addressLine1 ?? "",
    addressLine2: c.addressLine2 ?? "",
    addressLine3: c.addressLine3 ?? "",
    city: c.city ?? "",
    district: c.district ?? "",
    state: c.state ?? "",
    pincode: c.pincode ?? "",
    panCode: c.panCode ?? "",
    gstin: c.gstin ?? "",
  };
}


const EMPTY_CUSTOMER_FORM: CustomerInput = {
  name: "",
  email: "",
  phone: "",
  alternateMobile: "",
  company: "",
  addressLine1: "",
  addressLine2: "",
  addressLine3: "",
  city: "",
  district: "",
  state: "",
  pincode: "",
  panCode: "",
  gstin: "",
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
const GST_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[0-9A-Z]{1}[A-Z]{1}[0-9A-Z]{1}$/;
const PINCODE_REGEX = /^[0-9]{6}$/;

const FIELD_LABELS: Record<string, string> = {
  name: "Name",
  email: "Email",
  phone: "Phone",
  addressLine1: "Address Line 1",
  city: "City",
  district: "District",
  state: "State",
  pincode: "Pincode",
  panCode: "PAN Code",
  gstin: "GST No.",
};

function validateCustomerForm(form: CustomerInput): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!form.name.trim()) errors.name = "Name is required";
  if (!form.email.trim()) errors.email = "Email is required";
  else if (!EMAIL_REGEX.test(form.email)) errors.email = "Invalid email format";
  if (!form.phone.trim()) errors.phone = "Phone is required";
  if (!form.addressLine1.trim()) errors.addressLine1 = "Address Line 1 is required";
  if (!form.city.trim()) errors.city = "City is required";
  if (!form.district.trim()) errors.district = "District is required";
  if (!form.state.trim()) errors.state = "State is required";
  if (!form.pincode.trim()) errors.pincode = "Pincode is required";
  else if (!PINCODE_REGEX.test(form.pincode)) errors.pincode = "Invalid pincode format (6 digits)";
  if (form.panCode && !PAN_REGEX.test(form.panCode.toUpperCase())) {
    errors.panCode = "Invalid PAN format (e.g., ABCDE1234F)";
  }
  if (form.gstin && !GST_REGEX.test(form.gstin.toUpperCase())) {
    errors.gstin = "Invalid GST format (e.g., 27ABCDE1234F1ZV)";
  }
  return errors;
}

function FormField({
  label,
  required,
  error,
  basis = 200,
  ...inputProps
}: { label: string; required?: boolean; error?: string; basis?: number } & Omit<ComponentProps<typeof Input>, "error">) {
  return (
    <View style={[styles.field, { flexBasis: basis, flexGrow: 1, minWidth: Math.min(basis, 140) }]}>
      <Text style={styles.fieldLabel}>
        {label} {required ? <Text style={styles.required}>*</Text> : <Text style={styles.optional}>(Optional)</Text>}
      </Text>
      <Input {...inputProps} error={!!error} />
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

function FieldRow({ children }: { children: ReactNode }) {
  return <View style={styles.fieldRow}>{children}</View>;
}

function CustomerFormModal({
  visible,
  customerId,
  initial,
  initialCreditLimitText,
  title,
  onClose,
  onSaved,
}: {
  visible: boolean;
  customerId?: string;
  initial: CustomerInput;
  initialCreditLimitText?: string;
  title: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { auth } = useAuth();
  const [form, setForm] = useState<CustomerInput>(initial);
  const [creditLimitText, setCreditLimitText] = useState(initialCreditLimitText ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setForm(initial);
    setCreditLimitText(initialCreditLimitText ?? "");
    setErrors({});
    setError(null);
  }, [visible, initial, initialCreditLimitText]);

  function set<K extends keyof CustomerInput>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit() {
    if (!auth) return;
    const fieldErrors = validateCustomerForm(form);
    setErrors(fieldErrors);
    const firstErrorKey = Object.keys(fieldErrors)[0];
    if (firstErrorKey) {
      showAlert("Missing information", `Kindly fill the respective ${FIELD_LABELS[firstErrorKey] ?? firstErrorKey} field to continue.`);
      return;
    }

    setSubmitting(true);
    setError(null);
    const data: CustomerInput = {
      ...form,
      panCode: form.panCode?.toUpperCase() || undefined,
      gstin: form.gstin?.toUpperCase() || undefined,
      creditLimit: creditLimitText.trim() ? rupeesToPaise(Number(creditLimitText)) : null,
    };
    try {
      if (customerId) {
        await api.customers.update(auth.token, customerId, data);
      } else {
        await api.customers.create(auth.token, data);
      }
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save customer");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <ScrollView style={styles.modalCard} keyboardShouldPersistTaps="handled">
          <ModalHeader title={title} onClose={onClose} />

          <SectionHeader label="Contact Information" icon="person-outline" />
          <FieldRow>
            <FormField icon="person-outline" label="Name" required value={form.name} onChangeText={(v) => set("name", v)} placeholder="Customer Name" error={errors.name} />
            <FormField
              icon="mail-outline"
              label="Email"
              required
              value={form.email}
              onChangeText={(v) => set("email", v)}
              placeholder="customer@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              error={errors.email}
            />
          </FieldRow>

          <FieldRow>
            <FormField
              icon="call-outline"
              label="Phone"
              required
              value={form.phone}
              onChangeText={(v) => set("phone", v)}
              placeholder="+91 9876543210"
              keyboardType="phone-pad"
              error={errors.phone}
            />
            <FormField
              icon="call-outline"
              label="Alternative Mobile"
              value={form.alternateMobile ?? ""}
              onChangeText={(v) => set("alternateMobile", v)}
              placeholder="+91 9876543211"
              keyboardType="phone-pad"
            />
          </FieldRow>

          <FieldRow>
            <FormField icon="business-outline" label="Company" basis={9999} value={form.company ?? ""} onChangeText={(v) => set("company", v)} placeholder="Company Name" />
          </FieldRow>

          <SectionHeader label="Address Information" icon="location-outline" />
          <FieldRow>
            <FormField
              icon="location-outline"
              label="Address Line 1"
              required
              basis={150}
              value={form.addressLine1}
              onChangeText={(v) => set("addressLine1", v)}
              placeholder="Street Address"
              error={errors.addressLine1}
            />
            <FormField label="Address Line 2" basis={150} value={form.addressLine2 ?? ""} onChangeText={(v) => set("addressLine2", v)} placeholder="Area/Locality" />
            <FormField label="Address Line 3" basis={150} value={form.addressLine3 ?? ""} onChangeText={(v) => set("addressLine3", v)} placeholder="Landmark" />
          </FieldRow>

          <FieldRow>
            <FormField label="City" required basis={120} value={form.city} onChangeText={(v) => set("city", v)} placeholder="City" error={errors.city} />
            <FormField label="District" required basis={120} value={form.district} onChangeText={(v) => set("district", v)} placeholder="District" error={errors.district} />
            <FormField label="State" required basis={120} value={form.state} onChangeText={(v) => set("state", v)} placeholder="State" error={errors.state} />
            <FormField
              label="Pincode"
              required
              basis={110}
              value={form.pincode}
              onChangeText={(v) => set("pincode", v)}
              placeholder="400001"
              keyboardType="number-pad"
              error={errors.pincode}
            />
          </FieldRow>

          <SectionHeader label="Tax Information" icon="document-text-outline" />
          <FieldRow>
            <FormField
              icon="card-outline"
              label="PAN Code"
              value={form.panCode ?? ""}
              onChangeText={(v) => set("panCode", v.toUpperCase())}
              placeholder="ABCDE1234F"
              autoCapitalize="characters"
              error={errors.panCode}
            />
            <FormField
              icon="receipt-outline"
              label="GST No."
              value={form.gstin ?? ""}
              onChangeText={(v) => set("gstin", v.toUpperCase())}
              placeholder="27ABCDE1234F1ZV"
              autoCapitalize="characters"
              error={errors.gstin}
            />
          </FieldRow>

          <SectionHeader label="Credit Control" icon="wallet-outline" />
          <FieldRow>
            <FormField
              icon="wallet-outline"
              label="Credit Limit (₹)"
              basis={9999}
              value={creditLimitText}
              onChangeText={setCreditLimitText}
              placeholder="Leave blank for no limit"
              keyboardType="decimal-pad"
            />
          </FieldRow>

          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.modalActions}>
            <Pressable onPress={onClose}>
              <Text style={styles.cancelLink}>Cancel</Text>
            </Pressable>
            <Button
              label={customerId ? "Save Changes" : "Create Customer"}
              variant="secondary"
              loading={submitting}
              onPress={submit}
              style={styles.saveButton}
            />
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

function DeletedCustomersModal({
  visible,
  onClose,
  onRestored,
}: {
  visible: boolean;
  onClose: () => void;
  onRestored: () => void;
}) {
  const { auth } = useAuth();
  const [customers, setCustomers] = useState<CustomerDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!auth) return;
    setLoading(true);
    api.customers
      .list(auth.token, { status: "inactive", pageSize: 200 })
      .then((res) => setCustomers(res.data))
      .catch(() => setCustomers([]))
      .finally(() => setLoading(false));
  }, [auth]);

  useEffect(() => {
    if (visible) load();
  }, [visible, load]);

  async function restore(customer: CustomerDTO) {
    if (!auth) return;
    setRestoringId(customer.id);
    try {
      await api.customers.restore(auth.token, customer.id);
      setCustomers((prev) => prev.filter((c) => c.id !== customer.id));
      onRestored();
    } catch (err) {
      showAlert("Failed to restore customer", err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    } finally {
      setRestoringId(null);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <ModalHeader title="Deleted customers" onClose={onClose} />
          {loading ? (
            <ActivityIndicator color={colors.accent} />
          ) : customers.length === 0 ? (
            <Text style={styles.empty}>No deleted customers</Text>
          ) : (
            <FlatList
              data={customers}
              keyExtractor={(c) => c.id}
              style={{ maxHeight: 400 }}
              renderItem={({ item }) => (
                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{item.name}</Text>
                    <Text style={styles.meta}>{item.customerCode}</Text>
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

function CustomerDetailModal({
  customer,
  onClose,
  onEdit,
  onDeleted,
}: {
  customer: CustomerDTO | null;
  onClose: () => void;
  onEdit: (customer: CustomerDTO) => void;
  onDeleted: () => void;
}) {
  const { auth } = useAuth();
  const [tab, setTab] = useState<"history" | "items" | "addresses">("history");
  const [invoices, setInvoices] = useState<InvoiceDTO[]>([]);
  const [links, setLinks] = useState<CustomerItemDTO[]>([]);
  const [allItems, setAllItems] = useState<ItemDTO[]>([]);
  const [addresses, setAddresses] = useState<CustomerAddressDTO[]>([]);
  const [addressFormVisible, setAddressFormVisible] = useState(false);
  const [editingAddress, setEditingAddress] = useState<CustomerAddressDTO | null>(null);
  const [loading, setLoading] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [editingCreditLimit, setEditingCreditLimit] = useState(false);
  const [creditLimitText, setCreditLimitText] = useState("");
  const [creditLimit, setCreditLimit] = useState<number | null>(null);
  const [savingCreditLimit, setSavingCreditLimit] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function deleteCustomer() {
    if (!auth || !customer) return;
    const confirmed = await showConfirm(
      "Delete customer",
      `Remove ${customer.name} from your customer list? Their past invoices and purchase history will be kept.`,
      "Delete"
    );
    if (!confirmed) return;
    setDeleting(true);
    try {
      await api.customers.remove(auth.token, customer.id);
      onDeleted();
    } catch (err) {
      showAlert("Failed to delete customer", err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    } finally {
      setDeleting(false);
    }
  }

  useEffect(() => {
    setCreditLimit(customer?.creditLimit ?? null);
    setCreditLimitText(customer?.creditLimit != null ? String(paiseToRupees(customer.creditLimit)) : "");
    setEditingCreditLimit(false);
  }, [customer]);

  async function saveCreditLimit() {
    if (!auth || !customer) return;
    setSavingCreditLimit(true);
    try {
      const updated = await api.customers.update(auth.token, customer.id, {
        creditLimit: creditLimitText.trim() ? rupeesToPaise(Number(creditLimitText)) : null,
      });
      setCreditLimit(updated.creditLimit ?? null);
      setEditingCreditLimit(false);
    } catch (err) {
      showAlert("Failed to update credit limit", err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    } finally {
      setSavingCreditLimit(false);
    }
  }

  const reloadLinks = useCallback(() => {
    if (!auth || !customer) return;
    api.customers.linkedItems(auth.token, customer.id).then(setLinks).catch(() => setLinks([]));
  }, [auth, customer]);

  const reloadAddresses = useCallback(() => {
    if (!auth || !customer) return;
    api.customers.addresses(auth.token, customer.id).then(setAddresses).catch(() => setAddresses([]));
  }, [auth, customer]);

  useEffect(() => {
    if (!auth || !customer) return;
    setLoading(true);
    Promise.all([
      api.customers.purchaseHistory(auth.token, customer.id),
      api.customers.linkedItems(auth.token, customer.id),
      api.items.list(auth.token, { pageSize: 200 }),
      api.customers.addresses(auth.token, customer.id),
    ])
      .then(([inv, links, items, addrs]) => {
        setInvoices(inv);
        setLinks(links);
        setAllItems(items.data);
        setAddresses(addrs);
      })
      .catch(() => {
        setInvoices([]);
        setLinks([]);
        setAddresses([]);
      })
      .finally(() => setLoading(false));
  }, [auth, customer]);

  async function unlink(itemId: string) {
    if (!auth || !customer) return;
    await api.customers.unlinkItem(auth.token, customer.id, itemId);
    reloadLinks();
  }

  async function toggleFavorite(link: CustomerItemDTO) {
    if (!auth || !customer) return;
    await api.customers.linkItem(auth.token, customer.id, { itemId: link.itemId, isFavorite: !link.isFavorite });
    reloadLinks();
  }

  async function deleteAddress(address: CustomerAddressDTO) {
    if (!auth || !customer) return;
    const confirmed = await showConfirm("Delete address", `Remove "${address.label}" from this customer's addresses?`, "Delete");
    if (!confirmed) return;
    try {
      await api.customers.removeAddress(auth.token, customer.id, address.id);
      reloadAddresses();
    } catch (err) {
      showAlert("Failed to delete address", err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    }
  }

  return (
    <Modal visible={!!customer} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <ModalHeader title={customer?.name ?? ""} onClose={onClose} />

          <View style={styles.actionsRow}>
            <Pressable style={styles.actionButton} onPress={() => customer && onEdit(customer)}>
              <Ionicons name="create-outline" size={16} color={colors.accent} />
              <Text style={styles.actionButtonText}>Edit details</Text>
            </Pressable>
            <Pressable style={styles.actionButton} onPress={deleteCustomer} disabled={deleting}>
              {deleting ? (
                <ActivityIndicator size="small" color={colors.danger} />
              ) : (
                <>
                  <Ionicons name="trash-outline" size={16} color={colors.danger} />
                  <Text style={[styles.actionButtonText, { color: colors.danger }]}>Delete</Text>
                </>
              )}
            </Pressable>
          </View>

          <View style={styles.creditLimitRow}>
            {editingCreditLimit ? (
              <>
                <Input
                  style={styles.creditLimitInput}
                  placeholder="No limit"
                  keyboardType="decimal-pad"
                  value={creditLimitText}
                  onChangeText={setCreditLimitText}
                  autoFocus
                />
                <Pressable onPress={saveCreditLimit} disabled={savingCreditLimit} hitSlop={8}>
                  {savingCreditLimit ? (
                    <ActivityIndicator size="small" color={colors.accent} />
                  ) : (
                    <Text style={styles.inlineLink}>Save</Text>
                  )}
                </Pressable>
                <Pressable onPress={() => setEditingCreditLimit(false)} hitSlop={8}>
                  <Text style={styles.inlineLinkMuted}>Cancel</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={styles.meta}>
                  Credit limit: {creditLimit != null ? formatMoney(creditLimit) : "No limit set"}
                </Text>
                <Pressable onPress={() => setEditingCreditLimit(true)} hitSlop={8}>
                  <Text style={styles.inlineLink}>Edit</Text>
                </Pressable>
              </>
            )}
          </View>

          <View style={styles.tabRow}>
            <Pressable onPress={() => setTab("history")} style={[styles.tabBtn, tab === "history" && styles.tabBtnActive]}>
              <Text style={[styles.tabBtnText, tab === "history" && styles.tabBtnTextActive]}>Purchase history</Text>
            </Pressable>
            <Pressable onPress={() => setTab("items")} style={[styles.tabBtn, tab === "items" && styles.tabBtnActive]}>
              <Text style={[styles.tabBtnText, tab === "items" && styles.tabBtnTextActive]}>Linked items</Text>
            </Pressable>
            <Pressable onPress={() => setTab("addresses")} style={[styles.tabBtn, tab === "addresses" && styles.tabBtnActive]}>
              <Text style={[styles.tabBtnText, tab === "addresses" && styles.tabBtnTextActive]}>Addresses</Text>
            </Pressable>
          </View>

          {loading ? (
            <ActivityIndicator color={colors.accent} />
          ) : tab === "history" ? (
            invoices.length === 0 ? (
              <Text style={styles.empty}>No purchases yet</Text>
            ) : (
              invoices.map((inv) => (
                <View key={inv.id} style={styles.row}>
                  <View>
                    <Text style={styles.name}>{inv.invoiceNumber}</Text>
                    <Text style={styles.meta}>{new Date(inv.createdAt).toLocaleDateString()}</Text>
                  </View>
                  <Text style={styles.name}>{formatMoney(inv.grandTotal)}</Text>
                </View>
              ))
            )
          ) : tab === "items" ? (
            <>
              {links.length === 0 ? (
                <Text style={styles.empty}>No items linked yet</Text>
              ) : (
                links.map((link) => (
                  <View key={link.id} style={styles.row}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.name}>{link.item.name}</Text>
                      <Text style={styles.meta}>
                        {link.customPrice != null ? `Custom price: ${formatMoney(link.customPrice)}` : `Default: ${formatMoney(link.item.price)}`}
                      </Text>
                    </View>
                    <Pressable onPress={() => toggleFavorite(link)} style={styles.iconBtn}>
                      <Ionicons name={link.isFavorite ? "star" : "star-outline"} color={colors.warning} size={20} />
                    </Pressable>
                    <Pressable onPress={() => unlink(link.itemId)} style={styles.iconBtn}>
                      <Ionicons name="trash-outline" color={colors.danger} size={20} />
                    </Pressable>
                  </View>
                ))
              )}
              <Button label="+ Link item" variant="secondary" onPress={() => setPickerVisible(true)} style={{ marginTop: spacing.md }} />
            </>
          ) : (
            <>
              <Text style={styles.meta}>
                The customer's primary address (shown in Edit details) is always the default Ship To / Consignee. Add extra
                addresses here to use as Bill To when creating an invoice.
              </Text>
              {addresses.length === 0 ? (
                <Text style={styles.empty}>No extra addresses yet</Text>
              ) : (
                addresses.map((addr) => (
                  <View key={addr.id} style={styles.row}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.name}>{addr.label}</Text>
                      <Text style={styles.meta}>
                        {addr.addressLine1}
                        {addr.city ? `, ${addr.city}` : ""}
                        {addr.state ? `, ${addr.state}` : ""}
                        {addr.pincode ? ` - ${addr.pincode}` : ""}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => {
                        setEditingAddress(addr);
                        setAddressFormVisible(true);
                      }}
                      style={styles.iconBtn}
                    >
                      <Ionicons name="create-outline" color={colors.accent} size={20} />
                    </Pressable>
                    <Pressable onPress={() => deleteAddress(addr)} style={styles.iconBtn}>
                      <Ionicons name="trash-outline" color={colors.danger} size={20} />
                    </Pressable>
                  </View>
                ))
              )}
              <Button
                label="+ Add address"
                variant="secondary"
                onPress={() => {
                  setEditingAddress(null);
                  setAddressFormVisible(true);
                }}
                style={{ marginTop: spacing.md }}
              />
            </>
          )}

          <Pressable onPress={onClose}>
            <Text style={styles.cancelLink}>Close</Text>
          </Pressable>
        </View>
      </View>

      {customer ? (
        <LinkItemPickerModal
          visible={pickerVisible}
          customer={customer}
          items={allItems.filter((i) => !links.some((l) => l.itemId === i.id))}
          onClose={() => setPickerVisible(false)}
          onLinked={() => {
            setPickerVisible(false);
            reloadLinks();
          }}
        />
      ) : null}

      {customer ? (
        <AddressFormModal
          visible={addressFormVisible}
          customer={customer}
          address={editingAddress}
          onClose={() => setAddressFormVisible(false)}
          onSaved={() => {
            setAddressFormVisible(false);
            reloadAddresses();
          }}
        />
      ) : null}
    </Modal>
  );
}

const EMPTY_ADDRESS_FORM: CreateCustomerAddressInput = {
  label: "",
  addressLine1: "",
  addressLine2: "",
  addressLine3: "",
  city: "",
  district: "",
  state: "",
  pincode: "",
  gstin: "",
};

function AddressFormModal({
  visible,
  customer,
  address,
  onClose,
  onSaved,
}: {
  visible: boolean;
  customer: CustomerDTO;
  address: CustomerAddressDTO | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { auth } = useAuth();
  const [form, setForm] = useState<CreateCustomerAddressInput>(EMPTY_ADDRESS_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setForm(
      address
        ? {
            label: address.label,
            addressLine1: address.addressLine1,
            addressLine2: address.addressLine2 ?? "",
            addressLine3: address.addressLine3 ?? "",
            city: address.city ?? "",
            district: address.district ?? "",
            state: address.state ?? "",
            pincode: address.pincode ?? "",
            gstin: address.gstin ?? "",
          }
        : EMPTY_ADDRESS_FORM
    );
    setError(null);
  }, [visible, address]);

  function set<K extends keyof CreateCustomerAddressInput>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit() {
    if (!auth) return;
    if (!form.label.trim() || !form.addressLine1.trim()) {
      showAlert("Missing information", "Kindly fill the respective Label and Address Line 1 fields to continue.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      if (address) {
        await api.customers.updateAddress(auth.token, customer.id, address.id, form);
      } else {
        await api.customers.addAddress(auth.token, customer.id, form);
      }
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save address");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <ScrollView style={styles.modalCard} keyboardShouldPersistTaps="handled">
          <ModalHeader title={address ? "Edit address" : "Add address"} onClose={onClose} />

          <FieldRow>
            <FormField
              label="Label"
              required
              basis={9999}
              value={form.label}
              onChangeText={(v) => set("label", v)}
              placeholder="e.g. Head Office, Warehouse 2"
            />
          </FieldRow>
          <FieldRow>
            <FormField
              label="Address Line 1"
              required
              basis={150}
              value={form.addressLine1}
              onChangeText={(v) => set("addressLine1", v)}
              placeholder="Street Address"
            />
            <FormField label="Address Line 2" basis={150} value={form.addressLine2 ?? ""} onChangeText={(v) => set("addressLine2", v)} placeholder="Area/Locality" />
          </FieldRow>
          <FieldRow>
            <FormField label="City" basis={120} value={form.city ?? ""} onChangeText={(v) => set("city", v)} placeholder="City" />
            <FormField label="District" basis={120} value={form.district ?? ""} onChangeText={(v) => set("district", v)} placeholder="District" />
            <FormField label="State" basis={120} value={form.state ?? ""} onChangeText={(v) => set("state", v)} placeholder="State" />
            <FormField
              label="Pincode"
              basis={110}
              value={form.pincode ?? ""}
              onChangeText={(v) => set("pincode", v)}
              placeholder="400001"
              keyboardType="number-pad"
            />
          </FieldRow>
          <FieldRow>
            <FormField
              label="GST No."
              basis={9999}
              value={form.gstin ?? ""}
              onChangeText={(v) => set("gstin", v.toUpperCase())}
              placeholder="27ABCDE1234F1ZV"
              autoCapitalize="characters"
            />
          </FieldRow>

          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.modalActions}>
            <Pressable onPress={onClose}>
              <Text style={styles.cancelLink}>Cancel</Text>
            </Pressable>
            <Button label="Save" variant="secondary" loading={submitting} onPress={submit} style={styles.saveButton} />
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

function LinkItemPickerModal({
  visible,
  customer,
  items,
  onClose,
  onLinked,
}: {
  visible: boolean;
  customer: CustomerDTO;
  items: ItemDTO[];
  onClose: () => void;
  onLinked: () => void;
}) {
  const { auth } = useAuth();
  const [selected, setSelected] = useState<ItemDTO | null>(null);
  const [priceText, setPriceText] = useState("");
  const [favorite, setFavorite] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!auth || !selected) return;
    setSubmitting(true);
    try {
      await api.customers.linkItem(auth.token, customer.id, {
        itemId: selected.id,
        customPrice: priceText.trim() ? rupeesToPaise(Number(priceText)) : null,
        isFavorite: favorite,
      });
      setSelected(null);
      setPriceText("");
      setFavorite(false);
      onLinked();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <ModalHeader title="Link an item" onClose={onClose} />
          {selected ? (
            <>
              <Text style={styles.name}>{selected.name}</Text>
              <Text style={[styles.meta, { marginBottom: spacing.sm }]}>Default price: {formatMoney(selected.price)}</Text>
              <Input
                placeholder={`Custom price in ₹ (default ${paiseToRupees(selected.price)})`}
                keyboardType="numeric"
                value={priceText}
                onChangeText={setPriceText}
              />
              <Pressable style={styles.favoriteToggle} onPress={() => setFavorite((f) => !f)}>
                <Ionicons name={favorite ? "star" : "star-outline"} color={colors.warning} size={20} />
                <Text style={styles.meta}>Mark as favorite for this customer</Text>
              </Pressable>
              <View style={styles.modalActions}>
                <Pressable onPress={() => setSelected(null)}>
                  <Text style={styles.cancelLink}>Back</Text>
                </Pressable>
                <Button label="Link item" loading={submitting} onPress={submit} style={styles.saveButton} />
              </View>
            </>
          ) : (
            <FlatList
              data={items}
              keyExtractor={(i) => i.id}
              style={{ maxHeight: 320 }}
              ListEmptyComponent={<Text style={styles.empty}>No more items to link</Text>}
              renderItem={({ item }) => (
                <Pressable style={styles.row} onPress={() => setSelected(item)}>
                  <Text style={styles.name}>{item.name}</Text>
                  <Text style={styles.meta}>{formatMoney(item.price)}</Text>
                </Pressable>
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
  headerRow: { flexDirection: "row", gap: spacing.sm, padding: spacing.lg, alignItems: "center" },
  searchInput: { flex: 1, marginBottom: 0 },
  addButton: { paddingHorizontal: spacing.lg },
  exportButton: { paddingHorizontal: spacing.lg },
  exportError: { color: colors.danger, marginHorizontal: spacing.lg, marginBottom: spacing.sm },
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
  activeFilterText: {
    fontSize: scaleFont(12),
    color: colors.primary,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  selectionHint: {
    fontSize: scaleFont(12),
    color: colors.textMuted,
  },
  hintRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  deletedLink: { fontSize: scaleFont(13), color: colors.accent, fontWeight: "600" },
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
  rowSelected: { backgroundColor: colors.surfaceAlt },
  listContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  iconBtn: { paddingHorizontal: spacing.sm },
  name: { ...typography.body, fontWeight: "600" },
  meta: { fontSize: scaleFont(13), color: colors.textMuted, marginTop: 2 },
  field: { marginBottom: spacing.sm },
  fieldRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  fieldLabel: { fontSize: scaleFont(13), fontWeight: "600", color: colors.text, marginBottom: 6 },
  required: { color: colors.danger },
  optional: { color: colors.textMuted, fontWeight: "400" },
  fieldError: { fontSize: scaleFont(12), color: colors.danger, marginTop: 2 },
  empty: { textAlign: "center", color: colors.textMuted, marginTop: 40 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(2,6,16,0.7)",
    justifyContent: Platform.OS === "web" ? "center" : "flex-end",
    alignItems: Platform.OS === "web" ? "center" : "stretch",
    padding: Platform.OS === "web" ? spacing.lg : 0,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: Platform.OS === "web" ? radii.lg : 0,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    maxHeight: "85%",
    width: "100%",
    maxWidth: 640,
  },
  modalTitle: { ...typography.heading, marginBottom: spacing.md },
  actionsRow: { flexDirection: "row", gap: spacing.lg, marginBottom: spacing.md },
  actionButton: { flexDirection: "row", alignItems: "center", gap: 6 },
  actionButtonText: { fontSize: scaleFont(13), fontWeight: "600", color: colors.accent },
  creditLimitRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.md },
  creditLimitInput: { flex: 1, marginBottom: 0 },
  inlineLink: { color: colors.accent, fontWeight: "600", fontSize: scaleFont(13) },
  inlineLinkMuted: { color: colors.textMuted, fontWeight: "600", fontSize: scaleFont(13) },
  tabRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
  tabBtn: {
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabBtnActive: { backgroundColor: colors.surfaceAlt, borderColor: colors.accent },
  tabBtnText: { color: colors.textMuted, fontWeight: "600", fontSize: scaleFont(13) },
  tabBtnTextActive: { color: colors.accent },
  favoriteToggle: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.md },
  error: { color: colors.danger, marginBottom: spacing.sm },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: spacing.lg, marginTop: spacing.sm, alignItems: "center" },
  cancelLink: { color: colors.textMuted, fontWeight: "600", marginTop: spacing.md },
  saveButton: { paddingHorizontal: spacing.xl },
});
