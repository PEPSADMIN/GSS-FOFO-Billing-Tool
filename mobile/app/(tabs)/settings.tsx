import { useEffect, useState } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  THEME_PALETTES,
  FONT_SCALES,
  LANGUAGES,
  CUSTOM_THEME_ID,
  COMMON_COLOR_SWATCHES,
  isValidHexColor,
  type FontScaleId,
  type TranslationKey,
} from "@gss/shared";
import { useAuth } from "../../lib/auth-context";
import { api, ApiError } from "../../lib/api";
import { showAlert } from "../../lib/alert";
import { Button, Input, Screen, SectionHeader } from "../../components/ui";
import { colors, radii, scaleFont, spacing } from "../../lib/theme";

const FONT_SIZE_KEYS: Record<FontScaleId, TranslationKey> = {
  small: "fontSize_small",
  medium: "fontSize_medium",
  large: "fontSize_large",
  xlarge: "fontSize_xlarge",
};

export default function SettingsScreen() {
  const { auth, t, updateUserPreferences } = useAuth();
  const [savingTheme, setSavingTheme] = useState(false);
  const [savingFont, setSavingFont] = useState(false);
  const [savingLanguage, setSavingLanguage] = useState(false);
  const [savingCustom, setSavingCustom] = useState(false);

  const [customPickerOpen, setCustomPickerOpen] = useState(auth?.user.themeId === CUSTOM_THEME_ID);
  const [customBg, setCustomBg] = useState(auth?.user.customBackground ?? "#0F172A");
  const [customText, setCustomText] = useState(auth?.user.customTextColor ?? "#F8FAFC");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  const isOwner = auth?.user.role === "OWNER";
  const [loadingOutlet, setLoadingOutlet] = useState(false);
  const [savingOutlet, setSavingOutlet] = useState(false);
  const [outletName, setOutletName] = useState("");
  const [outletGstin, setOutletGstin] = useState("");
  const [outletPan, setOutletPan] = useState("");
  const [outletCinNo, setOutletCinNo] = useState("");
  const [outletAddress, setOutletAddress] = useState("");
  const [outletRegnAddress, setOutletRegnAddress] = useState("");
  const [outletCity, setOutletCity] = useState("");
  const [outletPincode, setOutletPincode] = useState("");
  const [outletPhone, setOutletPhone] = useState("");
  const [outletBankName, setOutletBankName] = useState("");
  const [outletBankAccountNo, setOutletBankAccountNo] = useState("");
  const [outletBankIfscCode, setOutletBankIfscCode] = useState("");

  const GST_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[0-9A-Z]{1}[A-Z]{1}[0-9A-Z]{1}$/;
  const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

  useEffect(() => {
    if (!auth) return;
    setLoadingOutlet(true);
    api.outlet
      .get(auth.token)
      .then((o) => {
        setOutletName(o.name);
        setOutletGstin(o.gstin);
        setOutletPan(o.panCode ?? "");
        setOutletCinNo(o.cinNo ?? "");
        setOutletAddress(o.addressLine);
        setOutletRegnAddress(o.regnAddress ?? "");
        setOutletCity(o.city);
        setOutletPincode(o.pincode);
        setOutletPhone(o.phone ?? "");
        setOutletBankName(o.bankName ?? "");
        setOutletBankAccountNo(o.bankAccountNo ?? "");
        setOutletBankIfscCode(o.bankIfscCode ?? "");
      })
      .catch(() => {})
      .finally(() => setLoadingOutlet(false));
  }, [auth]);

  async function saveOutlet() {
    if (!auth) return;
    if (!outletName.trim()) {
      showAlert("Missing information", "Kindly fill the respective Business Name field to continue.");
      return;
    }
    const gstin = outletGstin.trim().toUpperCase();
    if (!gstin || !GST_REGEX.test(gstin)) {
      showAlert("Invalid GST No.", "Kindly enter a valid 15-character GSTIN (e.g., 33AABCP9569P1ZM). GST registration is mandatory under Indian law.");
      return;
    }
    const pan = outletPan.trim().toUpperCase();
    if (!pan || !PAN_REGEX.test(pan)) {
      showAlert("Invalid PAN", "Kindly enter a valid 10-character PAN (e.g., AABCP9569P). PAN is mandatory under Indian law.");
      return;
    }
    if (!outletAddress.trim() || !outletCity.trim()) {
      showAlert("Missing information", "Kindly fill the respective Address and City fields to continue.");
      return;
    }
    setSavingOutlet(true);
    try {
      await api.outlet.update(auth.token, {
        name: outletName.trim(),
        gstin,
        panCode: pan,
        cinNo: outletCinNo.trim().toUpperCase() || undefined,
        addressLine: outletAddress.trim(),
        regnAddress: outletRegnAddress.trim() || undefined,
        city: outletCity.trim(),
        pincode: outletPincode.trim(),
        phone: outletPhone.trim() || undefined,
        bankName: outletBankName.trim() || undefined,
        bankAccountNo: outletBankAccountNo.trim() || undefined,
        bankIfscCode: outletBankIfscCode.trim().toUpperCase() || undefined,
      });
      showAlert("Saved", "Your business details have been updated.");
    } catch (err) {
      showAlert("Failed to save", err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    } finally {
      setSavingOutlet(false);
    }
  }

  if (!auth) return null;

  const activeThemeId = auth.user.themeId ?? "royal-gold";
  const activeFontScale = auth.user.fontScale ?? 1.0;
  const activeLanguage = auth.user.languageCode ?? "en";

  function notifyRestart() {
    if (Platform.OS === "web") {
      window.location.reload();
    } else {
      showAlert("Saved", "Restart the app to see this change everywhere — colors and text size are baked into each screen at startup.");
    }
  }

  async function selectTheme(themeId: string) {
    if (!auth || themeId === activeThemeId) return;
    setSavingTheme(true);
    try {
      const updated = await api.me.updatePreferences(auth.token, { themeId });
      await updateUserPreferences(updated);
      notifyRestart();
    } catch (err) {
      showAlert("Failed to save", err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    } finally {
      setSavingTheme(false);
    }
  }

  async function applyCustomTheme() {
    if (!auth) return;
    if (!isValidHexColor(customBg)) {
      showAlert("Invalid color", "Kindly enter a valid background hex color like #112233.");
      return;
    }
    if (!isValidHexColor(customText)) {
      showAlert("Invalid color", "Kindly enter a valid font hex color like #F8FAFC.");
      return;
    }
    setSavingCustom(true);
    try {
      const updated = await api.me.updatePreferences(auth.token, {
        themeId: CUSTOM_THEME_ID,
        customBackground: customBg,
        customTextColor: customText,
      });
      await updateUserPreferences(updated);
      notifyRestart();
    } catch (err) {
      showAlert("Failed to save", err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    } finally {
      setSavingCustom(false);
    }
  }

  async function selectFontScale(id: FontScaleId, scale: number) {
    if (!auth || scale === activeFontScale) return;
    setSavingFont(true);
    try {
      const updated = await api.me.updatePreferences(auth.token, { fontScale: scale });
      await updateUserPreferences(updated);
      notifyRestart();
    } catch (err) {
      showAlert("Failed to save", err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    } finally {
      setSavingFont(false);
    }
  }

  async function selectLanguage(code: string) {
    if (!auth || code === activeLanguage) return;
    setSavingLanguage(true);
    try {
      const updated = await api.me.updatePreferences(auth.token, { languageCode: code });
      await updateUserPreferences(updated);
    } catch (err) {
      showAlert("Failed to save", err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    } finally {
      setSavingLanguage(false);
    }
  }

  async function submitPasswordChange() {
    if (!auth) return;
    if (!currentPassword.trim()) {
      showAlert("Missing information", `Kindly fill the respective ${t("settings_currentPassword")} field to continue.`);
      return;
    }
    if (newPassword.length < 6) {
      showAlert("Missing information", `Kindly fill the respective ${t("settings_newPassword")} field (min 6 characters) to continue.`);
      return;
    }
    if (newPassword !== confirmPassword) {
      showAlert("Passwords don't match", "The new password and confirmation do not match.");
      return;
    }
    setChangingPassword(true);
    try {
      await api.me.changePassword(auth.token, { currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      showAlert("Success", "Your password has been changed.");
    } catch (err) {
      showAlert("Failed to change password", err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    } finally {
      setChangingPassword(false);
    }
  }

  return (
    <Screen style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <SectionHeader label="Business Details" icon="business-outline" />
        {loadingOutlet ? (
          <ActivityIndicator color={colors.accent} style={{ marginBottom: spacing.md }} />
        ) : (
          <>
            <Text style={styles.fieldLabel}>Business Name <Text style={styles.required}>*</Text></Text>
            <Input value={outletName} onChangeText={setOutletName} editable={isOwner} placeholder="Business Name" />

            <Text style={styles.fieldLabel}>GST No. <Text style={styles.required}>*</Text></Text>
            <Text style={styles.mandatoryNote}>Mandatory under Indian GST law (CGST Act 2017)</Text>
            <Input
              value={outletGstin}
              onChangeText={(v) => setOutletGstin(v.toUpperCase())}
              editable={isOwner}
              autoCapitalize="characters"
              placeholder="33AABCP9569P1ZM"
            />

            <Text style={styles.fieldLabel}>PAN No. <Text style={styles.required}>*</Text></Text>
            <Text style={styles.mandatoryNote}>Mandatory under Income Tax Act 1961</Text>
            <Input
              value={outletPan}
              onChangeText={(v) => setOutletPan(v.toUpperCase())}
              editable={isOwner}
              autoCapitalize="characters"
              placeholder="AABCP9569P"
            />

            <Text style={styles.fieldLabel}>Address</Text>
            <Input value={outletAddress} onChangeText={setOutletAddress} editable={isOwner} placeholder="Address" />

            <Text style={styles.fieldLabel}>City</Text>
            <Input value={outletCity} onChangeText={setOutletCity} editable={isOwner} placeholder="City" />

            <Text style={styles.fieldLabel}>Pincode</Text>
            <Input
              value={outletPincode}
              onChangeText={setOutletPincode}
              editable={isOwner}
              keyboardType="number-pad"
              placeholder="641407"
            />

            <Text style={styles.fieldLabel}>Phone</Text>
            <Input value={outletPhone} onChangeText={setOutletPhone} editable={isOwner} keyboardType="phone-pad" placeholder="Phone" />

            <Text style={styles.fieldLabel}>CIN No. <Text style={styles.helperText}>(Company Identity Number for PDF)</Text></Text>
            <Input value={outletCinNo} onChangeText={(v) => setOutletCinNo(v.toUpperCase())} editable={isOwner} autoCapitalize="characters" placeholder="U52190KA1991PTC012623" />

            <Text style={styles.fieldLabel}>Registered Office Address <Text style={styles.helperText}>(for PDF header)</Text></Text>
            <Input value={outletRegnAddress} onChangeText={setOutletRegnAddress} editable={isOwner} placeholder="Regd. Office & Works address" />

            <Text style={styles.fieldLabel}>Bank Name</Text>
            <Input value={outletBankName} onChangeText={setOutletBankName} editable={isOwner} placeholder="e.g. HDFC Bank" />

            <Text style={styles.fieldLabel}>Bank Account No.</Text>
            <Input value={outletBankAccountNo} onChangeText={setOutletBankAccountNo} editable={isOwner} keyboardType="number-pad" placeholder="Account number" />

            <Text style={styles.fieldLabel}>IFSC Code</Text>
            <Input value={outletBankIfscCode} onChangeText={(v) => setOutletBankIfscCode(v.toUpperCase())} editable={isOwner} autoCapitalize="characters" placeholder="HDFC0001234" />

            {isOwner ? (
              <Button label="Save Business Details" variant="secondary" loading={savingOutlet} onPress={saveOutlet} />
            ) : (
              <Text style={styles.helperText}>Only the outlet owner can edit these details.</Text>
            )}
          </>
        )}

        <SectionHeader label={t("settings_theme")} icon="color-palette-outline" />
        <View style={styles.swatchRow}>
          {THEME_PALETTES.map((palette) => (
            <Pressable
              key={palette.id}
              onPress={() => selectTheme(palette.id)}
              disabled={savingTheme}
              style={[styles.swatch, { backgroundColor: palette.colors.primary }, activeThemeId === palette.id && styles.swatchActive]}
            >
              {activeThemeId === palette.id ? <View style={styles.swatchDot} /> : null}
            </Pressable>
          ))}
          <Pressable
            onPress={() => setCustomPickerOpen((open) => !open)}
            style={[styles.swatch, styles.customSwatch, activeThemeId === CUSTOM_THEME_ID && styles.swatchActive]}
          >
            <Ionicons name="color-wand-outline" size={18} color={colors.text} />
          </Pressable>
        </View>
        <Text style={styles.helperText}>
          {activeThemeId === CUSTOM_THEME_ID ? "Custom" : THEME_PALETTES.find((p) => p.id === activeThemeId)?.name ?? ""}
          {Platform.OS !== "web" ? " — changes apply after restarting the app." : ""}
        </Text>

        {customPickerOpen && (
          <View style={styles.customBox}>
            <Text style={styles.fieldLabel}>Background Color</Text>
            <View style={styles.swatchRowSmall}>
              {COMMON_COLOR_SWATCHES.map((hex) => (
                <Pressable
                  key={`bg-${hex}`}
                  onPress={() => setCustomBg(hex)}
                  style={[styles.smallSwatch, { backgroundColor: hex }, customBg === hex && styles.smallSwatchActive]}
                />
              ))}
            </View>
            <Input placeholder="#0F172A" value={customBg} onChangeText={setCustomBg} autoCapitalize="none" />

            <Text style={styles.fieldLabel}>Font Color</Text>
            <View style={styles.swatchRowSmall}>
              {COMMON_COLOR_SWATCHES.map((hex) => (
                <Pressable
                  key={`text-${hex}`}
                  onPress={() => setCustomText(hex)}
                  style={[styles.smallSwatch, { backgroundColor: hex }, customText === hex && styles.smallSwatchActive]}
                />
              ))}
            </View>
            <Input placeholder="#F8FAFC" value={customText} onChangeText={setCustomText} autoCapitalize="none" />

            <View style={[styles.previewBox, { backgroundColor: customBg }]}>
              <Text style={{ color: customText, fontWeight: "700" }}>Preview text</Text>
            </View>

            <Button label="Apply Custom Theme" variant="secondary" loading={savingCustom} onPress={applyCustomTheme} />
          </View>
        )}

        <SectionHeader label={t("settings_fontSize")} icon="text-outline" />
        <View style={styles.chipRow}>
          {FONT_SCALES.map((f) => (
            <Pressable
              key={f.id}
              onPress={() => selectFontScale(f.id, f.scale)}
              disabled={savingFont}
              style={[styles.chip, activeFontScale === f.scale && styles.chipActive]}
            >
              <Text style={[styles.chipText, activeFontScale === f.scale && styles.chipTextActive]}>{t(FONT_SIZE_KEYS[f.id])}</Text>
            </Pressable>
          ))}
        </View>

        <SectionHeader label={t("settings_language")} icon="language-outline" />
        <View style={styles.chipRow}>
          {LANGUAGES.map((lang) => (
            <Pressable
              key={lang.code}
              onPress={() => selectLanguage(lang.code)}
              disabled={savingLanguage}
              style={[styles.chip, activeLanguage === lang.code && styles.chipActive]}
            >
              <Text style={[styles.chipText, activeLanguage === lang.code && styles.chipTextActive]}>{lang.nativeName}</Text>
            </Pressable>
          ))}
        </View>

        <SectionHeader label={t("settings_changePassword")} icon="lock-closed-outline" />
        <Input
          placeholder={t("settings_currentPassword")}
          secureTextEntry
          value={currentPassword}
          onChangeText={setCurrentPassword}
        />
        <Input placeholder={t("settings_newPassword")} secureTextEntry value={newPassword} onChangeText={setNewPassword} />
        <Input
          placeholder={t("settings_confirmPassword")}
          secureTextEntry
          value={confirmPassword}
          onChangeText={setConfirmPassword}
        />
        <Button label={t("settings_saveChanges")} variant="secondary" loading={changingPassword} onPress={submitPasswordChange} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  swatchRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  swatch: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  customSwatch: { backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border },
  swatchActive: { borderColor: colors.text },
  swatchDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.white },
  helperText: { fontSize: scaleFont(12), color: colors.textMuted, marginTop: spacing.sm, marginBottom: spacing.sm },
  customBox: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  fieldLabel: { fontSize: scaleFont(13), fontWeight: "600", color: colors.text, marginBottom: 2, marginTop: spacing.sm },
  required: { color: colors.danger },
  mandatoryNote: { fontSize: scaleFont(11), color: colors.textMuted, marginBottom: 4, fontStyle: "italic" },
  swatchRowSmall: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: spacing.sm },
  smallSwatch: { width: 26, height: 26, borderRadius: radii.sm, borderWidth: 2, borderColor: "transparent" },
  smallSwatchActive: { borderColor: colors.text },
  previewBox: {
    borderRadius: radii.md,
    padding: spacing.md,
    alignItems: "center",
    marginTop: spacing.sm,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.md },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: scaleFont(13), color: colors.textMuted },
  chipTextActive: { color: colors.onPrimary, fontWeight: "700" },
});
