/**
 * Mẫu loạt: lưu bộ cài đặt chung của màn Hàng loạt (phong cách, khung, giọng, hình, nhạc, duyệt lời…)
 * dưới một cái tên, lần sau chọn lại một lần là đủ — khỏi chỉnh lại sáu bảy ô mỗi khi làm loạt mới.
 *
 * Lưu ở data/batch-presets.json, cùng chỗ với các loạt. Trùng tên thì ghi đè (nút "Lưu làm mẫu" với tên cũ
 * = cập nhật mẫu đó).
 */
import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";
import { DEFAULT_SETTINGS, normalizeSettings, type ChatSettings } from "./chat";
import { parseKit, type Kit } from "./batch";

/** Mẫu = cài đặt loạt + (tuỳ chọn) nhận diện kênh: tên kênh, màu, mở đầu/kết thúc, kiểu phụ đề. */
export type BatchPreset = { id: string; name: string; settings: ChatSettings; review: boolean; kit?: Kit; updatedAt: number };

const MAX_PRESETS = 30;
const presetsFile = () => path.join(process.cwd(), "data", "batch-presets.json");

const readAll = (): BatchPreset[] => {
  try {
    const raw = JSON.parse(fs.readFileSync(presetsFile(), "utf8"));
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
};

const writeAll = (presets: BatchPreset[]) => {
  fs.mkdirSync(path.dirname(presetsFile()), { recursive: true });
  fs.writeFileSync(presetsFile(), JSON.stringify(presets, null, 2));
};

/** Mẫu mới dùng gần nhất lên đầu. Cài đặt đọc lại qua normalizeSettings: giọng hay nhạc đã gỡ thì về mặc định. */
export const listPresets = () => ({
  presets: readAll()
    .map((p) => ({ ...p, settings: normalizeSettings(p.settings, DEFAULT_SETTINGS) }))
    .sort((a, b) => b.updatedAt - a.updatedAt),
});

export const savePreset = (body: unknown) => {
  const { name, settings, review, kit } = (body ?? {}) as { name?: unknown; settings?: Partial<ChatSettings>; review?: unknown; kit?: unknown };
  const title = String(name ?? "").trim().slice(0, 40);
  if (!title) throw new Error("Đặt tên cho mẫu trước đã.");
  const presets = readAll();
  const same = presets.find((p) => p.name.toLowerCase() === title.toLowerCase());
  const preset: BatchPreset = {
    id: same?.id ?? randomUUID().slice(0, 8),
    name: title,
    settings: normalizeSettings(settings, DEFAULT_SETTINGS),
    review: review !== false,
    ...(parseKit(kit) ? { kit: parseKit(kit) } : {}),
    updatedAt: Date.now(),
  };
  const rest = presets.filter((p) => p.id !== preset.id);
  if (!same && rest.length >= MAX_PRESETS) throw new Error(`Tối đa ${MAX_PRESETS} mẫu — xoá bớt mẫu cũ rồi lưu.`);
  writeAll([preset, ...rest]);
  return { preset, replaced: Boolean(same), ...listPresets() };
};

export const deletePreset = (id: unknown) => {
  writeAll(readAll().filter((p) => p.id !== String(id)));
  return listPresets();
};
