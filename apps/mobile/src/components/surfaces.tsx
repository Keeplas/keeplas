import { memo, type ReactNode } from "react";
import { Pressable, StyleSheet, View, type ViewStyle } from "react-native";

import { useTheme } from "@/providers/theme-provider";
import { radius, type SemanticToken } from "@/theme";
import { Icon, type IconName } from "./icon";
import { Text } from "./text";

export type Tone =
  "info" | "warning" | "danger" | "success" | "warm" | "neutral";

/** Background + foreground tokens per tone (Callout, badges, chips). */
export const TONES: Record<Tone, { bg: SemanticToken; fg: SemanticToken }> = {
  info: { bg: "bg.info", fg: "accent" },
  warning: { bg: "status.pending.bg", fg: "status.pending" },
  danger: { bg: "status.revoked.bg", fg: "status.revoked" },
  success: { bg: "status.active.bg", fg: "status.active" },
  warm: { bg: "bg.warm", fg: "text.primary" },
  neutral: { bg: "bg.subtle", fg: "text.primary" },
};

/** Figma `Card`: surface, 1 pt border, radius 14, padding 14. */
export function Card({
  children,
  gap = 12,
  style,
}: {
  children: ReactNode;
  gap?: number;
  style?: ViewStyle;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.card,
        {
          gap,
          backgroundColor: colors["bg.surface"],
          borderColor: colors["border.default"],
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** Figma `Callout`: tinted note with a 22 pt icon (radius 12). */
export function Callout({
  tone = "info",
  icon = "info",
  text,
}: {
  tone?: Tone;
  icon?: IconName;
  text: string;
}) {
  const { colors } = useTheme();
  const { bg, fg } = TONES[tone];
  return (
    <View style={[styles.callout, { backgroundColor: colors[bg] }]}>
      <Icon name={icon} size={22} color={fg} />
      <Text variant="body-sm" style={styles.flex}>
        {text}
      </Text>
    </View>
  );
}

/**
 * Quiet footnote: small accent icon + muted text, no fill. For reassurance
 * lines that sit under a card, where a tinted Callout would compete with it.
 */
export function Note({ icon, text }: { icon: IconName; text: string }) {
  return (
    <View style={styles.note}>
      <View style={styles.noteIcon}>
        <Icon name={icon} size={16} color="accent" />
      </View>
      <Text variant="body-sm" color="text.muted" style={styles.flex}>
        {text}
      </Text>
    </View>
  );
}

/** Round tinted badge holding an icon (M09 headers, State Message). */
export function IconBadge({
  icon,
  tone,
  size = 72,
}: {
  icon: IconName;
  tone: Tone;
  size?: number;
}) {
  const { colors } = useTheme();
  const { bg, fg } = TONES[tone];
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors[bg],
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Icon name={icon} size={Math.round(size * 0.44)} color={fg} />
    </View>
  );
}

/** Figma `Status Chip`: pill, caption 12/16. */
export const StatusChip = memo(function StatusChip({
  label,
  tone,
}: {
  label: string;
  tone: Tone;
}) {
  const { colors } = useTheme();
  const { bg, fg } = TONES[tone];
  return (
    <View style={[styles.chip, { backgroundColor: colors[bg] }]}>
      <Text variant="caption" color={fg}>
        {label}
      </Text>
    </View>
  );
});

/** Circular 44 pt tile with an icon (List Row leading slot). */
export const IconTile = memo(function IconTile({
  icon,
  size = 44,
  iconSize = 24,
  background,
  color = "text.primary",
  tint,
}: {
  icon: IconName;
  size?: number;
  iconSize?: number;
  /** Raw tint for category tiles; defaults to `bg.info`. */
  background?: string;
  color?: SemanticToken;
  /** Raw icon colour (category tiles). */
  tint?: string;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: background ?? colors["bg.info"],
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Icon name={icon} size={iconSize} color={color} tint={tint} />
    </View>
  );
});

export interface ListRowProps {
  title: string;
  description?: string;
  icon?: IconName;
  leading?: ReactNode;
  trailing?: ReactNode;
  onPress?: () => void;
}

/**
 * Figma `List Row`: 68 pt card row, 44 pt icon tile, title (Label) +
 * description (Body S), chevron. `trailing` replaces the chevron.
 */
export const ListRow = memo(function ListRow({
  title,
  description,
  icon,
  leading,
  trailing,
  onPress,
}: ListRowProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole={onPress ? "button" : undefined}
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: pressed ? colors["bg.subtle"] : colors["bg.surface"],
          borderColor: colors["border.default"],
        },
      ]}
    >
      {leading ?? (icon ? <IconTile icon={icon} /> : null)}
      <View style={styles.rowText}>
        <Text variant="label">{title}</Text>
        {description ? (
          <Text variant="body-sm" color="text.muted">
            {description}
          </Text>
        ) : null}
      </View>
      {trailing ??
        (onPress ? (
          <Icon name="chevron-right" size={20} color="text.muted" />
        ) : null)}
    </Pressable>
  );
});

/** Row inside a Card: leading icon, title + description, optional trailing. */
export function InfoRow({
  leading,
  title,
  description,
  trailing,
}: {
  leading: ReactNode;
  title: string;
  description?: string;
  trailing?: ReactNode;
}) {
  return (
    <View style={styles.infoRow}>
      {leading}
      <View style={styles.rowText}>
        <Text variant="label">{title}</Text>
        {description ? (
          <Text variant="body-sm" color="text.muted">
            {description}
          </Text>
        ) : null}
      </View>
      {trailing}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: 14,
  },
  callout: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
  },
  note: {
    alignSelf: "stretch",
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 4,
  },
  // Centres the 16 pt icon on the first 18 pt line of Body S.
  noteIcon: { paddingTop: 1 },
  chip: {
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  row: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderRadius: radius.md,
  },
  rowText: { flex: 1, gap: 2 },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 12 },
});
