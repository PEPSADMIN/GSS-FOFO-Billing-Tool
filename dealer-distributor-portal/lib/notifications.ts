import * as Notifications from "expo-notifications";
import { formatMoney } from "./money";

// Local, on-device scheduling only — no server push infrastructure. Notifications fire even if
// the app is closed, as long as it was opened once (on this device) to schedule them.
// Not supported on web — see notifications.web.ts, which this file's web build never loads.

let permissionRequested = false;

async function ensurePermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (permissionRequested) return false;
  permissionRequested = true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

function notificationIdFor(installmentId: string): string {
  return `installment-${installmentId}`;
}

export async function scheduleInstallmentReminders(
  installments: { id: string; dueDate: string; amount: number; invoiceNumber: string }[]
): Promise<void> {
  const granted = await ensurePermission();
  if (!granted) return;

  for (const inst of installments) {
    await cancelInstallmentReminders(inst.id);
    const trigger = new Date(inst.dueDate);
    trigger.setHours(9, 0, 0, 0);
    if (trigger.getTime() <= Date.now()) continue;

    await Notifications.scheduleNotificationAsync({
      identifier: notificationIdFor(inst.id),
      content: {
        title: "Installment due today",
        body: `${formatMoney(inst.amount)} due for invoice ${inst.invoiceNumber}. Consider calling the customer.`,
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: trigger },
    });
  }
}

export async function cancelInstallmentReminders(installmentId: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(notificationIdFor(installmentId)).catch(() => {});
}
