#!/usr/bin/env bash
# Build app macOS Apple Silicon (.dmg). Chrome, AI có sẵn (llama-server + model), giọng đọc có sẵn và yt-dlp được tải trước để app chạy offline.
set -euo pipefail
cd "$(dirname "$0")/.."

npx remotion browser ensure
bash desktop/fetch-local-ai.sh mac-arm64
bash desktop/fetch-vieneu.sh mac-arm64
bash desktop/fetch-yt-dlp.sh mac-arm64
npx electron-builder --mac --arm64
