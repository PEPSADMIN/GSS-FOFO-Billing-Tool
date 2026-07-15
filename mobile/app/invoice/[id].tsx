import { useEffect, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import type { DispatchDTO, InstallmentDTO, InvoiceDTO, PaymentMode } from "@gss/shared";
import { PAYMENT_MODE_LABELS, PAYMENT_MODES, rupeesToPaise, paiseToRupees } from "@gss/shared";
import { useAuth } from "../../lib/auth-context";
import { api, ApiError } from "../../lib/api";
import { formatMoney } from "../../lib/money";
import { showAlert } from "../../lib/alert";
import { downloadFile } from "../../lib/download";
import { scheduleInstallmentReminders, cancelInstallmentReminders } from "../../lib/notifications";
import { Badge, Button, Input, ModalHeader, Screen } from "../../components/ui";
import { DateField } from "../../components/DateField";
import { colors, radii, scaleFont, spacing, typography } from "../../lib/theme";

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function InvoiceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { auth } = useAuth();
  const [invoice, setInvoice] = useState<InvoiceDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [payMode, setPayMode] = useState<PaymentMode>("CASH");
  const [payAmountText, setPayAmountText] = useState("");
  const [recording, setRecording] = useState(false);
  const [planModalVisible, setPlanModalVisible] = useState(false);
  const [payingInstallmentId, setPayingInstallmentId] = useState<string | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const [docsEditing, setDocsEditing] = useState(false);
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
  const [savingDocs, setSavingDocs] = useState(false);

  async function downloadPdf() {
    if (!auth || !invoice) return;
    setDownloadingPdf(true);
    try {
      await downloadFile(
        api.invoices.pdfPath(invoice.id),
        auth.token,
        `${invoice.invoiceNumber.replace(/\//g, "-")}.pdf`,
        "application/pdf"
      );
    } catch (err) {
      showAlert("Failed to download invoice", err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    } finally {
      setDownloadingPdf(false);
    }
  }

  function load() {
    if (!auth || !id) return;
    api.invoices
      .get(auth.token, id)
      .then((inv) => {
        setInvoice(inv);
        setEwayBillNo(inv.ewayBillNo ?? "");
        setCinNumber(inv.cinNumber ?? "");
        setAcknowledgeNo(inv.acknowledgeNo ?? "");
        setTransportMode(inv.transportMode ?? "ROAD");
        setTransporterName(inv.transporterName ?? "");
        setVehicleRegNo(inv.vehicleRegNo ?? "");
        setDriverContactNo(inv.driverContactNo ?? "");
        setPoNo(inv.poNo ?? "");
        setLrNo(inv.lrNo ?? "");
        setLrDate(inv.lrDate ?? "");
      })
      .catch(() => setError("Failed to load invoice"));
  }

  useEffect(load, [auth, id]);

  async function recordPayment() {
    if (!auth || !invoice) return;
    const amount = rupeesToPaise(Number(payAmountText) || 0);
    if (amount <= 0) {
      showAlert("Missing information", "Kindly fill the respective Amount field to continue.");
      return;
    }
    const remaining = invoice.grandTotal - invoice.amountPaid;
    if (amount > remaining) {
      showAlert("Amount too high", `The remaining balance is ${formatMoney(remaining)}. Kindly enter an amount up to that.`);
      return;
    }
    setRecording(true);
    try {
      const updated = await api.invoices.addPayment(auth.token, invoice.id, { mode: payMode, amount });
      setInvoice(updated);
      setPayAmountText("");
    } catch (err) {
      showAlert("Failed to record payment", err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    } finally {
      setRecording(false);
    }
  }

  async function payInstallment(installment: InstallmentDTO) {
    if (!auth || !invoice) return;
    setPayingInstallmentId(installment.id);
    try {
      const updated = await api.invoices.payInstallment(auth.token, invoice.id, installment.id, payMode);
      setInvoice(updated);
      await cancelInstallmentReminders(installment.id);
    } catch (err) {
      showAlert("Failed to record payment", err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    } finally {
      setPayingInstallmentId(null);
    }
  }

  async function saveDocs() {
    if (!auth || !invoice) return;
    setSavingDocs(true);
    try {
      const updated = await api.invoices.updateDocs(auth.token, invoice.id, {
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
      setInvoice(updated);
      setDocsEditing(false);
      showAlert("Saved", "Transport details updated.");
    } catch (err) {
      showAlert("Failed", err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    } finally {
      setSavingDocs(false);
    }
  }

  async function clearPlan() {
    if (!auth || !invoice) return;
    try {
      await api.invoices.clearInstallmentPlan(auth.token, invoice.id);
      for (const inst of invoice.installments) {
        if (!inst.paidAt) await cancelInstallmentReminders(inst.id);
      }
      load();
    } catch (err) {
      showAlert("Failed to clear plan", err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    }
  }

  if (error) {
    return (
      <Screen style={styles.centered}>
        <Text style={styles.error}>{error}</Text>
      </Screen>
    );
  }

  if (!invoice) {
    return (
      <Screen style={styles.centered}>
        <ActivityIndicator color={colors.accent} />
      </Screen>
    );
  }

  return (
    <Screen>
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.invoiceNumber}>{invoice.invoiceNumber}</Text>
          <Text style={styles.meta}>{new Date(invoice.createdAt).toLocaleString()}</Text>
          <Text style={styles.meta}>{invoice.customer ? invoice.customer.name : "Walk-in customer"}</Text>
          {invoice.customer?.phone ? <Text style={styles.meta}>{invoice.customer.phone}</Text> : null}
          {invoice.customer?.email ? <Text style={styles.meta}>{invoice.customer.email}</Text> : null}
        </View>
        <Button label="Download PDF" variant="secondary" loading={downloadingPdf} onPress={downloadPdf} style={styles.pdfButton} />
      </View>

      {invoice.billToSnapshot && invoice.shipToSnapshot && invoice.billToSnapshot !== invoice.shipToSnapshot && (
        <View style={styles.addressRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.addressTitle}>Bill To</Text>
            <Text style={styles.meta}>{invoice.billToSnapshot}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.addressTitle}>Ship To / Consignee</Text>
            <Text style={styles.meta}>{invoice.shipToSnapshot}</Text>
          </View>
        </View>
      )}

      <View style={styles.docsRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.docsLabel}>Transport Mode</Text>
          <Text style={styles.docsValue}>{invoice.transportMode || "—"}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.docsLabel}>Vehicle Reg. No.</Text>
          <Text style={styles.docsValue}>{invoice.vehicleRegNo || "—"}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.docsLabel}>E-way Bill No.</Text>
          <Text style={styles.docsValue}>{invoice.ewayBillNo || "—"}</Text>
        </View>
        <Pressable onPress={() => setDocsEditing((v) => !v)} style={styles.docsEditBtn}>
          <Text style={styles.docsEditText}>{docsEditing ? "Cancel" : "Edit"}</Text>
        </Pressable>
      </View>
      {invoice.transporterName || invoice.lrNo || invoice.driverContactNo ? (
        <View style={styles.docsRow}>
          {invoice.transporterName ? (
            <View style={{ flex: 1 }}>
              <Text style={styles.docsLabel}>Transporter</Text>
              <Text style={styles.docsValue}>{invoice.transporterName}</Text>
            </View>
          ) : null}
          {invoice.lrNo ? (
            <View style={{ flex: 1 }}>
              <Text style={styles.docsLabel}>LR No.</Text>
              <Text style={styles.docsValue}>{invoice.lrNo}{invoice.lrDate ? ` / ${invoice.lrDate}` : ""}</Text>
            </View>
          ) : null}
          {invoice.driverContactNo ? (
            <View style={{ flex: 1 }}>
              <Text style={styles.docsLabel}>Driver Contact</Text>
              <Text style={styles.docsValue}>{invoice.driverContactNo}</Text>
            </View>
          ) : null}
        </View>
      ) : null}
      {docsEditing && (
        <View style={styles.docsEditBox}>
          <Text style={styles.docsEditSectionLabel}>Transport Details</Text>
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
          <Input placeholder="Vehicle Reg. No." value={vehicleRegNo} onChangeText={(v) => setVehicleRegNo(v.toUpperCase())} autoCapitalize="characters" />
          <Input placeholder="Driver Contact No." value={driverContactNo} onChangeText={setDriverContactNo} keyboardType="phone-pad" />
          <Input placeholder="Buyer's PO No." value={poNo} onChangeText={setPoNo} />
          <Input placeholder="LR No. (Lorry Receipt)" value={lrNo} onChangeText={setLrNo} />
          <Input placeholder="LR Date (e.g. 15/07/2026)" value={lrDate} onChangeText={setLrDate} />
          <Text style={styles.docsEditSectionLabel}>Compliance / E-Invoice</Text>
          <Input placeholder="E-way Bill No. (12-digit)" value={ewayBillNo} onChangeText={setEwayBillNo} keyboardType="number-pad" />
          <Input placeholder="IRN Acknowledgement No." value={acknowledgeNo} onChangeText={setAcknowledgeNo} />
          <Input placeholder="CIN No. (e.g. L17110MH1973PLC019786)" value={cinNumber} onChangeText={(v) => setCinNumber(v.toUpperCase())} autoCapitalize="characters" />
          <Button label="Save Transport Details" variant="secondary" loading={savingDocs} onPress={saveDocs} />
        </View>
      )}

      <Text style={styles.sectionTitle}>Items</Text>
      {invoice.lineItems.map((li) => (
        <View key={li.id} style={styles.lineRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.lineName}>{li.itemName}</Text>
            <Text style={styles.lineMeta}>
              HSN {li.hsnCode} · {li.quantity} {li.unit} × {formatMoney(li.unitPrice)} · GST {li.gstRate}%
            </Text>
          </View>
          <Text style={styles.lineTotal}>{formatMoney(li.lineTotal)}</Text>
        </View>
      ))}

      <View style={styles.totalsBox}>
        <TotalsLine label="Taxable value" value={invoice.taxableValue} />
        {invoice.isInterState ? (
          <TotalsLine label="IGST" value={invoice.igstAmount} />
        ) : (
          <>
            <TotalsLine label="CGST" value={invoice.cgstAmount} />
            <TotalsLine label="SGST" value={invoice.sgstAmount} />
          </>
        )}
        <TotalsLine label="Round off" value={invoice.roundOff} />
        <TotalsLine label="Grand total" value={invoice.grandTotal} bold />
      </View>

      <DispatchSection invoiceId={invoice.id} />

      <Text style={styles.sectionTitle}>Payments</Text>
      {invoice.payments.length === 0 ? (
        <Text style={styles.meta}>No payments recorded</Text>
      ) : (
        invoice.payments.map((p, idx) => (
          <View key={idx} style={styles.paymentRow}>
            <View style={{ flex: 1 }}>
              <View style={styles.paymentTitleRow}>
                <Text style={styles.lineName}>{PAYMENT_MODE_LABELS[p.mode]}</Text>
                <View style={[styles.paymentTag, p.isInitial ? styles.paymentTagInitial : styles.paymentTagLater]}>
                  <Text style={styles.paymentTagText}>{p.isInitial ? "Initial" : "Added later"}</Text>
                </View>
              </View>
              <Text style={styles.lineMeta}>{new Date(p.createdAt).toLocaleString()}</Text>
            </View>
            <Text style={styles.lineTotal}>{formatMoney(p.amount)}</Text>
          </View>
        ))
      )}
      <Text style={styles.statusText}>
        {invoice.status} · Paid {formatMoney(invoice.amountPaid)} of {formatMoney(invoice.grandTotal)}
      </Text>

      {invoice.status !== "PAID" && (
        <View style={styles.payBox}>
          <View style={styles.planHeaderRow}>
            <Text style={[styles.sectionTitle, { marginTop: 0 }]}>Payment Plan (EMI)</Text>
            <Pressable onPress={() => setPlanModalVisible(true)}>
              <Text style={styles.clearLink}>{invoice.installments.length > 0 ? "Edit" : "Set up"}</Text>
            </Pressable>
          </View>

          {invoice.installments.length === 0 ? (
            <Text style={styles.meta}>No installment plan set up for this invoice.</Text>
          ) : (
            <>
              {invoice.installments.map((inst) => (
                <View key={inst.id} style={styles.installmentRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.lineName}>{formatMoney(inst.amount)}</Text>
                    <Text style={styles.lineMeta}>
                      Due {new Date(inst.dueDate).toLocaleDateString()}
                      {inst.interestRate ? ` · ${inst.interestRate}% interest` : ""}
                      {inst.documentCharges ? ` · ${formatMoney(inst.documentCharges)} charges` : ""}
                    </Text>
                  </View>
                  <Badge
                    label={inst.status}
                    tone={inst.status === "PAID" ? "success" : inst.status === "OVERDUE" ? "danger" : "warning"}
                  />
                  {inst.status !== "PAID" && (
                    <Pressable
                      style={styles.markPaidBtn}
                      onPress={() => payInstallment(inst)}
                      disabled={payingInstallmentId === inst.id}
                    >
                      {payingInstallmentId === inst.id ? (
                        <ActivityIndicator size="small" color={colors.primary} />
                      ) : (
                        <Text style={styles.markPaidText}>Mark Paid</Text>
                      )}
                    </Pressable>
                  )}
                </View>
              ))}
              <Pressable onPress={clearPlan}>
                <Text style={styles.clearLink}>Clear plan</Text>
              </Pressable>
            </>
          )}
        </View>
      )}

      {invoice.status !== "PAID" && (
        <View style={styles.payBox}>
          <Text style={styles.sectionTitle}>Record Payment</Text>
          <Text style={styles.meta}>
            Remaining balance: {formatMoney(invoice.grandTotal - invoice.amountPaid)}
          </Text>

          <Text style={styles.fieldLabel}>Payment Mode</Text>
          <View style={styles.modeChips}>
            {PAYMENT_MODES.map((mode) => (
              <Pressable
                key={mode}
                style={[styles.chip, payMode === mode && styles.chipActive]}
                onPress={() => setPayMode(mode)}
              >
                <Text style={[styles.chipText, payMode === mode && styles.chipTextActive]}>{PAYMENT_MODE_LABELS[mode]}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.fieldLabel}>Amount (₹)</Text>
          <Input
            placeholder={`Up to ${paiseToRupees(invoice.grandTotal - invoice.amountPaid)}`}
            keyboardType="decimal-pad"
            value={payAmountText}
            onChangeText={setPayAmountText}
          />

          <Button label="Record Payment" variant="secondary" loading={recording} onPress={recordPayment} />
        </View>
      )}

      <InstallmentPlanModal
        visible={planModalVisible}
        invoice={invoice}
        onClose={() => setPlanModalVisible(false)}
        onSaved={(updatedInvoice) => {
          setPlanModalVisible(false);
          setInvoice(updatedInvoice);
        }}
      />
    </ScrollView>
    </Screen>
  );
}

function InstallmentPlanModal({
  visible,
  invoice,
  onClose,
  onSaved,
}: {
  visible: boolean;
  invoice: InvoiceDTO;
  onClose: () => void;
  onSaved: (invoice: InvoiceDTO) => void;
}) {
  const { auth } = useAuth();
  const [count, setCount] = useState("3");
  const [startDate, setStartDate] = useState(todayStr());
  const [intervalDays, setIntervalDays] = useState("30");
  const [interestRate, setInterestRate] = useState("");
  const [documentCharges, setDocumentCharges] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const remaining = invoice.grandTotal - invoice.amountPaid;
  const interestAmount = Math.round((remaining * (Number(interestRate) || 0)) / 100);
  const chargesAmount = documentCharges.trim() ? rupeesToPaise(Number(documentCharges)) : 0;
  const totalPayable = remaining + interestAmount + chargesAmount;

  async function submit() {
    if (!auth) return;
    const countNum = Number(count);
    const intervalNum = Number(intervalDays);
    if (!countNum || countNum < 1) {
      showAlert("Missing information", "Kindly fill the respective Number of Installments field to continue.");
      return;
    }
    if (!startDate) {
      showAlert("Missing information", "Kindly fill the respective Start Date field to continue.");
      return;
    }
    if (!intervalNum || intervalNum < 1) {
      showAlert("Missing information", "Kindly fill the respective Days Between Installments field to continue.");
      return;
    }
    setSubmitting(true);
    try {
      const installments = await api.invoices.setInstallmentPlan(auth.token, invoice.id, {
        count: countNum,
        startDate,
        intervalDays: intervalNum,
        interestRate: interestRate.trim() ? Number(interestRate) : undefined,
        documentCharges: documentCharges.trim() ? rupeesToPaise(Number(documentCharges)) : undefined,
      });
      await scheduleInstallmentReminders(
        installments.map((i) => ({ id: i.id, dueDate: i.dueDate, amount: i.amount, invoiceNumber: invoice.invoiceNumber }))
      );
      const updated = await api.invoices.get(auth.token, invoice.id);
      onSaved(updated);
    } catch (err) {
      showAlert("Failed to set up plan", err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <ModalHeader title="Set up payment plan" onClose={onClose} />
          <Text style={styles.meta}>Remaining balance: {formatMoney(remaining)}</Text>

          <Text style={styles.fieldLabel}>Number of Installments</Text>
          <Input placeholder="e.g. 3" keyboardType="number-pad" value={count} onChangeText={setCount} />

          <Text style={styles.fieldLabel}>Start Date</Text>
          <DateField value={startDate} onChange={setStartDate} placeholder="Select date" />

          <Text style={styles.fieldLabel}>Days Between Installments</Text>
          <Input placeholder="e.g. 30 for monthly" keyboardType="number-pad" value={intervalDays} onChangeText={setIntervalDays} />

          <Text style={styles.fieldLabel}>Interest Rate (%, optional)</Text>
          <Input placeholder="e.g. 12" keyboardType="decimal-pad" value={interestRate} onChangeText={setInterestRate} />

          <Text style={styles.fieldLabel}>Document Charges (₹, optional)</Text>
          <Input placeholder="e.g. 250" keyboardType="decimal-pad" value={documentCharges} onChangeText={setDocumentCharges} />

          {Number(count) > 0 && (
            <Text style={styles.meta}>
              ≈ {formatMoney(Math.floor(totalPayable / Number(count)))} per installment, every {intervalDays || "?"} day(s).
              {totalPayable > remaining ? ` Includes ${formatMoney(interestAmount + chargesAmount)} interest/charges.` : ""}
            </Text>
          )}

          <View style={styles.modalActions}>
            <Pressable onPress={onClose}>
              <Text style={styles.cancelLink}>Cancel</Text>
            </Pressable>
            <Button label="Save Plan" variant="secondary" loading={submitting} onPress={submit} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function DispatchSection({ invoiceId }: { invoiceId: string }) {
  const { auth } = useAuth();
  const [dispatch, setDispatch] = useState<DispatchDTO | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [vehicleNo, setVehicleNo] = useState("");
  const [lrNo, setLrNo] = useState("");
  const [driverName, setDriverName] = useState("");
  const [driverPhone, setDriverPhone] = useState("");
  const [podNote, setPodNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!auth) return;
    api.dispatch
      .getByInvoice(auth.token, invoiceId)
      .then((d) => {
        setDispatch(d);
        setVehicleNo(d.vehicleNo ?? "");
        setLrNo(d.lrNo ?? "");
        setDriverName(d.driverName ?? "");
        setDriverPhone(d.driverPhone ?? "");
      })
      .catch(() => setDispatch(null))
      .finally(() => setLoaded(true));
  }, [auth, invoiceId]);

  async function saveDispatch() {
    if (!auth) return;
    setSubmitting(true);
    try {
      const updated = await api.dispatch.upsert(auth.token, invoiceId, {
        vehicleNo: vehicleNo || undefined,
        lrNo: lrNo || undefined,
        driverName: driverName || undefined,
        driverPhone: driverPhone || undefined,
      });
      setDispatch(updated);
      setEditing(false);
    } catch (err) {
      showAlert("Failed to save dispatch info", err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function markDelivered() {
    if (!auth) return;
    setSubmitting(true);
    try {
      const updated = await api.dispatch.markDelivered(auth.token, invoiceId, { podNote: podNote || undefined });
      setDispatch(updated);
    } catch (err) {
      showAlert("Failed to mark delivered", err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!loaded) return null;

  return (
    <View style={styles.payBox}>
      <Text style={[styles.sectionTitle, { marginTop: 0 }]}>Dispatch</Text>

      {editing || !dispatch ? (
        <>
          <Text style={styles.fieldLabel}>Vehicle No</Text>
          <Input placeholder="e.g. MH12AB1234" value={vehicleNo} onChangeText={setVehicleNo} />
          <Text style={styles.fieldLabel}>LR No</Text>
          <Input placeholder="e.g. LR9001" value={lrNo} onChangeText={setLrNo} />
          <Text style={styles.fieldLabel}>Driver Name</Text>
          <Input placeholder="Driver name" value={driverName} onChangeText={setDriverName} />
          <Text style={styles.fieldLabel}>Driver Phone</Text>
          <Input placeholder="Driver phone" keyboardType="phone-pad" value={driverPhone} onChangeText={setDriverPhone} />
          <Button label="Save Dispatch Info" variant="secondary" loading={submitting} onPress={saveDispatch} />
        </>
      ) : (
        <>
          <Text style={styles.meta}>Vehicle: {dispatch.vehicleNo || "—"} · LR No: {dispatch.lrNo || "—"}</Text>
          <Text style={styles.meta}>Driver: {dispatch.driverName || "—"} {dispatch.driverPhone ? `(${dispatch.driverPhone})` : ""}</Text>
          <Text style={styles.statusText}>Status: {dispatch.status}</Text>
          <Pressable onPress={() => setEditing(true)}>
            <Text style={styles.clearLink}>Edit</Text>
          </Pressable>

          {dispatch.status !== "DELIVERED" && (
            <>
              <Text style={[styles.fieldLabel, { marginTop: spacing.sm }]}>POD Note (optional)</Text>
              <Input placeholder="e.g. Received in good condition" value={podNote} onChangeText={setPodNote} />
              <Button label="Mark Delivered" loading={submitting} onPress={markDelivered} />
            </>
          )}
          {dispatch.status === "DELIVERED" && (
            <Text style={styles.meta}>
              Delivered {dispatch.podReceivedAt ? new Date(dispatch.podReceivedAt).toLocaleString() : ""}
              {dispatch.podNote ? ` · ${dispatch.podNote}` : ""}
            </Text>
          )}
        </>
      )}
    </View>
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

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: 48 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  error: { color: colors.danger },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: spacing.sm },
  addressRow: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.lg,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
  },
  addressTitle: { fontSize: scaleFont(12), fontWeight: "700", color: colors.text, marginBottom: 2 },
  docsRow: { flexDirection: "row", alignItems: "flex-start", marginVertical: spacing.sm, gap: spacing.sm },
  docsLabel: { fontSize: scaleFont(11), color: colors.textMuted, fontWeight: "600", textTransform: "uppercase" },
  docsValue: { fontSize: scaleFont(13), color: colors.text, marginTop: 2 },
  docsEditBtn: { paddingVertical: 4, paddingHorizontal: spacing.sm },
  docsEditText: { fontSize: scaleFont(13), color: colors.accent, fontWeight: "600" },
  docsEditBox: { gap: spacing.sm, marginBottom: spacing.md },
  docsEditSectionLabel: { fontSize: scaleFont(13), fontWeight: "700", color: colors.text, marginTop: spacing.sm },
  transportModeRow: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" },
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
  pdfButton: { paddingHorizontal: spacing.md },
  invoiceNumber: { fontSize: scaleFont(20), fontWeight: "700", color: colors.text },
  meta: { fontSize: scaleFont(13), color: colors.textMuted, marginTop: 2 },
  sectionTitle: { ...typography.heading, marginTop: spacing.xl, marginBottom: spacing.sm },
  lineRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  lineName: { fontSize: scaleFont(15), fontWeight: "600", color: colors.text },
  lineMeta: { fontSize: scaleFont(12), color: colors.textMuted, marginTop: 2 },
  lineTotal: { fontSize: scaleFont(15), fontWeight: "600", color: colors.text },
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
  paymentRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, alignItems: "center" },
  paymentTitleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  paymentTag: { borderRadius: radii.pill, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1 },
  paymentTagInitial: { borderColor: colors.accent, backgroundColor: "rgba(168,85,247,0.12)" },
  paymentTagLater: { borderColor: colors.success, backgroundColor: "rgba(16,185,129,0.12)" },
  paymentTagText: { fontSize: scaleFont(10), fontWeight: "700", color: colors.text, textTransform: "uppercase" },
  statusText: { marginTop: spacing.lg, fontSize: scaleFont(14), fontWeight: "600", color: colors.text },
  payBox: {
    marginTop: spacing.xl,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radii.md,
  },
  fieldLabel: { fontSize: scaleFont(13), fontWeight: "600", color: colors.text, marginBottom: 6, marginTop: spacing.sm },
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
  planHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  clearLink: { color: colors.accent, fontWeight: "600", fontSize: scaleFont(13) },
  installmentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  markPaidBtn: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    minWidth: 70,
    alignItems: "center",
  },
  markPaidText: { fontSize: scaleFont(11), fontWeight: "700", color: colors.primary },
  modalOverlay: { flex: 1, backgroundColor: "rgba(2,6,16,0.7)", justifyContent: "flex-end" },
  modalCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
  },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: spacing.lg, marginTop: spacing.lg, alignItems: "center" },
  cancelLink: { color: colors.textMuted, fontWeight: "600" },
});
