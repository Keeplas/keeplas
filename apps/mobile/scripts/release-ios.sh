#!/usr/bin/env bash
# Builds the iOS app with Xcode on this Mac and uploads it to App Store Connect
# (TestFlight), instead of EAS Build. Run it through `pnpm release:ios`, which
# injects the App Store Connect API key from Infisical prod /keeplas_mobile.
# Signing is automatic: Xcode fetches the distribution certificate and profile
# with that key, and picks the next free build number on upload.
set -euo pipefail
cd "$(dirname "$0")/.."

: "${ASC_API_KEY_ID:?missing, run via pnpm release:ios}"
: "${ASC_API_ISSUER_ID:?missing, run via pnpm release:ios}"
: "${ASC_API_KEY_P8:?missing, run via pnpm release:ios}"

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

key="$tmp/AuthKey_$ASC_API_KEY_ID.p8"
printf '%s\n' "$ASC_API_KEY_P8" >"$key"
auth=(
  -allowProvisioningUpdates
  -authenticationKeyPath "$key"
  -authenticationKeyID "$ASC_API_KEY_ID"
  -authenticationKeyIssuerID "$ASC_API_ISSUER_ID"
)

# Production EXPO_PUBLIC_* values (kept in the EAS `production` environment),
# inlined into the JS bundle when Xcode runs Metro.
npx eas-cli env:pull --environment production --path "$tmp/env" --non-interactive
set -a
# shellcheck disable=SC1091
source "$tmp/env"
set +a

npx expo prebuild --platform ios --clean

archive="ios/build/Keeplas.xcarchive"
xcodebuild archive \
  -workspace ios/Keeplas.xcworkspace \
  -scheme Keeplas \
  -configuration Release \
  -destination generic/platform=iOS \
  -archivePath "$archive" \
  "${auth[@]}"

cat >"$tmp/ExportOptions.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>method</key>
  <string>app-store-connect</string>
  <key>destination</key>
  <string>upload</string>
  <key>manageAppVersionAndBuildNumber</key>
  <true/>
</dict>
</plist>
PLIST

xcodebuild -exportArchive \
  -archivePath "$archive" \
  -exportOptionsPlist "$tmp/ExportOptions.plist" \
  -exportPath "$tmp/export" \
  "${auth[@]}"
