// Keeplas: TypeScript theme (React Native / Expo, styled or StyleSheet)
export const colors = {
  "navy": {
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
    "50": "#EEF5FA"
  },
  "sky": {
    "600": "#1B76AE",
    "500": "#238BCA",
    "100": "#E1F1FA"
  },
  "ivory": {
    "50": "#FDFBF7",
    "100": "#F7F4EE",
    "200": "#EFE9E0"
  },
  "sand": {
    "100": "#F6EFE9",
    "200": "#EADCCD"
  },
  "dawn": {
    "100": "#FDEFD4",
    "300": "#F9DDB4",
    "500": "#F2B866"
  },
  "success": {
    "600": "#2E8B6A",
    "100": "#E3F3EC"
  },
  "warning": {
    "600": "#B87503",
    "500": "#F2A20C",
    "100": "#FEF3DC"
  },
  "danger": {
    "600": "#D92D35",
    "100": "#FDE8E8"
  },
  "category": {
    "document": "#238BCA",
    "account": "#6E56CF",
    "instruction": "#D92D35",
    "other": "#1E8A8A",
    "voice": "#D92D35",
    "note": "#F07F22",
    "video": "#1E3B5E",
    "photo": "#238BCA",
    "inbox": "#2F67C8"
  }
} as const;

export const semantic = {
  "bg.app": "#FDFBF7",
  "bg.surface": "#FFFFFF",
  "bg.subtle": "#F7F4EE",
  "bg.info": "#EEF5FA",
  "bg.warm": "#F6EFE9",
  "bg.header": "#0E2340",
  "bg.inverse": "#0E2340",
  "text.primary": "#0E2340",
  "text.body": "#3A4A60",
  "text.muted": "#5E6E83",
  "text.subtle": "#8A97A8",
  "text.inverse": "#FFFFFF",
  "text.link": "#102844",
  "border.default": "#E3E7EC",
  "border.strong": "#C5D7E8",
  "border.focus": "#238BCA",
  "action.primary": "#102844",
  "action.primary.hover": "#1E3B5E",
  "action.primary.text": "#FFFFFF",
  "action.secondary.border": "#102844",
  "action.danger": "#D92D35",
  "status.active": "#2E8B6A",
  "status.pending": "#F2A20C",
  "status.scheduled": "#F2A20C",
  "status.revoked": "#D92D35",
  "progress.track": "#DCE8F2",
  "progress.fill": "#238BCA"
} as const;

export const fonts = { display: 'SourceSerif4-SemiBold', ui: 'Inter-Regular', uiMedium: 'Inter-Medium', uiSemibold: 'Inter-SemiBold' } as const;

export const type = {
  'display': { fontSize: 36, lineHeight: 40, fontWeight: '600', letterSpacing: -0.5, family: 'display' },
  'h1': { fontSize: 30, lineHeight: 34, fontWeight: '600', letterSpacing: -0.4, family: 'display' },
  'h2': { fontSize: 24, lineHeight: 30, fontWeight: '600', letterSpacing: -0.2, family: 'display' },
  'h3': { fontSize: 19, lineHeight: 24, fontWeight: '600', letterSpacing: 0, family: 'display' },
  'body-lg': { fontSize: 17, lineHeight: 25, fontWeight: '400', letterSpacing: 0, family: 'ui' },
  'body': { fontSize: 15, lineHeight: 22, fontWeight: '400', letterSpacing: 0, family: 'ui' },
  'label': { fontSize: 15, lineHeight: 20, fontWeight: '600', letterSpacing: 0, family: 'ui' },
  'body-sm': { fontSize: 13, lineHeight: 18, fontWeight: '400', letterSpacing: 0, family: 'ui' },
  'caption': { fontSize: 12, lineHeight: 16, fontWeight: '500', letterSpacing: 0.1, family: 'ui' },
  'code': { fontSize: 34, lineHeight: 40, fontWeight: '600', letterSpacing: 4, family: 'ui' },
} as const;

export const space = {"0": 0, "1": 4, "2": 8, "3": 12, "4": 16, "5": 20, "6": 24, "8": 32, "10": 40, "12": 48, "16": 64} as const;
export const radius = {"xs": 6, "sm": 10, "md": 14, "lg": 20, "xl": 28, "pill": 999} as const;
