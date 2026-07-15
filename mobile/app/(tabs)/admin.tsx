import { useCallback, useEffect, useState } from "react";
import { FlatList, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { TAB_KEYS, type AuditLogEntryDTO, type Role, type RoleDTO, type TabKey, type UserDTO } from "@gss/shared";
import { useAuth } from "../../lib/auth-context";
import { api, ApiError } from "../../lib/api";
import { Badge, Button, Input, ModalHeader, Screen } from "../../components/ui";
import { showAlert } from "../../lib/alert";
import { colors, radii, scaleFont, spacing, typography } from "../../lib/theme";

const SYSTEM_ROLES: Role[] = ["OWNER", "ADMIN", "CASHIER"];

const TAB_LABELS: Record<TabKey, string> = {
  home: "Home",
  dashboard: "Dashboard",
  billing: "Billing",
  invoices: "Invoices",
  customers: "Customers",
  items: "Items",
  reports: "Reports",
  admin: "Admin",
};

export default function AdminScreen() {
  const { auth } = useAuth();
  const [tab, setTab] = useState<"users" | "roles" | "audit">("users");
  const [users, setUsers] = useState<UserDTO[]>([]);
  const [roles, setRoles] = useState<RoleDTO[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [addUserVisible, setAddUserVisible] = useState(false);
  const [addRoleVisible, setAddRoleVisible] = useState(false);
  const [editingUser, setEditingUser] = useState<UserDTO | null>(null);
  const isOwner = auth?.user.role === "OWNER";

  const load = useCallback(() => {
    if (!auth) return;
    setRefreshing(true);
    Promise.all([api.users.list(auth.token), api.roles.list(auth.token)])
      .then(([u, r]) => {
        setUsers(u);
        setRoles(r);
      })
      .catch(() => {
        setUsers([]);
        setRoles([]);
      })
      .finally(() => setRefreshing(false));
  }, [auth]);

  useEffect(load, [load]);

  return (
    <Screen style={styles.container}>
      <View style={styles.tabRow}>
        <Pressable onPress={() => setTab("users")} style={[styles.tabBtn, tab === "users" && styles.tabBtnActive]}>
          <Text style={[styles.tabBtnText, tab === "users" && styles.tabBtnTextActive]}>Users</Text>
        </Pressable>
        <Pressable onPress={() => setTab("roles")} style={[styles.tabBtn, tab === "roles" && styles.tabBtnActive]}>
          <Text style={[styles.tabBtnText, tab === "roles" && styles.tabBtnTextActive]}>Custom roles</Text>
        </Pressable>
        {isOwner && (
          <Pressable onPress={() => setTab("audit")} style={[styles.tabBtn, tab === "audit" && styles.tabBtnActive]}>
            <Text style={[styles.tabBtnText, tab === "audit" && styles.tabBtnTextActive]}>Audit log</Text>
          </Pressable>
        )}
      </View>

      {tab === "audit" ? (
        <AuditLogTab />
      ) : tab === "users" ? (
        <FlatList
          data={users}
          keyExtractor={(u) => u.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={colors.accent} />}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <Button label="+ Create user" onPress={() => setAddUserVisible(true)} style={{ marginBottom: spacing.md }} />
          }
          ListEmptyComponent={<Text style={styles.empty}>No users yet</Text>}
          renderItem={({ item }) => (
            <Pressable style={styles.row} onPress={() => setEditingUser(item)}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.meta}>
                  {item.phone} · {item.customRole ? item.customRole.name : item.role}
                </Text>
              </View>
              <Badge label={item.active ? "Active" : "Disabled"} tone={item.active ? "success" : "danger"} />
            </Pressable>
          )}
        />
      ) : (
        <FlatList
          data={roles}
          keyExtractor={(r) => r.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={colors.accent} />}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <Button label="+ Create role" onPress={() => setAddRoleVisible(true)} style={{ marginBottom: spacing.md }} />
          }
          ListEmptyComponent={<Text style={styles.empty}>No custom roles yet — users can still use the built-in OWNER/ADMIN/CASHIER roles</Text>}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.meta}>{item.tabs.map((t) => TAB_LABELS[t]).join(", ")}</Text>
              </View>
            </View>
          )}
        />
      )}

      <CreateUserModal
        visible={addUserVisible}
        roles={roles}
        onClose={() => setAddUserVisible(false)}
        onCreated={() => {
          setAddUserVisible(false);
          load();
        }}
      />
      <CreateRoleModal
        visible={addRoleVisible}
        onClose={() => setAddRoleVisible(false)}
        onCreated={() => {
          setAddRoleVisible(false);
          load();
        }}
      />
      {editingUser && (
        <EditUserModal
          user={editingUser}
          roles={roles}
          onClose={() => setEditingUser(null)}
          onSaved={() => {
            setEditingUser(null);
            load();
          }}
        />
      )}
    </Screen>
  );
}

const AUDIT_ACTION_TONES: Record<string, "primary" | "success" | "warning" | "danger"> = {
  CREATE: "success",
  UPDATE: "primary",
  DELETE: "danger",
  BULK_DELETE: "danger",
  RESTORE: "warning",
};

function AuditLogTab() {
  const { auth } = useAuth();
  const [entries, setEntries] = useState<AuditLogEntryDTO[]>([]);
  const [entityType, setEntityType] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!auth) return;
    setLoading(true);
    api.auditLog
      .list(auth.token, { entityType, pageSize: 100 })
      .then((res) => setEntries(res.data))
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, [auth, entityType]);

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.tabPicker}>
        {[undefined, "Customer", "Item", "Invoice"].map((type) => (
          <Pressable
            key={type ?? "all"}
            onPress={() => setEntityType(type)}
            style={[styles.tabChip, entityType === type && styles.tabChipActive]}
          >
            <Text style={[styles.tabChipText, entityType === type && styles.tabChipTextActive]}>{type ?? "All"}</Text>
          </Pressable>
        ))}
      </View>
      <FlatList
        data={entries}
        keyExtractor={(e) => e.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => {}} tintColor={colors.accent} />}
        ListEmptyComponent={<Text style={styles.empty}>No activity recorded yet</Text>}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{item.summary}</Text>
              <Text style={styles.meta}>
                {item.userName} · {new Date(item.createdAt).toLocaleString()}
              </Text>
            </View>
            <Badge label={item.action.replace("_", " ")} tone={AUDIT_ACTION_TONES[item.action] ?? "primary"} />
          </View>
        )}
      />
    </View>
  );
}

function RoleTabPicker({ selected, onToggle }: { selected: TabKey[]; onToggle: (tab: TabKey) => void }) {
  return (
    <View style={styles.tabPicker}>
      {TAB_KEYS.map((t) => {
        const active = selected.includes(t);
        return (
          <Pressable key={t} onPress={() => onToggle(t)} style={[styles.tabChip, active && styles.tabChipActive]}>
            <Text style={[styles.tabChipText, active && styles.tabChipTextActive]}>{TAB_LABELS[t]}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function CreateRoleModal({ visible, onClose, onCreated }: { visible: boolean; onClose: () => void; onCreated: () => void }) {
  const { auth } = useAuth();
  const [name, setName] = useState("");
  const [tabs, setTabs] = useState<TabKey[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(tab: TabKey) {
    setTabs((prev) => (prev.includes(tab) ? prev.filter((t) => t !== tab) : [...prev, tab]));
  }

  async function submit() {
    if (!auth) return;
    if (!name.trim()) {
      showAlert("Missing information", "Kindly fill the respective Role Name field to continue.");
      return;
    }
    if (tabs.length === 0) {
      showAlert("Missing information", "Kindly select at least one Tab for this role to continue.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await api.roles.create(auth.token, { name: name.trim(), tabs });
      setName("");
      setTabs([]);
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create role");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <ScrollView style={styles.modalCard}>
          <ModalHeader title="Create custom role" onClose={onClose} />
          <Input placeholder="Role name (e.g. Inventory Manager)" value={name} onChangeText={setName} />
          <Text style={styles.label}>Tabs this role can access</Text>
          <RoleTabPicker selected={tabs} onToggle={toggle} />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.modalActions}>
            <Pressable onPress={onClose}>
              <Text style={styles.cancelLink}>Cancel</Text>
            </Pressable>
            <Button label="Create" loading={submitting} onPress={submit} style={styles.saveButton} />
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

function CreateUserModal({
  visible,
  roles,
  onClose,
  onCreated,
}: {
  visible: boolean;
  roles: RoleDTO[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const { auth } = useAuth();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("CASHIER");
  const [customRoleId, setCustomRoleId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!auth) return;
    if (!name.trim()) {
      showAlert("Missing information", "Kindly fill the respective Name field to continue.");
      return;
    }
    if (!phone.trim()) {
      showAlert("Missing information", "Kindly fill the respective Phone field to continue.");
      return;
    }
    if (password.length < 6) {
      showAlert("Missing information", "Kindly fill the respective Password field (min 6 characters) to continue.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await api.users.create(auth.token, {
        name: name.trim(),
        phone: phone.trim(),
        password,
        role,
        customRoleId: customRoleId ?? undefined,
      });
      setName("");
      setPhone("");
      setPassword("");
      setCustomRoleId(null);
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create user");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <ScrollView style={styles.modalCard}>
          <ModalHeader title="Create user" onClose={onClose} />
          <Input placeholder="Name *" value={name} onChangeText={setName} />
          <Input placeholder="Phone *" keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
          <Input placeholder="Password (min 6 chars) *" secureTextEntry value={password} onChangeText={setPassword} />

          <Text style={styles.label}>Base role</Text>
          <View style={styles.tabPicker}>
            {SYSTEM_ROLES.map((r) => (
              <Pressable key={r} onPress={() => setRole(r)} style={[styles.tabChip, role === r && styles.tabChipActive]}>
                <Text style={[styles.tabChipText, role === r && styles.tabChipTextActive]}>{r}</Text>
              </Pressable>
            ))}
          </View>

          {roles.length > 0 ? (
            <>
              <Text style={styles.label}>Or assign a custom role (overrides base role's tabs)</Text>
              <View style={styles.tabPicker}>
                <Pressable onPress={() => setCustomRoleId(null)} style={[styles.tabChip, !customRoleId && styles.tabChipActive]}>
                  <Text style={[styles.tabChipText, !customRoleId && styles.tabChipTextActive]}>None</Text>
                </Pressable>
                {roles.map((r) => (
                  <Pressable
                    key={r.id}
                    onPress={() => setCustomRoleId(r.id)}
                    style={[styles.tabChip, customRoleId === r.id && styles.tabChipActive]}
                  >
                    <Text style={[styles.tabChipText, customRoleId === r.id && styles.tabChipTextActive]}>{r.name}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          ) : null}

          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.modalActions}>
            <Pressable onPress={onClose}>
              <Text style={styles.cancelLink}>Cancel</Text>
            </Pressable>
            <Button label="Create" loading={submitting} onPress={submit} style={styles.saveButton} />
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

function EditUserModal({
  user,
  roles,
  onClose,
  onSaved,
}: {
  user: UserDTO;
  roles: RoleDTO[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { auth } = useAuth();
  const [role, setRole] = useState<Role>(user.role);
  const [customRoleId, setCustomRoleId] = useState<string | null>(user.customRoleId ?? null);
  const [active, setActive] = useState(user.active);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [resetPwVisible, setResetPwVisible] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [resettingPw, setResettingPw] = useState(false);

  async function submit() {
    if (!auth) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.users.update(auth.token, user.id, { role, customRoleId, active });
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update user");
    } finally {
      setSubmitting(false);
    }
  }

  async function resetPassword() {
    if (!auth) return;
    if (newPassword.length < 6) {
      showAlert("Invalid", "New password must be at least 6 characters.");
      return;
    }
    setResettingPw(true);
    try {
      await api.users.update(auth.token, user.id, { password: newPassword });
      setNewPassword("");
      setResetPwVisible(false);
      showAlert("Done", `Password for ${user.name} has been reset.`);
    } catch (err) {
      showAlert("Failed", err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setResettingPw(false);
    }
  }

  return (
    <Modal visible animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <ScrollView style={styles.modalCard}>
          <ModalHeader title={user.name} onClose={onClose} />
          <Text style={styles.meta}>{user.phone}</Text>

          <Text style={styles.label}>Base role</Text>
          <View style={styles.tabPicker}>
            {SYSTEM_ROLES.map((r) => (
              <Pressable key={r} onPress={() => setRole(r)} style={[styles.tabChip, role === r && styles.tabChipActive]}>
                <Text style={[styles.tabChipText, role === r && styles.tabChipTextActive]}>{r}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Custom role override</Text>
          <View style={styles.tabPicker}>
            <Pressable onPress={() => setCustomRoleId(null)} style={[styles.tabChip, !customRoleId && styles.tabChipActive]}>
              <Text style={[styles.tabChipText, !customRoleId && styles.tabChipTextActive]}>None</Text>
            </Pressable>
            {roles.map((r) => (
              <Pressable
                key={r.id}
                onPress={() => setCustomRoleId(r.id)}
                style={[styles.tabChip, customRoleId === r.id && styles.tabChipActive]}
              >
                <Text style={[styles.tabChipText, customRoleId === r.id && styles.tabChipTextActive]}>{r.name}</Text>
              </Pressable>
            ))}
          </View>

          <Pressable style={styles.activeRow} onPress={() => setActive((a) => !a)}>
            <Switch value={active} onValueChange={setActive} trackColor={{ false: colors.surfaceAlt, true: colors.primary }} />
            <Text style={styles.meta}>Account active</Text>
          </Pressable>

          <Pressable onPress={() => setResetPwVisible((v) => !v)} style={styles.resetPwToggle}>
            <Ionicons name={resetPwVisible ? "chevron-up-outline" : "key-outline"} size={14} color={colors.accent} />
            <Text style={styles.resetPwToggleText}>Reset password</Text>
          </Pressable>
          {resetPwVisible && (
            <View style={styles.resetPwBox}>
              <Input
                placeholder="New password (min 6 chars)"
                secureTextEntry
                value={newPassword}
                onChangeText={setNewPassword}
              />
              <Button label="Set New Password" variant="secondary" loading={resettingPw} onPress={resetPassword} />
            </View>
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.modalActions}>
            <Pressable onPress={onClose}>
              <Text style={styles.cancelLink}>Close</Text>
            </Pressable>
            <Button label="Save" loading={submitting} onPress={submit} style={styles.saveButton} />
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  tabRow: { flexDirection: "row", gap: spacing.sm, padding: spacing.lg, paddingBottom: spacing.sm },
  tabBtn: {
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  tabBtnActive: { backgroundColor: colors.surface, borderColor: colors.accent },
  tabBtnText: { color: colors.textMuted, fontWeight: "600", fontSize: scaleFont(13) },
  tabBtnTextActive: { color: colors.accent },
  listContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  name: { ...typography.body, fontWeight: "600" },
  meta: { fontSize: scaleFont(13), color: colors.textMuted, marginTop: 2 },
  empty: { textAlign: "center", color: colors.textMuted, marginTop: 40, paddingHorizontal: spacing.lg },
  modalOverlay: { flex: 1, backgroundColor: "rgba(2,6,16,0.7)", justifyContent: "flex-end" },
  modalCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    maxHeight: "85%",
  },
  modalTitle: { ...typography.heading, marginBottom: spacing.md },
  label: { ...typography.label, marginTop: spacing.md, marginBottom: spacing.sm },
  tabPicker: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  tabChip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  tabChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabChipText: { fontSize: scaleFont(12), color: colors.textMuted },
  tabChipTextActive: { color: colors.onPrimary },
  activeRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.lg },
  error: { color: colors.danger, marginTop: spacing.sm },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: spacing.lg, marginTop: spacing.lg, alignItems: "center" },
  cancelLink: { color: colors.textMuted, fontWeight: "600", marginTop: spacing.md },
  saveButton: { paddingHorizontal: spacing.xl },
  resetPwToggle: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: spacing.md, paddingVertical: 4 },
  resetPwToggleText: { color: colors.accent, fontWeight: "600", fontSize: scaleFont(13) },
  resetPwBox: { marginTop: spacing.sm, gap: spacing.sm },
});
