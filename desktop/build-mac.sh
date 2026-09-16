#!/usr/bin/env bash
# Build app macOS Apple Silicon (.dmg). Chrome và AI có sẵn (llama-server + model) được tải trước để app chạy offline.
set -euo pipefail
cd "$(dirname "$0")/.."

npx remotion browser ensure
bash desktop/fetch-local-ai.sh mac-arm64
npx electron-builder --mac --arm64
