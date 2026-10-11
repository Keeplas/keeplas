import { View } from "react-native";

import Face from "../../assets/illustrations/face.svg";
import Fingerprint from "../../assets/illustrations/fingerprint.svg";

/** The pulsing-ring biometric illustrations (M01-3 face, M08-6 fingerprint). */
export function BiometricRing({
  kind,
  size = 240,
}: {
  kind: "face" | "fingerprint";
  size?: number;
}) {
  const Art = kind === "face" ? Face : Fingerprint;
  return (
    <View style={{ alignItems: "center" }}>
      <Art width={size} height={size} />
    </View>
  );
}
