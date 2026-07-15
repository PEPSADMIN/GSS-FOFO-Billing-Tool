// All money amounts are integers in paise (1 rupee = 100 paise) to avoid float rounding bugs.

export interface LineTax {
  cgst: number;
  sgst: number;
  igst: number;
}

export function isInterState(outletStateCode: string, customerStateCode: string | null | undefined): boolean {
  if (!customerStateCode) return false;
  return outletStateCode !== customerStateCode;
}

export function calculateLineTax(taxableValuePaise: number, gstRatePercent: number, interState: boolean): LineTax {
  const totalTax = Math.round((taxableValuePaise * gstRatePercent) / 100);
  if (interState) {
    return { cgst: 0, sgst: 0, igst: totalTax };
  }
  const cgst = Math.round(totalTax / 2);
  const sgst = totalTax - cgst; // remainder, avoids 1-paisa drift from double rounding
  return { cgst, sgst, igst: 0 };
}

export interface RoundOffResult {
  grandTotal: number;
  roundOff: number;
}

// Rounds the pre-round total to the nearest rupee (standard Indian retail/GST practice).
export function applyRoundOff(preRoundTotalPaise: number): RoundOffResult {
  const rupees = Math.round(preRoundTotalPaise / 100);
  const grandTotal = rupees * 100;
  const roundOff = grandTotal - preRoundTotalPaise;
  return { grandTotal, roundOff };
}

export function getFinancialYear(date: Date): string {
  const year = date.getFullYear();
  const month = date.getMonth() + 1; // 1-12
  const startYear = month >= 4 ? year : year - 1;
  const endYearShort = String((startYear + 1) % 100).padStart(2, "0");
  return `${startYear}-${endYearShort}`;
}

export function formatInvoiceNumber(financialYear: string, sequenceNo: number): string {
  return `INV/${financialYear}/${String(sequenceNo).padStart(6, "0")}`;
}

export function paiseToRupees(paise: number): number {
  return paise / 100;
}

export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * 100);
}
