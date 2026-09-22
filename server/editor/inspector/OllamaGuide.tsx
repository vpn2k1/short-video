import { RotateCw } from "lucide-react";
import { useState } from "react";
import type { TranslateEngineInfo } from "../api";

type Os = "darwin" | "win32" | "linux";
const OS_TABS: { id: Os; label: string }[] = [
  { id: "darwin", label: "macOS" },
  { id: "win32", label: "Windows" },
  { id: "linux", label: "Linux" },
];

/** Một lệnh kèm nút chép. */
const Command: React.FC<{ text: string }> = ({ text }) => {
  const [copied, setCopied] = useState(false);
  return (
    <div className="in-cmd">
      <code>{text}</code>
      <button
        type="button"
        onClick={() => {
          navigator.clipboard?.writeText(text)
            .then(() => {
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1500);
            })
            .catch(() => undefined);
        }}
      >
        {copied ? "Đã chép" : "Chép"}
      </button>
    </div>
  );
};

const DOWNLOAD = <a href="https://ollama.com/download" target="_blank" rel="noreferrer">ollama.com/download</a>;

/** Hướng dẫn cài Ollama + model dịch, theo từng hệ điều hành. Mặc định mở tab đúng máy đang chạy app. */
export const OllamaGuide: React.FC<{
  info: NonNullable<TranslateEngineInfo["ollama"]>;
  platform: string;
  checking: boolean;
  onRefresh: () => void;
}> = ({ info, platform, checking, onRefresh }) => {
  const [os, setOs] = useState<Os>(OS_TABS.some((t) => t.id === platform) ? (platform as Os) : "win32");
  const size = info.model === "translategemma:4b" ? "~3,3 GB, " : info.model === "translategemma:12b" ? "~8,1 GB, " : "";
  return (
    <div className="in-guide">
      <b>Cài model dịch chạy trên máy</b>
      <p>
        {info.status === "not-running"
          ? `Chưa kết nối được Ollama ở ${info.host} — máy chưa cài hoặc Ollama chưa chạy.`
          : `Ollama đang chạy nhưng chưa có model ${info.model}.`}
      </p>
      <div className="in-seg" role="tablist" aria-label="Hệ điều hành">
        {OS_TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={os === t.id} className={os === t.id ? "on" : ""} onClick={() => setOs(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      <ol>
        {info.status === "not-running" ? (
          os === "darwin" ? (
            <li>
              Tải app Ollama ở {DOWNLOAD}, kéo vào Applications rồi mở — app tự chạy nền. Dùng Homebrew thì chạy lần lượt:
              <Command text="brew install ollama" />
              <Command text="ollama serve" />
            </li>
          ) : os === "win32" ? (
            <li>
              Tải <b>OllamaSetup.exe</b> ở {DOWNLOAD} và cài như app thường. Cài xong Ollama tự chạy nền (biểu tượng ở khay hệ
              thống cạnh đồng hồ).
            </li>
          ) : (
            <li>
              Mở Terminal, cài bằng lệnh dưới — Ollama tự chạy thành dịch vụ nền:
              <Command text="curl -fsSL https://ollama.com/install.sh | sh" />
            </li>
          )
        ) : null}
        <li>
          Mở <b>{os === "win32" ? "PowerShell" : "Terminal"}</b>, tải model dịch ({size}chỉ tải một lần):
          <Command text={`ollama pull ${info.model}`} />
        </li>
        <li>Bấm <b>Kiểm tra lại</b>.</li>
      </ol>
      <small className="in-hint">
        {os === "win32" ? "Máy không có card đồ hoạ rời vẫn chạy được bằng CPU, chỉ chậm hơn. " : ""}
        Cần máy 8 GB RAM trở lên. Máy 16 GB RAM: điền translategemma:12b ở trang chính › Cài đặt › Dịch phụ đề để dịch tốt hơn.
      </small>
      <small className="in-hint">Không muốn cài: thêm key miễn phí Gemini, Groq hoặc OpenRouter ở trang chính › Cài đặt.</small>
      <div className="in-actions">
        <button type="button" onClick={onRefresh} disabled={checking}>{checking ? "Đang kiểm tra…" : <><RotateCw size={16} aria-hidden /> Kiểm tra lại</>}</button>
      </div>
    </div>
  );
};
