/**
 * Hạn mức chi tiêu cho video AI (⚙ Cài đặt › Chi phí), tính bằng USD ước tính theo bảng giá của model.
 * Kiểm trong generateAiVideo nên mọi đường tạo clip — trình chỉnh sửa, chat, hàng loạt, gọi thẳng API — đều bị
 * chặn như nhau.
 *
 * Chỉ tính được model có giá (usdPerSecond). Đã đặt hạn mức mà model chưa có giá thì từ chối: không biết giá
 * thì không chặn đúng được. Clip đang tạo được giữ chỗ trong hạn mức, nên tạo nhiều clip cùng lúc cũng không lọt.
 */
import { recordSpend, spendSummary } from "./usage";

export const BUDGET_DAY_ENV = "AI_VIDEO_BUDGET_DAY";
export const BUDGET_MONTH_ENV = "AI_VIDEO_BUDGET_MONTH";

/** Hạn mức trong Cài đặt; null = không giới hạn. "0" = chặn hẳn video AI tính tiền. */
const limitOf = (name: string) => {
  const raw = process.env[name]?.trim();
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : null;
};

/** USD của các clip đang tạo — đã giữ chỗ, chưa ghi vào chi tiêu. */
let pendingUsd = 0;

export const videoBudget = () => {
  const spent = spendSummary();
  return {
    day: { limit: limitOf(BUDGET_DAY_ENV), spent: spent.today + pendingUsd },
    month: { limit: limitOf(BUDGET_MONTH_ENV), spent: spent.month + pendingUsd },
  };
};

const usd = (value: number) => `$${value.toFixed(2)}`;

/**
 * Giữ chỗ trong hạn mức cho một clip ước tính `estimate` USD (null = model chưa có giá); vượt thì báo lỗi.
 * Trả hàm `settle(charged)`: true khi nhà cung cấp đã tạo xong clip (tính tiền từ lúc này) → ghi vào chi tiêu;
 * false khi hỏng trước đó → trả chỗ lại. Gọi nhiều lần chỉ lần đầu có tác dụng.
 */
export const reserveVideoBudget = (estimate: number | null, modelLabel: string) => {
  const budget = videoBudget();
  if (estimate === null) {
    if (budget.day.limit !== null || budget.month.limit !== null) {
      throw new Error(
        `${modelLabel} chưa có bảng giá trong app nên không kiểm được hạn mức chi tiêu video AI. ` +
          "Chọn model có giá (Veo trên Google Gemini), hoặc bỏ hạn mức trong ⚙ Cài đặt › Chi phí.",
      );
    }
    // Không biết giá, không có hạn mức: không có gì để ghi.
    const noop: (charged: boolean) => void = () => undefined;
    return noop;
  }
  const scopes = [
    { name: "hôm nay", wait: "đợi sang ngày mới", ...budget.day },
    { name: "tháng này", wait: "đợi sang tháng mới", ...budget.month },
  ];
  for (const scope of scopes) {
    if (scope.limit !== null && scope.spent + estimate > scope.limit + 1e-9) {
      throw new Error(
        `Vượt hạn mức chi tiêu video AI ${scope.name}: đã dùng ~${usd(scope.spent)} / ${usd(scope.limit)}, ` +
          `clip này ước tính ${usd(estimate)}. Nâng hạn mức trong ⚙ Cài đặt › Chi phí, hoặc ${scope.wait}.`,
      );
    }
  }
  pendingUsd += estimate;
  let settled = false;
  return (charged: boolean) => {
    if (settled) return;
    settled = true;
    pendingUsd -= estimate;
    if (charged) recordSpend(estimate);
  };
};
