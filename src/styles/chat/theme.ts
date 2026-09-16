import { FONTS } from "../shared";

/** Font của giao diện nhắn tin — SF trên macOS, đủ dấu tiếng Việt. */
export const CHAT_FONT = FONTS.sans;

export type ChatTheme = {
  dark: boolean;
  /** Nền màn hình chat. */
  screen: string;
  /** Nền thanh tiêu đề và thanh soạn tin. */
  bar: string;
  hairline: string;
  incoming: string;
  incomingText: string;
  outgoing: string;
  outgoingText: string;
  /** Chữ phụ: trạng thái, tên người gửi, lời dẫn. */
  secondary: string;
  primaryText: string;
  pill: string;
  field: string;
  fieldBorder: string;
  link: string;
};

/** "#abc" / "#aabbcc" → [r,g,b]; màu không đọc được coi như đen. */
export const parseHex = (color: string): [number, number, number] => {
  const hex = color.trim().replace(/^#/, "");
  const full = hex.length === 3 ? hex.split("").map((c) => c + c).join("") : hex.slice(0, 6);
  if (!/^[0-9a-f]{6}$/i.test(full)) {
    const rgb = color.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i);
    return rgb ? [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])] : [0, 0, 0];
  }
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as [number, number, number];
};

/** Độ sáng tương đối WCAG, 0 (đen) → 1 (trắng). */
export const luminance = (color: string) => {
  const [r, g, b] = parseHex(color).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

export const withAlpha = (color: string, alpha: number) => {
  const [r, g, b] = parseHex(color);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

/** Nền tối → chế độ tối kiểu iOS; nền sáng → chế độ sáng. */
export const themeFor = (background: string): ChatTheme =>
  luminance(background) < 0.4
    ? {
        dark: true,
        screen: "#000000",
        bar: "#121214",
        hairline: "rgba(255,255,255,0.12)",
        incoming: "#262628",
        incomingText: "#FFFFFF",
        outgoing: "#0A84FF",
        outgoingText: "#FFFFFF",
        secondary: "#8E8E93",
        primaryText: "#FFFFFF",
        pill: "rgba(255,255,255,0.09)",
        field: "#1C1C1E",
        fieldBorder: "#3A3A3C",
        link: "#0A84FF",
      }
    : {
        dark: false,
        screen: "#FFFFFF",
        bar: "#F6F6F8",
        hairline: "rgba(0,0,0,0.12)",
        incoming: "#E9E9EB",
        incomingText: "#000000",
        outgoing: "#0B84FE",
        outgoingText: "#FFFFFF",
        secondary: "#8A8A8E",
        primaryText: "#000000",
        pill: "rgba(0,0,0,0.06)",
        field: "#FFFFFF",
        fieldBorder: "#D1D1D6",
        link: "#0B84FE",
      };
