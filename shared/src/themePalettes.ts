export interface ThemeColors {
  background: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  primary: string;
  primaryDark: string;
  accent: string;
  accentViolet: string;
  success: string;
  warning: string;
  danger: string;
  text: string;
  textMuted: string;
  textInverse: string;
  onPrimary: string;
  white: string;
}

export interface ThemePalette {
  id: string;
  name: string;
  colors: ThemeColors;
}

const base = {
  success: "#10B981",
  warning: "#FBBF24",
  danger: "#F87171",
  text: "#F8FAFC",
  textInverse: "#0F172A",
  onPrimary: "#FFFFFF",
  white: "#FFFFFF",
};

export const THEME_PALETTES: ThemePalette[] = [
  {
    id: "royal-gold",
    name: "Royal Gold",
    colors: { ...base, background: "#0F172A", surface: "#1E293B", surfaceAlt: "#334155", border: "rgba(255,255,255,0.15)", primary: "#F59E0B", primaryDark: "#D97706", accent: "#A855F7", accentViolet: "#9333EA", textMuted: "#D1D5DB" },
  },
  {
    id: "ocean-blue",
    name: "Ocean Blue",
    colors: { ...base, background: "#0B1220", surface: "#142033", surfaceAlt: "#1E3A5F", border: "rgba(255,255,255,0.15)", primary: "#2563EB", primaryDark: "#1D4ED8", accent: "#06B6D4", accentViolet: "#0891B2", textMuted: "#B6C2D9" },
  },
  {
    id: "emerald-green",
    name: "Emerald Green",
    colors: { ...base, background: "#0B1F17", surface: "#143226", surfaceAlt: "#1F4D38", border: "rgba(255,255,255,0.15)", primary: "#10B981", primaryDark: "#059669", accent: "#34D399", accentViolet: "#22C55E", textMuted: "#C2DED1" },
  },
  {
    id: "ruby-red",
    name: "Ruby Red",
    colors: { ...base, background: "#1A0E0E", surface: "#2B1414", surfaceAlt: "#451E1E", border: "rgba(255,255,255,0.15)", primary: "#EF4444", primaryDark: "#DC2626", accent: "#F97316", accentViolet: "#EA580C", textMuted: "#E0BFBF" },
  },
  {
    id: "midnight-purple",
    name: "Midnight Purple",
    colors: { ...base, background: "#14102B", surface: "#231B45", surfaceAlt: "#372A66", border: "rgba(255,255,255,0.15)", primary: "#8B5CF6", primaryDark: "#7C3AED", accent: "#EC4899", accentViolet: "#DB2777", textMuted: "#CBC2E0" },
  },
  {
    id: "slate-teal",
    name: "Slate Teal",
    colors: { ...base, background: "#0F1B1D", surface: "#182B2E", surfaceAlt: "#234548", border: "rgba(255,255,255,0.15)", primary: "#14B8A6", primaryDark: "#0D9488", accent: "#38BDF8", accentViolet: "#0EA5E9", textMuted: "#BFD8D6" },
  },
  {
    id: "sunset-orange",
    name: "Sunset Orange",
    colors: { ...base, background: "#1F1410", surface: "#33211A", surfaceAlt: "#4D3326", border: "rgba(255,255,255,0.15)", primary: "#F97316", primaryDark: "#EA580C", accent: "#FBBF24", accentViolet: "#F59E0B", textMuted: "#E0CBBE" },
  },
  {
    id: "rose-pink",
    name: "Rose Pink",
    colors: { ...base, background: "#1F0F17", surface: "#331826", surfaceAlt: "#4D2438", border: "rgba(255,255,255,0.15)", primary: "#EC4899", primaryDark: "#DB2777", accent: "#F472B6", accentViolet: "#E879F9", textMuted: "#E0BFD2" },
  },
  {
    id: "charcoal-mono",
    name: "Charcoal Monochrome",
    colors: { ...base, background: "#121212", surface: "#1E1E1E", surfaceAlt: "#2C2C2C", border: "rgba(255,255,255,0.15)", primary: "#9CA3AF", primaryDark: "#6B7280", accent: "#E5E7EB", accentViolet: "#D1D5DB", textMuted: "#B0B0B0", onPrimary: "#111827" },
  },
  {
    id: "crimson-maroon",
    name: "Crimson Maroon",
    colors: { ...base, background: "#170B0D", surface: "#281315", surfaceAlt: "#3F1D20", border: "rgba(255,255,255,0.15)", primary: "#B91C1C", primaryDark: "#991B1B", accent: "#DC2626", accentViolet: "#E11D48", textMuted: "#DCBABA" },
  },
];

export const DEFAULT_THEME_ID = "royal-gold";
export const CUSTOM_THEME_ID = "custom";

// Convenience swatches for the Settings screen's custom background/font color pickers — users can
// also type any hex code directly, this is just a quick-pick shortlist.
export const COMMON_COLOR_SWATCHES = [
  "#0F172A", "#111827", "#1E293B", "#18181B", "#27272A",
  "#FFFFFF", "#F8FAFC", "#F1F5F9", "#FEF3C7", "#FDE68A",
  "#F59E0B", "#EF4444", "#DC2626", "#EC4899", "#A855F7",
  "#8B5CF6", "#6366F1", "#2563EB", "#0EA5E9", "#06B6D4",
  "#14B8A6", "#10B981", "#22C55E", "#84CC16", "#78350F",
];

export function isValidHexColor(value: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(value);
}

export const FONT_SCALES = [
  { id: "small", label: "Small", scale: 0.9 },
  { id: "medium", label: "Medium", scale: 1.0 },
  { id: "large", label: "Large", scale: 1.15 },
  { id: "xlarge", label: "Extra Large", scale: 1.3 },
] as const;

export type FontScaleId = (typeof FONT_SCALES)[number]["id"];
export const DEFAULT_FONT_SCALE_ID: FontScaleId = "medium";
