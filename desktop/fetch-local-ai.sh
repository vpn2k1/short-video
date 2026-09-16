#!/usr/bin/env bash
# Chuẩn bị "AI có sẵn trong app": llama-server (llama.cpp) + model GGUF viết/sửa kịch bản.
#
#   bash desktop/fetch-local-ai.sh mac-arm64            → ./vendor (chạy từ mã nguồn, build macOS)
#   bash desktop/fetch-local-ai.sh win-x64 release/win-stage
#
# Kết quả:  <đích>/vendor/llama/<nền tảng>/llama-server[.exe] + thư viện đi kèm
#           <đích>/vendor/models/<model>.gguf
# Model tải một lần vào ./vendor/models của project (có kiểm SHA-256), bản stage chỉ chép sang.
set -euo pipefail
cd "$(dirname "$0")/.."

PLATFORM=${1:?"Thiếu nền tảng: mac-arm64 | win-x64 | linux-x64"}
DEST=${2:-.}

# Ghim phiên bản — đổi bản llama.cpp thì chạy thử lại phần AI trên máy trước khi phát hành.
LLAMA_BUILD=b10995
MODEL_FILE=qwen2.5-1.5b-instruct-q4_k_m.gguf
MODEL_URL=https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/$MODEL_FILE
MODEL_SHA256=6a1a2eb6d15622bf3c96857206351ba97e1af16c30d7a74ee38970e434e9407e

CACHE=release/cache
mkdir -p "$CACHE" vendor/models

case "$PLATFORM" in
  mac-arm64) ASSET=llama-$LLAMA_BUILD-bin-macos-arm64.tar.gz ;;
  # Bản Vulkan chạy được cả GPU AMD/Intel/NVIDIA; máy không có Vulkan thì tự lùi về CPU.
  win-x64) ASSET=llama-$LLAMA_BUILD-bin-win-vulkan-x64.zip ;;
  linux-x64) ASSET=llama-$LLAMA_BUILD-bin-ubuntu-vulkan-x64.tar.gz ;;
  *) echo "Nền tảng không hỗ trợ: $PLATFORM" >&2; exit 1 ;;
esac

echo "→ llama.cpp $LLAMA_BUILD ($PLATFORM)"
if [ ! -f "$CACHE/$ASSET" ]; then
  curl -fL --progress-bar -o "$CACHE/$ASSET.part" \
    "https://github.com/ggml-org/llama.cpp/releases/download/$LLAMA_BUILD/$ASSET"
  mv "$CACHE/$ASSET.part" "$CACHE/$ASSET"
fi

UNPACK=$(mktemp -d)
trap 'rm -rf "$UNPACK"' EXIT
case "$ASSET" in
  *.zip) unzip -q "$CACHE/$ASSET" -d "$UNPACK" ;;
  *) tar xzf "$CACHE/$ASSET" -C "$UNPACK" --strip-components=1 ;;
esac

# Chỉ giữ llama-server và thư viện nó cần — bỏ ~20 công cụ dòng lệnh khác.
mkdir -p "$DEST"
DEST=$(cd "$DEST" && pwd)
OUT="$DEST/vendor/llama/$PLATFORM"
rm -rf "$OUT"
mkdir -p "$OUT"
(
  cd "$UNPACK"
  for file in LICENSE* llama-server llama-server.exe *llama-server-impl.* \
    libggml* ggml*.dll libllama.* llama.dll libllama-common* llama-common.dll libmtmd* mtmd.dll libomp.dll; do
    if [ -e "$file" ] || [ -L "$file" ]; then cp -RP "$file" "$OUT/"; fi
  done
)

echo "→ Model $MODEL_FILE"
if [ ! -f "vendor/models/$MODEL_FILE" ]; then
  curl -fL --progress-bar -C - -o "vendor/models/$MODEL_FILE.part" "$MODEL_URL"
  mv "vendor/models/$MODEL_FILE.part" "vendor/models/$MODEL_FILE"
fi
ACTUAL=$(shasum -a 256 "vendor/models/$MODEL_FILE" | cut -d" " -f1)
if [ "$ACTUAL" != "$MODEL_SHA256" ]; then
  echo "Model tải về bị hỏng (SHA-256 không khớp) — xoá vendor/models/$MODEL_FILE rồi chạy lại." >&2
  exit 1
fi
if [ "$DEST" != "$PWD" ]; then
  mkdir -p "$DEST/vendor/models"
  # -c: bản sao APFS, không tốn thêm 1 GB ổ đĩa; ổ khác không hỗ trợ thì chép thường.
  cp -c "vendor/models/$MODEL_FILE" "$DEST/vendor/models/" 2>/dev/null || cp "vendor/models/$MODEL_FILE" "$DEST/vendor/models/"
fi

SERVER="$OUT/llama-server"
[ "$PLATFORM" = win-x64 ] && SERVER="$OUT/llama-server.exe"
[ -f "$SERVER" ] || { echo "Thiếu $SERVER" >&2; exit 1; }
du -sh "$OUT" "$DEST/vendor/models/$MODEL_FILE"
