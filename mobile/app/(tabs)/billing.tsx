import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import type { CustomerAddressDTO, CustomerDTO, ItemDTO, PaymentMode } from "@gss/shared";
import { calculateLineTax, applyRoundOff, isInterState, rupeesToPaise, PAYMENT_MODES, PAYMENT_MODE_LABELS } from "@gss/shared";
import { useAuth } from "../../lib/auth-context";
import { api, ApiError } from "../../lib/api";
import { formatMoney } from "../../lib/money";
import { Button, Input, ModalHeader, Screen } from "../../components/ui";
import { DateField } from "../../components/DateField";
import { showAlert, showConfirm } from "../../lib/alert";
import { scheduleInstallmentReminders } from "../../lib/notifications";
import { colors, radii, scaleFont, spacing, typography } from "../../lib/theme";

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

interface LineItem {
  item: ItemDTO;
  quantity: number;
}

interface PaymentRow {
  mode: PaymentMode;
  amountText: string;
}

export default function BillingScreen() {
  const { auth } = useAuth();
  const router = useRouter();

  const [selectedCustomer, setSelectedCustomer] = useState<CustomerDTO | null>(null);
  const [customerPickerVisible, setCustomerPickerVisible] = useState(false);
  const [customerAddresses, setCustomerAddresses] = useState<CustomerAddressDTO[]>([]);
  const [billToAddressId, setBillToAddressId] = useState<string | null>(null);
  const [billToPickerVisible, setBillToPickerVisible] = useState(false);

  useEffect(() => {
    if (!auth || !selectedCustomer) {
      setCustomerAddresses([]);
      setBillToAddressId(null);
      return;
    }
    api.customers
      .addresses(auth.token, selectedCustomer.id)
      .then(setCustomerAddresses)
      .catch(() => setCustomerAddresses([]));
    setBillToAddressId(null);
  }, [auth, selectedCustomer]);

  const [itemQuery, setItemQuery] = useState("");
  const [itemResults, setItemResults] = useState<ItemDTO[]>([]);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [qtyText, setQtyText] = useState<Record<string, string>>({});

  const [payments, setPayments] = useState<PaymentRow[]>([{ mode: "CASH", amountText: "" }]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [ewayBillNo, setEwayBillNo] = useState("");
  const [cinNumber, setCinNumber] = useState("");
  const [acknowledgeNo, setAcknowledgeNo] = useState("");
  const [transportMode, setTransportMode] = useState("ROAD");
  const [transporterName, setTransporterName] = useState("");
  const [vehicleRegNo, setVehicleRegNo] = useState("");
  const [driverContactNo, setDriverContactNo] = useState("");
  const [poNo, setPoNo] = useState("");
  const [lrNo, setLrNo] = useState("");
  const [lrDate, setLrDate] = useState("");

  const [planEnabled, setPlanEnabled] = useState(false);
  const [planCount, setPlanCount] = useState("3");
  const [planStartDate, setPlanStartDate] = useState(todayStr());
  const [planIntervalDays, setPlanIntervalDays] = useState("30");
  const [planInterestRate, setPlanInterestRate] = useState("");
  const [planDocumentCharges, setPlanDocumentCharges] = useState("");

  useEffect(() => {
    if (!auth || itemQuery.trim().length < 1) {
      setItemResults([]);
      return;
    }
    const handle = setTimeout(() => {
      api.items
        .list(auth.token, { search: itemQuery.trim() })
        .then((res) => setItemResults(res.data))
        .catch(() => setItemResults([]));
    }, 300);
    return () => clearTimeout(handle);
  }, [itemQuery, auth]);

  const interState = useMemo(
    () => (auth ? isInterState(auth.outlet.stateCode, selectedCustomer?.stateCode) : false),
    [auth, selectedCustomer]
  );

  const totals = useMemo(() => {
    let taxableValue = 0;
    let cgst = 0;
    let sgst = 0;
    let igst = 0;

    for (const li of lineItems) {
      const lineTaxable = li.item.price * li.quantity;
      const tax = calculateLineTax(lineTaxable, li.item.gstRate, interState);
      taxableValue += lineTaxable;
      cgst += tax.cgst;
      sgst += tax.sgst;
      igst += tax.igst;
    }

    const preRoundTotal = taxableValue + cgst + sgst + igst;
    const { grandTotal, roundOff } = applyRoundOff(preRoundTotal);
    return { taxableValue, cgst, sgst, igst, roundOff, grandTotal };
  }, [lineItems, interState]);

  const amountPaid = useMemo(
    () => payments.reduce((sum, p) => sum + (rupeesToPaise(Number(p.amountText) || 0)), 0),
    [payments]
  );

  const planTotalPayable = useMemo(() => {
    const remaining = totals.grandTotal - amountPaid;
    const rate = Number(planInterestRate) || 0;
    const charges = planDocumentCharges.trim() ? rupeesToPaise(Number(planDocumentCharges)) : 0;
    const interest = Math.round((remaining * rate) / 100);
    return remaining + interest + charges;
  }, [totals.grandTotal, amountPaid, planInterestRate, planDocumentCharges]);

  function addItem(item: ItemDTO) {
    setLineItems((prev) => {
      const existing = prev.find((li) => li.item.id === item.id);
      if (existing) {
        return prev.map((li) => (li.item.id === item.id ? { ...li, quantity: li.quantity + 1 } : li));
      }
      return [...prev, { item, quantity: 1 }];
    });
    setItemQuery("");
    setItemResults([]);
  }

  function changeQuantity(itemId: string, delta: number) {
    setLineItems((prev) =>
      prev
        .map((li) => (li.item.id === itemId ? { ...li, quantity: li.quantity + delta } : li))
        .filter((li) => li.quantity > 0)
    );
    setQtyText((prev) => {
      const next = { ...prev };
      delete next[itemId];
      return next;
    });
  }

  function setQuantityText(itemId: string, text: string) {
    setQtyText((prev) => ({ ...prev, [itemId]: text }));
    const parsed = Math.floor(Number(text));
    if (text.trim() && Number.isFinite(parsed) && parsed > 0) {
      setLineItems((prev) => prev.map((li) => (li.item.id === itemId ? { ...li, quantity: parsed } : li)));
    }
  }

  function commitQuantity(itemId: string) {
    setLineItems((prev) => prev.filter((li) => li.item.id !== itemId || li.quantity > 0));
    setQtyText((prev) => {
      const next = { ...prev };
      delete next[itemId];
      return next;
    });
  }

  function addPaymentRow() {
    setPayments((prev) => [...prev, { mode: "CASH", amountText: "" }]);
  }

  function removePaymentRow(index: number) {
    setPayments((prev) => prev.filter((_, i) => i !== index));
  }

  function updatePayment(index: number, patch: Partial<PaymentRow>) {
    setPayments((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  }

  function resetForm() {
    setSelectedCustomer(null);
    setLineItems([]);
    setQtyText({});
    setPayments([{ mode: "CASH", amountText: "" }]);
    setEwayBillNo("");
    setCinNumber("");
    setAcknowledgeNo("");
    setTransportMode("ROAD");
    setTransporterName("");
    setVehicleRegNo("");
    setDriverContactNo("");
    setPoNo("");
    setLrNo("");
    setLrDate("");
    setPlanEnabled(false);
    setPlanCount("3");
    setPlanStartDate(todayStr());
    setPlanIntervalDays("30");
    setPlanInterestRate("");
    setPlanDocumentCharges("");
  }

  async function submitInvoice() {
    if (!auth) return;

    if (!auth.outlet.gstin || !auth.outlet.panCode) {
      showAlert(
        "Business details incomplete",
        "Your business GST No." +
          (!auth.outlet.panCode ? " and PAN No. are" : " is") +
          " not set.\n\nUnder the CGST Act 2017 and Income Tax Act 1961, these are mandatory for issuing invoices.\n\nKindly go to Settings → Business Details to fill them in before creating an invoice."
      );
      return;
    }

    if (!selectedCustomer) {
      showAlert("Missing information", "Kindly fill the respective Customer field to continue.");
      return;
    }
    if (lineItems.length === 0) {
      showAlert("Missing information", "Kindly add at least one Item to continue.");
      return;
    }
    if (amountPaid > totals.grandTotal) {
      showAlert(
        "Amount too high",
        `The amount paid (${formatMoney(amountPaid)}) exceeds the grand total (${formatMoney(totals.grandTotal)}). Kindly correct the payment amount.`
      );
      return;
    }
    const planCountNum = Number(planCount);
    const planIntervalNum = Number(planIntervalDays);
    if (planEnabled) {
      if (amountPaid >= totals.grandTotal) {
        showAlert("Nothing left to plan", "This invoice will be fully paid, so there's no remaining balance to set up a payment plan for.");
        return;
      }
      if (!planCountNum || planCountNum < 1) {
        showAlert("Missing information", "Kindly fill the respective Number of Installments field to continue.");
        return;
      }
      if (!planStartDate) {
        showAlert("Missing information", "Kindly fill the respective Start Date field to continue.");
        return;
      }
      if (!planIntervalNum || planIntervalNum < 1) {
        showAlert("Missing information", "Kindly fill the respective Days Between Installments field to continue.");
        return;
      }
    }
    try {
      const creditStatus = await api.customers.creditStatus(auth.token, selectedCustomer.id);
      const invoiceBalance = totals.grandTotal - amountPaid;
      if (creditStatus.creditLimit && creditStatus.currentOutstanding + invoiceBalance > creditStatus.creditLimit) {
        const proceed = await showConfirm(
          "Customer exceeded credit limit",
          `${selectedCustomer.name} has a credit limit of ${formatMoney(creditStatus.creditLimit)} and currently owes ${formatMoney(creditStatus.currentOutstanding)}. This invoice would push them to ${formatMoney(creditStatus.currentOutstanding + invoiceBalance)}. Continue anyway?`,
          "Continue anyway"
        );
        if (!proceed) return;
      }
    } catch {
      // Credit-status lookup is a best-effort warning — don't block invoice creation if it fails.
    }

    setSubmitting(true);
    setError(null);
    try {
      const invoice = await api.invoices.create(auth.token, {
        customerId: selectedCustomer.id,
        lineItems: lineItems.map((li) => ({ itemId: li.item.id, quantity: li.quantity })),
        payments: payments
          .filter((p) => Number(p.amountText) > 0)
          .map((p) => ({ mode: p.mode, amount: rupeesToPaise(Number(p.amountText)) })),
        billToAddressId: billToAddressId ?? undefined,
        ewayBillNo: ewayBillNo.trim() || undefined,
        cinNumber: cinNumber.trim() || undefined,
        acknowledgeNo: acknowledgeNo.trim() || undefined,
        transportMode: transportMode.trim() || undefined,
        transporterName: transporterName.trim() || undefined,
        vehicleRegNo: vehicleRegNo.trim() || undefined,
        driverContactNo: driverContactNo.trim() || undefined,
        poNo: poNo.trim() || undefined,
        lrNo: lrNo.trim() || undefined,
        lrDate: lrDate.trim() || undefined,
      });

      if (planEnabled) {
        try {
          const installments = await api.invoices.setInstallmentPlan(auth.token, invoice.id, {
            count: planCountNum,
            startDate: planStartDate,
            intervalDays: planIntervalNum,
            interestRate: planInterestRate.trim() ? Number(planInterestRate) : undefined,
            documentCharges: planDocumentCharges.trim() ? rupeesToPaise(Number(planDocumentCharges)) : undefined,
          });
          await scheduleInstallmentReminders(
            installments.map((i) => ({ id: i.id, dueDate: i.dueDate, amount: i.amount, invoiceNumber: invoice.invoiceNumber }))
          );
        } catch (planErr) {
          // The invoice itself was created successfully — only the plan failed. Let the user fix the
          // plan from the invoice detail page rather than hiding a created invoice behind a form error.
          showAlert(
            "Invoice created, but payment plan failed",
            planErr instanceof ApiError ? planErr.message : "You can set up the payment plan from the invoice screen."
          );
        }
      }

      resetForm();
      router.push(`/invoice/${invoice.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create invoice");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.sectionTitle}>
        Customer <Text style={styles.requiredAsterisk}>*</Text>
      </Text>
      {selectedCustomer ? (
        <View style={styles.selectedRow}>
          <Text style={styles.selectedText}>
            {selectedCustomer.name} · {selectedCustomer.customerCode}
          </Text>
          <View style={{ flexDirection: "row", gap: spacing.lg }}>
            <Pressable onPress={() => setCustomerPickerVisible(true)}>
              <Text style={styles.clearLink}>Change</Text>
            </Pressable>
            <Pressable onPress={() => setSelectedCustomer(null)}>
              <Text style={styles.clearLink}>Clear</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable style={styles.customerPickerButton} onPress={() => setCustomerPickerVisible(true)}>
          <Ionicons name="person-add-outline" size={18} color={colors.textMuted} />
          <Text style={styles.customerPickerButtonText}>Select customer</Text>
        </Pressable>
      )}

      {selectedCustomer && customerAddresses.length > 0 && (
        <Pressable style={styles.billToRow} onPress={() => setBillToPickerVisible(true)}>
          <Ionicons name="location-outline" size={16} color={colors.textMuted} />
          <Text style={styles.billToText}>
            Bill To: {billToAddressId ? customerAddresses.find((a) => a.id === billToAddressId)?.label : `${selectedCustomer.name} (default)`}
          </Text>
          <Text style={styles.clearLink}>Change</Text>
        </Pressable>
      )}

      <BillToPickerModal
        visible={billToPickerVisible}
        customer={selectedCustomer}
        addresses={customerAddresses}
        selectedId={billToAddressId}
        onSelect={(id) => {
          setBillToAddressId(id);
          setBillToPickerVisible(false);
        }}
        onClose={() => setBillToPickerVisible(false)}
      />

      <CustomerPickerModal
        visible={customerPickerVisible}
        onClose={() => setCustomerPickerVisible(false)}
        onSelect={(c) => {
          setSelectedCustomer(c);
          setCustomerPickerVisible(false);
        }}
      />

      <Text style={styles.sectionTitle}>Items</Text>
      <Input placeholder="Search item by name" value={itemQuery} onChangeText={setItemQuery} />
      {itemResults.map((item) => (
        <Pressable key={item.id} style={styles.resultRow} onPress={() => addItem(item)}>
          <Text style={styles.resultText}>
            {item.name} · {formatMoney(item.price)} · stock {item.currentStock}
          </Text>
        </Pressable>
      ))}

      {lineItems.map((li) => (
        <View key={li.item.id} style={styles.lineItemRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.lineItemName}>{li.item.name}</Text>
            <Text style={styles.lineItemMeta}>
              {formatMoney(li.item.price)} × {li.quantity} · GST {li.item.gstRate}%
            </Text>
          </View>
          <Pressable style={styles.qtyButton} onPress={() => changeQuantity(li.item.id, -1)}>
            <Text style={styles.qtyButtonText}>−</Text>
          </Pressable>
          <Input
            style={styles.qtyInput}
            keyboardType="number-pad"
            value={qtyText[li.item.id] ?? String(li.quantity)}
            onChangeText={(text) => setQuantityText(li.item.id, text)}
            onBlur={() => commitQuantity(li.item.id)}
            selectTextOnFocus
          />
          <Pressable style={styles.qtyButton} onPress={() => changeQuantity(li.item.id, 1)}>
            <Text style={styles.qtyButtonText}>+</Text>
          </Pressable>
        </View>
      ))}

      {lineItems.length > 0 && (
        <View style={styles.totalsBox}>
          <TotalsLine label="Taxable value" value={totals.taxableValue} />
          {interState ? (
            <TotalsLine label="IGST" value={totals.igst} />
          ) : (
            <>
              <TotalsLine label="CGST" value={totals.cgst} />
              <TotalsLine label="SGST" value={totals.sgst} />
            </>
          )}
          <TotalsLine label="Round off" value={totals.roundOff} />
          <TotalsLine label="Grand total" value={totals.grandTotal} bold />
        </View>
      )}

      <Text style={styles.sectionTitle}>Payments</Text>
      {payments.map((p, index) => (
        <View key={index} style={styles.paymentRow}>
          <View style={styles.modeChips}>
            {PAYMENT_MODES.map((mode) => (
              <Pressable
                key={mode}
                style={[styles.chip, p.mode === mode && styles.chipActive]}
                onPress={() => updatePayment(index, { mode })}
              >
                <Text style={[styles.chipText, p.mode === mode && styles.chipTextActive]}>{PAYMENT_MODE_LABELS[mode]}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.amountRow}>
            <Input
              style={[styles.amountInput, { flex: 1 }]}
              placeholder="Amount"
              keyboardType="decimal-pad"
              value={p.amountText}
              onChangeText={(text) => updatePayment(index, { amountText: text })}
            />
            {p.amountText.length > 0 && (
              <Pressable
                style={styles.amountClearButton}
                onPress={() => updatePayment(index, { amountText: "" })}
                hitSlop={8}
              >
                <Ionicons name="close-circle" size={20} color={colors.textMuted} />
              </Pressable>
            )}
          </View>
          {payments.length > 1 && (
            <Pressable onPress={() => removePaymentRow(index)}>
              <Text style={styles.clearLink}>Remove</Text>
            </Pressable>
          )}
        </View>
      ))}
      <Pressable onPress={addPaymentRow}>
        <Text style={styles.addPaymentLink}>+ Add payment mode</Text>
      </Pressable>

      {lineItems.length > 0 && (
        <Text style={[styles.amountPaidText, amountPaid > totals.grandTotal && styles.amountPaidTextError]}>
          Paid: {formatMoney(amountPaid)} of {formatMoney(totals.grandTotal)}
          {amountPaid > totals.grandTotal ? " · exceeds grand total" : ""}
        </Text>
      )}

      {lineItems.length > 0 && amountPaid < totals.grandTotal && (
        <>
          <View style={styles.planToggleRow}>
            <Text style={styles.sectionTitle}>Payment Plan (EMI)</Text>
            <Switch value={planEnabled} onValueChange={setPlanEnabled} />
          </View>
          {planEnabled && (
            <View style={styles.planBox}>
              <Text style={styles.meta}>Remaining balance: {formatMoney(totals.grandTotal - amountPaid)}</Text>

              <Text style={styles.fieldLabel}>Number of Installments</Text>
              <Input placeholder="e.g. 3" keyboardType="number-pad" value={planCount} onChangeText={setPlanCount} />

              <Text style={styles.fieldLabel}>Start Date</Text>
              <DateField value={planStartDate} onChange={setPlanStartDate} placeholder="Select date" />

              <Text style={styles.fieldLabel}>Days Between Installments</Text>
              <Input
                placeholder="e.g. 30 for monthly"
                keyboardType="number-pad"
                value={planIntervalDays}
                onChangeText={setPlanIntervalDays}
              />

              <Text style={styles.fieldLabel}>Interest Rate (%, optional)</Text>
              <Input
                placeholder="e.g. 12"
                keyboardType="decimal-pad"
                value={planInterestRate}
                onChangeText={setPlanInterestRate}
              />

              <Text style={styles.fieldLabel}>Document Charges (₹, optional)</Text>
              <Input
                placeholder="e.g. 250"
                keyboardType="decimal-pad"
                value={planDocumentCharges}
                onChangeText={setPlanDocumentCharges}
              />

              {Number(planCount) > 0 && (
                <Text style={styles.meta}>
                  ≈ {formatMoney(Math.floor(planTotalPayable / Number(planCount)))} per installment, every {planIntervalDays || "?"}{" "}
                  day(s).
                  {planTotalPayable > totals.grandTotal - amountPaid
                    ? ` Includes ${formatMoney(planTotalPayable - (totals.grandTotal - amountPaid))} interest/charges.`
                    : ""}
                </Text>
              )}
            </View>
          )}
        </>
      )}

      <Text style={styles.sectionTitle}>Transport Details</Text>
      <Text style={styles.meta}>Mode of Transport</Text>
      <View style={styles.transportModeRow}>
        {(["ROAD", "AIR", "RAIL", "SHIP"] as const).map((mode) => (
          <Pressable
            key={mode}
            style={[styles.modeChip, transportMode === mode && styles.modeChipActive]}
            onPress={() => setTransportMode(mode)}
          >
            <Text style={[styles.modeChipText, transportMode === mode && styles.modeChipTextActive]}>{mode}</Text>
          </Pressable>
        ))}
      </View>
      <Input placeholder="Transporter Name" value={transporterName} onChangeText={setTransporterName} />
      <Input placeholder="Vehicle Registration No. (e.g. MH12AB1234)" value={vehicleRegNo} onChangeText={(v) => setVehicleRegNo(v.toUpperCase())} autoCapitalize="characters" />
      <Input placeholder="Driver Contact No." value={driverContactNo} onChangeText={setDriverContactNo} keyboardType="phone-pad" />
      <Input placeholder="Buyer's PO No. (Purchase Order)" value={poNo} onChangeText={setPoNo} />
      <Input placeholder="LR No. (Lorry Receipt Number)" value={lrNo} onChangeText={setLrNo} />
      <Input placeholder="LR Date (e.g. 15/07/2026)" value={lrDate} onChangeText={setLrDate} />

      <Text style={styles.sectionTitle}>Compliance / E-Invoice</Text>
      <Input placeholder="E-way Bill No. (12-digit, if applicable)" value={ewayBillNo} onChangeText={setEwayBillNo} keyboardType="number-pad" />
      <Input placeholder="IRN Acknowledgement No. (if applicable)" value={acknowledgeNo} onChangeText={setAcknowledgeNo} />
      <Input placeholder="CIN No. (e.g. L17110MH1973PLC019786)" value={cinNumber} onChangeText={(v) => setCinNumber(v.toUpperCase())} autoCapitalize="characters" />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button label="Create invoice" loading={submitting} onPress={submitInvoice} />
      </ScrollView>
    </Screen>
  );
}

function TotalsLine({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <View style={styles.totalsLine}>
      <Text style={bold ? styles.totalsBoldText : styles.totalsText}>{label}</Text>
      <Text style={bold ? styles.totalsBoldText : styles.totalsText}>{formatMoney(value)}</Text>
    </View>
  );
}

function BillToPickerModal({
  visible,
  customer,
  addresses,
  selectedId,
  onSelect,
  onClose,
}: {
  visible: boolean;
  customer: CustomerDTO | null;
  addresses: CustomerAddressDTO[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.pickerOverlay}>
        <View style={styles.pickerCard}>
          <ModalHeader title="Select Bill To address" onClose={onClose} />
          <Pressable style={styles.resultRow} onPress={() => onSelect(null)}>
            <View>
              <Text style={styles.resultText}>{customer?.name} (default)</Text>
              <Text style={styles.pickerMeta}>{customer?.addressLine1 || "Primary address"}</Text>
            </View>
            {!selectedId && <Ionicons name="checkmark-circle" size={20} color={colors.accent} />}
          </Pressable>
          {addresses.map((addr) => (
            <Pressable key={addr.id} style={styles.resultRow} onPress={() => onSelect(addr.id)}>
              <View>
                <Text style={styles.resultText}>{addr.label}</Text>
                <Text style={styles.pickerMeta}>{addr.addressLine1}</Text>
              </View>
              {selectedId === addr.id && <Ionicons name="checkmark-circle" size={20} color={colors.accent} />}
            </Pressable>
          ))}
        </View>
      </View>
    </Modal>
  );
}

function CustomerPickerModal({
  visible,
  onClose,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (customer: CustomerDTO) => void;
}) {
  const { auth } = useAuth();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CustomerDTO[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    if (!auth) return;
    setLoading(true);
    api.customers
      .list(auth.token, { search: query.trim() || undefined })
      .then((res) => setResults(res.data))
      .catch(() => setResults([]))
      .finally(() => setLoading(false));
  }, [auth, query]);

  useEffect(() => {
    if (!visible) return;
    const handle = setTimeout(load, 250);
    return () => clearTimeout(handle);
  }, [visible, load]);

  useEffect(() => {
    if (!visible) setQuery("");
  }, [visible]);

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.pickerOverlay}>
        <View style={styles.pickerCard}>
          <ModalHeader title="Select customer" onClose={onClose} />
          <Input
            placeholder="Search by name, phone, or code"
            value={query}
            onChangeText={setQuery}
            icon="search-outline"
            autoFocus
          />
          <Text style={styles.pickerHint}>{query.trim() ? "Search results" : "Most recently added customers first"}</Text>
          {loading ? (
            <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.lg }} />
          ) : (
            <FlatList
              data={results}
              keyExtractor={(c) => c.id}
              style={{ maxHeight: 380 }}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={<Text style={styles.empty}>No customers found</Text>}
              renderItem={({ item: c }) => (
                <Pressable style={styles.resultRow} onPress={() => onSelect(c)}>
                  <View>
                    <Text style={styles.resultText}>{c.name}</Text>
                    <Text style={styles.pickerMeta}>
                      {c.customerCode}
                      {c.phone ? ` · ${c.phone}` : ""}
                      {c.city ? ` · ${c.city}` : ""}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                </Pressable>
              )}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: 48 },
  sectionTitle: { ...typography.heading, marginTop: spacing.xl, marginBottom: spacing.sm },
  requiredAsterisk: { color: colors.danger },
  resultRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  resultText: { color: colors.text },
  pickerMeta: { fontSize: scaleFont(13), color: colors.textMuted, marginTop: 2 },
  customerPickerButton: {
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
  customerPickerButtonText: { color: colors.textMuted, fontSize: scaleFont(15) },
  billToRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.sm,
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  billToText: { flex: 1, fontSize: scaleFont(13), color: colors.text },
  pickerOverlay: { flex: 1, backgroundColor: "rgba(2,6,16,0.7)", justifyContent: "flex-end" },
  pickerCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    maxHeight: "85%",
  },
  pickerHint: { fontSize: scaleFont(12), color: colors.textMuted, marginBottom: spacing.sm },
  empty: { textAlign: "center", color: colors.textMuted, marginTop: spacing.xl },
  selectedRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    borderRadius: radii.md,
  },
  selectedText: { fontSize: scaleFont(15), color: colors.text },
  clearLink: { color: colors.accent, fontWeight: "600" },
  lineItemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  lineItemName: { fontSize: scaleFont(15), fontWeight: "600", color: colors.text },
  lineItemMeta: { fontSize: scaleFont(13), color: colors.textMuted },
  qtyButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  qtyButtonText: { fontSize: scaleFont(18), lineHeight: 18, color: colors.text },
  qtyInput: {
    width: 48,
    marginBottom: 0,
  },
  totalsBox: {
    marginTop: spacing.lg,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
  },
  totalsLine: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  totalsText: { fontSize: scaleFont(14), color: colors.textMuted },
  totalsBoldText: { fontSize: scaleFont(16), fontWeight: "700", color: colors.accent },
  paymentRow: { marginBottom: spacing.md },
  modeChips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: 6 },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: scaleFont(13), color: colors.textMuted },
  chipTextActive: { color: colors.onPrimary },
  amountRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  amountInput: { marginBottom: 0 },
  amountClearButton: { padding: 4 },
  addPaymentLink: { color: colors.accent, fontWeight: "600", marginBottom: spacing.lg },
  amountPaidText: { fontSize: scaleFont(14), color: colors.textMuted, marginBottom: spacing.md },
  amountPaidTextError: { color: colors.danger, fontWeight: "600" },
  planToggleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  planBox: {
    marginTop: spacing.sm,
    marginBottom: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
  },
  meta: { fontSize: scaleFont(13), color: colors.textMuted, marginTop: 2 },
  fieldLabel: { fontSize: scaleFont(13), fontWeight: "600", color: colors.text, marginBottom: 6, marginTop: spacing.sm },
  error: { color: colors.danger, marginBottom: spacing.md },
  transportModeRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.sm, flexWrap: "wrap" },
  modeChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  modeChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  modeChipText: { fontSize: scaleFont(13), color: colors.text },
  modeChipTextActive: { color: "#fff", fontWeight: "600" },
});
