import { paiseToRupees } from "@gss/shared";
import { rupeesInWords } from "./numberToWords";

interface OutletInfo {
  name: string;
  gstin: string;
  stateCode: string;
  panCode?: string | null;
  cinNo?: string | null;
  addressLine: string;
  regnAddress?: string | null;
  city: string;
  pincode: string;
  phone?: string | null;
  bankName?: string | null;
  bankAccountNo?: string | null;
  bankIfscCode?: string | null;
}

interface LineItemInfo {
  itemName: string;
  hsnCode: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  gstRate: number;
  taxableValue: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  lineTotal: number;
}

export interface InvoicePdfInput {
  invoiceNumber: string;
  createdAt: Date;
  isInterState: boolean;
  taxableValue: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  roundOff: number;
  grandTotal: number;
  amountPaid: number;
  status: string;
  outlet: OutletInfo;
  billToText: string;
  shipToText: string;
  lineItems: LineItemInfo[];
  ewayBillNo?: string | null;
  acknowledgeNo?: string | null;
  transportMode?: string | null;
  transporterName?: string | null;
  vehicleRegNo?: string | null;
  driverContactNo?: string | null;
  poNo?: string | null;
  lrNo?: string | null;
  lrDate?: string | null;
  buyerGstin?: string | null;
}

const COPY_LABELS = [
  "Original for Buyer",
  "Duplicate for Transporter",
  "Triplicate For Assessee",
  "Extra Copy",
  "Gate Copy",
];

const MARGIN = 28;
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const CW = PAGE_W - MARGIN * 2;

function fmt(paise: number): string {
  return paiseToRupees(paise).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function fmtTime(d: Date): string {
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function hRule(doc: PDFKit.PDFDocument, x: number, y: number, w: number, color = "#999999"): void {
  doc.moveTo(x, y).lineTo(x + w, y).strokeColor(color).lineWidth(0.5).stroke();
}

function vLine(doc: PDFKit.PDFDocument, x: number, y1: number, y2: number, color = "#999999"): void {
  doc.moveTo(x, y1).lineTo(x, y2).strokeColor(color).lineWidth(0.5).stroke();
}

export function generateInvoicePdf(doc: PDFKit.PDFDocument, invoice: InvoicePdfInput): void {
  for (let copyIdx = 0; copyIdx < COPY_LABELS.length; copyIdx++) {
    if (copyIdx > 0) doc.addPage();
    drawCopy(doc, invoice, COPY_LABELS[copyIdx]);
  }
}

function drawCopy(doc: PDFKit.PDFDocument, inv: InvoicePdfInput, copyLabel: string): void {
  let y = MARGIN;

  // Copy label (top-right, boxed)
  const lblW = 128;
  const lblH = 14;
  const lblX = MARGIN + CW - lblW;
  doc.rect(lblX, y, lblW, lblH).fill("#dddddd");
  doc.font("Helvetica-Bold").fontSize(7).fillColor("#000000").text(copyLabel, lblX, y + 3, { width: lblW, align: "center" });

  // Company name
  doc.font("Helvetica-Bold").fontSize(13).fillColor("#000000").text(inv.outlet.name, MARGIN, y + 2, { width: CW - lblW - 8 });
  y = doc.y + 2;

  // Warehouse address
  const warehouseAddr = inv.outlet.addressLine + ", " + inv.outlet.city + " - " + inv.outlet.pincode;
  doc.font("Helvetica").fontSize(7.5).text(warehouseAddr, MARGIN, y, { width: CW - lblW - 8 });
  y = doc.y + 1;

  if (inv.outlet.regnAddress) {
    doc.font("Helvetica").fontSize(7).fillColor("#444444").text("Regd. Office & Works: " + inv.outlet.regnAddress, MARGIN, y, { width: CW - lblW - 8 });
    doc.fillColor("#000000");
    y = doc.y + 1;
  }

  if (inv.outlet.phone) {
    doc.font("Helvetica").fontSize(7).text("Ph: " + inv.outlet.phone, MARGIN, y, { width: CW - lblW - 8 });
    y = doc.y + 2;
  }

  y = Math.max(y, MARGIN + lblH + 4);
  hRule(doc, MARGIN, y, CW);
  y += 4;

  // GSTIN | PAN | CIN line
  var ids = ["GSTIN: " + inv.outlet.gstin];
  if (inv.outlet.panCode) ids.push("PAN NO: " + inv.outlet.panCode);
  if (inv.outlet.cinNo) ids.push("CIN: " + inv.outlet.cinNo);
  doc.font("Helvetica-Bold").fontSize(7.5).text(ids.join("    "), MARGIN, y, { width: CW });
  y = doc.y + 3;

  // Acknowledge / Eway line
  var ackEway: string[] = [];
  if (inv.acknowledgeNo) ackEway.push("Acknowledgement No: " + inv.acknowledgeNo);
  if (inv.ewayBillNo) ackEway.push("E-WAY BILL No: " + inv.ewayBillNo);
  if (ackEway.length > 0) {
    doc.font("Helvetica").fontSize(7.5).text(ackEway.join("    "), MARGIN, y, { width: CW });
    y = doc.y + 3;
  }

  // Bank details
  if (inv.outlet.bankName || inv.outlet.bankAccountNo) {
    var bankParts: string[] = [];
    if (inv.outlet.bankName) bankParts.push("Bank: " + inv.outlet.bankName);
    if (inv.outlet.bankAccountNo) bankParts.push("A/C: " + inv.outlet.bankAccountNo);
    if (inv.outlet.bankIfscCode) bankParts.push("IFSC: " + inv.outlet.bankIfscCode);
    doc.font("Helvetica").fontSize(7).fillColor("#333333").text("A/C Details: " + bankParts.join("  |  "), MARGIN, y, { width: CW });
    doc.fillColor("#000000");
    y = doc.y + 3;
  }

  hRule(doc, MARGIN, y, CW, "#888888");
  y += 1;

  // Invoice header bar
  var barH = 16;
  doc.rect(MARGIN, y, CW, barH).fill("#222222");
  var col1W = Math.floor(CW * 0.38);
  var col2W = Math.floor(CW * 0.32);
  var col3W = CW - col1W - col2W;
  doc.font("Helvetica-Bold").fontSize(8).fillColor("#ffffff");
  doc.text("TAX INVOICE NO: " + inv.invoiceNumber, MARGIN + 4, y + 4, { width: col1W - 8, lineBreak: false });
  doc.text("INVOICE DATE: " + fmtDate(inv.createdAt), MARGIN + col1W + 4, y + 4, { width: col2W - 8, lineBreak: false });
  doc.text("TIME OF SUPPLY: " + fmtTime(inv.createdAt), MARGIN + col1W + col2W + 4, y + 4, { width: col3W - 8, lineBreak: false });
  doc.fillColor("#000000");
  y += barH;

  // Three-column address block
  var addrColW = Math.floor(CW / 3);
  var addrX1 = MARGIN;
  var addrX2 = MARGIN + addrColW;
  var addrX3 = MARGIN + addrColW * 2;
  var addrTopY = y;
  var hdrH = 13;

  doc.rect(addrX1, y, addrColW, hdrH).fill("#eeeeee");
  doc.rect(addrX2, y, addrColW, hdrH).fill("#eeeeee");
  doc.rect(addrX3, y, CW - addrColW * 2, hdrH).fill("#eeeeee");

  doc.font("Helvetica-Bold").fontSize(7.5).fillColor("#000000");
  doc.text("Details of Consignee (Ship To)", addrX1 + 3, y + 3, { width: addrColW - 6, lineBreak: false });
  doc.text("Details of Buyer (Bill To)", addrX2 + 3, y + 3, { width: addrColW - 6, lineBreak: false });
  doc.text("Transport Details", addrX3 + 3, y + 3, { width: CW - addrColW * 2 - 6, lineBreak: false });
  y += hdrH;

  var addrContentY = y;
  var shipLines = inv.shipToText.split("\n");
  var billLines = inv.billToText.split("\n");

  var transportRows: [string, string][] = [
    ["Transport Mode", inv.transportMode || "ROAD"],
    ["Transporter Name", inv.transporterName || "--"],
    ["Vehicle Registration", inv.vehicleRegNo || "--"],
    ["Driver Contact No", inv.driverContactNo || "--"],
    ["Your PO No", inv.poNo || "--"],
    ["LR No. & Date", inv.lrNo ? (inv.lrNo + (inv.lrDate ? " Dt:" + inv.lrDate : "")) : "--"],
    ["Buyer GST No.", inv.buyerGstin || "--"],
  ];

  var ly = addrContentY + 3;
  doc.font("Helvetica").fontSize(7.5).fillColor("#000000");
  for (var i = 0; i < shipLines.length; i++) {
    doc.text(shipLines[i], addrX1 + 3, ly, { width: addrColW - 6, lineBreak: false });
    ly = doc.y + 1.5;
  }
  var shipBottom = ly;

  ly = addrContentY + 3;
  for (var i = 0; i < billLines.length; i++) {
    doc.text(billLines[i], addrX2 + 3, ly, { width: addrColW - 6, lineBreak: false });
    ly = doc.y + 1.5;
  }
  var billBottom = ly;

  var tly = addrContentY + 2;
  var transportColW = CW - addrColW * 2;
  for (var i = 0; i < transportRows.length; i++) {
    var trow = transportRows[i];
    doc.font("Helvetica-Bold").fontSize(6.5).fillColor("#000000").text(trow[0] + " :", addrX3 + 3, tly, { width: transportColW - 6, lineBreak: false });
    tly = doc.y;
    doc.font("Helvetica").fontSize(7).text(trow[1], addrX3 + 3, tly, { width: transportColW - 6, lineBreak: false });
    tly = doc.y + 2;
  }
  var transportBottom = tly;

  var addrBottomY = Math.max(shipBottom, billBottom, transportBottom) + 6;

  hRule(doc, MARGIN, addrTopY, CW, "#888888");
  hRule(doc, MARGIN, addrTopY + hdrH, CW, "#cccccc");
  hRule(doc, MARGIN, addrBottomY, CW, "#888888");
  vLine(doc, MARGIN, addrTopY, addrBottomY);
  vLine(doc, addrX2, addrTopY, addrBottomY);
  vLine(doc, addrX3, addrTopY, addrBottomY);
  vLine(doc, MARGIN + CW, addrTopY, addrBottomY);

  y = addrBottomY;

  // Status row
  var statusH = 12;
  doc.rect(MARGIN, y, CW, statusH).fill("#f5f5f5");
  var statusText = "Invoice Status: " + inv.status;
  if (inv.amountPaid < inv.grandTotal) {
    statusText += "     Balance Due: Rs. " + fmt(inv.grandTotal - inv.amountPaid);
  } else {
    statusText += "     Fully Paid";
  }
  doc.font("Helvetica").fontSize(7).fillColor("#000000").text(statusText, MARGIN + 4, y + 3, { width: CW - 8, lineBreak: false });
  hRule(doc, MARGIN, y, CW);
  hRule(doc, MARGIN, y + statusH, CW);
  vLine(doc, MARGIN, y, y + statusH);
  vLine(doc, MARGIN + CW, y, y + statusH);
  y += statusH;

  // Items table
  y = drawItemsTable(doc, inv, y);

  // Totals
  y = drawTotals(doc, inv, y);

  // Amount in words
  var wordsH = 14;
  doc.rect(MARGIN, y, CW, wordsH).fill("#f0f0f0");
  doc.font("Helvetica-Bold").fontSize(7).fillColor("#000000").text("Total Invoice Value In Words:", MARGIN + 4, y + 3, { width: 130, lineBreak: false });
  doc.font("Helvetica-Oblique").fontSize(7).text(rupeesInWords(inv.grandTotal), MARGIN + 136, y + 3, { width: CW - 140, lineBreak: false });
  hRule(doc, MARGIN, y, CW, "#888888");
  hRule(doc, MARGIN, y + wordsH, CW, "#888888");
  vLine(doc, MARGIN, y, y + wordsH);
  vLine(doc, MARGIN + CW, y, y + wordsH);
  y += wordsH + 4;

  // Certification
  doc.font("Helvetica-Oblique").fontSize(6.5).fillColor("#555555").text(
    "We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.",
    MARGIN, y, { width: CW }
  );
  doc.fillColor("#000000");
  y = doc.y + 4;

  drawSignatureBlock(doc, inv.outlet.name, y);
}

function getColWidths(): { key: string; label: string; width: number }[] {
  var fixed = [
    { key: "sno", label: "S.No", width: 22 },
    { key: "item", label: "Item Description", width: 130 },
    { key: "hsn", label: "HSN CODE", width: 50 },
    { key: "qty", label: "Qty", width: 28 },
    { key: "unit", label: "UOM", width: 28 },
    { key: "rate", label: "Rate/Unit", width: 52 },
    { key: "cgst", label: "CGST%", width: 36 },
    { key: "sgst", label: "SGST%", width: 36 },
    { key: "igst", label: "IGST%", width: 36 },
    { key: "total", label: "Total Basic Amount", width: 0 },
  ];
  var usedW = 0;
  for (var i = 0; i < fixed.length - 1; i++) usedW += fixed[i].width;
  fixed[fixed.length - 1].width = Math.floor(CW - usedW);
  return fixed;
}

function drawItemsTable(doc: PDFKit.PDFDocument, inv: InvoicePdfInput, startY: number): number {
  var cols = getColWidths();
  var HDR_H = 18;
  var ROW_H = 16;
  var y = startY;

  // Header
  doc.rect(MARGIN, y, CW, HDR_H).fill("#cccccc");
  var cx = MARGIN;
  for (var i = 0; i < cols.length; i++) {
    var col = cols[i];
    doc.font("Helvetica-Bold").fontSize(7).fillColor("#000000");
    doc.text(col.label, cx + 2, y + 3, { width: col.width - 4, align: "center", lineBreak: false });
    cx += col.width;
  }
  cx = MARGIN;
  for (var i = 0; i < cols.length; i++) {
    cx += cols[i].width;
    vLine(doc, cx, y, y + HDR_H, "#666666");
  }
  hRule(doc, MARGIN, y, CW, "#666666");
  hRule(doc, MARGIN, y + HDR_H, CW, "#666666");
  vLine(doc, MARGIN, y, y + HDR_H, "#666666");
  y += HDR_H;

  for (var idx = 0; idx < inv.lineItems.length; idx++) {
    var item = inv.lineItems[idx];
    if (y + ROW_H > PAGE_H - 100) {
      doc.addPage();
      y = MARGIN;
    }

    var cgstPct = inv.isInterState ? 0 : item.gstRate / 2;
    var sgstPct = inv.isInterState ? 0 : item.gstRate / 2;
    var igstPct = inv.isInterState ? item.gstRate : 0;

    var values = [
      String(idx + 1),
      item.itemName,
      item.hsnCode,
      String(item.quantity),
      item.unit,
      fmt(item.unitPrice),
      cgstPct > 0 ? cgstPct + "%" : "--",
      sgstPct > 0 ? sgstPct + "%" : "--",
      igstPct > 0 ? igstPct + "%" : "--",
      fmt(item.lineTotal),
    ];

    cx = MARGIN;
    for (var vi = 0; vi < values.length; vi++) {
      var col2 = cols[vi];
      var align2: "left" | "center" | "right" = vi === 0 || vi === 3 || vi === 4 ? "center" : vi === 1 ? "left" : "right";
      doc.font("Helvetica").fontSize(7.5).fillColor("#000000");
      doc.text(values[vi], cx + 2, y + 4, { width: col2.width - 4, align: align2, lineBreak: false });
      cx += col2.width;
    }

    hRule(doc, MARGIN, y + ROW_H, CW, "#cccccc");
    cx = MARGIN;
    for (var i = 0; i < cols.length; i++) {
      cx += cols[i].width;
      vLine(doc, cx, y, y + ROW_H, "#cccccc");
    }
    vLine(doc, MARGIN, y, y + ROW_H, "#cccccc");
    y += ROW_H;
  }

  // Sub-total
  var stH = 15;
  doc.rect(MARGIN, y, CW, stH).fill("#eeeeee");
  var stValues = [
    "",
    "Sub Total",
    "",
    "",
    "",
    fmt(inv.taxableValue),
    inv.cgstAmount > 0 ? fmt(inv.cgstAmount) : "--",
    inv.sgstAmount > 0 ? fmt(inv.sgstAmount) : "--",
    inv.igstAmount > 0 ? fmt(inv.igstAmount) : "--",
    fmt(inv.taxableValue + inv.cgstAmount + inv.sgstAmount + inv.igstAmount),
  ];
  cx = MARGIN;
  for (var vi = 0; vi < stValues.length; vi++) {
    var col3 = cols[vi];
    var a3: "left" | "center" | "right" = vi === 1 ? "left" : "right";
    doc.font("Helvetica-Bold").fontSize(7.5).fillColor("#000000");
    doc.text(stValues[vi], cx + 2, y + 4, { width: col3.width - 4, align: a3, lineBreak: false });
    cx += col3.width;
  }
  hRule(doc, MARGIN, y, CW, "#666666");
  hRule(doc, MARGIN, y + stH, CW, "#666666");
  cx = MARGIN;
  for (var i = 0; i < cols.length; i++) {
    cx += cols[i].width;
    vLine(doc, cx, y, y + stH, "#666666");
  }
  vLine(doc, MARGIN, y, y + stH, "#666666");
  y += stH;

  return y + 4;
}

function drawTotals(doc: PDFKit.PDFDocument, inv: InvoicePdfInput, startY: number): number {
  var leftW = Math.floor(CW * 0.52);
  var rightW = CW - leftW;
  var rightX = MARGIN + leftW;
  var y = startY;
  var ry = startY;

  var totalTax = inv.cgstAmount + inv.sgstAmount + inv.igstAmount;
  var gstType = inv.isInterState ? "IGST" : "CGST+SGST";

  if (totalTax > 0) {
    doc.font("Helvetica-Bold").fontSize(7).fillColor("#000000").text(
      "Total " + gstType + " Paid  Rs. " + fmt(totalTax),
      MARGIN + 3, y + 3, { width: leftW - 6, lineBreak: false }
    );
    var nextLineY = doc.y + 1;
    doc.font("Helvetica-Oblique").fontSize(7).text(
      "In Words: " + rupeesInWords(totalTax),
      MARGIN + 3, nextLineY, { width: leftW - 6 }
    );
    y = Math.max(y + 10, doc.y + 3);
  }

  var breakdown: [string, string][] = [];
  if (inv.isInterState) {
    var rate = inv.lineItems.length > 0 ? inv.lineItems[0].gstRate : 18;
    breakdown.push(["IGST @ " + rate + "%", fmt(inv.igstAmount)]);
  } else {
    var rate = inv.lineItems.length > 0 ? inv.lineItems[0].gstRate : 18;
    breakdown.push(["CGST @ " + (rate / 2) + "%", fmt(inv.cgstAmount)]);
    breakdown.push(["SGST @ " + (rate / 2) + "%", fmt(inv.sgstAmount)]);
  }
  breakdown.push(["Rounding Off", fmt(inv.roundOff)]);

  var ROW_H = 13;
  for (var i = 0; i < breakdown.length; i++) {
    var br = breakdown[i];
    doc.font("Helvetica").fontSize(7.5).fillColor("#000000");
    doc.text(br[0], rightX + 3, ry + 3, { width: rightW - 58, lineBreak: false });
    doc.text(br[1], rightX + rightW - 58, ry + 3, { width: 54, align: "right", lineBreak: false });
    hRule(doc, rightX, ry + ROW_H, rightW, "#cccccc");
    ry += ROW_H;
  }

  var grandY = Math.max(y, ry);
  var gtH = 18;
  doc.rect(rightX, grandY, rightW, gtH).fill("#cccccc");
  doc.font("Helvetica-Bold").fontSize(9).fillColor("#000000");
  doc.text("Grand Total", rightX + 3, grandY + 4, { width: rightW - 62, lineBreak: false });
  doc.text("Rs. " + fmt(inv.grandTotal), rightX + rightW - 62, grandY + 4, { width: 58, align: "right", lineBreak: false });

  var blockBottomY = grandY + gtH;
  hRule(doc, MARGIN, startY, CW, "#888888");
  hRule(doc, MARGIN, blockBottomY, CW, "#888888");
  vLine(doc, MARGIN, startY, blockBottomY);
  vLine(doc, rightX, startY, blockBottomY);
  vLine(doc, MARGIN + CW, startY, blockBottomY);

  return blockBottomY + 4;
}

function drawSignatureBlock(doc: PDFKit.PDFDocument, outletName: string, startY: number): void {
  var available = PAGE_H - MARGIN - startY;
  var y = startY;
  if (available < 55) {
    doc.addPage();
    y = MARGIN;
  }

  var sigH = 42;
  var cols4 = CW / 4;
  var labels = [
    "Received Goods in Good\nCondition",
    "Prepared By",
    "Checked By",
    outletName + "\nAuthorized Signatory",
  ];

  hRule(doc, MARGIN, y, CW, "#888888");
  vLine(doc, MARGIN, y, y + sigH);
  vLine(doc, MARGIN + CW, y, y + sigH);
  vLine(doc, MARGIN + cols4, y, y + sigH);
  vLine(doc, MARGIN + cols4 * 2, y, y + sigH);
  vLine(doc, MARGIN + cols4 * 3, y, y + sigH);

  for (var i = 0; i < 4; i++) {
    var cx = MARGIN + cols4 * i;
    doc.font("Helvetica").fontSize(7).fillColor("#000000").text(labels[i], cx + 3, y + 4, { width: cols4 - 6, align: "center" });
  }

  hRule(doc, MARGIN, y + 14, CW, "#cccccc");
  doc.font("Helvetica-Oblique").fontSize(6.5).fillColor("#555555").text("Signature With Seal", MARGIN + 3, y + 16, { width: cols4 - 6, align: "center" });
  doc.fillColor("#000000");

  hRule(doc, MARGIN, y + sigH, CW, "#888888");
}
