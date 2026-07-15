import { DEFAULT_TABS_BY_ROLE, Role, TAB_KEYS, TabKey } from "@gss/shared";

export function parseTabs(tabs: string): TabKey[] {
  return tabs
    .split(",")
    .map((t) => t.trim())
    .filter((t): t is TabKey => (TAB_KEYS as readonly string[]).includes(t));
}

export function serializeTabs(tabs: TabKey[]): string {
  return tabs.filter((t) => (TAB_KEYS as readonly string[]).includes(t)).join(",");
}

export function resolveUserTabs(role: string, customRoleTabs?: string | null): TabKey[] {
  if (customRoleTabs) return parseTabs(customRoleTabs);
  return DEFAULT_TABS_BY_ROLE[role as Role] ?? DEFAULT_TABS_BY_ROLE.CASHIER;
}
