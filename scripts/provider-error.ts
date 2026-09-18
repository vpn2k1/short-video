/**
 * Lỗi từ nhà cung cấp AI (viết kịch bản, dịch, giọng đọc, ảnh, video) → câu tiếng Việt nói rõ chuyện gì
 * xảy ra và phải làm gì. Người dùng không cần đọc "429 TPM on_demand tier" để biết là phải đợi 17 giây.
 *
 *   ⏳ hết hạn mức theo phút  → đợi N giây
 *   📅 hết lượt miễn phí trong ngày / của gói → mai thử lại, nâng gói, hoặc dùng key khác
 *   💳 hết tiền / credit      → nạp thêm
 *   🔑 key sai / bị từ chối   → sửa key trong Cài đặt
 *   🔥 máy chủ quá tải        → thử lại sau ít phút
 *   📏 yêu cầu quá lớn        → rút gọn / chọn phong cách cụ thể
 */

import { providerName, recordLimit } from "./usage";

export type ProviderErrorKind = "rate_limit" | "daily_quota" | "credit" | "auth" | "overloaded" | "too_large" | "other";

const CREDIT = /insufficient|credit|balance|billing|payment|top.?up|exceeded your current quota|quota_exceeded|character.?(limit|quota)|out of (credit|funds)|không đủ|hết (tiền|credit|ký tự|số dư)|số dư/i;
const DAILY = /per.?day|daily|\bTPD\b|\bRPD\b|free.?tier|limit: 0\b/i;
const PER_MINUTE = /per.?minute|\bTPM\b|\bRPM\b/i;
const RATE = /per.?minute|\bTPM\b|\bRPM\b|rate.?limit|too many requests|try again in|retry in|retrydelay/i;
const AUTH = /invalid.{0,12}(api.?)?key|api key not valid|unauthori[sz]ed|incorrect api key|permission|denied|forbidden|invalid_api_key|authentication/i;
const OVERLOADED = /high demand|overloaded|unavailable|capacity|try again later/i;
const TOO_LARGE = /too large|context length|maximum context|request_too_large|prompt is too long/i;

export const classifyProviderError = (status: number | undefined, message: string): ProviderErrorKind => {
  if (status === 402) return "credit";
  if (status === 429 || RATE.test(message) || DAILY.test(message)) {
    // Gemini gói miễn phí ghi "free_tier" cho cả hạn mức phút lẫn ngày — có "per minute" thì là theo phút.
    if (PER_MINUTE.test(message)) return "rate_limit";
    if (DAILY.test(message)) return "daily_quota";
    // OpenAI trả 429 "exceeded your current quota … billing" khi hết tiền.
    if (CREDIT.test(message)) return "credit";
    return "rate_limit";
  }
  if (CREDIT.test(message)) return "credit";
  if (status === 401 || status === 403 || AUTH.test(message)) return "auth";
  if (status === 413 || TOO_LARGE.test(message)) return "too_large";
  if ((status !== undefined && status >= 500) || OVERLOADED.test(message)) return "overloaded";
  return "other";
};

/** "try again in 16.65s" / "Please retry in 1m3.5s" / "retryDelay": "12s" → số giây (làm tròn lên). */
const waitSeconds = (message: string) => {
  const match = /(?:try again|retry) in\s+(?:(\d+)m)?([\d.]+)s|"retryDelay":\s*"(\d+)s"/i.exec(message);
  if (!match) return null;
  const seconds = match[3] ? Number(match[3]) : Number(match[1] ?? 0) * 60 + Number(match[2]);
  return Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds) : null;
};

const brief = (message: string) => message.replace(/\s+/g, " ").trim().slice(0, 180);

/**
 * Câu báo lỗi cho người dùng. `label` = tên nhà cung cấp kèm model nếu có, ví dụ "Groq (openai/gpt-oss-120b)".
 * `alternative` = gợi ý cách khác hợp ngữ cảnh ("chọn AI khác", "chọn giọng miễn phí"…).
 */
export const describeProviderError = (
  label: string,
  status: number | undefined,
  message: string,
  alternative = "hoặc thêm key nhà cung cấp khác trong ⚙ Cài đặt",
) => {
  const kind = classifyProviderError(status, message);
  if (kind !== "other") recordLimit(providerName(label), kind, message);
  const detail = `(chi tiết: ${status ?? "lỗi"} — ${brief(message)})`;
  switch (kind) {
    case "rate_limit": {
      const wait = waitSeconds(message);
      return `⏳ ${label}: hết hạn mức token/lượt gọi trong một phút của gói. ` +
        `${wait ? `Đợi khoảng ${wait} giây` : "Đợi khoảng 1 phút"} rồi thử lại, ${alternative}. ${detail}`;
    }
    case "daily_quota":
      return `📅 ${label}: đã dùng hết lượt miễn phí trong ngày (hoặc gói chưa được dùng tính năng này). ` +
        `Thử lại vào ngày mai, nâng cấp gói, ${alternative}. ${detail}`;
    case "credit":
      return `💳 ${label}: tài khoản hết tiền/credit. Nạp thêm trên trang của nhà cung cấp, ${alternative}. ${detail}`;
    case "auth":
      return `🔑 ${label}: key sai, đã hết hạn hoặc bị từ chối quyền — kiểm tra lại key trong ⚙ Cài đặt. ${detail}`;
    case "overloaded":
      return `🔥 ${label}: máy chủ đang quá tải tạm thời — thử lại sau ít phút, ${alternative}. ${detail}`;
    case "too_large":
      return `📏 ${label}: yêu cầu vượt hạn mức token của gói — rút ngắn nội dung, chọn sẵn một phong cách thay vì Tự động, ${alternative}. ${detail}`;
    default:
      return `${label} báo lỗi ${status ?? ""}: ${brief(message)}`.replace(/\s+:/, ":");
  }
};

/** Lỗi có kèm loại — nơi gọi dựa vào đó để tự lùi sang lựa chọn miễn phí khác. */
export class ProviderError extends Error {
  constructor(message: string, readonly kind: ProviderErrorKind) {
    super(message);
  }
}

/** Như describeProviderError nhưng trả về Error mang theo loại lỗi. */
export const providerError = (label: string, status: number | undefined, message: string, alternative?: string) =>
  new ProviderError(describeProviderError(label, status, message, alternative), classifyProviderError(status, message));

/** Hết lượt, hết tiền, key sai, quá tải — đổi sang nhà cung cấp/giọng khác thì có thể chạy tiếp. */
export const shouldFallBack = (error: unknown) =>
  error instanceof ProviderError && error.kind !== "other" && error.kind !== "too_large";

/** Lỗi dạng này nên thử nhà cung cấp khác (nếu có) thay vì dừng hẳn. */
export const isProviderUnavailable = (status: number | undefined, message: string) =>
  classifyProviderError(status, message) !== "other";
