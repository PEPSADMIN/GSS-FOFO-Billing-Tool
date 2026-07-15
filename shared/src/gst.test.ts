import { describe, expect, it } from "vitest";
import {
  applyRoundOff,
  calculateLineTax,
  formatInvoiceNumber,
  getFinancialYear,
  isInterState,
  paiseToRupees,
  rupeesToPaise,
} from "./gst";

describe("isInterState", () => {
  it("is false when the customer has no state code (walk-in / unknown)", () => {
    expect(isInterState("27", null)).toBe(false);
    expect(isInterState("27", undefined)).toBe(false);
  });

  it("is false when outlet and customer share a state code", () => {
    expect(isInterState("27", "27")).toBe(false);
  });

  it("is true when outlet and customer state codes differ", () => {
    expect(isInterState("27", "29")).toBe(true);
  });
});

describe("calculateLineTax", () => {
  it("splits tax evenly into CGST/SGST for intra-state sales", () => {
    // 1000 rupees @ 18% = 180 rupees tax -> 90/90 split
    expect(calculateLineTax(100000, 18, false)).toEqual({ cgst: 9000, sgst: 9000, igst: 0 });
  });

  it("puts all tax into IGST for inter-state sales", () => {
    expect(calculateLineTax(100000, 18, true)).toEqual({ cgst: 0, sgst: 0, igst: 18000 });
  });

  it("never drops a paisa when the tax amount is odd (CGST+SGST always reconstitutes the total)", () => {
    // 333 paise taxable @ 5% = 16.65 -> rounds to 17 paise total tax; cgst+sgst must sum to 17, not 16 or 18
    const tax = calculateLineTax(333, 5, false);
    expect(tax.cgst + tax.sgst).toBe(Math.round((333 * 5) / 100));
  });

  it("returns zero tax for a 0% GST rate", () => {
    expect(calculateLineTax(50000, 0, false)).toEqual({ cgst: 0, sgst: 0, igst: 0 });
  });
});

describe("applyRoundOff", () => {
  it("rounds down when the fractional paise is below half a rupee", () => {
    // 2360.30 rupees rounds down to 2360 -> grandTotal 236000, roundOff is negative (discount)
    const { grandTotal, roundOff } = applyRoundOff(236030);
    expect(grandTotal).toBe(236000);
    expect(roundOff).toBe(-30);
  });

  it("rounds up when the fractional paise is half a rupee or more", () => {
    const { grandTotal, roundOff } = applyRoundOff(236050);
    expect(grandTotal).toBe(236100);
    expect(roundOff).toBe(50);
  });

  it("is a no-op on an exact rupee amount", () => {
    const { grandTotal, roundOff } = applyRoundOff(150000);
    expect(grandTotal).toBe(150000);
    expect(roundOff).toBe(0);
  });
});

describe("getFinancialYear", () => {
  it("treats January-March as part of the previous financial year", () => {
    expect(getFinancialYear(new Date("2026-02-15"))).toBe("2025-26");
  });

  it("treats April-December as the start of the new financial year", () => {
    expect(getFinancialYear(new Date("2026-04-01"))).toBe("2026-27");
    expect(getFinancialYear(new Date("2026-12-31"))).toBe("2026-27");
  });
});

describe("formatInvoiceNumber", () => {
  it("zero-pads the sequence number to 6 digits", () => {
    expect(formatInvoiceNumber("2026-27", 7)).toBe("INV/2026-27/000007");
  });

  it("does not truncate a sequence number already 6+ digits long", () => {
    expect(formatInvoiceNumber("2026-27", 1234567)).toBe("INV/2026-27/1234567");
  });
});

describe("paise/rupee conversions round-trip", () => {
  it("converts paise to rupees", () => {
    expect(paiseToRupees(123456)).toBe(1234.56);
  });

  it("converts rupees to paise, rounding away floating point drift", () => {
    expect(rupeesToPaise(1234.56)).toBe(123456);
    expect(rupeesToPaise(0.1 + 0.2)).toBe(30); // classic float bug: 0.1+0.2 = 0.30000000000000004
  });
});
