import { useState } from "react";
import { Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "./ui";
import { colors, radii, scaleFont, spacing } from "../lib/theme";

interface DateFieldProps {
  value: string; // YYYY-MM-DD
  onChange: (value: string) => void;
  placeholder?: string;
}

function toDate(value: string): Date {
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function DateField({ value, onChange, placeholder }: DateFieldProps) {
  const [open, setOpen] = useState(false);

  function handlePress() {
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value: toDate(value),
        mode: "date",
        onChange: (_event, selectedDate) => {
          if (selectedDate) onChange(toIsoDate(selectedDate));
        },
      });
      return;
    }
    setOpen(true);
  }

  return (
    <>
      <Pressable style={styles.field} onPress={handlePress}>
        <Text style={styles.fieldText}>{value || placeholder || "Select date"}</Text>
        <Ionicons name="calendar-outline" color={colors.textMuted} size={18} />
      </Pressable>
      {Platform.OS === "ios" && (
        <Modal visible={open} animationType="slide" transparent>
          <View style={styles.overlay}>
            <View style={styles.sheet}>
              <DateTimePicker
                value={toDate(value)}
                mode="date"
                display="inline"
                onChange={(_event, selectedDate) => {
                  if (selectedDate) onChange(toIsoDate(selectedDate));
                }}
              />
              <Button label="Done" onPress={() => setOpen(false)} style={{ marginTop: spacing.md }} />
            </View>
          </View>
        </Modal>
      )}
    </>
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
  },
  fieldText: {
    fontSize: scaleFont(15),
    color: colors.text,
  },
  overlay: { flex: 1, backgroundColor: "rgba(2,6,16,0.7)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
});
