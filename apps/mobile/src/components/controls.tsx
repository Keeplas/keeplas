import { Pressable, StyleSheet, View } from "react-native";

import { useTheme } from "@/providers/theme-provider";
import { radius } from "@/theme";
import { Icon } from "./icon";
import { Text } from "./text";

// Checkbox rows are ~24 pt tall; this brings them to a 44 pt target.
const ROW_HIT_SLOP = { top: 10, bottom: 10 };

/** Figma `Toggle`: 46×28 track, 22 pt knob. */
export function Toggle({
  value,
  onChange,
  label,
}: {
  value: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value }}
      onPress={() => onChange(!value)}
      hitSlop={10}
      style={[
        styles.track,
        {
          backgroundColor: value
            ? colors["action.primary"]
            : colors["border.strong"],
          alignItems: value ? "flex-end" : "flex-start",
        },
      ]}
    >
      <View style={[styles.knob, { backgroundColor: colors["bg.surface"] }]} />
    </Pressable>
  );
}

/** Figma `Checkbox`: 22 pt, radius 6, 2 pt border; label in Body S. */
export function Checkbox({
  checked,
  onChange,
  label,
  description,
  disabled = false,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      disabled={disabled}
      onPress={() => onChange(!checked)}
      hitSlop={ROW_HIT_SLOP}
      style={[styles.option, disabled && styles.disabled]}
    >
      <View
        style={[
          styles.checkbox,
          {
            backgroundColor: checked
              ? colors["action.primary"]
              : colors["bg.surface"],
            borderColor: checked
              ? colors["action.primary"]
              : colors["control.border"],
          },
        ]}
      >
        {checked ? <Icon name="check" size={16} color="text.inverse" /> : null}
      </View>
      {description ? (
        <View style={styles.flex}>
          <Text variant="label">{label}</Text>
          <Text variant="body-sm" color="text.muted">
            {description}
          </Text>
        </View>
      ) : (
        <Text variant="body-sm" color="text.muted" style={styles.flex}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

/** Radio: 28 pt ring, 12 pt dot; the whole 48 pt row is the touch target. */
export function Radio({
  selected,
  onPress,
  label,
  description,
  disabled = false,
}: {
  selected: boolean;
  onPress: () => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.option, styles.radioRow, disabled && styles.disabled]}
    >
      <View
        style={[
          styles.radio,
          {
            borderColor: selected
              ? colors["action.primary"]
              : colors["control.border"],
            backgroundColor: colors["bg.surface"],
          },
        ]}
      >
        {selected ? (
          <View
            style={[styles.dot, { backgroundColor: colors["action.primary"] }]}
          />
        ) : null}
      </View>
      {description ? (
        <View style={styles.flex}>
          <Text variant="label">{label}</Text>
          <Text variant="body-sm" color="text.muted">
            {description}
          </Text>
        </View>
      ) : (
        <Text variant="body" style={styles.flex}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

/** Figma `Progress Bar`: 10 pt track, radius 5. `value` is 0..1. */
export function ProgressBar({ value }: { value: number }) {
  const { colors } = useTheme();
  const clamped = Math.min(1, Math.max(0, value));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
      style={[styles.progress, { backgroundColor: colors["progress.track"] }]}
    >
      <View
        style={{
          width: `${clamped * 100}%`,
          height: "100%",
          borderRadius: 5,
          backgroundColor: colors["progress.fill"],
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  track: {
    width: 46,
    height: 28,
    borderRadius: 14,
    padding: 3,
    justifyContent: "center",
  },
  knob: {
    width: 22,
    height: 22,
    borderRadius: 11,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  option: { flexDirection: "row", alignItems: "center", gap: 12 },
  disabled: { opacity: 0.5 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: radius.xs,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  radioRow: { minHeight: 48 },
  radio: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  dot: { width: 12, height: 12, borderRadius: 6 },
  progress: { height: 10, borderRadius: 5, overflow: "hidden" },
});
