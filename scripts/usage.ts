/**
 * Đếm lượt gọi từng nhà cung cấp AI trong ngày và nhớ lần gần nhất bị chặn vì hạn mức —
 * để ⚙ Cài đặt hiện "hôm nay đã dùng bao nhiêu, cái nào đang hết lượt", và để chế độ Miễn phí
 * biết khi nào phải lùi sang lựa chọn khác.
 *
 * Lưu ở data/usage.json, giữ 7 ngày. Ghi lỗi thì bỏ qua — thống kê không được làm hỏng việc chính.
 */
import fs from "fs";
import path from "path";

type Counter = { calls: number; errors: number; units: number };
type LimitHit = { kind: string; message: string; at: number };
type Store = { days: Record<string, Record<string, Counter>>; limits: Record<string, LimitHit> };

const KEEP_DAYS = 7;
const file = () => path.join(process.cwd(), "data", "usage.json");

/** Ngày theo giờ máy — hạn mức của các nhà cung cấp reset theo giờ của họ, đây chỉ để xem cho biết. */
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const read = (): Store => {
  try {
    const raw = JSON.parse(fs.readFileSync(file(), "utf8")) as Partial<Store>;
    return { days: raw.days ?? {}, limits: raw.limits ?? {} };
  } catch {
    return { days: {}, limits: {} };
  }
};

const write = (store: Store) => {
  try {
    const days = Object.keys(store.days).sort().slice(-KEEP_DAYS);
    store.days = Object.fromEntries(days.map((d) => [d, store.days[d]]));
    fs.mkdirSync(path.dirname(file()), { recursive: true });
    fs.writeFileSync(file(), JSON.stringify(store, null, 2));
  } catch {
    // thống kê không quan trọng bằng việc đang làm
  }
};

/** Tên nhà cung cấp từ nhãn lỗi "Groq (openai/gpt-oss-120b)" → "Groq". */
export const providerName = (label: string) => label.split(" (")[0].trim();

/** Một lượt gọi. `units` tuỳ nhà cung cấp: số ký tự đọc, số ảnh, số giây video… */
export const recordCall = (provider: string, ok: boolean, units = 0) => {
  const store = read();
  const day = (store.days[today()] ??= {});
  const counter = (day[provider] ??= { calls: 0, errors: 0, units: 0 });
  counter.calls += 1;
  if (!ok) counter.errors += 1;
  counter.units += units;
  // Gọi được lại rồi thì thôi báo đang hết lượt.
  if (ok && store.limits[provider]) delete store.limits[provider];
  write(store);
};

/** Bị chặn vì hạn mức / hết tiền / key sai. */
export const recordLimit = (provider: string, kind: string, message: string) => {
  const store = read();
  store.limits[provider] = { kind, message: message.slice(0, 300), at: Date.now() };
  write(store);
};

export const usageSummary = () => {
  const store = read();
  const day = store.days[today()] ?? {};
  return {
    date: today(),
    today: Object.entries(day)
      .map(([provider, c]) => ({ provider, ...c }))
      .sort((a, b) => b.calls - a.calls),
    // Chỉ hiện lần bị chặn trong 24 giờ qua — cũ hơn thì hạn mức đã hồi.
    limits: Object.entries(store.limits)
      .filter(([, hit]) => Date.now() - hit.at < 24 * 3600_000)
      .map(([provider, hit]) => ({ provider, ...hit }))
      .sort((a, b) => b.at - a.at),
  };
};

/** Chế độ 💚 Miễn phí: chỉ dùng AI trên máy và gói miễn phí, không gọi dịch vụ tính tiền. */
export const freeMode = () => process.env.FREE_MODE === "on";
