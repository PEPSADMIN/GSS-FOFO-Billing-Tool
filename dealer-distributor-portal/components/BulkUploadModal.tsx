import { useState } from "react";
import { Modal, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import type { BulkUploadResultDTO } from "@gss/shared";
import { Button, ModalHeader } from "./ui";
import { colors, radii, scaleFont, spacing } from "../lib/theme";

interface BulkUploadModalProps {
  visible: boolean;
  title: string;
  entityLabel: string; // e.g. "items" or "customers", used in the instructional text
  onUpload: (fileBase64: string) => Promise<BulkUploadResultDTO>;
  onClose: () => void;
  onDone: () => void; // called after closing, only if at least one row was created — refresh the list
}

export function BulkUploadModal({ visible, title, entityLabel, onUpload, onClose, onDone }: BulkUploadModalProps) {
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<BulkUploadResultDTO | null>(null);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setResult(null);
    setError(null);
    setUploading(false);
  }

  function handleClose() {
    reset();
    onClose();
  }

  function handleDone() {
    const hadSuccess = !!result && result.created > 0;
    reset();
    onClose();
    if (hadSuccess) onDone();
  }

  function pickFile() {
    // Web-only for now: an imperative DOM file input, same approach lib/download.ts already
    // uses for triggering downloads -- <input> isn't a valid React Native element.
    if (Platform.OS !== "web") return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".xlsx,.xls";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      setError(null);
      setUploading(true);
      try {
        const fileBase64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        const res = await onUpload(fileBase64);
        setResult(res);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed. Try again.");
      } finally {
        setUploading(false);
      }
    };
    input.click();
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <ModalHeader title={title} onClose={handleClose} />

          {!result ? (
            <>
              <Text style={styles.helperText}>
                Download the {entityLabel} template from Settings → Data Import, fill in your existing data, then upload the completed
                file here.
              </Text>
              {Platform.OS === "web" ? (
                <Button label="Choose File" variant="secondary" loading={uploading} onPress={pickFile} />
              ) : (
                <Text style={styles.errorText}>File upload is currently only available on the web version of the app.</Text>
              )}
              {error ? <Text style={styles.errorText}>{error}</Text> : null}
            </>
          ) : (
            <ScrollView style={styles.resultBox}>
              <Text style={styles.resultSummary}>
                {result.created} {entityLabel} created{result.skipped > 0 ? `, ${result.skipped} row(s) skipped` : ""}
              </Text>
              {result.errors.map((e, i) => (
                <Text key={i} style={styles.errorRow}>
                  Row {e.row}: {e.message}
                </Text>
              ))}
              <Button label="Done" onPress={handleDone} style={styles.doneButton} />
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(2,6,16,0.6)", justifyContent: "flex-end" },
  card: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    padding: spacing.lg,
    maxHeight: "80%",
  },
  helperText: { fontSize: scaleFont(13), color: colors.textMuted, marginBottom: spacing.md },
  errorText: { fontSize: scaleFont(12), color: colors.danger, marginTop: spacing.sm },
  resultBox: { maxHeight: 400 },
  resultSummary: { fontSize: scaleFont(15), fontWeight: "700", color: colors.text, marginBottom: spacing.sm },
  errorRow: { fontSize: scaleFont(12), color: colors.danger, marginBottom: 4 },
  doneButton: { marginTop: spacing.md },
});
