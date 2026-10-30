import { existsSync } from "node:fs";
import type { ConfigContext, ExpoConfig } from "expo/config";

import en from "./locales/en.json";

// Static config lives in app.json. This only adds what must stay out of git:
// the Firebase config FCM needs to issue Android push tokens. EAS builds get
// it from the GOOGLE_SERVICES_JSON file variable; local builds read the
// gitignored ./google-services.json. Without it the app still builds, but
// Android push registration fails.
const googleServicesFile =
  process.env.GOOGLE_SERVICES_JSON ||
  (existsSync("./google-services.json") ? "./google-services.json" : undefined);

// The iOS purpose strings live in locales/<lang>.json (app.json `locales`
// turns them into <lang>.lproj/InfoPlist.strings). Info.plist itself must
// carry them too, so the English ones are its base values. The config
// plugins (expo-camera, expo-image-picker...) keep a value already set.
export default ({ config }: ConfigContext): ExpoConfig =>
  ({
    ...config,
    ios: { ...config.ios, infoPlist: { ...config.ios?.infoPlist, ...en.ios } },
    android: { ...config.android, googleServicesFile },
  }) as ExpoConfig;
