# Developer handoff

Load design-system/styles.css; tokens.json is the stable palette mapping. Use official logo SVG. Icons are 24×24 and use currentColor. All local paths are relative so the pack can be moved.

Wireframe model lives in screens.json; screens.js mirrors it for file:// compatibility. Each screen provides EN/FR title, body, items and actions. app.js renders the shared mobile/web shell and demo interactions.

Production integration needs independent auth/crypto/backend implementation. Replace simulated handlers; do not reuse dummy QR or recovery code. Validate accessibility, translation strings and true encryption/recovery flows before shipping.
