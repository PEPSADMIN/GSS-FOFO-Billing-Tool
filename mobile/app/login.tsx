import { useState } from "react";
import { Image, KeyboardAvoidingView, Platform, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "../lib/auth-context";
import { ApiError } from "../lib/api";
import { Button, Input } from "../components/ui";
import { colors, gradients, radii, spacing, typography } from "../lib/theme";

export default function LoginScreen() {
  const { login } = useAuth();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleLogin() {
    setError(null);
    setSubmitting(true);
    try {
      await login(phone.trim(), password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <LinearGradient colors={gradients.header} style={styles.container}>
      <KeyboardAvoidingView style={styles.formWrap} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.brandBadge}>
          <Image source={require("../assets/icon.png")} style={styles.brandLogo} resizeMode="contain" />
        </View>
        <Text style={styles.title}>GSS Billing</Text>
        <Text style={styles.subtitle}>Sign in to continue</Text>

        <View style={styles.card}>
          <Input
            placeholder="Phone number"
            keyboardType="phone-pad"
            autoCapitalize="none"
            value={phone}
            onChangeText={setPhone}
          />
          <Input placeholder="Password" secureTextEntry value={password} onChangeText={setPassword} />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Button label="Log in" loading={submitting} disabled={!phone || !password} onPress={handleLogin} style={styles.button} />
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  formWrap: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },
  brandBadge: {
    alignSelf: "center",
    width: 160,
    height: 160,
    borderRadius: radii.lg,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
    padding: spacing.sm,
  },
  brandLogo: {
    width: "100%",
    height: "100%",
  },
  title: {
    ...typography.title,
    textAlign: "center",
  },
  subtitle: {
    ...typography.subtitle,
    textAlign: "center",
    marginTop: 4,
    marginBottom: spacing.xl,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  error: {
    color: colors.danger,
    marginBottom: spacing.sm,
  },
  button: {
    marginTop: spacing.xs,
  },
});
