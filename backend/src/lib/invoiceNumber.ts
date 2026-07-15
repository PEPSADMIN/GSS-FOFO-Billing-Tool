import type { Prisma } from "@prisma/client";
import { formatInvoiceNumber, getFinancialYear } from "@gss/shared";

type Tx = Prisma.TransactionClient;

export async function getNextInvoiceNumber(
  tx: Tx,
  outletId: string,
  date: Date = new Date()
): Promise<{ sequenceNo: number; financialYear: string; invoiceNumber: string }> {
  const financialYear = getFinancialYear(date);

  const existing = await tx.invoiceCounter.findUnique({
    where: { outletId_financialYear: { outletId, financialYear } },
  });

  const counter = existing
    ? await tx.invoiceCounter.update({
        where: { id: existing.id },
        data: { lastNumber: { increment: 1 } },
      })
    : await tx.invoiceCounter.create({
        data: { outletId, financialYear, lastNumber: 1 },
      });

  const sequenceNo = counter.lastNumber;
  return { sequenceNo, financialYear, invoiceNumber: formatInvoiceNumber(financialYear, sequenceNo) };
}
