interface AddressParts {
  addressLine1?: string | null;
  addressLine2?: string | null;
  addressLine3?: string | null;
  city?: string | null;
  district?: string | null;
  state?: string | null;
  pincode?: string | null;
  gstin?: string | null;
  phone?: string | null;
}

// Freezes a name + address into a plain multi-line text block at the moment an invoice is
// created, so the printed invoice stays accurate even if the customer's address is edited or
// deleted later.
export function formatAddressSnapshot(name: string, parts: AddressParts): string {
  const lines = [name];
  if (parts.addressLine1) lines.push(parts.addressLine1);
  if (parts.addressLine2) lines.push(parts.addressLine2);
  if (parts.addressLine3) lines.push(parts.addressLine3);
  const cityLine = [parts.city, parts.district, parts.state].filter(Boolean).join(", ");
  if (cityLine) lines.push(`${cityLine}${parts.pincode ? " - " + parts.pincode : ""}`);
  if (parts.phone) lines.push(`Phone: ${parts.phone}`);
  if (parts.gstin) lines.push(`GSTIN: ${parts.gstin}`);
  return lines.join("\n");
}
