#!/usr/bin/env bash
# Build bộ cài Windows x64 (NSIS .exe) ngay trên macOS — không cần máy Windows hay Wine.
#
# node_modules hiện tại là bản cho Mac, nên dựng một bản sao app trong release/win-stage,
# cài node_modules cho win32-x64 vào đó, thêm ffmpeg.exe và Chrome Headless Shell bản
# Windows, rồi cho electron-builder đóng gói từ thư mục ấy.
set -euo pipefail
cd "$(dirname "$0")/.."

STAGE=release/win-stage
CACHE=release/cache
ELECTRON_VERSION=$(node -p 'require("electron/package.json").version')
CHROME_VERSION=$(grep -oE "TESTED_VERSION = '[^']+'" node_modules/@remotion/renderer/dist/browser/get-chrome-download-url.js | cut -d"'" -f2)

echo "→ Chép mã nguồn vào $STAGE"
rm -rf "$STAGE"
mkdir -p "$STAGE/.claude/skills" "$STAGE/public" "$CACHE"
cp -R package.json package-lock.json tsconfig.json remotion.config.ts desktop src server scripts "$STAGE/"
cp -R .claude/skills/style-* "$STAGE/.claude/skills/"
cp -R public/images public/music public/sfx "$STAGE/public/"
bash desktop/fetch-local-ai.sh win-x64 "$STAGE"
bash desktop/fetch-yt-dlp.sh win-x64 "$STAGE"

echo "→ Cài node_modules cho win32-x64"
# --ignore-scripts: postinstall (esbuild…) sẽ kiểm tra binary theo máy đang build (Mac) và làm hỏng bản Windows.
(cd "$STAGE" && npm ci --omit=dev --os=win32 --cpu=x64 --ignore-scripts --no-audit --no-fund)

echo "→ Tải ffmpeg.exe"
(cd "$STAGE" && npm_config_platform=win32 npm_config_arch=x64 node node_modules/ffmpeg-static/install.js)
FF="$STAGE/node_modules/ffmpeg-static"
if [ ! -f "$FF/ffmpeg.exe" ]; then mv "$FF/ffmpeg" "$FF/ffmpeg.exe"; fi

echo "→ Chrome Headless Shell $CHROME_VERSION (win64)"
ZIP="$CACHE/chrome-headless-shell-win64-$CHROME_VERSION.zip"
if [ ! -f "$ZIP" ]; then
  curl -fL --progress-bar -o "$ZIP.part" \
    "https://storage.googleapis.com/chrome-for-testing-public/$CHROME_VERSION/win64/chrome-headless-shell-win64.zip"
  mv "$ZIP.part" "$ZIP"
fi
CHROME="$STAGE/node_modules/.remotion/chrome-headless-shell"
mkdir -p "$CHROME/win64"
unzip -q "$ZIP" -d "$CHROME/win64"
printf "%s" "$CHROME_VERSION" > "$CHROME/VERSION"

for required in \
  "$FF/ffmpeg.exe" \
  "$STAGE/node_modules/@remotion/compositor-win32-x64-msvc/ffprobe.exe" \
  "$STAGE/node_modules/@esbuild/win32-x64/esbuild.exe" \
  "$STAGE/node_modules/@tailwindcss/oxide-win32-x64-msvc" \
  "$CHROME/win64/chrome-headless-shell-win64/chrome-headless-shell.exe"; do
  [ -e "$required" ] || { echo "Thiếu $required" >&2; exit 1; }
done

echo "→ Đóng gói NSIS"
npx electron-builder --win --x64 --projectDir "$STAGE" -c.electronVersion="$ELECTRON_VERSION"
mv "$STAGE"/release/*.exe release/
ls -lh release/*.exe
