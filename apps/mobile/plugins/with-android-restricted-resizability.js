/* eslint-disable @typescript-eslint/no-require-imports, no-undef */
const { AndroidConfig, withAndroidManifest } = require("expo/config-plugins");

const PROPERTY = "android.window.PROPERTY_COMPAT_ALLOW_RESTRICTED_RESIZABILITY";

/**
 * Android 16 (target API 36) ignores the portrait lock and resizability limits
 * on screens at least 600dp wide (tablets, unfolded foldables). Keeplas has no
 * large-screen layout yet, so it opts out. Temporary: Android ignores the
 * opt-out once the app targets API 37.
 */
module.exports = function withAndroidRestrictedResizability(config) {
  return withAndroidManifest(config, (next) => {
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(
      next.modResults,
    );
    application.property = [
      ...(application.property ?? []).filter(
        (entry) => entry.$["android:name"] !== PROPERTY,
      ),
      { $: { "android:name": PROPERTY, "android:value": "true" } },
    ];
    return next;
  });
};
