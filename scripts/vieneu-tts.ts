/**
 * Giọng đọc có sẵn trong app — VieNeu-TTS v3 Turbo: tiếng Việt, 25 giọng, 48 kHz, offline, không cần key.
 *
 * desktop/fetch-vieneu.sh chuẩn bị Python độc lập + thư viện trong vendor/vieneu/<nền tảng> và model trong
 * vendor/models/vieneu-v3-turbo. App đóng gói truyền LOCAL_AI_DIR trỏ vào vendor trong app, giống AI có sẵn
 * (scripts/local-ai.ts); chạy từ mã nguồn thì dùng ./vendor.
 *
 * Mỗi lần đọc bật một tiến trình Python (scripts/vieneu-worker.py) cho cả loạt câu rồi tắt: model chiếm ~1 GB RAM,
 * không giữ lại lúc render video. Đo trên Mac M-series (model int8): 5 câu ~25 s audio mất ~6 s tính cả nạp model.
 */
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

export const LOCAL_VOICE_MODEL = "vieneu-v3-turbo";
/** Giọng mặc định khi không chọn giọng cụ thể (giọng dự phòng khi giọng trên mạng hết lượt). */
export const LOCAL_DEFAULT_VOICE = "Ngọc Huyền";
/** Máy yếu không có AVX/Accelerate có thể chậm hơn đo đạc vài lần — để dư cho kịch bản dài. */
const TIMEOUT_MS = 20 * 60_000;

const PLATFORM_DIR = `${process.platform === "darwin" ? "mac" : process.platform === "win32" ? "win" : "linux"}-${process.arch}`;
const vendorDir = () => process.env.LOCAL_AI_DIR || path.join(process.cwd(), "vendor");
const runtimeDir = () => path.join(vendorDir(), "vieneu", PLATFORM_DIR);
const pythonPath = () =>
  path.join(runtimeDir(), "python", ...(process.platform === "win32" ? ["python.exe"] : ["bin", "python3.11"]));
const modelDir = () => path.join(vendorDir(), "models", LOCAL_VOICE_MODEL);

export const localVoiceAvailable = () =>
  fs.existsSync(pythonPath()) && fs.existsSync(path.join(modelDir(), "onnx", "vieneu_backbone_shared.data"));

/** Đọc từng câu ra file WAV bằng một giọng VieNeu. Một tiến trình cho cả loạt — nạp model một lần. */
export const localTtsToWavs = (items: { text: string; out: string }[], voice: string = LOCAL_DEFAULT_VOICE) =>
  new Promise<void>((resolve, reject) => {
    if (!localVoiceAvailable()) {
      reject(
        new Error(
          `Chưa có giọng đọc trong app (thiếu vendor/vieneu/${PLATFORM_DIR} hoặc vendor/models/${LOCAL_VOICE_MODEL}). ` +
            `Chạy bash desktop/fetch-vieneu.sh ${PLATFORM_DIR}, hoặc chọn giọng khác.`,
        ),
      );
      return;
    }
    const worker = path.join(path.dirname(fileURLToPath(import.meta.url)), "vieneu-worker.py");
    // -I: bỏ qua PYTHONPATH/PYTHONHOME và thư viện Python của người dùng; -B: không ghi .pyc vào thư mục app.
    const child = spawn(pythonPath(), ["-I", "-B", worker, path.join(runtimeDir(), "site"), modelDir()], {
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => (stdout += chunk));
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      stderr = (stderr + chunk).slice(-4000);
    });
    const timer = setTimeout(() => child.kill("SIGKILL"), TIMEOUT_MS);
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      const done = stdout.split("\n").filter((line) => line.startsWith("ok ")).length;
      if (code === 0 && done === items.length) {
        resolve();
        return;
      }
      const failed = items[done]?.text;
      const reason = signal ? `dừng (${signal})` : `thoát mã ${code}`;
      const detail = stderr.split("\n").reverse().find((line) => line.startsWith("Error: "))?.slice(7).trim() ?? "";
      reject(
        new Error(`Giọng đọc trong app ${reason}${failed ? ` ở câu "${failed}"` : ""}. ${detail}`.trim()),
      );
    });
    child.stdin.end(JSON.stringify({ voice, items }));
  });
