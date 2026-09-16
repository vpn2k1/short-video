/**
 * Hướng dẫn viết nội dung theo phong cách, lấy thẳng từ skill của phong cách đó
 * (`.claude/skills/style-<id>/SKILL.md`, đoạn giữa hai dấu `<!-- ai-guide -->`).
 * Một nguồn duy nhất: sửa skill là prompt của giao diện web đổi theo.
 */
import fs from "fs";
import path from "path";
import { STYLE_IDS, STYLES, type StyleId } from "../src/styles/meta";

const MARKER = /<!--\s*ai-guide\s*-->([\s\S]*?)<!--\s*\/ai-guide\s*-->/;

export const styleGuide = (id: StyleId) => {
  try {
    const skill = fs.readFileSync(
      path.join(process.cwd(), ".claude", "skills", `style-${id}`, "SKILL.md"),
      "utf8",
    );
    const match = skill.match(MARKER);
    if (match && match[1].trim()) return match[1].trim();
  } catch {
    // skill chưa có — dùng mô tả ngắn bên dưới
  }
  return `- Hợp với: ${STYLES[id].bestFor}.`;
};

/** Đoạn system prompt về phong cách: một phong cách cố định, hoặc để AI tự chọn. */
export const styleSection = (choice: StyleId | "auto") => {
  if (choice !== "auto") {
    const meta = STYLES[choice];
    return (
      `\n\nPHONG CÁCH HÌNH ẢNH: "${choice}" — ${meta.label} (${meta.summary})\n` +
      `Đặt "style" = "${choice}". Viết nội dung theo hướng dẫn riêng của phong cách này:\n` +
      styleGuide(choice)
    );
  }
  return (
    '\n\nPHONG CÁCH HÌNH ẢNH: tự chọn MỘT phong cách hợp nhất với nội dung và đặt id vào "style", ' +
    "rồi viết theo hướng dẫn của đúng phong cách đó. Các lựa chọn:\n" +
    STYLE_IDS.map(
      (id) => `\n### ${id} — ${STYLES[id].label}\nHợp với: ${STYLES[id].bestFor}\n${styleGuide(id)}`,
    ).join("\n")
  );
};
