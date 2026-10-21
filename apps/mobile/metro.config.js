// Metro config: Expo defaults (monorepo-aware) + SVG files imported as React
// components through react-native-svg-transformer (illustrations, logos).
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

config.transformer = {
  ...config.transformer,
  babelTransformerPath: require.resolve("react-native-svg-transformer/expo"),
};
config.resolver = {
  ...config.resolver,
  assetExts: [
    ...config.resolver.assetExts.filter((ext) => ext !== "svg"),
    "woff2",
  ],
  sourceExts: [...config.resolver.sourceExts, "svg"],
  // hash-wasm is the web-only Argon2id engine (Hermes has no WebAssembly) and
  // the app swaps in the native one at startup (src/crypto/install.ts). Its
  // entry bundles every algorithm's WASM (~280 KB), so drop it from native
  // bundles entirely.
  resolveRequest: (context, moduleName, platform) => {
    if (
      moduleName === "hash-wasm" &&
      (platform === "ios" || platform === "android")
    ) {
      return { type: "empty" };
    }
    return context.resolveRequest(context, moduleName, platform);
  },
};

module.exports = config;
