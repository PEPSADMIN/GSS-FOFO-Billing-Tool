import { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Button, ModalHeader } from "./ui";
import { DateField } from "./DateField";
import { colors, radii, scaleFont, spacing } from "../lib/theme";

interface DateRangeModalProps {
  visible: boolean;
  from: string;
  to: string;
  onApply: (from: string, to: string) => void;
  onClose: () => void;
  title?: string;
}

export function DateRangeModal({ visible, from, to, onApply, onClose, title = "Filter by date" }: DateRangeModalProps) {
  const [draftFrom, setDraftFrom] = useState(from);
  const [draftTo, setDraftTo] = useState(to);

  useEffect(() => {
    setDraftFrom(from);
    setDraftTo(to);
  }, [visible, from, to]);

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <ModalHeader title={title} onClose={onClose} />

          <Text style={styles.fieldLabel}>From</Text>
          <DateField value={draftFrom} onChange={setDraftFrom} placeholder="Any" />

          <Text style={[styles.fieldLabel, { marginTop: spacing.sm }]}>To</Text>
          <DateField value={draftTo} onChange={setDraftTo} placeholder="Any" />

          <View style={styles.actions}>
            <Pressable
              onPress={() => {
                setDraftFrom("");
                setDraftTo("");
                onApply("", "");
              }}
            >
              <Text style={styles.cancelLink}>Clear</Text>
            </Pressable>
            <Pressable onPress={onClose}>
              <Text style={styles.cancelLink}>Cancel</Text>
            </Pressable>
            <Button label="Apply" variant="secondary" onPress={() => onApply(draftFrom, draftTo)} style={styles.applyButton} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(2,6,16,0.7)", justifyContent: "flex-end" },
  card: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
  },
  fieldLabel: { fontSize: scaleFont(13), fontWeight: "600", color: colors.text, marginBottom: 6 },
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: spacing.lg, marginTop: spacing.lg, alignItems: "center" },
  cancelLink: { color: colors.textMuted, fontWeight: "600" },
  applyButton: { paddingHorizontal: spacing.xl },
});
