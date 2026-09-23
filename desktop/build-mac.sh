#!/usr/bin/env bash
# Build app macOS Apple Silicon (.dmg). Chrome, AI có sẵn (llama-server + model), giọng đọc có sẵn và yt-dlp được tải trước để app chạy offline.
set -euo pipefail
cd "$(dirname "$0")/.."

npx remotion browser ensure
npx tsx scripts/setup-local.ts --platform mac-arm64
npx electron-builder --mac --arm64
