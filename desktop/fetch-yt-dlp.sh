#!/usr/bin/env bash
# Chuẩn bị yt-dlp (bản chạy độc lập, không cần Python) cho mục 📺 Bilibili trong trình chỉnh sửa.
#
#   bash desktop/fetch-yt-dlp.sh mac-arm64            → ./vendor (chạy từ mã nguồn, build macOS)
#   bash desktop/fetch-yt-dlp.sh win-x64 release/win-stage
#
# Kết quả:  <đích>/vendor/yt-dlp/<nền tảng>/yt-dlp[.exe]
# Bilibili đổi trang thì yt-dlp cần bản mới — người dùng bấm "Cập nhật" trong app (chép ra data/bin rồi tự cập nhật),
# không phải build lại. Đổi YT_DLP_VERSION ở đây khi phát hành bản app mới.
set -euo pipefail
cd "$(dirname "$0")/.."

PLATFORM=${1:?"Thiếu nền tảng: mac-arm64 | win-x64 | linux-x64"}
DEST=${2:-.}

YT_DLP_VERSION=2026.08.19

case "$PLATFORM" in
  mac-arm64) ASSET=yt-dlp_macos; EXE=yt-dlp ;;
  win-x64) ASSET=yt-dlp.exe; EXE=yt-dlp.exe ;;
  linux-x64) ASSET=yt-dlp_linux; EXE=yt-dlp ;;
  *) echo "Nền tảng không hỗ trợ: $PLATFORM" >&2; exit 1 ;;
esac

CACHE=release/cache/yt-dlp-$YT_DLP_VERSION
BASE=https://github.com/yt-dlp/yt-dlp/releases/download/$YT_DLP_VERSION
mkdir -p "$CACHE"

echo "→ yt-dlp $YT_DLP_VERSION ($PLATFORM)"
[ -f "$CACHE/SHA2-256SUMS" ] || curl -fsSL -o "$CACHE/SHA2-256SUMS" "$BASE/SHA2-256SUMS"
if [ ! -f "$CACHE/$ASSET" ]; then
  curl -fL --progress-bar -o "$CACHE/$ASSET.part" "$BASE/$ASSET"
  mv "$CACHE/$ASSET.part" "$CACHE/$ASSET"
fi
EXPECTED=$(awk -v f="$ASSET" '$2 == f { print $1 }' "$CACHE/SHA2-256SUMS")
ACTUAL=$(shasum -a 256 "$CACHE/$ASSET" | cut -d" " -f1)
if [ -z "$EXPECTED" ] || [ "$ACTUAL" != "$EXPECTED" ]; then
  echo "yt-dlp tải về bị hỏng (SHA-256 không khớp) — xoá $CACHE rồi chạy lại." >&2
  exit 1
fi

mkdir -p "$DEST"
DEST=$(cd "$DEST" && pwd)
OUT="$DEST/vendor/yt-dlp/$PLATFORM"
rm -rf "$OUT"
mkdir -p "$OUT"
cp "$CACHE/$ASSET" "$OUT/$EXE"
chmod +x "$OUT/$EXE"
du -sh "$OUT/$EXE"
