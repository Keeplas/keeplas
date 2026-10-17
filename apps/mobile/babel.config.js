// lazyImports defers module evaluation to first use (Metro's inline-requires
// for ESM imports). Side-effect imports (e.g. `import "./src/crypto/install"`)
// are not deferred, so the crypto polyfills still run first.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [["babel-preset-expo", { lazyImports: true }]],
  };
};
