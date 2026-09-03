import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Calendar } from "./Calendar";
import { colors, radii, scaleFont } from "../lib/theme";

interface DateFieldProps {
  value: string; // YYYY-MM-DD
  onChange: (value: string) => void;
  placeholder?: string;
}

export function DateField({ value, onChange, placeholder }: DateFieldProps) {
  const [open, setOpen] = useState(false);

  return (
    <View>
      <Pressable style={styles.field} onPress={() => setOpen(true)}>
        <Text style={[styles.fieldText, !value && styles.placeholderText]}>{value || placeholder || "Select date"}</Text>
        <Ionicons name="calendar-outline" color={colors.textMuted} size={18} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable onPress={(e) => e.stopPropagation()}>
            <Calendar
              value={value}
              onChange={(v) => {
                onChange(v);
                setOpen(false);
              }}
              onClear={() => {
                onChange("");
                setOpen(false);
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
  },
  fieldText: { fontSize: scaleFont(15), color: colors.text },
  placeholderText: { color: colors.textMuted },
  backdrop: { flex: 1, backgroundColor: "rgba(2,6,16,0.5)", alignItems: "center", justifyContent: "center" },
});
