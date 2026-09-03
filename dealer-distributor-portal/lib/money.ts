import { paiseToRupees } from "@gss/shared";

export function formatMoney(paise: number): string {
  return `₹${paiseToRupees(paise).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
