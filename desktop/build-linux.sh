#!/usr/bin/env bash
# Build AppImage Linux x64 ngay trên macOS — đóng gói node_modules Linux trong staging.
set -euo pipefail
cd "$(dirname "$0")/.."

STAGE=release/linux-stage
CACHE=release/cache
ELECTRON_VERSION=$(node -p 'require("electron/package.json").version')
CHROME_VERSION=$(grep -oE "TESTED_VERSION = '[^']+'" node_modules/@remotion/renderer/dist/browser/get-chrome-download-url.js | cut -d"'" -f2)

rm -rf "$STAGE"
mkdir -p "$STAGE/.claude/skills" "$STAGE/public" "$CACHE"
cp -R package.json package-lock.json tsconfig.json remotion.config.ts desktop src server scripts "$STAGE/"
cp -R .claude/skills/style-* "$STAGE/.claude/skills/"
cp -R public/images public/music public/sfx "$STAGE/public/"
npx tsx scripts/setup-local.ts --platform linux-x64 --dest "$STAGE" --force

echo "→ Cài node_modules cho linux-x64"
(cd "$STAGE" && npm ci --omit=dev --os=linux --cpu=x64 --ignore-scripts --no-audit --no-fund)

echo "→ Tải ffmpeg Linux"
(cd "$STAGE" && npm_config_platform=linux npm_config_arch=x64 node node_modules/ffmpeg-static/install.js)

echo "→ Chrome Headless Shell $CHROME_VERSION (linux64)"
ZIP="$CACHE/chrome-headless-shell-linux64-$CHROME_VERSION.zip"
if [ ! -f "$ZIP" ]; then
  curl -fL --progress-bar -o "$ZIP.part" \
    "https://storage.googleapis.com/chrome-for-testing-public/$CHROME_VERSION/linux64/chrome-headless-shell-linux64.zip"
  mv "$ZIP.part" "$ZIP"
fi
CHROME="$STAGE/node_modules/.remotion/chrome-headless-shell"
mkdir -p "$CHROME/linux64"
unzip -q "$ZIP" -d "$CHROME/linux64"
printf "%s" "$CHROME_VERSION" > "$CHROME/VERSION"

for required in \
  "$STAGE/vendor/vieneu/linux-x64/python/bin/python3.11" \
  "$STAGE/vendor/models/vieneu-v3-turbo/onnx/vieneu_backbone_shared.data" \
  "$STAGE/node_modules/ffmpeg-static/ffmpeg" \
  "$STAGE/node_modules/@remotion/compositor-linux-x64-gnu/ffprobe" \
  "$STAGE/node_modules/@esbuild/linux-x64/bin/esbuild" \
  "$CHROME/linux64/chrome-headless-shell-linux64/chrome-headless-shell"; do
  [ -e "$required" ] || { echo "Thiếu $required" >&2; exit 1; }
done

echo "→ Đóng gói AppImage"
npx electron-builder --linux AppImage --x64 --projectDir "$STAGE" -c.electronVersion="$ELECTRON_VERSION"
mv "$STAGE"/release/*.AppImage release/
ls -lh release/*.AppImage
