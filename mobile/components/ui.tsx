import { ReactNode, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  PressableProps,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewProps,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { colors, glowFor, gradients, radii, scaleFont, spacing, typography, withAlpha } from "../lib/theme";

export function Screen({ children, style, ...rest }: ViewProps & { children: ReactNode }) {
  return (
    <View style={[styles.screen, style]} {...rest}>
      {children}
    </View>
  );
}

export function Card({ children, style, ...rest }: ViewProps & { children: ReactNode }) {
  return (
    <View style={[styles.card, style]} {...rest}>
      {children}
    </View>
  );
}

export function Badge({ label, tone = "primary" }: { label: string; tone?: "primary" | "success" | "warning" | "danger" }) {
  const toneColor = {
    primary: colors.primary,
    success: colors.success,
    warning: colors.warning,
    danger: colors.danger,
  }[tone];
  return (
    <View style={[styles.badge, { borderColor: toneColor }]}>
      <Text style={[styles.badgeText, { color: toneColor }]}>{label}</Text>
    </View>
  );
}

interface ButtonProps extends Omit<PressableProps, "style"> {
  label: string;
  loading?: boolean;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  style?: PressableProps["style"];
}

export function Button({ label, loading, variant = "primary", disabled, style, ...rest }: ButtonProps) {
  const isDisabled = disabled || loading;

  if (variant === "primary" || variant === "secondary") {
    const gradientColors = variant === "primary" ? gradients.primary : gradients.secondary;
    const glow = variant === "primary" ? glowFor(colors.primary) : glowFor(colors.accent);
    return (
      <Pressable disabled={isDisabled} style={[styles.buttonWrap, isDisabled && styles.disabled, style as object]} {...rest}>
        <LinearGradient colors={gradientColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.button, glow]}>
          {loading ? <ActivityIndicator color={colors.onPrimary} /> : <Text style={styles.buttonText}>{label}</Text>}
        </LinearGradient>
      </Pressable>
    );
  }

  const variantStyle = variant === "danger" ? styles.buttonDanger : styles.buttonGhost;
  const textColor = variant === "danger" ? colors.danger : colors.accent;

  return (
    <Pressable
      disabled={isDisabled}
      style={[styles.button, variantStyle, isDisabled && styles.disabled, style as object]}
      {...rest}
    >
      {loading ? <ActivityIndicator color={textColor} /> : <Text style={[styles.buttonText, { color: textColor }]}>{label}</Text>}
    </Pressable>
  );
}

interface InputProps extends TextInputProps {
  icon?: keyof typeof Ionicons.glyphMap;
  error?: boolean;
  /** Applies to the outer wrapper — use for layout (flex, width, margin). */
  style?: ViewProps["style"];
}

export function Input({ icon, error, onFocus, onBlur, style, ...rest }: InputProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.inputWrap, style]}>
      {icon ? (
        <Ionicons name={icon} size={17} color={focused ? colors.primary : colors.textMuted} style={styles.inputIcon} />
      ) : null}
      <TextInput
        placeholderTextColor={colors.textMuted}
        style={[
          styles.input,
          icon ? styles.inputWithIcon : null,
          error ? styles.inputErrorBorder : null,
          focused ? styles.inputFocused : null,
        ]}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        {...rest}
      />
    </View>
  );
}

export function SectionHeader({ label, icon }: { label: string; icon?: keyof typeof Ionicons.glyphMap }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionHeaderBar} />
      {icon ? <Ionicons name={icon} size={15} color={colors.primary} style={{ marginRight: 6 }} /> : null}
      <Text style={styles.sectionHeaderText}>{label}</Text>
    </View>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

export function ModalHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <View style={styles.modalHeaderRow}>
      <Text style={styles.modalHeaderTitle}>{title}</Text>
      <Pressable onPress={onClose} style={styles.modalCloseButton} hitSlop={8}>
        <Ionicons name="close" size={20} color={colors.textMuted} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  badge: {
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    alignSelf: "flex-start",
  },
  badgeText: {
    fontSize: scaleFont(11),
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  buttonWrap: {
    borderRadius: radii.md,
  },
  button: {
    borderRadius: radii.md,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonGhost: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: colors.accent,
  },
  buttonDanger: {
    backgroundColor: "rgba(248, 113, 113, 0.12)",
    borderWidth: 1,
    borderColor: colors.danger,
  },
  buttonText: {
    color: colors.onPrimary,
    fontSize: scaleFont(15),
    fontWeight: "700",
  },
  disabled: {
    opacity: 0.45,
  },
  inputWrap: {
    position: "relative",
    marginBottom: spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: scaleFont(15),
    color: colors.text,
    // Suppresses the browser's native focus ring on web so the custom `inputFocused` glow below
    // is the only focus indicator shown.
    outlineWidth: 0,
  },
  inputWithIcon: {
    paddingLeft: 38,
  },
  inputFocused: Platform.select({
    web: { borderColor: colors.primary, boxShadow: `0px 0px 6px ${withAlpha(colors.primary, 0.3)}` },
    default: {
      borderColor: colors.primary,
      shadowColor: colors.primary,
      shadowOpacity: 0.3,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 0 },
      elevation: 3,
    },
  }),
  inputErrorBorder: {
    borderColor: colors.danger,
  },
  inputIcon: {
    position: "absolute",
    left: 12,
    top: 13,
    zIndex: 1,
  },
  sectionLabel: {
    ...typography.label,
    marginBottom: spacing.xs,
  },
  modalHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  modalHeaderTitle: {
    ...typography.heading,
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceAlt,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  sectionHeaderBar: {
    width: 3,
    height: 14,
    backgroundColor: colors.primary,
    borderRadius: 2,
    marginRight: spacing.sm,
  },
  sectionHeaderText: {
    fontSize: scaleFont(13),
    fontWeight: "700",
    color: colors.text,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
});
