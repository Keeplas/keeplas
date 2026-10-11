/* eslint-disable @typescript-eslint/no-require-imports, no-undef */
const fs = require("node:fs");
const path = require("node:path");
const { withDangerousMod, withInfoPlist } = require("expo/config-plugins");

/** iOS 27 requires a UIScene delegate; ExpoModulesCore provides this class. */
module.exports = function withIosScene(config) {
  const withManifest = withInfoPlist(config, (next) => {
    next.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: "Default",
            UISceneDelegateClassName: "EXExpoAppSceneDelegate",
          },
        ],
      },
    };
    return next;
  });

  return withDangerousMod(withManifest, [
    "ios",
    async (next) => {
      const iosRoot = path.join(next.modRequest.platformProjectRoot);
      const projectDirectory = fs
        .readdirSync(iosRoot, { withFileTypes: true })
        .find(
          (entry) =>
            entry.isDirectory() &&
            fs.existsSync(path.join(iosRoot, entry.name, "AppDelegate.swift")),
        );

      if (!projectDirectory) {
        throw new Error("Unable to find the generated iOS AppDelegate.swift");
      }

      const appDelegatePath = path.join(
        iosRoot,
        projectDirectory.name,
        "AppDelegate.swift",
      );
      let source = fs.readFileSync(appDelegatePath, "utf8");

      source = source.replace(
        "class AppDelegate: ExpoAppDelegate {",
        "class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {",
      );
      source = source.replace(
        `
#if os(iOS) || os(tvOS)
    window = UIWindow(frame: UIScreen.main.bounds)
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)
#endif
`,
        "",
      );

      if (
        !source.includes("ExpoReactNativeFactoryProvider") ||
        source.includes("factory.startReactNative(")
      ) {
        throw new Error(
          "AppDelegate.swift template changed: update plugins/with-ios-scene.js",
        );
      }

      fs.writeFileSync(appDelegatePath, source);
      return next;
    },
  ]);
};
