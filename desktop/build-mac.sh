#!/usr/bin/env bash
# Build app macOS Apple Silicon (.dmg). Chrome được tải trước để app render offline.
set -euo pipefail
cd "$(dirname "$0")/.."

npx remotion browser ensure
npx electron-builder --mac --arm64
