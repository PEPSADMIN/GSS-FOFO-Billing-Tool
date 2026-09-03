import { useState } from "react";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ColorValue, Pressable } from "react-native";
import { useAuth } from "../../lib/auth-context";
import { NavMenu } from "../../components/NavMenu";
import { showConfirm } from "../../lib/alert";
import { colors } from "../../lib/theme";

function tabIcon(name: keyof typeof Ionicons.glyphMap) {
  return ({ color, size }: { color: ColorValue; size: number }) => (
    <Ionicons name={name} color={color as string} size={size} />
  );
}

export default function TabsLayout() {
  const { hasTab, t, logout } = useAuth();
  const [menuVisible, setMenuVisible] = useState(false);

  async function handleLogout() {
    const confirmed = await showConfirm(t("action_logout"), "Are you sure you want to log out?", t("action_logout"));
    if (confirmed) await logout();
  }

  return (
    <>
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { display: "none" },
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerLeft: () => (
          <Pressable onPress={() => setMenuVisible(true)} hitSlop={8} style={{ paddingHorizontal: 14 }}>
            <Ionicons name="menu" size={24} color={colors.text} />
          </Pressable>
        ),
        headerRight: () => (
          <Pressable onPress={handleLogout} hitSlop={8} style={{ paddingHorizontal: 14 }}>
            <Ionicons name="log-out-outline" size={24} color={colors.text} />
          </Pressable>
        ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("nav_dashboard"),
          tabBarIcon: tabIcon("speedometer-outline"),
          href: hasTab("dashboard") ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="announcements"
        options={{ title: t("nav_home"), tabBarIcon: tabIcon("home-outline"), href: hasTab("home") ? undefined : null }}
      />
      <Tabs.Screen
        name="billing"
        options={{ title: t("nav_billing"), tabBarIcon: tabIcon("receipt-outline"), href: hasTab("billing") ? undefined : null }}
      />
      <Tabs.Screen
        name="invoices"
        options={{
          title: t("nav_invoices"),
          tabBarIcon: tabIcon("document-text-outline"),
          href: hasTab("invoices") ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="customers"
        options={{ title: t("nav_customers"), tabBarIcon: tabIcon("people-outline"), href: hasTab("customers") ? undefined : null }}
      />
      <Tabs.Screen
        name="items"
        options={{ title: t("nav_items"), tabBarIcon: tabIcon("cube-outline"), href: hasTab("items") ? undefined : null }}
      />
      <Tabs.Screen
        name="reports"
        options={{ title: t("nav_reports"), tabBarIcon: tabIcon("bar-chart-outline"), href: hasTab("reports") ? undefined : null }}
      />
      <Tabs.Screen
        name="admin"
        options={{ title: t("nav_admin"), tabBarIcon: tabIcon("shield-checkmark-outline"), href: hasTab("admin") ? undefined : null }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: t("nav_settings"), tabBarIcon: tabIcon("settings-outline") }}
      />
    </Tabs>
    <NavMenu visible={menuVisible} onClose={() => setMenuVisible(false)} />
    </>
  );
}
