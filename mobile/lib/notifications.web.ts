// Local notification scheduling isn't supported on web (the in-app reminder banner covers it
// instead) — this stub avoids ever importing expo-notifications on web, since just importing it
// there logs an "Adding a listener will have no effect" warning as a side effect of its own setup.

export async function scheduleInstallmentReminders(
  _installments: { id: string; dueDate: string; amount: number; invoiceNumber: string }[]
): Promise<void> {}

export async function cancelInstallmentReminders(_installmentId: string): Promise<void> {}
