import { Text as RNText, type TextProps as RNTextProps } from "react-native";

import { useTheme } from "@/providers/theme-provider";
import { type, type SemanticToken, type TypeStyle } from "@/theme";

export interface TextProps extends RNTextProps {
  variant?: TypeStyle;
  color?: SemanticToken;
  align?: "left" | "center" | "right";
}

/** Text bound to the type scale and a semantic colour token. */
export function Text({
  variant = "body",
  color = "text.primary",
  align,
  style,
  ...rest
}: TextProps) {
  const { colors } = useTheme();
  return (
    <RNText
      {...rest}
      style={[type[variant], { color: colors[color], textAlign: align }, style]}
    />
  );
}
