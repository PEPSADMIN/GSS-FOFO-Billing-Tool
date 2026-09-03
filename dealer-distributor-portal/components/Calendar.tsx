import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, scaleFont, spacing } from "../lib/theme";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

interface CalendarProps {
  value: string; // YYYY-MM-DD, or "" for none
  onChange: (value: string) => void;
  onClear?: () => void;
}

function toIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function Calendar({ value, onChange, onClear }: CalendarProps) {
  const selected = value ? new Date(`${value}T00:00:00`) : null;
  const [viewDate, setViewDate] = useState(() => (selected && !Number.isNaN(selected.getTime()) ? selected : new Date()));

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const today = new Date();

  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const cells: { date: Date; current: boolean }[] = [];
  for (let i = firstWeekday - 1; i >= 0; i--) {
    cells.push({ date: new Date(year, month - 1, daysInPrevMonth - i), current: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: new Date(year, month, d), current: true });
  }
  let nextDay = 1;
  while (cells.length < 42) {
    cells.push({ date: new Date(year, month + 1, nextDay++), current: false });
  }

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.headerText}>
          {MONTHS[month]}, {year}
        </Text>
        <View style={styles.headerArrows}>
          <Pressable hitSlop={8} onPress={() => setViewDate(new Date(year, month - 1, 1))}>
            <Ionicons name="chevron-up" size={18} color={colors.textMuted} />
          </Pressable>
          <Pressable hitSlop={8} onPress={() => setViewDate(new Date(year, month + 1, 1))}>
            <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
          </Pressable>
        </View>
      </View>

      <View style={styles.weekRow}>
        {WEEKDAYS.map((w) => (
          <Text key={w} style={styles.weekday}>
            {w}
          </Text>
        ))}
      </View>

      <View style={styles.grid}>
        {cells.map((cell, i) => {
          const isSelected = !!selected && isSameDay(cell.date, selected);
          const isToday = isSameDay(cell.date, today);
          return (
            <Pressable
              key={i}
              style={[styles.dayCell, isSelected && styles.dayCellSelected]}
              onPress={() => onChange(toIso(cell.date))}
            >
              <Text
                style={[
                  styles.dayText,
                  !cell.current && styles.dayTextMuted,
                  isToday && !isSelected && styles.dayTextToday,
                  isSelected && styles.dayTextSelected,
                ]}
              >
                {cell.date.getDate()}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.footer}>
        <Pressable
          onPress={() => {
            onClear?.();
          }}
        >
          <Text style={styles.footerLink}>Clear</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            setViewDate(today);
            onChange(toIso(today));
          }}
        >
          <Text style={styles.footerLink}>Today</Text>
        </Pressable>
      </View>
    </View>
  );
}

const CELL_SIZE = 34;

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: spacing.md,
    width: CELL_SIZE * 7 + spacing.md * 2,
  },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.sm },
  headerText: { fontSize: scaleFont(14), fontWeight: "700", color: colors.text },
  headerArrows: { flexDirection: "row", gap: spacing.md },
  weekRow: { flexDirection: "row" },
  weekday: { width: CELL_SIZE, textAlign: "center", fontSize: scaleFont(11), color: colors.textMuted, fontWeight: "600" },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  dayCell: { width: CELL_SIZE, height: CELL_SIZE, alignItems: "center", justifyContent: "center", borderRadius: radii.pill },
  dayCellSelected: { backgroundColor: colors.primary },
  dayText: { fontSize: scaleFont(13), color: colors.text },
  dayTextMuted: { color: colors.textMuted, opacity: 0.5 },
  dayTextToday: { color: colors.accent, fontWeight: "700" },
  dayTextSelected: { color: colors.onPrimary, fontWeight: "700" },
  footer: { flexDirection: "row", justifyContent: "space-between", marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  footerLink: { color: colors.accent, fontWeight: "600", fontSize: scaleFont(13) },
});
