import { existsSync } from "node:fs";
import type { ConfigContext, ExpoConfig } from "expo/config";

// Static config lives in app.json. This only adds what must stay out of git:
// the Firebase config FCM needs to issue Android push tokens. EAS builds get
// it from the GOOGLE_SERVICES_JSON file variable; local builds read the
// gitignored ./google-services.json. Without it the app still builds, but
// Android push registration fails.
const googleServicesFile =
  process.env.GOOGLE_SERVICES_JSON ||
  (existsSync("./google-services.json") ? "./google-services.json" : undefined);

export default ({ config }: ConfigContext): ExpoConfig =>
  ({
    ...config,
    android: { ...config.android, googleServicesFile },
  }) as ExpoConfig;
