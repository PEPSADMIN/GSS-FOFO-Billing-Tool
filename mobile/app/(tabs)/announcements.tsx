import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Modal, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import type { AnnouncementCategory, AnnouncementDTO } from "@gss/shared";
import { ANNOUNCEMENT_CATEGORIES, ANNOUNCEMENT_CATEGORY_LABELS } from "@gss/shared";
import { useAuth } from "../../lib/auth-context";
import { api, ApiError } from "../../lib/api";
import { Badge, Button, Input, ModalHeader, Screen, SectionHeader } from "../../components/ui";
import { showAlert, showConfirm } from "../../lib/alert";
import { colors, radii, scaleFont, spacing } from "../../lib/theme";

const CATEGORY_TONES: Record<AnnouncementCategory, "primary" | "success" | "warning" | "danger"> = {
  PRICE_CHANGE: "warning",
  DISCOUNT: "success",
  MRP_CHANGE: "danger",
  GENERAL: "primary",
};

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function AnnouncementsScreen() {
  const { auth } = useAuth();
  const [announcements, setAnnouncements] = useState<AnnouncementDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [formVisible, setFormVisible] = useState(false);

  const load = useCallback(() => {
    if (!auth) return;
    api.announcements
      .list(auth.token, { pageSize: 50 })
      .then((res) => setAnnouncements(res.data))
      .catch(() => setAnnouncements([]));
  }, [auth]);

  useEffect(() => {
    setLoading(true);
    load();
    setLoading(false);
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    load();
    setRefreshing(false);
  }

  async function deleteAnnouncement(announcement: AnnouncementDTO) {
    if (!auth) return;
    const confirmed = await showConfirm("Delete announcement", `Remove "${announcement.title}"?`, "Delete");
    if (!confirmed) return;
    try {
      await api.announcements.remove(auth.token, announcement.id);
      setAnnouncements((prev) => prev.filter((a) => a.id !== announcement.id));
    } catch (err) {
      showAlert("Failed to delete announcement", err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    }
  }

  return (
    <Screen style={styles.container}>
      <View style={styles.headerRow}>
        <SectionHeader label="Announcements" icon="megaphone-outline" />
        <Button label="+ New" variant="secondary" onPress={() => setFormVisible(true)} style={styles.newButton} />
      </View>

      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.xl }} />
      ) : (
        <FlatList
          data={announcements}
          keyExtractor={(a) => a.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <Text style={styles.empty}>No announcements yet — post price changes, discounts, or MRP updates here.</Text>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardTop}>
                <Badge label={ANNOUNCEMENT_CATEGORY_LABELS[item.category]} tone={CATEGORY_TONES[item.category]} />
                {item.canDelete && (
                  <Pressable onPress={() => deleteAnnouncement(item)} hitSlop={8}>
                    <Text style={styles.deleteLink}>Delete</Text>
                  </Pressable>
                )}
              </View>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.message}>{item.message}</Text>
              <Text style={styles.meta}>
                {item.authorName} · {timeAgo(item.createdAt)}
              </Text>
            </View>
          )}
        />
      )}

      <AnnouncementFormModal
        visible={formVisible}
        onClose={() => setFormVisible(false)}
        onPosted={(announcement) => {
          setFormVisible(false);
          setAnnouncements((prev) => [announcement, ...prev]);
        }}
      />
    </Screen>
  );
}

function AnnouncementFormModal({
  visible,
  onClose,
  onPosted,
}: {
  visible: boolean;
  onClose: () => void;
  onPosted: (announcement: AnnouncementDTO) => void;
}) {
  const { auth } = useAuth();
  const [category, setCategory] = useState<AnnouncementCategory>("GENERAL");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible) {
      setCategory("GENERAL");
      setTitle("");
      setMessage("");
    }
  }, [visible]);

  async function submit() {
    if (!auth) return;
    if (!title.trim() || !message.trim()) {
      showAlert("Missing information", "Kindly fill the respective Title and Message fields to continue.");
      return;
    }
    setSubmitting(true);
    try {
      const announcement = await api.announcements.create(auth.token, { category, title: title.trim(), message: message.trim() });
      onPosted(announcement);
    } catch (err) {
      showAlert("Failed to post announcement", err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <ModalHeader title="New announcement" onClose={onClose} />

          <Text style={styles.fieldLabel}>Category</Text>
          <View style={styles.chipRow}>
            {ANNOUNCEMENT_CATEGORIES.map((cat) => (
              <Pressable key={cat} style={[styles.chip, category === cat && styles.chipActive]} onPress={() => setCategory(cat)}>
                <Text style={[styles.chipText, category === cat && styles.chipTextActive]}>{ANNOUNCEMENT_CATEGORY_LABELS[cat]}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.fieldLabel}>Title</Text>
          <Input placeholder="e.g. Cotton Shirt price updated" value={title} onChangeText={setTitle} />

          <Text style={styles.fieldLabel}>Message</Text>
          <Input
            placeholder="e.g. New price ₹1,100 effective from today"
            value={message}
            onChangeText={setMessage}
            multiline
            numberOfLines={4}
            style={styles.messageInput}
          />

          <View style={styles.modalActions}>
            <Pressable onPress={onClose}>
              <Text style={styles.cancelLink}>Cancel</Text>
            </Pressable>
            <Button label="Post" loading={submitting} onPress={submit} style={styles.saveButton} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  newButton: { paddingHorizontal: spacing.lg },
  listContent: { padding: spacing.lg, paddingTop: spacing.sm },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.sm },
  deleteLink: { color: colors.danger, fontWeight: "600", fontSize: scaleFont(13) },
  title: { fontSize: scaleFont(16), fontWeight: "700", color: colors.text, marginBottom: 4 },
  message: { fontSize: scaleFont(14), color: colors.text, marginBottom: spacing.sm },
  meta: { fontSize: scaleFont(12), color: colors.textMuted },
  empty: { textAlign: "center", color: colors.textMuted, marginTop: spacing.xxl, paddingHorizontal: spacing.xl },
  modalOverlay: { flex: 1, backgroundColor: "rgba(2,6,16,0.7)", justifyContent: "flex-end" },
  modalCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
  },
  fieldLabel: { fontSize: scaleFont(13), fontWeight: "600", color: colors.text, marginBottom: 6, marginTop: spacing.sm },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.sm },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: scaleFont(12), color: colors.textMuted },
  chipTextActive: { color: colors.onPrimary, fontWeight: "700" },
  messageInput: { minHeight: 90, textAlignVertical: "top" },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: spacing.lg, marginTop: spacing.lg, alignItems: "center" },
  cancelLink: { color: colors.textMuted, fontWeight: "600" },
  saveButton: { paddingHorizontal: spacing.xl },
});
