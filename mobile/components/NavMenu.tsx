import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, usePathname } from "expo-router";
import type { TabKey } from "@gss/shared";
import { useAuth } from "../lib/auth-context";
import { ModalHeader } from "./ui";
import { colors, radii, scaleFont, spacing } from "../lib/theme";

const MENU_ITEMS: { key: TabKey; icon: keyof typeof Ionicons.glyphMap; path: string }[] = [
  { key: "home", icon: "home-outline", path: "/" },
  { key: "dashboard", icon: "speedometer-outline", path: "/dashboard" },
  { key: "billing", icon: "receipt-outline", path: "/billing" },
  { key: "invoices", icon: "document-text-outline", path: "/invoices" },
  { key: "customers", icon: "people-outline", path: "/customers" },
  { key: "items", icon: "cube-outline", path: "/items" },
  { key: "reports", icon: "bar-chart-outline", path: "/reports" },
  { key: "admin", icon: "shield-checkmark-outline", path: "/admin" },
];

const NAV_LABEL_BY_TAB: Record<
  TabKey,
  "nav_home" | "nav_dashboard" | "nav_billing" | "nav_invoices" | "nav_customers" | "nav_items" | "nav_reports" | "nav_admin"
> = {
  home: "nav_home",
  dashboard: "nav_dashboard",
  billing: "nav_billing",
  invoices: "nav_invoices",
  customers: "nav_customers",
  items: "nav_items",
  reports: "nav_reports",
  admin: "nav_admin",
};

export function NavMenu({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { hasTab, t } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const items = MENU_ITEMS.filter((item) => hasTab(item.key));

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <ModalHeader title="Menu" onClose={onClose} />
          {items.map((item) => {
            const active = pathname === item.path;
            return (
              <Pressable
                key={item.key}
                style={[styles.row, active && styles.rowActive]}
                onPress={() => {
                  router.push(item.path as Parameters<typeof router.push>[0]);
                  onClose();
                }}
              >
                <Ionicons name={item.icon} size={20} color={active ? colors.accent : colors.textMuted} />
                <Text style={[styles.rowText, active && styles.rowTextActive]}>{t(NAV_LABEL_BY_TAB[item.key])}</Text>
              </Pressable>
            );
          })}
          <Pressable style={styles.row} onPress={() => { router.push("/settings"); onClose(); }}>
            <Ionicons name="settings-outline" size={20} color={pathname === "/settings" ? colors.accent : colors.textMuted} />
            <Text style={[styles.rowText, pathname === "/settings" && styles.rowTextActive]}>{t("nav_settings")}</Text>
          </Pressable>

          <Pressable onPress={onClose} style={styles.closeLinkRow}>
            <Text style={styles.closeLinkText}>Close menu</Text>
          </Pressable>
        </View>
        <Pressable style={styles.backdrop} onPress={onClose} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, flexDirection: "row" },
  backdrop: { flex: 1, backgroundColor: "rgba(2,6,16,0.7)" },
  card: {
    width: 280,
    backgroundColor: colors.surface,
    borderRightWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: 12,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.md,
  },
  rowActive: { backgroundColor: colors.surfaceAlt },
  rowText: { fontSize: scaleFont(15), color: colors.text },
  rowTextActive: { color: colors.accent, fontWeight: "700" },
  closeLinkRow: { marginTop: spacing.lg, alignItems: "center", paddingVertical: spacing.sm },
  closeLinkText: { color: colors.textMuted, fontWeight: "600", fontSize: scaleFont(13) },
});
