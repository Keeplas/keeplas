// Keeplas design tokens. Source: PRD/v2-mobile-first/figma/tokens.json
// (Foundations page: light + dark "Noir"). Components read semantic tokens
// through `useTheme()`, never primitives or hex values.
import type { TextStyle } from "react-native";

export const colors = {
  navy: {
    "950": "#071A30",
    "900": "#0E2340",
    "800": "#102844",
    "700": "#1E3B5E",
    "600": "#2F567F",
    "500": "#4B6E95",
    "400": "#7493B3",
    "300": "#9DBAD6",
    "200": "#C5D7E8",
    "100": "#DCE8F2",
    "50": "#EEF5FA",
  },
  sky: { "600": "#1B76AE", "500": "#238BCA", "100": "#E1F1FA" },
  ivory: { "50": "#FDFBF7", "100": "#F7F4EE", "200": "#EFE9E0" },
  sand: { "100": "#F6EFE9", "200": "#EADCCD" },
  dawn: { "100": "#FDEFD4", "300": "#F9DDB4", "500": "#F2B866" },
  success: { "600": "#2E8B6A", "100": "#E3F3EC" },
  warning: { "600": "#B87503", "500": "#F2A20C", "100": "#FEF3DC" },
  danger: { "600": "#D92D35", "100": "#FDE8E8" },
  noir: {
    "1000": "#000000",
    "950": "#0A0A0B",
    "900": "#141416",
    "850": "#1C1C1F",
    "800": "#26262A",
    "700": "#3A3A40",
    "500": "#5A5A60",
    "400": "#8E8E93",
    "200": "#C9C6C0",
    "50": "#F2EFEA",
    info: "#1A2233",
    link: "#A9C1E8",
    sky: "#4FA8E0",
    success: "#3FB68B",
    warning: "#F2B23A",
    danger: "#F0565C",
  },
  white: "#FFFFFF",
  // Category colours are identical in both themes (Foundations).
  category: {
    document: "#238BCA",
    account: "#6E56CF",
    instruction: "#D92D35",
    other: "#1E8A8A",
    note: "#F07F22",
  },
} as const;

/** `Semantic · Light` from tokens.json, plus the component values below. */
const light = {
  "bg.app": colors.ivory["50"],
  "bg.surface": colors.white,
  "bg.subtle": colors.ivory["100"],
  "bg.info": colors.navy["50"],
  "bg.warm": colors.sand["100"],
  "bg.header": colors.navy["900"],
  "text.primary": colors.navy["900"],
  "text.body": "#3A4A60",
  "text.muted": "#5E6E83",
  "text.subtle": "#8A97A8",
  "text.inverse": colors.white,
  "text.link": colors.navy["800"],
  "border.default": "#E3E7EC",
  "border.strong": colors.navy["200"],
  "border.focus": colors.sky["500"],
  "action.primary": colors.navy["800"],
  "action.primary-hover": colors.navy["700"],
  "action.danger": colors.danger["600"],
  "status.active": colors.success["600"],
  "status.pending": colors.warning["500"],
  "status.revoked": colors.danger["600"],
  "progress.track": colors.navy["100"],
  "progress.fill": colors.sky["500"],
  // Component values read from figma/specs (Stepper count, Callout icons,
  // Checkbox border, Status Chip / badge tints). Dark values step the same
  // primitives into Noir: tints are the Noir status colour at 16 % alpha.
  accent: colors.sky["500"],
  "accent.text": colors.sky["600"],
  // Add menu tiles, voice-note rings (sky/100).
  "accent.soft": colors.sky["100"],
  "control.border": colors.navy["300"],
  "status.active.bg": colors.success["100"],
  "status.pending.bg": colors.warning["100"],
  "status.revoked.bg": colors.danger["100"],
} as const;

export type SemanticToken = keyof typeof light;
export type SemanticColors = Record<SemanticToken, string>;

/** `Semantic · Dark` (Noir) from tokens.json. Same names, Noir values. */
const dark: SemanticColors = {
  "bg.app": colors.noir["950"],
  "bg.surface": colors.noir["900"],
  "bg.subtle": colors.noir["850"],
  "bg.info": colors.noir.info,
  "bg.warm": colors.noir["850"],
  "bg.header": colors.noir["1000"],
  "text.primary": colors.noir["50"],
  "text.body": colors.noir["200"],
  "text.muted": colors.noir["400"],
  "text.subtle": colors.noir["500"],
  "text.inverse": colors.noir["950"],
  "text.link": colors.noir.link,
  "border.default": colors.noir["800"],
  "border.strong": colors.noir["700"],
  "border.focus": colors.noir.sky,
  "action.primary": colors.noir["50"],
  "action.primary-hover": colors.white,
  "action.danger": colors.noir.danger,
  "status.active": colors.noir.success,
  "status.pending": colors.noir.warning,
  "status.revoked": colors.noir.danger,
  "progress.track": colors.noir["800"],
  "progress.fill": colors.noir.sky,
  accent: colors.noir.sky,
  "accent.text": colors.noir.sky,
  "accent.soft": colors.noir.info,
  "control.border": colors.noir["500"],
  "status.active.bg": "rgba(63, 182, 139, 0.16)",
  "status.pending.bg": "rgba(242, 178, 58, 0.16)",
  "status.revoked.bg": "rgba(240, 86, 92, 0.16)",
};

export const semantic = { light, dark } as const;
export type ColorScheme = keyof typeof semantic;

/** Apply an alpha to a #RRGGBB colour (category tile tints, focus glow). */
export function withAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

export const fonts = {
  display: "SourceSerif4-SemiBold",
  ui: "Inter-Regular",
  uiMedium: "Inter-Medium",
  uiSemibold: "Inter-SemiBold",
} as const;

/**
 * Type scale (Foundations). Each family file carries its weight, so styles
 * set `fontFamily` only (a `fontWeight` on a custom family breaks Android).
 */
export const type = {
  display: {
    fontFamily: fonts.display,
    fontSize: 36,
    lineHeight: 40,
    letterSpacing: -0.5,
  },
  h1: {
    fontFamily: fonts.display,
    fontSize: 30,
    lineHeight: 34,
    letterSpacing: -0.4,
  },
  h2: {
    fontFamily: fonts.display,
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: -0.2,
  },
  h3: {
    fontFamily: fonts.display,
    fontSize: 19,
    lineHeight: 24,
    letterSpacing: 0,
  },
  "body-lg": {
    fontFamily: fonts.ui,
    fontSize: 17,
    lineHeight: 25,
    letterSpacing: 0,
  },
  body: {
    fontFamily: fonts.ui,
    fontSize: 15,
    lineHeight: 22,
    letterSpacing: 0,
  },
  label: {
    fontFamily: fonts.uiSemibold,
    fontSize: 15,
    lineHeight: 20,
    letterSpacing: 0,
  },
  "body-sm": {
    fontFamily: fonts.ui,
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 0,
  },
  "body-sm-strong": {
    fontFamily: fonts.uiSemibold,
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 0,
  },
  caption: {
    fontFamily: fonts.uiMedium,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.1,
  },
  code: {
    fontFamily: fonts.uiSemibold,
    fontSize: 34,
    lineHeight: 40,
    letterSpacing: 4,
  },
  button: {
    fontFamily: fonts.uiSemibold,
    fontSize: 16,
    lineHeight: 20,
    letterSpacing: 0,
  },
  digit: {
    fontFamily: fonts.uiSemibold,
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: -0.2,
  },
  // M08-1 Welcome only (hero over the night landscape).
  hero: {
    fontFamily: fonts.display,
    fontSize: 46,
    lineHeight: 50,
    letterSpacing: -0.46,
  },
  lead: {
    fontFamily: fonts.ui,
    fontSize: 18,
    lineHeight: 26,
    letterSpacing: 0,
  },
} as const satisfies Record<string, TextStyle>;

export type TypeStyle = keyof typeof type;

export const space = {
  "0": 0,
  "1": 4,
  "2": 8,
  "3": 12,
  "4": 16,
  "5": 20,
  "6": 24,
  "8": 32,
  "10": 40,
  "12": 48,
  "16": 64,
} as const;

export const radius = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
  pill: 999,
} as const;

/** Screen gutter and content width from the 393 pt frames (20 + 353 + 20). */
export const layout = {
  gutter: space["5"],
  headerHeight: 52,
} as const;

/** M08-1 night sky: an illustration, identical in both themes. */
export const welcomeSky = {
  colors: ["#0E1F3D", "#20395C", "#4E6684", "#708194", "#05132B", "#030E22"],
  locations: [0, 0.36, 0.48, 0.55, 0.84, 1],
  horizon: "#708194",
  ground: "#05132B",
  foreground: "#FFFFFF",
  glass: "rgba(11, 29, 56, 0.35)",
  glassBorder: "rgba(255, 255, 255, 0.6)",
  dropdownBorder: "rgba(255, 255, 255, 0.5)",
} as const;
