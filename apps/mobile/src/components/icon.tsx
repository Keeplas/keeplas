import { memo } from "react";
import Svg, { Path } from "react-native-svg";

import { useTheme } from "@/providers/theme-provider";
import type { SemanticToken } from "@/theme";
import { ICON_PATHS, type IconName } from "./icon-paths.generated";

export type { IconName };

export const isIconName = (name: string): name is IconName =>
  name in ICON_PATHS;

export interface IconProps {
  name: IconName;
  size?: number;
  /** Semantic token; `tint` overrides it for illustration contexts. */
  color?: SemanticToken;
  tint?: string;
}

/** Design-kit icon (24 px grid, stroked) drawn in a theme colour. */
export const Icon = memo(function Icon({
  name,
  size = 24,
  color = "text.primary",
  tint,
}: IconProps) {
  const { colors } = useTheme();
  const { d, strokeWidth } = ICON_PATHS[name];
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d={d}
        stroke={tint ?? colors[color]}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
});
