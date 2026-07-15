import { prisma } from "../prisma";

export async function generateCustomerCode(outletId: string): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const count = await prisma.customer.count({ where: { outletId } });
    const candidate = `C${String(count + 1 + attempt).padStart(4, "0")}`;
    const exists = await prisma.customer.findUnique({
      where: { outletId_customerCode: { outletId, customerCode: candidate } },
    });
    if (!exists) return candidate;
  }
  throw new Error("Could not generate a unique customer code, please retry");
}
