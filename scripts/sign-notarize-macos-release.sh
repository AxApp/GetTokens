#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat >&2 <<'EOF'
Usage:
  sign-notarize-macos-release.sh app <path-to-app>
  sign-notarize-macos-release.sh dmg <path-to-dmg>
EOF
  exit 1
}

require_env() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "Missing required env: $name" >&2
    exit 1
  fi
}

require_notary_env() {
  require_env MACOS_SIGNING_IDENTITY
  require_env MACOS_NOTARY_KEY_ID
  require_env MACOS_NOTARY_ISSUER_ID
  require_env MACOS_NOTARY_KEY_PATH
}

submit_for_notarization() {
  local artifact="$1"

  xcrun notarytool submit "$artifact" \
    --key "$MACOS_NOTARY_KEY_PATH" \
    --key-id "$MACOS_NOTARY_KEY_ID" \
    --issuer "$MACOS_NOTARY_ISSUER_ID" \
    --wait
}

MODE="${1:-}"
TARGET_PATH="${2:-}"

if [[ -z "$MODE" || -z "$TARGET_PATH" ]]; then
  usage
fi

require_notary_env

case "$MODE" in
  app)
    if [[ ! -d "$TARGET_PATH" ]]; then
      echo "App bundle not found: $TARGET_PATH" >&2
      exit 1
    fi

    ZIP_PATH="$(mktemp -t gettokens-notary-app).zip"
    trap 'rm -f "$ZIP_PATH"' EXIT

    codesign --deep --force --options runtime --timestamp --sign "$MACOS_SIGNING_IDENTITY" "$TARGET_PATH"
    codesign --verify --deep --strict --verbose=2 "$TARGET_PATH"

    ditto -c -k --keepParent "$TARGET_PATH" "$ZIP_PATH"
    submit_for_notarization "$ZIP_PATH"

    xcrun stapler staple "$TARGET_PATH"
    spctl -a -t exec -vv "$TARGET_PATH"
    ;;
  dmg)
    if [[ ! -f "$TARGET_PATH" ]]; then
      echo "DMG not found: $TARGET_PATH" >&2
      exit 1
    fi

    codesign --force --timestamp --sign "$MACOS_SIGNING_IDENTITY" "$TARGET_PATH"
    codesign --verify --verbose=2 "$TARGET_PATH"

    submit_for_notarization "$TARGET_PATH"

    xcrun stapler staple "$TARGET_PATH"
    spctl -a -t open --context context:primary-signature -vv "$TARGET_PATH"
    ;;
  *)
    usage
    ;;
esac
