import { useEffect } from "react";
import { ActivityIndicator, Platform, View } from "react-native";
import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { AuthProvider, useAuth } from "../lib/auth-context";
import { colors } from "../lib/theme";

// Sets a default sans-serif fallback at the document root only — NOT `!important` and NOT on
// blanket div/span/etc selectors. Icon glyphs (Ionicons and friends) work by setting their own
// font-family (e.g. "Ionicons") on the element that renders them; an `!important` rule here would
// beat that and render every icon as an empty box. Plain inherited text still falls back to this
// sans-serif stack normally — anything with its own font-family (icons included) overrides it
// the ordinary way, without a fight.
function useWebTextReset() {
  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    const style = document.createElement("style");
    style.id = "gss-text-reset";
    style.textContent = `
      html, body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.getElementById("gss-text-reset")?.remove();
    };
  }, []);
}

function RootNavigator() {
  const { auth, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Protected guard={!!auth}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="invoice/[id]" options={{ headerShown: true, title: "Invoice" }} />
        <Stack.Screen name="stock-ledger" options={{ headerShown: true, title: "Stock Ledger" }} />
        <Stack.Screen name="dispatch/index" options={{ headerShown: true, title: "Dispatch" }} />
      </Stack.Protected>

      <Stack.Protected guard={!auth}>
        <Stack.Screen name="login" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  useWebTextReset();
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="light" />
        <RootNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
