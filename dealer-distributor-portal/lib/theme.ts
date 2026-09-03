import { Platform } from "react-native";
import { THEME_PALETTES, DEFAULT_THEME_ID, DEFAULT_FONT_SCALE_ID, FONT_SCALES, CUSTOM_THEME_ID } from "@gss/shared";

const THEME_CACHE_KEY = "gss_theme_id";
const FONT_SCALE_CACHE_KEY = "gss_font_scale";
const CUSTOM_BG_CACHE_KEY = "gss_custom_bg";
const CUSTOM_TEXT_CACHE_KEY = "gss_custom_text";

// Screens style themselves with static StyleSheet.create() calls evaluated once when the JS bundle
// loads — there's no live, app-wide reactive re-theming without rewriting every screen's styling
// approach. So: on web we can read the cached choice synchronously before any module evaluates and
// instantly reload the page after a change; on native, the saved preference takes effect the next
// time the app is restarted (cacheThemePreference still persists it either way).

function readCache(key: string): string | null {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    return window.localStorage.getItem(key);
  }
  return null;
}

function readCachedThemeId(): string {
  return readCache(THEME_CACHE_KEY) || DEFAULT_THEME_ID;
}

function readCachedFontScale(): number {
  const stored = readCache(FONT_SCALE_CACHE_KEY);
  return stored ? Number(stored) : FONT_SCALES.find((f) => f.id === DEFAULT_FONT_SCALE_ID)!.scale;
}

export function cacheThemePreference(
  themeId: string,
  fontScale: number,
  customBackground?: string | null,
  customTextColor?: string | null
): void {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    window.localStorage.setItem(THEME_CACHE_KEY, themeId);
    window.localStorage.setItem(FONT_SCALE_CACHE_KEY, String(fontScale));
    if (customBackground) window.localStorage.setItem(CUSTOM_BG_CACHE_KEY, customBackground);
    if (customTextColor) window.localStorage.setItem(CUSTOM_TEXT_CACHE_KEY, customTextColor);
  }
}

// Lightens or darkens a #RRGGBB color by `amount` (-255..255) per channel — used to derive
// surface/surfaceAlt shades from a single user-picked background color.
function shade(hex: string, amount: number): string {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return hex;
  const r = Math.max(0, Math.min(255, parseInt(clean.slice(0, 2), 16) + amount));
  const g = Math.max(0, Math.min(255, parseInt(clean.slice(2, 4), 16) + amount));
  const b = Math.max(0, Math.min(255, parseInt(clean.slice(4, 6), 16) + amount));
  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

// Converts #RRGGBB to an rgba() string at the given opacity — used to derive a border color
// that contrasts against a custom background, regardless of whether it's light or dark, and to
// build web-only boxShadow strings (RNW deprecated the shadow*/elevation style props).
export function withAlpha(hex: string, alpha: number): string {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return hex;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const activeThemeId = readCachedThemeId();
const activeFontScale = readCachedFontScale();
const basePalette = THEME_PALETTES.find((p) => p.id === DEFAULT_THEME_ID) ?? THEME_PALETTES[0];

let resolvedColors = { ...basePalette.colors };

if (activeThemeId === CUSTOM_THEME_ID) {
  const customBg = readCache(CUSTOM_BG_CACHE_KEY) ?? basePalette.colors.background;
  const customText = readCache(CUSTOM_TEXT_CACHE_KEY) ?? basePalette.colors.text;
  resolvedColors = {
    ...basePalette.colors,
    background: customBg,
    surface: shade(customBg, 16),
    surfaceAlt: shade(customBg, 32),
    text: customText,
    textMuted: shade(customText, -60),
    border: withAlpha(customText, 0.25),
  };
} else {
  const palette = THEME_PALETTES.find((p) => p.id === activeThemeId);
  if (palette) resolvedColors = { ...palette.colors };
}

export const colors = resolvedColors;

export const gradients = {
  primary: [colors.primary, colors.primaryDark] as const,
  secondary: [colors.accent, colors.accentViolet] as const,
  success: ["#34D399", colors.success] as const,
  header: [colors.background, colors.surface] as const,
};

export const radii = {
  sm: 8,
  md: 10,
  lg: 16,
  pill: 999,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export function scaleFont(size: number): number {
  return Math.round(size * activeFontScale);
}

// No custom typeface is bundled — this is just an explicit sans-serif fallback stack so text never
// silently degrades to the browser's default serif font (and never inherits stray underline/italic)
// if anything upstream (an extension, a stale stylesheet) interferes with unstyled text.
export const fontFamily = Platform.select({
  web: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  default: undefined,
});
const textReset = { fontFamily, textDecorationLine: "none" as const, fontStyle: "normal" as const };

export const typography = {
  title: { ...textReset, fontSize: scaleFont(28), fontWeight: "700" as const, color: colors.text, letterSpacing: 0.3 },
  subtitle: { ...textReset, fontSize: scaleFont(14), color: colors.textMuted },
  heading: { ...textReset, fontSize: scaleFont(18), fontWeight: "700" as const, color: colors.text },
  body: { ...textReset, fontSize: scaleFont(15), color: colors.text },
  label: { ...textReset, fontSize: scaleFont(13), color: colors.textMuted, fontWeight: "600" as const },
};

// RNW deprecated the shadow*/elevation style props in favor of the CSS `boxShadow` shorthand;
// native platforms don't support boxShadow, so each platform gets its own shape here. Takes a
// color so each button variant's glow matches its own gradient instead of always glowing orange.
export function glowFor(color: string) {
  return Platform.select({
    web: { boxShadow: `0px 2px 6px ${withAlpha(color, 0.25)}` },
    default: {
      shadowColor: color,
      shadowOpacity: 0.25,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
      elevation: 4,
    },
  });
}

