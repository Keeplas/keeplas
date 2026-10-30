/* eslint-disable @typescript-eslint/no-require-imports, no-undef */
const {
  withAndroidManifest,
  withGradleProperties,
} = require("expo/config-plugins");

/**
 * Passkeys need Android 9 (API 28): react-native-passkey refuses anything
 * older, and sign-up can't finish without one. Block Store's end-to-end
 * encrypted backup needs Android 9 too. Raising minSdk stops Play offering the
 * app to phones that could never get past setup. Read by expo-autolinking's
 * version catalog (`android.minSdkVersion` gradle property).
 */
const MIN_SDK = "28";

/**
 * CAMERA and RECORD_AUDIO imply required camera, autofocus and microphone
 * hardware, so Play would hide the app from devices without them. They only
 * serve optional capture (scan, photo, voice note, QR), so mark them optional.
 */
const OPTIONAL_FEATURES = [
  "android.hardware.camera",
  "android.hardware.camera.autofocus",
  "android.hardware.microphone",
];

module.exports = function withAndroidDeviceReach(config) {
  const withMinSdk = withGradleProperties(config, (next) => {
    next.modResults = [
      ...next.modResults.filter(
        (item) =>
          item.type !== "property" || item.key !== "android.minSdkVersion",
      ),
      { type: "property", key: "android.minSdkVersion", value: MIN_SDK },
    ];
    return next;
  });

  return withAndroidManifest(withMinSdk, (next) => {
    const manifest = next.modResults.manifest;
    manifest["uses-feature"] = [
      ...(manifest["uses-feature"] ?? []).filter(
        (entry) => !OPTIONAL_FEATURES.includes(entry.$["android:name"]),
      ),
      ...OPTIONAL_FEATURES.map((name) => ({
        $: { "android:name": name, "android:required": "false" },
      })),
    ];
    return next;
  });
};
